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
// ║  FILE: packages/heady-auto-context/shared/auto-context-middleware.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * ═══════════════════════════════════════════════════════════
 * HEADY™ AUTO-CONTEXT MIDDLEWARE
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 * Mandatory context enrichment for every Heady service
 *
 * Usage:
 *   import { autoContextMiddleware } from '../../shared/auto-context-middleware.js';
 *   app.use(autoContextMiddleware);
 *   // req.headyContext is now available in all handlers
 * ═══════════════════════════════════════════════════════════
 */

import { randomUUID } from 'node:crypto';
import { PSI, CSL_GATES, phiFusionWeights, cosineSimilarity } from './phi-math.js';
import { createLogger } from './structured-logger.js';

const logger = createLogger('auto-context-middleware');

/**
 * AutoContext service URL — resolved from env at import time.
 * In production this points to the Cloud Run service.
 * Services co-located in the same process can override with setLocalEngine().
 */
let AUTOCONTEXT_URL = process.env.AUTOCONTEXT_URL || null;
let localEngine = null;

/**
 * For in-process usage (heady-auto-context service itself), wire the
 * ContextFusionEngine directly to avoid HTTP round-trips.
 */
export function setLocalEngine(engine) {
  localEngine = engine;
}

/**
 * Extract query text from the request body.
 * Supports multiple Heady payload shapes.
 */
function extractQueryText(body) {
  if (!body || typeof body !== 'object') return '';
  return (
    body.query ||
    body.text ||
    body.message ||
    body.content ||
    body.prompt ||
    body.input ||
    (body.messages && Array.isArray(body.messages) && body.messages.length > 0
      ? body.messages[body.messages.length - 1].content || ''
      : '') ||
    ''
  );
}

/**
 * Extract session state from request headers and body.
 */
function extractSessionState(req) {
  return {
    userId: req.headers['x-heady-user-id'] || req.body?.userId || null,
    tenantId: req.headers['x-heady-tenant-id'] || req.body?.tenantId || null,
    role: req.headers['x-heady-role'] || null,
    sessionId: req.headers['x-heady-session-id'] || randomUUID(),
    traceId: req.headers['x-heady-trace-id'] || randomUUID(),
  };
}

/**
 * Determine domain from request path or explicit header.
 */
function inferDomain(req) {
  if (req.headers['x-heady-domain']) return req.headers['x-heady-domain'];
  const parts = req.path.split('/').filter(Boolean);
  if (parts.length >= 2) return parts[0];
  return 'general';
}

/**
 * Remote enrichment via HTTP call to heady-auto-context service.
 */
async function remoteEnrich(queryText, domain, sessionState) {
  if (!AUTOCONTEXT_URL) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000); // 5s hard timeout

  try {
    const res = await fetch(`${AUTOCONTEXT_URL}/context/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: queryText, domain, topK: 21 }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      logger.warn({ status: res.status }, 'AutoContext remote enrichment failed');
      return null;
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      logger.warn('AutoContext remote enrichment timed out (5s)');
    } else {
      logger.warn({ error: err.message }, 'AutoContext remote enrichment error');
    }
    return null;
  }
}

/**
 * Local enrichment via in-process ContextFusionEngine.
 */
async function localEnrich(queryText, domain) {
  if (!localEngine) return null;
  try {
    return await localEngine.enrich(queryText, domain);
  } catch (err) {
    logger.warn({ error: err.message }, 'AutoContext local enrichment error');
    return null;
  }
}

/**
 * Express middleware — attaches req.headyContext on every request.
 *
 * Enrichment is best-effort: if AutoContext is unreachable, the request
 * proceeds with a degraded context object (enriched: false).
 */
export async function autoContextMiddleware(req, res, next) {
  const start = performance.now();
  const queryText = extractQueryText(req.body);
  const domain = inferDomain(req);
  const sessionState = extractSessionState(req);

  // Skip enrichment for health/readiness probes
  if (req.path === '/health' || req.path === '/healthz' || req.path === '/readiness') {
    req.headyContext = {
      vectors: [],
      domain,
      sessionState,
      cslScore: 0,
      queryEmbedding: null,
      enrichedAt: new Date().toISOString(),
      latencyMs: 0,
      pass1Age: null,
      enriched: false,
      middlewareLatencyMs: 0,
    };
    return next();
  }

  let result = null;

  // Try local engine first (zero network hop), then remote
  if (localEngine) {
    result = await localEnrich(queryText, domain);
  } else {
    result = await remoteEnrich(queryText, domain, sessionState);
  }

  const latencyMs = Math.round(performance.now() - start);

  if (result && result.results) {
    req.headyContext = {
      vectors: result.results || [],
      domain: result.domain || domain,
      sessionState,
      cslScore: result.cslScore || 0,
      queryEmbedding: result.queryEmbedding || null,
      enrichedAt: new Date().toISOString(),
      latencyMs: result.latencyMs || latencyMs,
      pass1Age: result.pass1Age || null,
      enriched: true,
      middlewareLatencyMs: latencyMs,
    };
  } else {
    // Degraded mode — context unavailable but request still proceeds
    req.headyContext = {
      vectors: [],
      domain,
      sessionState,
      cslScore: 0,
      queryEmbedding: null,
      enrichedAt: new Date().toISOString(),
      latencyMs,
      pass1Age: null,
      enriched: false,
      middlewareLatencyMs: latencyMs,
    };
  }

  next();
}
