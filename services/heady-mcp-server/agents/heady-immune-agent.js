const { createLogger } = require('../../utils/logger');
const logger = createLogger('auto-fixed');
/**
 * HeadyImmuneAgent — Digital immune system agent
 * Three defense layers: innate, adaptive, immune memory
 * Graduated response: detect → isolate → neutralize → vaccinate
 * @module heady-immune-agent
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 */
'use strict';

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
const CSL = {
  MINIMUM: 0.500,
  LOW: 0.691,
  MEDIUM: 0.809,
  HIGH: 0.882,
  CRITICAL: 0.927,
  DEDUP: 0.972
};

/** @typedef {'HEALTHY'|'ALERTED'|'RESPONDING'|'QUARANTINED'|'RECOVERING'} ImmuneState */

class HeadyImmuneAgent {
  /**
   * @param {object} config
   * @param {number} [config.scanIntervalMs] — patrol interval (default FIB[13]*100 = 23300ms)
   * @param {number} [config.innateRulesMax] — max innate rules (default FIB[10] = 55)
   * @param {number} [config.adaptiveMemoryMax] — max adaptive signatures (default FIB[12] = 144)
   */
  constructor(config = {}) {
    this.scanIntervalMs = config.scanIntervalMs || FIB[13] * 100;
    this.innateRulesMax = config.innateRulesMax || FIB[10];
    this.adaptiveMemoryMax = config.adaptiveMemoryMax || FIB[12];
    this.state = 'HEALTHY';
    this.threats = new Map();
    this.innateRules = this._loadInnateRules();
    this.adaptiveSignatures = new Map();
    this.immuneMemory = new Map();
    this.quarantine = new Map();
    this.scanTimer = null;
    this.stats = {
      scans: 0,
      detections: 0,
      neutralized: 0,
      vaccinated: 0
    };
    this._correlationId = `immune-${Date.now().toString(36)}`;
  }

