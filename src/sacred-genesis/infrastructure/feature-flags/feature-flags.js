/**
 * Heady Feature Flags Service — Sacred Genesis v4.0.0
 * CSL-gated feature flag evaluation with phi-derived rollout percentages
 * Port: 3371
 *
 * @module feature-flags
 * @author Eric Haywood, HeadySystems Inc.
 */

'use strict';

const http = require('http');
const { PHI, PSI, fib, phiThreshold, phiFusionWeights } = require('../../shared/phi-math');

/** @type {number} Service port */
const PORT = 3371;

/**
 * Fibonacci-stepped rollout percentages
 * @readonly
 * @type {number[]}
 */
const ROLLOUT_STEPS = [
  0,
  fib(5),     // 5%
  fib(6),     // 8%
  fib(7),     // 13%
  fib(8),     // 21%
  fib(9),     // 34%
  fib(10),    // 55%
  fib(11),    // 89%
  100
];

/**
 * Feature flag definition
 * @typedef {Object} FeatureFlag
 * @property {string} key - Unique flag identifier
 * @property {string} description - Human-readable description
 * @property {boolean} enabled - Master toggle
 * @property {number} rolloutPercent - Current rollout percentage (Fibonacci-stepped)
 * @property {string[]} allowlist - User IDs always included
 * @property {string[]} denylist - User IDs always excluded
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 * @property {Object} metadata - Arbitrary metadata
 */

/** @type {Map<string, FeatureFlag>} */
const flags = new Map();

/** @type {number} Maximum flags — fib(12) */
const MAX_FLAGS = fib(12);

/**
 * Deterministic hash for consistent assignment
 * @param {string} key - Flag key
 * @param {string} userId - User identifier
 * @returns {number} Value between 0-100
 */
function deterministicHash(key, userId) {
  const str = `${key}:${userId}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) % 100;
}

/**
 * Evaluate a feature flag for a specific user
 * @param {string} key - Flag key
 * @param {string} userId - User identifier
 * @param {Object} [context={}] - Evaluation context
 * @returns {{enabled: boolean, reason: string, flag?: FeatureFlag}}
 */
function evaluateFlag(key, userId, context = {}) {
  const flag = flags.get(key);

  if (!flag) {
    return { enabled: false, reason: 'flag_not_found' };
  }

  if (!flag.enabled) {
    return { enabled: false, reason: 'flag_disabled', flag };
  }

  if (flag.denylist.includes(userId)) {
    return { enabled: false, reason: 'user_denylisted', flag };
  }

  if (flag.allowlist.includes(userId)) {
    return { enabled: true, reason: 'user_allowlisted', flag };
  }

  const bucket = deterministicHash(key, userId);
  const enabled = bucket < flag.rolloutPercent;

  return {
    enabled,
    reason: enabled ? 'rollout_included' : 'rollout_excluded',
    bucket,
    rolloutPercent: flag.rolloutPercent,
    flag
  };
}

/**
 * Create or update a feature flag
 * @param {string} key - Flag key
 * @param {Partial<FeatureFlag>} data - Flag data
 * @returns {FeatureFlag | {error: string}}
 */
function upsertFlag(key, data) {
  if (!flags.has(key) && flags.size >= MAX_FLAGS) {
    return { error: `Maximum flag count (${MAX_FLAGS}) reached` };
  }

  const now = new Date().toISOString();
  const existing = flags.get(key);

  let rollout = data.rolloutPercent != null ? data.rolloutPercent : (existing ? existing.rolloutPercent : 0);
  const nearestStep = ROLLOUT_STEPS.reduce((prev, curr) =>
    Math.abs(curr - rollout) < Math.abs(prev - rollout) ? curr : prev
  );
  rollout = nearestStep;

  const flag = {
    key,
    description: data.description || (existing ? existing.description : ''),
    enabled: data.enabled != null ? data.enabled : (existing ? existing.enabled : false),
    rolloutPercent: rollout,
    allowlist: data.allowlist || (existing ? existing.allowlist : []),
    denylist: data.denylist || (existing ? existing.denylist : []),
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
    metadata: data.metadata || (existing ? existing.metadata : {})
  };

  flags.set(key, flag);
  return flag;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const parts = url.pathname.split('/').filter(Boolean);

  res.setHeader('Content-Type', 'application/json');

  if (url.pathname === '/health' || url.pathname === '/healthz') {
    res.writeHead(200);
    res.end(JSON.stringify({
      service: 'heady-feature-flags',
      status: 'healthy',
      version: '4.0.0',
      flagCount: flags.size,
      maxFlags: MAX_FLAGS,
      rolloutSteps: ROLLOUT_STEPS
    }));
    return;
  }

  if (url.pathname === '/metrics') {
    let enabledCount = 0;
    for (const [, f] of flags) if (f.enabled) enabledCount++;
    const metrics = [
      '# HELP heady_feature_flags_total Total feature flags',
      '# TYPE heady_feature_flags_total gauge',
      `heady_feature_flags_total ${flags.size}`,
      '# HELP heady_feature_flags_enabled Enabled feature flags',
      '# TYPE heady_feature_flags_enabled gauge',
      `heady_feature_flags_enabled ${enabledCount}`,
    ].join('\n');
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(metrics);
    return;
  }

  if (req.method === 'GET' && parts[0] === 'flags') {
    if (parts.length === 1) {
      res.writeHead(200);
      res.end(JSON.stringify(Array.from(flags.values())));
      return;
    }
    if (parts.length === 2) {
      const flag = flags.get(parts[1]);
      if (!flag) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Flag not found' }));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify(flag));
      return;
    }
  }

  if (req.method === 'POST' && parts[0] === 'flags') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (!data.key) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Missing key field' }));
          return;
        }
        const result = upsertFlag(data.key, data);
        if (result.error) {
          res.writeHead(409);
          res.end(JSON.stringify(result));
          return;
        }
        res.writeHead(201);
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  if (req.method === 'POST' && parts[0] === 'evaluate') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { key, userId, context } = JSON.parse(body);
        if (!key || !userId) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Missing key or userId' }));
          return;
        }
        const result = evaluateFlag(key, userId, context || {});
        res.writeHead(200);
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  if (req.method === 'POST' && parts[0] === 'evaluate-bulk') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { keys, userId, context } = JSON.parse(body);
        if (!keys || !userId) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Missing keys or userId' }));
          return;
        }
        const results = {};
        for (const key of keys) {
          results[key] = evaluateFlag(key, userId, context || {});
        }
        res.writeHead(200);
        res.end(JSON.stringify(results));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  process.stdout.write(JSON.stringify({
    level: 'info',
    service: 'heady-feature-flags',
    port: PORT,
    message: 'Feature flags service started',
    maxFlags: MAX_FLAGS,
    rolloutSteps: ROLLOUT_STEPS
  }) + '\n');
});
