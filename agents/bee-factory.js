<<<<<<< HEAD
/**
 * BeeFactory — Dynamic Agent Worker Factory
 * Creates, manages, and recycles specialized Bee workers for the Heady swarm.
 * All constants φ-derived. CSL gates replace boolean logic. ESM only.
 * Author: Eric Haywood
 */
import { createHash } from 'crypto';

// ── φ-Math Foundation ────────────────────────────────────────────
const PHI = 1.6180339887;
const PSI = 0.6180339887;
const PSI2 = 0.3819660113;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

function phiThreshold(level, spread = PSI2) {
  return 1 - Math.pow(PSI, level) * spread;
}

const CSL_THRESHOLDS = {
  CRITICAL: phiThreshold(4),  // ≈0.927
  HIGH: phiThreshold(3),      // ≈0.882
  MEDIUM: phiThreshold(2),    // ≈0.809
  LOW: phiThreshold(1),       // ≈0.691
  MINIMUM: phiThreshold(0),   // ≈0.500
};

function cslGate(value, score, tau = CSL_THRESHOLDS.MEDIUM, temp = Math.pow(PSI, 3)) {
  return value * (1 / (1 + Math.exp(-(score - tau) / temp)));
}

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom > 0 ? dot / denom : 0;
}

function hashSHA256(data) {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

// ── Bee Specialization Catalog ───────────────────────────────────
const BEE_CATALOG = {
  'code-generation': {
    name: 'JULES',
    capabilities: ['generate', 'refactor', 'inline-suggest'],
    pool: 'hot',
    timeoutMs: FIB[9] * 1000,        // 34s
    maxConcurrent: FIB[6],            // 8
    memoryMb: FIB[12],                // 144
    embeddingDim: FIB[16] < 384 ? 384 : FIB[16],
  },
  'code-review': {
    name: 'OBSERVER',
    capabilities: ['analyze', 'lint', 'security-scan'],
    pool: 'hot',
    timeoutMs: FIB[10] * 1000,       // 55s
    maxConcurrent: FIB[5],            // 5
    memoryMb: FIB[11],                // 89
    embeddingDim: 384,
  },
  'security-audit': {
    name: 'MURPHY',
    capabilities: ['vuln-scan', 'threat-model', 'pentest-sim'],
    pool: 'hot',
    timeoutMs: FIB[11] * 1000,       // 89s
    maxConcurrent: FIB[4],            // 3
    memoryMb: FIB[12],                // 144
    embeddingDim: 384,
  },
  'architecture': {
    name: 'ATLAS',
    capabilities: ['design', 'document', 'dependency-graph'],
    pool: 'hot',
    timeoutMs: FIB[11] * 1000,       // 89s
    maxConcurrent: FIB[4],            // 3
    memoryMb: FIB[13],                // 233
    embeddingDim: 384,
  },
  'research': {
    name: 'SOPHIA',
    capabilities: ['web-search', 'paper-analysis', 'citation'],
    pool: 'warm',
    timeoutMs: FIB[12] * 1000,       // 144s
    maxConcurrent: FIB[5],            // 5
    memoryMb: FIB[12],                // 144
    embeddingDim: 384,
  },
  'creative': {
    name: 'MUSE',
    capabilities: ['ideate', 'compose', 'visual-design'],
    pool: 'warm',
    timeoutMs: FIB[11] * 1000,       // 89s
    maxConcurrent: FIB[4],            // 3
    memoryMb: FIB[11],                // 89
    embeddingDim: 384,
  },
  'translation': {
    name: 'BRIDGE',
    capabilities: ['translate', 'localize', 'cultural-adapt'],
    pool: 'warm',
    timeoutMs: FIB[10] * 1000,       // 55s
    maxConcurrent: FIB[6],            // 8
    memoryMb: FIB[11],                // 89
    embeddingDim: 384,
  },
  'cleanup': {
    name: 'JANITOR',
    capabilities: ['gc', 'orphan-detect', 'compress', 'archive'],
    pool: 'cold',
    timeoutMs: FIB[13] * 1000,       // 233s
    maxConcurrent: FIB[3],            // 2
    memoryMb: FIB[10],                // 55
    embeddingDim: 384,
  },
  'monitoring': {
    name: 'SENTINEL',
    capabilities: ['watch', 'alert', 'correlate', 'escalate'],
    pool: 'warm',
    timeoutMs: FIB[10] * 1000,       // 55s
    maxConcurrent: FIB[5],            // 5
    memoryMb: FIB[10],                // 55
    embeddingDim: 384,
  },
  'innovation': {
    name: 'NOVA',
    capabilities: ['brainstorm', 'prototype', 'experiment'],
    pool: 'warm',
    timeoutMs: FIB[12] * 1000,       // 144s
    maxConcurrent: FIB[3],            // 2
    memoryMb: FIB[12],                // 144
    embeddingDim: 384,
  },
  'encryption': {
    name: 'CIPHER',
    capabilities: ['encrypt', 'decrypt', 'key-manage', 'zero-knowledge'],
    pool: 'hot',
    timeoutMs: FIB[9] * 1000,        // 34s
    maxConcurrent: FIB[4],            // 3
    memoryMb: FIB[11],                // 89
    embeddingDim: 384,
  },
  'observation': {
    name: 'LENS',
    capabilities: ['introspect', 'profile', 'trace', 'snapshot'],
    pool: 'warm',
    timeoutMs: FIB[10] * 1000,       // 55s
    maxConcurrent: FIB[5],            // 5
    memoryMb: FIB[10],                // 55
    embeddingDim: 384,
  },
};

// ── Bee Instance ─────────────────────────────────────────────────
class BeeInstance {
  constructor(id, specialization, catalogEntry) {
    this.id = id;
    this.specialization = specialization;
    this.name = catalogEntry.name;
    this.capabilities = catalogEntry.capabilities;
    this.pool = catalogEntry.pool;
    this.timeoutMs = catalogEntry.timeoutMs;
    this.memoryMb = catalogEntry.memoryMb;
    this.embeddingDim = catalogEntry.embeddingDim;
    this.state = 'idle';    // idle | active | draining | terminated
    this.createdAt = Date.now();
    this.lastActiveAt = Date.now();
    this.tasksCompleted = 0;
    this.tasksFailed = 0;
    this.coherenceScore = 1.0;
    this.embedding = this._initEmbedding();
    this.taskQueue = [];
    this.maxQueueDepth = FIB[13]; // 233
  }

  _initEmbedding() {
    const dim = this.embeddingDim;
    const vec = new Float32Array(dim);
    let seed = 42;
    for (let i = 0; i < dim; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      vec[i] = (seed / 0x7fffffff - PSI) * PHI;
    }
    return vec;
  }

  canAcceptTask(taskEmbedding) {
    const similarity = cosineSimilarity(this.embedding, taskEmbedding);
    const queueLoad = this.taskQueue.length / this.maxQueueDepth;
    const availability = cslGate(1.0, 1.0 - queueLoad, CSL_THRESHOLDS.LOW);
    const alignment = cslGate(1.0, similarity, CSL_THRESHOLDS.MINIMUM);
    const stateReady = this.state === 'idle' || this.state === 'active' ? 1.0 : 0.0;
    return alignment * availability * stateReady * this.coherenceScore;
  }

  assignTask(task) {
    this.state = 'active';
    this.lastActiveAt = Date.now();
    this.taskQueue.push({
      ...task,
      assignedAt: Date.now(),
      hash: hashSHA256({ taskId: task.id, beeId: this.id, ts: Date.now() }),
    });
    return { beeId: this.id, queued: this.taskQueue.length };
  }

  completeTask(taskId, success) {
    const idx = this.taskQueue.findIndex(t => t.id === taskId);
    if (idx >= 0) {
      this.taskQueue.splice(idx, 1);
    }
    if (success) {
      this.tasksCompleted++;
      this.coherenceScore = Math.min(1.0, this.coherenceScore + Math.pow(PSI, 5));
    } else {
      this.tasksFailed++;
      this.coherenceScore = Math.max(0, this.coherenceScore - Math.pow(PSI, 3));
    }
    if (this.taskQueue.length === 0) {
      this.state = 'idle';
    }
    this.lastActiveAt = Date.now();
  }

  drain() {
    this.state = 'draining';
    return this.taskQueue.length;
  }

  terminate() {
    this.state = 'terminated';
    this.taskQueue = [];
  }

  health() {
    const uptime = Date.now() - this.createdAt;
    const idleTime = Date.now() - this.lastActiveAt;
    const successRate = this.tasksCompleted + this.tasksFailed > 0
      ? this.tasksCompleted / (this.tasksCompleted + this.tasksFailed)
      : 1.0;
    return {
      id: this.id,
      name: this.name,
      specialization: this.specialization,
      state: this.state,
      coherenceScore: this.coherenceScore,
      successRate,
      uptimeMs: uptime,
      idleMs: idleTime,
      queueDepth: this.taskQueue.length,
      tasksCompleted: this.tasksCompleted,
      tasksFailed: this.tasksFailed,
      pool: this.pool,
    };
  }
}

// ── BeeFactory ───────────────────────────────────────────────────
class BeeFactory {
  constructor(config = {}) {
    this.bees = new Map();
    this.nextId = 1;
    this.maxBeesPerSpec = config.maxBeesPerSpec ?? FIB[6];   // 8
    this.maxTotalBees = config.maxTotalBees ?? FIB[10];      // 55
    this.idleTimeoutMs = config.idleTimeoutMs ?? FIB[12] * 1000; // 144s
    this.coherenceThreshold = CSL_THRESHOLDS.LOW;            // ≈0.691
    this.auditLog = [];
    this.maxAuditEntries = FIB[16];  // 987
  }

  _audit(action, detail) {
    const entry = {
      ts: Date.now(),
      action,
      detail,
      hash: hashSHA256({ action, detail, ts: Date.now() }),
    };
    this.auditLog.push(entry);
    if (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog = this.auditLog.slice(-FIB[14]); // keep last 377
    }
    return entry;
  }

  spawn(specialization) {
    const catalogEntry = BEE_CATALOG[specialization];
    if (!catalogEntry) {
      return { error: `Unknown specialization: ${specialization}` };
    }

    const specCount = [...this.bees.values()]
      .filter(b => b.specialization === specialization && b.state !== 'terminated')
      .length;

    const maxForSpec = catalogEntry.maxConcurrent;
    const spawnAllowed = cslGate(1.0, 1.0 - (specCount / maxForSpec), CSL_THRESHOLDS.LOW);
    const totalAllowed = cslGate(1.0, 1.0 - (this.bees.size / this.maxTotalBees), CSL_THRESHOLDS.MINIMUM);

    if (spawnAllowed < CSL_THRESHOLDS.MINIMUM || totalAllowed < CSL_THRESHOLDS.MINIMUM) {
      return { error: 'Spawn denied — capacity threshold exceeded', spawnAllowed, totalAllowed };
    }

    const id = `bee-${this.nextId++}-${specialization}`;
    const bee = new BeeInstance(id, specialization, catalogEntry);
    this.bees.set(id, bee);

    this._audit('spawn', { id, specialization, pool: catalogEntry.pool });
    return { id, name: bee.name, pool: bee.pool, specialization };
  }

  findBestBee(specialization, taskEmbedding) {
    const candidates = [...this.bees.values()]
      .filter(b => b.specialization === specialization && b.state !== 'terminated' && b.state !== 'draining');

    if (candidates.length === 0) {
      const spawned = this.spawn(specialization);
      if (spawned.error) return { error: spawned.error };
      return this.bees.get(spawned.id);
    }

    let bestBee = null;
    let bestScore = -1;
    for (const bee of candidates) {
      const score = bee.canAcceptTask(taskEmbedding);
      const gatedScore = cslGate(score, bee.coherenceScore, this.coherenceThreshold);
      if (gatedScore > bestScore) {
        bestScore = gatedScore;
        bestBee = bee;
      }
    }

    if (!bestBee || bestScore < CSL_THRESHOLDS.MINIMUM) {
      const spawned = this.spawn(specialization);
      if (spawned.error) return { error: spawned.error };
      return this.bees.get(spawned.id);
    }

    return bestBee;
  }

  assignTask(specialization, task) {
    const taskEmbedding = task.embedding ?? new Float32Array(384);
    const bee = this.findBestBee(specialization, taskEmbedding);
    if (bee.error) return bee;

    const result = bee.assignTask(task);
    this._audit('assign', { beeId: bee.id, taskId: task.id });
    return result;
  }

  completeTask(beeId, taskId, success) {
    const bee = this.bees.get(beeId);
    if (!bee) return { error: `Bee not found: ${beeId}` };
    bee.completeTask(taskId, success);
    this._audit('complete', { beeId, taskId, success });
    return bee.health();
  }

  drainBee(beeId) {
    const bee = this.bees.get(beeId);
    if (!bee) return { error: `Bee not found: ${beeId}` };
    const remaining = bee.drain();
    this._audit('drain', { beeId, remainingTasks: remaining });
    return { beeId, state: 'draining', remainingTasks: remaining };
  }

  terminateBee(beeId) {
    const bee = this.bees.get(beeId);
    if (!bee) return { error: `Bee not found: ${beeId}` };
    bee.terminate();
    this._audit('terminate', { beeId });
    return { beeId, state: 'terminated' };
  }

  reapIdle() {
    const now = Date.now();
    const reaped = [];
    for (const [id, bee] of this.bees) {
      if (bee.state === 'terminated') continue;
      const idle = now - bee.lastActiveAt;
      const shouldReap = cslGate(1.0, idle / this.idleTimeoutMs, CSL_THRESHOLDS.MEDIUM);
      if (shouldReap > CSL_THRESHOLDS.HIGH && bee.taskQueue.length === 0) {
        bee.terminate();
        reaped.push(id);
      }
    }
    if (reaped.length > 0) {
      this._audit('reap', { reaped });
    }
    return reaped;
  }

  reapTerminated() {
    const removed = [];
    for (const [id, bee] of this.bees) {
      if (bee.state === 'terminated') {
        this.bees.delete(id);
        removed.push(id);
      }
    }
    return removed;
  }

  healthAll() {
    const beeHealths = [];
    const poolCounts = { hot: 0, warm: 0, cold: 0 };
    for (const bee of this.bees.values()) {
      if (bee.state !== 'terminated') {
        const h = bee.health();
        beeHealths.push(h);
        poolCounts[bee.pool] = (poolCounts[bee.pool] ?? 0) + 1;
      }
    }
    return {
      totalBees: beeHealths.length,
      maxCapacity: this.maxTotalBees,
      poolDistribution: poolCounts,
      bees: beeHealths,
      auditLogSize: this.auditLog.length,
    };
  }

  catalog() {
    return Object.entries(BEE_CATALOG).map(([key, val]) => ({
      specialization: key,
      name: val.name,
      pool: val.pool,
      capabilities: val.capabilities,
      maxConcurrent: val.maxConcurrent,
      timeoutMs: val.timeoutMs,
      memoryMb: val.memoryMb,
    }));
  }
}

export default BeeFactory;
export { BeeFactory, BeeInstance, BEE_CATALOG };
=======
/*
 * © 2026 Heady™Systems Inc.. PROPRIETARY AND CONFIDENTIAL.
 *
 * Dynamic Bee Factory — Creates any type of bee on the fly at runtime.
 * CSL Integration: Uses Continuous Semantic Logic gates for intelligent
 * bee dispatch, swarm candidate scoring, and priority classification.
 *
 * CSL gates used:
 *   - multi_resonance      → Score bee candidates against task intent
 *   - route_gate           → Select best bee for a task with soft activation
 *   - resonance_gate       → Match task intent to bee domain semantics
 *   - ternary_gate         → Classify bee health/priority: core / ephemeral / reject
 *   - soft_gate            → Continuous priority activation for swarm ordering
 *   - superposition_gate   → Fuse multi-domain bee vectors for composite swarms
 *   - orthogonal_gate      → Exclude specific domain influence from routing
 *
 * Usage:
 *   const { createBee, spawnBee, routeBee, createWorkUnit } = require('./bee-factory');
 *
 *   // Create a bee for any domain
 *   createBee('new-domain', { description: 'Handles new-domain tasks', priority: 0.9, ... });
 *
 *   // Route a task to the best bee using CSL
 *   const best = routeBee('deploy kubernetes cluster');
 *
 *   // Or spawn a single-purpose bee instantly
 *   spawnBee('quick-fix', async () => patchDatabase());
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger').child('bee-factory');
const CSL = require('../core/semantic-logic');

const BEES_DIR = __dirname;
const _dynamicRegistry = new Map();
const _ephemeralBees = new Map(); // In-memory only, not persisted

// ── CSL Helpers ─────────────────────────────────────────────────────────
const _vecCache = new Map();

/**
 * Deterministic pseudo-embedding for a domain/description string.
 * In production, replaced by the 384D vector-memory embeddings.
 */
function _domainToVec(text, dim = 64) {
    if (_vecCache.has(text)) return _vecCache.get(text);
    const v = new Float32Array(dim);
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
    }
    for (let i = 0; i < dim; i++) {
        hash = ((hash << 5) + hash + i) >>> 0;
        v[i] = ((hash % 2000) - 1000) / 1000;
    }
    const result = CSL.normalize(v);
    _vecCache.set(text, result);
    return result;
}

