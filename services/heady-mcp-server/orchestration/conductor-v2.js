/**
 * @fileoverview HeadyConductor V2 — Enhanced Orchestration Hub
 * @description Central conductor integrating all services, tools, agents, nodes, and workflows.
 * Updated routing tables, tool dispatch, workflow orchestration, and Sacred Geometry topology.
 * @module conductor-v2
 */

'use strict';

const {
  PHI, PSI, PHI_SQUARED, PHI_CUBED, FIB, CSL, CSL_ERROR_CODES,
  SACRED_GEOMETRY, INTERVALS, POOLS, FUSION_WEIGHTS,
  phiBackoff, phiDecay, phiUrgency, adaptiveInterval,
  correlationId, structuredLog,
} = require('./phi-constants');

// ─── ROUTING TABLE ───────────────────────────────────────────────────────────

/**
 * @constant {Object} NODE_REGISTRY - All known nodes by Sacred Geometry position
 */
const NODE_REGISTRY = {
  // Center
  HeadySoul:       { ring: 'CENTER',     type: 'core',       capabilities: ['awareness', 'values', 'identity'] },
  // Inner Ring
  HeadyBrains:     { ring: 'INNER_RING', type: 'core',       capabilities: ['reasoning', 'llm', 'inference'] },
  HeadyConductor:  { ring: 'INNER_RING', type: 'orchestrator', capabilities: ['routing', 'orchestration', 'dispatch'] },
  HeadyVinci:      { ring: 'INNER_RING', type: 'creative',   capabilities: ['creative', 'generation', 'design'] },
  HeadyAutoSuccess:{ ring: 'INNER_RING', type: 'automation', capabilities: ['automation', 'workflow', 'scheduling'] },
  GENESIS:         { ring: 'INNER_RING', type: 'node',       capabilities: ['spawning', 'instantiation', 'scaling'] },
  // Middle Ring
  JULES:           { ring: 'MIDDLE_RING', type: 'agent',     capabilities: ['coding', 'development', 'refactoring'] },
  BUILDER:         { ring: 'MIDDLE_RING', type: 'agent',     capabilities: ['building', 'compilation', 'deployment'] },
  OBSERVER:        { ring: 'MIDDLE_RING', type: 'agent',     capabilities: ['monitoring', 'telemetry', 'alerting'] },
  MURPHY:          { ring: 'MIDDLE_RING', type: 'agent',     capabilities: ['resilience', 'chaos', 'fault-injection'] },
  ATLAS:           { ring: 'MIDDLE_RING', type: 'agent',     capabilities: ['mapping', 'discovery', 'navigation'] },
  PYTHIA:          { ring: 'MIDDLE_RING', type: 'agent',     capabilities: ['prediction', 'forecasting', 'analytics'] },
  NEXUS:           { ring: 'MIDDLE_RING', type: 'node',      capabilities: ['cross-domain', 'bridging', 'routing'] },
  // Outer Ring
  BRIDGE:          { ring: 'OUTER_RING', type: 'connector',  capabilities: ['integration', 'api', 'external'] },
  MUSE:            { ring: 'OUTER_RING', type: 'creative',   capabilities: ['inspiration', 'ideation', 'brainstorm'] },
  SENTINEL:        { ring: 'OUTER_RING', type: 'security',   capabilities: ['monitoring', 'threat-detection', 'audit'] },
  NOVA:            { ring: 'OUTER_RING', type: 'engine',     capabilities: ['processing', 'computation', 'transform'] },
  JANITOR:         { ring: 'OUTER_RING', type: 'maintenance',capabilities: ['cleanup', 'gc', 'optimization'] },
  SOPHIA:          { ring: 'OUTER_RING', type: 'wisdom',     capabilities: ['knowledge', 'learning', 'synthesis'] },
  CIPHER:          { ring: 'OUTER_RING', type: 'security',   capabilities: ['encryption', 'auth', 'secrets'] },
  LENS:            { ring: 'OUTER_RING', type: 'analytics',  capabilities: ['visualization', 'dashboard', 'reporting'] },
  AEGIS:           { ring: 'OUTER_RING', type: 'node',       capabilities: ['protection', 'defense', 'security-coordination'] },
  // Governance
  HeadyCheck:      { ring: 'GOVERNANCE', type: 'governance', capabilities: ['quality', 'validation', 'review'] },
  HeadyAssure:     { ring: 'GOVERNANCE', type: 'governance', capabilities: ['assurance', 'compliance', 'audit'] },
  HeadyAware:      { ring: 'GOVERNANCE', type: 'governance', capabilities: ['awareness', 'context', 'situational'] },
  HeadyPatterns:   { ring: 'GOVERNANCE', type: 'governance', capabilities: ['patterns', 'anti-patterns', 'standards'] },
  HeadyMC:         { ring: 'GOVERNANCE', type: 'governance', capabilities: ['coordination', 'consensus', 'voting'] },
  HeadyRisks:      { ring: 'GOVERNANCE', type: 'governance', capabilities: ['risk', 'assessment', 'mitigation'] },
  ORACLE:          { ring: 'GOVERNANCE', type: 'node',       capabilities: ['wisdom', 'synthesis', 'guidance'] },
  CHRONICLE:       { ring: 'GOVERNANCE', type: 'node',       capabilities: ['history', 'audit-trail', 'immutable-log'] },
};

