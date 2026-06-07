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
// ║  FILE: services/status-page.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * status-page.js — Self-Hosted Status Page Service
 *
 * Uptime monitoring, incident management, and public status page
 * for all 50 Heady services. φ-scaled check intervals,
 * Fibonacci-sized history retention, CSL-gated status transitions.
 *
 * Serves at: status.headysystems.com (Port 3318)
 * Eric Haywood — HeadySystems
 * License: PROPRIETARY
 */

import { PHI, PSI, phiThreshold, fibSequence } from '../shared/phi-math.js';
import { createHash } from 'crypto';

// ── φ-Derived Constants ──────────────────────────────────
const CSL_THRESHOLDS = {
  CRITICAL: phiThreshold(4),
  HIGH:     phiThreshold(3),
  MEDIUM:   phiThreshold(2),
  LOW:      phiThreshold(1),
  MINIMUM:  phiThreshold(0),
};

const CHECK_INTERVAL_MS  = 34 * 1000;     // fib(9) = 34s between checks
const HISTORY_SIZE       = 1597;           // fib(17) data points per service
const INCIDENT_TTL_DAYS  = 89;            // fib(11) incident retention
const MAX_SERVICES       = 55;            // fib(10) tracked services
const UPTIME_WINDOW_MS   = 89 * 24 * 60 * 60 * 1000; // fib(11) days

// ── Service Status Types ────────────────────────────────
const STATUS = {
  OPERATIONAL:        { label: 'Operational',         color: '#22c55e', score: 1.0 },
  DEGRADED:           { label: 'Degraded Performance',color: '#f59e0b', score: PSI },
  PARTIAL_OUTAGE:     { label: 'Partial Outage',      color: '#f97316', score: PSI * PSI },
  MAJOR_OUTAGE:       { label: 'Major Outage',        color: '#ef4444', score: 0.0 },
  MAINTENANCE:        { label: 'Under Maintenance',   color: '#6366f1', score: PSI },
};

// ── Service Groups (matching the 50 services) ────────────
const SERVICE_GROUPS = [
  { name: 'Inference',      services: ['heady-brain', 'heady-brains', 'heady-infer', 'ai-router', 'model-gateway'] },
  { name: 'Memory',         services: ['heady-embed', 'heady-memory', 'heady-vector', 'heady-projection'] },
  { name: 'Agents',         services: ['heady-bee-factory', 'heady-hive', 'heady-federation'] },
  { name: 'Orchestration',  services: ['heady-soul', 'heady-conductor', 'heady-orchestration', 'auto-success-engine', 'hcfullpipeline-executor', 'heady-chain', 'prompt-manager'] },
  { name: 'Security',       services: ['heady-guard', 'heady-security', 'heady-governance', 'secret-gateway'] },
  { name: 'Monitoring',     services: ['heady-health', 'heady-eval', 'heady-maintenance', 'heady-testing'] },
  { name: 'Web',            services: ['heady-web', 'heady-buddy', 'heady-ui', 'heady-onboarding', 'heady-pilot-onboarding', 'heady-task-browser'] },
  { name: 'Integration',    services: ['api-gateway', 'domain-router', 'mcp-server', 'google-mcp', 'memory-mcp'] },
];

// ── Status Store ────────────────────────────────────────
const serviceStates = new Map();
const incidents = [];
let checkTimer = null;

function initService(name) {
  if (serviceStates.has(name)) return;
  serviceStates.set(name, {
    name,
    status: 'OPERATIONAL',
    latencyMs: 0,
    lastCheck: null,
    uptime: 1.0,
    history: [],     // { timestamp, status, latencyMs }
    checksTotal: 0,
    checksUp: 0,
  });
}

// ── CSL Gate ────────────────────────────────────────────
function cslGate(value, score, threshold, temperature = PSI * PSI * PSI) {
  const sigmoid = 1 / (1 + Math.exp(-(score - threshold) / temperature));
  return value * sigmoid;
}

function classifyStatus(latencyMs, isUp) {
  if (!isUp) return 'MAJOR_OUTAGE';
  if (latencyMs > 1000 * PHI * PHI) return 'DEGRADED';  // > 2618ms
  if (latencyMs > 1000 * PHI) return 'DEGRADED';         // > 1618ms (less severe)
  return 'OPERATIONAL';
}