/**
 * Build a composite semantic vector for a bee from its domain + description.
 */
function _buildBeeVector(domain, description) {
    const domainVec = _domainToVec(domain);
    const descVec = _domainToVec(description || domain);
    return CSL.weighted_superposition(domainVec, descVec, 0.6);
}

/**
 * Create a full bee domain dynamically at runtime.
 * Registers it in-memory AND optionally persists to disk for future boots.
 * Now includes a CSL semantic vector for routing.
 *
 * @param {string} domain - Domain name for the bee
 * @param {Object} config - Bee configuration
 * @param {string} config.description - What this bee does
 * @param {number} config.priority - Urgency (0.0 - 1.0)
 * @param {Array} config.workers - Array of { name, fn } work units
 * @param {boolean} config.persist - If true, writes a bee file to disk (default: false)
 * @returns {Object} The registered bee entry
 */
function createBee(domain, config = {}) {
    const {
        description = `Dynamic ${domain} bee`,
        priority = 0.5,
        workers = [],
        persist = false,
    } = config;

    // Validate workers are callable
    let validated = true;
    for (let i = 0; i < workers.length; i++) {
        const w = workers[i];
        if (typeof w !== 'function' && (typeof w !== 'object' || typeof w.fn !== 'function')) {
            validated = false;
            try { logger.warn(`Worker ${i} in '${domain}' is not callable`); } catch { }
        }
    }

    // CSL: Build semantic vector for this bee
    const vector = _buildBeeVector(domain, description);

    // CSL: Classify priority using ternary_gate
    const priorityClass = CSL.ternary_gate(priority, 0.7, 0.3);

    const entry = {
        domain,
        description,
        priority,
        createdAt: Date.now(),
        dynamic: true,
        validated,
        file: `dynamic:${domain}`,
        vector,
        csl: {
            priorityState: priorityClass.state, // +1 = critical, 0 = normal, -1 = low
            priorityActivation: priorityClass.resonanceActivation,
        },
        getWork: (ctx = {}) => workers.map(w => {
            if (typeof w === 'function') return w;
            if (typeof w.fn === 'function') return async () => {
                try {
                    const result = await w.fn(ctx);
                    return { bee: domain, action: w.name || 'work', ...result };
                } catch (err) {
                    return { bee: domain, action: w.name || 'work', error: err.message };
                }
            };
            return async () => ({ bee: domain, action: w.name || 'noop', status: 'no-handler' });
        }),
    };

    _dynamicRegistry.set(domain, entry);

    // Also register in the main registry if available
    try {
        const registry = require('./registry');
        registry.registry.set(domain, entry);
    } catch { /* registry not loaded yet */ }

    // Persist to disk if requested — creates a real bee file
    if (persist) {
        _persistBee(domain, config);
    }

    return entry;
}

