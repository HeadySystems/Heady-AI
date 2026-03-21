'use strict';

/**
 * MemoryReceipts — deterministic task lifecycle tracking with repeat detection.
 */

const VALID_VERDICTS = ['success', 'failed', 'skipped', 'unknown'];
const VALID_TERMINAL_STATES = ['completed', 'failed_closed', 'abandoned'];

class MemoryReceipts {
    constructor(opts) {
        opts = opts || {};
        this._repeatThreshold = opts.repeatThreshold || 5;
        this._repeatWindowMs = opts.repeatWindowMs || 300000;
        this._tasks = new Map(); // taskId -> task state
    }

    recordAttempt(entry) {
        const { taskId, inputHash, constraintsHash, errorClass } = entry;
        let verdict = entry.verdict;
        if (!VALID_VERDICTS.includes(verdict)) verdict = 'unknown';

        if (!this._tasks.has(taskId)) {
            this._tasks.set(taskId, {
                taskId,
                attempts: 0,
                closed: false,
                terminalState: null,
                terminalReason: null,
                evidence: null,
                history: [],
            });
        }

        const task = this._tasks.get(taskId);
        const now = Date.now();
        task.attempts += 1;
        task.history.push({ verdict, inputHash, constraintsHash, errorClass, ts: now });

        // Repeat detection: count equivalent failures within window
        const windowStart = now - this._repeatWindowMs;
        const recentFailures = task.history.filter(
            (h) =>
                h.verdict === 'failed' &&
                h.ts >= windowStart &&
                h.inputHash === inputHash &&
                h.constraintsHash === constraintsHash &&
                h.errorClass === errorClass
        );

        const repeatCount = recentFailures.length;
        const detected = repeatCount >= this._repeatThreshold;
        const fingerprint = detected ? `${taskId}:${inputHash}:${constraintsHash}:${errorClass}` : null;

        return {
            attempt: { verdict },
            repeat: { detected, count: repeatCount, fingerprint },
        };
    }

    closeTask(taskId, terminalState, reason, evidence) {
        if (!VALID_TERMINAL_STATES.includes(terminalState)) {
            throw new Error('invalid terminal state');
        }

        const task = this._tasks.get(taskId);
        if (!task) {
            // Create a placeholder if task was never recorded
            this._tasks.set(taskId, {
                taskId,
                attempts: 0,
                closed: true,
                terminalState,
                terminalReason: reason,
                evidence: evidence || null,
                history: [],
            });
            return { closed: true, terminalState, evidence: evidence || null };
        }

        if (task.closed) {
            return {
                closed: true,
                idempotent: true,
                terminalState: task.terminalState,
                evidence: task.evidence,
            };
        }

        task.closed = true;
        task.terminalState = terminalState;
        task.terminalReason = reason;
        task.evidence = evidence || null;

        return { closed: true, terminalState, evidence: task.evidence };
    }

    getTaskState(taskId) {
        const task = this._tasks.get(taskId);
        if (!task) return null;
        return {
            taskId: task.taskId,
            attempts: task.attempts,
            closed: task.closed,
            terminalState: task.terminalState,
            terminalReason: task.terminalReason,
        };
    }

    listOpenTasks() {
        const open = [];
        for (const task of this._tasks.values()) {
            if (!task.closed) {
                open.push({ taskId: task.taskId, attempts: task.attempts });
            }
        }
        return open;
    }

    getStats() {
        let active = 0;
        for (const task of this._tasks.values()) {
            if (!task.closed) active++;
        }
        return { activeTasks: active, totalTasks: this._tasks.size };
    }

    getOperationalStatus() {
        return {
            status: 'healthy',
            terminalStates: VALID_TERMINAL_STATES,
            allowedVerdicts: VALID_VERDICTS,
        };
    }
}

module.exports = MemoryReceipts;