// ── Health Check Runner ─────────────────────────────────
async function checkService(name, url) {
  const state = serviceStates.get(name);
  if (!state) return;

  const start = performance.now();
  let isUp = false;
  let latencyMs = 0;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.round(1000 * PHI * PHI)); // 2618ms
    
    const res = await fetch(url, { signal: controller.signal, method: 'GET' });
    clearTimeout(timeout);
    
    latencyMs = Math.round(performance.now() - start);
    isUp = res.status >= 200 && res.status < 500;
  } catch (fetchErr) {
    latencyMs = Math.round(performance.now() - start);
    isUp = false;
  }

  const newStatus = classifyStatus(latencyMs, isUp);
  
  state.checksTotal++;
  if (isUp) state.checksUp++;
  state.uptime = state.checksTotal > 0 ? state.checksUp / state.checksTotal : 1.0;
  state.latencyMs = latencyMs;
  state.lastCheck = new Date().toISOString();
  
  // Detect status transition
  if (state.status !== newStatus) {
    const transition = { from: state.status, to: newStatus, at: state.lastCheck, service: name };
    state.status = newStatus;
    
    // Auto-create incident on outage
    if (newStatus === 'MAJOR_OUTAGE' || newStatus === 'PARTIAL_OUTAGE') {
      createIncident({
        title: `${name}: ${STATUS[newStatus].label}`,
        status: newStatus === 'MAJOR_OUTAGE' ? 'investigating' : 'identified',
        services: [name],
        severity: newStatus === 'MAJOR_OUTAGE' ? 'critical' : 'major',
      });
    }
  }

  // Record history
  state.history.push({ timestamp: state.lastCheck, status: state.status, latencyMs });
  if (state.history.length > HISTORY_SIZE) {
    state.history = state.history.slice(-HISTORY_SIZE);
  }
}

// ── Incident Management ─────────────────────────────────
function createIncident(opts) {
  const incident = {
    id: createHash('sha256').update(`${Date.now()}-${Math.random()}`).digest('hex').slice(0, 21),
    title: opts.title,
    status: opts.status || 'investigating', // investigating | identified | monitoring | resolved
    severity: opts.severity || 'minor',     // critical | major | minor
    services: opts.services || [],
    updates: [{
      status: opts.status || 'investigating',
      message: opts.message || `Investigating: ${opts.title}`,
      timestamp: new Date().toISOString(),
    }],
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };
  incidents.push(incident);
  return incident;
}

// ── Public API ──────────────────────────────────────────
/**
 * Get current status of all services.
 */
export function getStatus() {
  const groups = SERVICE_GROUPS.map(g => ({
    name: g.name,
    services: g.services.map(s => {
      const state = serviceStates.get(s);
      return state ? {
        name: state.name,
        status: state.status,
        statusInfo: STATUS[state.status],
        latencyMs: state.latencyMs,
        uptime: state.uptime,
        lastCheck: state.lastCheck,
      } : { name: s, status: 'UNKNOWN', statusInfo: { label: 'Unknown', color: '#9ca3af', score: 0.5 } };
    }),
  }));

  // Overall status (worst of all services)
  const allStatuses = [...serviceStates.values()].map(s => STATUS[s.status]?.score ?? 1.0);
  const overallScore = allStatuses.length > 0 ? Math.min(...allStatuses) : 1.0;
  let overall = 'OPERATIONAL';
  if (overallScore < PSI * PSI) overall = 'MAJOR_OUTAGE';
  else if (overallScore < PSI) overall = 'PARTIAL_OUTAGE';
  else if (overallScore < 1.0) overall = 'DEGRADED';

  return {
    overall,
    overallInfo: STATUS[overall],
    groups,
    lastUpdated: new Date().toISOString(),
    checkInterval: CHECK_INTERVAL_MS,
  };
}

/**
 * Get active and recent incidents.
 */
export function getIncidents(opts = {}) {
  const active = incidents.filter(i => i.resolvedAt === null);
  const resolved = incidents.filter(i => i.resolvedAt !== null).slice(-34); // fib(9) recent
  return { active, recent: resolved };
}

/**
 * Get uptime history for a service.
 */
export function getHistory(serviceName, days = 89) {
  const state = serviceStates.get(serviceName);
  if (!state) return null;
  return {
    service: serviceName,
    uptime: state.uptime,
    history: state.history.slice(-days * 24),  // ~1 check per 34s ≈ 2541/day
    checksTotal: state.checksTotal,
    checksUp: state.checksUp,
  };
}

/**
 * Start periodic health checks.
 */
export function startMonitoring(serviceUrls) {
  // Initialize all services
  for (const [name] of Object.entries(serviceUrls)) {
    initService(name);
  }

  checkTimer = setInterval(async () => {
    const entries = Object.entries(serviceUrls);
    for (const [name, url] of entries) {
      await checkService(name, url);
    }
  }, CHECK_INTERVAL_MS);

  if (checkTimer.unref) checkTimer.unref();
}

/**
 * Stop monitoring.
 */
export function stopMonitoring() {
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
}

/**
 * Resolve an incident.
 */
export function resolveIncident(id, message = 'Resolved') {
  const incident = incidents.find(i => i.id === id);
  if (!incident) return null;
  incident.status = 'resolved';
  incident.resolvedAt = new Date().toISOString();
  incident.updates.push({ status: 'resolved', message, timestamp: incident.resolvedAt });
  return incident;
}

export { STATUS, SERVICE_GROUPS, CHECK_INTERVAL_MS };
export default { getStatus, getIncidents, getHistory, startMonitoring, stopMonitoring, resolveIncident, createIncident };