/**
 * Spawn a single-purpose ephemeral bee for one-off tasks.
 * Lives only in memory for this process lifecycle.
 *
 * @param {string} name - Name for this bee
 * @param {Function|Function[]} work - Work function(s) to execute
 * @param {number} priority - Urgency (default: 0.8)
 * @returns {Object} The ephemeral bee entry
 */
function spawnBee(name, work, priority = 0.8) {
    const workFns = Array.isArray(work) ? work : [work];
    const id = `ephemeral-${name}-${crypto.randomBytes(3).toString('hex')}`;

    const vector = _buildBeeVector(id, `Ephemeral bee: ${name}`);

    const entry = {
        domain: id,
        description: `Ephemeral bee: ${name}`,
        priority,
        ephemeral: true,
        createdAt: Date.now(),
        file: `ephemeral:${id}`,
        vector,
        csl: { priorityState: CSL.ternary_gate(priority, 0.7, 0.3).state },
        getWork: () => workFns.map(fn => async (ctx) => {
            const result = await fn(ctx);
            return { bee: id, action: name, ...(typeof result === 'object' ? result : { result }) };
        }),
    };

    _ephemeralBees.set(id, entry);

    // Register in main registry
    try {
        const registry = require('./registry');
        registry.registry.set(id, entry);
    } catch { /* registry not loaded yet */ }

    return entry;
}

