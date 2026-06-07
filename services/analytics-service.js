// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: services/analytics-service.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Heady Analytics Service — Port 3312
 * Event ingestion, real-time aggregation, funnel/cohort analysis, anomaly detection
 * Author: Eric Haywood | All constants φ-derived | ESM only
 */
import { createHash } from 'crypto';
import { PHI, PSI, PSI2, phiThreshold, phiBackoff, fibonacci } from '../shared/phi-math-v2.js';
import { cslGate, cslBlend, cosineSimilarity } from '../shared/csl-engine-v2.js';

// ── φ-Derived Constants ──────────────────────────────────────────
const INGESTION_BATCH_SIZE   = fibonacci(10);                // 55
const AGGREGATION_WINDOW_MS  = fibonacci(13) * 1000;         // 233s
const MAX_EVENTS_BUFFER      = fibonacci(17);                // 1597
const COHORT_WINDOW_DAYS     = [fibonacci(5), fibonacci(7), fibonacci(9), fibonacci(11), fibonacci(13)]; // 5, 13, 34, 89, 233
const ANOMALY_Z_THRESHOLD    = PHI;                          // 1.618 std deviations
const PERCENTILES            = [0.5, PSI, 1 - PSI2];         // p50, p61.8, p95 (using φ-derived)

// ── In-Memory Stores ─────────────────────────────────────────────
const eventBuffer = [];
const aggregates = new Map();
const funnels = new Map();
const cohorts = new Map();
const metrics = { ingested: 0, aggregated: 0, anomalies: 0 };

function sha256(input) {
  return createHash('sha256').update(String(input)).digest('hex');
}

// ── Schema Validation ────────────────────────────────────────────
const REQUIRED_FIELDS = ['eventType', 'timestamp', 'userId'];
function validateEvent(event) {
  const missing = REQUIRED_FIELDS.filter(f => event[f] === undefined || event[f] === null);
  if (missing.length > 0) return { valid: false, missing };
  if (typeof event.timestamp !== 'number' || event.timestamp < 0) {
    return { valid: false, reason: 'invalid_timestamp' };
  }
  return { valid: true };
}

// ── Event Ingestion ──────────────────────────────────────────────
function ingestEvent(event) {
  const validation = validateEvent(event);
  if (!validation.valid) return { accepted: false, ...validation };

  const enriched = {
    ...event,
    id: sha256(JSON.stringify(event) + Date.now()),
    ingestedAt: Date.now(),
    hash: sha256(event.eventType + event.userId + event.timestamp),
  };

  if (eventBuffer.length >= MAX_EVENTS_BUFFER) {
    eventBuffer.splice(0, fibonacci(8));
  }
  eventBuffer.push(enriched);
  metrics.ingested++;
  return { accepted: true, id: enriched.id };
}

function ingestBatch(events) {
  const results = [];
  const batch = events.slice(0, INGESTION_BATCH_SIZE);
  for (const event of batch) {
    results.push(ingestEvent(event));
  }
  return { processed: results.length, results };
}

// ── Real-Time Aggregation ────────────────────────────────────────
function aggregate(eventType, timeWindowMs) {
  const window = timeWindowMs || AGGREGATION_WINDOW_MS;
  const cutoff = Date.now() - window;
  const matching = eventBuffer.filter(e => e.eventType === eventType && e.ingestedAt >= cutoff);

  const values = matching.map(e => e.value || 0).filter(v => typeof v === 'number');
  const count = matching.length;
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = count > 0 ? sum / count : 0;

  // Percentile computation
  const sorted = [...values].sort((a, b) => a - b);
  const percentileValues = {};
  for (const p of PERCENTILES) {
    const idx = Math.max(0, Math.ceil(sorted.length * p) - 1);
    percentileValues['p' + Math.round(p * 100)] = sorted[idx] || 0;
  }

  const result = {
    eventType, window, count, sum, avg,
    percentiles: percentileValues,
    timestamp: Date.now(),
  };
  aggregates.set(eventType, result);
  metrics.aggregated++;
  return result;
}

// ── Funnel Analysis ──────────────────────────────────────────────
function createFunnel(funnelId, steps) {
  funnels.set(funnelId, {
    id: funnelId,
    steps,
    created: Date.now(),
  });
  return { funnelId, steps: steps.length };
}

function analyzeFunnel(funnelId, timeWindowMs) {
  const funnel = funnels.get(funnelId);
  if (!funnel) return null;

  const cutoff = Date.now() - (timeWindowMs || fibonacci(14) * 1000);
  const stepResults = [];
  let previousUsers = null;

  for (let i = 0; i < funnel.steps.length; i++) {
    const step = funnel.steps[i];
    const usersAtStep = new Set(
      eventBuffer
        .filter(e => e.eventType === step && e.ingestedAt >= cutoff)
        .map(e => e.userId)
    );

    const retained = previousUsers
      ? new Set([...usersAtStep].filter(u => previousUsers.has(u)))
      : usersAtStep;

    const conversionRate = previousUsers && previousUsers.size > 0
      ? retained.size / previousUsers.size
      : 1.0;

    stepResults.push({
      step,
      users: retained.size,
      conversionRate,
      dropoff: previousUsers ? 1.0 - conversionRate : 0,
    });
    previousUsers = retained;
  }

  const overallConversion = stepResults.length > 1 && stepResults[0].users > 0
    ? stepResults[stepResults.length - 1].users / stepResults[0].users
    : 0;

  return { funnelId, steps: stepResults, overallConversion, analyzedAt: Date.now() };
}

