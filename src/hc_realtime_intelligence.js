'use strict';

/**
 * RealtimeIntelligenceEngine
 * Event ingestion, Ableton session management, and flush pipeline.
 */

class RealtimeIntelligenceEngine {
    constructor(opts) {
        opts = opts || {};
        this.cfg = {
            flushIntervalMs: opts.flushIntervalMs || 30000,
            maxQueueDepth: opts.maxQueueDepth || 10000,
        };
        this.queue = [];
        this.metrics = {
            queued: 0,
            dropped: 0,
            delivered: 0,
            flushes: 0,
            externalIngested: 0,
        };
        this.abletonSession = null;
        this._timer = null;
    }

    ingest(event) {
        if (this.queue.length >= this.cfg.maxQueueDepth) {
            this.metrics.dropped++;
            return false;
        }
        this.queue.push({ ...event, _ingestedAt: Date.now() });
        this.metrics.queued++;
        return true;
    }

    ingestExternalEvent(event) {
        if (this.queue.length >= this.cfg.maxQueueDepth) {
            this.metrics.dropped++;
            return { ok: false, queued: false, immediateFlush: false };
        }
        this.queue.push({ ...event, _external: true, _ingestedAt: Date.now() });
        this.metrics.externalIngested++;

        const immediateFlush = event.priority === 'high';
        if (immediateFlush) {
            this._flush();
        }

        return { ok: true, queued: true, immediateFlush };
    }

    startAbletonSession(opts) {
        opts = opts || {};
        this.abletonSession = {
            bpm: opts.bpm || 120,
            midiEvents: 0,
            startedAt: Date.now(),
        };
        return { ...this.abletonSession };
    }

    stopAbletonSession() {
        if (!this.abletonSession) return { ok: false };
        const session = { ...this.abletonSession, endedAt: Date.now() };
        this.abletonSession = null;
        return session;
    }

    routeAbletonMidi(midiEvent) {
        if (!this.abletonSession) {
            return { ok: false, error: 'no active Ableton session' };
        }
        const start = Date.now();
        this.abletonSession.midiEvents++;
        this.ingest({ type: 'ableton-midi', ...midiEvent });
        return {
            ok: true,
            sessionMidiCount: this.abletonSession.midiEvents,
            latencyMs: Date.now() - start,
        };
    }

    getStatus() {
        return {
            running: !!this._timer,
            queueDepth: this.queue.length,
            metrics: { ...this.metrics },
            abletonSession: this.abletonSession ? { ...this.abletonSession } : null,
        };
    }

    async _flush() {
        const batch = this.queue.splice(0, this.queue.length);
        this.metrics.delivered += batch.length;
        this.metrics.flushes++;
        return { flushed: batch.length };
    }
}

module.exports = { RealtimeIntelligenceEngine };
