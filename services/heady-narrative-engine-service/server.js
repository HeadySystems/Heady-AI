'use strict';

/**
 * Heady™ Narrative Engine Service
 * Story-driven interaction choreography. Models sessions as narrative arcs
 * with phi-proportioned acts. Tracks emotional tone, choreographs pacing
 * with Fibonacci timing.
 */

const crypto = require('crypto');
const express = require('express');

// ── Phi-Math Constants ──
const PHI = 1.618033988749895;
const PSI = 0.6180339887498949;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

// ── CSL Gate Thresholds ──
const CSL = { MIN: 0.500, LOW: 0.691, MED: 0.809, HIGH: 0.882, CRIT: 0.927, DEDUP: 0.972 };

// ── Structured Logger ──
function createLogger(service) {
  return (level, message, meta = {}) => {
    const entry = {
      timestamp: new Date().toISOString(),
      correlationId: meta.correlationId || crypto.randomUUID(),
      service,
      level,
      message,
      ...meta,
    };
    process.stdout.write(JSON.stringify(entry) + '\n');
    return entry;
  };
}

// ── Emotional Tone Tracker ──
class EmotionalTone {
  constructor() {
    this.valence = 0.0;
    this.arousal = 0.0;
    this.dominance = 0.0;
    this.history = [];
  }

  update(valence, arousal, dominance) {
    this.valence = this.valence * PSI + valence * (1 - PSI);
    this.arousal = this.arousal * PSI + arousal * (1 - PSI);
    this.dominance = this.dominance * PSI + dominance * (1 - PSI);
    this.history.push({ valence: this.valence, arousal: this.arousal, dominance: this.dominance, t: Date.now() });
    return this.snapshot();
  }

  snapshot() {
    const magnitude = Math.sqrt(this.valence ** 2 + this.arousal ** 2 + this.dominance ** 2);
    return { valence: this.valence, arousal: this.arousal, dominance: this.dominance, magnitude, coherence: 1 / (1 + magnitude * PSI) };
  }
}

// ── Narrative Arc (5-Act Phi-Proportioned Structure) ──
class NarrativeArc {
  constructor(totalDuration) {
    this.totalDuration = totalDuration;
    const psi2 = PSI * PSI;
    const rawWeights = [psi2, PSI, 1.0, PSI, psi2];
    const sum = rawWeights.reduce((a, b) => a + b, 0);
    this.acts = [
      { name: 'setup', weight: psi2 / sum, duration: totalDuration * (psi2 / sum), beats: [] },
      { name: 'rising', weight: PSI / sum, duration: totalDuration * (PSI / sum), beats: [] },
      { name: 'climax', weight: 1.0 / sum, duration: totalDuration * (1.0 / sum), beats: [] },
      { name: 'falling', weight: PSI / sum, duration: totalDuration * (PSI / sum), beats: [] },
      { name: 'resolution', weight: psi2 / sum, duration: totalDuration * (psi2 / sum), beats: [] },
    ];
    this.currentAct = 0;
    this.elapsed = 0;
  }

  addBeat(beat) {
    const act = this.acts[this.currentAct];
    act.beats.push({ ...beat, actName: act.name, t: Date.now() });
    this.elapsed += beat.duration || 0;
    if (this.elapsed >= this._actCumulativeDuration(this.currentAct) && this.currentAct < 4) {
      this.currentAct++;
    }
    return { act: act.name, actIndex: this.currentAct, progress: this.progress() };
  }

  _actCumulativeDuration(index) {
    return this.acts.slice(0, index + 1).reduce((sum, a) => sum + a.duration, 0);
  }

  progress() {
    return Math.min(1.0, this.elapsed / this.totalDuration);
  }

  snapshot() {
    return {
      currentAct: this.acts[this.currentAct].name,
      actIndex: this.currentAct,
      progress: parseFloat(this.progress().toFixed(4)),
      elapsed: this.elapsed,
      totalDuration: this.totalDuration,
      acts: this.acts.map((a) => ({ name: a.name, weight: parseFloat(a.weight.toFixed(4)), duration: Math.round(a.duration), beatCount: a.beats.length })),
    };
  }
}

// ── Pacing Engine (Fibonacci-Timed Beats) ──
class PacingEngine {
  constructor(baseInterval) {
    this.baseInterval = baseInterval || FIB[7] * 100;
    this.schedule = [];
    this._buildSchedule();
  }

  _buildSchedule() {
    let cursor = 0;
    for (let i = 2; i < FIB.length && cursor < this.baseInterval * PHI * 3; i++) {
      const interval = FIB[i] * this.baseInterval / FIB[10];
      cursor += interval;
      const intensity = 1 / (1 + Math.abs(cursor - this.baseInterval * PHI) / this.baseInterval);
      this.schedule.push({ index: i - 2, time: Math.round(cursor), interval: Math.round(interval), intensity: parseFloat(intensity.toFixed(4)), fib: FIB[i] });
    }
  }

  getSchedule() {
    return { baseInterval: this.baseInterval, beatCount: this.schedule.length, beats: this.schedule, phiPeak: Math.round(this.baseInterval * PHI) };
  }
}

// ── Narrative Session ──
class NarrativeSession {
  constructor(id, config = {}) {
    this.id = id;
    this.createdAt = Date.now();
    this.arc = new NarrativeArc(config.duration || FIB[14] * 1000);
    this.tone = new EmotionalTone();
    this.pacing = new PacingEngine(config.baseInterval);
    this.beats = [];
    this.metadata = config.metadata || {};
  }