// ── Cohort Analysis ──────────────────────────────────────────────
function analyzeCohort(signupEvent, retentionEvent, windowDays) {
  const windows = windowDays || COHORT_WINDOW_DAYS;
  const now = Date.now();
  const results = [];

  for (const days of windows) {
    const windowMs = days * 86400000;
    const cohortStart = now - windowMs * 2;
    const cohortEnd = now - windowMs;

    const signups = eventBuffer
      .filter(e => e.eventType === signupEvent && e.ingestedAt >= cohortStart && e.ingestedAt < cohortEnd)
      .map(e => e.userId);
    const signupSet = new Set(signups);

    const returnees = eventBuffer
      .filter(e => e.eventType === retentionEvent && e.ingestedAt >= cohortEnd && signupSet.has(e.userId))
      .map(e => e.userId);
    const returneeSet = new Set(returnees);

    const retention = signupSet.size > 0 ? returneeSet.size / signupSet.size : 0;

    results.push({
      windowDays: days,
      cohortSize: signupSet.size,
      retained: returneeSet.size,
      retentionRate: retention,
    });
  }
  return { signupEvent, retentionEvent, windows: results, analyzedAt: now };
}

// ── Anomaly Detection (φ-Scaled Z-Score) ─────────────────────────
function detectAnomalies(eventType) {
  const agg = aggregates.get(eventType);
  if (!agg || agg.count < fibonacci(5)) return { anomalies: [], insufficient_data: true };

  const matching = eventBuffer.filter(e => e.eventType === eventType);
  const values = matching.map(e => e.value || 0);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return { anomalies: [], reason: 'zero_variance' };

  const anomalies = [];
  for (const event of matching) {
    const val = event.value || 0;
    const zScore = Math.abs((val - mean) / stdDev);
    const anomalyGate = cslGate(zScore, zScore / (ANOMALY_Z_THRESHOLD * PHI), phiThreshold(3), PSI * PSI * PSI);

    if (zScore > ANOMALY_Z_THRESHOLD && anomalyGate > phiThreshold(2)) {
      anomalies.push({
        eventId: event.id,
        value: val,
        zScore,
        gateScore: anomalyGate,
        severity: zScore > ANOMALY_Z_THRESHOLD * PHI ? 'critical' : 'warning',
      });
      metrics.anomalies++;
    }
  }
  return { eventType, anomalies, mean, stdDev, threshold: ANOMALY_Z_THRESHOLD };
}

// ── Export Format ─────────────────────────────────────────────────
function exportEvents(eventType, format) {
  const matching = eventBuffer.filter(e => !eventType || e.eventType === eventType);
  const fmt = format || 'bigquery';

  if (fmt === 'bigquery') {
    return matching.map(e => ({
      event_id: e.id,
      event_type: e.eventType,
      user_id: e.userId,
      timestamp: new Date(e.timestamp).toISOString(),
      ingested_at: new Date(e.ingestedAt).toISOString(),
      value: e.value || null,
      properties: JSON.stringify(e.properties || {}),
      hash: e.hash,
    }));
  }
  return matching;
}

// ── HTTP Server ──────────────────────────────────────────────────
function createServer(port = 3312) {
  return import('http').then(({ default: http }) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const respond = (status, body) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      const readBody = () => new Promise((resolve) => {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch (parseErr) { resolve({ _parseError: parseErr.message }); } });
      });

      if (url.pathname === '/analytics/ingest' && req.method === 'POST') {
        const body = await readBody();
        const result = Array.isArray(body) ? ingestBatch(body) : ingestEvent(body);
        respond(202, result);
      } else if (url.pathname === '/analytics/aggregate' && req.method === 'POST') {
        const body = await readBody();
        respond(200, aggregate(body.eventType, body.windowMs));
      } else if (url.pathname === '/analytics/funnel' && req.method === 'POST') {
        const body = await readBody();
        const result = body.analyze ? analyzeFunnel(body.funnelId, body.windowMs) : createFunnel(body.funnelId, body.steps);
        respond(result ? 200 : 404, result || { error: 'funnel_not_found' });
      } else if (url.pathname === '/analytics/cohort' && req.method === 'POST') {
        const body = await readBody();
        respond(200, analyzeCohort(body.signupEvent, body.retentionEvent, body.windowDays));
      } else if (url.pathname === '/analytics/anomalies' && req.method === 'POST') {
        const body = await readBody();
        respond(200, detectAnomalies(body.eventType));
      } else if (url.pathname === '/analytics/export' && req.method === 'POST') {
        const body = await readBody();
        respond(200, exportEvents(body.eventType, body.format));
      } else if (url.pathname === '/health') {
        respond(200, health());
      } else {
        respond(404, { error: 'not_found' });
      }
    });
    server.listen(port);
    return server;
  });
}

const startTime = Date.now();
function health() {
  return {
    service: 'analytics-service',
    status: 'healthy',
    port: 3312,
    uptime: Date.now() - startTime,
    bufferSize: eventBuffer.length,
    aggregateKeys: aggregates.size,
    funnelCount: funnels.size,
    metrics: { ...metrics },
    phiConstants: { INGESTION_BATCH_SIZE, ANOMALY_Z_THRESHOLD, COHORT_WINDOW_DAYS },
  };
}

export default { createServer, health, ingestEvent, ingestBatch, aggregate, analyzeFunnel, analyzeCohort, detectAnomalies, exportEvents };
export { createServer, health, ingestEvent, ingestBatch, aggregate, analyzeFunnel, analyzeCohort, detectAnomalies, exportEvents };
