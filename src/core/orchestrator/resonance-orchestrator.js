import { CSLEngine } from '../csl-engine/csl-engine.js';
import { ModelRouter } from './model-router.js';
import { SystemTelemetryBee } from './system-telemetry.js';

import { CSL_THRESHOLDS } from '../phi-math.js';
import { createLogger } from '../../../packages/structured-logger/src/index.js';

const logger = createLogger({ service: 'resonance-orchestrator' });

export class ResonanceOrchestrator {
    constructor(cslEngine) {
        this.cslEngine = cslEngine || new CSLEngine({ dim: 384 });
        this.modelRouter = new ModelRouter();
        this.telemetry = new SystemTelemetryBee();
        
        // Autonomously initialize the stream if it hasn't been
        this.telemetry.initializeBriefingStream().catch(e => logger.warn('Failed to init briefing stream:', e));
    }

    // Mock embedder for intent vectors
    embedIntent(text) {
        const seed = text.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0);
        const vec = new Float64Array(384);
        for (let i = 0; i < 384; i++) vec[i] = Math.sin(seed + i);
        const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
        for (let i = 0; i < 384; i++) vec[i] /= norm;
        return vec;
    }

    async validateSchema(schema) {
        const errors = [];
        if (!schema.workflow_id) errors.push('Missing workflow_id');
        if (!Array.isArray(schema.nodes)) errors.push('Missing or invalid nodes array');
        if (!Array.isArray(schema.csl_edges)) errors.push('Missing or invalid csl_edges array');
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    async determineRoute(inputContext, edges) {
        let bestEdge = null;
        let bestScore = -1;
        let activatedEdges = [];

        const inputVector = this.embedIntent(inputContext);

        for (const edge of edges) {
            if (!edge.condition || !edge.condition.description) continue;

            const edgeVector = this.embedIntent(edge.condition.description);
            // Default to MEDIUM threshold if not specified
            const threshold = edge.condition.gate_threshold ? 
                CSL_THRESHOLDS[edge.condition.gate_threshold.split('.')[1]] || CSL_THRESHOLDS.MEDIUM 
                : CSL_THRESHOLDS.MEDIUM;

            const { activation, cosScore } = this.cslEngine.GATE(inputVector, edgeVector, threshold);

            if (activation > 0.5) {
                activatedEdges.push({ edge, score: cosScore });
                if (cosScore > bestScore) {
                    bestScore = cosScore;
                    bestEdge = edge;
                }
            }
        }

        return { bestEdge, activatedEdges };
    }

    async execute(schema, inputContext) {
        const validation = await this.validateSchema(schema);
        if (!validation.valid) throw new Error(`Invalid schema: ${validation.errors.join(', ')}`);

        logger.info(`Starting execution of resonance schema: ${schema.workflow_id}`);
        await this.telemetry.logEvent(
            'Orchestrator Initialization',
            { action: 'Executing Schema', workflow_id: schema.workflow_id },
            `Received a new autonomous workflow requirement. Initializing agent routing for schema: ${schema.workflow_id}.`
        );

        // Find starting node (node with no incoming edges or explicitly marked)
        const incomingEdges = new Set(schema.csl_edges.map(e => e.to));
        let currentNode = schema.nodes.find(n => !incomingEdges.has(n.id)) || schema.nodes[0];
        
        const executionTrace = [];
        let contextState = inputContext;

        while (currentNode) {
            logger.info(`Executing node: ${currentNode.id} (${currentNode.agent})`);
            
            // Execute the node using the model router
            const nodeResult = await this.modelRouter.executeNode(currentNode, contextState);
            
            executionTrace.push({ 
                node: currentNode.id, 
                action: 'execute', 
                model: nodeResult.model_used,
                provider: nodeResult.provider,
                input_context: contextState,
                output: nodeResult.output
            });

            await this.telemetry.logEvent(
                'Agent Node Execution',
                { action: 'Executed Node', payload: nodeResult },
                `The ${currentNode.agent} executed the task successfully using the ${nodeResult.model_used} model via the ${nodeResult.provider} provider. The output is ready for routing.`
            );

            // Update context state with the output from this node
            contextState = nodeResult.output;

            // Find outbound edges from current node
            const outboundEdges = schema.csl_edges.filter(e => e.from === currentNode.id);
            
            if (outboundEdges.length === 0) {
                executionTrace.push({ node: currentNode.id, action: 'complete' });
                break; // End of workflow
            }

            // Determine next route based on CSL Intent
            const routeResult = await this.determineRoute(contextState, outboundEdges);
            
            if (routeResult.bestEdge) {
                const edgeDesc = `${routeResult.bestEdge.from} -> ${routeResult.bestEdge.to}`;
                const routeScore = routeResult.activatedEdges.find(e => e.edge === routeResult.bestEdge).score;
                
                executionTrace.push({ 
                    action: 'route', 
                    edge: edgeDesc,
                    score: routeScore
                });
                
                await this.telemetry.logEvent(
                    'CSL Semantic Routing',
                    { action: 'Activated Path', edge: edgeDesc, confidence_score: routeScore },
                    `The Continuous Semantic Logic (CSL) engine analyzed the context and determined the next optimal action is to route to the [${routeResult.bestEdge.to}] agent with a confidence score of ${routeScore.toFixed(4)}.`
                );
                
                currentNode = schema.nodes.find(n => n.id === routeResult.bestEdge.to);
            } else {
                executionTrace.push({ action: 'route_failed', reason: 'No CSL gates activated above threshold' });
                logger.warn(`Execution halted at ${currentNode.id}: No resonant edges found.`);
                await this.telemetry.logEvent(
                    'Orchestrator Halt',
                    { action: 'No Path Found', current_node: currentNode.id },
                    `The workflow naturally completed or no logical condition was met to continue routing. The Swarm is standing by.`
                );
                break;
            }
        }

        return {
            status: 'completed',
            workflow_id: schema.workflow_id,
            trace: executionTrace,
            final_context: contextState
        };
    }
}
