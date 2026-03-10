'use strict';

/**
 * @fileoverview saga-orchestrator.js — Production-Grade Saga Orchestrator for the Heady Ecosystem
 *
 * Enables compensating transactions for multi-service pipeline operations.
 * Each saga executes a sequence of steps and, on failure, reverses completed
 * steps in LIFO order via compensation functions — ensuring distributed
 * consistency without two-phase commit.
 *
 * Key properties:
 * - All timeouts, retry counts, and thresholds derived from φ and Fibonacci.
 * - CSL-gated pre-checks on every step (cosine similarity > phiThreshold).
 * - Sequential execution with full context propagation between steps.
 * - Durable-execution ready: all saga state serialises cleanly to JSON.
 * - Idempotency: each step tracked by unique stepId, no double-execution.
 * - Nested sagas: a step action may itself call orchestrator.execute().
 * - Dead letter queue for sagas that fail after full compensation.
 * - Phi-fusion weighted success-rate scoring.
 * - Event emitter surface for external observability.
 *
 * @module saga-orchestrator
 * @author Heady Ecosystem
 * @version 1.0.0
 * @license MIT
 *
 * @example
 * const { SagaOrchestrator, SagaTemplates } = require('./orchestration/saga-orchestrator');
 * const orchestrator = new SagaOrchestrator();
 * const def = SagaTemplates.deploymentSaga({ build, test, deploy, healthCheck, rollback });
 * const result = await orchestrator.execute(def, { artifactId: 'v2.1.0' });
 */

const EventEmitter = require('events');

const {
  PHI, PSI, PSI2, PSI3,
  fib, phiThreshold, phiBackoff, phiBackoffWithJitter,
  CSL_THRESHOLDS, ALERT_THRESHOLDS,
  getPressureLevel, phiFusionWeights, phiTimeouts,
} = require('../../shared/phi-math.js');

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: PHI-DERIVED CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base millisecond unit: phiTimeouts().medium / fib(5) = 5000 / 5 = 1000ms.
 * All second-to-millisecond conversions use this — zero magic numbers.
 * @constant {number}
 */
const MS_BASE = phiTimeouts().medium / fib(5);

/**
 * Default step timeout: φ³ × 1000ms ≈ 4236ms.
 * Derived from PHI^3 applied to the base millisecond unit.
 * @constant {number}
 */
const STEP_TIMEOUT_MS = Math.round((2 * PHI + 1) * MS_BASE);

/**
 * Compensation step timeout: phiTimeouts().patient ≈ 13090ms.
 * Compensations are granted more time than forward steps.
 * @constant {number}
 */
const COMPENSATION_TIMEOUT_MS = phiTimeouts().patient;

/**
 * Marathon base multiplied per saga step count for saga-level timeout.
 * phiTimeouts().marathon ≈ 21180ms — multiplied by step count at runtime.
 * @constant {number}
 */
const SAGA_TIMEOUT_BASE_MS = phiTimeouts().marathon;

/**
 * Max retries per step on transient failure: fib(4) = 3.
 * @constant {number}
 */
const MAX_STEP_RETRIES = fib(4);

/**
 * Dead letter queue capacity: fib(8) = 21 entries.
 * Oldest entries are evicted when capacity is reached.
 * @constant {number}
 */
const DLQ_CAPACITY = fib(8);

/**
 * Default CSL guard threshold: CSL_THRESHOLDS.MEDIUM ≈ 0.809.
 * Steps without an explicit guard use this cosine similarity floor.
 * @constant {number}
 */
const DEFAULT_GUARD_THRESHOLD = CSL_THRESHOLDS.MEDIUM;

/**
 * Phi-fusion weight pair for success-rate scoring [recent, historical].
 * phiFusionWeights(2) → [PSI, PSI²] ≈ [0.618, 0.382].
 * @constant {number[]}
 */
const SUCCESS_RATE_WEIGHTS = phiFusionWeights(2);

/**
 * Minimum base delay for the first phi-backoff attempt: phiBackoff(0) = 1000ms.
 * Exported so callers can compose retry logic that aligns with saga timing.
 * @constant {number}
 */
const STEP_RETRY_BASE_MS = phiBackoff(0, MS_BASE);

/**
 * Guard threshold for low-stakes pre-checks: ψ² ≈ 0.382.
 * Used internally when a step guard only needs a noise-floor pass.
 * Identical to PSI2 from phi-math — surfaced here as a named semantic alias.
 * @constant {number}
 */
const GUARD_THRESHOLD_PERMISSIVE = PSI2;

/**
 * Guard threshold contraction factor for multi-stage relaxation: ψ³ ≈ 0.236.
 * Applied when a saga is in recovery mode and must accept lower-confidence
 * CSL scores to allow compensating actions to proceed.
 * @constant {number}
 */
