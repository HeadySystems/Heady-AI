/**
 * Heady(tm) Colab-Mesh Bridge v5.0
 * Bridges 3 Colab Pro+ runtimes into the LiquidMesh as GPU-accelerated nodes.
 * Each Colab runtime becomes a LiquidNode with vector space capabilities.
 *
 * Runtime allocation:
 *   colab-alpha  -> HOT pool  (inference & embedding)
 *   colab-beta   -> WARM pool (vector memory & search)
 *   colab-gamma  -> COLD pool (training & evolution)
 *
 * @author Eric Haywood -- HeadySystems Inc.
 * @license Proprietary -- HeadySystems Inc.
 */

'use strict';

const EventEmitter = require('events');
const {
  PHI, PSI, fib,
  CSL_THRESHOLDS, COLAB_RUNTIMES,
  cslAND, phiFusionScore,
} = require('../../shared/phi-math');
const { createLogger } = require('../../shared/logger');
const { ColabRuntimeManager } = require('../colab/colab-runtime-manager');
const { VectorSpaceOps } = require('../colab/colab-vector-space-ops');

const logger = createLogger('colab-mesh-bridge');

const BRIDGE_STATES = Object.freeze({
  DISCONNECTED: 'DISCONNECTED',
  CONNECTING:   'CONNECTING',
  CONNECTED:    'CONNECTED',
  DEGRADED:     'DEGRADED',
  ERROR:        'ERROR',
});

/**
 * ColabMeshBridge wires the ColabRuntimeManager into a LiquidMesh instance.
 * It registers each Colab runtime as a virtual LiquidNode and proxies
 * task routing through the vector space ops layer.
 */
class ColabMeshBridge extends EventEmitter {
  constructor(options = {}) {
    super();
    this.mesh = options.mesh || null;
    this.runtimeManager = new ColabRuntimeManager();
    this.vectorOps = new VectorSpaceOps({
      dimensions: 384,
      cacheSize: COLAB_RUNTIMES.VECTOR_CACHE_SIZE,
      batchSize: COLAB_RUNTIMES.EMBEDDING_BATCH,
    });
    this.state = BRIDGE_STATES.DISCONNECTED;
    this.runtimeNodeMap = new Map(); // runtimeId -> nodeId
    this.taskResults = new Map();
    this.bridgedTasks = 0;
    this.bridgedLatencyMs = 0;
  }

  /**
   * Connect all 3 Colab Pro+ runtimes to the mesh.
   */
  async connect(mesh) {
    if (mesh) this.mesh = mesh;
    this.state = BRIDGE_STATES.CONNECTING;

    try {
      // Start runtime manager (initializes 3 runtimes)
      await this.runtimeManager.start();

      // Wire event listeners
      this.runtimeManager.on('taskCompleted', (evt) => this._onTaskCompleted(evt));
      this.runtimeManager.on('taskFailed', (evt) => this._onTaskFailed(evt));
      this.runtimeManager.on('heartbeat', (evt) => this._onHeartbeat(evt));

      // Register each runtime as a virtual node in the mesh
      const runtimes = this.runtimeManager.getStatus().runtimes;
      for (const runtime of runtimes) {
        this.runtimeNodeMap.set(runtime.id, `liquid-${runtime.id}`);
        logger.info('colab_runtime_bridged', {
          runtimeId: runtime.id,
          role: runtime.role,
          nodeId: `liquid-${runtime.id}`,
          gpuMemoryGB: runtime.gpuMemoryGB,
        });
      }

      this.state = BRIDGE_STATES.CONNECTED;
      this.emit('connected', { runtimes: runtimes.length });

      logger.info('bridge_connected', {
        runtimeCount: COLAB_RUNTIMES.COUNT,
        state: this.state,
      });

      return { connected: true, runtimes: runtimes.length };
    } catch (err) {
      this.state = BRIDGE_STATES.ERROR;
      logger.error('bridge_connection_failed', { error: err.message });
      throw err;
    }
  }

  /**
   * Route a task through the vector space, embedding it and finding
   * the best Colab runtime via CSL scoring.
   */
  async routeVectorTask(task) {
    if (this.state !== BRIDGE_STATES.CONNECTED) {
      return { error: 'Bridge not connected', state: this.state };
    }

    const startTime = Date.now();

    // Generate embedding for the task if not already present
    if (!task.embedding || task.embedding.length !== 384) {
      const description = task.description || task.name || JSON.stringify(task);
      const { vector } = this.vectorOps.embed(description);
      task.embedding = vector;
    }

    // Route through the runtime manager (CSL-scored)
    const result = this.runtimeManager.routeTask(task);

    if (!result) {
      return { error: 'No available runtime', queued: false };
    }

    const latency = Date.now() - startTime;
    this.bridgedTasks++;
    this.bridgedLatencyMs += latency;

    return {
      ...result,
      bridgeLatencyMs: latency,
      vectorOpsStats: this.vectorOps.getStats(),
    };
  }

  /**
   * Batch embed texts across the GPU runtimes.
   */
  batchEmbed(texts) {
    return this.vectorOps.batchEmbed(texts);
  }

  /**
   * Search the HNSW index for nearest neighbors.
   */
  searchVectors(queryVector, k) {
    return this.vectorOps.search(queryVector, k);
  }

  /**
   * Insert a vector into the HNSW index.
   */
  insertVector(id, vector) {
    return this.vectorOps.insert(id, vector);
  }

  /**
   * Detect semantic drift between current and reference embeddings.
   */
  detectDrift(currentEmbedding, referenceEmbedding) {
    return this.vectorOps.detectDrift(currentEmbedding, referenceEmbedding);
  }

  _onTaskCompleted({ runtimeId, taskId, latency, result }) {
    this.taskResults.set(taskId, { status: 'completed', result, latency });
    this.emit('taskCompleted', { runtimeId, taskId, latency });
  }

  _onTaskFailed({ runtimeId, taskId, error }) {
    this.taskResults.set(taskId, { status: 'failed', error });
    this.emit('taskFailed', { runtimeId, taskId, error });

    // Check if bridge is degraded
    const status = this.runtimeManager.getStatus();
    const errorRuntimes = status.runtimes.filter(r =>
      r.circuitBreaker === 'OPEN' || r.state === 'ERROR'
    );
    if (errorRuntimes.length >= 2) {
      this.state = BRIDGE_STATES.DEGRADED;
      this.emit('degraded', { errorRuntimes: errorRuntimes.length });
    }
  }

  _onHeartbeat({ runtimes, pressure }) {
    this.emit('heartbeat', { runtimes, pressure });
  }

  /**
   * Gracefully disconnect all runtimes.
   */
  async disconnect() {
    logger.info('bridge_disconnecting');
    await this.runtimeManager.stop();
    this.state = BRIDGE_STATES.DISCONNECTED;
    this.emit('disconnected');
    logger.info('bridge_disconnected');
  }

  getStatus() {
    return {
      state: this.state,
      runtimes: this.runtimeManager.getStatus(),
      vectorOps: this.vectorOps.getStats(),
      bridgedTasks: this.bridgedTasks,
      avgBridgeLatencyMs: this.bridgedTasks > 0
        ? Math.round(this.bridgedLatencyMs / this.bridgedTasks)
        : 0,
      runtimeNodeMap: Object.fromEntries(this.runtimeNodeMap),
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { ColabMeshBridge, BRIDGE_STATES };
