// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ DAG Executor v1.0.0                                    ║
// ║  Directed Acyclic Graph execution with parallel fan-out,       ║
// ║  cycle detection, checkpointing, and phi-scaled concurrency    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝
import { EventEmitter } from 'events';
import { PlatformConfig } from '../../config/platform-config.js';

const PHI = 1.6180339887498948;
const PSI = 0.6180339887498949;

/**
 * DAGExecutor — Pregel/BSP-inspired parallel graph execution engine.
 *
 * Absorbed from: LangGraph (graph state machines with cycles),
 *                Google ADK (fan-out/gather, sequential, loop patterns),
 *                AutoGen (async event-driven messaging).
 *
 * Key capabilities:
 *   - Topological sort with cycle detection
 *   - Parallel fan-out via Promise.allSettled (true async)
 *   - Phi-scaled concurrency limits
 *   - Checkpoint serialization for crash recovery
 *   - Conditional branching with CSL gate scoring
 *   - Human-in-the-loop interrupt/resume
 */
export class DAGExecutor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.setMaxListeners(PlatformConfig.pools.maxSwarmBees);
    this._nodes = new Map();
    this._edges = new Map();
    this._checkpoints = [];
    this._maxSteps = options.maxSteps || PlatformConfig.dag.maxSteps;
    this._maxCycles = options.maxCycles || PlatformConfig.dag.maxCycles;
    this._maxParallel = options.maxParallel || PlatformConfig.concurrency.maxParallelTasks;
    this._stepTimeoutMs = options.stepTimeoutMs || PlatformConfig.dag.stepTimeoutMs;
    this._interrupted = false;
    this._runId = null;
    this._stepCount = 0;
    this._cycleCount = 0;
  }

  /**
   * Add a node to the DAG.
   * @param {string} nodeId — Unique node identifier
   * @param {Function} handler — async (state, context) => { result, nextNodes? }
   * @param {object} options — { condition?, timeout?, retries?, critical? }
   */
  addNode(nodeId, handler, options = {}) {
    this._nodes.set(nodeId, {
      id: nodeId,
      handler,
      condition: options.condition || null,
      timeout: options.timeout || this._stepTimeoutMs,
      retries: options.retries || 0,
      critical: options.critical !== false,
      executionCount: 0,
    });
    if (!this._edges.has(nodeId)) {
      this._edges.set(nodeId, []);
    }
    return this;
  }

  /**
   * Add an edge between nodes.
   * @param {string} from — Source node ID
   * @param {string} to — Target node ID
   * @param {Function} condition — Optional guard: (state) => boolean
   */
  addEdge(from, to, condition = null) {
    if (!this._edges.has(from)) {
      this._edges.set(from, []);
    }
    this._edges.get(from).push({ target: to, condition });
    return this;
  }

  /**
   * Execute the DAG from entry nodes (nodes with no incoming edges).
   * Returns final aggregated state.
   *
   * @param {object} initialState — Starting state
   * @param {object} context — Execution context (tools, config, etc.)
   * @returns {Promise<{ state: object, trace: object[], metrics: object }>}
   */
  async execute(initialState = {}, context = {}) {
    this._runId = `dag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this._stepCount = 0;
    this._cycleCount = 0;
    this._interrupted = false;

    const state = { ...initialState };
    const trace = [];
    const startTime = Date.now();

    // Find entry nodes (no incoming edges)
    const entryNodes = this._findEntryNodes();
    if (entryNodes.length === 0) {
      throw new Error('DAG has no entry nodes — at least one node must have zero incoming edges');
    }

    // BFS-style execution wave
    let currentWave = new Set(entryNodes);
    const completed = new Set();
    const visited = new Map(); // nodeId → visit count (for cycle detection)

    while (currentWave.size > 0 && this._stepCount < this._maxSteps) {
      if (this._interrupted) {
        this._saveCheckpoint(state, currentWave, completed, trace);
        this.emit('dag:interrupted', { runId: this._runId, step: this._stepCount });
        break;
      }

      this._stepCount++;
      const waveNodes = Array.from(currentWave);
      const nextWave = new Set();

      // ─── PARALLEL FAN-OUT ────────────────────────────────────────
      // Execute all nodes in the current wave concurrently (Pregel superstep)
      const batches = this._createBatches(waveNodes, this._maxParallel);

      for (const batch of batches) {
        const promises = batch.map(nodeId => this._executeNode(nodeId, state, context, visited));
        const results = await Promise.allSettled(promises);

        for (let i = 0; i < results.length; i++) {
          const nodeId = batch[i];
          const result = results[i];

          if (result.status === 'fulfilled') {
            const { nodeResult, nextNodes } = result.value;

            // Merge result into state (deterministic: node results don't conflict)
            if (nodeResult && typeof nodeResult === 'object') {
              Object.assign(state, nodeResult);
            }

            trace.push({
              step: this._stepCount,
              nodeId,
              status: 'success',
              duration: result.value.duration,
              timestamp: Date.now(),
            });

            completed.add(nodeId);

            // Determine next nodes
            const successors = nextNodes || this._getSuccessors(nodeId, state);
            for (const next of successors) {
              if (!completed.has(next) || this._isAllowedCycle(next, visited)) {
                nextWave.add(next);
              }
            }
          } else {
            const node = this._nodes.get(nodeId);
            trace.push({
              step: this._stepCount,
              nodeId,
              status: 'failed',
              error: result.reason?.message || 'Unknown error',
              timestamp: Date.now(),
            });

            if (node.critical) {
              this.emit('dag:critical-failure', { nodeId, error: result.reason });
              // Skip downstream nodes of critical failures
            } else {
              // Non-critical: continue with remaining graph
              completed.add(nodeId);
              const successors = this._getSuccessors(nodeId, state);
              for (const next of successors) {
                if (!completed.has(next)) nextWave.add(next);
              }
            }
          }
        }
      }

      // Checkpoint every F(5) steps
      if (this._stepCount % PlatformConfig.dag.checkpointEvery === 0) {
        this._saveCheckpoint(state, nextWave, completed, trace);
      }

      currentWave = nextWave;

      this.emit('dag:wave-complete', {
        runId: this._runId,
        step: this._stepCount,
        completed: completed.size,
        remaining: nextWave.size,
      });
    }

    const metrics = {
      runId: this._runId,
      totalSteps: this._stepCount,
      totalCycles: this._cycleCount,
      nodesExecuted: completed.size,
      totalNodes: this._nodes.size,
      durationMs: Date.now() - startTime,
      throughput: completed.size / ((Date.now() - startTime) / 1000),
    };

    this.emit('dag:complete', { state, metrics });
    return { state, trace, metrics };
  }

  /**
   * Interrupt execution (human-in-the-loop).
   * Call resume() with optional state patch to continue.
   */
  interrupt() {
    this._interrupted = true;
  }

  /**
   * Resume from last checkpoint.
   * @param {object} statePatch — Optional state mutations from human review
   */
  async resume(statePatch = {}, context = {}) {
    if (this._checkpoints.length === 0) {
      throw new Error('No checkpoint available for resume');
    }
    const checkpoint = this._checkpoints[this._checkpoints.length - 1];
    const state = { ...checkpoint.state, ...statePatch };
    this._interrupted = false;

    // Continue from saved wave
    let currentWave = checkpoint.currentWave;
    const completed = checkpoint.completed;
    const trace = checkpoint.trace;
    const visited = new Map();

    while (currentWave.size > 0 && this._stepCount < this._maxSteps) {
      if (this._interrupted) break;

      this._stepCount++;
      const nextWave = new Set();
      const batches = this._createBatches(Array.from(currentWave), this._maxParallel);

      for (const batch of batches) {
        const promises = batch.map(nodeId => this._executeNode(nodeId, state, context, visited));
        const results = await Promise.allSettled(promises);

        for (let i = 0; i < results.length; i++) {
          const nodeId = batch[i];
          if (results[i].status === 'fulfilled') {
            const { nodeResult } = results[i].value;
            if (nodeResult && typeof nodeResult === 'object') {
              Object.assign(state, nodeResult);
            }
            completed.add(nodeId);
            const successors = this._getSuccessors(nodeId, state);
            for (const next of successors) {
              if (!completed.has(next)) nextWave.add(next);
            }
          }
        }
      }
      currentWave = nextWave;
    }

    return { state, trace, metrics: { resumed: true, totalSteps: this._stepCount } };
  }

  // ─── Private Methods ──────────────────────────────────────────────

  async _executeNode(nodeId, state, context, visited) {
    const node = this._nodes.get(nodeId);
    if (!node) throw new Error(`Unknown node: ${nodeId}`);

    // Track visits for cycle detection
    const visits = (visited.get(nodeId) || 0) + 1;
    visited.set(nodeId, visits);
    node.executionCount++;

    // Check condition gate
    if (node.condition && !node.condition(state)) {
      return { nodeResult: null, nextNodes: [], duration: 0 };
    }

    const start = Date.now();

    // Execute with timeout
    const result = await Promise.race([
      node.handler(state, { ...context, nodeId, runId: this._runId }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Node ${nodeId} timed out after ${node.timeout}ms`)), node.timeout)
      ),
    ]);

    const duration = Date.now() - start;
    return {
      nodeResult: result?.result || result,
      nextNodes: result?.nextNodes || null,
      duration,
    };
  }

  _findEntryNodes() {
    const hasIncoming = new Set();
    for (const [, edges] of this._edges) {
      for (const edge of edges) {
        hasIncoming.add(edge.target);
      }
    }
    return Array.from(this._nodes.keys()).filter(id => !hasIncoming.has(id));
  }

  _getSuccessors(nodeId, state) {
    const edges = this._edges.get(nodeId) || [];
    return edges
      .filter(edge => !edge.condition || edge.condition(state))
      .map(edge => edge.target);
  }

  _isAllowedCycle(nodeId, visited) {
    const visits = visited.get(nodeId) || 0;
    if (visits >= this._maxCycles) return false;
    this._cycleCount++;
    return true;
  }

  _createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  _saveCheckpoint(state, currentWave, completed, trace) {
    this._checkpoints.push({
      state: { ...state },
      currentWave: new Set(currentWave),
      completed: new Set(completed),
      trace: [...trace],
      timestamp: Date.now(),
      step: this._stepCount,
    });

    // Keep only last F(5) checkpoints
    if (this._checkpoints.length > PlatformConfig.dag.checkpointEvery) {
      this._checkpoints.shift();
    }
  }

  /**
   * Topological sort for visualization/debugging.
   * @returns {string[]} Nodes in topological order
   */
  topologicalSort() {
    const inDegree = new Map();
    for (const nodeId of this._nodes.keys()) {
      inDegree.set(nodeId, 0);
    }
    for (const [, edges] of this._edges) {
      for (const edge of edges) {
        inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
      }
    }

    const queue = [];
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) queue.push(nodeId);
    }

    const sorted = [];
    while (queue.length > 0) {
      const nodeId = queue.shift();
      sorted.push(nodeId);
      for (const edge of (this._edges.get(nodeId) || [])) {
        const newDegree = inDegree.get(edge.target) - 1;
        inDegree.set(edge.target, newDegree);
        if (newDegree === 0) queue.push(edge.target);
      }
    }

    return sorted;
  }

  /**
   * Get DAG statistics.
   */
  getStats() {
    return {
      nodes: this._nodes.size,
      edges: Array.from(this._edges.values()).reduce((sum, e) => sum + e.length, 0),
      entryNodes: this._findEntryNodes().length,
      checkpoints: this._checkpoints.length,
      maxSteps: this._maxSteps,
      maxParallel: this._maxParallel,
    };
  }
}
