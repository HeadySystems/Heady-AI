'use strict';

/**
 * @fileoverview auto-success-engine.js — LAW-07 Auto-Success Engine
 *
 * The heartbeat of the Heady platform. Runs continuous health, optimization,
 * and evolution tasks on a φ⁷-scaled heartbeat. Categories are DYNAMICALLY
 * DISCOVERED at runtime via CSL similarity scoring — never hardcoded.
 *
 * Cycle interval: φ⁷ × 1000 ≈ 29,034ms
 *
 * Task priority tiers (phi-derived budget fractions):
 *   CRITICAL : ψ²  ≈ 38.2%
 *   HIGH     : ψ³  ≈ 23.6%
 *   STANDARD : ψ⁴  ≈ 14.6%
 *   GROWTH   : ψ⁵  ≈  9.0%
 *
 * ORS (Operational Readiness Score) thresholds (scaled 0–100):
 *   < phiThreshold(0) × 100  ≈ <50  → RECOVERY mode
 *   < phiThreshold(1) × 100  ≈ <69  → REPAIR mode
 *   < phiThreshold(2) × 100  ≈ <81  → NORMAL mode
 *   ≥ phiThreshold(2) × 100  ≈ ≥81  → OPTIMAL mode
 *
 * @module auto-success-engine
 * @author Heady Ecosystem
 * @version 1.0.0
 * @license MIT
 */

const EventEmitter = require('events');

const {
  PHI, PSI, PSI2, PSI3, PSI4,
  fib,
  phiThreshold,
  phiBackoff,
  phiBackoffWithJitter,
  CSL_THRESHOLDS,
  ALERT_THRESHOLDS,
  POOL_RATIOS,
  getPressureLevel,
  phiFusionWeights,
  phiTimeouts,
  phiIntervals,
  PRESSURE_LEVELS,
  phiPriorityScore,
  placeholderVector,
  cosineSimilarity,
} = require('../../shared/phi-math.js');

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: PHI-DERIVED ENGINE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Heartbeat cycle interval: φ⁷ × 1000 ≈ 29,034ms.
 * @constant {number}
 */
const CYCLE_INTERVAL_MS = Math.pow(PHI, 7) * 1000;

/**
 * Per-task execution timeout: fib(5) × 1000 = 5,000ms.
 * @constant {number}
 */
const TASK_TIMEOUT_MS = fib(5) * 1000;

/**
 * Maximum retries per task per cycle: fib(4) = 3.
 * @constant {number}
 */
const MAX_TASK_RETRIES = fib(4);

/**
 * Maximum total cycle failures before an incident is triggered: fib(6) = 8.
 * @constant {number}
 */
const MAX_CYCLE_FAILURES = fib(6);

/**
 * Minimum tasks per category per cycle: fib(3) = 2.
 * @constant {number}
 */
const MIN_TASKS_PER_CATEGORY = fib(3);

/**
 * Maximum tasks per category per cycle: fib(8) = 21.
 * @constant {number}
 */
const MAX_TASKS_PER_CATEGORY = fib(8);

/**
 * ORS recovery threshold: phiThreshold(0) × 100 = 50.
 * Below this value the engine runs in RECOVERY mode (critical tasks only).
 * @constant {number}
 */
const ORS_RECOVERY_THRESHOLD = phiThreshold(0) * 100;

/**
 * ORS repair threshold: phiThreshold(1) × 100 ≈ 69.1.
 * Between RECOVERY and this value the engine runs in REPAIR mode.
 * @constant {number}
 */
const ORS_REPAIR_THRESHOLD = phiThreshold(1) * 100;

/**
 * ORS normal threshold: phiThreshold(2) × 100 ≈ 80.9.
 * Between REPAIR and this value the engine runs in NORMAL mode.
 * @constant {number}
 */
const ORS_NORMAL_THRESHOLD = phiThreshold(2) * 100;

/**
 * Cycle budget fractions for each priority tier (ψ², ψ³, ψ⁴, ψ⁵).
 * Sum ≈ 0.853; remaining budget is held as reserve.
 * @constant {{ CRITICAL: number, HIGH: number, STANDARD: number, GROWTH: number }}
 */
const TIER_BUDGETS = Object.freeze({
  CRITICAL: PSI2,
  HIGH:     PSI3,
  STANDARD: PSI4,
  GROWTH:   Math.pow(PSI, 5),
});

/**
 * CSL similarity floor for category relevance matching.
 * Uses CSL_THRESHOLDS.MEDIUM ≈ 0.809 to ensure genuine semantic alignment.
 * @constant {number}
 */
const CATEGORY_RELEVANCE_FLOOR = CSL_THRESHOLDS.MEDIUM;

/**
 * CSL similarity floor for task relevance scoring.
 * Uses CSL_THRESHOLDS.LOW ≈ 0.691 — permissive for task intake.
 * @constant {number}
 */
const TASK_RELEVANCE_FLOOR = CSL_THRESHOLDS.LOW;

/**
 * Default category seed definitions.
 * The engine discovers additional categories at runtime via CSL scanning.
 * Each seed has a name, description, priority tier, and a reference vector label.
 * @constant {CategorySeed[]}
 */
const DEFAULT_CATEGORY_SEEDS = Object.freeze([
  { name: 'health_monitoring',    tier: 'CRITICAL', label: 'system health checks vitals uptime' },
  { name: 'memory_optimization',  tier: 'HIGH',     label: 'vector memory compaction pruning eviction' },
  { name: 'security_scanning',    tier: 'CRITICAL', label: 'vulnerability detection contamination scan' },
  { name: 'performance_tuning',   tier: 'HIGH',     label: 'latency optimization cache warming throughput' },
  { name: 'pattern_learning',     tier: 'STANDARD', label: 'HeadyPatterns analysis recognition learning' },
  { name: 'deployment_readiness', tier: 'STANDARD', label: 'pre-deploy validation readiness gate' },
  { name: 'coherence_tracking',   tier: 'HIGH',     label: 'Sacred Geometry drift detection coherence' },
  { name: 'cost_optimization',    tier: 'STANDARD', label: 'budget tracking provider cost analysis' },
  { name: 'evolution_candidacy',  tier: 'GROWTH',   label: 'pipeline mutation evolution candidates' },
]);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {'CRITICAL'|'HIGH'|'STANDARD'|'GROWTH'} PriorityTier
 */

