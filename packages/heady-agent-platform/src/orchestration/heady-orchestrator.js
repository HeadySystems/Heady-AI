// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Orchestrator v1.0.0                                    ║
// ║  Master orchestration engine — the brain of the agent platform ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝
import { EventEmitter } from 'events';
import { readFileSync } from 'fs';
import { SwarmMessageBus } from './swarm-message-bus.js';
import { DAGExecutor } from './dag-executor.js';
import { PatternEngine } from './pattern-engine.js';
import { BackpressureManager } from './backpressure-manager.js';
import { CSLRouter } from '../routing/csl-router.js';
import { BeeFactory } from '../bees/bee-factory.js';
import { AgentRuntime } from '../agents/agent-runtime.js';
import { A2AProtocol } from '../protocols/a2a-protocol.js';
import { HandoffRouter } from '../protocols/handoff-router.js';
import { HealthMonitor } from '../services/health-monitor.js';
import { PlatformConfig } from '../../config/platform-config.js';

const PHI = 1.6180339887498948;
const PSI = 0.6180339887498949;

/**
 * HeadyOrchestrator — The master brain of the Heady Agent Platform.
 *
 * This is the production-grade orchestration engine that surpasses:
 *   - LangGraph: We have graph execution + 9 patterns (they have 1)
 *   - CrewAI: We have dynamic bee spawning (they have static crews)
 *   - AutoGen: We have typed event bus (they have untyped chat)
 *   - OpenAI Swarm: We have 17 hierarchical swarms (they have flat handoffs)
 *   - Google ADK: We have phi-scaled everything (they have fixed constants)
 *
 * Lifecycle: init() → loadSwarms() → route(task) → execute() → shutdown()
 */
export class HeadyOrchestrator extends EventEmitter {
  constructor(options = {}) {
    super();
    this.setMaxListeners(100);

    // ─── Core Subsystems ──────────────────────────────────────────
    this._messageBus = new SwarmMessageBus();
    this._backpressure = new BackpressureManager();
    this._beeFactory = new BeeFactory();
    this._agentRuntime = new AgentRuntime();
    this._a2a = new A2AProtocol(this._messageBus);
    this._handoff = new HandoffRouter(this._messageBus);
    this._healthMonitor = new HealthMonitor();

    // CSL router needs an embedding function — use placeholder until configured
    this._cslRouter = new CSLRouter(options.embedFn || this._defaultEmbedFn);

    // ─── State ────────────────────────────────────────────────────
    this._swarms = new Map();
    this._swarmConfig = null;
    this._running = false;
    this._metrics = {
      tasksRouted: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      avgLatencyMs: 0,
      startTime: null,
    };

    // ─── Wire event handlers ──────────────────────────────────────
    this._wireEvents();
  }

  /**
   * Initialize the orchestrator: load swarm definitions, register with subsystems.
   * @param {string} configPath — Path to swarm-definitions.json
   */
  async init(configPath) {
    const configText = readFileSync(configPath, 'utf-8');
    this._swarmConfig = JSON.parse(configText);

    // Register all 17 swarms
    for (const swarm of this._swarmConfig.swarms) {
      await this._registerSwarm(swarm);
    }

    // Start health monitoring
    this._healthMonitor.startMonitoring(
      Array.from(this._swarms.keys()),
      PlatformConfig.healthCheckMs
    );

    this._running = true;
    this._metrics.startTime = Date.now();

    this.emit('orchestrator:ready', {
      swarmCount: this._swarms.size,
      totalBeeCapacity: this._swarmConfig.swarms.reduce((sum, s) => sum + s.maxBees, 0),
    });

    return this;
  }