// ─── TOOL DISPATCH TABLE ─────────────────────────────────────────────────────

/**
 * @constant {Object} TOOL_DISPATCH - Maps tool names to their handler references
 */
const TOOL_DISPATCH = {
  // Existing tools
  'vector-search':        { handler: 'vector-ops',        minCSL: CSL.LOW },
  'vector-store':         { handler: 'vector-ops',        minCSL: CSL.MEDIUM },
  'llm-generate':         { handler: 'HeadyBrains',       minCSL: CSL.MEDIUM },
  'code-analyze':         { handler: 'JULES',             minCSL: CSL.LOW },
  'code-refactor':        { handler: 'JULES',             minCSL: CSL.MEDIUM },
  'deploy-service':       { handler: 'BUILDER',           minCSL: CSL.HIGH },
  'monitor-metrics':      { handler: 'OBSERVER',          minCSL: CSL.LOW },
  'chaos-inject':         { handler: 'MURPHY',            minCSL: CSL.CRITICAL },
  'predict-trend':        { handler: 'PYTHIA',            minCSL: CSL.MEDIUM },
  'encrypt-payload':      { handler: 'CIPHER',            minCSL: CSL.HIGH },
  'audit-check':          { handler: 'HeadyAssure',       minCSL: CSL.HIGH },
  // New tools (12 additions)
  'causal-trace':         { handler: 'causal-tracer',     minCSL: CSL.MEDIUM },
  'ghost-run':            { handler: 'ghost-runner',      minCSL: CSL.HIGH },
  'swarm-broadcast':      { handler: 'swarm-broadcaster', minCSL: CSL.MEDIUM },
  'memory-prune':         { handler: 'memory-pruner',     minCSL: CSL.MEDIUM },
  'pattern-match':        { handler: 'pattern-matcher',   minCSL: CSL.LOW },
  'schema-evolve':        { handler: 'schema-evolver',    minCSL: CSL.HIGH },
  'drift-detect':         { handler: 'drift-detector',    minCSL: CSL.MEDIUM },
  'fusion-merge':         { handler: 'fusion-merger',     minCSL: CSL.MEDIUM },
  'policy-enforce':       { handler: 'policy-enforcer',   minCSL: CSL.CRITICAL },
  'topology-scan':        { handler: 'topology-scanner',  minCSL: CSL.LOW },
  'latent-dream':         { handler: 'dream-engine',      minCSL: CSL.MEDIUM },
  'battle-evaluate':      { handler: 'battle-arena',      minCSL: CSL.MEDIUM },
};

// ─── AGENT DISPATCH TABLE ────────────────────────────────────────────────────

/**
 * @constant {Object} AGENT_DISPATCH - Agent-to-capability routing
 */
