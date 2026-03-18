'use strict';

/**
 * tool-registry.js — Unified MCP tool registry with CSL-gated routing.
 * Registers all 12 HeadyMCP tools and provides discovery, routing, and health aggregation.
 */

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
const CSL = { MINIMUM: 0.500, LOW: 0.691, MEDIUM: 0.809, HIGH: 0.882, CRITICAL: 0.927, DEDUP: 0.972 };

const topologyQuery = require('./heady_topology_query');
const causalPredict = require('./heady_causal_predict');
const ghostRun = require('./heady_ghost_run');
const dreamHarvest = require('./heady_dream_harvest');
const swarmEvolve = require('./heady_swarm_evolve');
const consensusTribunal = require('./heady_consensus_tribunal');
const timeCrystal = require('./heady_time_crystal');
const mirrorDimension = require('./heady_mirror_dimension');
const knowledgePropagate = require('./heady_knowledge_propagate');
const resourceCrystallize = require('./heady_resource_crystallize');
const narrativeCompose = require('./heady_narrative_compose');
const empathySense = require('./heady_empathy_sense');

const TOOL_MODULES = [
  topologyQuery,
  causalPredict,
  ghostRun,
  dreamHarvest,
  swarmEvolve,
  consensusTribunal,
  timeCrystal,
  mirrorDimension,
  knowledgePropagate,
  resourceCrystallize,
  narrativeCompose,
  empathySense,
];

const TOOL_CSL_GATES = {
  heady_topology_query: CSL.MINIMUM,
  heady_causal_predict: CSL.MEDIUM,
  heady_ghost_run: CSL.LOW,
  heady_dream_harvest: CSL.MEDIUM,
  heady_swarm_evolve: CSL.HIGH,
  heady_consensus_tribunal: CSL.CRITICAL,
  heady_time_crystal: CSL.LOW,
  heady_mirror_dimension: CSL.LOW,
  heady_knowledge_propagate: CSL.MEDIUM,
  heady_resource_crystallize: CSL.MEDIUM,
  heady_narrative_compose: CSL.MINIMUM,
  heady_empathy_sense: CSL.MINIMUM,
};

const TOOL_CATEGORIES = {
  topology: ['heady_topology_query'],
  prediction: ['heady_causal_predict', 'heady_dream_harvest'],
  simulation: ['heady_ghost_run', 'heady_mirror_dimension'],
  evolution: ['heady_swarm_evolve'],
  governance: ['heady_consensus_tribunal'],
  temporal: ['heady_time_crystal'],
  network: ['heady_knowledge_propagate'],
  resources: ['heady_resource_crystallize'],
  interaction: ['heady_narrative_compose', 'heady_empathy_sense'],
};

