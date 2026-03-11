/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  HEADY™ SAGA ORCHESTRATOR — Compensating Transactions            ║
 * ║  Multi-service transactions with rollback on intermediate fail   ║
 * ║  © 2024-2026 HeadySystems Inc. All Rights Reserved.              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

'use strict';

import { PHI, PSI, fib, phiBackoff } from '../../shared/phi-math.js';

/** Max saga steps — fib(8) = 21 (matches pipeline stages) */
const MAX_SAGA_STEPS = fib(8);

/** Saga states */
const SAGA_STATE = Object.freeze({
  PENDING:      'PENDING',
  RUNNING:      'RUNNING',
  COMPLETED:    'COMPLETED',
  COMPENSATING: 'COMPENSATING',
  FAILED:       'FAILED',
});

/**
 * SagaStep — one step in a saga with execute and compensate functions.
 */
class SagaStep {
  /**
   * @param {Object} opts
   * @param {string} opts.name - Step name
   * @param {Function} opts.execute - Async forward function
   * @param {Function} opts.compensate - Async rollback function
   * @param {number} [opts.maxRetries] - Max retries for this step
   */
  constructor({ name, execute, compensate, maxRetries = fib(4) }) {
    this.name = name;
    this.execute = execute;
    this.compensate = compensate;
    this.maxRetries = maxRetries;
    this.result = null;
    this.status = 'pending';
  }
}

/**
 * SagaOrchestrator — manages multi-service transactions with compensating actions.
 * When any step fails, all previously completed steps are compensated in reverse order.
 */
export class SagaOrchestrator {
  /**
   * @param {Object} options
   * @param {Object} [options.telemetry] - Telemetry emitter
   */
  constructor({ telemetry = null } = {}) {
    /** @private */ this._telemetry = telemetry;
    /** @private */ this._sagas = new Map();
  }

  /**
   * Define a new saga.
   * @param {string} sagaId - Unique saga identifier
   * @param {SagaStep[]} steps - Ordered steps
   * @returns {Object} Saga definition
   */
  define(sagaId, steps) {
    if (steps.length > MAX_SAGA_STEPS) {
      throw new Error(`Saga exceeds max steps (${MAX_SAGA_STEPS}): ${steps.length}`);
    }

    const saga = {
      id: sagaId,
      steps: steps.map(s => new SagaStep(s)),
      state: SAGA_STATE.PENDING,
      completedSteps: [],
      error: null,
      startTime: null,
      endTime: null,
    };

    this._sagas.set(sagaId, saga);
    return saga;
  }

  /**
   * Execute a saga — runs steps sequentially, compensates on failure.
   * @param {string} sagaId - Saga to execute
   * @param {Object} context - Initial context passed to steps
   * @returns {Promise<Object>} Saga result
   */
  async execute(sagaId, context = {}) {
    const saga = this._sagas.get(sagaId);
    if (!saga) throw new Error(`Saga not found: ${sagaId}`);

    saga.state = SAGA_STATE.RUNNING;
    saga.startTime = Date.now();
    const ctx = { ...context };

    this._emit('saga.started', { sagaId, steps: saga.steps.length });

    try {
      for (const step of saga.steps) {
        step.status = 'running';
        let lastErr = null;

        for (let attempt = 0; attempt < step.maxRetries; attempt++) {
          try {
            step.result = await step.execute(ctx);
            step.status = 'completed';
            saga.completedSteps.push(step);
            ctx[step.name] = step.result;

            this._emit('saga.step.completed', { sagaId, step: step.name, attempt });
            lastErr = null;
            break;
          } catch (err) {
            lastErr = err;
            if (attempt < step.maxRetries - 1) {
              await new Promise(r => setTimeout(r, phiBackoff(attempt)));
            }
          }
        }

        if (lastErr) {
          step.status = 'failed';
          throw lastErr;
        }
      }

      saga.state = SAGA_STATE.COMPLETED;
      saga.endTime = Date.now();
      this._emit('saga.completed', { sagaId, durationMs: saga.endTime - saga.startTime });

      return {
        sagaId,
        state: saga.state,
        results: Object.fromEntries(saga.steps.map(s => [s.name, s.result])),
        durationMs: saga.endTime - saga.startTime,
      };
    } catch (err) {
      saga.error = err;
      this._emit('saga.failed', { sagaId, step: saga.steps.find(s => s.status === 'failed')?.name, error: err.message });

      // Compensate in reverse order
      await this._compensate(saga, ctx);
      throw err;
    }
  }

  /**
   * Compensate all completed steps in reverse order.
   * @private
   */
  async _compensate(saga, context) {
    saga.state = SAGA_STATE.COMPENSATING;
    this._emit('saga.compensating', { sagaId: saga.id, steps: saga.completedSteps.length });

    const reversed = [...saga.completedSteps].reverse();

    for (const step of reversed) {
      try {
        await step.compensate(context);
        step.status = 'compensated';
        this._emit('saga.step.compensated', { sagaId: saga.id, step: step.name });
      } catch (compensateErr) {
        step.status = 'compensate_failed';
        this._emit('saga.compensate.failed', {
          sagaId: saga.id,
          step: step.name,
          error: compensateErr.message,
        });
        // Continue compensating other steps even if one fails
      }
    }

    saga.state = SAGA_STATE.FAILED;
    saga.endTime = Date.now();
  }

  /**
   * Get saga status.
   * @param {string} sagaId
   * @returns {Object}
   */
  getStatus(sagaId) {
    const saga = this._sagas.get(sagaId);
    if (!saga) return null;
    return {
      id: saga.id,
      state: saga.state,
      steps: saga.steps.map(s => ({ name: s.name, status: s.status })),
      error: saga.error?.message || null,
    };
  }

  /** @private */
  _emit(event, data) {
    if (this._telemetry) {
      this._telemetry.emit(event, { source: 'SagaOrchestrator', ...data });
    }
  }
}

export { SagaStep, SAGA_STATE, MAX_SAGA_STEPS };
export default SagaOrchestrator;
