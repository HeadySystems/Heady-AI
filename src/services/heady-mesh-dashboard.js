// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY SYSTEMS — Mesh Observability & Auto-Healing Dashboard  ║
// ║  ∞ Agent health · Event flow · Failure recovery · Real-time   ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

/*
 * © 2026 Heady™Systems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

'use strict';

const { Router } = require('../core/heady-server');
const { PHI, PSI, PHI_CUBED, FIB, phiBackoff } = require('../heady-phi-constants');
const { envelope, errorEnvelope, brandedHeaders } = require('./heady-branded-output');
const logger = require('../utils/logger');
const crypto = require('crypto');

// ─── Constants (φ-derived) ───────────────────────────────────────────────────

const HEARTBEAT_TIMEOUT_MS = Math.round(PHI_CUBED * 1000);          // 4236ms
const EVENT_BUFFER_SIZE = FIB[16];                                    // 987 ≈ 1000
const RECENT_EVENTS_LIMIT = FIB[11];                                  // 89 → use 100 as API default
const HEALTH_CHECK_INTERVAL_MS = Math.round(PHI * 1000);             // 1618ms
const MAX_RESTART_ATTEMPTS = FIB[7];                                  // 13
const FAILURE_BUFFER_SIZE = FIB[13];                                  // 233
const SSE_KEEPALIVE_MS = Math.round(PHI_CUBED * 1000 * PSI);        // ~2618ms
const SERVICE_NAME = 'mesh-dashboard';

// ─── Agent Registry ──────────────────────────────────────────────────────────

const agents = new Map();

function registerAgent(id, config = {}) {
  const agent = {
    id,
    name: config.name || id,
    type: config.type || 'generic',
    status: 'healthy',
    lastHeartbeat: Date.now(),
    errorCount: 0,
    restartCount: 0,
    registeredAt: Date.now(),
    metadata: config.metadata || {},
    connections: config.connections || [],
  };
  agents.set(id, agent);
  pushEvent('agent.registered', id, { name: agent.name, type: agent.type });
  return agent;
}

function getAgent(id) {
  return agents.get(id) || null;
}

function getAllAgents() {
  return Array.from(agents.values());
}

function heartbeat(agentId) {
  const agent = agents.get(agentId);
  if (!agent) return false;
  agent.lastHeartbeat = Date.now();
  if (agent.status === 'degraded' || agent.status === 'down') {
    const prev = agent.status;
    agent.status = 'healthy';
    agent.errorCount = 0;
    pushEvent('agent.recovered', agentId, { previous: prev });
  }
  return true;
}

function reportAgentError(agentId, error) {
  const agent = agents.get(agentId);
  if (!agent) return;
  agent.errorCount++;
  if (agent.errorCount >= FIB[5]) {          // 5 errors → degraded
    agent.status = 'degraded';
    pushEvent('agent.degraded', agentId, { errorCount: agent.errorCount, error });
  }
  if (agent.errorCount >= FIB[7]) {          // 13 errors → down
    agent.status = 'down';
    pushEvent('agent.down', agentId, { errorCount: agent.errorCount, error });
    recordFailure(agentId, error);
  }
}

// ─── Health Monitor ──────────────────────────────────────────────────────────

let healthCheckTimer = null;

function startHealthMonitor() {
  if (healthCheckTimer) return;
  healthCheckTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, agent] of agents) {
      if (agent.status === 'down') continue;
      const elapsed = now - agent.lastHeartbeat;
      if (elapsed > HEARTBEAT_TIMEOUT_MS * 2 && agent.status !== 'down') {
        agent.status = 'down';
        pushEvent('agent.timeout.down', id, { elapsed, threshold: HEARTBEAT_TIMEOUT_MS * 2 });
        recordFailure(id, `Heartbeat timeout: ${elapsed}ms > ${HEARTBEAT_TIMEOUT_MS * 2}ms`);
      } else if (elapsed > HEARTBEAT_TIMEOUT_MS && agent.status === 'healthy') {
        agent.status = 'degraded';
        pushEvent('agent.timeout.degraded', id, { elapsed, threshold: HEARTBEAT_TIMEOUT_MS });
      }
    }
  }, HEALTH_CHECK_INTERVAL_MS);
  healthCheckTimer.unref();
}

function stopHealthMonitor() {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
}

// ─── Event Flow Tracking (Circular Buffer) ───────────────────────────────────

const eventBuffer = new Array(EVENT_BUFFER_SIZE);
let eventWriteIdx = 0;
let eventCount = 0;
let eventsPerSecondWindow = [];
const eventsByType = new Map();
const eventsBySource = new Map();
const sseClients = new Set();

function pushEvent(type, source, data = {}) {
  const event = {
    id: `evt-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`,
    type,
    source,
    data,
    ts: Date.now(),
    isoTs: new Date().toISOString(),
  };

  eventBuffer[eventWriteIdx] = event;
  eventWriteIdx = (eventWriteIdx + 1) % EVENT_BUFFER_SIZE;
  eventCount++;

  // Track per-second rate
  eventsPerSecondWindow.push(event.ts);
  const oneSecondAgo = Date.now() - 1000;
  eventsPerSecondWindow = eventsPerSecondWindow.filter(t => t > oneSecondAgo);

  // Track by type
  eventsByType.set(type, (eventsByType.get(type) || 0) + 1);

  // Track by source
  eventsBySource.set(source, (eventsBySource.get(source) || 0) + 1);

  // SSE broadcast
  for (const client of sseClients) {
    try {
      client.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }

  return event;
}

function getRecentEvents(limit = 100) {
  const count = Math.min(limit, eventCount, EVENT_BUFFER_SIZE);
  const events = [];
  let idx = (eventWriteIdx - count + EVENT_BUFFER_SIZE) % EVENT_BUFFER_SIZE;
  for (let i = 0; i < count; i++) {
    const evt = eventBuffer[(idx + i) % EVENT_BUFFER_SIZE];
    if (evt) events.push(evt);
  }
  return events.reverse(); // newest first
}

function getEventStats() {
  return {
    totalEvents: eventCount,
    eventsPerSecond: eventsPerSecondWindow.length,
    bufferCapacity: EVENT_BUFFER_SIZE,
    bufferUsed: Math.min(eventCount, EVENT_BUFFER_SIZE),
    byType: Object.fromEntries(eventsByType),
    bySource: Object.fromEntries(eventsBySource),
  };
}

// ─── Failure Tracking & Auto-Healing ─────────────────────────────────────────

const failures = [];

function recordFailure(agentId, error) {
  const failure = {
    id: `fail-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`,
    agentId,
    error: typeof error === 'string' ? error : (error.message || String(error)),
    ts: Date.now(),
    isoTs: new Date().toISOString(),
    recoveryStatus: 'pending',
    recoveryAttempts: 0,
    recoveredAt: null,
  };
  failures.push(failure);
  if (failures.length > FAILURE_BUFFER_SIZE) {
    failures.splice(0, failures.length - FAILURE_BUFFER_SIZE);
  }
  pushEvent('failure.recorded', agentId, { failureId: failure.id, error: failure.error });
  return failure;
}

function getRecentFailures(limit = FIB[10]) {  // 55
  return failures.slice(-limit).reverse();
}

async function restartAgent(agentId) {
  const agent = agents.get(agentId);
  if (!agent) {
    return { ok: false, error: `Agent ${agentId} not found` };
  }

  if (agent.restartCount >= MAX_RESTART_ATTEMPTS) {
    pushEvent('agent.restart.exhausted', agentId, { restartCount: agent.restartCount, max: MAX_RESTART_ATTEMPTS });
    return { ok: false, error: `Max restart attempts (${MAX_RESTART_ATTEMPTS}) reached for ${agentId}` };
  }

  pushEvent('agent.restarting', agentId, { attempt: agent.restartCount + 1 });

  // Simulate restart with phi-backoff delay
  const delay = phiBackoff(agent.restartCount);
  await new Promise(resolve => setTimeout(resolve, Math.min(delay, FIB[8] * 100))); // cap at 2100ms

  agent.status = 'healthy';
  agent.errorCount = 0;
  agent.lastHeartbeat = Date.now();
  agent.restartCount++;

  // Update matching failure records
  for (let i = failures.length - 1; i >= 0; i--) {
    if (failures[i].agentId === agentId && failures[i].recoveryStatus === 'pending') {
      failures[i].recoveryStatus = 'recovered';
      failures[i].recoveredAt = new Date().toISOString();
      failures[i].recoveryAttempts++;
      break;
    }
  }

  pushEvent('agent.restarted', agentId, { restartCount: agent.restartCount });
  return { ok: true, agent: serializeAgent(agent) };
}

async function autoHeal(targetId) {
  const agent = agents.get(targetId);
  if (!agent) {
    return { ok: false, error: `Agent ${targetId} not found` };
  }

  if (agent.status === 'healthy') {
    return { ok: true, message: `Agent ${targetId} is already healthy`, agent: serializeAgent(agent) };
  }

  pushEvent('heal.initiated', targetId, { currentStatus: agent.status, errorCount: agent.errorCount });

  // Phase 1: Clear error state
  agent.errorCount = 0;
  pushEvent('heal.errors_cleared', targetId, {});

  // Phase 2: Restart
  const result = await restartAgent(targetId);
  if (!result.ok) {
    pushEvent('heal.failed', targetId, { reason: result.error });
    return result;
  }

  // Phase 3: Emit recovery event
  pushEvent('heal.completed', targetId, { newStatus: agent.status });

  return {
    ok: true,
    healed: true,
    agent: serializeAgent(agent),
    actions: ['errors_cleared', 'restarted', 'recovery_event_emitted'],
  };
}

// ─── Topology ────────────────────────────────────────────────────────────────

function buildTopology() {
  const nodes = [];
  const edges = [];
  const edgeSet = new Set();

  for (const agent of agents.values()) {
    nodes.push({
      id: agent.id,
      label: agent.name,
      type: agent.type,
      status: agent.status,
      errorCount: agent.errorCount,
      lastHeartbeat: agent.lastHeartbeat,
    });

    for (const connId of agent.connections) {
      const edgeKey = [agent.id, connId].sort().join('::');
      if (!edgeSet.has(edgeKey) && agents.has(connId)) {
        edgeSet.add(edgeKey);
        edges.push({
          source: agent.id,
          target: connId,
          weight: PHI, // default phi-weighted link
          healthy: agents.get(agent.id)?.status === 'healthy' &&
                   agents.get(connId)?.status === 'healthy',
        });
      }
    }
  }

  return { nodes, edges, nodeCount: nodes.length, edgeCount: edges.length };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function serializeAgent(agent) {
  return {
    id: agent.id,
    name: agent.name,
    type: agent.type,
    status: agent.status,
    lastHeartbeat: agent.lastHeartbeat,
    lastHeartbeatIso: new Date(agent.lastHeartbeat).toISOString(),
    errorCount: agent.errorCount,
    restartCount: agent.restartCount,
    registeredAt: agent.registeredAt,
    metadata: agent.metadata,
    connections: agent.connections,
  };
}

function computeMeshStatus() {
  const all = getAllAgents();
  const healthy = all.filter(a => a.status === 'healthy').length;
  const degraded = all.filter(a => a.status === 'degraded').length;
  const down = all.filter(a => a.status === 'down').length;
  const total = all.length;

  let overallStatus = 'healthy';
  if (down > 0) overallStatus = 'degraded';
  if (total > 0 && down === total) overallStatus = 'critical';
  if (total === 0) overallStatus = 'empty';

  // Health score: φ-weighted (healthy contributes PHI, degraded 1, down 0)
  const score = total > 0
    ? Math.round(((healthy * PHI + degraded * 1) / (total * PHI)) * 100)
    : 0;

  return {
    status: overallStatus,
    healthScore: score,
    agents: { total, healthy, degraded, down },
    eventFlow: getEventStats(),
    uptime: process.uptime(),
    heartbeatTimeoutMs: HEARTBEAT_TIMEOUT_MS,
  };
}

// ─── Auth Middleware ─────────────────────────────────────────────────────────

function meshAuth(req, res, next) {
  // Accept bearer token or heady_session cookie
  const token = req.headers.authorization?.replace('Bearer ', '') ||
                req.cookies?.heady_session;
  const apiKey = process.env.HEADY_API_KEY;

  // In development, allow if no API key set
  if (!apiKey) return next();

  if (!token) {
    return res.status(401).json(errorEnvelope(SERVICE_NAME, 'Authentication required', 401));
  }

  if (token !== apiKey) {
    return res.status(403).json(errorEnvelope(SERVICE_NAME, 'Invalid credentials', 403));
  }

  next();
}

// ─── Router ──────────────────────────────────────────────────────────────────

const router = Router();

// Apply branding headers to all mesh routes
router.use(brandedHeaders);

// GET /api/mesh/status — Overall mesh status
router.get('/status', meshAuth, (req, res) => {
  res.json(envelope(SERVICE_NAME, computeMeshStatus(), {
    phiConstants: { heartbeatTimeout: HEARTBEAT_TIMEOUT_MS, bufferSize: EVENT_BUFFER_SIZE },
  }));
});

// GET /api/mesh/agents — List all agents
router.get('/agents', meshAuth, (req, res) => {
  const agentList = getAllAgents().map(serializeAgent);
  res.json(envelope(SERVICE_NAME, {
    agents: agentList,
    count: agentList.length,
  }));
});

// GET /api/mesh/agents/:agentId — Specific agent details
router.get('/agents/:agentId', meshAuth, (req, res) => {
  const agent = getAgent(req.params.agentId);
  if (!agent) {
    return res.status(404).json(errorEnvelope(SERVICE_NAME, `Agent ${req.params.agentId} not found`, 404));
  }
  res.json(envelope(SERVICE_NAME, serializeAgent(agent)));
});

// POST /api/mesh/agents/:agentId/restart — Restart specific agent
router.post('/agents/:agentId/restart', meshAuth, async (req, res) => {
  try {
    const result = await restartAgent(req.params.agentId);
    if (!result.ok) {
      return res.status(result.error.includes('not found') ? 404 : 429)
        .json(errorEnvelope(SERVICE_NAME, result.error, result.error.includes('not found') ? 404 : 429));
    }
    res.json(envelope(SERVICE_NAME, result));
  } catch (err) {
    logger.error({ err, agentId: req.params.agentId }, 'Agent restart failed');
    res.status(500).json(errorEnvelope(SERVICE_NAME, err.message, 500));
  }
});

// GET /api/mesh/events — Recent event bus activity
router.get('/events', meshAuth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, EVENT_BUFFER_SIZE);
  const type = req.query.type || null;
  let events = getRecentEvents(limit);
  if (type) {
    events = events.filter(e => e.type === type);
  }
  res.json(envelope(SERVICE_NAME, {
    events,
    count: events.length,
    stats: getEventStats(),
  }));
});

// GET /api/mesh/events/stream — SSE real-time event stream
router.get('/events/stream', meshAuth, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Powered-By': 'HeadyMe/3.0',
    'X-Heady-Service': 'HeadyMesh',
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', ts: new Date().toISOString(), meshStatus: computeMeshStatus() })}\n\n`);

  sseClients.add(res);

  // Keepalive using phi-derived interval
  const keepalive = setInterval(() => {
    try {
      res.write(`: keepalive ${Date.now()}\n\n`);
    } catch {
      clearInterval(keepalive);
      sseClients.delete(res);
    }
  }, SSE_KEEPALIVE_MS);

  req.on('close', () => {
    clearInterval(keepalive);
    sseClients.delete(res);
  });
});

// GET /api/mesh/topology — Service mesh topology graph
router.get('/topology', meshAuth, (req, res) => {
  const topology = buildTopology();
  res.json(envelope(SERVICE_NAME, topology, {
    phiLinkWeight: PHI,
    timestamp: new Date().toISOString(),
  }));
});

// GET /api/mesh/failures — Recent failures with recovery status
router.get('/failures', meshAuth, (req, res) => {
  const limit = parseInt(req.query.limit, 10) || FIB[10]; // 55
  const statusFilter = req.query.status || null;
  let failureList = getRecentFailures(limit);
  if (statusFilter) {
    failureList = failureList.filter(f => f.recoveryStatus === statusFilter);
  }
  res.json(envelope(SERVICE_NAME, {
    failures: failureList,
    count: failureList.length,
    summary: {
      pending: failures.filter(f => f.recoveryStatus === 'pending').length,
      recovered: failures.filter(f => f.recoveryStatus === 'recovered').length,
      total: failures.length,
    },
  }));
});

// POST /api/mesh/heal — Trigger auto-healing for a failed service
router.post('/heal', meshAuth, async (req, res) => {
  const { agentId } = req.body || {};
  if (!agentId) {
    return res.status(400).json(errorEnvelope(SERVICE_NAME, 'agentId is required in request body', 400));
  }

  try {
    const result = await autoHeal(agentId);
    if (!result.ok) {
      const code = result.error.includes('not found') ? 404 : 500;
      return res.status(code).json(errorEnvelope(SERVICE_NAME, result.error, code));
    }
    res.json(envelope(SERVICE_NAME, result));
  } catch (err) {
    logger.error({ err, agentId }, 'Auto-heal failed');
    res.status(500).json(errorEnvelope(SERVICE_NAME, err.message, 500));
  }
});

// ─── Start health monitor on load ───────────────────────────────────────────

startHealthMonitor();

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = router;

// Expose internals for programmatic use by other services
module.exports.router = router;
module.exports.registerAgent = registerAgent;
module.exports.heartbeat = heartbeat;
module.exports.reportAgentError = reportAgentError;
module.exports.pushEvent = pushEvent;
module.exports.getRecentEvents = getRecentEvents;
module.exports.getEventStats = getEventStats;
module.exports.buildTopology = buildTopology;
module.exports.computeMeshStatus = computeMeshStatus;
module.exports.restartAgent = restartAgent;
module.exports.autoHeal = autoHeal;
module.exports.getAgent = getAgent;
module.exports.getAllAgents = getAllAgents;
module.exports.getRecentFailures = getRecentFailures;
module.exports.startHealthMonitor = startHealthMonitor;
module.exports.stopHealthMonitor = stopHealthMonitor;
module.exports.HEARTBEAT_TIMEOUT_MS = HEARTBEAT_TIMEOUT_MS;
module.exports.EVENT_BUFFER_SIZE = EVENT_BUFFER_SIZE;
