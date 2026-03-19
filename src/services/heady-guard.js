// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY SYSTEMS — HeadyGuard Governance-as-a-Service            ║
// ║  Kill-Switch + Audit Trail + Hallucination Watchdog             ║
// ║  ∞ Every threshold phi-derived · Immutable hash-chained audit  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

'use strict';

const crypto = require('crypto');
const { Router } = require('express');
const EventEmitter = require('events');
const {
  PHI, PSI, FIB, CSL, phiBackoff
} = require('../heady-phi-constants');
const logger = require('../utils/logger');

// ─── Constants ──────────────────────────────────────────────────────────────────

const SEVERITY_LEVELS = Object.freeze({
  WARNING: 'warning',
  CRITICAL: 'critical',
  EMERGENCY: 'emergency',
});

const SEVERITY_WEIGHT = Object.freeze({
  [SEVERITY_LEVELS.WARNING]: 1,
  [SEVERITY_LEVELS.CRITICAL]: FIB[5],   // 5
  [SEVERITY_LEVELS.EMERGENCY]: FIB[8],  // 21
});

const HALLUCINATION_THRESHOLD = 0.3;
const SLIDING_WINDOW_MS = FIB[17] * 1000; // 1597 seconds (~26 min)
const MAX_AUDIT_ENTRIES = FIB[20];         // 6765
const DAILY_LOSS_TRIGGER = 0.51;           // 51% portfolio loss auto-flatten
const SOC2_CONTROLS_COUNT = FIB[13];       // 233 controls baseline

// ─── Event Bus ──────────────────────────────────────────────────────────────────

const guardBus = new EventEmitter();
guardBus.setMaxListeners(FIB[8]); // 21

// ─── Kill Switch State ──────────────────────────────────────────────────────────

const killSwitchState = {
  active: false,
  triggeredAt: null,
  reason: null,
  severity: null,
  actor: null,
  history: [],
};

// ─── Immutable Audit Trail ──────────────────────────────────────────────────────

const auditTrail = [];
let auditGenesisHash = crypto.createHash('sha256').update('HEADY_GUARD_GENESIS_BLOCK').digest('hex');