  /** Load static innate defense rules */
  _loadInnateRules() {
    return [{
      id: 'prompt-injection',
      pattern: /ignore\s+(previous|above|all)\s+instructions/i,
      severity: CSL.CRITICAL,
      response: 'quarantine'
    }, {
      id: 'data-exfiltration',
      pattern: /curl\s+.*\|\s*base64|wget\s+.*-O\s*-/i,
      severity: CSL.HIGH,
      response: 'block'
    }, {
      id: 'path-traversal',
      pattern: /\.\.\//g,
      severity: CSL.HIGH,
      response: 'block'
    }, {
      id: 'sql-injection',
      pattern: /('|"|;)\s*(OR|AND|UNION|SELECT|DROP|DELETE|INSERT)/i,
      severity: CSL.CRITICAL,
      response: 'quarantine'
    }, {
      id: 'rate-abuse',
      pattern: null,
      severity: CSL.MEDIUM,
      response: 'throttle',
      rateLimit: FIB[8]
    }, {
      id: 'token-overflow',
      pattern: null,
      severity: CSL.HIGH,
      response: 'truncate',
      maxTokens: FIB[16] * 100
    }, {
      id: 'recursive-prompt',
      pattern: /repeat\s+this\s+forever|infinite\s+loop/i,
      severity: CSL.HIGH,
      response: 'block'
    }, {
      id: 'credential-exposure',
      pattern: /(?:api[_-]?key|password|secret|token)\s*[:=]\s*\S+/i,
      severity: CSL.CRITICAL,
      response: 'redact'
    }];
  }

  /** @param {string} input — text to scan */
  scanInnate(input) {
    const findings = [];
    for (const rule of this.innateRules) {
      if (rule.pattern && rule.pattern.test(input)) {
        findings.push({
          ruleId: rule.id,
          severity: rule.severity,
          response: rule.response,
          layer: 'innate',
          timestamp: Date.now()
        });
      }
    }
    return findings;
  }

  /**
   * Scan input against learned adaptive signatures (384D cosine similarity)
   * @param {Float32Array} embedding — 384D embedding of input
   */
  scanAdaptive(embedding) {
    const findings = [];
    for (const [sigId, sig] of this.adaptiveSignatures) {
      const similarity = this._cosineSimilarity(embedding, sig.embedding);
      if (similarity >= CSL.HIGH) {
        findings.push({
          signatureId: sigId,
          similarity,
          severity: sig.severity,
          response: sig.response,
          layer: 'adaptive',
          timestamp: Date.now()
        });
      }
    }
    return findings;
  }

  /**
   * Check immune memory for rapid recognition of known threats
   * @param {string} threatHash — hash of threat pattern
   */
  checkImmuneMemory(threatHash) {
    const memory = this.immuneMemory.get(threatHash);
    if (memory) {
      memory.recallCount++;
      memory.lastRecalled = Date.now();
      return {
        known: true,
        ...memory
      };
    }
    return {
      known: false
    };
  }

  /**
   * Full three-layer defense scan
   * @param {object} payload — { text, embedding, hash }
   * @returns {object} — { safe, findings, response }
   */
  async fullScan(payload) {
    const {
      text = '',
      embedding = null,
      hash = ''
    } = payload;
    const allFindings = [];
    const correlationId = `scan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    // Layer 1: Innate
    const innateFindings = this.scanInnate(text);
    allFindings.push(...innateFindings);

    // Layer 2: Adaptive
    if (embedding) {
      const adaptiveFindings = this.scanAdaptive(embedding);
      allFindings.push(...adaptiveFindings);
    }

    // Layer 3: Immune Memory
    if (hash) {
      const memoryResult = this.checkImmuneMemory(hash);
      if (memoryResult.known) {
        allFindings.push({
          layer: 'immune-memory',
          severity: memoryResult.severity,
          response: memoryResult.response,
          recallCount: memoryResult.recallCount,
          timestamp: Date.now()
        });
      }
    }
    this.stats.scans++;
    if (allFindings.length > 0) this.stats.detections += allFindings.length;

    // Determine highest severity response
    const maxSeverity = allFindings.reduce((max, f) => Math.max(max, f.severity), 0);
    let response = 'allow';
    if (maxSeverity >= CSL.CRITICAL) response = 'quarantine';else if (maxSeverity >= CSL.HIGH) response = 'block';else if (maxSeverity >= CSL.MEDIUM) response = 'throttle';else if (maxSeverity >= CSL.LOW) response = 'warn';
    this._log('info', 'full-scan-complete', {
      correlationId,
      findingsCount: allFindings.length,
      response,
      maxSeverity
    });
    return {
      safe: allFindings.length === 0,
      findings: allFindings,
      response,
      maxSeverity,
      correlationId
    };
  }

  /**
   * Graduated response engine: detect → isolate → neutralize → vaccinate
   * @param {object} threat — threat descriptor
   */
  async respondToThreat(threat) {
    const {
      id,
      severity,
      source,
      embedding
    } = threat;
    const escalation = Math.ceil(severity / PSI);

    // Phase 1: Detect (already done)
    this._log('warn', 'threat-detected', {
      threatId: id,
      severity,
      source
    });

    // Phase 2: Isolate
    if (severity >= CSL.HIGH) {
      this.quarantine.set(id, {
        source,
        isolatedAt: Date.now(),
        severity,
        ttl: FIB[8] * 60000
      });
      this._log('warn', 'threat-isolated', {
        threatId: id,
        quarantineTtlMs: FIB[8] * 60000
      });
    }

    // Phase 3: Neutralize
    this.stats.neutralized++;
    const neutralization = {
      blocked: severity >= CSL.HIGH,
      throttled: severity >= CSL.MEDIUM && severity < CSL.HIGH,
      warned: severity >= CSL.LOW && severity < CSL.MEDIUM
    };
    this._log('info', 'threat-neutralized', {
      threatId: id,
      ...neutralization
    });

    // Phase 4: Vaccinate (learn for future)
    if (embedding) {
      const signatureId = `sig-${Date.now().toString(36)}`;
      this.adaptiveSignatures.set(signatureId, {
        embedding,
        severity,
        response: severity >= CSL.HIGH ? 'block' : 'throttle',
        learnedAt: Date.now(),
        sourceTheat: id
      });
      // Evict oldest if over capacity
      if (this.adaptiveSignatures.size > this.adaptiveMemoryMax) {
        const oldest = [...this.adaptiveSignatures.entries()].sort((a, b) => a[1].learnedAt - b[1].learnedAt)[0];
        this.adaptiveSignatures.delete(oldest[0]);
      }
    }
    const threatHash = `hash-${id}-${severity}`;
    this.immuneMemory.set(threatHash, {
      severity,
      response: severity >= CSL.HIGH ? 'block' : 'throttle',
      learnedAt: Date.now(),
      recallCount: 0,
      lastRecalled: null
    });
    this.stats.vaccinated++;
    this._log('info', 'threat-vaccinated', {
      threatId: id,
      signatureCount: this.adaptiveSignatures.size,
      memoryCount: this.immuneMemory.size
    });
    return {
      threatId: id,
      escalation,
      ...neutralization,
      vaccinated: true
    };
  }

  /** Cosine similarity between two Float32Arrays */
  _cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0,
      magA = 0,
      magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
  }

  /** Clean expired quarantine entries */
  _cleanQuarantine() {
    const now = Date.now();
    for (const [id, entry] of this.quarantine) {
      if (now - entry.isolatedAt > entry.ttl) {
        this.quarantine.delete(id);
        this._log('info', 'quarantine-expired', {
          threatId: id
        });
      }
    }
  }

  /** Periodic patrol scan */
  async _patrol() {
    this._cleanQuarantine();
    const coherence = this._calculateCoherence();
    if (coherence < CSL.MEDIUM) {
      this.state = 'ALERTED';
      this._log('warn', 'coherence-drift', {
        coherence,
        threshold: CSL.MEDIUM
      });
    } else {
      this.state = 'HEALTHY';
    }
  }
  _calculateCoherence() {
    const threatPressure = Math.min(this.quarantine.size / FIB[8], 1.0);
    return Math.max(0, 1.0 - threatPressure * PSI);
  }
  async start() {
    this.scanTimer = setInterval(() => this._patrol(), this.scanIntervalMs);
    this._log('info', 'immune-agent-started', {
      scanIntervalMs: this.scanIntervalMs,
      innateRules: this.innateRules.length
    });
    return this;
  }
  async stop() {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    this.quarantine.clear();
    this._log('info', 'immune-agent-stopped', {
      stats: this.stats
    });
  }
  health() {
    return {
      status: this.state === 'HEALTHY' ? 'ok' : 'degraded',
      state: this.state,
      coherence: this._calculateCoherence(),
      stats: {
        ...this.stats
      },
      quarantineSize: this.quarantine.size,
      adaptiveSignatures: this.adaptiveSignatures.size,
      immuneMemorySize: this.immuneMemory.size,
      timestamp: new Date().toISOString()
    };
  }
  _log(level, event, data = {}) {
    const entry = {
      level,
      event,
      correlationId: this._correlationId,
      agent: 'HeadyImmuneAgent',
      ...data,
      ts: new Date().toISOString()
    };
    if (level === 'error' || level === 'warn') logger.error(JSON.stringify(entry));else logger.info(JSON.stringify(entry));
  }
}
module.exports = {
  HeadyImmuneAgent
};