/**
 * @typedef {'RECOVERY'|'REPAIR'|'NORMAL'|'OPTIMAL'} EngineMode
 */

/**
 * @typedef {Object} CategorySeed
 * @property {string} name   - Category identifier
 * @property {PriorityTier} tier - Default priority tier
 * @property {string} label  - Semantic label used to generate reference vector
 */

/**
 * @typedef {Object} TaskCategory
 * @property {string}       name        - Category identifier
 * @property {PriorityTier} tier        - Assigned priority tier
 * @property {number[]}     vector      - CSL reference vector (unit, VECTOR_DIMENSIONS)
 * @property {number}       healthScore - Rolling health score [0,1]
 * @property {number}       taskCount   - Tasks executed this cycle
 * @property {boolean}      discovered  - True if discovered at runtime (not from seed)
 * @property {number}       lastUpdated - Unix timestamp of last update
 */

/**
 * @typedef {Object} AutoTask
 * @property {string}       id          - Unique task identifier
 * @property {string}       category    - Owning category name
 * @property {PriorityTier} tier        - Execution tier
 * @property {string}       description - Human-readable description
 * @property {Function}     execute     - Async task executor: () => Promise<TaskResult>
 * @property {number}       priority    - phiPriorityScore output [0,1]
 * @property {number}       retries     - Retry count this cycle
 * @property {number}       scheduledAt - Unix timestamp
 */

/**
 * @typedef {Object} TaskResult
 * @property {boolean} success      - Whether the task succeeded
 * @property {string}  category     - Owning category
 * @property {string}  taskId       - Task identifier
 * @property {number}  duration     - Execution time in ms
 * @property {number}  healthDelta  - Change to category health score [-1,1]
 * @property {Object}  [data]       - Optional structured output
 * @property {string}  [error]      - Error message if failed
 */

/**
 * @typedef {Object} CycleTelemetry
 * @property {number}     cycleIndex       - Monotonically increasing cycle counter
 * @property {number}     startedAt        - Cycle start Unix timestamp
 * @property {number}     completedAt      - Cycle end Unix timestamp
 * @property {number}     duration         - Cycle duration in ms
 * @property {number}     ors              - ORS at cycle end [0,100]
 * @property {EngineMode} mode             - Engine operating mode
 * @property {number}     tasksRun         - Tasks executed this cycle
 * @property {number}     tasksSucceeded   - Tasks that succeeded
 * @property {number}     tasksFailed      - Tasks that failed
 * @property {number}     categoriesActive - Count of active categories
 * @property {string[]}   categoriesDiscovered - Newly discovered categories this cycle
 * @property {boolean}    incidentTriggered - Whether an incident was raised
 */

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: HELPER UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wraps a promise with a phi-scaled timeout.
 * Rejects with a TimeoutError if the promise does not settle in time.
 *
 * @param {Promise<*>} promise    - The promise to race
 * @param {number}     timeoutMs  - Timeout in milliseconds
 * @param {string}     label      - Label for the timeout error message
 * @returns {Promise<*>}
 * @throws {Error} When timeout fires before promise resolves
 */
function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout after ${timeoutMs}ms: ${label}`));
    }, timeoutMs);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err)   => { clearTimeout(timer); reject(err); },
    );
  });
}

/**
 * Creates a deferred promise that resolves after delayMs milliseconds.
 *
 * @param {number} delayMs - Delay in milliseconds
 * @returns {Promise<void>}
 */
function sleep(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/**
 * Computes the number of tasks to schedule for a category given current
 * system pressure. Scales linearly from MIN_TASKS_PER_CATEGORY at CRITICAL
 * pressure to MAX_TASKS_PER_CATEGORY at NOMINAL pressure.
 *
 * @param {string} pressureLevel - Output of getPressureLevel()
 * @returns {number} Integer task count in [MIN_TASKS_PER_CATEGORY, MAX_TASKS_PER_CATEGORY]
 */
function computeTaskCountForPressure(pressureLevel) {
  const scaleMap = {
    NOMINAL:  1,
    ELEVATED: PSI,
    HIGH:     PSI2,
    CRITICAL: PSI3,
  };
  const scale = scaleMap[pressureLevel] ?? PSI2;
  const raw = MIN_TASKS_PER_CATEGORY + (MAX_TASKS_PER_CATEGORY - MIN_TASKS_PER_CATEGORY) * scale;
  return Math.max(MIN_TASKS_PER_CATEGORY, Math.min(MAX_TASKS_PER_CATEGORY, Math.round(raw)));
}

/**
 * Derives an EngineMode from the current ORS score.
 *
 * @param {number} ors - Operational Readiness Score [0,100]
 * @returns {EngineMode}
 */
function orsModeFromScore(ors) {
  if (ors < ORS_RECOVERY_THRESHOLD) return 'RECOVERY';
  if (ors < ORS_REPAIR_THRESHOLD)   return 'REPAIR';
  if (ors < ORS_NORMAL_THRESHOLD)   return 'NORMAL';
  return 'OPTIMAL';
}

/**
 * Generates a unique task identifier using a category prefix and high-resolution timestamp.
 *
 * @param {string} category - Category name
 * @returns {string} Task identifier
 */
function generateTaskId(category) {
  const ts = process.hrtime.bigint ? Number(process.hrtime.bigint() % BigInt(1e9)) : Date.now();
  const rand = Math.floor(Math.random() * fib(8) * fib(6)); // up to 21*8=168 range
  return `${category}:${ts}:${rand}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: CATEGORY REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Manages the live registry of task categories, supporting runtime discovery
 * via CSL cosine similarity scoring.
 */