  /**
   * Route a task to the best swarm using CSL semantic routing.
   *
   * @param {object} task — { id, description, priority?, domain?, metadata? }
   * @returns {Promise<object>} — Execution result
   */
  async routeTask(task) {
    if (!this._running) {
      throw new Error('Orchestrator not running — call init() first');
    }

    const startTime = Date.now();
    this._metrics.tasksRouted++;

    // ─── Step 1: CSL Routing ────────────────────────────────────
    const routeResult = await this._cslRouter.route(task);

    // ─── Step 2: Backpressure Check ─────────────────────────────
    const targetSwarmId = routeResult.swarmId || this._selectFallbackSwarm(task);
    const admission = this._backpressure.submit(targetSwarmId, task);

    if (!admission.accepted) {
      // Try alternative swarms (phi-weighted fallback chain)
      const altSwarm = await this._findAlternativeSwarm(task, targetSwarmId);
      if (altSwarm) {
        const altAdmission = this._backpressure.submit(altSwarm, task);
        if (altAdmission.accepted) {
          return this._executeOnSwarm(altSwarm, task, startTime);
        }
      }

      this._metrics.tasksFailed++;
      return {
        status: 'rejected',
        reason: admission.reason,
        pressure: admission.pressure,
        taskId: task.id,
      };
    }

    // ─── Step 3: Execute ────────────────────────────────────────
    return this._executeOnSwarm(targetSwarmId, task, startTime);
  }

  /**
   * Execute a task using a specific multi-agent pattern.
   *
   * @param {string} pattern — Pattern name from PatternEngine
   * @param {object} config — Pattern-specific configuration
   * @param {object} initialState — Starting state
   * @returns {Promise<object>} — DAG execution result
   */
  async executePattern(pattern, config, initialState = {}) {
    let dag;

    switch (pattern) {
      case 'sequential':
        dag = PatternEngine.sequential(config.stages);
        break;
      case 'parallel':
        dag = PatternEngine.parallelFanOut(config.dispatcher, config.workers, config.synthesizer);
        break;
      case 'coordinator':
        dag = PatternEngine.coordinatorDispatch(config.coordinator, config.specialists);
        break;
      case 'hierarchical':
        dag = PatternEngine.hierarchical(config.orchestrator, config.coordinators);
        break;
      case 'generator-critic':
        dag = PatternEngine.generatorCritic(config.generator, config.critic, config.maxCycles);
        break;
      case 'iterative':
        dag = PatternEngine.iterativeRefinement(config.refiner, config.maxIterations, config.exitCondition);
        break;
      case 'human-in-loop':
        dag = PatternEngine.humanInTheLoop(config.worker, config.gate, config.finalizer);
        break;
      case 'composite':
        dag = PatternEngine.composite(config.subGraphs, config.mode);
        break;
      case 'race':
        dag = PatternEngine.race(config.competitors, config.judge);
        break;
      default:
        throw new Error(`Unknown pattern: ${pattern}`);
    }

    return dag.execute(initialState);
  }

  /**
   * Broadcast a message to all swarms or a specific set.
   */
  broadcast(topic, message, targetSwarms = null) {
    const targets = targetSwarms || Array.from(this._swarms.keys());
    for (const swarmId of targets) {
      this._messageBus.publish(`${swarmId}.${topic}`, message, { source: 'orchestrator' });
    }
  }

  /**
   * Get platform-wide health and metrics.
   */
  getHealth() {
    return {
      status: this._running ? 'healthy' : 'stopped',
      uptime: this._running ? Date.now() - this._metrics.startTime : 0,
      swarms: Object.fromEntries(
        Array.from(this._swarms.entries()).map(([id, swarm]) => [
          id,
          {
            layer: swarm.config.layer,
            ring: swarm.config.ring,
            activeBees: this._beeFactory.getSwarmBees(id).length,
            maxBees: swarm.config.maxBees,
            pressure: this._backpressure.getPressure(id),
            health: this._healthMonitor.getSwarmHealth(id),
          },
        ])
      ),
      metrics: {
        ...this._metrics,
        throughput: this._metrics.tasksCompleted / Math.max(1, (Date.now() - (this._metrics.startTime || Date.now())) / 1000),
      },
      globalPressure: this._backpressure.getGlobalPressure(),
    };
  }

  /**
   * Graceful shutdown.
   */
  async shutdown() {
    this._running = false;
    this._healthMonitor.stopMonitoring();
    this.emit('orchestrator:shutdown', { metrics: this._metrics });
  }

  // ─── Private Methods ──────────────────────────────────────────────

