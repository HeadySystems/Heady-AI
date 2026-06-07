// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: orchestration/liquid-node-engine.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Liquid Node Engine — Dynamic Async Parallel Task Execution in Vector Space
 * Nodes are ephemeral compute units that execute in 384D semantic space.
 * Tasks are routed by CSL cosine similarity to node capabilities.
 * Nodes spawn, execute, and dissolve — no permanent allocation.
 *
 * Author: Eric Haywood | φ-scaled | CSL-gated | ESM only
 *
 * Architecture:
 *   - LiquidNode: Ephemeral worker with 384D capability embedding
 *   - LiquidGraph: DAG of dependent tasks with topological execution
 *   - LiquidPool: Manages concurrent node lifecycle with Fibonacci limits
 *   - HeadyBee/HeadySwarm integration: Nodes can be Bee workers or Swarm participants
 */
import { createHash } from 'crypto';

// ── φ-Math Constants ────────────────────────────────────────────────
const PHI = 1.6180339887;
const PSI = 1 / PHI;
const PSI2 = PSI * PSI;
const PSI3 = PSI * PSI * PSI;
const FIB = [1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597];
const DIM = 384;

// ── CSL Thresholds ──────────────────────────────────────────────────
function phiThreshold(level, spread = 0.5) { return 1 - Math.pow(PSI, level) * spread; }
const CSL = {
  CRITICAL: phiThreshold(4),
  HIGH:     phiThreshold(3),
  MEDIUM:   phiThreshold(2),
  LOW:      phiThreshold(1),
  MINIMUM:  phiThreshold(0),
};

function sha256(data) { return createHash('sha256').update(data).digest('hex'); }

function log(level, msg, meta = {}) {
  const entry = { ts: new Date().toISOString(), level, service: 'liquid-node-engine', msg, ...meta };
  process.stdout.write(JSON.stringify(entry) + '\n');
}

// ── Vector Operations ───────────────────────────────────────────────
function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function normalize(vec) {
  let mag = 0;
  for (let i = 0; i < vec.length; i++) mag += vec[i] * vec[i];
  mag = Math.sqrt(mag);
  return mag === 0 ? vec : vec.map(v => v / mag);
}

// Deterministic embedding from text (for routing — not for semantic search)
function textToRouteEmbedding(text) {
  const hash = sha256(text + ':route:' + PHI);
  const vec = new Float64Array(DIM);
  for (let i = 0; i < DIM; i++) {
    const byte1 = parseInt(hash[(i * 2) % hash.length], 16);
    const byte2 = parseInt(hash[(i * 2 + 1) % hash.length], 16);
    vec[i] = ((byte1 * 16 + byte2) / 255) * 2 - 1;
  }
  return normalize(Array.from(vec));
}

// CSL Gate — smooth sigmoid
function cslGate(value, score, tau, temp = PSI3) {
  return value * (1 / (1 + Math.exp(-(score - tau) / temp)));
}

// ── Liquid Node ─────────────────────────────────────────────────────
const NODE_STATES = ['spawning', 'ready', 'executing', 'completed', 'failed', 'dissolved'];

class LiquidNode {
  #id;
  #capability;
  #capabilityEmbedding;
  #state;
  #spawnedAt;
  #executeFn;
  #result;
  #error;
  #metrics;
  #parentSwarm;

  constructor(capability, executeFn, options = {}) {
    this.#id = sha256(capability + ':' + Date.now() + ':' + Math.random()).slice(0, FIB[7]); // 13-char
    this.#capability = capability;
    this.#capabilityEmbedding = textToRouteEmbedding(capability);
    this.#state = 'spawning';
    this.#spawnedAt = Date.now();
    this.#executeFn = executeFn;
    this.#result = null;
    this.#error = null;
    this.#parentSwarm = options.swarm || null;
    this.#metrics = { startedAt: null, completedAt: null, executionMs: 0 };
    this.#state = 'ready';
  }