/**
 * Route a task to the best bee using CSL multi-resonance scoring.
 * This is the primary CSL-powered dispatch function.
 *
 * @param {string} taskDescription - Natural language description of the task
 * @param {Object} options - Routing options
 * @param {number} options.threshold - Minimum resonance to accept (default: 0.3)
 * @param {string[]} options.exclude - Domain names to exclude via orthogonal_gate
 * @param {number} options.topK - Return top K matches (default: 3)
 * @returns {{ best: Object|null, ranked: Array, csl: Object }}
 */
function routeBee(taskDescription, options = {}) {
    const {
        threshold = 0.3,
        exclude = [],
        topK = 3,
    } = options;

    // Build intent vector from task description
    let intentVec = _domainToVec(taskDescription);

    // Strip excluded domain influence via orthogonal_gate
    if (exclude.length > 0) {
        const excludeVecs = exclude.map(e => _domainToVec(e));
        intentVec = CSL.batch_orthogonal(intentVec, excludeVecs);
    }

    // Collect all registered bees (dynamic + ephemeral) with vectors
    const allBees = [];
    for (const [, entry] of _dynamicRegistry) {
        if (entry.vector) allBees.push(entry);
    }
    for (const [, entry] of _ephemeralBees) {
        if (entry.vector) allBees.push(entry);
    }

    if (allBees.length === 0) {
        return { best: null, ranked: [], csl: { error: 'No bees registered' } };
    }

    // CSL route_gate — scores all candidates with multi_resonance + soft_gate
    const candidates = allBees.map(b => ({ id: b.domain, vector: b.vector }));
    const routeResult = CSL.route_gate(intentVec, candidates, threshold);

    // Enrich with priority weighting via soft_gate
    const ranked = routeResult.scores.map(s => {
        const bee = allBees.find(b => b.domain === s.id);
        const priorityActivation = CSL.soft_gate(bee.priority, 0.5, 10);
        // Composite: 70% semantic resonance + 30% priority
        const composite = s.score * 0.7 + priorityActivation * 0.3;
        return {
            domain: s.id,
            description: bee.description,
            resonance: s.score,
            activation: s.activation,
            priority: bee.priority,
            priorityActivation: +priorityActivation.toFixed(6),
            composite: +composite.toFixed(6),
        };
    }).sort((a, b) => b.composite - a.composite).slice(0, topK);

    const best = ranked.length > 0 ? allBees.find(b => b.domain === ranked[0].domain) : null;

    return {
        best,
        ranked,
        csl: {
            intentDim: intentVec.length,
            candidatesScored: allBees.length,
            fallback: routeResult.fallback,
            gateStats: CSL.getStats(),
        },
    };
}