  addBeat(beat) {
    const arcResult = this.arc.addBeat(beat);
    this.beats.push({ ...beat, id: crypto.randomUUID().slice(0, 8), ...arcResult, t: Date.now() });
    return { beatIndex: this.beats.length - 1, ...arcResult, tone: this.tone.snapshot() };
  }

  coherence() {
    const arcProgress = this.arc.progress();
    const toneCoherence = this.tone.snapshot().coherence;
    return parseFloat((arcProgress * PSI + toneCoherence * (1 - PSI)).toFixed(4));
  }
}

// ── Main Service ──
class HeadyNarrativeEngineService {
  constructor(config = {}) {
    this.serviceName = 'heady-narrative-engine';
    this.port = config.port || 3341;
    this.log = createLogger(this.serviceName);
    this.app = express();
    this.app.use(express.json({ limit: '2mb' }));

    // Security headers
    this.app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      next();
    });
    this.sessions = new Map();
    this.startTime = Date.now();
    this.requestCount = 0;
    this.server = null;
    this._setupRoutes();
  }

  _setupRoutes() {
    this.app.get('/health', (_req, res) => {
      const h = this.health();
      res.status(h.coherence >= CSL.MIN ? 200 : 503).json(h);
    });

    this.app.post('/session', (req, res) => {
      const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
      this.requestCount++;
      try {
        const id = `narr_${crypto.randomUUID().slice(0, 8)}`;
        const session = new NarrativeSession(id, req.body || {});
        this.sessions.set(id, session);
        this.log('info', 'Narrative session created', { correlationId: cid, sessionId: id });
        res.json({ sessionId: id, arc: session.arc.snapshot(), pacing: session.pacing.getSchedule() });
      } catch (err) {
        this.log('error', 'Session creation failed', { correlationId: cid, error: err.message });
        res.status(400).json({ error: err.message });
      }
    });

    this.app.post('/session/:id/beat', (req, res) => {
      const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
      this.requestCount++;
      const session = this.sessions.get(req.params.id);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      try {
        const result = session.addBeat(req.body || {});
        this.log('info', 'Beat added', { correlationId: cid, sessionId: req.params.id, act: result.act });
        res.json(result);
      } catch (err) {
        this.log('error', 'Beat addition failed', { correlationId: cid, error: err.message });
        res.status(400).json({ error: err.message });
      }
    });

    this.app.get('/session/:id/arc', (req, res) => {
      const session = this.sessions.get(req.params.id);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      res.json({ sessionId: session.id, coherence: session.coherence(), ...session.arc.snapshot() });
    });

    this.app.post('/session/:id/tone', (req, res) => {
      const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
      this.requestCount++;
      const session = this.sessions.get(req.params.id);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      try {
        const { valence = 0, arousal = 0, dominance = 0 } = req.body || {};
        const tone = session.tone.update(valence, arousal, dominance);
        this.log('info', 'Tone updated', { correlationId: cid, sessionId: req.params.id, magnitude: tone.magnitude });
        res.json({ sessionId: session.id, tone, coherence: session.coherence() });
      } catch (err) {
        this.log('error', 'Tone update failed', { correlationId: cid, error: err.message });
        res.status(400).json({ error: err.message });
      }
    });

    this.app.get('/session/:id/pacing', (req, res) => {
      const session = this.sessions.get(req.params.id);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      res.json({ sessionId: session.id, ...session.pacing.getSchedule(), currentAct: session.arc.snapshot().currentAct });
    });
  }

  health() {
    const uptimeMs = Date.now() - this.startTime;
    const sessionCount = this.sessions.size;
    const coherence = sessionCount > 0 ? Math.min(CSL.HIGH, CSL.MED + sessionCount * PSI * 0.01) : CSL.LOW;
    return {
      status: coherence >= CSL.MIN ? 'healthy' : 'degraded',
      coherence: parseFloat(coherence.toFixed(4)),
      uptime: uptimeMs,
      service: this.serviceName,
      sessions: sessionCount,
      requests: this.requestCount,
      phi: PHI,
    };
  }

  async init() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        this.log('info', `${this.serviceName} initialized`, { port: this.port, phi: PHI });
        resolve();
      });
    });
  }

  async execute(task) {
    const cid = crypto.randomUUID();
    this.log('info', 'Executing narrative task', { correlationId: cid, task: task.type });
    const id = `task_${cid.slice(0, 8)}`;
    const session = new NarrativeSession(id, task.config || {});
    this.sessions.set(id, session);
    if (task.beats) task.beats.forEach((b) => session.addBeat(b));
    if (task.tone) session.tone.update(task.tone.valence || 0, task.tone.arousal || 0, task.tone.dominance || 0);
    return { sessionId: id, arc: session.arc.snapshot(), tone: session.tone.snapshot(), coherence: session.coherence() };
  }

  async shutdown() {
    this.log('info', 'Shutting down narrative engine service');
    this.sessions.clear();
    if (this.server) {
      return new Promise((resolve) => this.server.close(resolve));
    }
  }
}

module.exports = { HeadyNarrativeEngineService, NarrativeArc, EmotionalTone, PacingEngine, NarrativeSession, CSL, PHI, PSI, FIB };