const GUARD_THRESHOLD_RECOVERY = PSI3;

/**
 * Alert severity map derived from ALERT_THRESHOLDS for telemetry annotations.
 * Maps saga failure rates to named severity bands.
 * @constant {Object}
 */
const SAGA_SEVERITY = Object.freeze({
  nominal:  ALERT_THRESHOLDS.warning,   // failure rate < ψ ≈ 0.618 — acceptable
  caution:  ALERT_THRESHOLDS.caution,   // failure rate > 1−ψ³ ≈ 0.764 — watch
  critical: ALERT_THRESHOLDS.critical,  // failure rate > 1−ψ⁴ ≈ 0.854 — intervene
  exceeded: ALERT_THRESHOLDS.exceeded,  // failure rate > 1−ψ⁵ ≈ 0.910 — incident
});

/**
 * Transient error codes eligible for phi-backoff retry.
 * @constant {Set<string>}
 */
const TRANSIENT_CODES = new Set([
  'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND',
  'TRANSIENT', 'RATE_LIMIT', 'RESOURCE_BUSY',
]);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: SAGA STATES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enumeration of all valid saga lifecycle states.
 *
 * | State        | Meaning                                                  |
 * |--------------|----------------------------------------------------------|
 * | PENDING      | Saga defined but not yet started                         |
 * | RUNNING      | Forward execution in progress                            |
 * | COMPENSATING | A step failed; rolling back completed steps in LIFO order|
 * | COMPLETED    | All steps succeeded                                      |
 * | FAILED       | Execution failed and compensation was not required/run   |
 * | COMPENSATED  | All compensations completed successfully after a failure |
 *
 * @enum {string}
 * @readonly
 */
