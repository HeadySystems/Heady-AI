/**
 * Heady™ Core — Unified System Entry Point
 * ═════════════════════════════════════════
 *
 * THE single import for all core Heady™ infrastructure.
 *
 * Usage:
 *   const heady = require('./core');
 *   const engine = new heady.PipelineEngine();
 *   const conductor = new heady.Conductor();
 *
 * @module core
 */
'use strict';

// ─── Constants ──────────────────────────────────────────────────────────────────
const phi = require('./constants/phi');

// ─── Infrastructure ─────────────────────────────────────────────────────────────
const { CircuitBreaker, CircuitBreakerPool, STATES: CB_STATES } = require('./infrastructure/circuit-breaker');
const { WorkerPool } = require('./infrastructure/worker-pool');

// ─── Pipeline ───────────────────────────────────────────────────────────────────
const { STAGES, STAGE_NAMES, VARIANTS, HCFP_PHASES, AUTO_SUCCESS_CATEGORIES, selectVariant } = require('./pipeline/stages');
const { PipelineEngine, RUN_STATE } = require('./pipeline/engine');

// ─── Orchestrator ───────────────────────────────────────────────────────────────
const { Conductor, AGENT_STATE, PRIORITY } = require('./orchestrator/conductor');

// ─── Scheduler ──────────────────────────────────────────────────────────────────
const { AutoSuccessScheduler, TASK_STATE } = require('./scheduler/auto-success');

// ─── Agents ─────────────────────────────────────────────────────────────────────
const { AGENTS, AGENT_NAMES, getAgent, findAgentsByCategory, findAgentsByTool } = require('./agents/registry');

// ─── Latent Space ────────────────────────────────────────────────────────────────
const vectorOps = require('./latent/vector-ops');
const { EmbeddingRouter, PROVIDERS: EMBEDDING_PROVIDERS } = require('./latent/embedding-router');

// ─── Liquid Nodes ────────────────────────────────────────────────────────────────
const { LiquidNodeRegistry, NODE_TYPE, NODE_STATE, PLATFORMS } = require('./liquid/node-registry');
const { getProvisioner, getAllProvisioners } = require('./liquid/provisioners');

// ─── System Bootstrap ───────────────────────────────────────────────────────────

/**
 * Create a fully wired Heady™ system instance.
 * @param {object} [opts]
 * @returns {{ engine, conductor, scheduler, phi }}
 */
function createSystem(opts = {}) {
  const engine = new PipelineEngine({
    maxConcurrentRuns: opts.maxConcurrentRuns,
    maxRetries: opts.maxRetries,
  });

  const conductor = new Conductor({
    maxConcurrentTasks: opts.maxConcurrentTasks,
    taskTimeoutMs: opts.taskTimeoutMs,
  });

  const scheduler = new AutoSuccessScheduler({
    heartbeatMs: opts.heartbeatMs,
    maxTasks: opts.maxTasks,
  });

  // Register all canonical agents with the conductor
  for (const agentDef of Object.values(AGENTS)) {
    conductor.registerAgent(agentDef.name, {
      categories: agentDef.categories,
      domains: agentDef.domains,
      maxConcurrent: agentDef.maxConcurrent,
      modelTier: agentDef.modelTier,
      metadata: {
        displayName: agentDef.displayName,
        role: agentDef.role,
        tools: agentDef.tools,
        cslThreshold: agentDef.cslThreshold,
      },
    });
  }

  // Wire pipeline completion events to scheduler metrics
  engine.on('run:complete', (result) => {
    conductor.emit('pipeline:complete', result);
  });

  // Initialize liquid node registry
  const nodeRegistry = new LiquidNodeRegistry();

  // Initialize embedding router
  const embeddingRouter = new EmbeddingRouter({
    defaultProvider: opts.defaultEmbeddingProvider,
  });

  return { engine, conductor, scheduler, nodeRegistry, embeddingRouter, phi };
}

// ─── Exports ────────────────────────────────────────────────────────────────────

module.exports = {
  // Factory
  createSystem,

  // Constants
  ...phi,

  // Infrastructure
  CircuitBreaker,
  CircuitBreakerPool,
  CB_STATES,
  WorkerPool,

  // Pipeline
  STAGES,
  STAGE_NAMES,
  VARIANTS,
  HCFP_PHASES,
  AUTO_SUCCESS_CATEGORIES,
  selectVariant,
  PipelineEngine,
  RUN_STATE,

  // Orchestrator
  Conductor,
  AGENT_STATE,
  PRIORITY,

  // Scheduler
  AutoSuccessScheduler,
  TASK_STATE,

  // Agents
  AGENTS,
  AGENT_NAMES,
  getAgent,
  findAgentsByCategory,
  findAgentsByTool,

  // Latent Space
  ...vectorOps,
  EmbeddingRouter,
  EMBEDDING_PROVIDERS,

  // Liquid Nodes
  LiquidNodeRegistry,
  NODE_TYPE,
  NODE_STATE,
  PLATFORMS,
  getProvisioner,
  getAllProvisioners,
};