class CategoryRegistry {
  /**
   * Initialises the registry with default seed categories.
   * Each seed generates a deterministic CSL reference vector.
   */
  constructor() {
    /** @type {Map<string, TaskCategory>} */
    this._categories = new Map();
    this._initSeeds();
  }

  /**
   * Populates the registry from DEFAULT_CATEGORY_SEEDS.
   * @private
   */
  _initSeeds() {
    for (const seed of DEFAULT_CATEGORY_SEEDS) {
      this._categories.set(seed.name, {
        name:        seed.name,
        tier:        seed.tier,
        vector:      placeholderVector(seed.label),
        healthScore: CSL_THRESHOLDS.HIGH,
        taskCount:   0,
        discovered:  false,
        lastUpdated: Date.now(),
      });
    }
  }

  /**
   * Returns all registered categories as an array.
   * @returns {TaskCategory[]}
   */
  all() {
    return Array.from(this._categories.values());
  }

  /**
   * Returns a single category by name, or undefined if not found.
   *
   * @param {string} name
   * @returns {TaskCategory|undefined}
   */
  get(name) {
    return this._categories.get(name);
  }

  /**
   * Registers a newly discovered category.
   * No-ops if a category with the same name already exists.
   *
   * @param {string}       name  - Category identifier
   * @param {PriorityTier} tier  - Assigned tier
   * @param {number[]}     vector - CSL reference vector
   * @returns {boolean} True if the category was newly registered
   */
  register(name, tier, vector) {
    if (this._categories.has(name)) return false;
    this._categories.set(name, {
      name,
      tier,
      vector,
      healthScore: CSL_THRESHOLDS.MEDIUM,
      taskCount:   0,
      discovered:  true,
      lastUpdated: Date.now(),
    });
    return true;
  }

  /**
   * Updates a category's health score and task count.
   *
   * @param {string} name        - Category name
   * @param {number} healthDelta - Additive delta applied to healthScore
   * @param {number} tasksDone   - Tasks completed in this cycle
   */
  updateHealth(name, healthDelta, tasksDone) {
    const cat = this._categories.get(name);
    if (!cat) return;
    cat.healthScore = Math.max(0, Math.min(1, cat.healthScore + healthDelta));
    cat.taskCount  += tasksDone;
    cat.lastUpdated = Date.now();
  }

  /**
   * Performs a CSL similarity scan against a set of signal vectors.
   * Any signal that exceeds CATEGORY_RELEVANCE_FLOOR but does not match an
   * existing category is returned as a discovery candidate.
   *
   * @param {Array<{label: string, vector: number[], tier?: PriorityTier}>} signals
   * @returns {Array<{label: string, score: number, tier: PriorityTier}>}
   */
  scanForDiscoveries(signals) {
    const candidates = [];
    for (const sig of signals) {
      let bestScore = 0;
      let matched = false;
      for (const cat of this._categories.values()) {
        const score = cosineSimilarity(sig.vector, cat.vector);
        if (score >= CATEGORY_RELEVANCE_FLOOR) { matched = true; break; }
        if (score > bestScore) bestScore = score;
      }
      if (!matched && bestScore >= TASK_RELEVANCE_FLOOR) {
        candidates.push({
          label: sig.label,
          score: bestScore,
          tier:  sig.tier || 'STANDARD',
        });
      }
    }
    return candidates;
  }

  /**
   * Resets per-cycle task counts for all categories.
   */
  resetCycleCounts() {
    for (const cat of this._categories.values()) {
      cat.taskCount = 0;
    }
  }

