/*
 * © 2026 HeadySystems Inc. — PROPRIETARY AND CONFIDENTIAL
 *
 * HeadyEventBus — Centralized Cross-Service Event Backbone
 * =========================================================
 *
 * Solves CRITICAL ISSUE 2.1 from MASTER_IMPROVEMENT_PLAN.md:
 * "No Centralized Event Bus — Services communicate via fragile global.eventBus
 * references and process.on() hooks. Cross-repo communication is undefined."
 *
 * This module provides:
 *   1. A single EventEmitter-based bus wired globally as global.eventBus
 *   2. Structured event envelope with trace-ID, timestamp, and source
 *   3. Dead-letter queue for unhandled events
 *   4. Metrics: emission count, listener count, dead-letter count
 *   5. Express routes for runtime inspection and manual emission
 *   6. φ-scaled event history ring buffer (fib(18) = 2584 entries)
 *
 * Usage:
 *   const { getEventBus, registerRoutes } = require('./heady-event-bus');
 *   const bus = getEventBus();            // get or create singleton
 *   bus.emit('pipeline:started', data);   // structured envelope auto-added
 *   bus.on('pipeline:started', handler);  // standard EventEmitter API
 *
 * © 2026 HeadySystems Inc. | φ = 1.618033988749895
 */

'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');

// ─── φ-MATH ───────────────────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584];

const MAX_HISTORY     = FIB[17];   // 2584 — event ring buffer size
const MAX_DEAD_LETTER = FIB[13];   // 377 — dead-letter queue max

// ─── Logger ───────────────────────────────────────────────────────────────────
let _logger = null;
try { _logger = require('../utils/logger'); } catch { /* optional */ }
function log(level, msg, data = {}) {
    const entry = { level, component: 'HeadyEventBus', msg, ts: new Date().toISOString(), ...data };
    if (_logger && _logger.logNodeActivity) {
        _logger.logNodeActivity('EVENT-BUS', JSON.stringify(entry));
    }
}

// ─── HeadyEventBus ───────────────────────────────────────────────────────────

class HeadyEventBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(200); // large system with many services

        // Metrics
        this._metrics = {
            totalEmissions: 0,
            totalDeliveries: 0,
            totalDeadLetters: 0,
            byEvent: new Map(), // eventName → { emits, listeners }
        };

        // Ring buffer of recent events for debugging
        this._history = [];

        // Dead-letter queue — events emitted with no listeners
        this._deadLetter = [];

        // Trace context — correlate events across services
        this._currentTraceId = null;

        log('info', 'HeadyEventBus initialized', { maxHistory: MAX_HISTORY });
    }

    // ─── ENHANCED EMIT ───────────────────────────────────────────────────────

    /**
     * Emit an event with automatic envelope enrichment.
     * Adds traceId, timestamp, source, and sequence number to all events.
     */
    emit(eventName, data = {}) {
        const listenerCount = this.listenerCount(eventName);
        this._metrics.totalEmissions++;

        // Build structured envelope
        const envelope = {
            ...data,
            _meta: {
                event: eventName,
                ts: Date.now(),
                iso: new Date().toISOString(),
                traceId: this._currentTraceId || this._generateTraceId(),
                seq: this._metrics.totalEmissions,
                listenerCount,
            },
        };

        // Record in history ring buffer
        this._history.push({ event: eventName, ts: Date.now(), seq: this._metrics.totalEmissions });
        if (this._history.length > MAX_HISTORY) this._history.shift();

        // Track per-event metrics
        if (!this._metrics.byEvent.has(eventName)) {
            this._metrics.byEvent.set(eventName, { emits: 0, lastTs: 0 });
        }
        const evMetric = this._metrics.byEvent.get(eventName);
        evMetric.emits++;
        evMetric.lastTs = Date.now();

        // Dead-letter: record if no listeners (except internal meta-events)
        if (listenerCount === 0 && !eventName.startsWith('_') && eventName !== 'newListener' && eventName !== 'removeListener') {
            this._deadLetter.push({ event: eventName, ts: Date.now(), data: JSON.stringify(data).slice(0, 200) });
            if (this._deadLetter.length > MAX_DEAD_LETTER) this._deadLetter.shift();
            this._metrics.totalDeadLetters++;
            log('debug', `dead-letter: ${eventName} (no listeners)`, { event: eventName });
        } else {
            this._metrics.totalDeliveries += listenerCount;
        }

        return super.emit(eventName, envelope);
    }

    // ─── TRACE CONTEXT ───────────────────────────────────────────────────────

    /**
     * Set trace ID for the current operation (thread-of-work correlation).
     * Call this at the start of a pipeline run, API request, etc.
     */
    setTrace(traceId) {
        this._currentTraceId = traceId;
        return this;
    }

    clearTrace() {
        this._currentTraceId = null;
        return this;
    }

    _generateTraceId() {
        return `ht-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
    }

    // ─── STATUS & INSPECTION ─────────────────────────────────────────────────

    getStatus() {
        const topEvents = [...this._metrics.byEvent.entries()]
            .sort((a, b) => b[1].emits - a[1].emits)
            .slice(0, 13) // fib(7) top events
            .map(([name, m]) => ({ event: name, emits: m.emits, lastTs: new Date(m.lastTs).toISOString() }));

        return {
            totalEmissions: this._metrics.totalEmissions,
            totalDeliveries: this._metrics.totalDeliveries,
            totalDeadLetters: this._metrics.totalDeadLetters,
            historySize: this._history.length,
            deadLetterQueueSize: this._deadLetter.length,
            registeredEvents: this._metrics.byEvent.size,
            activeListenerCount: this.eventNames().reduce((sum, n) => sum + this.listenerCount(n), 0),
            topEvents,
            phi: PHI,
        };
    }

    getHistory(limit = 21) {
        return this._history.slice(-Math.min(limit, MAX_HISTORY)).reverse();
    }

    getDeadLetters(limit = 13) {
        return this._deadLetter.slice(-Math.min(limit, MAX_DEAD_LETTER)).reverse();
    }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance = null;

/**
 * Get or create the singleton HeadyEventBus.
 * This is the ONLY way to get the bus — ensures process-wide singleton.
 */
function getEventBus() {
    if (!_instance) {
        _instance = new HeadyEventBus();
        // Replace global.eventBus with the structured instance
        global.eventBus = _instance;
        log('info', 'HeadyEventBus singleton created and set as global.eventBus');
    }
    return _instance;
}

// ─── Express Routes ───────────────────────────────────────────────────────────

function registerRoutes(app, bus) {
    const b = bus || getEventBus();

    app.get('/api/event-bus/status', (_req, res) => res.json({ ok: true, ...b.getStatus() }));
    app.get('/api/event-bus/history', (req, res) => {
        const limit = parseInt(req.query.limit) || 21;
        res.json({ ok: true, history: b.getHistory(limit) });
    });
    app.get('/api/event-bus/dead-letters', (req, res) => {
        const limit = parseInt(req.query.limit) || 13;
        res.json({ ok: true, deadLetters: b.getDeadLetters(limit) });
    });
    app.post('/api/event-bus/emit', (req, res) => {
        const { event, data } = req.body || {};
        if (!event || typeof event !== 'string' || !/^[a-zA-Z0-9:_\-\.]+$/.test(event)) {
            return res.status(400).json({ ok: false, error: 'event name required and must be alphanumeric with :_-.' });
        }
        b.emit(event, { ...data, _source: 'api:manual-emit' });
        res.json({ ok: true, event, listeners: b.listenerCount(event) });
    });
}

// ─── Auto-initialize: replace global.eventBus at module load ─────────────────
// This ensures the first require() of this module installs the structured bus.
const _bus = getEventBus();

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
    HeadyEventBus,
    getEventBus,
    registerRoutes,
    PHI,
    FIB,
};