/**
 * Add a single work unit to an existing domain.
 * If the domain doesn't exist, creates it.
 *
 * @param {string} domain - Domain to add work to
 * @param {string} name - Name of the work unit
 * @param {Function} fn - The work function
 * @returns {Object} The updated/created bee entry
 */
function createWorkUnit(domain, name, fn) {
    const existing = _dynamicRegistry.get(domain);
    if (existing) {
        // Add to existing dynamic bee
        const oldGetWork = existing.getWork;
        existing.getWork = (ctx = {}) => {
            const existingWork = oldGetWork(ctx);
            existingWork.push(async () => {
                const result = await fn(ctx);
                return { bee: domain, action: name, ...(typeof result === 'object' ? result : { result }) };
            });
            return existingWork;
        };
        return existing;
    }

    // Create new domain with this single worker
    return createBee(domain, {
        workers: [{ name, fn }],
    });
}

/**
 * Create a bee from a template/pattern.
 * Useful for spawning service-monitoring bees, health-check bees, etc.
 *
 * @param {string} template - Template name ('health-check', 'monitor', 'processor', 'scanner')
 * @param {Object} config - Template-specific configuration
 * @returns {Object} The created bee entry
 */
function createFromTemplate(template, config = {}) {
    const templates = {
        'health-check': (cfg) => ({
            domain: cfg.domain || `health-${cfg.target}`,
            description: `Health checker for ${cfg.target}`,
            priority: 0.9,
            workers: [
                {
                    name: 'probe', fn: async () => {
                        const url = cfg.url || `https://${cfg.target}/api/health`;
                        const timeout = cfg.timeout || 5000;
                        const start = Date.now();
                        try {
                            const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
                            const latency = Date.now() - start;
                            const body = res.headers.get('content-type')?.includes('json')
                                ? await res.json().catch(() => null)
                                : await res.text().catch(() => null);
                            return {
                                target: cfg.target, url, status: res.ok ? 'healthy' : 'degraded',
                                statusCode: res.status, latency, body,
                            };
                        } catch (err) {
                            return {
                                target: cfg.target, url, status: 'down',
                                error: err.message, latency: Date.now() - start,
                            };
                        }
                    }
                },
            ],
        }),

        'monitor': (cfg) => ({
            domain: cfg.domain || `monitor-${cfg.target}`,
            description: `Monitor for ${cfg.target}`,
            priority: 0.7,
            workers: [
                {
                    name: 'metrics', fn: async () => {
                        const mem = process.memoryUsage();
                        const lagStart = Date.now();
                        await new Promise(r => setImmediate(r));
                        const eventLoopLag = Date.now() - lagStart;
                        return {
                            target: cfg.target,
                            heapUsedMB: Math.round(mem.heapUsed / 1048576 * 10) / 10,
                            heapTotalMB: Math.round(mem.heapTotal / 1048576 * 10) / 10,
                            rssMB: Math.round(mem.rss / 1048576 * 10) / 10,
                            externalMB: Math.round(mem.external / 1048576 * 10) / 10,
                            eventLoopLagMs: eventLoopLag,
                            ts: Date.now(),
                        };
                    }
                },
                {
                    name: 'uptime', fn: async () => {
                        const uptimeSec = process.uptime();
                        return {
                            target: cfg.target,
                            uptimeSeconds: Math.round(uptimeSec),
                            uptimeHuman: uptimeSec > 86400
                                ? `${Math.floor(uptimeSec / 86400)}d ${Math.floor((uptimeSec % 86400) / 3600)}h`
                                : uptimeSec > 3600
                                    ? `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m`
                                    : `${Math.floor(uptimeSec / 60)}m ${Math.round(uptimeSec % 60)}s`,
                            cpuUsage: process.cpuUsage(),
                            pid: process.pid,
                            ts: Date.now(),
                        };
                    }
                },
            ],
        }),

        'processor': (cfg) => ({
            domain: cfg.domain || `processor-${cfg.name}`,
            description: `Data processor: ${cfg.name}`,
            priority: cfg.priority || 0.6,
            workers: (cfg.tasks || []).map(task => ({
                name: task.name || 'process',
                fn: task.fn || (async () => ({ processed: true, task: task.name })),
            })),
        }),

        'scanner': (cfg) => ({
            domain: cfg.domain || `scanner-${cfg.target}`,
            description: `Scanner for ${cfg.target}`,
            priority: 0.8,
            workers: [
                {
                    name: 'scan', fn: cfg.scanFn || (async () => {
                        const fs = require('fs');
                        const path = require('path');
                        const targetDir = cfg.scanPath || cfg.target || '.';
                        const patterns = cfg.patterns || ['.env', '.key', '.pem', 'secret'];
                        const findings = [];

                        const walk = (dir, depth = 0) => {
                            if (depth > 5) return;
                            try {
                                const entries = fs.readdirSync(dir, { withFileTypes: true });
                                for (const entry of entries) {
                                    if (entry.name === 'node_modules' || entry.name === '.git') continue;
                                    const fullPath = path.join(dir, entry.name);
                                    if (entry.isDirectory()) {
                                        walk(fullPath, depth + 1);
                                    } else if (patterns.some(p => entry.name.includes(p))) {
                                        findings.push({
                                            file: fullPath,
                                            pattern: patterns.find(p => entry.name.includes(p)),
                                            size: fs.statSync(fullPath).size,
                                        });
                                    }
                                }
                            } catch { /* permission denied or missing dir */ }
                        };
                        walk(targetDir);

                        return { scanned: targetDir, findings, count: findings.length, ts: Date.now() };
                    })
                },
                {
                    name: 'report', fn: cfg.reportFn || (async (ctx) => {
                        const findings = ctx?.findings || [];
                        const severity = findings.length > 5 ? 'high' : findings.length > 0 ? 'medium' : 'clean';
                        return {
                            report: `Scan complete: ${cfg.target}`,
                            severity,
                            totalFindings: findings.length,
                            summary: findings.slice(0, 10).map(f => f.file),
                        };
                    })
                },
            ],
        }),

        'alerter': (cfg) => ({
            domain: cfg.domain || `alerter-${cfg.target}`,
            description: `Threshold alerter for ${cfg.target}`,
            priority: 0.85,
            workers: [
                {
                    name: 'check-thresholds', fn: async () => {
                        const mem = process.memoryUsage();
                        const heapPercent = (mem.heapUsed / mem.heapTotal) * 100;
                        const alerts = [];

                        if (heapPercent > (cfg.heapThreshold || 85)) {
                            alerts.push({ type: 'heap', level: 'warning', value: `${heapPercent.toFixed(1)}%`, threshold: `${cfg.heapThreshold || 85}%` });
                        }

                        if (process.uptime() > (cfg.maxUptimeSeconds || 86400 * 7)) {
                            alerts.push({ type: 'uptime', level: 'info', value: `${Math.floor(process.uptime() / 86400)}d`, threshold: 'restart recommended' });
                        }

                        if (global.eventBus && alerts.length > 0) {
                            global.eventBus.emit('bee:alerts', { target: cfg.target, alerts });
                        }

                        return { target: cfg.target, alerts, alertCount: alerts.length, ts: Date.now() };
                    }
                },
            ],
        }),
    };

    const templateFn = templates[template];
    if (!templateFn) {
        throw new Error(`Unknown bee template: '${template}'. Available: ${Object.keys(templates).join(', ')}`);
    }

    return createBee(config.domain || `${template}-${config.target || config.name || 'dynamic'}`, templateFn(config));
}

