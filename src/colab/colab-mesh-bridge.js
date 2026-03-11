/**
 * Heady(TM) Colab-LiquidMesh Bridge v5.0
 * Wires 3 Colab Pro+ runtimes as GPU-accelerated liquid nodes
 * into the LiquidMesh topology for vector space operations.
 *
 * Runtime roles:
 *   colab-alpha  -> inference-embedding  (HOT pool)
 *   colab-beta   -> vector-memory-search (WARM pool)
 *   colab-gamma  -> training-evolution   (COLD pool)
 *
 * @author Eric Haywood -- HeadySystems Inc.
 * @license Proprietary -- HeadySystems Inc.
 */

'use strict';

const EventEmitter = require('events');
const {
    PHI, PSI, fib, cslAND,
    CSL_THRESHOLDS, COLAB_RUNTIMES,
} = require('../../shared/phi-math');
const { createLogger } = require('../../shared/logger');
const { ColabRuntimeManager } = require('./colab-runtime-manager');
const { VectorSpaceOps } = require('./colab-vector-space-ops');

const logger = createLogger('colab-mesh-bridge');

const BRIDGE_STATES = Object.freeze({
    DISCONNECTED: 'DISCONNECTED',
    CONNECTING: 'CONNECTING',
    CONNECTED: 'CONNECTED',
    DEGRADED: 'DEGRADED',
    ERROR: 'ERROR',
});

/**
 * ColabMeshBridge -- Integrates Colab Pro+ runtimes with LiquidMesh.
 *
 * Each Colab runtime is exposed as a liquid node to the mesh. Tasks routed
 * through the mesh that require GPU acceleration (embeddings, search, training)
 * are forwarded to the appropriate Colab runtime via CSL scoring.
 */
class ColabMeshBridge extends EventEmitter {
    constructor(options = {}) {
        super();
        this.state = BRIDGE_STATES.DISCONNECTED;
        this.runtimeManager = new ColabRuntimeManager();
        this.vectorOps = new VectorSpaceOps({
            dimensions: 384,
            cacheSize: COLAB_RUNTIMES.VECTOR_CACHE_SIZE,
            batchSize: COLAB_RUNTIMES.EMBEDDING_BATCH,
        });
        this.mesh = options.mesh || null; // LiquidMesh instance
        this.taskLog = [];
        this.maxTaskLog = fib(10); // 55

        // Wire runtime events
        this.runtimeManager.on('taskCompleted', (event) => this._onTaskCompleted(event));
        this.runtimeManager.on('taskFailed', (event) => this._onTaskFailed(event));
        this.runtimeManager.on('heartbeat', (event) => this._onHeartbeat(event));
    }

    /**
     * Start the bridge -- initializes all 3 Colab runtimes and connects to mesh.
     */
    async start() {
        this.state = BRIDGE_STATES.CONNECTING;
        logger.info('bridge_starting', { runtimeCount: COLAB_RUNTIMES.COUNT });

        try {
            await this.runtimeManager.start();
            this.state = BRIDGE_STATES.CONNECTED;

            logger.info('bridge_connected', {
                runtimes: this.runtimeManager.getStatus().runtimes.map(r => ({
                    id: r.id,
                    role: r.role,
                    state: r.state,
                })),
                vectorOpsReady: true,
            });

            this.emit('connected', this.getStatus());
        } catch (err) {
            this.state = BRIDGE_STATES.ERROR;
            logger.error('bridge_start_failed', { error: err.message });
            this.emit('error', err);
        }
    }

    async stop() {
        logger.info('bridge_stopping');
        await this.runtimeManager.stop();
        this.state = BRIDGE_STATES.DISCONNECTED;
        this.emit('disconnected');
    }

    /**
     * Route a vector space task through the bridge.
     * Embeds the task description, scores against runtime capabilities,
     * and dispatches to the best-fit Colab runtime.
     */
    async routeVectorTask(task) {
        if (this.state !== BRIDGE_STATES.CONNECTED) {
            logger.warn('route_rejected', { state: this.state, taskId: task.id });
            return { status: 'rejected', reason: `Bridge is ${this.state}` };
        }

        // Generate embedding if not provided
        if (!task.embedding || task.embedding.length !== 384) {
            const { vector } = this.vectorOps.embed(task.description || task.id);
            task.embedding = vector;
        }

        const assignment = this.runtimeManager.routeTask(task);

        if (!assignment) {
            return { status: 'rejected', reason: 'No runtime available and queue full' };
        }

        if (assignment.queued) {
            return { status: 'queued', position: assignment.position };
        }

        this._logTask({
            taskId: task.id,
            runtimeId: assignment.runtimeId,
            score: assignment.score,
            timestamp: new Date().toISOString(),
        });

        return {
            status: 'assigned',
            runtimeId: assignment.runtimeId,
            score: assignment.score,
        };
    }

    /**
     * Execute a batch embedding operation across the best-fit runtime.
     */
    batchEmbed(texts) {
        return this.vectorOps.batchEmbed(texts);
    }

    /**
     * Search the HNSW index.
     */
    search(queryVector, k) {
        return this.vectorOps.search(queryVector, k);
    }

    /**
     * Insert a vector into the index.
     */
    insertVector(id, vector) {
        return this.vectorOps.insert(id, vector);
    }

    /**
     * Detect semantic drift between embeddings.
     */
    detectDrift(current, reference) {
        return this.vectorOps.detectDrift(current, reference);
    }

    /**
     * Complete a task on a runtime.
     */
    completeTask(runtimeId, taskId, result) {
        this.runtimeManager.completeTask(runtimeId, taskId, result);
    }

    /**
     * Mark a task as failed on a runtime.
     */
    failTask(runtimeId, taskId, error) {
        this.runtimeManager.failTask(runtimeId, taskId, error);
    }

    /**
     * Get comprehensive bridge status.
     */
    getStatus() {
        const runtimeStatus = this.runtimeManager.getStatus();
        const vectorStats = this.vectorOps.getStats();

        return {
            state: this.state,
            runtimes: runtimeStatus,
            vectorSpace: vectorStats,
            recentTasks: this.taskLog.slice(-fib(5)),
            timestamp: new Date().toISOString(),
        };
    }

    _onTaskCompleted(event) {
        this.emit('taskCompleted', event);
    }

    _onTaskFailed(event) {
        // Check if we need to degrade the bridge
        const status = this.runtimeManager.getStatus();
        const availableCount = status.runtimes.filter(r => r.state === 'READY' || r.state === 'BUSY').length;
        if (availableCount === 0) {
            this.state = BRIDGE_STATES.ERROR;
        } else if (availableCount < COLAB_RUNTIMES.COUNT) {
            this.state = BRIDGE_STATES.DEGRADED;
        }

        this.emit('taskFailed', event);
    }

    _onHeartbeat(event) {
        // Auto-recover from degraded if all runtimes are healthy
        if (this.state === BRIDGE_STATES.DEGRADED) {
            const healthyCount = event.runtimes.filter(r => r.state === 'READY' || r.state === 'BUSY').length;
            if (healthyCount >= COLAB_RUNTIMES.COUNT) {
                this.state = BRIDGE_STATES.CONNECTED;
                logger.info('bridge_recovered');
            }
        }
    }

    _logTask(entry) {
        this.taskLog.push(entry);
        if (this.taskLog.length > this.maxTaskLog) {
            this.taskLog.shift();
        }
    }
}

module.exports = { ColabMeshBridge, BRIDGE_STATES };
