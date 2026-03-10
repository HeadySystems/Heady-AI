/**
 * Heady Feature Flags — CSL-gated gradual rollout with Fibonacci steps
 * A/B testing with φ-weighted variants, user segment targeting
 * Author: Eric Haywood | All constants φ-derived | ESM only
 */
import { createHash } from 'crypto';
import { PHI, PSI, PSI2, phiThreshold, fibonacci } from '../shared/phi-math-v2.js';
import { cslGate, cosineSimilarity } from '../shared/csl-engine-v2.js';

const MAX_FLAGS          = fibonacci(14);  // 377
const ROLLOUT_STEPS      = [fibonacci(3), fibonacci(5), fibonacci(7), fibonacci(8), fibonacci(10), fibonacci(12)]; // 2%, 5%, 13%, 21%, 55%, 100% (Fibonacci pcts)
const VARIANT_CACHE_SIZE = fibonacci(16);  // 987
const EVALUATION_CACHE_TTL = fibonacci(10) * 1000; // 55s

function sha256(input) { return createHash('sha256').update(String(input)).digest('hex'); }

const flags = new Map();
const evaluationCache = new Map();
const experiments = new Map();
const metrics = { evaluations: 0, cacheHits: 0, overrides: 0 };

function createFlag(spec) {
  if (flags.size >= MAX_FLAGS) return { error: 'max_flags_reached' };
  const flag = {
    key: spec.key,
    name: spec.name || spec.key,
    description: spec.description || '',
    enabled: spec.enabled || false,
    rolloutPercentage: spec.rolloutPercentage || 0,
    rolloutStep: 0,
    variants: spec.variants || [{ key: 'control', weight: PSI }, { key: 'treatment', weight: PSI2 }],
    targetSegments: spec.targetSegments || [],
    overrides: spec.overrides || {},
    staleAfterMs: spec.staleAfterMs || EVALUATION_CACHE_TTL,
    created: Date.now(),
    lastModified: Date.now(),
    hash: sha256(spec.key + Date.now()),
  };
  flags.set(spec.key, flag);
  return { key: flag.key, enabled: flag.enabled, rolloutPercentage: flag.rolloutPercentage };
}

function evaluateFlag(flagKey, userId, context) {
  const flag = flags.get(flagKey);
  if (!flag) return { enabled: false, variant: null, reason: 'flag_not_found' };
  if (!flag.enabled) return { enabled: false, variant: null, reason: 'disabled' };

  const cacheKey = sha256(flagKey + userId);
  const cached = evaluationCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < flag.staleAfterMs) {
    metrics.cacheHits++;
    return { ...cached.result, fromCache: true };
  }

  // Check overrides
  if (flag.overrides[userId] !== undefined) {
    metrics.overrides++;
    const result = { enabled: true, variant: flag.overrides[userId], reason: 'override' };
    cacheResult(cacheKey, result);
    return result;
  }

  // Segment targeting via CSL gate
  if (flag.targetSegments.length > 0 && context) {
    const segmentMatch = flag.targetSegments.some(seg => {
      const matchScore = context[seg.field] === seg.value ? 1.0 : 0.0;
      return cslGate(matchScore, matchScore, phiThreshold(2), PSI * PSI * PSI) > phiThreshold(1);
    });
    if (!segmentMatch) return { enabled: false, variant: null, reason: 'segment_mismatch' };
  }

  // Rollout percentage check (deterministic hash)
  const bucket = parseInt(sha256(flagKey + userId).slice(0, 8), 16) % 100;
  if (bucket >= flag.rolloutPercentage) {
    return { enabled: false, variant: null, reason: 'outside_rollout' };
  }

  // Variant selection with φ-weighted distribution
  const variantBucket = parseInt(sha256(userId + flagKey + 'variant').slice(0, 8), 16) / 0xFFFFFFFF;
  let cumWeight = 0;
  let selectedVariant = flag.variants[flag.variants.length - 1]?.key || 'default';
  for (const v of flag.variants) {
    cumWeight += v.weight;
    if (variantBucket <= cumWeight) { selectedVariant = v.key; break; }
  }

  metrics.evaluations++;
  const result = { enabled: true, variant: selectedVariant, rolloutPercentage: flag.rolloutPercentage };
  cacheResult(cacheKey, result);
  return result;
}

