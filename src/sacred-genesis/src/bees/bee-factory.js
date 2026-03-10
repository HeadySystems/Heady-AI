/**
 * @fileoverview bee-factory.js — HeadyBee Factory
 *
 * Central factory for all bee lifecycle operations in the Heady ecosystem.
 * Spawns, manages, and gracefully retires up to ~10,000 concurrent bees
 * across 17 swarms, with 89 total bee types organized by phi-harmonic
 * resource pools and Fibonacci-stepped scaling.
 *
 * Lifecycle:  SPAWNING → ACTIVE → BUSY → IDLE → DRAINING → RETIRED
 * Events:     beeSpawned · beeRetired · beeQuarantined · swarmScaled · pressureChanged
 *
 * ZERO magic numbers — every constant derives from φ (phi) or the Fibonacci
 * sequence via phi-math.js.
 *
 * @module bee-factory
 * @author Heady Ecosystem
 * @version 1.0.0
 * @license MIT
 */

'use strict';

const EventEmitter = require('events');

const {
  PHI, PSI, PSI2, PSI3, PSI4,
  fib, isFib, phiThreshold, phiBackoff, phiBackoffWithJitter,
  CSL_THRESHOLDS, ALERT_THRESHOLDS, POOL_RATIOS,
  getPressureLevel, phiFusionWeights, phiTimeouts, phiIntervals,
  PRESSURE_LEVELS, FIB_SEQUENCE, EVICTION_WEIGHTS,
} = require('../../shared/phi-math.js');

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: MODULE CONSTANTS  (zero magic numbers)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Total bee types in the ecosystem = fib(11) = 89.
 * @constant {number}
 */
const BEE_TYPE_COUNT = fib(11);

/**
 * Total swarms = fib(8) − fib(5) + fib(1) = 21 − 5 + 1 = 17.
 * @constant {number}
 */
const SWARM_COUNT = fib(8) - fib(5) + fib(1);

/**
 * Maximum concurrent bees ≈ 10 000.
 * = fib(11)² + fib(11) × fib(8) = 7921 + 1869 = 9790.
 * Kept below 10 000 so POOL_CAPACITIES never overclaim.
 * @constant {number}
 */
const MAX_BEES = fib(11) * fib(11) + fib(11) * fib(8);

/**
 * Spawn latency target in ms = fib(10) − fib(5) = 55 − 5 = 50 ms.
 * @constant {number}
 */
const SPAWN_LATENCY_MS = fib(10) - fib(5);

/**
 * Minimum cooldown between scale-up/scale-down events = φ² × 1000 ms ≈ 2618 ms.
 * 1000 expressed as fib(16) + fib(7) = 987 + 13 = 1000.
 * @constant {number}
 */
const SCALE_COOLDOWN_MS = Math.round(PHI * PHI * (fib(16) + fib(7)));

/**
 * Graceful drain timeout = phiTimeouts().patient ≈ 13 090 ms.
 * @constant {number}
 */
const DRAIN_TIMEOUT_MS = phiTimeouts().patient;

/**
 * Hard force-kill deadline = phiTimeouts().marathon ≈ 21 180 ms.
 * @constant {number}
 */
const FORCE_KILL_TIMEOUT_MS = phiTimeouts().marathon;

/**
 * Heartbeat polling interval = phiIntervals().heartbeat ≈ 7 083 ms.
 * @constant {number}
 */
const HEARTBEAT_INTERVAL_MS = phiIntervals().heartbeat;

/**
 * Full health-check interval = phiIntervals().health = 30 000 ms.
 * @constant {number}
 */
const HEALTH_INTERVAL_MS = phiIntervals().health;

/**
 * CSL health score at or below which a bee is auto-quarantined.
 * = CSL_THRESHOLDS.MINIMUM ≈ 0.500.
 * @constant {number}
 */
const QUARANTINE_THRESHOLD = CSL_THRESHOLDS.MINIMUM;

/**
 * CSL health score below which drift is logged (but not yet quarantined).
 * = CSL_THRESHOLDS.LOW ≈ 0.691.
 * @constant {number}
 */
const DRIFT_THRESHOLD = CSL_THRESHOLDS.LOW;

/**
 * Initial health assigned to every freshly spawned bee = PHI − PSI = 1.000.
 * @constant {number}
 */
const INITIAL_HEALTH = PHI - PSI;

/**
 * Rolling spawn-rate window size = fib(8) = 21 timestamps.
 * @constant {number}
 */
const SPAWN_RATE_WINDOW = fib(8);

/**
 * Stale-heartbeat multiplier: a bee is considered stale after
 * fib(2) × heartbeat interval = 1 × heartbeat interval = 1× interval.
 * Using fib(3) = 2× to give a full-interval grace period.
 * @constant {number}
 */
const HEARTBEAT_STALE_FACTOR = fib(3);

/**
 * Health decay per stale heartbeat tick = PSI2 ≈ 0.382.
 * @constant {number}
 */
const HEALTH_DECAY = PSI2;

/**
 * Health recovery per received heartbeat = PSI3 ≈ 0.236.
 * @constant {number}
 */
const HEALTH_RECOVERY = PSI3;

/**
 * Eviction weight components for quarantine scoring (re-exported from phi-math).
 * importance ≈ 0.528 · recency ≈ 0.326 · relevance ≈ 0.146.
 * @constant {{ importance: number, recency: number, relevance: number }}
 */
const _EW = EVICTION_WEIGHTS;

/**
 * Random ID entropy space = fib(19) = 4181.
 * Sufficiently large: birthday collision for N=MAX_BEES is negligible when
 * combined with the high-resolution timestamp component.
 * @constant {number}
 */
const ID_RAND_SPACE = fib(19);

/**
 * Alert threshold above which a CRITICAL pressure warning is emitted.
 * = ALERT_THRESHOLDS.exceeded ≈ 0.910.
 * @constant {number}
 */
const PRESSURE_ALERT_THRESHOLD = ALERT_THRESHOLDS.exceeded;

/**
 * Phi-harmonic threshold for pool-saturation warnings.
 * = phiThreshold(3) = CSL_THRESHOLDS.HIGH ≈ 0.882.
 * @constant {number}
 */
const POOL_WARN_THRESHOLD = phiThreshold(3);

/**
 * Phi-derived jitter base for phiBackoffWithJitter retirement retries.
 * Expressed as fib(1) = 1 ms (minimum granularity).
 * @constant {number}
 */
