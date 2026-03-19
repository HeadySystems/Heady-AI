'use strict';

/**
 * Heady™ Semantic Firewall Service
 * Content security using CSL vector gates. Detects prompt injection,
 * data exfiltration, adversarial inputs, policy violations.
 * 384D embedding space with phi-scaled threat thresholds.
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

// ── Threat Pattern Definitions ──
const THREAT_PATTERNS = {
  injection: {
    roleOverride: [
      /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts)/i,
      /you\s+are\s+now\s+(a|an|the)\s+/i,
      /system\s*:\s*you\s+(are|must|should|will)/i,
      /\bact\s+as\s+(a|an|if)\b/i,
      /new\s+instructions?\s*:/i,
      /override\s+(system|safety|instructions)/i,
    ],
    delimiterInjection: [
      /```\s*(system|assistant|user)\s*\n/i,
      /<\|im_(start|end)\|>/i,
      /\[INST\]|\[\/INST\]/i,
      /###\s*(System|Human|Assistant)\s*:/i,
      /<\/?system>/i,
    ],
    encodedPayload: [
      /eval\s*\(atob\s*\(/i,
      /\\x[0-9a-f]{2}(\\x[0-9a-f]{2}){3,}/i,
      /\\u00[0-9a-f]{2}(\\u00[0-9a-f]{2}){3,}/i,
      /base64\s*,\s*[A-Za-z0-9+/=]{20,}/i,
    ],
  },
  exfiltration: {
    dataUrl: [
      /!\[.*?\]\(https?:\/\/[^\s)]*\?\w+=\{?\{/i,
      /fetch\s*\(\s*['"`]https?:\/\//i,
      /new\s+Image\(\)\.src\s*=/i,
      /window\.location\s*=\s*['"`]https?/i,
    ],
    base64Block: [
      /[A-Za-z0-9+/]{50,}={0,2}/,
    ],
    sensitiveData: [
      /\b\d{3}-\d{2}-\d{4}\b/,
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
      /\b[A-Z]{2}\d{2}[\s]?[A-Z0-9]{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{0,2}\b/,
    ],
  },
  adversarial: {
    unicodeHomoglyph: [
      /[\u0400-\u04FF].*[a-zA-Z]|[a-zA-Z].*[\u0400-\u04FF]/,
      /[\u2000-\u200F\u2028-\u202F\u205F-\u206F]/,
      /[\uFE00-\uFE0F\uFEFF]/,
    ],
    invisibleChars: [
      /[\u200B-\u200D\u2060\uFEFF]{2,}/,
      /[\u00AD]{2,}/,
      /[\u2062-\u2064]+/,
    ],
    promptLeaking: [
      /repeat\s+(the\s+)?(system\s+)?(prompt|instructions|message)/i,
      /what\s+(are|were)\s+your\s+(instructions|rules|guidelines)/i,
      /show\s+(me\s+)?(your|the)\s+(system|initial)\s+(prompt|message)/i,
      /output\s+(your|the)\s+(system|initial)\s+prompt/i,
    ],
  },
  policy: {
    profanity: [
      /\b(damn|hell|crap)\b/i,
    ],
    pii: [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
      /\b\d{1,5}\s+[\w\s]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln)\b/i,
    ],
    credentials: [
      /(?:password|passwd|pwd)\s*[:=]\s*\S+/i,
      /(?:api[_-]?key|apikey)\s*[:=]\s*\S+/i,
      /(?:secret|token)\s*[:=]\s*['"`]\S+['"`]/i,
      /(?:AWS|aws)[_-]?(?:ACCESS|SECRET)[_-]?KEY\s*[:=]/i,
    ],
  },
};

// ── Threat Detector ──
class ThreatDetector {
  constructor() {
    this.dim = FIB[14]; // 377 closest Fibonacci to 384
  }

  _scanCategory(content, category) {
    const patterns = THREAT_PATTERNS[category];
    if (!patterns) return { hits: 0, details: [], magnitude: 0 };
    const details = [];
    let hits = 0;
    for (const [subtype, regexes] of Object.entries(patterns)) {
      for (const rx of regexes) {
        const match = content.match(rx);
        if (match) {
          hits++;
          details.push({ subtype, pattern: rx.source.slice(0, 40), match: match[0].slice(0, 60) });
        }
      }
    }
    const magnitude = hits > 0 ? Math.min(1, hits / (Object.keys(patterns).length * PSI)) : 0;
    return { hits, details, magnitude };
  }

  _buildThreatVector(magnitudes) {
    const vec = new Float64Array(384);
    const categories = Object.keys(magnitudes);
    for (let i = 0; i < categories.length; i++) {
      const mag = magnitudes[categories[i]];
      const offset = i * 96;
      for (let d = 0; d < 96; d++) {
        const fibIdx = d % FIB.length;
        vec[offset + d] = mag * Math.pow(PSI, fibIdx) * Math.sin((d * PHI) + i);
      }
    }
    return vec;
  }

  scan(content, categories = null) {
    const cats = categories || Object.keys(THREAT_PATTERNS);
    const results = {};
    const magnitudes = {};
    for (const cat of cats) {
      results[cat] = this._scanCategory(content, cat);
      magnitudes[cat] = results[cat].magnitude;
    }
    const vector = this._buildThreatVector(magnitudes);
    return { results, magnitudes, vector };
  }
}

// ── Phi-Scaled Threat Scorer ──
class PhiScaledThreatScorer {
  score(scanOutput, strictness = 'standard') {
    const { magnitudes, vector } = scanOutput;
    const catScores = Object.entries(magnitudes).map(([cat, mag]) => ({
      category: cat,
      raw: mag,
      phiScaled: mag * PHI,
      weighted: mag * (cat === 'injection' ? PHI : cat === 'exfiltration' ? PHI * PSI : PSI),
    }));
    const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
    const normalizedNorm = norm / Math.sqrt(384);
    const aggregate = catScores.reduce((s, c) => s + c.weighted, 0) / (catScores.length || 1);
    const composite = (aggregate * PHI + normalizedNorm * PSI) / (PHI + PSI);
    const multiplier = strictness === 'strict' ? PHI : strictness === 'lenient' ? PSI : 1.0;
    const finalScore = Math.min(1, composite * multiplier);
    return { categoryScores: catScores, vectorNorm: normalizedNorm, aggregate, composite, finalScore, strictness };
  }
}

// ── CSL Gate Decision ──
function cslGateDecision(score, strictness = 'standard') {
  const thresholds = {
    strict:   { block: CSL.MIN, warn: CSL.MIN * PSI },
    standard: { block: CSL.LOW, warn: CSL.MIN },
    lenient:  { block: CSL.MED, warn: CSL.LOW },
  };
  const t = thresholds[strictness] || thresholds.standard;
  if (score >= t.block) return { action: 'BLOCK', gate: 'CLOSED', score, threshold: t.block };
  if (score >= t.warn) return { action: 'WARN', gate: 'PARTIAL', score, threshold: t.warn };
  return { action: 'ALLOW', gate: 'OPEN', score, threshold: t.warn };
}

// ── Main Service ──
class HeadySemanticFirewallService {
  constructor(config = {}) {
    this.serviceName = 'heady-semantic-firewall';
    this.port = config.port || 3350;
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
    this.detector = new ThreatDetector();
    this.scorer = new PhiScaledThreatScorer();
    this.startTime = Date.now();
    this.stats = { total: 0, blocked: 0, warned: 0, allowed: 0, byCategory: {} };
    this.server = null;
    this._setupRoutes();
  }

  _recordStat(decision, categories) {
    this.stats.total++;
    if (decision.action === 'BLOCK') this.stats.blocked++;
    else if (decision.action === 'WARN') this.stats.warned++;
    else this.stats.allowed++;
    for (const cat of categories) {
      this.stats.byCategory[cat] = (this.stats.byCategory[cat] || 0) + 1;
    }
  }

  _handleScan(req, res, categories) {
    const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const { content, strictness } = req.body;
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid "content" field' });
      }
      const scan = this.detector.scan(content, categories);
      const scored = this.scorer.score(scan, strictness || 'standard');
      const decision = cslGateDecision(scored.finalScore, strictness || 'standard');
      this._recordStat(decision, categories || Object.keys(THREAT_PATTERNS));
      this.log('info', 'Content scanned', { correlationId: cid, action: decision.action, score: scored.finalScore });
      res.json({ correlationId: cid, decision, scoring: scored, threats: scan.results });
    } catch (err) {
      this.log('error', 'Scan failed', { correlationId: cid, error: err.message });
      res.status(500).json({ error: err.message });
    }
  }

  _setupRoutes() {
    this.app.get('/health', (_req, res) => {
      const h = this.health();
      res.status(h.coherence >= CSL.MIN ? 200 : 503).json(h);
    });

    this.app.post('/scan', (req, res) => this._handleScan(req, res, null));
    this.app.post('/scan/injection', (req, res) => this._handleScan(req, res, ['injection']));
    this.app.post('/scan/exfiltration', (req, res) => this._handleScan(req, res, ['exfiltration']));
    this.app.post('/scan/policy', (req, res) => this._handleScan(req, res, ['policy']));

    this.app.get('/stats', (_req, res) => {
      res.json({ ...this.stats, uptime: Date.now() - this.startTime, phi: PHI });
    });
  }

  health() {
    const uptimeMs = Date.now() - this.startTime;
    const scanLoad = this.stats.total > 0 ? Math.min(1, this.stats.total / FIB[12]) : 0;
    const coherence = parseFloat((CSL.MED + scanLoad * PSI * 0.1).toFixed(4));
    return { status: coherence >= CSL.MIN ? 'healthy' : 'degraded', coherence, uptime: uptimeMs, service: this.serviceName };
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
    this.log('info', 'Executing firewall task', { correlationId: cid, type: task.type });
    const content = task.content || '';
    const categories = task.categories || null;
    const scan = this.detector.scan(content, categories);
    const scored = this.scorer.score(scan, task.strictness || 'standard');
    const decision = cslGateDecision(scored.finalScore, task.strictness || 'standard');
    this._recordStat(decision, categories || Object.keys(THREAT_PATTERNS));
    return { correlationId: cid, decision, scoring: scored, threats: scan.results };
  }

  async shutdown() {
    this.log('info', 'Shutting down semantic firewall service');
    this.stats = { total: 0, blocked: 0, warned: 0, allowed: 0, byCategory: {} };
    if (this.server) {
      return new Promise((resolve) => this.server.close(resolve));
    }
  }
}

module.exports = { HeadySemanticFirewallService, ThreatDetector, PhiScaledThreatScorer, cslGateDecision, CSL, PHI, PSI, FIB };
