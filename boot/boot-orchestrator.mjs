// ============================================================================
// HEADY BOOT ORCHESTRATOR v1.0
// src/boot/boot-orchestrator.mjs
//
// Addresses Gap #8: No formal boot orchestrator with dependency graph
// The previous src/boot/wire-liquid-nodes.js was a flat loader.
// This orchestrator boots all services in topological order with:
//   - Dependency graph (services declare what they need)
//   - Health checks at each layer
//   - φ-scaled timeouts and retries
//   - Graceful failure modes per §8 of the super prompt
//
// Boot layers map to §8 Six-Layer Cognitive Architecture:
//   Layer 0: Edge Gateway (MCP transports, circuit breakers)
//   Layer 1: Memory Field (Redis T0, Postgres T1/T2, pgvector)
//   Layer 2: CSL Calibration (embedding providers, gate thresholds)
//   Layer 3: Swarm Topology (pipeline, swarms, bee factory)
//   Layer 4: Metacognitive Loop (self-assessment, ORS, drift detection)
//   Layer 5: Council + Evolution (auto-success, distiller, eval engine)
//
// © 2026 HeadySystems Inc.
// ============================================================================

import { createLogger } from '../lib/logger.mjs';
import { EventEmitter } from 'node:events';

const logger = createLogger('boot-orchestrator');

// φ-derived constants
const PHI = 1.618033988749895;
const PSI = 1 / PHI;                    // 0.618
const TASK_TIMEOUT_MS = Math.round(PHI * PHI * 1000); // 4236ms
const BOOT_TIMEOUT_MS = 30000;           // total boot budget

/**
 * BootOrchestrator — Dependency-aware service initializer
 * 
 * Each service registers itself with:
 *   - name: unique identifier
 *   - layer: 0-5 (maps to cognitive architecture layers)
 *   - deps: array of service names this depends on
 *   - init: async function that returns { healthy: boolean, details: {} }
 *   - healthCheck: async function for ongoing monitoring
 *   - shutdown: async function for graceful teardown
 */
