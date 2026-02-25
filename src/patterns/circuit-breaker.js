/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * Heady Circuit Breaker — Fault Tolerance Pattern
 * Prevents cascade failures by tripping open on repeated errors,
 * then half-opening to test recovery before closing again.
 *
 * States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing) → CLOSED
 */

const EventEmitter = require("events");

class CircuitBreaker extends EventEmitter {
    constructor(name, options = {}) {
        super();
        this.name = name;
        this.failureThreshold = options.failureThreshold || 5;
        this.resetTimeoutMs = options.resetTimeoutMs || 30000;
        this.halfOpenMaxAttempts = options.halfOpenMaxAttempts || 3;
        this.monitorIntervalMs = options.monitorIntervalMs || 5000;

        this.state = "CLOSED";
        this.failures = 0;
        this.successes = 0;
        this.halfOpenAttempts = 0;
        this.lastFailureTime = null;
        this.lastStateChange = Date.now();
        this.totalRequests = 0;
        this.totalFailures = 0;
        this.totalSuccesses = 0;

        // Auto-transition from OPEN → HALF_OPEN after timeout
        this._timer = setInterval(() => this._checkRecovery(), this.monitorIntervalMs);
    }

    async execute(fn) {
        this.totalRequests++;

        if (this.state === "OPEN") {
            this.emit("rejected", { name: this.name, state: this.state });
            throw new Error(`Circuit breaker [${this.name}] is OPEN — request rejected`);
        }

        try {
            const result = await fn();
            this._onSuccess();
            return result;
        } catch (err) {
            this._onFailure(err);
            throw err;
        }
    }

    _onSuccess() {
        this.successes++;
        this.totalSuccesses++;

        if (this.state === "HALF_OPEN") {
            this.halfOpenAttempts++;
            if (this.halfOpenAttempts >= this.halfOpenMaxAttempts) {
                this._transition("CLOSED");
                this.failures = 0;
                this.halfOpenAttempts = 0;
            }
        } else {
            this.failures = Math.max(0, this.failures - 1); // Decay on success
        }
    }

    _onFailure(err) {
        this.failures++;
        this.totalFailures++;
        this.lastFailureTime = Date.now();

        if (this.state === "HALF_OPEN") {
            this._transition("OPEN");
            this.halfOpenAttempts = 0;
        } else if (this.failures >= this.failureThreshold) {
            this._transition("OPEN");
        }

        this.emit("failure", { name: this.name, error: err.message, failures: this.failures });
    }

    _checkRecovery() {
        if (this.state === "OPEN" && this.lastFailureTime) {
            const elapsed = Date.now() - this.lastFailureTime;
            if (elapsed >= this.resetTimeoutMs) {
                this._transition("HALF_OPEN");
                this.halfOpenAttempts = 0;
            }
        }
    }

    _transition(newState) {
        const prev = this.state;
        this.state = newState;
        this.lastStateChange = Date.now();
        this.emit("stateChange", { name: this.name, from: prev, to: newState, ts: new Date().toISOString() });
    }

    getStatus() {
        return {
            name: this.name,
            state: this.state,
            failures: this.failures,
            totalRequests: this.totalRequests,
            totalSuccesses: this.totalSuccesses,
            totalFailures: this.totalFailures,
            lastFailure: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
            lastStateChange: new Date(this.lastStateChange).toISOString(),
        };
    }

    reset() {
        this.state = "CLOSED";
        this.failures = 0;
        this.halfOpenAttempts = 0;
        this.lastStateChange = Date.now();
        this.emit("reset", { name: this.name });
    }

    destroy() {
        clearInterval(this._timer);
        this.removeAllListeners();
    }
}

// ── Registry for managing multiple circuit breakers ──
const breakers = new Map();

function getBreaker(name, options) {
    if (!breakers.has(name)) {
        breakers.set(name, new CircuitBreaker(name, options));
    }
    return breakers.get(name);
}

function getAllStatus() {
    const status = {};
    for (const [name, cb] of breakers) {
        status[name] = cb.getStatus();
    }
    return status;
}

module.exports = { CircuitBreaker, getBreaker, getAllStatus };