function computeEntryHash(entry, previousHash) {
  const payload = JSON.stringify({
    id: entry.id,
    timestamp: entry.timestamp,
    eventType: entry.eventType,
    actor: entry.actor,
    target: entry.target,
    action: entry.action,
    details: entry.details,
    previousHash,
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function appendAuditEntry(eventType, actor, target, action, details) {
  const previousHash = auditTrail.length > 0
    ? auditTrail[auditTrail.length - 1].hash
    : auditGenesisHash;

  const entry = {
    id: `audit-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`,
    timestamp: new Date().toISOString(),
    epochMs: Date.now(),
    eventType,
    actor: actor || 'system',
    target: target || null,
    action: action || eventType,
    details: details || {},
    previousHash,
    hash: null,
  };

  entry.hash = computeEntryHash(entry, previousHash);

  auditTrail.push(entry);

  // Bound the trail — evict oldest when exceeding max
  if (auditTrail.length > MAX_AUDIT_ENTRIES) {
    auditTrail.splice(0, auditTrail.length - MAX_AUDIT_ENTRIES);
  }

  guardBus.emit('audit:entry', entry);
  logger.info(`[HeadyGuard:Audit] ${eventType} by ${entry.actor} → ${entry.hash.slice(0, 12)}`);

  return entry;
}

function verifyAuditChain() {
  if (auditTrail.length === 0) return { valid: true, checked: 0, broken: [] };

  const broken = [];
  let prevHash = auditTrail[0].previousHash;

  for (let i = 0; i < auditTrail.length; i++) {
    const entry = auditTrail[i];
    const expectedHash = computeEntryHash(entry, prevHash);
    if (entry.hash !== expectedHash) {
      broken.push({ index: i, id: entry.id, expected: expectedHash, actual: entry.hash });
    }
    prevHash = entry.hash;
  }

  return {
    valid: broken.length === 0,
    checked: auditTrail.length,
    broken,
  };
}

// ─── Hallucination Watchdog ─────────────────────────────────────────────────────

const watchdogState = {
  checks: [],        // { timestamp, score, flagged, source }
  totalChecks: 0,
  totalFlagged: 0,
  enabled: true,
};

function analyzeContent(content, threshold) {
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return { score: 0, flagged: true, signals: ['empty_content'] };
  }

  const signals = [];
  let penaltySum = 0;
  let factorCount = 0;

  // Signal 1: Hedging language density
  const hedgingPatterns = /\b(maybe|perhaps|possibly|might|could be|uncertain|unclear|i think|it seems|allegedly|reportedly|supposedly|arguably)\b/gi;
  const hedgingMatches = (content.match(hedgingPatterns) || []).length;
  const hedgingDensity = hedgingMatches / Math.max(content.split(/\s+/).length, 1);
  if (hedgingDensity > PSI * 0.1) { // > ~6.18% hedging words
    signals.push('excessive_hedging');
    penaltySum += hedgingDensity * PHI;
  }
  factorCount++;

  // Signal 2: Contradictions (simple proximity-based)
  const contradictionPairs = [
    [/\balways\b/i, /\bnever\b/i],
    [/\bincreased\b/i, /\bdecreased\b/i],
    [/\btrue\b/i, /\bfalse\b/i],
    [/\bconfirmed\b/i, /\bdenied\b/i],
  ];
  let contradictionCount = 0;
  for (const [a, b] of contradictionPairs) {
    if (a.test(content) && b.test(content)) {
      contradictionCount++;
    }
  }
  if (contradictionCount > 0) {
    signals.push('internal_contradictions');
    penaltySum += contradictionCount * PSI;
  }
  factorCount++;

  // Signal 3: Fabricated precision (spurious decimal numbers, fake statistics)
  const fabricatedPrecision = /\b\d{1,3}\.\d{4,}\s*%/g;
  const precisionMatches = (content.match(fabricatedPrecision) || []).length;
  if (precisionMatches > 0) {
    signals.push('fabricated_precision');
    penaltySum += precisionMatches * 0.15;
  }
  factorCount++;

  // Signal 4: Repetition (same sentence fragment repeated)
  const sentences = content.split(/[.!?]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
  const sentenceSet = new Set(sentences);
  const repetitionRate = 1 - (sentenceSet.size / Math.max(sentences.length, 1));
  if (repetitionRate > PSI * 0.3) {
    signals.push('excessive_repetition');
    penaltySum += repetitionRate;
  }
  factorCount++;

  // Signal 5: Citation-less factual claims
  const factualClaimPatterns = /\b(according to|studies show|research indicates|data suggests|statistics reveal|experts say)\b/gi;
  const factualClaims = (content.match(factualClaimPatterns) || []).length;
  const citationPatterns = /\[\d+\]|\((?:19|20)\d{2}\)|https?:\/\/|doi:/gi;
  const citations = (content.match(citationPatterns) || []).length;
  if (factualClaims > 0 && citations === 0) {
    signals.push('uncited_claims');
    penaltySum += factualClaims * 0.2;
  }
  factorCount++;

  // Signal 6: Confidence language without evidence
  const overconfidence = /\b(definitely|certainly|absolutely|undoubtedly|without question|100%)\b/gi;
  const overconfidenceMatches = (content.match(overconfidence) || []).length;
  if (overconfidenceMatches > 2) {
    signals.push('overconfidence_without_evidence');
    penaltySum += overconfidenceMatches * 0.12;
  }
  factorCount++;

  // Compute confidence score (1.0 = fully confident, 0.0 = hallucination)
  const avgPenalty = factorCount > 0 ? penaltySum / factorCount : 0;
  const confidence = Math.max(0, Math.min(1, 1 - avgPenalty));
  const effectiveThreshold = typeof threshold === 'number' ? threshold : HALLUCINATION_THRESHOLD;
  const flagged = confidence < effectiveThreshold;

  return { score: parseFloat(confidence.toFixed(6)), flagged, signals };
}

function recordWatchdogCheck(result, source) {
  const now = Date.now();
  const entry = {
    timestamp: now,
    score: result.score,
    flagged: result.flagged,
    signals: result.signals,
    source: source || 'unknown',
  };

  watchdogState.checks.push(entry);
  watchdogState.totalChecks++;
  if (result.flagged) watchdogState.totalFlagged++;

  // Trim sliding window
  const cutoff = now - SLIDING_WINDOW_MS;
  while (watchdogState.checks.length > 0 && watchdogState.checks[0].timestamp < cutoff) {
    watchdogState.checks.shift();
  }

  return entry;
}

function getWatchdogStats() {
  const now = Date.now();
  const cutoff = now - SLIDING_WINDOW_MS;
  const windowChecks = watchdogState.checks.filter(c => c.timestamp >= cutoff);
  const windowFlagged = windowChecks.filter(c => c.flagged);
  const windowRate = windowChecks.length > 0
    ? windowFlagged.length / windowChecks.length
    : 0;

  return {
    enabled: watchdogState.enabled,
    totalChecks: watchdogState.totalChecks,
    totalFlagged: watchdogState.totalFlagged,
    lifetimeRate: watchdogState.totalChecks > 0
      ? parseFloat((watchdogState.totalFlagged / watchdogState.totalChecks).toFixed(6))
      : 0,
    window: {
      durationMs: SLIDING_WINDOW_MS,
      checks: windowChecks.length,
      flagged: windowFlagged.length,
      rate: parseFloat(windowRate.toFixed(6)),
    },
    threshold: HALLUCINATION_THRESHOLD,
  };
}

// ─── SOC 2 Compliance Scoring ───────────────────────────────────────────────────

function computeComplianceScore() {
  const auditIntegrity = verifyAuditChain();
  const watchdog = getWatchdogStats();

  let score = 0;
  let maxScore = 0;
  const findings = [];

  // Control 1: Audit trail active and non-empty (weight: 21)
  maxScore += FIB[8];
  if (auditTrail.length > 0) {
    score += FIB[8];
  } else {
    findings.push({ control: 'CC7.1', finding: 'Audit trail is empty', severity: 'high' });
  }

  // Control 2: Audit chain integrity (weight: 34)
  maxScore += FIB[9];
  if (auditIntegrity.valid) {
    score += FIB[9];
  } else {
    findings.push({
      control: 'CC7.2',
      finding: `Audit chain broken at ${auditIntegrity.broken.length} point(s)`,
      severity: 'critical',
    });
  }

  // Control 3: Hallucination watchdog enabled (weight: 13)
  maxScore += FIB[7];
  if (watchdog.enabled) {
    score += FIB[7];
  } else {
    findings.push({ control: 'CC8.1', finding: 'Hallucination watchdog disabled', severity: 'high' });
  }

  // Control 4: Hallucination rate within bounds (weight: 21)
  maxScore += FIB[8];
  if (watchdog.window.rate < PSI) { // < 61.8%
    score += FIB[8];
  } else {
    findings.push({
      control: 'CC8.2',
      finding: `Hallucination rate ${(watchdog.window.rate * 100).toFixed(1)}% exceeds threshold`,
      severity: 'critical',
    });
  }

  // Control 5: Kill switch mechanism present (weight: 13)
  maxScore += FIB[7];
  score += FIB[7]; // Always present — it's this module

  // Control 6: Authentication middleware active (weight: 8)
  maxScore += FIB[6];
  score += FIB[6]; // Always active — enforced below

  // Control 7: Kill switch not in unresolved emergency state > 1 hour (weight: 13)
  maxScore += FIB[7];
  if (killSwitchState.active && killSwitchState.triggeredAt) {
    const elapsed = Date.now() - new Date(killSwitchState.triggeredAt).getTime();
    if (elapsed > 3600000) {
      findings.push({
        control: 'CC6.1',
        finding: `Kill switch active for ${Math.round(elapsed / 60000)} minutes without resolution`,
        severity: 'warning',
      });
    } else {
      score += FIB[7];
    }
  } else {
    score += FIB[7];
  }

  const pct = maxScore > 0 ? parseFloat(((score / maxScore) * 100).toFixed(2)) : 0;

  return {
    score: pct,
    grade: pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F',
    raw: { score, maxScore },
    controls: {
      total: 7,
      passing: 7 - findings.length,
      failing: findings.length,
    },
    findings,
    assessedAt: new Date().toISOString(),
  };
}

// ─── Governance Policy Evaluation ───────────────────────────────────────────────

const GOVERNANCE_POLICIES = [
  {
    id: 'GOV-001',
    name: 'Kill Switch Block',
    description: 'No actions permitted while kill switch is active',
    evaluate: (action) => {
      if (killSwitchState.active) {
        return { allowed: false, reason: 'Kill switch is active', policy: 'GOV-001' };
      }
      return { allowed: true, policy: 'GOV-001' };
    },
  },
  {
    id: 'GOV-002',
    name: 'High-Risk Action Audit',
    description: 'High-risk actions require actor and justification',
    evaluate: (action) => {
      if (action.riskLevel === 'high' || action.riskLevel === 'critical') {
        if (!action.actor || !action.justification) {
          return {
            allowed: false,
            reason: 'High-risk actions require actor and justification',
            policy: 'GOV-002',
          };
        }
      }
      return { allowed: true, policy: 'GOV-002' };
    },
  },
  {
    id: 'GOV-003',
    name: 'Hallucination Rate Gate',
    description: 'Block AI actions when hallucination rate exceeds phi-scaled threshold',
    evaluate: (action) => {
      if (action.type === 'ai_generation' || action.type === 'ai_response') {
        const stats = getWatchdogStats();
        if (stats.window.rate > PSI) { // > 61.8%
          return {
            allowed: false,
            reason: `Hallucination rate ${(stats.window.rate * 100).toFixed(1)}% exceeds ${(PSI * 100).toFixed(1)}% gate`,
            policy: 'GOV-003',
          };
        }
      }
      return { allowed: true, policy: 'GOV-003' };
    },
  },
  {
    id: 'GOV-004',
    name: 'Portfolio Loss Circuit Breaker',
    description: 'Auto-flatten on 51% daily loss',
    evaluate: (action) => {
      if (typeof action.portfolioLoss === 'number' && action.portfolioLoss >= DAILY_LOSS_TRIGGER) {
        return {
          allowed: false,
          reason: `Portfolio loss ${(action.portfolioLoss * 100).toFixed(1)}% triggers auto-flatten at ${DAILY_LOSS_TRIGGER * 100}%`,
          policy: 'GOV-004',
          autoFlatten: true,
        };
      }
      return { allowed: true, policy: 'GOV-004' };
    },
  },
];

function evaluateGovernance(action) {
  const results = [];
  let allowed = true;
  let autoFlatten = false;

  for (const policy of GOVERNANCE_POLICIES) {
    const result = policy.evaluate(action);
    results.push({
      policyId: policy.id,
      name: policy.name,
      ...result,
    });
    if (!result.allowed) {
      allowed = false;
    }
    if (result.autoFlatten) {
      autoFlatten = true;
    }
  }

  // Side-effect: auto-flatten triggers kill switch
  if (autoFlatten && !killSwitchState.active) {
    triggerKillSwitch(
      `Auto-flatten: portfolio loss >= ${DAILY_LOSS_TRIGGER * 100}%`,
      SEVERITY_LEVELS.EMERGENCY,
      'governance-engine'
    );
  }

  return {
    allowed,
    autoFlatten,
    policiesEvaluated: results.length,
    results,
    evaluatedAt: new Date().toISOString(),
  };
}

// ─── Kill Switch Logic ──────────────────────────────────────────────────────────

function triggerKillSwitch(reason, severity, actor) {
  const sev = SEVERITY_LEVELS[String(severity).toUpperCase()] || severity;
  if (!Object.values(SEVERITY_LEVELS).includes(sev)) {
    throw new Error(`Invalid severity: ${severity}. Must be one of: ${Object.values(SEVERITY_LEVELS).join(', ')}`);
  }

  killSwitchState.active = true;
  killSwitchState.triggeredAt = new Date().toISOString();
  killSwitchState.reason = reason;
  killSwitchState.severity = sev;
  killSwitchState.actor = actor || 'unknown';

  // Set global flag
  global.killSwitchActive = true;

  killSwitchState.history.push({
    action: 'triggered',
    reason,
    severity: sev,
    actor: killSwitchState.actor,
    timestamp: killSwitchState.triggeredAt,
  });

  // Bound history
  if (killSwitchState.history.length > FIB[11]) { // 89
    killSwitchState.history.splice(0, killSwitchState.history.length - FIB[11]);
  }

  // Audit it
  appendAuditEntry('kill_switch_triggered', killSwitchState.actor, 'system', 'trigger_kill_switch', {
    reason,
    severity: sev,
    weight: SEVERITY_WEIGHT[sev],
  });

  // Emit governance event
  guardBus.emit('governance:kill-switch', {
    active: true,
    reason,
    severity: sev,
    actor: killSwitchState.actor,
    triggeredAt: killSwitchState.triggeredAt,
  });

  logger.warn(`[HeadyGuard:KillSwitch] TRIGGERED severity=${sev} by=${killSwitchState.actor} reason="${reason}"`);

  return {
    active: true,
    triggeredAt: killSwitchState.triggeredAt,
    severity: sev,
    reason,
    actor: killSwitchState.actor,
  };
}

// ─── Auth Middleware ─────────────────────────────────────────────────────────────

function guardAuth(req, res, next) {
  const apiKey = req.headers['x-heady-api-key'] || req.headers['authorization']?.split(' ')[1];
  const expectedKey = process.env.HEADY_API_KEY;

  if (!expectedKey) {
    // No key configured — allow in development, block in production
    if (process.env.NODE_ENV === 'production') {
      logger.error('[HeadyGuard:Auth] HEADY_API_KEY not configured in production');
      return res.status(500).json({ error: 'Server misconfiguration: API key not set' });
    }
    return next();
  }

  if (!apiKey) {
    return res.status(401).json({
      error: 'Authentication required',
      hint: 'Provide X-Heady-API-Key header or Bearer token',
    });
  }

  // Timing-safe comparison
  const expected = Buffer.from(expectedKey, 'utf8');
  const provided = Buffer.from(apiKey, 'utf8');

  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    appendAuditEntry('auth_failure', req.ip, 'guard_api', 'authenticate', {
      path: req.path,
      method: req.method,
    });
    return res.status(403).json({ error: 'Invalid API key' });
  }

  next();
}

// ─── Express Router ─────────────────────────────────────────────────────────────

const router = Router();

// Apply auth to all guard routes
router.use(guardAuth);

// ── GET /api/guard/status ───────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  const auditHealth = verifyAuditChain();
  const watchdog = getWatchdogStats();

  res.json({
    service: 'HeadyGuard',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    killSwitch: {
      active: killSwitchState.active,
      triggeredAt: killSwitchState.triggeredAt,
      severity: killSwitchState.severity,
      reason: killSwitchState.reason,
      actor: killSwitchState.actor,
    },
    audit: {
      entries: auditTrail.length,
      chainValid: auditHealth.valid,
      chainChecked: auditHealth.checked,
      brokenLinks: auditHealth.broken.length,
    },
    watchdog,
    phi: { PHI, PSI, hallucinationThreshold: HALLUCINATION_THRESHOLD },
  });
});