/**
 * Create a coordinated swarm of bees with CSL-powered candidate scoring.
 * Uses multi_resonance to rank bees by semantic affinity to the swarm mission,
 * and superposition_gate to build the swarm's composite capability vector.
 *
 * @param {string} name - Swarm name
 * @param {Array} beeConfigs - Array of { domain, config } for each bee
 * @param {Object} policy - Orchestration policy
 * @param {string} policy.mode - 'parallel', 'sequential', or 'pipeline'
 * @param {boolean} policy.requireConsensus - If true, all bees must succeed
 * @param {number} policy.timeoutMs - Max execution time per bee (default: 30000)
 * @returns {Object} The swarm bee entry with CSL scoring
 */
function createSwarm(name, beeConfigs = [], policy = {}) {
    const {
        mode = 'parallel',
        requireConsensus = false,
        timeoutMs = 30000,
    } = policy;

    // Create individual bees first
    const bees = beeConfigs.map(({ domain, config }) =>
        createBee(domain, config || {})
    );

    // CSL: Score each bee's affinity to the swarm mission using multi_resonance
    const swarmIntentVec = _domainToVec(name);
    const beeVectors = bees.map(b => b.vector);
    const affinityScores = beeVectors.length > 0
        ? CSL.multi_resonance(swarmIntentVec, beeVectors, 0.2)
        : [];

    // CSL: Build composite swarm vector via consensus superposition
    const swarmVector = beeVectors.length > 0
        ? CSL.consensus_superposition(beeVectors)
        : swarmIntentVec;

    // Create the orchestrating swarm bee
    const swarmBee = createBee(`swarm-${name}`, {
        description: `Swarm: ${name} (${mode}, ${bees.length} bees, CSL-scored)`,
        priority: 1.0,
        isSwarm: true,
        workers: [{
            name: 'orchestrate',
            fn: async (ctx = {}) => {
                const results = {};
                const startTime = Date.now();

                // Order bees by CSL affinity (highest first) for sequential/pipeline modes
                const orderedBees = affinityScores.length > 0
                    ? affinityScores.map(s => bees[s.index])
                    : bees;

                if (mode === 'parallel') {
                    const settled = await Promise.allSettled(
                        orderedBees.map(async (bee) => {
                            const workFns = bee.getWork(ctx);
                            const beeResults = [];
                            for (const fn of workFns) {
                                const result = await Promise.race([
                                    fn(ctx),
                                    new Promise((_, reject) =>
                                        setTimeout(() => reject(new Error('timeout')), timeoutMs)
                                    ),
                                ]);
                                beeResults.push(result);
                            }
                            return { domain: bee.domain, results: beeResults };
                        })
                    );

                    for (const s of settled) {
                        if (s.status === 'fulfilled') {
                            results[s.value.domain] = { status: 'ok', results: s.value.results };
                        } else {
                            results[s.reason?.domain || 'unknown'] = { status: 'error', error: s.reason?.message };
                        }
                    }
                } else if (mode === 'sequential' || mode === 'pipeline') {
                    let pipelineCtx = { ...ctx };
                    for (const bee of orderedBees) {
                        try {
                            const workFns = bee.getWork(pipelineCtx);
                            const beeResults = [];
                            for (const fn of workFns) {
                                const result = await fn(pipelineCtx);
                                beeResults.push(result);
                                if (mode === 'pipeline' && typeof result === 'object') {
                                    pipelineCtx = { ...pipelineCtx, ...result };
                                }
                            }
                            results[bee.domain] = { status: 'ok', results: beeResults };
                        } catch (err) {
                            results[bee.domain] = { status: 'error', error: err.message };
                            if (requireConsensus) break;
                        }
                    }
                }

                const allOk = Object.values(results).every(r => r.status === 'ok');
                return {
                    swarm: name,
                    mode,
                    beeCount: bees.length,
                    consensus: requireConsensus ? allOk : null,
                    durationMs: Date.now() - startTime,
                    csl: {
                        affinityScores: affinityScores.map(s => ({ index: s.index, score: s.score })),
                        swarmVectorDim: swarmVector.length,
                    },
                    results,
                };
            },
        }],
    });

    // Attach the composite swarm vector
    swarmBee.vector = swarmVector;
    swarmBee.csl.affinityScores = affinityScores.map(s => ({ index: s.index, score: s.score }));

    return swarmBee;
}