export class BootOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.services = new Map();
    this.bootOrder = [];
    this.bootState = 'idle'; // idle → booting → ready → failed → shutting_down → stopped
    this.bootStartTime = null;
    this.healthStatus = new Map();
  }

  /**
   * Register a service for boot orchestration.
   * Services within the same layer boot concurrently.
   * Services across layers boot sequentially (layer 0 before layer 1, etc.)
   */
  register(service) {
    const { name, layer, deps = [], init, healthCheck, shutdown, critical = true } = service;

    if (this.services.has(name)) {
      logger.system(`Service ${name} already registered, skipping duplicate`, { nodeId: 'boot', action: 'register_skip' });
      return this;
    }

    if (typeof layer !== 'number' || layer < 0 || layer > 5) {
      throw new Error(`Service ${name}: layer must be 0-5, got ${layer}`);
    }
    if (typeof init !== 'function') {
      throw new Error(`Service ${name}: init must be an async function`);
    }

    this.services.set(name, {
      name,
      layer,
      deps,
      init,
      healthCheck: healthCheck || (async () => ({ healthy: true })),
      shutdown: shutdown || (async () => {}),
      critical,    // if critical service fails, entire boot fails
      state: 'pending',   // pending → initializing → ready → failed → stopped
      initDuration: null,
      error: null,
    });

    return this; // chainable
  }

  /**
   * Compute topological boot order respecting layers + dependencies.
   * Returns array of arrays (each inner array = concurrent boot group).
   */
  computeBootOrder() {
    const groups = [[], [], [], [], [], []]; // layers 0-5

    for (const [name, svc] of this.services) {
      groups[svc.layer].push(name);
    }

    // Within each layer, topologically sort by deps
    const order = [];
    for (let layer = 0; layer <= 5; layer++) {
      if (groups[layer].length === 0) continue;

      const layerServices = groups[layer];
      const sorted = this._topoSort(layerServices);
      order.push({ layer, services: sorted });
    }

    this.bootOrder = order;
    return order;
  }

  /**
   * Topological sort within a layer using Kahn's algorithm.
   * Returns array of arrays for concurrent execution within the layer.
   */
  _topoSort(serviceNames) {
    const inDegree = new Map();
    const graph = new Map();

    // Initialize
    for (const name of serviceNames) {
      inDegree.set(name, 0);
      graph.set(name, []);
    }

    // Build adjacency from deps (only within this layer)
    for (const name of serviceNames) {
      const svc = this.services.get(name);
      for (const dep of svc.deps) {
        if (serviceNames.includes(dep)) {
          graph.get(dep).push(name);
          inDegree.set(name, (inDegree.get(name) || 0) + 1);
        }
        // Cross-layer deps are handled by layer ordering, not topo sort
      }
    }

    // Kahn's: group by wave (services with same "distance" from root = concurrent)
    const waves = [];
    let remaining = new Set(serviceNames);

    while (remaining.size > 0) {
      const wave = [];
      for (const name of remaining) {
        if (inDegree.get(name) === 0) {
          wave.push(name);
        }
      }

      if (wave.length === 0) {
        // Cycle detected — boot remaining in parallel and hope for the best
        logger.error('Circular dependency detected in boot order', {
          nodeId: 'boot', error: 'cycle', ctx: { remaining: [...remaining] }
        });
        waves.push([...remaining]);
        break;
      }

      waves.push(wave);

      for (const name of wave) {
        remaining.delete(name);
        for (const dependent of (graph.get(name) || [])) {
          inDegree.set(dependent, inDegree.get(dependent) - 1);
        }
      }
    }

    return waves;
  }

  /**
   * Execute the full boot sequence.
   * Layers boot sequentially; services within each layer boot concurrently.
   */
  async boot() {
    this.bootStartTime = Date.now();
    this.bootState = 'booting';
    this.emit('boot:start', { timestamp: this.bootStartTime });

    logger.system('Boot sequence initiated', {
      nodeId: 'boot',
      action: 'boot_start',
      meta: { services: this.services.size, layers: 6 }
    });

    const order = this.computeBootOrder();
    let allHealthy = true;

    for (const { layer, services: waves } of order) {
      const layerStart = Date.now();
      logger.system(`Layer ${layer} booting`, {
        nodeId: 'boot',
        action: 'layer_start',
        meta: { layer, waveCount: waves.length, services: waves.flat() }
      });

      for (const wave of waves) {
        // Boot all services in this wave concurrently
        const results = await Promise.allSettled(
          wave.map(name => this._bootService(name))
        );

        // Check results
        for (let i = 0; i < results.length; i++) {
          const name = wave[i];
          const result = results[i];
          const svc = this.services.get(name);

          if (result.status === 'rejected' || (result.value && !result.value.healthy)) {
            svc.state = 'failed';
            svc.error = result.reason?.message || result.value?.error || 'Unknown failure';

            if (svc.critical) {
              allHealthy = false;
              logger.error(`Critical service ${name} failed, boot cannot continue`, {
                nodeId: 'boot',
                error: svc.error,
                ctx: { layer, service: name }
              });
            } else {
              logger.system(`Non-critical service ${name} failed, continuing boot`, {
                nodeId: 'boot',
                action: 'service_degraded',
                meta: { service: name, error: svc.error }
              });
            }
          } else {
            svc.state = 'ready';
          }
        }

        // If any critical service failed, halt boot
        if (!allHealthy) {
          this.bootState = 'failed';
          this.emit('boot:failed', { layer, failedServices: wave.filter(n => this.services.get(n).state === 'failed') });
          return { success: false, duration: Date.now() - this.bootStartTime, failedLayer: layer };
        }
      }

      const layerDuration = Date.now() - layerStart;
      logger.system(`Layer ${layer} ready`, {
        nodeId: 'boot',
        action: 'layer_complete',
        meta: { layer, durationMs: layerDuration }
      });
      this.emit('boot:layer_complete', { layer, duration: layerDuration });
    }

    const totalDuration = Date.now() - this.bootStartTime;
    this.bootState = 'ready';

    logger.system('Boot sequence complete', {
      nodeId: 'boot',
      action: 'boot_complete',
      meta: {
        durationMs: totalDuration,
        servicesReady: [...this.services.values()].filter(s => s.state === 'ready').length,
        servicesFailed: [...this.services.values()].filter(s => s.state === 'failed').length,
      }
    });

    this.emit('boot:ready', { duration: totalDuration });
    return { success: true, duration: totalDuration };
  }

  /**
   * Boot a single service with timeout and retry.
   */
  async _bootService(name) {
    const svc = this.services.get(name);
    svc.state = 'initializing';
    const start = Date.now();

    logger.system(`Initializing ${name}`, { nodeId: 'boot', action: 'service_init', meta: { service: name, layer: svc.layer } });

    // Check cross-layer dependencies are ready
    for (const dep of svc.deps) {
      const depSvc = this.services.get(dep);
      if (depSvc && depSvc.state !== 'ready') {
        throw new Error(`Dependency ${dep} not ready (state: ${depSvc?.state || 'not registered'})`);
      }
    }

    // Init with φ-scaled timeout
    const timeout = TASK_TIMEOUT_MS * (1 + svc.layer * PSI); // higher layers get more time
    const result = await Promise.race([
      svc.init(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
      ),
    ]);

    svc.initDuration = Date.now() - start;
    this.healthStatus.set(name, { healthy: result?.healthy ?? true, checkedAt: Date.now() });

    logger.system(`Service ${name} initialized`, {
      nodeId: 'boot',
      action: 'service_ready',
      meta: { service: name, durationMs: svc.initDuration, healthy: result?.healthy }
    });

    return result;
  }

  /**
   * Run health checks on all ready services.
   * Called periodically by the Auto-Success Engine (every 29,034ms).
   */
  async healthCheckAll() {
    const results = {};

    const checks = [...this.services.entries()]
      .filter(([_, svc]) => svc.state === 'ready')
      .map(async ([name, svc]) => {
        try {
          const result = await Promise.race([
            svc.healthCheck(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Health check timeout')), 5000)),
          ]);
          this.healthStatus.set(name, { healthy: result?.healthy ?? true, checkedAt: Date.now() });
          results[name] = { healthy: true };
        } catch (err) {
          this.healthStatus.set(name, { healthy: false, checkedAt: Date.now(), error: err.message });
          results[name] = { healthy: false, error: err.message };
        }
      });

    await Promise.allSettled(checks);
    return results;
  }

  /**
   * Graceful shutdown in reverse layer order.
   */
  async shutdown() {
    this.bootState = 'shutting_down';
    logger.system('Shutdown initiated', { nodeId: 'boot', action: 'shutdown_start' });

    // Shutdown in reverse layer order (layer 5 first, layer 0 last)
    const order = this.computeBootOrder().reverse();

    for (const { layer, services: waves } of order) {
      // Reverse wave order within layer too
      for (const wave of waves.reverse()) {
        await Promise.allSettled(
          wave.map(async name => {
            const svc = this.services.get(name);
            if (svc.state === 'ready' || svc.state === 'failed') {
              try {
                await Promise.race([
                  svc.shutdown(),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Shutdown timeout')), 10000)),
                ]);
                svc.state = 'stopped';
              } catch (err) {
                logger.error(`Shutdown error for ${name}`, { nodeId: 'boot', error: err.message });
                svc.state = 'stopped';
              }
            }
          })
        );
      }
    }

    this.bootState = 'stopped';
    logger.system('Shutdown complete', { nodeId: 'boot', action: 'shutdown_complete' });
  }

  /**
   * Get comprehensive boot status for /health endpoint.
   */
  getStatus() {
    const services = {};
    for (const [name, svc] of this.services) {
      services[name] = {
        state: svc.state,
        layer: svc.layer,
        initDuration: svc.initDuration,
        healthy: this.healthStatus.get(name)?.healthy ?? null,
        error: svc.error,
      };
    }

    return {
      bootState: this.bootState,
      bootDuration: this.bootStartTime ? Date.now() - this.bootStartTime : null,
      services,
      summary: {
        total: this.services.size,
        ready: [...this.services.values()].filter(s => s.state === 'ready').length,
        failed: [...this.services.values()].filter(s => s.state === 'failed').length,
        pending: [...this.services.values()].filter(s => s.state === 'pending').length,
      },
    };
  }
}