  async _registerSwarm(swarmConfig) {
    // Register with CSL router
    await this._cslRouter.registerSwarm(swarmConfig.id, swarmConfig.domain);

    // Register with backpressure
    this._backpressure.registerSwarm(swarmConfig.id);

    // Register with A2A protocol
    this._a2a.registerAgent(swarmConfig.id, {
      name: swarmConfig.name,
      capabilities: swarmConfig.capabilities,
      domain: swarmConfig.domain,
      layer: swarmConfig.layer,
    });

    // Register with health monitor
    this._healthMonitor.registerSwarm(swarmConfig.id, swarmConfig);

    // Store swarm state
    this._swarms.set(swarmConfig.id, {
      config: swarmConfig,
      activeSince: Date.now(),
      tasksProcessed: 0,
    });

    // Subscribe to swarm messages
    this._messageBus.subscribe(`${swarmConfig.id}.*`, (envelope) => {
      this.emit('swarm:message', { swarmId: swarmConfig.id, ...envelope });
    });
  }

  async _executeOnSwarm(swarmId, task, startTime) {
    const swarm = this._swarms.get(swarmId);
    if (!swarm) {
      throw new Error(`Swarm ${swarmId} not found`);
    }

    // Spawn a bee for this task
    const bee = await this._beeFactory.spawnBee(
      task.beeType || swarm.config.beeTypes[0],
      swarmId,
      task.priority ? task.priority / 10 : 0.7
    );

    // Execute via agent runtime
    const result = await this._agentRuntime.execute(swarmId, task, {
      model: swarm.config.model,
      bee,
    });

    const latencyMs = Date.now() - startTime;

    // Record metrics
    this._backpressure.complete(swarmId, task.id, latencyMs, result.success !== false);
    if (bee) {
      this._beeFactory.recordBeePerformance(bee.id, result.success !== false, latencyMs);
    }

    swarm.tasksProcessed++;
    this._metrics.tasksCompleted++;
    this._metrics.avgLatencyMs = PSI * latencyMs + (1 - PSI) * this._metrics.avgLatencyMs;

    // Publish completion event
    this._messageBus.publish(`${swarmId}.task.complete`, {
      taskId: task.id,
      latencyMs,
      success: result.success !== false,
    });

    return {
      status: 'completed',
      swarmId,
      taskId: task.id,
      result: result.result || result,
      latencyMs,
      beeId: bee?.id,
    };
  }

  _selectFallbackSwarm(task) {
    // Fibonacci-weighted selection across swarms by ring priority
    const swarms = Array.from(this._swarms.values());
    const fibs = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];
    const total = swarms.reduce((sum, _, i) => sum + (fibs[i] || 1), 0);

    let random = Math.random() * total;
    for (let i = 0; i < swarms.length; i++) {
      random -= fibs[i] || 1;
      if (random <= 0) return swarms[i].config.id;
    }

    return swarms[0]?.config.id || 'heady-soul';
  }

  async _findAlternativeSwarm(task, excludeId) {
    const alternatives = Array.from(this._swarms.keys())
      .filter(id => id !== excludeId);

    for (const altId of alternatives) {
      const pressure = this._backpressure.getPressure(altId);
      if (pressure.level === 'NORMAL' || pressure.level === 'ELEVATED') {
        return altId;
      }
    }
    return null;
  }

  _defaultEmbedFn(text) {
    // Simple hash-based embedding for development (replace with real embeddings in production)
    const dims = 64;
    const embedding = new Float32Array(dims);
    for (let i = 0; i < text.length; i++) {
      embedding[i % dims] += text.charCodeAt(i) * Math.sin(i * PHI);
    }
    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < dims; i++) embedding[i] /= norm;
    }
    return Array.from(embedding);
  }

  _wireEvents() {
    this._backpressure.on('circuit:open', ({ swarmId }) => {
      this.emit('alert:circuit-open', { swarmId, timestamp: Date.now() });
    });

    this._healthMonitor.on('swarm:unhealthy', ({ swarmId }) => {
      this.emit('alert:swarm-unhealthy', { swarmId, timestamp: Date.now() });
    });

    this._messageBus.on('message:published', (envelope) => {
      this.emit('bus:message', envelope);
    });
  }
}

/**
 * Factory function for quick initialization.
 *
 * @param {string} configPath — Path to swarm-definitions.json
 * @param {object} options — { embedFn? }
 * @returns {Promise<HeadyOrchestrator>}
 */
export async function createOrchestrator(configPath, options = {}) {
  const orchestrator = new HeadyOrchestrator(options);
  await orchestrator.init(configPath);
  return orchestrator;
}