  get id() { return this.#id; }
  get capability() { return this.#capability; }
  get capabilityEmbedding() { return this.#capabilityEmbedding; }
  get state() { return this.#state; }
  get result() { return this.#result; }
  get error() { return this.#error; }

  // CSL similarity: how well does this node match the task?
  matchScore(taskEmbedding) {
    return cosineSimilarity(this.#capabilityEmbedding, taskEmbedding);
  }

  async execute(input) {
    if (this.#state !== 'ready') {
      return { success: false, error: `Node ${this.#id} not in ready state (is: ${this.#state})` };
    }

    this.#state = 'executing';
    this.#metrics.startedAt = Date.now();
    log('info', 'Node executing', { nodeId: this.#id, capability: this.#capability });

    try {
      this.#result = await this.#executeFn(input);
      this.#state = 'completed';
      this.#metrics.completedAt = Date.now();
      this.#metrics.executionMs = this.#metrics.completedAt - this.#metrics.startedAt;
      log('info', 'Node completed', { nodeId: this.#id, executionMs: this.#metrics.executionMs });
      return { success: true, result: this.#result, executionMs: this.#metrics.executionMs };
    } catch (execErr) {
      this.#state = 'failed';
      this.#error = execErr.message;
      this.#metrics.completedAt = Date.now();
      this.#metrics.executionMs = this.#metrics.completedAt - this.#metrics.startedAt;
      log('error', 'Node failed', { nodeId: this.#id, error: execErr.message });
      return { success: false, error: execErr.message, executionMs: this.#metrics.executionMs };
    }
  }

  dissolve() {
    this.#state = 'dissolved';
    this.#executeFn = null;
    this.#result = null;
    log('info', 'Node dissolved', { nodeId: this.#id, lifetimeMs: Date.now() - this.#spawnedAt });
  }

  toJSON() {
    return {
      id: this.#id,
      capability: this.#capability,
      state: this.#state,
      metrics: { ...this.#metrics },
      healthScore: this.#state === 'ready' ? 1 : this.#state === 'completed' ? 1 : 0,
    };
  }
}

// ── Liquid Task ─────────────────────────────────────────────────────
class LiquidTask {
  #id;
  #name;
  #embedding;
  #input;
  #dependencies; // Array of task IDs that must complete before this one
  #state;
  #result;

  constructor(name, input, dependencies = []) {
    this.#id = sha256(name + ':task:' + Date.now()).slice(0, FIB[7]);
    this.#name = name;
    this.#embedding = textToRouteEmbedding(name);
    this.#input = input;
    this.#dependencies = dependencies;
    this.#state = 'pending';
    this.#result = null;
  }

  get id() { return this.#id; }
  get name() { return this.#name; }
  get embedding() { return this.#embedding; }
  get input() { return this.#input; }
  get dependencies() { return this.#dependencies; }
  get state() { return this.#state; }
  get result() { return this.#result; }
  set state(s) { this.#state = s; }
  set result(r) { this.#result = r; }
}

// ── Liquid Pool — Manages concurrent nodes with Fibonacci limits ────
class LiquidPool {
  #maxConcurrent;
  #maxQueued;
  #activeNodes;
  #nodeRegistry; // Map<capability, LiquidNode[]>
  #metrics;

  constructor(options = {}) {
    this.#maxConcurrent = options.maxConcurrent || FIB[9];  // 34
    this.#maxQueued = options.maxQueued || FIB[10];          // 55
    this.#activeNodes = new Map();
    this.#nodeRegistry = new Map();
    this.#metrics = { spawned: 0, dissolved: 0, executed: 0, failed: 0 };
  }

  // Register a node capability with its execute function
  register(capability, executeFn, options = {}) {
    const node = new LiquidNode(capability, executeFn, options);
    if (!this.#nodeRegistry.has(capability)) {
      this.#nodeRegistry.set(capability, []);
    }
    this.#nodeRegistry.get(capability).push(node);
    this.#metrics.spawned++;
    return node;
  }

  // Find the most suitable node for a task using CSL routing
  route(taskEmbedding) {
    let selected = null;
    let bestGatedScore = 0;

    for (const [capability, nodes] of this.#nodeRegistry) {
      for (const node of nodes) {
        if (node.state !== 'ready') continue;
        const similarity = node.matchScore(taskEmbedding);
        const gated = cslGate(similarity, similarity, CSL.LOW);
        if (gated > bestGatedScore) {
          bestGatedScore = gated;
          selected = node;
        }
      }
    }

    return selected;
  }

  // Execute a task graph (DAG) with topological ordering
  async executeGraph(tasks) {
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const results = new Map();
    const completed = new Set();

    // Topological sort using Kahn's algorithm
    const inDegree = new Map();
    const adjacency = new Map();

    for (const task of tasks) {
      inDegree.set(task.id, task.dependencies.length);
      adjacency.set(task.id, []);
    }
    for (const task of tasks) {
      for (const dep of task.dependencies) {
        if (adjacency.has(dep)) {
          adjacency.get(dep).push(task.id);
        }
      }
    }

    // Start with zero-dependency tasks
    let ready = tasks.filter(t => t.dependencies.length === 0).map(t => t.id);

    while (ready.length > 0) {
      // Execute all ready tasks concurrently (liquid parallel execution)
      const batch = ready.splice(0, this.#maxConcurrent);
      const batchResults = await Promise.allSettled(
        batch.map(async (taskId) => {
          const task = taskMap.get(taskId);
          task.state = 'executing';

          // Gather dependency results as input context
          const depResults = {};
          for (const dep of task.dependencies) {
            depResults[dep] = results.get(dep);
          }
          const enrichedInput = { ...task.input, _dependencyResults: depResults };

          // Route to a matching node
          const node = this.route(task.embedding);
          if (!node) {
            task.state = 'failed';
            return { taskId, success: false, error: 'No matching node available' };
          }

          const result = await node.execute(enrichedInput);
          if (result.success) {
            task.state = 'completed';
            task.result = result.result;
            results.set(taskId, result.result);
            this.#metrics.executed++;
          } else {
            task.state = 'failed';
            this.#metrics.failed++;
          }

          // Re-register node for reuse (spawn fresh instance)
          node.dissolve();
          this.#metrics.dissolved++;

          return { taskId, ...result };
        })
      );

      // Update dependency tracking
      for (const br of batchResults) {
        if (br.status === 'fulfilled') {
          const { taskId } = br.value;
          completed.add(taskId);

          // Reduce in-degree for dependent tasks
          for (const nextId of (adjacency.get(taskId) || [])) {
            inDegree.set(nextId, (inDegree.get(nextId) || 1) - 1);
            if (inDegree.get(nextId) === 0 && !completed.has(nextId)) {
              ready.push(nextId);
            }
          }
        }
      }
    }

    // Check for cycles (tasks that never became ready)
    const unfinished = tasks.filter(t => !completed.has(t.id));
    if (unfinished.length > 0) {
      log('warn', 'Cycle detected in task graph', { unfinished: unfinished.map(t => t.id) });
    }

    return {
      completed: completed.size,
      total: tasks.length,
      results: Object.fromEntries(results),
      metrics: { ...this.#metrics },
    };
  }

  status() {
    const nodeList = [];
    for (const [cap, nodes] of this.#nodeRegistry) {
      for (const node of nodes) {
        nodeList.push(node.toJSON());
      }
    }
    return { nodes: nodeList, metrics: { ...this.#metrics }, limits: { maxConcurrent: this.#maxConcurrent, maxQueued: this.#maxQueued } };
  }
}

// ── HeadyBee Integration ────────────────────────────────────────────
// A HeadyBee is a specialized LiquidNode that belongs to a swarm
function createBeeNode(beeType, executeFn) {
  return new LiquidNode(`heady-bee:${beeType}`, executeFn, { swarm: beeType });
}

// A HeadySwarm is a LiquidPool scoped to a specific domain
function createSwarmPool(swarmName, maxConcurrent = FIB[8]) {
  const pool = new LiquidPool({ maxConcurrent, maxQueued: FIB[9] });
  log('info', 'Swarm pool created', { swarm: swarmName, maxConcurrent });
  return pool;
}

export default LiquidPool;
export { LiquidNode, LiquidTask, LiquidPool, createBeeNode, createSwarmPool, cosineSimilarity, normalize, textToRouteEmbedding, cslGate };