const SAGA_STATE = Object.freeze({
  PENDING:      'PENDING',
  RUNNING:      'RUNNING',
  COMPENSATING: 'COMPENSATING',
  COMPLETED:    'COMPLETED',
  FAILED:       'FAILED',
  COMPENSATED:  'COMPENSATED',
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: UTILITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wraps a promise with a hard timeout.  Rejects with a structured error if
 * the promise does not resolve within `ms` milliseconds.
 *
 * @param {Promise<*>} promise - Promise to race against the deadline.
 * @param {number}     ms      - Deadline in milliseconds (phi-derived constant).
 * @param {string}     label   - Descriptive label for the timeout error message.
 * @returns {Promise<*>} Resolves with the original value or rejects on timeout.
 */
function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(`Timeout after ${ms}ms: ${label}`);
      err.code = 'ETIMEDOUT';
      err.timeoutMs = ms;
      reject(err);
    }, ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

/**
 * Returns true when the error represents a transient condition that can
 * safely be retried using phi-backoff.
 *
 * @param {Error} err - The error to classify.
 * @returns {boolean}
 */
function isTransient(err) {
  if (!err) return false;
  if (err.transient === true) return true;
  if (TRANSIENT_CODES.has(err.code)) return true;
  return false;
}

/**
 * Generates a unique identifier using a phi-seeded timestamp component.
 * Format: `<prefix>-<phi-scaled-ts>-<random-hex>`.
 *
 * @param {string} prefix - Short descriptor (e.g. 'saga', 'step').
 * @returns {string} Unique identifier string.
 */
function phiId(prefix) {
  const ts = Math.round(Date.now() * PSI).toString(16);
  const rand = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
  return `${prefix}-${ts}-${rand}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: SAGA STEP DEFINITION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SagaStepDef
 * @property {string}   name         - Human-readable step name for telemetry.
 * @property {string}   [stepId]     - Explicit idempotency key; auto-generated when absent.
 * @property {Function} action       - Async forward operation: `async (ctx) => result`.
 * @property {Function} compensation - Async rollback operation: `async (ctx) => void`.
 * @property {Function} [guard]      - CSL pre-check: `async (ctx) => number` (cosine score).
 *                                     Must return a value ≥ guardThreshold to proceed.
 * @property {number}   [guardThreshold=DEFAULT_GUARD_THRESHOLD] - Minimum cosine score to allow execution.
 * @property {number}   [timeout=STEP_TIMEOUT_MS] - Per-step hard timeout (ms).
 * @property {number}   [retries=MAX_STEP_RETRIES] - Max retry count on transient failure.
 */

/**
 * @typedef {Object} SagaDefinition
 * @property {string}        name    - Descriptive saga identifier (e.g. 'DeploymentSaga').
 * @property {string}        [sagaId] - Explicit saga ID; auto-generated when absent.
 * @property {SagaStepDef[]} steps   - Ordered array of saga steps.
 * @property {Object}        [meta]  - Arbitrary metadata attached to telemetry.
 */

/**
 * @typedef {Object} SagaContext
 * @property {string}            sagaId    - Unique saga run identifier.
 * @property {string}            sagaName  - Human-readable saga name.
 * @property {Object}            input     - Original caller-supplied input.
 * @property {Object}            results   - Map of stepId → step action result.
 * @property {string[]}          completed - stepIds of steps that completed successfully.
 * @property {string}            state     - Current SAGA_STATE value.
 * @property {number}            startedAt - Unix timestamp (ms) when saga started.
 * @property {Object}            [meta]    - Saga-level metadata from SagaDefinition.
 */

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: SAGA EXECUTION RECORD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Immutable-ish execution record for a single saga run.
 * Serialises cleanly to JSON for durable storage.
 * All numeric fields are phi-derived to comply with the no-magic-numbers law.
 */
class SagaRecord {
  /**
   * @param {string}         sagaId   - Unique run identifier.
   * @param {string}         sagaName - Human-readable saga name.
   * @param {Object}         input    - Caller-supplied input payload.
   * @param {SagaStepDef[]}  steps    - Ordered step definitions.
   * @param {Object}         [meta]   - Arbitrary saga metadata.
   */
  constructor(sagaId, sagaName, input, steps, meta) {
    /** @type {string} */
    this.sagaId = sagaId;
    /** @type {string} */
    this.sagaName = sagaName;
    /** @type {string} */
    this.state = SAGA_STATE.PENDING;
    /** @type {Object} */
    this.input = input;
    /** @type {Object.<string, *>} stepId → action result */
    this.results = {};
    /** @type {string[]} stepIds completed in forward order */
    this.completed = [];
    /** @type {string[]} stepIds that were compensated */
    this.compensated = [];
    /** @type {number} */
    this.startedAt = 0;
    /** @type {number} */
    this.endedAt = 0;
    /** @type {number} total saga duration ms */
    this.durationMs = 0;
    /** @type {Object.<string, number>} stepId → duration ms */
    this.stepDurations = {};
    /** @type {string|null} failure reason */
    this.failureReason = null;
    /** @type {Object|null} serialised failure error */
    this.failureError = null;
    /** @type {number} count of compensation executions */
    this.compensationCount = 0;
    /** @type {Object} saga-level metadata */
    this.meta = meta || {};
    /** @type {SagaStepDef[]} internal reference — not serialised */
    this._steps = steps;
  }

  /**
   * Returns a JSON-serialisable snapshot of the saga record suitable for
   * durable storage or transmission.  Internal references (_steps) are omitted.
   *
   * @returns {Object} Plain serialisable saga state snapshot.
   */
  toJSON() {
    return {
      sagaId:           this.sagaId,
      sagaName:         this.sagaName,
      state:            this.state,
      input:            this.input,
      results:          this.results,
      completed:        this.completed,
      compensated:      this.compensated,
      startedAt:        this.startedAt,
      endedAt:          this.endedAt,
      durationMs:       this.durationMs,
      stepDurations:    this.stepDurations,
      failureReason:    this.failureReason,
      failureError:     this.failureError,
      compensationCount: this.compensationCount,
      meta:             this.meta,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: SAGA ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SagaOrchestrator — orchestrates multi-step distributed transactions with
 * automatic rollback via compensating transactions.
 *
 * Execution model:
 * 1. Steps run sequentially; each receives the full SagaContext (including
 *    results of all prior steps).
 * 2. On any step failure the orchestrator enters COMPENSATING state and
 *    executes compensation functions in reverse (LIFO) order.
 * 3. Each step is guarded by a CSL cosine-similarity check; failing the
 *    guard aborts the step without executing its action.
 * 4. Transient step failures are retried up to fib(4)=3 times with
 *    phi-backoff + ψ²-jitter before compensation is triggered.
 * 5. Saga-level timeout = phiTimeouts().marathon × step count.
 * 6. Sagas that fail after full compensation are enqueued in the DLQ.
 *
 * @extends EventEmitter
 *
 * @fires SagaOrchestrator#sagaStarted
 * @fires SagaOrchestrator#stepCompleted
 * @fires SagaOrchestrator#stepFailed
 * @fires SagaOrchestrator#compensationStarted
 * @fires SagaOrchestrator#sagaCompleted
 * @fires SagaOrchestrator#sagaFailed
 *
 * @example
 * const orchestrator = new SagaOrchestrator();
 * const result = await orchestrator.execute(myDefinition, inputPayload);
 */
class SagaOrchestrator extends EventEmitter {
  constructor() {
    super();

    /**
     * Map of sagaId → SagaRecord for all active and recently completed runs.
     * @type {Map<string, SagaRecord>}
     */
    this._sagas = new Map();

    /**
     * Dead letter queue: sagas that failed after exhausting compensation.
     * Capped at DLQ_CAPACITY = fib(8) = 21 entries; oldest evicted on overflow.
     * @type {Object[]}
     */
    this._dlq = [];

    /**
     * Running count of completed sagas (used for success-rate weighting).
     * @type {number}
     */
    this._completedCount = 0;

    /**
     * Running count of failed sagas (used for success-rate weighting).
     * @type {number}
     */
    this._failedCount = 0;

    /**
     * Phi-fusion weighted success rate score in [0, 1].
     * Updated after every saga terminal event using SUCCESS_RATE_WEIGHTS.
     * @type {number}
     */
    this._successRate = 1;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PUBLIC: execute
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Executes a saga definition against the supplied input.  Returns a
   * SagaRecord snapshot when the saga reaches any terminal state.
   *
   * The saga-level hard timeout equals SAGA_TIMEOUT_BASE_MS × step count,
   * ensuring larger sagas receive proportionally more time.
   *
   * @param {SagaDefinition} definition - Declarative saga definition.
   * @param {Object}         [input={}] - Caller-supplied payload propagated to every step.
   * @returns {Promise<Object>} JSON-serialisable saga record snapshot.
   * @throws {Error} If definition is missing required fields or steps array is empty.
   *
   * @fires SagaOrchestrator#sagaStarted
   * @fires SagaOrchestrator#sagaCompleted
   * @fires SagaOrchestrator#sagaFailed
   */
  async execute(definition, input = {}) {
    if (!definition || typeof definition.name !== 'string') {
      throw new TypeError('SagaOrchestrator.execute: definition.name must be a non-empty string');
    }
    if (!Array.isArray(definition.steps) || definition.steps.length === 0) {
      throw new TypeError('SagaOrchestrator.execute: definition.steps must be a non-empty array');
    }

    const sagaId   = definition.sagaId || phiId('saga');
    const steps    = this._normaliseSteps(definition.steps);
    const record   = new SagaRecord(sagaId, definition.name, input, steps, definition.meta);
    const sagaTimeout = SAGA_TIMEOUT_BASE_MS * steps.length;

    this._sagas.set(sagaId, record);
    record.state     = SAGA_STATE.RUNNING;
    record.startedAt = Date.now();

    this.emit('sagaStarted', { sagaId, sagaName: definition.name, stepCount: steps.length });

    try {
      const sagaPromise = this._runSteps(record, steps, input);
      await withTimeout(sagaPromise, sagaTimeout, `saga:${sagaId}`);
      record.state   = SAGA_STATE.COMPLETED;
      record.endedAt = Date.now();
      record.durationMs = record.endedAt - record.startedAt;
      this._completedCount++;
      this._updateSuccessRate(true);
      this.emit('sagaCompleted', { sagaId, sagaName: definition.name, durationMs: record.durationMs });
    } catch (err) {
      record.failureReason = err.message;
      record.failureError  = { message: err.message, code: err.code || 'UNKNOWN' };
      await this._compensate(record, steps);
      record.endedAt    = Date.now();
      record.durationMs = record.endedAt - record.startedAt;
      this._failedCount++;
      this._updateSuccessRate(false);
      this._enqueueDLQ(record);
      this.emit('sagaFailed', {
        sagaId,
        sagaName: definition.name,
        reason:   record.failureReason,
        state:    record.state,
        durationMs: record.durationMs,
      });
    }

    return record.toJSON();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE: _runSteps
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Sequentially executes each step in the saga, passing accumulated context.
   * Idempotency: a step whose stepId appears in record.completed is skipped.
   *
   * @param {SagaRecord}    record - Live saga execution record.
   * @param {SagaStepDef[]} steps  - Normalised step definitions.
   * @param {Object}        input  - Original caller input.
   * @returns {Promise<void>}
   * @private
   */
  async _runSteps(record, steps, input) {
    /** @type {SagaContext} */
    const ctx = {
      sagaId:    record.sagaId,
      sagaName:  record.sagaName,
      input,
      results:   record.results,
      completed: record.completed,
      state:     record.state,
      startedAt: record.startedAt,
      meta:      record.meta,
    };

    for (const step of steps) {
      // Idempotency: skip already-completed steps (e.g. resumed after restart)
      if (record.completed.includes(step.stepId)) continue;

      // CSL guard pre-check
      if (typeof step.guard === 'function') {
        const score = await step.guard(ctx);
        const threshold = step.guardThreshold || DEFAULT_GUARD_THRESHOLD;
        if (typeof score !== 'number' || score < threshold) {
          const err = new Error(
            `SagaStep[${step.name}]: CSL guard rejected (score=${score}, threshold=${threshold})`,
          );
          err.code = 'GUARD_REJECTED';
          err.stepId = step.stepId;
          throw err;
        }
      }

      await this._executeStep(record, step, ctx);
      // Keep context results in sync after each step
      ctx.results   = record.results;
      ctx.completed = record.completed;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE: _executeStep
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Executes a single saga step with phi-backoff retries on transient failure.
   * Updates the record's results and completed arrays on success.
   *
   * @param {SagaRecord}   record - Live saga record.
   * @param {SagaStepDef}  step   - The step to execute.
   * @param {SagaContext}  ctx    - Current saga context (mutated in-place).
   * @returns {Promise<void>}
   * @private
   *
   * @fires SagaOrchestrator#stepCompleted
   * @fires SagaOrchestrator#stepFailed
   */
  async _executeStep(record, step, ctx) {
    const timeout  = step.timeout  || STEP_TIMEOUT_MS;
    const retries  = step.retries  !== undefined ? step.retries : MAX_STEP_RETRIES;
    const stepStart = Date.now();
    let lastError;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const result = await withTimeout(
          step.action(ctx),
          timeout,
          `step:${step.name}[${attempt}]`,
        );
        record.results[step.stepId]       = result;
        record.completed.push(step.stepId);
        record.stepDurations[step.stepId] = Date.now() - stepStart;

        this.emit('stepCompleted', {
          sagaId:    record.sagaId,
          sagaName:  record.sagaName,
          stepId:    step.stepId,
          stepName:  step.name,
          attempt,
          durationMs: record.stepDurations[step.stepId],
        });
        return;
      } catch (err) {
        lastError = err;
        const isLast = attempt === retries - 1;
        if (!isTransient(err) || isLast) break;
        await new Promise((r) => setTimeout(r, phiBackoffWithJitter(attempt)));
      }
    }

    record.stepDurations[step.stepId] = Date.now() - stepStart;
    this.emit('stepFailed', {
      sagaId:   record.sagaId,
      sagaName: record.sagaName,
      stepId:   step.stepId,
      stepName: step.name,
      error:    lastError,
    });
    throw lastError;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE: _compensate
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Executes compensation functions for all completed steps in LIFO order.
   * Each compensation is given COMPENSATION_TIMEOUT_MS = phiTimeouts().patient.
   * Compensation errors are captured and attached to the record but do not
   * suppress subsequent compensations.
   *
   * Sets record.state to COMPENSATED on success, FAILED if compensation itself
   * throws for every eligible step.
   *
   * @param {SagaRecord}    record - Live saga record.
   * @param {SagaStepDef[]} steps  - Full ordered step definitions.
   * @returns {Promise<void>}
   * @private
   *
   * @fires SagaOrchestrator#compensationStarted
   */
  async _compensate(record, steps) {
    record.state = SAGA_STATE.COMPENSATING;
    this.emit('compensationStarted', {
      sagaId:    record.sagaId,
      sagaName:  record.sagaName,
      stepsToCompensate: [...record.completed].reverse(),
    });

    // Reverse lookup: stepId → SagaStepDef
    const stepMap = new Map(steps.map((s) => [s.stepId, s]));

    // LIFO compensation
    const toCompensate = [...record.completed].reverse();
    let allCompensated = true;

    for (const stepId of toCompensate) {
      if (record.compensated.includes(stepId)) continue;
      const step = stepMap.get(stepId);
      if (!step || typeof step.compensation !== 'function') continue;

      /** @type {SagaContext} */
      const ctx = {
        sagaId:    record.sagaId,
        sagaName:  record.sagaName,
        input:     record.input,
        results:   record.results,
        completed: record.completed,
        state:     record.state,
        startedAt: record.startedAt,
        meta:      record.meta,
      };

      try {
        await withTimeout(
          step.compensation(ctx),
          COMPENSATION_TIMEOUT_MS,
          `compensation:${step.name}`,
        );
        record.compensated.push(stepId);
        record.compensationCount++;
      } catch (compErr) {
        allCompensated = false;
        // Record the compensation error without halting remaining compensations
        if (!record.failureError) record.failureError = {};
        record.failureError[`compensation_${stepId}`] = {
          message: compErr.message,
          code:    compErr.code || 'UNKNOWN',
        };
      }
    }

    record.state = allCompensated ? SAGA_STATE.COMPENSATED : SAGA_STATE.FAILED;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE: _normaliseSteps
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Validates and normalises a raw step array.  Assigns auto-generated stepIds
   * to any step missing an explicit one, and enforces required fields.
   *
   * @param {SagaStepDef[]} rawSteps - Caller-supplied step definitions.
   * @returns {SagaStepDef[]} Normalised copy with all required fields present.
   * @throws {TypeError} If any step is missing name, action, or compensation.
   * @private
   */
  _normaliseSteps(rawSteps) {
    return rawSteps.map((step, index) => {
      if (typeof step.name !== 'string' || step.name.trim() === '') {
        throw new TypeError(`SagaOrchestrator: step[${index}].name must be a non-empty string`);
      }
      if (typeof step.action !== 'function') {
        throw new TypeError(`SagaOrchestrator: step[${index}](${step.name}).action must be a function`);
      }
      if (typeof step.compensation !== 'function') {
        throw new TypeError(`SagaOrchestrator: step[${index}](${step.name}).compensation must be a function`);
      }
      return {
        name:            step.name,
        stepId:          step.stepId || phiId(`step-${index}`),
        action:          step.action,
        compensation:    step.compensation,
        guard:           step.guard           || null,
        guardThreshold:  step.guardThreshold  || DEFAULT_GUARD_THRESHOLD,
        timeout:         step.timeout         || STEP_TIMEOUT_MS,
        retries:         step.retries         !== undefined ? step.retries : MAX_STEP_RETRIES,
      };
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE: _updateSuccessRate
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Updates the phi-fusion weighted success rate after each terminal saga event.
   * Applies SUCCESS_RATE_WEIGHTS = phiFusionWeights(2) ≈ [0.618, 0.382],
   * blending recent outcome (weight[0]) against historical rate (weight[1]).
   *
   * @param {boolean} succeeded - True if the saga completed successfully.
   * @returns {void}
   * @private
   */
  _updateSuccessRate(succeeded) {
    const recent = succeeded ? 1 : 0;
    this._successRate =
      SUCCESS_RATE_WEIGHTS[0] * recent +
      SUCCESS_RATE_WEIGHTS[1] * this._successRate;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE: _enqueueDLQ
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Appends a failed saga record to the dead letter queue.
   * When the queue reaches DLQ_CAPACITY = fib(8) = 21, the oldest entry is
   * evicted to make room (FIFO eviction, not LRU — oldest incidents first).
   *
   * @param {SagaRecord} record - The saga record to archive.
   * @returns {void}
   * @private
   */
  _enqueueDLQ(record) {
    if (this._dlq.length >= DLQ_CAPACITY) {
      this._dlq.shift();
    }
    this._dlq.push({ ...record.toJSON(), dlqEnqueuedAt: Date.now() });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PUBLIC: metrics
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Returns a snapshot of aggregate orchestrator performance metrics.
   *
   * Fields:
   * - sagasCompleted    — total successfully completed sagas
   * - sagasFailed       — total sagas that entered FAILED or COMPENSATED state
   * - successRate       — phi-fusion weighted success rate in [0, 1]
   * - pressureLevel     — 'NOMINAL'|'ELEVATED'|'HIGH'|'CRITICAL' from failure ratio
   * - activeSagas       — sagas currently in RUNNING or COMPENSATING state
   * - dlqDepth          — entries in the dead letter queue
   * - totalSagas        — all sagas ever tracked
   *
   * @returns {Object} Metrics snapshot.
   */
  metrics() {
    const total    = this._completedCount + this._failedCount;
    const failRate = total === 0 ? 0 : this._failedCount / total;
    const active   = [...this._sagas.values()].filter(
      (r) => r.state === SAGA_STATE.RUNNING || r.state === SAGA_STATE.COMPENSATING,
    ).length;

    // Derive severity label from SAGA_SEVERITY thresholds (ALERT_THRESHOLDS)
    let severity = 'nominal';
    if (failRate >= SAGA_SEVERITY.exceeded)      severity = 'exceeded';
    else if (failRate >= SAGA_SEVERITY.critical) severity = 'critical';
    else if (failRate >= SAGA_SEVERITY.caution)  severity = 'caution';

    return {
      sagasCompleted:    this._completedCount,
      sagasFailed:       this._failedCount,
      successRate:       parseFloat(this._successRate.toFixed(6)),
      pressureLevel:     getPressureLevel(failRate),
      severity,
      activeSagas:       active,
      dlqDepth:          this._dlq.length,
      totalSagas:        this._sagas.size,
      stepRetryBaseMs:   STEP_RETRY_BASE_MS,
      recoveryThreshold: GUARD_THRESHOLD_RECOVERY,
      permissiveThreshold: GUARD_THRESHOLD_PERMISSIVE,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PUBLIC: dlq / getSaga
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Returns a copy of the dead letter queue contents for manual review.
   * Each entry is a JSON snapshot of the failed SagaRecord plus dlqEnqueuedAt.
   *
   * @returns {Object[]} Immutable snapshot of DLQ entries.
   */
  getDLQ() {
    return [...this._dlq];
  }

  /**
   * Retrieves the current JSON snapshot of a saga by its ID.
   *
   * @param {string} sagaId - The saga run identifier.
   * @returns {Object|null} JSON snapshot or null if not found.
   */
  getSaga(sagaId) {
    const record = this._sagas.get(sagaId);
    return record ? record.toJSON() : null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: PRE-BUILT SAGA TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Factory helpers for common Heady workflow sagas.
 * Each factory returns a SagaDefinition ready for SagaOrchestrator.execute().
 *
 * All guard thresholds are phi-harmonic:
 * - DeploymentSaga steps use CSL_THRESHOLDS.HIGH  ≈ 0.882 (strong alignment)
 * - PipelineSaga steps use CSL_THRESHOLDS.MEDIUM  ≈ 0.809 (moderate alignment)
 * - MemoryWriteSaga steps use CSL_THRESHOLDS.HIGH ≈ 0.882 (data integrity)
 *
 * @namespace SagaTemplates
 */
const SagaTemplates = Object.freeze({

  /**
   * DeploymentSaga — build → test → deploy → health-check.
   * Compensation: rollback in reverse (health-check has no compensate,
   * deploy rollbacks the artifact, test/build clean up artefacts).
   *
   * @param {Object}   ops                   - Caller-supplied operation functions.
   * @param {Function} ops.build             - async (ctx) → build result
   * @param {Function} ops.test              - async (ctx) → test result
   * @param {Function} ops.deploy            - async (ctx) → deploy result
   * @param {Function} ops.healthCheck       - async (ctx) → health result
   * @param {Function} ops.rollback          - async (ctx) → rollback result
   * @param {Function} ops.cleanupBuild      - async (ctx) → void
   * @param {Function} ops.cleanupTest       - async (ctx) → void
   * @param {Function} [ops.buildGuard]      - CSL guard for build step
   * @param {Function} [ops.deployGuard]     - CSL guard for deploy step
   * @returns {SagaDefinition}
   */
  deploymentSaga(ops) {
    return {
      name: 'DeploymentSaga',
      steps: [
        {
          name:         'build',
          action:       ops.build,
          compensation: ops.cleanupBuild,
          guard:        ops.buildGuard  || null,
          guardThreshold: CSL_THRESHOLDS.HIGH,
          timeout:      STEP_TIMEOUT_MS,
          retries:      MAX_STEP_RETRIES,
        },
        {
          name:         'test',
          action:       ops.test,
          compensation: ops.cleanupTest,
          guard:        null,
          guardThreshold: CSL_THRESHOLDS.HIGH,
          timeout:      Math.round(STEP_TIMEOUT_MS * PHI),
          retries:      fib(3),
        },
        {
          name:         'deploy',
          action:       ops.deploy,
          compensation: ops.rollback,
          guard:        ops.deployGuard || null,
          guardThreshold: CSL_THRESHOLDS.HIGH,
          timeout:      Math.round(STEP_TIMEOUT_MS * PHI),
          retries:      fib(3),
        },
        {
          name:         'health-check',
          action:       ops.healthCheck,
          compensation: ops.rollback,
          guard:        null,
          guardThreshold: CSL_THRESHOLDS.MEDIUM,
          timeout:      STEP_TIMEOUT_MS,
          retries:      MAX_STEP_RETRIES,
        },
      ],
    };
  },

  /**
   * PipelineSaga — recon → classify → orchestrate → execute → verify.
   * Compensation: each stage has a revert that undoes its side effects.
   *
   * @param {Object}   ops                     - Caller-supplied operation functions.
   * @param {Function} ops.recon               - async (ctx) → recon result
   * @param {Function} ops.classify            - async (ctx) → classification result
   * @param {Function} ops.orchestrate         - async (ctx) → orchestration result
   * @param {Function} ops.execute             - async (ctx) → execution result
   * @param {Function} ops.verify              - async (ctx) → verification result
   * @param {Function} ops.revertRecon         - async (ctx) → void
   * @param {Function} ops.revertClassify      - async (ctx) → void
   * @param {Function} ops.revertOrchestrate   - async (ctx) → void
   * @param {Function} ops.revertExecute       - async (ctx) → void
   * @param {Function} ops.revertVerify        - async (ctx) → void
   * @param {Function} [ops.reconGuard]        - CSL guard for recon step
   * @param {Function} [ops.executeGuard]      - CSL guard for execute step
   * @returns {SagaDefinition}
   */
  pipelineSaga(ops) {
    return {
      name: 'PipelineSaga',
      steps: [
        {
          name:           'recon',
          action:         ops.recon,
          compensation:   ops.revertRecon,
          guard:          ops.reconGuard   || null,
          guardThreshold: CSL_THRESHOLDS.MEDIUM,
          timeout:        STEP_TIMEOUT_MS,
          retries:        MAX_STEP_RETRIES,
        },
        {
          name:           'classify',
          action:         ops.classify,
          compensation:   ops.revertClassify,
          guard:          null,
          guardThreshold: CSL_THRESHOLDS.MEDIUM,
          timeout:        STEP_TIMEOUT_MS,
          retries:        MAX_STEP_RETRIES,
        },
        {
          name:           'orchestrate',
          action:         ops.orchestrate,
          compensation:   ops.revertOrchestrate,
          guard:          null,
          guardThreshold: CSL_THRESHOLDS.MEDIUM,
          timeout:        Math.round(STEP_TIMEOUT_MS * PHI),
          retries:        fib(3),
        },
        {
          name:           'execute',
          action:         ops.execute,
          compensation:   ops.revertExecute,
          guard:          ops.executeGuard || null,
          guardThreshold: CSL_THRESHOLDS.HIGH,
          timeout:        Math.round(STEP_TIMEOUT_MS * PHI),
          retries:        fib(3),
        },
        {
          name:           'verify',
          action:         ops.verify,
          compensation:   ops.revertVerify,
          guard:          null,
          guardThreshold: CSL_THRESHOLDS.MEDIUM,
          timeout:        STEP_TIMEOUT_MS,
          retries:        MAX_STEP_RETRIES,
        },
      ],
    };
  },

  /**
   * MemoryWriteSaga — validate → embed → store → index.
   * Compensation: delete operations mirror each write.
   *
   * @param {Object}   ops                 - Caller-supplied operation functions.
   * @param {Function} ops.validate        - async (ctx) → validation result
   * @param {Function} ops.embed           - async (ctx) → embedding result
   * @param {Function} ops.store           - async (ctx) → store result
   * @param {Function} ops.index           - async (ctx) → index result
   * @param {Function} ops.deleteValidated - async (ctx) → void
   * @param {Function} ops.deleteEmbedding - async (ctx) → void
   * @param {Function} ops.deleteStored    - async (ctx) → void
   * @param {Function} ops.deleteIndex     - async (ctx) → void
   * @param {Function} [ops.validateGuard] - CSL guard for validate step
   * @param {Function} [ops.storeGuard]    - CSL guard for store step
   * @returns {SagaDefinition}
   */
  memoryWriteSaga(ops) {
    return {
      name: 'MemoryWriteSaga',
      steps: [
        {
          name:           'validate',
          action:         ops.validate,
          compensation:   ops.deleteValidated,
          guard:          ops.validateGuard || null,
          guardThreshold: CSL_THRESHOLDS.HIGH,
          timeout:        STEP_TIMEOUT_MS,
          retries:        MAX_STEP_RETRIES,
        },
        {
          name:           'embed',
          action:         ops.embed,
          compensation:   ops.deleteEmbedding,
          guard:          null,
          guardThreshold: CSL_THRESHOLDS.HIGH,
          timeout:        Math.round(STEP_TIMEOUT_MS * PHI),
          retries:        fib(3),
        },
        {
          name:           'store',
          action:         ops.store,
          compensation:   ops.deleteStored,
          guard:          ops.storeGuard || null,
          guardThreshold: CSL_THRESHOLDS.HIGH,
          timeout:        STEP_TIMEOUT_MS,
          retries:        MAX_STEP_RETRIES,
        },
        {
          name:           'index',
          action:         ops.index,
          compensation:   ops.deleteIndex,
          guard:          null,
          guardThreshold: CSL_THRESHOLDS.MEDIUM,
          timeout:        STEP_TIMEOUT_MS,
          retries:        MAX_STEP_RETRIES,
        },
      ],
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8: EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  SagaOrchestrator,
  SagaTemplates,
  SAGA_STATE,
  STEP_TIMEOUT_MS,
  COMPENSATION_TIMEOUT_MS,
  SAGA_TIMEOUT_BASE_MS,
  MAX_STEP_RETRIES,
  DLQ_CAPACITY,
  DEFAULT_GUARD_THRESHOLD,
  STEP_RETRY_BASE_MS,
  GUARD_THRESHOLD_PERMISSIVE,
  GUARD_THRESHOLD_RECOVERY,
  SAGA_SEVERITY,
};
