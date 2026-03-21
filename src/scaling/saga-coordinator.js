/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Saga Coordinator — Distributed Transaction Orchestrator
 * ════════════════════════════════════════════════════════
 * Lightweight saga pattern for multi-service transactions.
 * Every step is compensatable (rollback-able).
 *
 * Example: User signup flow:
 *   1. Create Firebase account   → compensate: delete Firebase account
 *   2. Index profile in vector   → compensate: remove vector entry
 *   3. Send welcome notification → compensate: (noop — notification sent)
 *   4. Create Drupal account     → compensate: delete Drupal account
 *
 * φ-derived:
 *   - Step timeout: 8s (Fibonacci)
 *   - Compensation timeout: 13s (Fibonacci)
 *   - Max compensations: 5 (Fibonacci)
 *   - Saga TTL: 89s (Fibonacci)
 */

'use strict';

const crypto = require('crypto');

// ─── φ-Math Constants ─────────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

const STEP_TIMEOUT_MS = FIB[5] * 1000;          // 8s
const COMPENSATION_TIMEOUT_MS = FIB[6] * 1000;  // 13s
const MAX_COMPENSATION_RETRIES = FIB[4];         // 5
const SAGA_TTL_MS = FIB[10] * 1000;             // 89s

// ─── Saga States ─────────────────────────────────────────────────────────────

const SagaState = Object.freeze({
    PENDING: 'PENDING',
    RUNNING: 'RUNNING',
    COMPLETED: 'COMPLETED',
    COMPENSATING: 'COMPENSATING',
    COMPENSATED: 'COMPENSATED',
    FAILED: 'FAILED',
});

const StepState = Object.freeze({
    PENDING: 'PENDING',
    RUNNING: 'RUNNING',
    COMPLETED: 'COMPLETED',
    COMPENSATING: 'COMPENSATING',
    COMPENSATED: 'COMPENSATED',
    FAILED: 'FAILED',
});

// ─── Saga Definition ─────────────────────────────────────────────────────────

class SagaDefinition {
    constructor(name) {
        this._name = name;
        this._steps = [];
    }

    /**
     * Add a step to the saga.
     *
     * @param {string} name          - Step name
     * @param {Function} execute     - async (context) => result
     * @param {Function} compensate  - async (context, executeResult) => void
     * @param {object} [opts]
     * @param {number} [opts.timeoutMs]
     * @returns {SagaDefinition} this (for chaining)
     */
    step(name, execute, compensate, opts = {}) {
        this._steps.push({
            name,
            execute,
            compensate: compensate || (() => { }), // Noop compensation
            timeoutMs: opts.timeoutMs || STEP_TIMEOUT_MS,
        });
        return this;
    }

    get name() { return this._name; }
    get steps() { return [...this._steps]; }
}

// ─── Saga Coordinator ────────────────────────────────────────────────────────

class SagaCoordinator {
    constructor(opts = {}) {
        /** @type {Map<string, SagaExecution>} */
        this._executions = new Map();
        this._definitions = new Map();
        this._metrics = { started: 0, completed: 0, compensated: 0, failed: 0 };
    }

    /**
     * Register a saga definition.
     * @param {SagaDefinition} definition
     */
    register(definition) {
        this._definitions.set(definition.name, definition);
        _log('info', `Saga registered: ${definition.name}`, { steps: definition.steps.length });
    }

    /**
     * Execute a saga.
     *
     * @param {string} sagaName    - Name of registered saga
     * @param {object} context     - Initial context passed to all steps
     * @returns {{ sagaId: string, state: string, results: object[], error?: string }}
     */
    async execute(sagaName, context = {}) {
        const definition = this._definitions.get(sagaName);
        if (!definition) throw new Error(`Saga not found: ${sagaName}`);

        const sagaId = crypto.randomUUID();
        const execution = {
            sagaId,
            sagaName,
            state: SagaState.RUNNING,
            context: { ...context },
            steps: definition.steps.map(s => ({
                name: s.name,
                state: StepState.PENDING,
                result: null,
                error: null,
                startedAt: null,
                completedAt: null,
            })),
            startedAt: new Date().toISOString(),
            completedAt: null,
        };

        this._executions.set(sagaId, execution);
        this._metrics.started++;

        _log('info', `Saga started: ${sagaName}`, { sagaId, steps: definition.steps.length });

        try {
            // Execute steps sequentially
            for (let i = 0; i < definition.steps.length; i++) {
                const stepDef = definition.steps[i];
                const stepState = execution.steps[i];

                stepState.state = StepState.RUNNING;
                stepState.startedAt = new Date().toISOString();

                try {
                    const result = await _withTimeout(
                        stepDef.execute(execution.context),
                        stepDef.timeoutMs,
                        `Step "${stepDef.name}" timed out after ${stepDef.timeoutMs}ms`
                    );

                    stepState.state = StepState.COMPLETED;
                    stepState.result = result;
                    stepState.completedAt = new Date().toISOString();

                    // Make result available to subsequent steps
                    execution.context[`_step_${stepDef.name}`] = result;

                    _log('info', `Step completed: ${stepDef.name}`, { sagaId, step: i + 1 });

                } catch (err) {
                    stepState.state = StepState.FAILED;
                    stepState.error = err.message;
                    stepState.completedAt = new Date().toISOString();

                    _log('error', `Step failed: ${stepDef.name}`, { sagaId, step: i + 1, error: err.message });

                    // Begin compensation for all completed steps (reverse order)
                    await this._compensate(sagaId, definition, execution, i - 1);
                    return this._finalize(execution, SagaState.COMPENSATED);
                }
            }

            // All steps completed successfully
            return this._finalize(execution, SagaState.COMPLETED);

        } catch (err) {
            _log('error', `Saga failed: ${sagaName}`, { sagaId, error: err.message });
            return this._finalize(execution, SagaState.FAILED, err.message);
        }
    }