const AGENT_DISPATCH = {
  'immune-agent':       { node: 'AEGIS',     capabilities: ['threat-detection', 'defense', 'vaccination'] },
  'archaeologist-agent':{ node: 'ORACLE',    capabilities: ['knowledge-archaeology', 'temporal-reversal', 'excavation'] },
  'diplomat-agent':     { node: 'NEXUS',     capabilities: ['negotiation', 'mediation', 'sla-management'] },
  'cartographer-agent': { node: 'NEXUS',     capabilities: ['topology-mapping', 'dependency-graph', 'gap-detection'] },
  'prophet-agent':      { node: 'ORACLE',    capabilities: ['failure-prediction', 'causal-inference', 'early-warning'] },
};

// ─── WORKFLOW DISPATCH TABLE ─────────────────────────────────────────────────

/**
 * @constant {Object} WORKFLOW_DISPATCH - Workflow routing and dependencies
 */
const WORKFLOW_DISPATCH = {
  'ecosystem-health-scan': {
    agents: ['cartographer-agent', 'immune-agent'],
    nodes: ['AEGIS', 'NEXUS', 'ORACLE'],
    criticality: 'high',
    minCSL: CSL.MEDIUM,
  },
  'genetic-optimization-cycle': {
    agents: ['prophet-agent'],
    nodes: ['GENESIS', 'ORACLE'],
    criticality: 'medium',
    minCSL: CSL.MEDIUM,
  },
  'knowledge-consolidation': {
    agents: ['archaeologist-agent'],
    nodes: ['ORACLE', 'CHRONICLE'],
    criticality: 'medium',
    minCSL: CSL.LOW,
  },
  'self-healing-cycle': {
    agents: ['immune-agent', 'prophet-agent'],
    nodes: ['AEGIS', 'GENESIS'],
    criticality: 'critical',
    minCSL: CSL.HIGH,
  },
  'liquid-rebalance': {
    agents: ['cartographer-agent'],
    nodes: ['NEXUS'],
    criticality: 'high',
    minCSL: CSL.MEDIUM,
  },
};

// ─── CONDUCTOR V2 ────────────────────────────────────────────────────────────

/**
 * @class ConductorV2
 * @description Enhanced HeadyConductor with full ecosystem integration.
 * Routes requests to nodes, dispatches tools, orchestrates workflows,
 * and maintains Sacred Geometry coherence.
 */
class ConductorV2 {
  /**
   * @param {Object} config
   * @param {Object} [config.eventBus] - LiquidEventBus instance
   * @param {Object} [config.serviceMesh] - ServiceMesh instance
   * @param {Object} [config.pipelineExecutor] - AsyncPipelineExecutor instance
   */
  constructor(config = {}) {
    /** @private */
    this._eventBus = config.eventBus || null;
    this._serviceMesh = config.serviceMesh || null;
    this._pipelineExecutor = config.pipelineExecutor || null;

    /** @private */
    this._corrId = correlationId('cond');
    this._running = false;
    this._startedAt = null;

    /** @private {Map<string, Object>} Active workflow instances */
    this._activeWorkflows = new Map();

    /** @private {Map<string, Function>} Registered tool handlers */
    this._toolHandlers = new Map();

    /** @private */
    this._stats = {
      toolDispatches: 0,
      workflowsStarted: 0,
      workflowsCompleted: 0,
      routingDecisions: 0,
      escalations: 0,
    };
  }

  /**
   * Start the conductor
   * @returns {Promise<void>}
   */
  async start() {
    if (this._running) return;
    this._running = true;
    this._startedAt = Date.now();

    // Subscribe to event bus channels
    if (this._eventBus) {
      this._eventBus.subscribe('system', (evt) => this._handleSystemEvent(evt));
      this._eventBus.subscribe('tool', (evt) => this._handleToolEvent(evt));
      this._eventBus.subscribe('agent', (evt) => this._handleAgentEvent(evt));
    }

    // Register all nodes with service mesh
    if (this._serviceMesh) {
      for (const [name, def] of Object.entries(NODE_REGISTRY)) {
        this._serviceMesh.register({
          id: name,
          name,
          type: def.type,
          ring: def.ring,
          capabilities: def.capabilities,
          endpoint: `internal://${name.toLowerCase()}`,
        });
      }
    }

    this._log('info', 'ConductorV2 started with full ecosystem integration');
  }