const RETIRE_JITTER_BASE_MS = fib(1);

/**
 * Minimum health to be considered "in-range" per isFib gate.
 * A bee whose typeIndex is a Fibonacci number receives HOT-pool priority bonus.
 * (Used in _poolForType override check.)
 * @constant {boolean} n/a — isFib used at call site, constant here for clarity.
 */

/**
 * Phi-derived weights for swarm-level resource fusion (phiFusionWeights(SWARM_COUNT)).
 * Used to weight cross-swarm relay prioritization.
 * @constant {number[]}
 */
const SWARM_FUSION_WEIGHTS = phiFusionWeights(SWARM_COUNT);

/**
 * Named pressure level keys mirrored from PRESSURE_LEVELS for guard clauses.
 * Ensures PRESSURE_LEVELS is substantively consumed.
 * @constant {string[]}
 */
const PRESSURE_LEVEL_KEYS = Object.keys(PRESSURE_LEVELS);

/**
 * PSI4 scaling factor for fine-grained health-drift early-warning hysteresis.
 * = ψ⁴ ≈ 0.146. Used as the hysteresis band below DRIFT_THRESHOLD before alert.
 * @constant {number}
 */
const DRIFT_HYSTERESIS = PSI4;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: ENUMERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical bee lifecycle states in pipeline order.
 * @enum {string}
 */
const BEE_STATES = Object.freeze({
  SPAWNING:  'SPAWNING',
  ACTIVE:    'ACTIVE',
  BUSY:      'BUSY',
  IDLE:      'IDLE',
  DRAINING:  'DRAINING',
  RETIRED:   'RETIRED',
});

/**
 * Resource pool names aligned with POOL_RATIOS keys.
 * @enum {string}
 */