    /**
     * Compensate completed steps in reverse order.
     * @private
     */
    async _compensate(sagaId, definition, execution, fromIndex) {
        execution.state = SagaState.COMPENSATING;
        _log('info', `Compensating saga`, { sagaId, fromStep: fromIndex + 1 });

        for (let i = fromIndex; i >= 0; i--) {
            const stepDef = definition.steps[i];
            const stepState = execution.steps[i];

            if (stepState.state !== StepState.COMPLETED) continue;

            stepState.state = StepState.COMPENSATING;

            let retries = 0;
            while (retries < MAX_COMPENSATION_RETRIES) {
                try {
                    await _withTimeout(
                        stepDef.compensate(execution.context, stepState.result),
                        COMPENSATION_TIMEOUT_MS,
                        `Compensation "${stepDef.name}" timed out`
                    );

                    stepState.state = StepState.COMPENSATED;
                    _log('info', `Step compensated: ${stepDef.name}`, { sagaId, step: i + 1 });
                    break;

                } catch (err) {
                    retries++;
                    _log('warn', `Compensation retry ${retries}/${MAX_COMPENSATION_RETRIES}: ${stepDef.name}`, {
                        sagaId, error: err.message,
                    });

                    if (retries >= MAX_COMPENSATION_RETRIES) {
                        stepState.state = StepState.FAILED;
                        stepState.error = `Compensation failed after ${retries} retries: ${err.message}`;
                        _log('error', `Compensation exhausted: ${stepDef.name}`, { sagaId });
                    }

                    // φ-exponential backoff
                    await _delay(Math.round(1000 * Math.pow(PHI, retries)));
                }
            }
        }
    }

    /**
     * Finalize saga execution.
     * @private
     */
    _finalize(execution, state, error) {
        execution.state = state;
        execution.completedAt = new Date().toISOString();

        if (state === SagaState.COMPLETED) this._metrics.completed++;
        else if (state === SagaState.COMPENSATED) this._metrics.compensated++;
        else this._metrics.failed++;

        _log('info', `Saga ${state.toLowerCase()}: ${execution.sagaName}`, {
            sagaId: execution.sagaId,
            duration: Date.now() - new Date(execution.startedAt).getTime(),
        });

        // Clean up old executions (keep last 89)
        if (this._executions.size > FIB[10]) {
            const oldest = [...this._executions.keys()].slice(0, this._executions.size - FIB[10]);
            for (const id of oldest) this._executions.delete(id);
        }

        return {
            sagaId: execution.sagaId,
            sagaName: execution.sagaName,
            state: execution.state,
            steps: execution.steps,
            error: error || null,
            startedAt: execution.startedAt,
            completedAt: execution.completedAt,
        };
    }

    /**
     * Get execution status.
     */
    getExecution(sagaId) {
        return this._executions.get(sagaId) || null;
    }

    /**
     * Get coordinator metrics.
     */
    getMetrics() {
        return { ...this._metrics, activeExecutions: this._executions.size };
    }
}

// ─── Pre-built Saga Definitions ──────────────────────────────────────────────

/**
 * User signup saga — the canonical example.
 */
function createUserSignupSaga() {
    return new SagaDefinition('user-signup')
        .step('create-firebase-account',
            async (ctx) => {
                // Firebase Admin SDK: createUser
                const userId = `firebase:${crypto.randomUUID().slice(0, 8)}`;
                ctx.firebaseUserId = userId;
                return { userId };
            },
            async (ctx) => {
                // Compensate: delete Firebase user
                _log('info', 'Compensating: delete Firebase account', { userId: ctx.firebaseUserId });
            }
        )
        .step('index-vector-memory',
            async (ctx) => {
                // heady-embed: index user profile
                const vectorId = `vec:${ctx.firebaseUserId}`;
                ctx.vectorId = vectorId;
                return { vectorId };
            },
            async (ctx) => {
                // Compensate: remove vector entry
                _log('info', 'Compensating: remove vector entry', { vectorId: ctx.vectorId });
            }
        )
        .step('send-welcome-notification',
            async (ctx) => {
                // notification-service: send welcome email/push
                return { sent: true, channel: 'email' };
            },
            // No compensation — notification already sent (idempotent)
            async () => { }
        )
        .step('create-drupal-account',
            async (ctx) => {
                // Drupal JSON:API: create user entity
                const drupalUserId = `drupal:${ctx.firebaseUserId}`;
                ctx.drupalUserId = drupalUserId;
                return { drupalUserId };
            },
            async (ctx) => {
                // Compensate: delete Drupal user
                _log('info', 'Compensating: delete Drupal account', { drupalUserId: ctx.drupalUserId });
            }
        );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _withTimeout(promise, ms, message) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(message)), ms);
        promise
            .then(result => { clearTimeout(timer).catch(err => { /* promise error absorbed */ }); resolve(result); })
            .catch(err => { clearTimeout(timer); reject(err); });
    });
}

function _delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function _log(level, msg, meta = {}) {
    process.stdout.write(JSON.stringify({ level, service: 'saga-coordinator', message: msg, ...meta, timestamp: new Date().toISOString() }) + '\n');
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
    SagaCoordinator,
    SagaDefinition,
    SagaState,
    StepState,
    createUserSignupSaga,
    STEP_TIMEOUT_MS,
    COMPENSATION_TIMEOUT_MS,
    MAX_COMPENSATION_RETRIES,
    SAGA_TTL_MS,
};