  /**
   * Stop the conductor gracefully
   * @returns {Promise<void>}
   */
  async stop() {
    this._running = false;
    // Cancel active workflows
    for (const [wfId, wf] of this._activeWorkflows.entries()) {
      wf.cancelled = true;
      if (this._pipelineExecutor) {
        this._pipelineExecutor.cancel(wfId);
      }
    }
    this._activeWorkflows.clear();
    this._log('info', 'ConductorV2 stopped');
  }

  /**
   * Register a tool handler
   * @param {string} toolName - Tool name matching TOOL_DISPATCH key
   * @param {Function} handler - Async handler function(params, context) → result
   */
  registerToolHandler(toolName, handler) {
    this._toolHandlers.set(toolName, handler);
  }

  /**
   * Dispatch a tool execution
   * @param {string} toolName - Tool name
   * @param {Object} params - Tool parameters
   * @param {Object} [context={}] - Execution context
   * @returns {Promise<Object>} Tool result
   */
  async dispatchTool(toolName, params, context = {}) {
    const dispatch = TOOL_DISPATCH[toolName];
    if (!dispatch) {
      throw new Error(`${CSL_ERROR_CODES.E_BELOW_MINIMUM.code}: Unknown tool '${toolName}'`);
    }

    const corrId = context.correlationId || correlationId('tool');
    this._stats.toolDispatches++;

    // CSL gate check
    const coherence = context.coherence || CSL.HIGH;
    if (coherence < dispatch.minCSL) {
      throw new Error(`${CSL_ERROR_CODES.E_MEDIUM_REQUIRED.code}: Tool '${toolName}' requires CSL >= ${dispatch.minCSL}, got ${coherence}`);
    }

    // Route via service mesh if available
    if (this._serviceMesh) {
      const service = this._serviceMesh.route(dispatch.handler, dispatch.minCSL);
      if (service) {
        context.targetService = service.id;
        context.targetEndpoint = service.endpoint;
      }
    }

    // Execute via registered handler
    const handler = this._toolHandlers.get(toolName);
    if (handler) {
      try {
        const result = await handler(params, { ...context, correlationId: corrId });
        if (this._serviceMesh && context.targetService) {
          this._serviceMesh.recordSuccess(context.targetService);
        }
        // Emit completion event
        if (this._eventBus) {
          this._eventBus.publish('tool', 'tool.completed', {
            tool: toolName,
            correlationId: corrId,
          }, { correlationId: corrId, source: 'ConductorV2' });
        }
        return result;
      } catch (err) {
        if (this._serviceMesh && context.targetService) {
          this._serviceMesh.recordFailure(context.targetService);
        }
        throw err;
      }
    }

    // Return routing info if no handler registered
    return {
      routed: true,
      tool: toolName,
      handler: dispatch.handler,
      correlationId: corrId,
      message: `Tool '${toolName}' routed to '${dispatch.handler}' — no local handler registered`,
    };
  }

  /**
   * Start a workflow
   * @param {string} workflowName - Workflow name from WORKFLOW_DISPATCH
   * @param {Object} [params={}] - Workflow parameters
   * @returns {Promise<Object>} Workflow result
   */
  async startWorkflow(workflowName, params = {}) {
    const dispatch = WORKFLOW_DISPATCH[workflowName];
    if (!dispatch) {
      throw new Error(`${CSL_ERROR_CODES.E_BELOW_MINIMUM.code}: Unknown workflow '${workflowName}'`);
    }

    const wfId = correlationId('wf');
    this._stats.workflowsStarted++;

    // CSL gate
    const coherence = params.coherence || CSL.HIGH;
    if (coherence < dispatch.minCSL) {
      throw new Error(`${CSL_ERROR_CODES.E_HIGH_REQUIRED.code}: Workflow '${workflowName}' requires CSL >= ${dispatch.minCSL}`);
    }

    this._activeWorkflows.set(wfId, {
      name: workflowName,
      startedAt: Date.now(),
      cancelled: false,
    });

    // Publish workflow start event
    if (this._eventBus) {
      this._eventBus.publish('system', 'workflow.started', {
        workflowId: wfId,
        name: workflowName,
        agents: dispatch.agents,
        nodes: dispatch.nodes,
      }, { correlationId: wfId, source: 'ConductorV2' });
    }

    this._log('info', `Workflow '${workflowName}' started`, { workflowId: wfId });

    return {
      workflowId: wfId,
      name: workflowName,
      status: 'started',
      agents: dispatch.agents,
      nodes: dispatch.nodes,
      criticality: dispatch.criticality,
    };
  }

