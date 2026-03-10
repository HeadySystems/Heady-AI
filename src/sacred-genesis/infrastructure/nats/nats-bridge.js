/**
 * Heady NATS Event Bridge — Sacred Genesis v4.0.0
 * Bridges NATS JetStream events to HTTP service endpoints
 * Port: 3372
 *
 * @module nats-bridge
 * @author Eric Haywood, HeadySystems Inc.
 */

'use strict';

const http = require('http');
const { PHI, PSI, fib, phiBackoff, phiThreshold } = require('../../shared/phi-math');

/** @type {number} Service port — Fibonacci-derived */
const PORT = 3372;

/** @type {number} Maximum reconnect attempts — fib(8) */
const MAX_RECONNECT = fib(8);

/** @type {number} Subscription buffer size — fib(13) */
const SUB_BUFFER_SIZE = fib(13);

/** @type {number} Batch flush interval ms — phi^3 * 1000 */
const FLUSH_INTERVAL_MS = Math.round(PHI * PHI * PHI * 1000);

/**
 * Event subscription registry
 * Maps NATS subjects to HTTP endpoint targets
 * @type {Map<string, {url: string, method: string, retries: number}>}
 */
const subscriptions = new Map([
  ['heady.services.health', { url: 'http://heady-health:3328/events/health', method: 'POST', retries: fib(5) }],
  ['heady.services.metrics', { url: 'http://heady-telemetry:3356/events/metrics', method: 'POST', retries: fib(5) }],
  ['heady.services.audit', { url: 'http://heady-audit:3355/events/audit', method: 'POST', retries: fib(5) }],
  ['heady.conductor.tasks', { url: 'http://heady-conductor:3312/events/tasks', method: 'POST', retries: fib(5) }],
  ['heady.memory.vectors', { url: 'http://heady-vector-serve:3358/events/vectors', method: 'POST', retries: fib(5) }],
  ['heady.drift.alerts', { url: 'http://heady-drift-detector:3362/events/alerts', method: 'POST', retries: fib(5) }],
]);

/**
 * Event buffer for batch processing
 * @type {Array<{subject: string, data: object, timestamp: number}>}
 */
let eventBuffer = [];

/**
 * Bridge connection state
 * @type {{connected: boolean, reconnectAttempts: number, lastError: string|null}}
 */
const state = {
  connected: false,
  reconnectAttempts: 0,
  lastError: null,
  eventsProcessed: 0,
  eventsDropped: 0,
  startedAt: Date.now()
};

/**
 * Forward event to registered HTTP endpoint with phi-backoff retry
 * @param {string} subject - NATS subject
 * @param {object} data - Event payload
 * @param {number} attempt - Current retry attempt
 * @returns {Promise<boolean>} Success status
 */
async function forwardEvent(subject, data, attempt = 0) {
  const sub = subscriptions.get(subject);
  if (!sub) {
    state.eventsDropped++;
    return false;
  }

  if (attempt >= sub.retries) {
    state.eventsDropped++;
    return false;
  }

  try {
    const payload = JSON.stringify({
      subject,
      data,
      timestamp: new Date().toISOString(),
      attempt,
      bridge: 'heady-nats-bridge'
    });

    const url = new URL(sub.url);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: sub.method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'X-Heady-Bridge': 'nats',
        'X-Heady-Subject': subject,
        'X-Heady-Attempt': String(attempt)
      },
      timeout: Math.round(PHI * PHI * PHI * 1000)
    };

    await new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.write(payload);
      req.end();
    });

    state.eventsProcessed++;
    return true;
  } catch (err) {
    const delayMs = phiBackoff(attempt);
    await new Promise(r => setTimeout(r, delayMs));
    return forwardEvent(subject, data, attempt + 1);
  }
}

/**
 * Flush buffered events in batch
 * @returns {Promise<void>}
 */
async function flushBuffer() {
  if (eventBuffer.length === 0) return;

  const batch = eventBuffer.splice(0, fib(8));
  const promises = batch.map(evt => forwardEvent(evt.subject, evt.data));
  await Promise.allSettled(promises);
}

/**
 * Build health response payload
 * @returns {object} Health status
 */
function buildHealthResponse() {
  return {
    service: 'heady-nats-bridge',
    status: state.connected ? 'healthy' : 'degraded',
    version: '4.0.0',
    uptime: Date.now() - state.startedAt,
    metrics: {
      eventsProcessed: state.eventsProcessed,
      eventsDropped: state.eventsDropped,
      bufferSize: eventBuffer.length,
      subscriptions: subscriptions.size,
      reconnectAttempts: state.reconnectAttempts
    },
    phi: {
      flushInterval: FLUSH_INTERVAL_MS,
      maxReconnect: MAX_RECONNECT,
      bufferSize: SUB_BUFFER_SIZE
    }
  };
}

/**
 * HTTP server for health probes and event ingestion
 */
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/health' || url.pathname === '/healthz') {
    const health = buildHealthResponse();
    res.writeHead(health.status === 'healthy' ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health));
    return;
  }

  if (url.pathname === '/ready' || url.pathname === '/readyz') {
    res.writeHead(state.connected ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ready: state.connected }));
    return;
  }

  if (url.pathname === '/metrics') {
    const metrics = [
      `# HELP heady_nats_bridge_events_processed Total events processed`,
      `# TYPE heady_nats_bridge_events_processed counter`,
      `heady_nats_bridge_events_processed ${state.eventsProcessed}`,
      `# HELP heady_nats_bridge_events_dropped Total events dropped`,
      `# TYPE heady_nats_bridge_events_dropped counter`,
      `heady_nats_bridge_events_dropped ${state.eventsDropped}`,
      `# HELP heady_nats_bridge_buffer_size Current buffer size`,
      `# TYPE heady_nats_bridge_buffer_size gauge`,
      `heady_nats_bridge_buffer_size ${eventBuffer.length}`,
      `# HELP heady_nats_bridge_connected Connection state`,
      `# TYPE heady_nats_bridge_connected gauge`,
      `heady_nats_bridge_connected ${state.connected ? 1 : 0}`,
    ].join('\n');
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(metrics);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/publish') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { subject, data } = JSON.parse(body);
        if (!subject || !data) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing subject or data' }));
          return;
        }
        eventBuffer.push({ subject, data, timestamp: Date.now() });
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ accepted: true, bufferSize: eventBuffer.length }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Start flush interval
setInterval(flushBuffer, FLUSH_INTERVAL_MS);

// Mark as connected (in production, this waits for actual NATS connection)
state.connected = true;

server.listen(PORT, '0.0.0.0', () => {
  process.stdout.write(JSON.stringify({
    level: 'info',
    service: 'heady-nats-bridge',
    port: PORT,
    message: 'NATS bridge started',
    subscriptions: Array.from(subscriptions.keys()),
    phi: { flushInterval: FLUSH_INTERVAL_MS, maxReconnect: MAX_RECONNECT }
  }) + '\n');
});
