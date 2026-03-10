/**
 * Heady Dead Letter Queue — Failed message management with φ-retry
 * Reprocessing, quarantine, analytics, and alerting
 * Author: Eric Haywood | All constants φ-derived | ESM only
 */
import { createHash } from 'crypto';
import { PHI, PSI, PSI2, phiThreshold, phiBackoff, fibonacci } from '../shared/phi-math-v2.js';
import { cslGate } from '../shared/csl-engine-v2.js';

const DLQ_MAX_SIZE       = fibonacci(17);  // 1597
const QUARANTINE_SIZE    = fibonacci(14);  // 377
const REPROCESS_BATCH    = fibonacci(8);   // 21
const MAX_REPROCESS_TRIES = fibonacci(5);  // 5
const RETENTION_MS       = fibonacci(11) * 86400000; // 89 days
const ALERT_THRESHOLD    = fibonacci(8);   // 21 items = alert

function sha256(input) { return createHash('sha256').update(String(input)).digest('hex'); }

const deadLetters = [];
const quarantine = [];
const reprocessLog = [];
const alerts = [];
const metrics = { received: 0, reprocessed: 0, quarantined: 0, purged: 0, alerts: 0 };

function enqueue(message) {
  const entry = {
    id: sha256(JSON.stringify(message) + Date.now()),
    originalQueue: message.originalQueue || 'unknown',
    payload: message.payload || message,
    error: message.error || 'unknown_error',
    attempts: message.attempts || 0,
    maxRetries: message.maxRetries || MAX_REPROCESS_TRIES,
    firstFailed: message.firstFailed || Date.now(),
    lastFailed: Date.now(),
    status: 'dead_lettered',
    hash: sha256(JSON.stringify(message.payload || message)),
  };

  if (deadLetters.length >= DLQ_MAX_SIZE) {
    const oldest = deadLetters.shift();
    metrics.purged++;
  }
  deadLetters.push(entry);
  metrics.received++;

  if (deadLetters.length >= ALERT_THRESHOLD) {
    const alert = { type: 'dlq_threshold', count: deadLetters.length, threshold: ALERT_THRESHOLD, timestamp: Date.now() };
    alerts.push(alert);
    metrics.alerts++;
  }

  return { id: entry.id, status: 'dead_lettered', queueDepth: deadLetters.length };
}

function reprocess(messageId) {
  const idx = deadLetters.findIndex(m => m.id === messageId);
  if (idx === -1) return { error: 'message_not_found' };

  const message = deadLetters[idx];
  if (message.attempts >= message.maxRetries) {
    message.status = 'quarantined';
    deadLetters.splice(idx, 1);
    if (quarantine.length >= QUARANTINE_SIZE) quarantine.shift();
    quarantine.push(message);
    metrics.quarantined++;
    return { id: messageId, status: 'quarantined', reason: 'max_retries_exceeded' };
  }

  message.attempts++;
  message.status = 'reprocessing';
  const delay = phiBackoff(message.attempts, 1000, fibonacci(14) * 1000);

  const result = {
    id: messageId,
    status: 'reprocessing',
    attempt: message.attempts,
    retryDelay: delay,
    hash: sha256(messageId + message.attempts),
  };

  deadLetters.splice(idx, 1);
  reprocessLog.push({ ...result, timestamp: Date.now() });
  metrics.reprocessed++;
  return result;
}

function reprocessBatch(count) {
  const batch = deadLetters.slice(0, count || REPROCESS_BATCH);
  const results = batch.map(m => reprocess(m.id));
  return { processed: results.length, results };
}

function getMessages(options) {
  const opts = options || {};
  const filtered = deadLetters.filter(m => {
    if (opts.queue && m.originalQueue !== opts.queue) return false;
    if (opts.status && m.status !== opts.status) return false;
    if (opts.since && m.lastFailed < opts.since) return false;
    return true;
  });
  const limit = opts.limit || fibonacci(8);
  return { total: filtered.length, messages: filtered.slice(0, limit) };
}

function getQuarantine(limit) { return { total: quarantine.length, messages: quarantine.slice(-(limit || fibonacci(8))) }; }
function getAlerts(limit) { return { total: alerts.length, alerts: alerts.slice(-(limit || fibonacci(8))) }; }

function purgeOld() {
  const cutoff = Date.now() - RETENTION_MS;
  const before = deadLetters.length;
  const remaining = deadLetters.filter(m => m.lastFailed >= cutoff);
  deadLetters.length = 0;
  deadLetters.push(...remaining);
  const purged = before - remaining.length;
  metrics.purged += purged;
  return { purged, remaining: deadLetters.length };
}

function getAnalytics() {
  const byQueue = {};
  const byError = {};
  for (const m of deadLetters) {
    byQueue[m.originalQueue] = (byQueue[m.originalQueue] || 0) + 1;
    byError[m.error] = (byError[m.error] || 0) + 1;
  }
  return {
    total: deadLetters.length,
    quarantineTotal: quarantine.length,
    byQueue, byError,
    metrics: { ...metrics },
    oldestMessage: deadLetters[0]?.lastFailed || null,
    newestMessage: deadLetters[deadLetters.length - 1]?.lastFailed || null,
  };
}

function createServer(port = 3383) {
  return import('http').then(({ default: http }) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const respond = (s, b) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(b)); };
      const readBody = () => new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => { try { r(JSON.parse(Buffer.concat(c).toString())); } catch (parseErr) { r({ _parseError: parseErr.message }); } }); });

      if (url.pathname === '/dlq/enqueue' && req.method === 'POST') respond(202, enqueue(await readBody()));
      else if (url.pathname === '/dlq/reprocess' && req.method === 'POST') { const b = await readBody(); respond(200, b.batch ? reprocessBatch(b.count) : reprocess(b.id)); }
      else if (url.pathname === '/dlq/messages' && req.method === 'GET') respond(200, getMessages({ queue: url.searchParams.get('queue'), limit: parseInt(url.searchParams.get('limit')) || undefined }));
      else if (url.pathname === '/dlq/quarantine' && req.method === 'GET') respond(200, getQuarantine());
      else if (url.pathname === '/dlq/alerts' && req.method === 'GET') respond(200, getAlerts());
      else if (url.pathname === '/dlq/analytics' && req.method === 'GET') respond(200, getAnalytics());
      else if (url.pathname === '/dlq/purge' && req.method === 'POST') respond(200, purgeOld());
      else if (url.pathname === '/health') respond(200, { service: 'dead-letter-queue', status: 'healthy', depth: deadLetters.length, quarantine: quarantine.length, metrics });
      else respond(404, { error: 'not_found' });
    });
    server.listen(port);
    return server;
  });
}

export default { createServer, enqueue, reprocess, reprocessBatch, getMessages, getAnalytics, purgeOld };
export { createServer, enqueue, reprocess, reprocessBatch, getMessages, getAnalytics, purgeOld };