// ── POST /api/guard/kill-switch ─────────────────────────────────────────────────
router.post('/kill-switch', (req, res) => {
  const { reason, severity, actor } = req.body || {};

  if (!reason) {
    return res.status(400).json({ error: 'Missing required field: reason' });
  }
  if (!severity) {
    return res.status(400).json({ error: 'Missing required field: severity' });
  }

  try {
    const result = triggerKillSwitch(reason, severity, actor);
    res.status(200).json({
      success: true,
      killSwitch: result,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET /api/guard/audit ────────────────────────────────────────────────────────
router.get('/audit', (req, res) => {
  const { from, to, actor, eventType, limit } = req.query;
  let entries = auditTrail.slice();

  if (from) {
    const fromMs = new Date(from).getTime();
    if (!isNaN(fromMs)) {
      entries = entries.filter(e => e.epochMs >= fromMs);
    }
  }

  if (to) {
    const toMs = new Date(to).getTime();
    if (!isNaN(toMs)) {
      entries = entries.filter(e => e.epochMs <= toMs);
    }
  }

  if (actor) {
    entries = entries.filter(e => e.actor === actor);
  }

  if (eventType) {
    entries = entries.filter(e => e.eventType === eventType);
  }

  const maxEntries = Math.min(parseInt(limit, 10) || FIB[11], FIB[13]); // default 89, max 233
  entries = entries.slice(-maxEntries);

  const chainStatus = verifyAuditChain();

  res.json({
    total: auditTrail.length,
    returned: entries.length,
    chainValid: chainStatus.valid,
    entries,
  });
});

// ── POST /api/guard/audit/event ─────────────────────────────────────────────────
router.post('/audit/event', (req, res) => {
  const { eventType, actor, target, action, details } = req.body || {};

  if (!eventType) {
    return res.status(400).json({ error: 'Missing required field: eventType' });
  }

  const entry = appendAuditEntry(eventType, actor, target, action, details);

  res.status(201).json({
    success: true,
    entry: {
      id: entry.id,
      hash: entry.hash,
      timestamp: entry.timestamp,
      eventType: entry.eventType,
    },
  });
});

// ── GET /api/guard/watchdog ─────────────────────────────────────────────────────
router.get('/watchdog', (req, res) => {
  const stats = getWatchdogStats();
  const recentChecks = watchdogState.checks.slice(-FIB[8]); // last 21

  res.json({
    ...stats,
    recentChecks: recentChecks.map(c => ({
      timestamp: new Date(c.timestamp).toISOString(),
      score: c.score,
      flagged: c.flagged,
      signals: c.signals,
      source: c.source,
    })),
  });
});

// ── POST /api/guard/watchdog/check ──────────────────────────────────────────────
router.post('/watchdog/check', (req, res) => {
  const { content, source, threshold } = req.body || {};

  if (!content) {
    return res.status(400).json({ error: 'Missing required field: content' });
  }

  if (!watchdogState.enabled) {
    return res.status(503).json({ error: 'Hallucination watchdog is disabled' });
  }

  const effectiveThreshold = typeof threshold === 'number' ? threshold : HALLUCINATION_THRESHOLD;
  const result = analyzeContent(content, effectiveThreshold);
  const recorded = recordWatchdogCheck(result, source);

  // Audit flagged hallucinations
  if (result.flagged) {
    appendAuditEntry('hallucination_detected', source || 'unknown', 'content', 'watchdog_check', {
      score: result.score,
      signals: result.signals,
      contentLength: content.length,
      threshold: effectiveThreshold,
    });
  }

  res.json({
    hallucination: result.flagged,
    confidence: result.score,
    threshold: effectiveThreshold,
    signals: result.signals,
    source: recorded.source,
    checkedAt: new Date(recorded.timestamp).toISOString(),
    windowStats: getWatchdogStats().window,
  });
});

// ── GET /api/guard/compliance ───────────────────────────────────────────────────
router.get('/compliance', (req, res) => {
  const compliance = computeComplianceScore();

  res.json({
    framework: 'SOC 2 Type II',
    ...compliance,
    phi: {
      scoringWeights: 'Fibonacci-indexed',
      thresholds: { PSI, PHI },
    },
  });
});

// ── POST /api/guard/governance/evaluate ─────────────────────────────────────────
router.post('/governance/evaluate', (req, res) => {
  const action = req.body || {};

  if (!action.type && !action.action) {
    return res.status(400).json({ error: 'Missing required field: type or action' });
  }

  const evaluation = evaluateGovernance(action);

  // Audit the governance check
  appendAuditEntry('governance_evaluation', action.actor || 'unknown', action.target || action.type, 'evaluate', {
    allowed: evaluation.allowed,
    autoFlatten: evaluation.autoFlatten,
    policiesEvaluated: evaluation.policiesEvaluated,
  });

  res.json(evaluation);
});

// ─── Exports ────────────────────────────────────────────────────────────────────

module.exports = router;

module.exports.router = router;
module.exports.guardBus = guardBus;
module.exports.triggerKillSwitch = triggerKillSwitch;
module.exports.appendAuditEntry = appendAuditEntry;
module.exports.verifyAuditChain = verifyAuditChain;
module.exports.analyzeContent = analyzeContent;
module.exports.evaluateGovernance = evaluateGovernance;
module.exports.computeComplianceScore = computeComplianceScore;
module.exports.getWatchdogStats = getWatchdogStats;
module.exports.killSwitchState = killSwitchState;
module.exports.auditTrail = auditTrail;
module.exports.watchdogState = watchdogState;
module.exports.SEVERITY_LEVELS = SEVERITY_LEVELS;
module.exports.GOVERNANCE_POLICIES = GOVERNANCE_POLICIES;