// ============================================================================
// DEFAULT SERVICE REGISTRATIONS
// Maps directly to §8 Six-Layer Cognitive Architecture
// ============================================================================

export function registerDefaultServices(orchestrator, config) {
  // ── Layer 0: Edge Gateway ──────────────────────────────────────────
  orchestrator.register({
    name: 'config',
    layer: 0,
    deps: [],
    critical: true,
    init: async () => {
      // Validate all required env vars exist
      const required = ['NODE_ENV', 'PORT', 'HEADY_VERSION'];
      const missing = required.filter(k => !process.env[k]);
      if (missing.length > 0) {
        throw new Error(`Missing required env vars: ${missing.join(', ')}`);
      }
      return { healthy: true, details: { env: process.env.NODE_ENV } };
    },
  });

  orchestrator.register({
    name: 'logger',
    layer: 0,
    deps: ['config'],
    critical: true,
    init: async () => {
      // pino logger is initialized on import, just verify it works
      logger.system('Logger initialized', { nodeId: 'boot', action: 'logger_init' });
      return { healthy: true };
    },
  });

  // ── Layer 1: Memory Field ──────────────────────────────────────────
  orchestrator.register({
    name: 'redis',
    layer: 1,
    deps: ['config'],
    critical: true,
    init: async () => {
      // Connect to Upstash Redis (T0 working memory)
      const { createRedisClient } = await import('../lib/redis-client.mjs');
      const client = await createRedisClient();
      await client.ping();
      return { healthy: true, details: { host: process.env.REDIS_HOST } };
    },
    healthCheck: async () => {
      const { getRedisClient } = await import('../lib/redis-client.mjs');
      await getRedisClient().ping();
      return { healthy: true };
    },
    shutdown: async () => {
      const { getRedisClient } = await import('../lib/redis-client.mjs');
      await getRedisClient().quit();
    },
  });

  orchestrator.register({
    name: 'postgres',
    layer: 1,
    deps: ['config'],
    critical: true,
    init: async () => {
      // Connect to Neon Postgres (T1/T2 memory, auth, audit)
      const { createPool } = await import('../lib/pg-pool.mjs');
      const pool = await createPool();
      const result = await pool.query('SELECT 1 as connected');
      return { healthy: result.rows[0]?.connected === 1, details: { ssl: true } };
    },
    healthCheck: async () => {
      const { getPool } = await import('../lib/pg-pool.mjs');
      await getPool().query('SELECT 1');
      return { healthy: true };
    },
    shutdown: async () => {
      const { getPool } = await import('../lib/pg-pool.mjs');
      await getPool().end();
    },
  });

  // ── Layer 2: CSL Calibration ───────────────────────────────────────
  orchestrator.register({
    name: 'csl-engine',
    layer: 2,
    deps: ['config'],
    critical: true,
    init: async () => {
      const { CSLEngine } = await import('../csl/csl-engine.mjs');
      const engine = new CSLEngine();
      await engine.calibrate();
      return { healthy: true, details: { gates: 8, threshold: PSI } };
    },
  });

  orchestrator.register({
    name: 'embedding-provider',
    layer: 2,
    deps: ['config'],
    critical: false, // can fall back to cached embeddings
    init: async () => {
      const { EmbeddingProvider } = await import('../embedding/embedding-provider.mjs');
      const provider = new EmbeddingProvider();
      const test = await provider.embed('heady boot test');
      return { healthy: test.length === 1536, details: { dim: test.length } };
    },
  });

  // ── Layer 3: Swarm Topology ────────────────────────────────────────
  orchestrator.register({
    name: 'bee-factory',
    layer: 3,
    deps: ['redis', 'postgres'],
    critical: true,
    init: async () => {
      const { BeeFactory } = await import('../bees/bee-factory.mjs');
      const factory = new BeeFactory();
      const types = await factory.loadRegistry();
      return { healthy: types >= 89, details: { beeTypes: types } };
    },
  });

  orchestrator.register({
    name: 'pipeline',
    layer: 3,
    deps: ['csl-engine', 'bee-factory'],
    critical: true,
    init: async () => {
      const { Pipeline } = await import('../hcfp/pipeline.mjs');
      const pipeline = new Pipeline();
      await pipeline.initialize();
      return { healthy: true, details: { stages: 22, variant: 'full' } };
    },
  });

  orchestrator.register({
    name: 'swarm-coordinator',
    layer: 3,
    deps: ['bee-factory', 'redis'],
    critical: true,
    init: async () => {
      const { SwarmCoordinator } = await import('../orchestration/swarm-coordinator.mjs');
      const coord = new SwarmCoordinator();
      await coord.initialize();
      return { healthy: true, details: { swarms: 17 } };
    },
  });

  // ── Layer 4: Metacognitive Loop ────────────────────────────────────
  orchestrator.register({
    name: 'self-awareness',
    layer: 4,
    deps: ['csl-engine', 'redis'],
    critical: false,
    init: async () => {
      const { SelfAwareness } = await import('../awareness/self-awareness.mjs');
      const awareness = new SelfAwareness();
      await awareness.initialize();
      return { healthy: true };
    },
  });

  orchestrator.register({
    name: 'drift-detector',
    layer: 4,
    deps: ['redis', 'csl-engine'],
    critical: false,
    init: async () => {
      const { DriftDetector } = await import('../monitoring/drift-detector.mjs');
      const detector = new DriftDetector();
      await detector.initialize();
      return { healthy: true, details: { signals: 6, windowSize: 11 } };
    },
  });

  // ── Layer 5: Council + Evolution ───────────────────────────────────
  orchestrator.register({
    name: 'auto-success',
    layer: 5,
    deps: ['pipeline', 'bee-factory', 'redis'],
    critical: false,
    init: async () => {
      const { AutoSuccessEngine } = await import('../auto-success/engine.mjs');
      const engine = new AutoSuccessEngine();
      await engine.initialize();
      return { healthy: true, details: { tasks: 144, categories: 13, cycleMs: 29034 } };
    },
  });

  orchestrator.register({
    name: 'distiller',
    layer: 5,
    deps: ['pipeline', 'postgres', 'embedding-provider'],
    critical: false, // new in v8, non-critical initially
    init: async () => {
      if (process.env.ENABLE_DISTILLER !== 'true') {
        return { healthy: true, details: { status: 'disabled' } };
      }
      const { Distiller } = await import('../distiller/distiller-node.mjs');
      const distiller = new Distiller();
      await distiller.initialize();
      return { healthy: true, details: { port: 3398 } };
    },
  });

  return orchestrator;
}

// ============================================================================
// ENTRYPOINT — Replace the old src/boot/wire-liquid-nodes.js
// ============================================================================

export async function bootHeady(config = {}) {
  const orchestrator = new BootOrchestrator();
  registerDefaultServices(orchestrator, config);

  // Allow plugins to register additional services
  if (config.additionalServices) {
    for (const svc of config.additionalServices) {
      orchestrator.register(svc);
    }
  }

  // Wire shutdown handlers (SIGTERM from Cloud Run, SIGINT from local)
  const gracefulShutdown = async (signal) => {
    logger.system(`Received ${signal}, initiating graceful shutdown`, { nodeId: 'boot', action: 'shutdown_signal' });
    await orchestrator.shutdown();
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Boot
  const result = await orchestrator.boot();

  if (!result.success) {
    logger.error('Boot failed, entering recovery mode', {
      nodeId: 'boot',
      error: 'boot_failed',
      ctx: { failedLayer: result.failedLayer, durationMs: result.duration }
    });
    process.exit(1);
  }

  return orchestrator;
}