/**
 * Get all dynamic and ephemeral bees with CSL metadata.
 */
function listDynamicBees() {
    const bees = [];
    for (const [id, entry] of _dynamicRegistry) {
        bees.push({
            domain: id, description: entry.description, priority: entry.priority,
            type: 'dynamic', createdAt: entry.createdAt,
            csl: entry.csl || null,
        });
    }
    for (const [id, entry] of _ephemeralBees) {
        bees.push({
            domain: id, description: entry.description, priority: entry.priority,
            type: 'ephemeral', createdAt: entry.createdAt,
            csl: entry.csl || null,
        });
    }
    return bees;
}

/**
 * Dissolve (remove) a dynamic or ephemeral bee.
 */
function dissolveBee(domain) {
    _dynamicRegistry.delete(domain);
    _ephemeralBees.delete(domain);
    _vecCache.delete(domain);
    try {
        const registry = require('./registry');
        registry.registry.delete(domain);
    } catch { /* fine */ }
}

/**
 * Persist a dynamic bee to disk as a real bee file.
 * @private
 */
function _persistBee(domain, config) {
    const filename = `${domain.replace(/[^a-z0-9-]/gi, '-')}-bee.js`;
    const filePath = path.join(BEES_DIR, filename);

    // Don't overwrite existing files
    if (fs.existsSync(filePath)) return;

    const workerNames = (config.workers || []).map((w, i) =>
        typeof w === 'function' ? `worker-${i}` : (w.name || `worker-${i}`)
    );

    const code = `/*
 * © 2026 Heady™Systems Inc.. PROPRIETARY AND CONFIDENTIAL.
 * Auto-generated by Dynamic Bee Factory (CSL-enabled)
 * Domain: ${domain}
 * Created: ${new Date().toISOString()}
 */
const domain = '${domain}';
const description = '${(config.description || '').replace(/'/g, "\\'")}';
const priority = ${config.priority || 0.5};

function getWork(ctx = {}) {
    return [
${workerNames.map(name => `        async () => ({ bee: domain, action: '${name}', status: 'active', ts: Date.now() }),`).join('\n')}
    ];
}

module.exports = { domain, description, priority, getWork };
`;

    try {
        fs.writeFileSync(filePath, code, 'utf8');
    } catch { /* non-fatal */ }
}

// Export everything — Heady™ can create any bee, anywhere, instantly
module.exports = {
    createBee,
    spawnBee,
    routeBee,
    createWorkUnit,
    createFromTemplate,
    createSwarm,
    listDynamicBees,
    dissolveBee,
    dynamicRegistry: _dynamicRegistry,
    ephemeralBees: _ephemeralBees,
    _domainToVec,
};
>>>>>>> hc-testing/dependabot/docker/node-25-slim