  /**
   * Route a request to the best node based on intent
   * @param {string} intent - Request intent/capability
   * @param {Object} [context={}] - Request context
   * @returns {Object} Routing decision
   */
  routeByIntent(intent, context = {}) {
    this._stats.routingDecisions++;

    // Find matching nodes from registry
    const candidates = [];
    for (const [name, def] of Object.entries(NODE_REGISTRY)) {
      const matches = def.capabilities.some(cap =>
        cap === intent || intent.includes(cap) || cap.includes(intent)
      );
      if (matches) {
        const ringConfig = SACRED_GEOMETRY[def.ring];
        const weight = ringConfig ? ringConfig.weight : 1.0;
        candidates.push({ name, ring: def.ring, weight, type: def.type });
      }
    }

    if (candidates.length === 0) {
      return {
        routed: false,
        intent,
        message: `No node matches intent '${intent}'`,
      };
    }

    // Sort by ring weight (inner rings preferred)
    candidates.sort((a, b) => b.weight - a.weight);

    return {
      routed: true,
      intent,
      primary: candidates[0],
      alternatives: candidates.slice(1, FIB[4]),
      totalCandidates: candidates.length,
    };
  }

  /**
   * Get agent dispatch info
   * @param {string} agentName
   * @returns {Object|null}
   */
  getAgentDispatch(agentName) {
    return AGENT_DISPATCH[agentName] || null;
  }

  /**
   * Handle system events
   * @private
   */
  _handleSystemEvent(envelope) {
    if (envelope.type === 'escalation') {
      this._stats.escalations++;
      this._log('warn', 'Escalation received', { payload: envelope.payload });
    }
  }

  /**
   * Handle tool events
   * @private
   */
  _handleToolEvent(envelope) {
    // Track tool lifecycle events
  }

  /**
   * Handle agent events
   * @private
   */
  _handleAgentEvent(envelope) {
    // Track agent lifecycle events
  }

  /**
   * Log helper
   * @private
   */
  _log(level, message, meta = {}) {
    const entry = structuredLog(level, 'ConductorV2', message, meta, this._corrId);
    if (this._eventBus) {
      this._eventBus.publish('system', `conductor.${level}`, entry, {
        correlationId: this._corrId,
        source: 'ConductorV2',
      });
    }
  }

  /**
   * Get health status
   * @returns {Object}
   */
  health() {
    const uptime = this._startedAt ? Date.now() - this._startedAt : 0;
    const toolCoverage = this._toolHandlers.size / Object.keys(TOOL_DISPATCH).length;
    const coherence = this._running
      ? CSL.HIGH * (PSI + toolCoverage * PSI)
      : CSL.MINIMUM;

    return {
      status: this._running ? 'healthy' : 'stopped',
      coherence: parseFloat(Math.min(coherence, 1.0).toFixed(FIB[4])),
      running: this._running,
      uptime,
      registeredNodes: Object.keys(NODE_REGISTRY).length,
      registeredTools: Object.keys(TOOL_DISPATCH).length,
      registeredHandlers: this._toolHandlers.size,
      activeWorkflows: this._activeWorkflows.size,
      agents: Object.keys(AGENT_DISPATCH).length,
      workflows: Object.keys(WORKFLOW_DISPATCH).length,
      stats: { ...this._stats },
      phi: PHI,
    };
  }
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

module.exports = {
  ConductorV2,
  NODE_REGISTRY,
  TOOL_DISPATCH,
  AGENT_DISPATCH,
  WORKFLOW_DISPATCH,
};
