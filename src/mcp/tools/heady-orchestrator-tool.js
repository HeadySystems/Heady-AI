import { ResonanceOrchestrator } from '../../core/orchestrator/resonance-orchestrator.js';
import { createLogger } from '../../../packages/structured-logger/src/index.js';

const logger = createLogger({ service: 'heady-orchestrator-tool' });

let orchestratorInstance = null;

async function getOrchestrator() {
    if (orchestratorInstance) return orchestratorInstance;
    try {
        orchestratorInstance = new ResonanceOrchestrator();
        logger.info('Heady™ Resonance Orchestrator initialized');
        return orchestratorInstance;
    } catch (error) {
        logger.error('Failed to initialize Resonance Orchestrator', { error: error.message });
        throw error;
    }
}

export async function handleHeadyOrchestrator(args) {
    const { action, schema, input_context } = args;
    const orchestrator = await getOrchestrator();
    
    try {
        switch (action) {
            case 'validate':
                if (!schema) throw new Error('Schema is required for validation');
                const validation = await orchestrator.validateSchema(schema);
                return {
                    success: true,
                    action: 'validate',
                    valid: validation.valid,
                    errors: validation.errors
                };
                
            case 'execute':
                if (!schema) throw new Error('Schema is required for execution');
                if (!input_context) throw new Error('input_context is required for execution');
                
                const result = await orchestrator.execute(schema, input_context);
                
                return {
                    success: true,
                    action: 'execute',
                    workflow_id: result.workflow_id,
                    status: result.status,
                    trace: result.trace,
                    final_context: result.final_context
                };
                
            default:
                throw new Error(`Unsupported action: ${action}`);
        }
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

export const headyOrchestratorDef = {
    name: 'heady_orchestrator',
    description: 'Executes multi-agent workflows defined by HeadyResonanceSchemas',
    inputSchema: {
        type: 'object',
        properties: {
            action: { type: 'string', enum: ['execute', 'validate'] },
            schema: { type: 'object' },
            input_context: { type: 'string' }
        },
        required: ['action']
    }
};