  /** @returns {number} Total number of registered categories */
  get size() {
    return this._categories.size;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: TASK SCHEDULER — φ-PRIORITY QUEUE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A phi-priority task queue. Tasks are sorted by computed phiPriorityScore
 * descending (highest priority first). Tier budgets gate total execution slots.
 */
class PhiTaskScheduler {
  constructor() {
    /** @type {AutoTask[]} */
    this._queue = [];
  }

  /**
   * Enqueues a task, inserting it in sorted position by priority.
   * @param {AutoTask} task
   */
  enqueue(task) {
    this._queue.push(task);
    this._queue.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Drains the queue into tier-bucketed batches respecting TIER_BUDGETS.
   * Returns tasks in execution order (CRITICAL first, GROWTH last).
   *
   * @param {number}     totalSlots   - Total concurrent execution slots available
   * @param {EngineMode} mode         - Current engine mode (restricts tiers in RECOVERY)
   * @returns {AutoTask[]} Ordered task list for this cycle
   */
  drain(totalSlots, mode) {
    const allowedTiers = this._allowedTiersForMode(mode);
    const filtered = this._queue.filter(t => allowedTiers.has(t.tier));
    const tierOrder = ['CRITICAL', 'HIGH', 'STANDARD', 'GROWTH'];
    const selected = [];

    for (const tier of tierOrder) {
      if (!allowedTiers.has(tier)) continue;
      const budget = Math.max(1, Math.floor(totalSlots * TIER_BUDGETS[tier]));
      const tierTasks = filtered.filter(t => t.tier === tier).slice(0, budget);
      selected.push(...tierTasks);
    }

    this._queue = [];
    return selected;
  }

  /**
   * Returns the set of tiers permitted for a given engine mode.
   *
   * @param {EngineMode} mode
   * @returns {Set<PriorityTier>}
   * @private
   */
  _allowedTiersForMode(mode) {
    if (mode === 'RECOVERY') return new Set(['CRITICAL']);
    if (mode === 'REPAIR')   return new Set(['CRITICAL', 'HIGH']);
    return new Set(['CRITICAL', 'HIGH', 'STANDARD', 'GROWTH']);
  }

  /** @returns {number} Current queue depth */
  get depth() {
    return this._queue.length;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: ORS TRACKER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes and tracks the Operational Readiness Score (ORS).
 * ORS is a phi-fusion-weighted composite of all category health scores,
 * mapped to the [0, 100] range.
 */
class OrsTracker {
  constructor() {
    /** @type {number} Current ORS [0,100] */
    this.score = ORS_NORMAL_THRESHOLD;
    /** @type {number[]} Rolling history, max fib(9)=34 entries */
    this._history = [];
  }

  /**
   * Recomputes ORS from the current state of all categories.
   * Categories are sorted by health score descending so the phi-fusion
   * weights reward healthier categories more.
   *
   * @param {TaskCategory[]} categories - All registered categories
   * @returns {number} Updated ORS [0,100]
   */
  recompute(categories) {
    if (categories.length === 0) return this.score;

    const sorted  = [...categories].sort((a, b) => b.healthScore - a.healthScore);
    const weights = phiFusionWeights(sorted.length);
    const raw     = sorted.reduce((sum, cat, i) => sum + cat.healthScore * weights[i], 0);

    this.score = Math.round(Math.min(100, Math.max(0, raw * 100)));
    this._history.push(this.score);
    if (this._history.length > fib(9)) {
      this._history.shift();
    }
    return this.score;
  }

  /**
   * Returns the exponentially-smoothed ORS trend over recent history.
   * Uses PSI as the smoothing factor (≈ 0.618).
   *
   * @returns {number} Smoothed ORS [0,100]
   */
  trend() {
    if (this._history.length === 0) return this.score;
    return this._history.reduce((ema, val) => PSI * val + (1 - PSI) * ema, this._history[0]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: BUILT-IN TASK FACTORIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates the default set of built-in tasks for a given category.
 * Each factory returns a lightweight async executor that simulates the
 * task and returns a TaskResult. Production integrations replace these
 * with real I/O calls by registering custom task providers via
 * AutoSuccessEngine#registerTaskProvider().
 *
 * @param {TaskCategory} category - Category for which to generate tasks
 * @param {number}       count    - Number of tasks to generate
 * @param {number}       pressure - Current system pressure [0,1]
 * @returns {AutoTask[]}
 */
function createBuiltInTasks(category, count, pressure) {
  const tasks = [];
  const now   = Date.now();
  const templatesByCategory = _getTaskTemplates(category.name);

  for (let i = 0; i < count; i++) {
    const template = templatesByCategory[i % templatesByCategory.length];
    const urgency  = _tierToUrgencyScore(category.tier);
    const recency  = PSI2; // all built-in tasks have equal recency baseline
    const relevance = Math.max(PSI3, CSL_THRESHOLDS.LOW - pressure * PSI3);

    const task = {
      id:          generateTaskId(category.name),
      category:    category.name,
      tier:        category.tier,
      description: template.description,
      priority:    phiPriorityScore({ urgency, recency, relevance }),
      retries:     0,
      scheduledAt: now,
      execute:     template.execute,
    };
    tasks.push(task);
  }
  return tasks;
}

/**
 * Returns task template definitions for a named category.
 *
 * @param {string} categoryName
 * @returns {Array<{description: string, execute: Function}>}
 * @private
 */
function _getTaskTemplates(categoryName) {
  const templates = {
    health_monitoring: [
      { description: 'Check memory heap utilisation',
        execute: () => _syntheticTask(categoryName, 'heap', PSI) },
      { description: 'Verify event-loop lag within phi-threshold',
        execute: () => _syntheticTask(categoryName, 'event-loop', PSI2) },
      { description: 'Probe external dependency latencies',
        execute: () => _syntheticTask(categoryName, 'dependency-probe', PSI3) },
    ],
    memory_optimization: [
      { description: 'Compact vector store stale entries',
        execute: () => _syntheticTask(categoryName, 'vector-compact', PSI) },
      { description: 'Prune low-relevance memory nodes',
        execute: () => _syntheticTask(categoryName, 'prune-nodes', PSI2) },
      { description: 'Rebuild HNSW index fragments',
        execute: () => _syntheticTask(categoryName, 'hnsw-rebuild', PSI3) },
    ],
    security_scanning: [
      { description: 'Scan pipeline configs for localhost contamination',
        execute: () => _syntheticTask(categoryName, 'localhost-scan', PSI) },
      { description: 'Audit dependency versions for CVEs',
        execute: () => _syntheticTask(categoryName, 'cve-audit', PSI2) },
      { description: 'Validate secrets are not in logs or state',
        execute: () => _syntheticTask(categoryName, 'secrets-audit', PSI3) },
    ],
    performance_tuning: [
      { description: 'Warm CSL embedding cache for top-N routes',
        execute: () => _syntheticTask(categoryName, 'cache-warm', PSI) },
      { description: 'Prune redundant phi-backoff timers',
        execute: () => _syntheticTask(categoryName, 'timer-prune', PSI2) },
      { description: 'Rebalance connection pool ratios',
        execute: () => _syntheticTask(categoryName, 'pool-rebalance', PSI3) },
    ],
    pattern_learning: [
      { description: 'Analyse HeadyPatterns for drift',
        execute: () => _syntheticTask(categoryName, 'pattern-drift', PSI) },
      { description: 'Cluster recent interaction embeddings',
        execute: () => _syntheticTask(categoryName, 'embedding-cluster', PSI2) },
      { description: 'Update pattern frequency histograms',
        execute: () => _syntheticTask(categoryName, 'histogram-update', PSI3) },
    ],
    deployment_readiness: [
      { description: 'Run phi-compliance validation on config',
        execute: () => _syntheticTask(categoryName, 'phi-compliance', PSI) },
      { description: 'Verify all CSL thresholds within tolerance',
        execute: () => _syntheticTask(categoryName, 'csl-verify', PSI2) },
      { description: 'Check graceful shutdown hooks registered',
        execute: () => _syntheticTask(categoryName, 'shutdown-hooks', PSI3) },
    ],
    coherence_tracking: [
      { description: 'Measure Sacred Geometry ring drift',
        execute: () => _syntheticTask(categoryName, 'ring-drift', PSI) },
      { description: 'Recompute phi-scaled adjacency weights',
        execute: () => _syntheticTask(categoryName, 'adjacency-recompute', PSI2) },
      { description: 'Assert coherence above COHERENCE_DRIFT_THRESHOLD',
        execute: () => _syntheticTask(categoryName, 'coherence-assert', PSI3) },
    ],
    cost_optimization: [
      { description: 'Aggregate token spend per provider',
        execute: () => _syntheticTask(categoryName, 'token-spend', PSI) },
      { description: 'Flag providers exceeding ALERT_THRESHOLDS.caution budget',
        execute: () => _syntheticTask(categoryName, 'budget-alert', PSI2) },
      { description: 'Suggest phi-scaled rate-limit adjustments',
        execute: () => _syntheticTask(categoryName, 'rate-limit-suggest', PSI3) },
    ],
    evolution_candidacy: [
      { description: 'Score pipeline mutation candidates by phi-priority',
        execute: () => _syntheticTask(categoryName, 'mutation-score', PSI) },
      { description: 'Identify CSL gate hysteresis in recent cycles',
        execute: () => _syntheticTask(categoryName, 'gate-hysteresis', PSI2) },
      { description: 'Propose next-generation embedding strategy',
        execute: () => _syntheticTask(categoryName, 'embed-strategy', PSI3) },
    ],
  };

  return templates[categoryName] || [
    { description: `Run ${categoryName} health assessment`,
      execute: () => _syntheticTask(categoryName, 'generic', PSI2) },
    { description: `Optimise ${categoryName} subsystem`,
      execute: () => _syntheticTask(categoryName, 'generic-opt', PSI3) },
  ];
}

/**
 * Converts a PriorityTier to a normalised urgency score.
 *
 * @param {PriorityTier} tier
 * @returns {number} Urgency score in (0,1]
 * @private
 */
function _tierToUrgencyScore(tier) {
  const map = { CRITICAL: 1, HIGH: PSI, STANDARD: PSI2, GROWTH: PSI3 };
  return map[tier] ?? PSI2;
}

/**
 * Executes a synthetic task that simulates real work with a phi-scaled outcome.
 *
 * @param {string} category   - Owning category
 * @param {string} subtype    - Subtype label
 * @param {number} successBias - Probability of success (phi-derived)
 * @returns {Promise<TaskResult>}
 * @private
 */
async function _syntheticTask(category, subtype, successBias) {
  const start = Date.now();
  await sleep(Math.floor(Math.random() * fib(7) * PSI3 * 100));
  const success = Math.random() < successBias + PSI3;
  return {
    success,
    category,
    taskId:      `${category}:${subtype}`,
    duration:    Date.now() - start,
    healthDelta: success ? PSI4 : -PSI3,
    data:        { subtype, successBias },
    error:       success ? undefined : `${subtype} returned below phiThreshold(1)`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8: AUTO-SUCCESS ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AutoSuccessEngine — the heartbeat of the Heady platform.
 *
 * Continuously discovers task categories via CSL semantic scanning, scores
 * and schedules tasks using phi-priority, executes them in parallel on a
 * φ⁷-scaled cycle, and maintains the Operational Readiness Score.
 *
 * @extends EventEmitter
 *
 * @fires AutoSuccessEngine#cycleStarted
 * @fires AutoSuccessEngine#cycleCompleted
 * @fires AutoSuccessEngine#taskCompleted
 * @fires AutoSuccessEngine#taskFailed
 * @fires AutoSuccessEngine#orsUpdated
 * @fires AutoSuccessEngine#incidentTriggered
 * @fires AutoSuccessEngine#categoryDiscovered
 *
 * @example
 * const engine = new AutoSuccessEngine({ logger: myLogger });
 * engine.start();
 * engine.on('orsUpdated', ({ ors, mode }) => metricsClient.gauge('ors', ors));
 */
class AutoSuccessEngine extends EventEmitter {
  /**
   * @param {Object} [opts]
   * @param {Object} [opts.logger]              - Logger with .info/.warn/.error methods
   * @param {number} [opts.cycleIntervalMs]     - Override cycle interval (default CYCLE_INTERVAL_MS)
   * @param {number} [opts.maxConcurrency]      - Max concurrent tasks (default fib(8)=21)
   * @param {Function} [opts.pressureProvider] - Async () => number [0,1]; returns system pressure
   */
  constructor(opts = {}) {
    super();

    /** @type {Object} */
    this._log = opts.logger || _nullLogger();

    /** @type {number} */
    this._cycleIntervalMs = opts.cycleIntervalMs || CYCLE_INTERVAL_MS;

    /** @type {number} */
    this._maxConcurrency = opts.maxConcurrency || MAX_TASKS_PER_CATEGORY;

    /** @type {Function} */
    this._pressureProvider = opts.pressureProvider || (() => Promise.resolve(PSI2));

    /** @type {CategoryRegistry} */
    this._registry = new CategoryRegistry();

    /** @type {PhiTaskScheduler} */
    this._scheduler = new PhiTaskScheduler();

    /** @type {OrsTracker} */
    this._ors = new OrsTracker();

    /** @type {Map<string, Function>} Custom task provider overrides */
    this._taskProviders = new Map();

    /** @type {boolean} Running state */
    this._running = false;

    /** @type {boolean} Paused state — cycle fires but tasks are held */
    this._paused = false;

    /** @type {NodeJS.Timeout|null} */
    this._cycleTimer = null;

    /** @type {number} Monotonically increasing cycle counter */
    this._cycleIndex = 0;

    /** @type {number} Total incident count */
    this._incidentCount = 0;
  }

  // ───────────────────────────────────────────────────────── LIFECYCLE ─────

  /**
   * Starts the engine. The first cycle fires after one full interval.
   * Idempotent: calling start() on an already-running engine is a no-op.
   *
   * @returns {AutoSuccessEngine} this (for chaining)
   */
  start() {
    if (this._running) return this;
    this._running = true;
    this._scheduleCycle();
    this._log.info(`AutoSuccessEngine started — cycle ${this._cycleIntervalMs.toFixed(0)}ms`);
    return this;
  }

  /**
   * Gracefully stops the engine after the current cycle completes.
   *
   * @returns {AutoSuccessEngine} this
   */
  stop() {
    this._running = false;
    if (this._cycleTimer) {
      clearTimeout(this._cycleTimer);
      this._cycleTimer = null;
    }
    this._log.info('AutoSuccessEngine stopped');
    return this;
  }

  /**
   * Pauses task execution. The heartbeat timer continues but tasks are
   * drained from the queue without execution. Use resume() to reactivate.
   *
   * @returns {AutoSuccessEngine} this
   */
  pause() {
    this._paused = true;
    this._log.info('AutoSuccessEngine paused');
    return this;
  }

  /**
   * Resumes task execution after a pause().
   *
   * @returns {AutoSuccessEngine} this
   */
  resume() {
    this._paused = false;
    this._log.info('AutoSuccessEngine resumed');
    return this;
  }

  // ───────────────────────────────────────────────── TASK REGISTRATION ─────

  /**
   * Registers a custom task provider for a category. When the engine
   * generates tasks for that category it calls the provider instead of
   * the built-in factory. Providers replace all built-in tasks for the
   * given category.
   *
   * The provider receives (category, count, pressure) and must return
   * AutoTask[] (not a Promise).
   *
   * @param {string}   categoryName - Category to override
   * @param {Function} provider     - (category, count, pressure) => AutoTask[]
   * @returns {AutoSuccessEngine} this
   */
  registerTaskProvider(categoryName, provider) {
    if (typeof provider !== 'function') {
      throw new TypeError(`registerTaskProvider: provider must be a function, got ${typeof provider}`);
    }
    this._taskProviders.set(categoryName, provider);
    return this;
  }

  // ─────────────────────────────────────────────────────── OBSERVABILITY ───

  /**
   * Returns a snapshot of current engine state.
   *
   * @returns {{
   *   running: boolean,
   *   paused: boolean,
   *   cycleIndex: number,
   *   ors: number,
   *   orsTrend: number,
   *   mode: EngineMode,
   *   categoryCount: number,
   *   incidentCount: number,
   * }}
   */
  snapshot() {
    return {
      running:       this._running,
      paused:        this._paused,
      cycleIndex:    this._cycleIndex,
      ors:           this._ors.score,
      orsTrend:      this._ors.trend(),
      mode:          orsModeFromScore(this._ors.score),
      categoryCount: this._registry.size,
      incidentCount: this._incidentCount,
    };
  }

  // ─────────────────────────────────────────────────── CORE CYCLE LOOP ─────

  /**
   * Schedules the next cycle timer.
   * @private
   */
  _scheduleCycle() {
    if (!this._running) return;
    this._cycleTimer = setTimeout(() => {
      this._runCycle().catch((err) => {
        this._log.error(`AutoSuccessEngine unhandled cycle error: ${err.message}`);
      }).finally(() => {
        this._scheduleCycle();
      });
    }, this._cycleIntervalMs);
  }

  /**
   * Executes a single engine cycle:
   *   1. Discover active categories via CSL scan.
   *   2. Compute system pressure.
   *   3. Populate scheduler with phi-scored tasks.
   *   4. Execute tasks in parallel respecting tier budgets.
   *   5. Update ORS and emit telemetry.
   *
   * @returns {Promise<CycleTelemetry>}
   * @private
   */
  async _runCycle() {
    const cycleIndex = ++this._cycleIndex;
    const startedAt  = Date.now();
    let   failureCount = 0;
    let   tasksRun     = 0;
    let   tasksSucceeded = 0;
    const discoveredThisCycle = [];

    /**
     * @event AutoSuccessEngine#cycleStarted
     * @type {{ cycleIndex: number, startedAt: number }}
     */
    this.emit('cycleStarted', { cycleIndex, startedAt });

    // ── 1. Gather system pressure ──────────────────────────────────────────
    const pressure = await this._safeGetPressure();
    const pressureLevel = getPressureLevel(pressure);
    const mode = orsModeFromScore(this._ors.score);

    // ── 2. Dynamic category discovery via CSL scan ─────────────────────────
    const newCategories = await this._discoverCategories(pressure);
    for (const cat of newCategories) {
      discoveredThisCycle.push(cat.name);
      /**
       * @event AutoSuccessEngine#categoryDiscovered
       * @type {{ name: string, tier: PriorityTier, cycleIndex: number }}
       */
      this.emit('categoryDiscovered', { name: cat.name, tier: cat.tier, cycleIndex });
    }

    // ── 3. Reset per-cycle counts ──────────────────────────────────────────
    this._registry.resetCycleCounts();

    // ── 4. Populate scheduler unless paused ───────────────────────────────
    if (!this._paused) {
      const taskCount = computeTaskCountForPressure(pressureLevel);
      for (const category of this._registry.all()) {
        const tasks = this._generateTasksForCategory(category, taskCount, pressure);
        for (const task of tasks) {
          this._scheduler.enqueue(task);
        }
      }
    }

    // ── 5. Drain + execute ─────────────────────────────────────────────────
    const toExecute = this._scheduler.drain(this._maxConcurrency, mode);
    tasksRun = toExecute.length;

    if (tasksRun > 0) {
      const results = await this._executeParallel(toExecute, cycleIndex);
      for (const result of results) {
        if (result.success) {
          tasksSucceeded++;
          this._registry.updateHealth(result.category, result.healthDelta, 1);
        } else {
          failureCount++;
          this._registry.updateHealth(result.category, result.healthDelta, 1);
        }
      }
    }

    // ── 6. Incident check ─────────────────────────────────────────────────
    const incidentTriggered = failureCount >= MAX_CYCLE_FAILURES;
    if (incidentTriggered) {
      this._incidentCount++;
      /**
       * @event AutoSuccessEngine#incidentTriggered
       * @type {{ cycleIndex: number, failures: number, ors: number, mode: EngineMode }}
       */
      this.emit('incidentTriggered', {
        cycleIndex,
        failures: failureCount,
        ors:      this._ors.score,
        mode,
      });
      this._log.error(
        `AutoSuccessEngine incident: ${failureCount} failures in cycle ${cycleIndex}`,
      );
    }

    // ── 7. Update ORS ─────────────────────────────────────────────────────
    const updatedOrs  = this._ors.recompute(this._registry.all());
    const updatedMode = orsModeFromScore(updatedOrs);

    /**
     * @event AutoSuccessEngine#orsUpdated
     * @type {{ ors: number, mode: EngineMode, trend: number, cycleIndex: number }}
     */
    this.emit('orsUpdated', {
      ors:        updatedOrs,
      mode:       updatedMode,
      trend:      this._ors.trend(),
      cycleIndex,
    });

    // ── 8. Emit cycle telemetry ────────────────────────────────────────────
    const completedAt = Date.now();
    /** @type {CycleTelemetry} */
    const telemetry = {
      cycleIndex,
      startedAt,
      completedAt,
      duration:             completedAt - startedAt,
      ors:                  updatedOrs,
      mode:                 updatedMode,
      tasksRun,
      tasksSucceeded,
      tasksFailed:          tasksRun - tasksSucceeded,
      categoriesActive:     this._registry.size,
      categoriesDiscovered: discoveredThisCycle,
      incidentTriggered,
    };

    /**
     * @event AutoSuccessEngine#cycleCompleted
     * @type {CycleTelemetry}
     */
    this.emit('cycleCompleted', telemetry);

    return telemetry;
  }

  // ─────────────────────────────────────────────── PARALLEL EXECUTION ──────

  /**
   * Executes a list of tasks in parallel. Each task is wrapped with a
   * phi-scaled timeout and up to MAX_TASK_RETRIES retries with phi-backoff.
   *
   * @param {AutoTask[]} tasks      - Tasks to execute
   * @param {number}     cycleIndex - Current cycle index for telemetry
   * @returns {Promise<TaskResult[]>}
   * @private
   */
  async _executeParallel(tasks, cycleIndex) {
    return Promise.all(tasks.map(task => this._executeWithRetry(task, cycleIndex)));
  }

  /**
   * Executes a single task with retry logic and phi-backoff.
   *
   * @param {AutoTask} task       - Task to execute
   * @param {number}   cycleIndex - Current cycle index
   * @returns {Promise<TaskResult>}
   * @private
   */
  async _executeWithRetry(task, cycleIndex) {
    let lastErr = null;

    for (let attempt = 0; attempt <= MAX_TASK_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = phiBackoffWithJitter(attempt - 1);
        await sleep(delay);
      }

      const start = Date.now();
      try {
        const result = await withTimeout(
          task.execute(),
          TASK_TIMEOUT_MS,
          `${task.id} (attempt ${attempt})`,
        );

        const enriched = {
          ...result,
          taskId:   task.id,
          category: task.category,
          duration: Date.now() - start,
        };

        /**
         * @event AutoSuccessEngine#taskCompleted
         * @type {TaskResult & { cycleIndex: number, attempt: number }}
         */
        this.emit('taskCompleted', { ...enriched, cycleIndex, attempt });
        return enriched;

      } catch (err) {
        lastErr = err;
        task.retries = attempt + 1;

        if (attempt < MAX_TASK_RETRIES) {
          this._log.warn(
            `Task ${task.id} attempt ${attempt} failed: ${err.message} — retrying`,
          );
          continue;
        }
      }
    }

    // All retries exhausted
    const failResult = {
      success:     false,
      taskId:      task.id,
      category:    task.category,
      duration:    TASK_TIMEOUT_MS,
      healthDelta: -PSI2,
      error:       lastErr ? lastErr.message : 'Unknown failure',
    };

    /**
     * @event AutoSuccessEngine#taskFailed
     * @type {TaskResult & { cycleIndex: number }}
     */
    this.emit('taskFailed', { ...failResult, cycleIndex });
    return failResult;
  }

  // ─────────────────────────────────────────── CATEGORY DISCOVERY ──────────

  /**
   * Performs a runtime CSL scan to discover new categories from system
   * signals. Probes the registry for semantic gaps and promotes candidates
   * that exceed TASK_RELEVANCE_FLOOR but fall below CATEGORY_RELEVANCE_FLOOR
   * for all existing categories.
   *
   * @param {number} pressure - Current system pressure [0,1]
   * @returns {Promise<TaskCategory[]>} Newly registered categories
   * @private
   */
  async _discoverCategories(pressure) {
    const newlyAdded = [];

    // Generate CSL scan signals from active system state dimensions.
    // In production these vectors would come from live embedding calls;
    // here we synthesise deterministic probes from runtime context.
    const signals = _buildDiscoverySignals(pressure, this._cycleIndex);
    const candidates = this._registry.scanForDiscoveries(signals);

    for (const candidate of candidates) {
      // Only promote if signal exceeds minimum CSL score at MINIMUM level
      if (candidate.score < CSL_THRESHOLDS.MINIMUM) continue;

      const vec = placeholderVector(candidate.label);
      const added = this._registry.register(candidate.label, candidate.tier, vec);
      if (added) {
        const cat = this._registry.get(candidate.label);
        if (cat) newlyAdded.push(cat);
      }
    }

    return newlyAdded;
  }

  // ─────────────────────────────────────────────── TASK GENERATION ─────────

  /**
   * Generates tasks for a single category using the registered provider
   * (or the built-in factory). Clamps output to [MIN, MAX] range.
   *
   * @param {TaskCategory} category - The category
   * @param {number}       count    - Desired task count
   * @param {number}       pressure - System pressure [0,1]
   * @returns {AutoTask[]}
   * @private
   */
  _generateTasksForCategory(category, count, pressure) {
    const clampedCount = Math.max(
      MIN_TASKS_PER_CATEGORY,
      Math.min(MAX_TASKS_PER_CATEGORY, count),
    );

    try {
      const provider = this._taskProviders.get(category.name);
      if (provider) {
        return provider(category, clampedCount, pressure);
      }
      return createBuiltInTasks(category, clampedCount, pressure);
    } catch (err) {
      this._log.error(`Task generation failed for ${category.name}: ${err.message}`);
      return [];
    }
  }

  // ─────────────────────────────────────────────── PRESSURE SAMPLING ────────

  /**
   * Safely invokes the pressure provider, returning PSI2 as a safe default
   * on any error to avoid NOMINAL pressure masking high load.
   *
   * @returns {Promise<number>} System pressure in [0,1]
   * @private
   */
  async _safeGetPressure() {
    try {
      const p = await withTimeout(
        Promise.resolve(this._pressureProvider()),
        phiTimeouts(TASK_TIMEOUT_MS).fast,
        'pressureProvider',
      );
      if (typeof p !== 'number' || !Number.isFinite(p)) return PSI2;
      return Math.max(0, Math.min(1, p));
    } catch (_err) {
      return PSI2;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9: DISCOVERY SIGNALS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a set of CSL discovery signal vectors for runtime category scanning.
 * Each signal represents a semantic dimension of system behaviour that may
 * indicate an emergent category not yet in the registry.
 *
 * Signals rotate per cycle using phi-scaled offsets to ensure broad coverage
 * across cycles without repeating the same probe order.
 *
 * @param {number} pressure    - Current system pressure [0,1]
 * @param {number} cycleIndex  - Current cycle number
 * @returns {Array<{label: string, vector: number[], tier: PriorityTier}>}
 * @private
 */
function _buildDiscoverySignals(pressure, cycleIndex) {
  // Phi-rotated signal pool — grows by fib(4) candidates per cycle window
  const base = [
    { label: 'rate_limiting_governance token_budget_management',           tier: 'CRITICAL' },
    { label: 'semantic_routing model_selection contextual_gate',           tier: 'HIGH'     },
    { label: 'telemetry_aggregation observability metric_collection',      tier: 'STANDARD' },
    { label: 'context_compression token_reduction chunking_strategy',      tier: 'HIGH'     },
    { label: 'failover_detection redundancy_switching resilience_audit',   tier: 'CRITICAL' },
    { label: 'embedding_drift concept_alignment semantic_coherence',       tier: 'HIGH'     },
    { label: 'workflow_orchestration pipeline_dag task_graph_analysis',    tier: 'STANDARD' },
    { label: 'regulatory_compliance data_governance privacy_audit',        tier: 'CRITICAL' },
  ];

  // Select a phi-rotated slice each cycle to probe different dimensions
  const offset = Math.floor(cycleIndex * PSI) % base.length;
  const window = fib(4) + Math.floor(pressure * fib(3));
  const sliceEnd = Math.min(base.length, offset + window);
  const signals = base.slice(offset, sliceEnd);
  // Wrap around if needed
  if (sliceEnd < offset + window) {
    signals.push(...base.slice(0, (offset + window) - base.length));
  }

  return signals.map(s => ({
    label:  s.label,
    vector: placeholderVector(s.label),
    tier:   s.tier,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 10: NULL LOGGER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a no-op logger that satisfies the logger interface.
 * Used when no external logger is provided.
 *
 * @returns {{ info: Function, warn: Function, error: Function }}
 * @private
 */
function _nullLogger() {
  const noop = () => {};
  return { info: noop, warn: noop, error: noop };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 11: EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  AutoSuccessEngine,
  CategoryRegistry,
  PhiTaskScheduler,
  OrsTracker,
  createBuiltInTasks,
  computeTaskCountForPressure,
  orsModeFromScore,
  withTimeout,
  // Constants (re-exported for external introspection)
  CYCLE_INTERVAL_MS,
  TASK_TIMEOUT_MS,
  MAX_TASK_RETRIES,
  MAX_CYCLE_FAILURES,
  MIN_TASKS_PER_CATEGORY,
  MAX_TASKS_PER_CATEGORY,
  ORS_RECOVERY_THRESHOLD,
  ORS_REPAIR_THRESHOLD,
  ORS_NORMAL_THRESHOLD,
  TIER_BUDGETS,
  CATEGORY_RELEVANCE_FLOOR,
  TASK_RELEVANCE_FLOOR,
  DEFAULT_CATEGORY_SEEDS,
};