function cacheResult(key, result) {
  if (evaluationCache.size >= VARIANT_CACHE_SIZE) {
    const oldest = evaluationCache.keys().next().value;
    evaluationCache.delete(oldest);
  }
  evaluationCache.set(key, { result, timestamp: Date.now() });
}

function advanceRollout(flagKey) {
  const flag = flags.get(flagKey);
  if (!flag) return { error: 'flag_not_found' };
  if (flag.rolloutStep >= ROLLOUT_STEPS.length - 1) return { flagKey, rolloutPercentage: 100, step: flag.rolloutStep, complete: true };
  flag.rolloutStep++;
  flag.rolloutPercentage = ROLLOUT_STEPS[flag.rolloutStep];
  flag.lastModified = Date.now();
  evaluationCache.clear();
  return { flagKey, rolloutPercentage: flag.rolloutPercentage, step: flag.rolloutStep };
}

function rollbackRollout(flagKey) {
  const flag = flags.get(flagKey);
  if (!flag) return { error: 'flag_not_found' };
  if (flag.rolloutStep <= 0) { flag.enabled = false; return { flagKey, disabled: true }; }
  flag.rolloutStep--;
  flag.rolloutPercentage = ROLLOUT_STEPS[flag.rolloutStep];
  flag.lastModified = Date.now();
  evaluationCache.clear();
  return { flagKey, rolloutPercentage: flag.rolloutPercentage, step: flag.rolloutStep };
}

function startExperiment(name, flagKey, successMetric) {
  const exp = {
    name, flagKey, successMetric,
    variants: {}, started: Date.now(), status: 'running',
    hash: sha256(name + flagKey + Date.now()),
  };
  experiments.set(name, exp);
  return { name, flagKey, status: 'running' };
}

function recordExperimentEvent(experimentName, variant, success) {
  const exp = experiments.get(experimentName);
  if (!exp) return { error: 'experiment_not_found' };
  if (!exp.variants[variant]) exp.variants[variant] = { total: 0, successes: 0 };
  exp.variants[variant].total++;
  if (success) exp.variants[variant].successes++;
  return { recorded: true, variant, stats: exp.variants[variant] };
}

function getExperimentResults(experimentName) {
  const exp = experiments.get(experimentName);
  if (!exp) return { error: 'experiment_not_found' };
  const results = {};
  for (const [variant, stats] of Object.entries(exp.variants)) {
    results[variant] = { ...stats, conversionRate: stats.total > 0 ? stats.successes / stats.total : 0 };
  }
  return { name: exp.name, flagKey: exp.flagKey, results, duration: Date.now() - exp.started };
}

function createServer(port = 3382) {
  return import('http').then(({ default: http }) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const respond = (s, b) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(b)); };
      const readBody = () => new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => { try { r(JSON.parse(Buffer.concat(c).toString())); } catch (parseErr) { r({ _parseError: parseErr.message }); } }); });

      if (url.pathname === '/flags/create' && req.method === 'POST') respond(201, createFlag(await readBody()));
      else if (url.pathname === '/flags/evaluate' && req.method === 'POST') { const b = await readBody(); respond(200, evaluateFlag(b.flagKey, b.userId, b.context)); }
      else if (url.pathname === '/flags/advance' && req.method === 'POST') respond(200, advanceRollout((await readBody()).flagKey));
      else if (url.pathname === '/flags/rollback' && req.method === 'POST') respond(200, rollbackRollout((await readBody()).flagKey));
      else if (url.pathname === '/flags/experiment/start' && req.method === 'POST') { const b = await readBody(); respond(201, startExperiment(b.name, b.flagKey, b.successMetric)); }
      else if (url.pathname === '/flags/experiment/record' && req.method === 'POST') { const b = await readBody(); respond(200, recordExperimentEvent(b.experiment, b.variant, b.success)); }
      else if (url.pathname === '/flags/experiment/results' && req.method === 'GET') respond(200, getExperimentResults(url.searchParams.get('name')));
      else if (url.pathname === '/health') respond(200, { service: 'feature-flags', status: 'healthy', flags: flags.size, experiments: experiments.size, metrics });
      else respond(404, { error: 'not_found' });
    });
    server.listen(port);
    return server;
  });
}

export default { createServer, createFlag, evaluateFlag, advanceRollout, rollbackRollout, startExperiment, recordExperimentEvent, getExperimentResults };
export { createServer, createFlag, evaluateFlag, advanceRollout, rollbackRollout, startExperiment, recordExperimentEvent, getExperimentResults };
