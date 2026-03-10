/**
 * Heady Error Codes — Centralized error taxonomy with φ-categorized severity
 * Structured error creation, lookup, and error chain tracking
 * Author: Eric Haywood | All constants φ-derived | ESM only
 */
import { createHash } from 'crypto';
import { PHI, PSI, PSI2, phiThreshold, fibonacci } from '../shared/phi-math-v2.js';
import { cslGate } from '../shared/csl-engine-v2.js';

const SEVERITY_LEVELS = {
  CRITICAL: { level: 4, threshold: phiThreshold(4), retryable: false },
  HIGH:     { level: 3, threshold: phiThreshold(3), retryable: false },
  MEDIUM:   { level: 2, threshold: phiThreshold(2), retryable: true },
  LOW:      { level: 1, threshold: phiThreshold(1), retryable: true },
  INFO:     { level: 0, threshold: phiThreshold(0), retryable: true },
};

const ERROR_DOMAINS = {
  AUTH:    { prefix: 'AUTH', range: [1000, 1999] },
  API:     { prefix: 'API',  range: [2000, 2999] },
  DATA:    { prefix: 'DATA', range: [3000, 3999] },
  INFRA:   { prefix: 'INFRA', range: [4000, 4999] },
  AGENT:   { prefix: 'AGENT', range: [5000, 5999] },
  MEMORY:  { prefix: 'MEM',  range: [6000, 6999] },
  BILLING: { prefix: 'BILL', range: [7000, 7999] },
  SEARCH:  { prefix: 'SRCH', range: [8000, 8999] },
  DEPLOY:  { prefix: 'DEPL', range: [9000, 9999] },
};

function sha256(input) { return createHash('sha256').update(String(input)).digest('hex'); }

const errorRegistry = new Map();
const errorLog = [];
const MAX_LOG_SIZE = fibonacci(17); // 1597

// Register all canonical errors
const CANONICAL_ERRORS = [
  { code: 'AUTH_1001', domain: 'AUTH', severity: 'CRITICAL', message: 'Session expired', httpStatus: 401, action: 'Re-authenticate via Firebase relay' },
  { code: 'AUTH_1002', domain: 'AUTH', severity: 'HIGH', message: 'CSRF token invalid', httpStatus: 403, action: 'Generate new CSRF token' },
  { code: 'AUTH_1003', domain: 'AUTH', severity: 'CRITICAL', message: 'Device fingerprint mismatch', httpStatus: 403, action: 'Revoke session and re-authenticate' },
  { code: 'AUTH_1004', domain: 'AUTH', severity: 'MEDIUM', message: 'Rate limit exceeded', httpStatus: 429, action: 'Wait for φ-backoff delay' },
  { code: 'API_2001', domain: 'API', severity: 'MEDIUM', message: 'Invalid request payload', httpStatus: 400, action: 'Validate against API contract schema' },
  { code: 'API_2002', domain: 'API', severity: 'LOW', message: 'Resource not found', httpStatus: 404, action: 'Verify resource ID' },
  { code: 'API_2003', domain: 'API', severity: 'HIGH', message: 'Service unavailable', httpStatus: 503, action: 'Check service health, failover to backup' },
  { code: 'API_2004', domain: 'API', severity: 'MEDIUM', message: 'Contract validation failed', httpStatus: 422, action: 'Check schema compatibility' },
  { code: 'DATA_3001', domain: 'DATA', severity: 'CRITICAL', message: 'Database connection failed', httpStatus: 500, action: 'Check PgBouncer pool, failover to replica' },
  { code: 'DATA_3002', domain: 'DATA', severity: 'HIGH', message: 'Migration drift detected', httpStatus: 500, action: 'Run drift detection and reconcile' },
  { code: 'DATA_3003', domain: 'DATA', severity: 'MEDIUM', message: 'Vector index degraded', httpStatus: 200, action: 'Rebuild HNSW index with φ-params' },
  { code: 'INFRA_4001', domain: 'INFRA', severity: 'CRITICAL', message: 'Container health check failed', httpStatus: 503, action: 'Restart container, check resource limits' },
  { code: 'INFRA_4002', domain: 'INFRA', severity: 'HIGH', message: 'Circuit breaker open', httpStatus: 503, action: 'Wait for half-open probe' },
  { code: 'INFRA_4003', domain: 'INFRA', severity: 'MEDIUM', message: 'Resource pressure elevated', httpStatus: 200, action: 'Scale up or shed low-priority load' },
  { code: 'AGENT_5001', domain: 'AGENT', severity: 'HIGH', message: 'Agent coherence drift', httpStatus: 500, action: 'Re-embed and check against HeadySoul' },
  { code: 'AGENT_5002', domain: 'AGENT', severity: 'MEDIUM', message: 'Prompt injection detected', httpStatus: 400, action: 'Sanitize input, log for security review' },
  { code: 'AGENT_5003', domain: 'AGENT', severity: 'CRITICAL', message: 'Autonomy guardrail triggered', httpStatus: 403, action: 'Escalate to human review' },
  { code: 'MEM_6001', domain: 'MEMORY', severity: 'HIGH', message: 'Vector memory full', httpStatus: 507, action: 'Evict using φ-weighted scoring' },
  { code: 'MEM_6002', domain: 'MEMORY', severity: 'MEDIUM', message: 'Embedding dimension mismatch', httpStatus: 400, action: 'Check embedding model configuration' },
  { code: 'BILL_7001', domain: 'BILLING', severity: 'HIGH', message: 'Credit limit reached', httpStatus: 402, action: 'Upgrade plan or wait for reset' },
  { code: 'BILL_7002', domain: 'BILLING', severity: 'CRITICAL', message: 'Payment failed', httpStatus: 402, action: 'Update payment method in Stripe' },
  { code: 'SRCH_8001', domain: 'SEARCH', severity: 'MEDIUM', message: 'Search index stale', httpStatus: 200, action: 'Trigger re-index' },
  { code: 'DEPL_9001', domain: 'DEPLOY', severity: 'CRITICAL', message: 'Deployment rollback triggered', httpStatus: 500, action: 'Check deployment logs, restore previous version' },
  { code: 'DEPL_9002', domain: 'DEPLOY', severity: 'HIGH', message: 'Canary failure detected', httpStatus: 500, action: 'Halt rollout, revert canary' },
];