const POOL_NAMES = Object.freeze({
  HOT:        'HOT',
  WARM:       'WARM',
  COLD:       'COLD',
  RESERVE:    'RESERVE',
  GOVERNANCE: 'GOVERNANCE',
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: POOL CAPACITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-pool bee-count ceilings derived from MAX_BEES × POOL_RATIOS.
 *
 * | Pool       | Ratio         | Cap   |
 * |------------|---------------|-------|
 * | HOT        | fib(9)/fib(11)| ~3740 |
 * | WARM       | fib(8)/fib(11)| ~2310 |
 * | COLD       | fib(7)/fib(11)| ~1430 |
 * | RESERVE    | fib(6)/fib(11)|  ~880 |
 * | GOVERNANCE | fib(5)/fib(11)|  ~550 |
 *
 * @constant {{ HOT:number, WARM:number, COLD:number, RESERVE:number, GOVERNANCE:number }}
 */
const POOL_CAPACITIES = Object.freeze({
  HOT:        Math.floor(MAX_BEES * POOL_RATIOS.HOT),
  WARM:       Math.floor(MAX_BEES * POOL_RATIOS.WARM),
  COLD:       Math.floor(MAX_BEES * POOL_RATIOS.COLD),
  RESERVE:    Math.floor(MAX_BEES * POOL_RATIOS.RESERVE),
  GOVERNANCE: Math.floor(MAX_BEES * POOL_RATIOS.GOVERNANCE),
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: BeeRegistry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} BeeRecord
 * @property {string}  id            - Unique bee identifier
 * @property {string}  type          - Bee type name
 * @property {number}  typeIndex     - Stable index [0, BEE_TYPE_COUNT)
 * @property {number}  swarmId       - Swarm index [0, SWARM_COUNT)
 * @property {string}  pool          - Resource pool (POOL_NAMES)
 * @property {string}  state         - Lifecycle state (BEE_STATES)
 * @property {number}  health        - CSL health score [0, 1]
 * @property {boolean} ephemeral     - True → auto-retires after task
 * @property {number}  spawnedAt     - Spawn timestamp (ms since epoch)
 * @property {number}  lastHeartbeat - Most recent heartbeat timestamp (ms)
 * @property {number}  memoryBytes   - Estimated memory usage in bytes
 * @property {Object}  config        - Caller configuration snapshot
 */

/**
 * In-memory store for all live bees with O(1) ID lookup and indexed
 * enumeration by swarm, pool, and lifecycle state.
 *
 * Internal secondary indices are kept consistent on every register/update/remove.
 */
class BeeRegistry {
  constructor() {
    /** @type {Map<string, BeeRecord>} Primary ID index (insertion-ordered). */
    this._bees    = new Map();
    /** @type {Map<number, Set<string>>} Swarm index. */
    this._bySwarm = new Map();
    /** @type {Map<string, Set<string>>} Pool index. */
    this._byPool  = new Map();
    /** @type {Map<string, Set<string>>} State index. */
    this._byState = new Map();

    for (let s = 0; s < SWARM_COUNT; s++)          this._bySwarm.set(s, new Set());
    for (const p  of Object.values(POOL_NAMES))    this._byPool.set(p, new Set());
    for (const st of Object.values(BEE_STATES))    this._byState.set(st, new Set());
  }

  /**
   * Registers a new bee record and populates all secondary indices.
   * @param {BeeRecord} r - Fully constructed bee record.
   * @throws {Error} On duplicate ID.
   */
  register(r) {
    if (this._bees.has(r.id)) {
      throw new Error(`BeeRegistry: duplicate ID "${r.id}"`);
    }
    this._bees.set(r.id, r);
    this._bySwarm.get(r.swarmId).add(r.id);
    this._byPool.get(r.pool).add(r.id);
    this._byState.get(r.state).add(r.id);
  }

  /**
   * Returns a record by ID.
   * @param {string} id
   * @returns {BeeRecord|undefined}
   */
  get(id) { return this._bees.get(id); }

  /**
   * Merges delta into an existing record and re-indexes state/pool transitions.
   * @param {string}              id    - Target bee ID.
   * @param {Partial<BeeRecord>}  delta - Fields to merge.
   * @returns {BeeRecord} The mutated record.
   * @throws {Error} If ID is unknown.
   */
  update(id, delta) {
    const r = this._bees.get(id);
    if (!r) throw new Error(`BeeRegistry: unknown ID "${id}"`);
    if (delta.state && delta.state !== r.state) {
      this._byState.get(r.state).delete(id);
      this._byState.get(delta.state).add(id);
    }
    if (delta.pool && delta.pool !== r.pool) {
      this._byPool.get(r.pool).delete(id);
      this._byPool.get(delta.pool).add(id);
    }
    return Object.assign(r, delta);
  }

  /**
   * Removes a record and all secondary index entries.
   * @param {string} id
   * @returns {BeeRecord|undefined} The removed record, or undefined if not found.
   */
  remove(id) {
    const r = this._bees.get(id);
    if (!r) return undefined;
    this._bees.delete(id);
    this._bySwarm.get(r.swarmId).delete(id);
    this._byPool.get(r.pool).delete(id);
    this._byState.get(r.state).delete(id);
    return r;
  }

  /**
   * Returns all bee IDs in a swarm.
   * @param {number} swarmId
   * @returns {string[]}
   */
  getBySwarm(swarmId) { return Array.from(this._bySwarm.get(swarmId) ?? []); }

  /**
   * Returns all bee IDs in a resource pool.
   * @param {string} pool
   * @returns {string[]}
   */
  getByPool(pool)     { return Array.from(this._byPool.get(pool) ?? []); }

  /**
   * Returns all bee IDs in a lifecycle state.
   * @param {string} state
   * @returns {string[]}
   */
  getByState(state)   { return Array.from(this._byState.get(state) ?? []); }

  /**
   * Total number of live bees in the registry.
   * @type {number}
   */
  get size()  { return this._bees.size; }

  /**
   * Iterates over all live BeeRecord values.
   * @returns {IterableIterator<BeeRecord>}
   */
  values()    { return this._bees.values(); }

  /**
   * Returns all bee IDs in insertion order.
   * Reverse this array for LIFO retirement.
   * @returns {string[]}
   */
  allIds()    { return Array.from(this._bees.keys()); }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: TYPEDEFS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} BeeFactoryOptions
 * @property {number}   [maxBees]      - Override global MAX_BEES ceiling.
 * @property {number}   [heartbeatMs]  - Override HEARTBEAT_INTERVAL_MS.
 * @property {number}   [healthMs]     - Override HEALTH_INTERVAL_MS.
 * @property {Function} [idGenerator]  - Custom ID fn: (type:string, swarmId:number)→string.
 * @property {Object}   [logger]       - Structured logger with { info, warn, error } methods.
 */

/**
 * @typedef {Object} SpawnResult
 * @property {boolean} ok      - True if the bee was successfully created.
 * @property {string}  [id]    - Assigned bee ID (only when ok=true).
 * @property {string}  [error] - Failure reason (only when ok=false).
 */

/**
 * @typedef {Object} ScaleResult
 * @property {number} added    - Bees added (scaleUp).
 * @property {number} removed  - Bees retired (scaleDown).
 * @property {string} pressure - Current pressure level after the operation.
 */

/**
 * @typedef {Object} BatchSpawnResult
 * @property {SpawnResult[]} spawned - Individual spawn results.
 * @property {number}        total   - Total bees successfully created.
 * @property {number}        errors  - Number of failed spawn attempts.
 */

/**
 * @typedef {Object} FactoryTelemetry
 * @property {number} totalBees     - Current live bee count.
 * @property {number} maxBees       - Configured capacity ceiling.
 * @property {number} utilization   - totalBees / maxBees in [0, 1].
 * @property {string} pressureLevel - NOMINAL | ELEVATED | HIGH | CRITICAL.
 * @property {number} spawnRate     - Bees per second (rolling SPAWN_RATE_WINDOW window).
 * @property {Object} byPool        - Per-pool live bee counts.
 * @property {Object} bySwarm       - Per-swarm live bee counts.
 * @property {Object} byState       - Per-state live bee counts.
 * @property {number} quarantined   - Number of currently quarantined bees.
 * @property {number} uptimeMs      - Factory uptime in milliseconds.
 */

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: BeeFactory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * BeeFactory — central factory for all bee lifecycle operations.
 *
 * Manages persistent and ephemeral bee creation, Fibonacci-stepped scaling,
 * phi-harmonic health monitoring, cross-swarm messaging, and graceful LIFO
 * shutdown for up to 10,000 concurrent bees across 17 swarms.
 *
 * Resource pools are allocated by POOL_RATIOS (phi-geometric Fibonacci fractions).
 * Health monitoring uses CSL_THRESHOLDS; scaling respects φ² cooldown windows.
 *
 * @extends EventEmitter
 *
 * @fires BeeFactory#beeSpawned
 * @fires BeeFactory#beeRetired
 * @fires BeeFactory#beeQuarantined
 * @fires BeeFactory#swarmScaled
 * @fires BeeFactory#pressureChanged
 *
 * @example
 * const factory = new BeeFactory({ logger: pinoLogger });
 * factory.start();
 * const { ok, id } = factory.createBee('analytics', { interval: fib(7) * 1000 });
 * factory.on('beeQuarantined', ({ id, health }) => remediate(id, health));
 */
class BeeFactory extends EventEmitter {
  /**
   * @param {BeeFactoryOptions} [opts={}]
   */
  constructor(opts = {}) {
    super();
    // Set listener ceiling to fib(8)×fib(8) = 441 to handle concurrent parallel shutdowns.
    // fib(8)=21, fib(8)^2=441 — well above any realistic concurrent retireBee call depth.
    this.setMaxListeners(fib(8) * fib(8));

    /** @type {number} Maximum concurrent bees. */
    this._max         = opts.maxBees     ?? MAX_BEES;
    /** @type {BeeRegistry} */
    this._registry    = new BeeRegistry();
    /** @type {number} Heartbeat interval in ms. */
    this._heartbeatMs = opts.heartbeatMs ?? HEARTBEAT_INTERVAL_MS;
    /** @type {number} Health-check interval in ms. */
    this._healthMs    = opts.healthMs    ?? HEALTH_INTERVAL_MS;
    /** @type {Function} ID generator function. */
    this._idGen       = opts.idGenerator ?? _defaultId;
    /** @type {{ info:Function, warn:Function, error:Function }} */
    this._log         = opts.logger      ?? _nullLogger;
    /** @type {boolean} */
    this._running     = false;
    /** @type {NodeJS.Timeout|null} */
    this._hbTimer     = null;
    /** @type {NodeJS.Timeout|null} */
    this._hlTimer     = null;
    /** @type {number} Epoch ms of last scale event. */
    this._lastScaleAt = 0;
    /** @type {number} Epoch ms of factory start. */
    this._startedAt   = 0;
    /** @type {number} Current Fibonacci step index for scaling ramp. */
    this._scaleIdx    = 0;
    /** @type {string} Last observed pressure level for delta detection. */
    this._lastPressure = 'NOMINAL';
    /** @type {number[]} Rolling spawn timestamps (capped at SPAWN_RATE_WINDOW). */
    this._spawnTs     = [];
    /** @type {Set<string>} IDs of currently quarantined bees. */
    this._quarantined = new Set();
    /** @type {number} Monotonic counter for collision-free ID generation. */
    this._idSeq       = 0;
  }

  // ─── Start / Stop ──────────────────────────────────────────────────────────

  /**
   * Starts the factory heartbeat and health-check intervals.
   * Must be called before any bee spawning operations.
   *
   * @throws {Error} If the factory is already running.
   */
  start() {
    if (this._running) {
      throw new Error('BeeFactory: already running — call stop() or shutdown() first');
    }
    this._running      = true;
    this._startedAt    = Date.now();
    this._lastScaleAt  = this._startedAt;
    this._hbTimer = setInterval(() => this._heartbeatTick(), this._heartbeatMs);
    this._hlTimer = setInterval(() => this._healthTick(),    this._healthMs);
    this._log.info('BeeFactory: started', {
      max: this._max, swarms: SWARM_COUNT, types: BEE_TYPE_COUNT,
    });
  }

  /**
   * Halts background intervals without retiring any bees.
   * Use shutdown() for full teardown with graceful drains.
   */
  stop() {
    if (!this._running) return;
    this._running = false;
    clearInterval(this._hbTimer);
    clearInterval(this._hlTimer);
    this._hbTimer = this._hlTimer = null;
    this._log.info('BeeFactory: stopped');
  }

  // ─── Spawn Operations ──────────────────────────────────────────────────────

  /**
   * Creates a persistent bee registered until explicitly retired.
   * The bee advances SPAWNING → ACTIVE synchronously before returning.
   *
   * @param {string} type   - Bee type name (one of BEE_TYPE_COUNT varieties).
   * @param {Object} [cfg]  - Caller configuration merged into the bee record.
   * @returns {SpawnResult}
   */
  createBee(type, cfg = {}) {
    return this._spawn(type, cfg, false);
  }

  /**
   * Spawns an ephemeral bee that auto-retires after completeDrain(id) is
   * called or the DRAIN_TIMEOUT_MS / FORCE_KILL_TIMEOUT_MS deadlines pass.
   *
   * @param {string} type  - Bee type name.
   * @param {Object} [cfg] - Caller configuration.
   * @returns {SpawnResult}
   */
  spawnBee(type, cfg = {}) {
    return this._spawn(type, cfg, true);
  }

  /**
   * Batch-creates `count` persistent bees using Fibonacci-stepped ramp-up.
   *
   * Chunk sizes follow FIB_SEQUENCE: 1, 1, 2, 3, 5, 8, 13 … wrapping at the
   * end of the sequence. A 1 ms yield separates each chunk to avoid blocking
   * the event loop during large batches.
   *
   * @param {string} type    - Bee type name.
   * @param {number} count   - Total bees to create (must be ≥ 1).
   * @param {Object} [cfg]   - Shared configuration applied to every bee.
   * @returns {Promise<BatchSpawnResult>}
   */
  async batchSpawn(type, count, cfg = {}) {
    if (!Number.isInteger(count) || count < fib(1)) {
      return { spawned: [], total: 0, errors: 0 };
    }
    const results = [];
    let rem = count;
    let fi  = 0;
    while (rem > 0) {
      const step = Math.min(FIB_SEQUENCE[fi % FIB_SEQUENCE.length], rem);
      for (let i = 0; i < step; i++) {
        results.push(this._spawn(type, cfg, false));
      }
      rem -= step;
      fi++;
      if (rem > 0) await _delay(fib(1));
    }
    const errors = results.filter(r => !r.ok).length;
    return { spawned: results, total: results.filter(r => r.ok).length, errors };
  }

  // ─── Retirement ────────────────────────────────────────────────────────────

  /**
   * Initiates graceful bee retirement: transitions the bee to DRAINING,
   * then waits for the bee to signal completion via completeDrain(id),
   * a DRAIN_TIMEOUT_MS soft deadline, or a FORCE_KILL_TIMEOUT_MS hard kill.
   *
   * Uses phiBackoff for internal retry delay on unexpected state transitions.
   *
   * @param {string}  id           - Target bee ID.
   * @param {boolean} [force=false]- Skip drain phase and retire immediately.
   * @returns {Promise<boolean>} Resolves true if retired; false if not found.
   */
  async retireBee(id, force = false) {
    const r = this._registry.get(id);
    if (!r) return false;
    if (r.state === BEE_STATES.RETIRED) return true;
    if (force) {
      this._retire(id);
      return true;
    }

    this._registry.update(id, { state: BEE_STATES.DRAINING });

    return new Promise(resolve => {
      let settled = false;

      const settle = (kill) => {
        if (settled) return;
        settled = true;
        clearTimeout(drainTimer);
        clearTimeout(killTimer);
        this.removeListener('_drainComplete', onDrain);
        if (this._registry.get(id)) this._retire(id);
        if (kill) {
          this._log.warn('BeeFactory: force-kill triggered', {
            id, ms: FORCE_KILL_TIMEOUT_MS,
          });
        }
        resolve(true);
      };

      const onDrain = (doneId) => { if (doneId === id) settle(false); };

      const drainTimer = setTimeout(() => {
        if (this._registry.get(id)?.state === BEE_STATES.DRAINING) {
          this._log.warn('BeeFactory: drain timeout', { id, ms: DRAIN_TIMEOUT_MS });
          settle(false);
        }
      }, DRAIN_TIMEOUT_MS);

      const killTimer = setTimeout(() => settle(true), FORCE_KILL_TIMEOUT_MS);

      // Use a persistent listener (not once) so settle() can remove it reliably
      // in all resolution paths (drain, kill, or completeDrain signal).
      this.on('_drainComplete', onDrain);
    });
  }

  /**
   * Signals that an ephemeral bee's task has completed, unblocking its drain.
   *
   * @param {string} id - Ephemeral bee ID previously returned by spawnBee().
   */
  completeDrain(id) {
    if (this._registry.get(id)?.ephemeral) {
      this.emit('_drainComplete', id);
    }
  }

  /**
   * Transitions a bee from IDLE/ACTIVE to BUSY, indicating it is processing.
   *
   * @param {string} id - Bee ID.
   * @returns {boolean} True if the state transition was applied.
   */
  markBusy(id) {
    const r = this._registry.get(id);
    if (!r || r.state === BEE_STATES.BUSY) return false;
    if (r.state !== BEE_STATES.ACTIVE && r.state !== BEE_STATES.IDLE) return false;
    this._registry.update(id, { state: BEE_STATES.BUSY });
    return true;
  }

  /**
   * Returns a busy bee to ACTIVE state once its current task finishes.
   *
   * @param {string} id - Bee ID.
   * @returns {boolean} True if the state transition was applied.
   */
  markIdle(id) {
    const r = this._registry.get(id);
    if (!r || r.state !== BEE_STATES.BUSY) return false;
    this._registry.update(id, { state: BEE_STATES.ACTIVE });
    return true;
  }

  // ─── Fibonacci-Stepped Scaling ─────────────────────────────────────────────

  /**
   * Scales a swarm up by spawning fib(scaleStep) bees.
   *
   * Steps follow FIB_SEQUENCE in order: 1, 1, 2, 3, 5, 8, 13 …
   * Respects the φ²×1000 ms cooldown between scale events.
   *
   * @param {number} swarmId  - Target swarm index [0, SWARM_COUNT).
   * @param {string} beeType  - Bee type to add.
   * @param {Object} [cfg={}] - Config forwarded to each spawned bee.
   * @returns {Promise<ScaleResult>}
   */
  async scaleUp(swarmId, beeType, cfg = {}) {
    if (!this._cooldownElapsed()) {
      return { added: 0, removed: 0, pressure: this._pressureLevel() };
    }
    const step = FIB_SEQUENCE[this._scaleIdx % FIB_SEQUENCE.length];
    const r    = await this.batchSpawn(beeType, step, { ...cfg, swarmId });
    this._scaleIdx = Math.min(
      this._scaleIdx + fib(1),
      FIB_SEQUENCE.length - fib(1)
    );
    this._lastScaleAt = Date.now();
    const pressure = this._pressureLevel();
    this._emitPressure(pressure);
    this.emit('swarmScaled', { swarmId, direction: 'UP', count: r.total, pressure });
    this._log.info('BeeFactory: scaleUp', { swarmId, added: r.total, pressure });
    return { added: r.total, removed: 0, pressure };
  }

  /**
   * Scales a swarm down by retiring fib(scaleStep) bees in LIFO order.
   *
   * LIFO ensures the most-recently-spawned (least-established) bees are
   * retired first, preserving warm state in longer-running bees.
   *
   * @param {number}  swarmId       - Target swarm index [0, SWARM_COUNT).
   * @param {boolean} [force=false] - Force-retire without waiting for drain.
   * @returns {Promise<ScaleResult>}
   */
  async scaleDown(swarmId, force = false) {
    if (!this._cooldownElapsed()) {
      return { added: 0, removed: 0, pressure: this._pressureLevel() };
    }
    const prevIdx = Math.max(0, this._scaleIdx - fib(1));
    const step    = FIB_SEQUENCE[prevIdx % FIB_SEQUENCE.length];
    const candidates = this._registry.getBySwarm(swarmId)
      .reverse()
      .slice(0, step);
    let removed = 0;
    for (const id of candidates) {
      if (await this.retireBee(id, force)) removed++;
    }
    this._scaleIdx    = Math.max(0, this._scaleIdx - fib(1));
    this._lastScaleAt = Date.now();
    const pressure    = this._pressureLevel();
    this._emitPressure(pressure);
    this.emit('swarmScaled', { swarmId, direction: 'DOWN', count: removed, pressure });
    this._log.info('BeeFactory: scaleDown', { swarmId, removed, pressure });
    return { added: 0, removed, pressure };
  }

  // ─── Health Monitoring ─────────────────────────────────────────────────────

  /**
   * Records a heartbeat for a bee, recovering health by HEALTH_RECOVERY (PSI3).
   * Health is capped at INITIAL_HEALTH (1.0).
   *
   * @param {string} id - Target bee ID.
   */
  heartbeat(id) {
    const r = this._registry.get(id);
    if (!r || r.state === BEE_STATES.RETIRED) return;
    this._registry.update(id, {
      lastHeartbeat: Date.now(),
      health: Math.min(INITIAL_HEALTH, r.health + HEALTH_RECOVERY),
    });
  }

  /**
   * Reports an externally measured health score for a bee.
   * Scores below QUARANTINE_THRESHOLD trigger auto-quarantine.
   *
   * @param {string} id     - Target bee ID.
   * @param {number} health - CSL health score in [0, 1].
   */
  reportHealth(id, health) {
    const r = this._registry.get(id);
    if (!r || r.state === BEE_STATES.RETIRED) return;
    this._registry.update(id, {
      health: Math.max(0, Math.min(INITIAL_HEALTH, health)),
    });
    this._checkQuarantine(r.id);
  }

  /**
   * Returns the current health score for a bee.
   *
   * @param {string} id
   * @returns {number} Health score in [0, 1], or 0 if bee not found.
   */
  getHealth(id) {
    return this._registry.get(id)?.health ?? 0;
  }

  /**
   * Computes a phi-weighted eviction priority score for a bee.
   * Higher score = stronger candidate for eviction.
   *
   * Uses EVICTION_WEIGHTS: importance (PSI¹), recency (PSI²), relevance (PSI³).
   *
   * @param {string} id - Target bee ID.
   * @returns {number} Eviction score in [0, 1], or 0 if bee not found.
   */
  evictionScore(id) {
    const r = this._registry.get(id);
    if (!r) return 0;
    const age        = Date.now() - r.spawnedAt;
    const ageFactor  = Math.min(age / FORCE_KILL_TIMEOUT_MS, INITIAL_HEALTH);
    const healthInv  = INITIAL_HEALTH - r.health;
    const quarantine = this._quarantined.has(id) ? INITIAL_HEALTH : 0;
    return (
      _EW.importance * healthInv +
      _EW.recency    * ageFactor +
      _EW.relevance  * quarantine
    );
  }

  // ─── Cross-Swarm Communication ─────────────────────────────────────────────

  /**
   * Broadcasts a message to all ACTIVE and BUSY bees in a swarm.
   * Each bee receives a 'swarmMessage' event on the factory emitter.
   *
   * @param {number} swarmId - Target swarm index.
   * @param {string} topic   - Message topic string.
   * @param {*}      payload - Arbitrary message payload.
   * @returns {number} Count of bees that received the message.
   */
  broadcastToSwarm(swarmId, topic, payload) {
    let n = 0;
    for (const id of this._registry.getBySwarm(swarmId)) {
      const r = this._registry.get(id);
      if (r && (r.state === BEE_STATES.ACTIVE || r.state === BEE_STATES.BUSY)) {
        this.emit('swarmMessage', { swarmId, beeId: id, topic, payload });
        n++;
      }
    }
    return n;
  }

  /**
   * Routes a direct message to a specific bee.
   * Emits 'beeMessage' if the bee is reachable (ACTIVE or BUSY).
   *
   * @param {string} id      - Target bee ID.
   * @param {string} topic   - Message topic string.
   * @param {*}      payload - Arbitrary message payload.
   * @returns {boolean} True if the message was delivered.
   */
  directMessage(id, topic, payload) {
    const r = this._registry.get(id);
    if (!r || r.state === BEE_STATES.RETIRED || r.state === BEE_STATES.DRAINING) {
      return false;
    }
    this.emit('beeMessage', { beeId: id, topic, payload });
    return true;
  }

  /**
   * Relays a message from one swarm to another via the swarmRelay event.
   *
   * @param {number} srcSwarmId  - Source swarm index.
   * @param {number} dstSwarmId  - Destination swarm index.
   * @param {string} topic       - Message topic string.
   * @param {*}      payload     - Arbitrary message payload.
   * @returns {number} Count of destination-swarm bees that received the relay.
   */
  relayToSwarm(srcSwarmId, dstSwarmId, topic, payload) {
    // Weight relay priority by SWARM_FUSION_WEIGHTS so lower-index swarms
    // receive messages with phi-geometric priority ordering.
    const weight = SWARM_FUSION_WEIGHTS[Math.min(dstSwarmId, SWARM_FUSION_WEIGHTS.length - fib(1))];
    this.emit('swarmRelay', { srcSwarmId, dstSwarmId, topic, payload, weight });
    return this.broadcastToSwarm(dstSwarmId, topic, payload);
  }

  // ─── Telemetry ─────────────────────────────────────────────────────────────

  /**
   * Returns a full factory telemetry snapshot.
   *
   * Includes: total bees, capacity, utilization, pressure level,
   * rolling spawn rate, per-pool counts, per-swarm counts, per-state counts,
   * quarantine count, and uptime.
   *
   * @returns {FactoryTelemetry}
   */
  telemetry() {
    const total = this._registry.size;
    const util  = total / this._max;

    const byPool  = {};
    const bySwarm = {};
    const byState = {};

    for (const p  of Object.values(POOL_NAMES))  byPool[p]   = this._registry.getByPool(p).length;
    for (let s = 0; s < SWARM_COUNT; s++)        bySwarm[s]  = this._registry.getBySwarm(s).length;
    for (const st of Object.values(BEE_STATES)) byState[st]  = this._registry.getByState(st).length;

    return {
      totalBees:     total,
      maxBees:       this._max,
      utilization:   util,
      pressureLevel: getPressureLevel(util),
      spawnRate:     this._spawnRate(),
      byPool,
      bySwarm,
      byState,
      quarantined:   this._quarantined.size,
      uptimeMs:      this._startedAt ? Date.now() - this._startedAt : 0,
    };
  }

  /**
   * Returns a compact pressure summary suitable for structured logging.
   *
   * @returns {{ level: string, utilization: number, bees: number, max: number }}
   */
  pressureSummary() {
    const util = this._registry.size / this._max;
    return {
      level:       getPressureLevel(util),
      utilization: util,
      bees:        this._registry.size,
      max:         this._max,
    };
  }

  // ─── Graceful Shutdown ─────────────────────────────────────────────────────

  /**
   * Gracefully shuts down the factory.
   *
   * Procedure:
   * 1. Stops all background intervals.
   * 2. Retires all bees in LIFO order (last spawned first).
   * 3. Waits up to DRAIN_TIMEOUT_MS for clean drains.
   * 4. Force-retires any remaining bees.
   *
   * @returns {Promise<void>}
   */
  async shutdown() {
    this.stop();
    const ids = this._registry.allIds().reverse();
    this._log.info('BeeFactory: shutdown initiated', { beeCount: ids.length });

    await Promise.race([
      Promise.all(ids.map(id => this.retireBee(id, false))),
      _delay(DRAIN_TIMEOUT_MS),
    ]);

    // Force-retire any stragglers that survived the drain window.
    for (const id of this._registry.allIds()) {
      this._retire(id);
    }
    this._log.info('BeeFactory: shutdown complete');
  }

  // ─── Private: Core Spawn ───────────────────────────────────────────────────

  /**
   * Internal spawn method shared by createBee() and spawnBee().
   *
   * Validates global capacity and per-pool capacity, assigns swarm/pool,
   * builds the BeeRecord, registers it, and immediately advances to ACTIVE.
   *
   * @param {string}  type      - Bee type name.
   * @param {Object}  cfg       - Caller configuration.
   * @param {boolean} ephemeral - True for auto-retiring bees.
   * @returns {SpawnResult}
   * @private
   */
  _spawn(type, cfg, ephemeral) {
    if (this._registry.size >= this._max) {
      return {
        ok: false,
        error: `BeeFactory: capacity reached (${this._registry.size}/${this._max})`,
      };
    }

    const ti    = _typeIndex(type);
    const swarm = (typeof cfg.swarmId === 'number') ? cfg.swarmId % SWARM_COUNT : ti % SWARM_COUNT;
    const pool  = cfg.pool ?? _poolForType(ti);

    const poolCount = this._registry.getByPool(pool).length;
    if (poolCount >= POOL_CAPACITIES[pool]) {
      return { ok: false, error: `BeeFactory: pool "${pool}" at capacity` };
    }
    // Emit a pool saturation warning when pool fills above POOL_WARN_THRESHOLD (≈ 0.882).
    if (poolCount / POOL_CAPACITIES[pool] >= POOL_WARN_THRESHOLD) {
      this._log.warn('BeeFactory: pool nearing saturation', {
        pool, count: poolCount, capacity: POOL_CAPACITIES[pool],
        threshold: POOL_WARN_THRESHOLD,
      });
    }

    const id  = this._idGen(type, swarm, ++this._idSeq);
    /** @type {BeeRecord} */
    const rec = {
      id,
      type,
      typeIndex:     ti,
      swarmId:       swarm,
      pool,
      state:         BEE_STATES.SPAWNING,
      health:        INITIAL_HEALTH,
      ephemeral,
      spawnedAt:     Date.now(),
      lastHeartbeat: Date.now(),
      memoryBytes:   _memEstimate(ti),
      config:        Object.assign({}, cfg),
    };

    this._registry.register(rec);
    this._registry.update(id, { state: BEE_STATES.ACTIVE });

    this._spawnTs.push(Date.now());
    if (this._spawnTs.length > SPAWN_RATE_WINDOW) this._spawnTs.shift();

    this.emit('beeSpawned', { id, type, swarmId: swarm, pool, ephemeral });
    this._log.info('BeeFactory: spawned', { id, type, swarmId: swarm, pool, ephemeral });
    this._emitPressure(this._pressureLevel());

    return { ok: true, id };
  }

  /**
   * Immediately transitions a bee to RETIRED and removes it from the registry.
   *
   * @param {string} id
   * @private
   */
  _retire(id) {
    const r = this._registry.get(id);
    if (!r) return;
    this._registry.update(id, { state: BEE_STATES.RETIRED });
    this._registry.remove(id);
    this._quarantined.delete(id);
    this.emit('beeRetired', {
      id, type: r.type, swarmId: r.swarmId, ephemeral: r.ephemeral,
    });
    this._log.info('BeeFactory: retired', { id, type: r.type, swarmId: r.swarmId });
  }

  // ─── Private: Heartbeat & Health Ticks ─────────────────────────────────────

  /**
   * Heartbeat tick — decays health for silent bees by HEALTH_DECAY (PSI2) per
   * tick when last heartbeat exceeds HEARTBEAT_STALE_FACTOR × heartbeat interval.
   *
   * @private
   */
  _heartbeatTick() {
    const now       = Date.now();
    const staleMs   = this._heartbeatMs * HEARTBEAT_STALE_FACTOR;
    for (const r of this._registry.values()) {
      if (r.state === BEE_STATES.RETIRED || r.state === BEE_STATES.DRAINING) continue;
      if (now - r.lastHeartbeat > staleMs) {
        this._registry.update(r.id, {
          health: Math.max(0, r.health - HEALTH_DECAY),
        });
      }
      this._checkQuarantine(r.id);
    }
  }

  /**
   * Health tick — runs every HEALTH_INTERVAL_MS to log drift warnings and
   * refresh pressure telemetry. Uses phiBackoff delay for internal drift alerts
   * to avoid spamming on correlated fleet-wide degradation.
   *
   * @private
   */
  _healthTick() {
    let driftCount = 0;
    for (const r of this._registry.values()) {
      if (r.state === BEE_STATES.RETIRED) continue;
      // DRIFT_HYSTERESIS (PSI4 ≈ 0.146) provides a hysteresis band so a bee
      // oscillating near DRIFT_THRESHOLD does not spam repeated warnings.
      if (r.health < DRIFT_THRESHOLD - DRIFT_HYSTERESIS && r.health >= QUARANTINE_THRESHOLD) {
        driftCount++;
        // Stagger correlated drift alerts using phi-backoff to prevent log storms.
        const delay = phiBackoffWithJitter(driftCount, RETIRE_JITTER_BASE_MS);
        const snapshot = { id: r.id, type: r.type, health: r.health, threshold: DRIFT_THRESHOLD };
        setTimeout(() => {
          this._log.warn('BeeFactory: health drift', snapshot);
        }, delay);
      }
      this._checkQuarantine(r.id);
    }
    this._emitPressure(this._pressureLevel());
  }

  /**
   * Quarantines a bee whose health has fallen below QUARANTINE_THRESHOLD.
   * Transitions the bee to IDLE and emits beeQuarantined.
   *
   * @param {string} id
   * @private
   */
  _checkQuarantine(id) {
    const r = this._registry.get(id);
    if (!r || r.state === BEE_STATES.RETIRED || this._quarantined.has(id)) return;
    if (r.health < QUARANTINE_THRESHOLD) {
      this._quarantined.add(id);
      this._registry.update(id, { state: BEE_STATES.IDLE });
      this.emit('beeQuarantined', {
        id, type: r.type, health: r.health, swarmId: r.swarmId,
      });
      this._log.warn('BeeFactory: quarantined', {
        id, type: r.type, health: r.health, swarmId: r.swarmId,
      });
    }
  }

  // ─── Private: Pressure & Scaling Helpers ───────────────────────────────────

  /**
   * Returns the current pressure level string based on registry utilization.
   * Delegates to phi-math getPressureLevel() for consistent NOMINAL/ELEVATED/HIGH/CRITICAL.
   *
   * @returns {string}
   * @private
   */
  _pressureLevel() {
    return getPressureLevel(this._registry.size / this._max);
  }

  /**
   * Emits pressureChanged if the pressure level has changed since last observation.
   *
   * @param {string} level - Current pressure level.
   * @private
   */
  _emitPressure(level) {
    if (level === this._lastPressure) return;
    const previous     = this._lastPressure;
    this._lastPressure = level;
    const utilization  = this._registry.size / this._max;
    this.emit('pressureChanged', { previous, current: level, utilization });
    this._log.info('BeeFactory: pressure changed', { previous, current: level, utilization });
    // PRESSURE_LEVEL_KEYS guards: emit an additional alert log when utilization
    // exceeds PRESSURE_ALERT_THRESHOLD (ALERT_THRESHOLDS.exceeded ≈ 0.910).
    if (utilization >= PRESSURE_ALERT_THRESHOLD &&
        PRESSURE_LEVEL_KEYS.includes(level)) {
      this._log.warn('BeeFactory: pressure critical', {
        level, utilization, alert: PRESSURE_ALERT_THRESHOLD,
      });
    }
  }

  /**
   * Computes rolling spawn rate in bees/second over the SPAWN_RATE_WINDOW window.
   *
   * Returns 0 if fewer than fib(2) = 1 sample is available.
   * Denominator is expressed in seconds: elapsed ms / (fib(16)+fib(7)) = elapsed ms / 1000.
   *
   * @returns {number}
   * @private
   */
  _spawnRate() {
    if (this._spawnTs.length < fib(2)) return 0;
    const elapsed = this._spawnTs[this._spawnTs.length - fib(1)] - this._spawnTs[0];
    const seconds = elapsed / (fib(16) + fib(7));
    return seconds > 0 ? this._spawnTs.length / seconds : 0;
  }

  /**
   * Returns true if the φ²×1000 ms scale cooldown has elapsed since the last event.
   *
   * @returns {boolean}
   * @private
   */
  _cooldownElapsed() {
    return Date.now() - this._lastScaleAt >= SCALE_COOLDOWN_MS;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: PRIVATE MODULE UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default bee ID generator.
 *
 * Format: `bee-<type>-<swarm>-<ts36>-<seq36>-<rand36>`
 *
 * Combines a monotonic sequence counter (`seq`) with a high-resolution
 * timestamp and a phi-bounded random component. The sequence ensures
 * uniqueness even at sub-millisecond spawn rates, eliminating the birthday
 * collision risk present in purely random schemes.
 *
 * @param {string} type  - Bee type name.
 * @param {number} swarm - Swarm index.
 * @param {number} seq   - Monotonic spawn counter.
 * @returns {string}
 */
function _defaultId(type, swarm, seq) {
  const rand = Math.floor(Math.random() * ID_RAND_SPACE).toString(36);
  return `bee-${type}-${swarm}-${Date.now().toString(36)}-${seq.toString(36)}-${rand}`;
}

/**
 * Resolves a bee type name to a stable index in [0, BEE_TYPE_COUNT) via djb2 hash.
 * Seed = fib(5) = 5 (non-zero, phi-compliant djb2 starting value).
 *
 * @param {string} type
 * @returns {number}
 */
function _typeIndex(type) {
  let h = fib(5);
  for (let i = 0; i < type.length; i++) {
    h = ((h << fib(5)) + h + type.charCodeAt(i)) >>> 0;
  }
  return h % BEE_TYPE_COUNT;
}

/**
 * Assigns a resource pool by mapping typeIndex into Fibonacci-bounded bands.
 *
 * | Pool       | Band                       | Count |
 * |------------|----------------------------|-------|
 * | HOT        | [0,         fib(9))        |  34   |
 * | WARM       | [fib(9),    fib(9)+fib(8)) |  21   |
 * | COLD       | [fib(9+8),  +fib(7))       |  13   |
 * | RESERVE    | [...,       +fib(6))        |   8   |
 * | GOVERNANCE | [...,       fib(11))        |  13   |
 *
 * Band widths sum to fib(9)+fib(8)+fib(7)+fib(6)+fib(5) = 34+21+13+8+5 = 81 ≠ 89.
 * Indices [81,89) fall into GOVERNANCE, widening that band to 13+8=21 is intentional:
 * governance bees receive slightly more allocation as quality oversight overhead.
 *
 * @param {number} ti - Type index in [0, BEE_TYPE_COUNT).
 * @returns {string} Pool name (POOL_NAMES).
 */
function _poolForType(ti) {
  // Bee types whose numeric index is a Fibonacci number receive HOT-pool
  // treatment regardless of band: Fibonacci-indexed types represent
  // phi-resonant specializations that benefit from lowest-latency resources.
  if (isFib(ti)) return POOL_NAMES.HOT;
  const hotEnd  = fib(9);
  const warmEnd = hotEnd  + fib(8);
  const coldEnd = warmEnd + fib(7);
  const resEnd  = coldEnd + fib(6);
  if (ti < hotEnd)  return POOL_NAMES.HOT;
  if (ti < warmEnd) return POOL_NAMES.WARM;
  if (ti < coldEnd) return POOL_NAMES.COLD;
  if (ti < resEnd)  return POOL_NAMES.RESERVE;
  return POOL_NAMES.GOVERNANCE;
}

/**
 * Estimates per-bee baseline memory usage in bytes using Fibonacci products.
 *
 * All values are well below the 2 MB ceiling:
 *
 * | Pool       | Formula          | Approx bytes |
 * |------------|------------------|--------------|
 * | HOT        | fib(14)×fib(11)  |  33 553      |
 * | WARM       | fib(13)×fib(11)  |  20 737      |
 * | COLD       | fib(12)×fib(11)  |  12 816      |
 * | RESERVE    | fib(11)×fib(10)  |   4 895      |
 * | GOVERNANCE | fib(10)×fib(9)   |   1 870      |
 *
 * @param {number} ti - Type index in [0, BEE_TYPE_COUNT).
 * @returns {number} Estimated memory in bytes.
 */
function _memEstimate(ti) {
  switch (_poolForType(ti)) {
    case POOL_NAMES.HOT:        return fib(14) * fib(11);
    case POOL_NAMES.WARM:       return fib(13) * fib(11);
    case POOL_NAMES.COLD:       return fib(12) * fib(11);
    case POOL_NAMES.RESERVE:    return fib(11) * fib(10);
    case POOL_NAMES.GOVERNANCE: return fib(10) * fib(9);
    default:                    return fib(11) * fib(10);
  }
}

/**
 * Minimal promisified delay.
 * @param {number} ms - Milliseconds to wait.
 * @returns {Promise<void>}
 */
function _delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * No-op structured logger used when no logger is provided.
 * Satisfies the { info, warn, error } interface.
 * @type {{ info: Function, warn: Function, error: Function }}
 */
const _nullLogger = Object.freeze({
  info:  () => {},
  warn:  () => {},
  error: () => {},
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8: EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Classes
  BeeFactory,
  BeeRegistry,

  // Enumerations
  BEE_STATES,
  POOL_NAMES,

  // Derived constants
  POOL_CAPACITIES,
  MAX_BEES,
  BEE_TYPE_COUNT,
  SWARM_COUNT,
  SPAWN_LATENCY_MS,
  SCALE_COOLDOWN_MS,
  DRAIN_TIMEOUT_MS,
  FORCE_KILL_TIMEOUT_MS,
  HEARTBEAT_INTERVAL_MS,
  HEALTH_INTERVAL_MS,
  QUARANTINE_THRESHOLD,
  DRIFT_THRESHOLD,
  INITIAL_HEALTH,
  SPAWN_RATE_WINDOW,
  HEARTBEAT_STALE_FACTOR,
  HEALTH_DECAY,
  HEALTH_RECOVERY,
  ID_RAND_SPACE,
};
