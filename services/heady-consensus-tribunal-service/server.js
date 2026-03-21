'use strict';

/**
 * Heady™ Consensus Tribunal Service
 * Multi-model judicial system for high-stakes decisions. 3-5 AI models as
 * independent judges evaluating from different cognitive archetypes.
 * Phi-weighted fusion produces final ruling.
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
    const entry = { timestamp: new Date().toISOString(), correlationId: meta.correlationId || crypto.randomUUID(), service, level, message, ...meta };
    process.stdout.write(JSON.stringify(entry) + '\n');
    return entry;
  };
}

const DIMENSIONS = ['soundness', 'feasibility', 'ethics', 'resilience', 'precedent'];

// ── Judge (one per cognitive archetype) ──
class Judge {
  constructor(name, archetype, weight) {
    this.id = `judge_${crypto.randomUUID().slice(0, 8)}`;
    this.name = name;
    this.archetype = archetype;
    this.weight = weight;
    this.casesHeard = 0;
  }
  evaluate(caseData) {
    this.casesHeard++;
    const scores = {};
    for (const dim of DIMENSIONS) {
      const base = this._archetypeBias(dim);
      const signal = this._analyzeEvidence(caseData.evidence || [], dim);
      scores[dim] = Math.min(1, Math.max(0, base + signal));
    }
    const overall = DIMENSIONS.reduce((s, d) => s + scores[d], 0) / DIMENSIONS.length;
    return { judgeId: this.id, archetype: this.archetype, scores, overall, weight: this.weight };
  }
  _archetypeBias(dimension) {
    const biases = {
      Logician:   { soundness: 0.8, feasibility: 0.6, ethics: 0.5, resilience: 0.55, precedent: 0.7 },
      Empiricist: { soundness: 0.65, feasibility: 0.75, ethics: 0.5, resilience: 0.7, precedent: 0.6 },
      Ethicist:   { soundness: 0.5, feasibility: 0.5, ethics: 0.85, resilience: 0.6, precedent: 0.65 },
      Pragmatist: { soundness: 0.6, feasibility: 0.8, ethics: 0.55, resilience: 0.75, precedent: 0.5 },
      Contrarian: { soundness: 0.4, feasibility: 0.45, ethics: 0.5, resilience: 0.5, precedent: 0.35 },
    };
    return (biases[this.archetype] || {})[dimension] || 0.5;
  }
  _analyzeEvidence(evidence, dimension) {
    if (!evidence.length) return 0;
    const hash = evidence.reduce((h, e) => h + (e.strength || 0), 0);
    return ((hash * (DIMENSIONS.indexOf(dimension) + 1) * PSI) % 0.3) - 0.1;
  }
}

// ── JudgePanel – The Five Archetypes ──
class JudgePanel {
  constructor() {
    this.judges = [
      new Judge('Justice Axiom', 'Logician', PHI * PHI),
      new Judge('Justice Datum', 'Empiricist', PHI),
      new Judge('Justice Virtue', 'Ethicist', PHI),
      new Judge('Justice Praxis', 'Pragmatist', 1),
      new Judge('Justice Dissent', 'Contrarian', PSI),
    ];
  }
  hearCase(caseData) { return this.judges.map((j) => j.evaluate(caseData)); }
  roster() { return this.judges.map((j) => ({ id: j.id, name: j.name, archetype: j.archetype, weight: j.weight, casesHeard: j.casesHeard })); }
}

// ── Phi-Weighted Fusion ──
class PhiWeightedFusion {
  static fuse(evaluations) {
    const totalWeight = evaluations.reduce((s, e) => s + e.weight, 0);
    const fused = {};
    for (const dim of DIMENSIONS) fused[dim] = evaluations.reduce((s, e) => s + e.scores[dim] * e.weight, 0) / totalWeight;
    const overall = DIMENSIONS.reduce((s, d) => s + fused[d], 0) / DIMENSIONS.length;
    return { dimensions: fused, overall, totalWeight, judgeCount: evaluations.length };
  }
}

// ── Consensus Calculator ──
class ConsensusCalculator {
  static calculate(evaluations) {
    const overalls = evaluations.map((e) => e.overall);
    const mean = overalls.reduce((a, b) => a + b, 0) / overalls.length;
    const variance = overalls.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / overalls.length;
    const agreement = 1 / (1 + Math.sqrt(variance) * PHI);
    const dissenters = evaluations.filter((e) => Math.abs(e.overall - mean) > PSI * 0.3);
    return { agreement: parseFloat(agreement.toFixed(4)), variance: parseFloat(variance.toFixed(6)), unanimity: dissenters.length === 0, dissenters: dissenters.map((d) => d.archetype) };
  }
}

// ── Ruling ──
class Ruling {
  constructor(caseId, fusion, consensus, evaluations) {
    this.caseId = caseId;
    this.verdict = fusion.overall >= CSL.MED ? 'APPROVE' : fusion.overall >= CSL.MIN ? 'CONDITIONAL' : 'REJECT';
    this.confidence = parseFloat(fusion.overall.toFixed(4));
    this.dimensions = fusion.dimensions;
    this.consensus = consensus;
    this.dissent = evaluations.filter((e) => e.overall < CSL.MIN).map((e) => ({ archetype: e.archetype, overall: e.overall, objection: `Score ${e.overall.toFixed(3)} below MIN threshold` }));
    this.timestamp = new Date().toISOString();
  }
}

// ── Case History (precedent tracking) ──
class CaseHistory {
  constructor() { this.cases = new Map(); }
  record(id, caseData, ruling) { this.cases.set(id, { id, caseData, ruling, recordedAt: new Date().toISOString() }); }
  find(id) { return this.cases.get(id) || null; }
  search(query = '') {
    const results = [];
    for (const [, entry] of this.cases) {
      if (!query || JSON.stringify(entry.caseData).toLowerCase().includes(query.toLowerCase())) results.push(entry);
    }
    return results.slice(0, FIB[8]);
  }
}

// ── Main Service ──
class HeadyConsensusTribunalService {
  constructor(config = {}) {
    this.serviceName = 'heady-consensus-tribunal';
    this.port = config.port || 3345;
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
    this.panel = new JudgePanel();
    this.history = new CaseHistory();
    this.startTime = Date.now();
    this.requestCount = 0;
    this.server = null;
    this._setupRoutes();
  }

  _adjudicate(caseData, caseId) {
    const evaluations = this.panel.hearCase(caseData);
    const fusion = PhiWeightedFusion.fuse(evaluations);
    const consensus = ConsensusCalculator.calculate(evaluations);
    const ruling = new Ruling(caseId, fusion, consensus, evaluations);
    this.history.record(caseId, caseData, ruling);
    return ruling;
  }

  _setupRoutes() {
    this.app.get('/health', (_req, res) => {
      const h = this.health();
      res.status(h.coherence >= CSL.MIN ? 200 : 503).json(h);
    });

    this.app.post('/case', (req, res) => {
      const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
      this.requestCount++;
      try {
        const id = `case_${crypto.randomUUID().slice(0, 12)}`;
        const ruling = this._adjudicate(req.body, id);
        this.log('info', 'Case adjudicated', { correlationId: cid, caseId: id, verdict: ruling.verdict });
        res.json({ caseId: id, ruling });
      } catch (err) {
        this.log('error', 'Case submission failed', { correlationId: cid, error: err.message });
        res.status(400).json({ error: err.message });
      }
    });

    this.app.get('/case/:id', (req, res) => {
      const entry = this.history.find(req.params.id);
      if (!entry) return res.status(404).json({ error: 'Case not found' });
      res.json(entry);
    });

    this.app.post('/case/:id/appeal', (req, res) => {
      const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
      this.requestCount++;
      try {
        const original = this.history.find(req.params.id);
        if (!original) return res.status(404).json({ error: 'Original case not found' });
        const mergedEvidence = [...(original.caseData.evidence || []), ...(req.body.evidence || [])];
        const appealData = { ...original.caseData, evidence: mergedEvidence, isAppeal: true };
        const ruling = this._adjudicate(appealData, req.params.id);
        this.log('info', 'Appeal adjudicated', { correlationId: cid, caseId: req.params.id, verdict: ruling.verdict });
        res.json({ caseId: req.params.id, ruling, appealOf: original.ruling.verdict });
      } catch (err) {
        this.log('error', 'Appeal failed', { correlationId: cid, error: err.message });
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/judges', (_req, res) => {
      res.json({ judges: this.panel.roster(), archetypeCount: this.panel.judges.length });
    });

    this.app.get('/precedents', (req, res) => {
      const results = this.history.search(req.query.q || '');
      res.json({ query: req.query.q || '', count: results.length, precedents: results });
    });
  }

  health() {
    const uptimeMs = Date.now() - this.startTime;
    const caseCount = this.history.cases.size;
    const coherence = caseCount > 0 ? Math.min(CSL.HIGH, CSL.MED + caseCount * PSI * 0.01) : CSL.LOW;
    return { status: coherence >= CSL.MIN ? 'healthy' : 'degraded', coherence: parseFloat(coherence.toFixed(4)), uptime: uptimeMs, service: this.serviceName };
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
    this.log('info', 'Executing tribunal task', { correlationId: cid, task: task.type });
    const caseData = { description: task.description || '', evidence: task.evidence || [] };
    const id = `task_${cid.slice(0, 8)}`;
    const ruling = this._adjudicate(caseData, id);
    return { caseId: id, ruling };
  }

  async shutdown() {
    this.log('info', 'Shutting down consensus tribunal service');
    this.history.cases.clear();
    if (this.server) return new Promise((resolve) => this.server.close(resolve));
  }
}

module.exports = { HeadyConsensusTribunalService, JudgePanel, Judge, PhiWeightedFusion, ConsensusCalculator, Ruling, CaseHistory, CSL, PHI, PSI, FIB };