class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.invocationCounts = new Map();
    this.errorCounts = new Map();
    this.lastInvocation = new Map();
    this.started = false;
  }

  register(toolModule) {
    if (!toolModule.name || !toolModule.handler) {
      throw new Error(`Invalid tool module: missing name or handler`);
    }
    this.tools.set(toolModule.name, {
      name: toolModule.name,
      description: toolModule.description,
      inputSchema: toolModule.inputSchema,
      handler: toolModule.handler,
      health: toolModule.health || (() => ({ status: 'unknown' })),
      csl_gate: TOOL_CSL_GATES[toolModule.name] || CSL.MINIMUM,
    });
    this.invocationCounts.set(toolModule.name, 0);
    this.errorCounts.set(toolModule.name, 0);
  }

  registerAll() {
    for (const mod of TOOL_MODULES) {
      this.register(mod);
    }
  }

  async route(toolName, params, callerCSL) {
    const cid = `registry-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const ts = new Date().toISOString();

    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        jsonrpc: '2.0',
        error: { code: 14001, message: `Tool not found: ${toolName}`, classification: 'REGISTRY_ERROR', correlation_id: cid, timestamp: ts },
      };
    }

    const effectiveCSL = callerCSL || CSL.MINIMUM;
    if (effectiveCSL < tool.csl_gate) {
      return {
        jsonrpc: '2.0',
        error: {
          code: 14002,
          message: `CSL gate denied: caller=${effectiveCSL.toFixed(3)}, required=${tool.csl_gate.toFixed(3)} for ${toolName}`,
          classification: 'CSL_GATE_ERROR',
          required_csl: tool.csl_gate,
          caller_csl: effectiveCSL,
          correlation_id: cid,
          timestamp: ts,
        },
      };
    }

    this.invocationCounts.set(toolName, (this.invocationCounts.get(toolName) || 0) + 1);
    this.lastInvocation.set(toolName, ts);

    try {
      const result = await tool.handler(params);
      return result;
    } catch (err) {
      this.errorCounts.set(toolName, (this.errorCounts.get(toolName) || 0) + 1);
      return {
        jsonrpc: '2.0',
        error: { code: 14999, message: err.message || 'Tool execution failed', tool: toolName, classification: 'TOOL_EXECUTION_ERROR', correlation_id: cid, timestamp: ts },
      };
    }
  }

  listTools() {
    const tools = [];
    for (const [name, tool] of this.tools) {
      tools.push({
        name,
        description: tool.description,
        csl_gate: tool.csl_gate,
        invocations: this.invocationCounts.get(name) || 0,
        errors: this.errorCounts.get(name) || 0,
        last_invocation: this.lastInvocation.get(name) || null,
      });
    }
    return tools;
  }

  getToolSchema(toolName) {
    const tool = this.tools.get(toolName);
    if (!tool) return null;
    return { name: tool.name, description: tool.description, inputSchema: tool.inputSchema, csl_gate: tool.csl_gate };
  }

  listSchemas() {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }

  categories() {
    return TOOL_CATEGORIES;
  }

  findByCategory(category) {
    const names = TOOL_CATEGORIES[category];
    if (!names) return [];
    return names.map(n => this.getToolSchema(n)).filter(Boolean);
  }

  async healthAll() {
    const results = {};
    let healthyCount = 0;
    let totalCount = 0;

    for (const [name, tool] of this.tools) {
      totalCount++;
      try {
        const h = typeof tool.health === 'function' ? tool.health() : { status: 'unknown' };
        results[name] = h;
        if (h.status === 'healthy') healthyCount++;
      } catch (err) {
        results[name] = { status: 'error', error: err.message };
      }
    }

    const ratio = totalCount > 0 ? healthyCount / totalCount : 0;
    const coherence = Number((ratio * PHI * PSI).toFixed(6));

    return {
      tools: results,
      summary: {
        total: totalCount,
        healthy: healthyCount,
        degraded: totalCount - healthyCount,
        coherence,
        phi_health: Number((coherence / PHI).toFixed(6)),
        csl_confidence: ratio >= PSI + PSI * PSI ? CSL.CRITICAL : ratio >= PSI ? CSL.HIGH : CSL.MEDIUM,
      },
      timestamp: new Date().toISOString(),
    };
  }

  start() {
    if (this.started) return;
    this.registerAll();
    this.started = true;
    console.log(JSON.stringify({
      level: 'info',
      message: 'HeadyMCP Tool Registry started',
      tools_registered: this.tools.size,
      categories: Object.keys(TOOL_CATEGORIES).length,
      phi: PHI,
      timestamp: new Date().toISOString(),
    }));
  }

  stop() {
    this.started = false;
    console.log(JSON.stringify({
      level: 'info',
      message: 'HeadyMCP Tool Registry stopped',
      total_invocations: Array.from(this.invocationCounts.values()).reduce((s, c) => s + c, 0),
      total_errors: Array.from(this.errorCounts.values()).reduce((s, c) => s + c, 0),
      timestamp: new Date().toISOString(),
    }));
  }

  health() {
    return {
      status: this.started ? 'healthy' : 'stopped',
      tools_registered: this.tools.size,
      total_invocations: Array.from(this.invocationCounts.values()).reduce((s, c) => s + c, 0),
      total_errors: Array.from(this.errorCounts.values()).reduce((s, c) => s + c, 0),
      categories: Object.keys(TOOL_CATEGORIES).length,
      csl_gates: TOOL_CSL_GATES,
      phi: PHI,
      timestamp: new Date().toISOString(),
    };
  }
}

const registry = new ToolRegistry();

module.exports = {
  ToolRegistry,
  registry,
  TOOL_CSL_GATES,
  TOOL_CATEGORIES,
  TOOL_MODULES,
};