for (const err of CANONICAL_ERRORS) {
  errorRegistry.set(err.code, { ...err, hash: sha256(err.code + err.message) });
}

function createError(code, context) {
  const registered = errorRegistry.get(code);
  if (!registered) return { error: 'unknown_error_code', code };
  const severity = SEVERITY_LEVELS[registered.severity];
  const instance = {
    code: registered.code,
    domain: registered.domain,
    severity: registered.severity,
    severityLevel: severity.level,
    message: registered.message,
    httpStatus: registered.httpStatus,
    action: registered.action,
    retryable: severity.retryable,
    context: context || {},
    timestamp: Date.now(),
    hash: sha256(code + JSON.stringify(context) + Date.now()),
    traceId: context?.traceId || sha256(Date.now().toString()).slice(0, 16),
  };

  if (errorLog.length >= MAX_LOG_SIZE) errorLog.shift();
  errorLog.push(instance);
  return instance;
}

function lookupError(code) { return errorRegistry.get(code) || null; }
function listErrors(domain) {
  const all = [...errorRegistry.values()];
  return domain ? all.filter(e => e.domain === domain) : all;
}

function getErrorAnalytics() {
  const bySeverity = {};
  const byDomain = {};
  for (const e of errorLog) {
    bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1;
    byDomain[e.domain] = (byDomain[e.domain] || 0) + 1;
  }
  return { total: errorLog.length, bySeverity, byDomain, recentErrors: errorLog.slice(-fibonacci(8)) };
}

function createServer(port = 3385) {
  return import('http').then(({ default: http }) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const respond = (s, b) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(b)); };
      const readBody = () => new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => { try { r(JSON.parse(Buffer.concat(c).toString())); } catch (parseErr) { r({ _parseError: parseErr.message }); } }); });

      if (url.pathname === '/errors/create' && req.method === 'POST') { const b = await readBody(); respond(200, createError(b.code, b.context)); }
      else if (url.pathname === '/errors/lookup' && req.method === 'GET') { const e = lookupError(url.searchParams.get('code')); respond(e ? 200 : 404, e || { error: 'not_found' }); }
      else if (url.pathname === '/errors/list' && req.method === 'GET') respond(200, listErrors(url.searchParams.get('domain')));
      else if (url.pathname === '/errors/analytics' && req.method === 'GET') respond(200, getErrorAnalytics());
      else if (url.pathname === '/health') respond(200, { service: 'error-codes', status: 'healthy', registeredErrors: errorRegistry.size, logSize: errorLog.length });
      else respond(404, { error: 'not_found' });
    });
    server.listen(port);
    return server;
  });
}

export default { createServer, createError, lookupError, listErrors, getErrorAnalytics, SEVERITY_LEVELS, ERROR_DOMAINS, CANONICAL_ERRORS };
export { createServer, createError, lookupError, listErrors, getErrorAnalytics, SEVERITY_LEVELS, ERROR_DOMAINS, CANONICAL_ERRORS };
