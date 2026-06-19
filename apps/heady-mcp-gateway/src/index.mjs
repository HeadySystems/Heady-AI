// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ MCP Gateway v1.0.0 — headymcp.com/mcp                     ║
// ║  The single multiplexed MCP server fronting all Heady services.    ║
// ║  Spec-compliant Streamable-HTTP (stateless) · Firebase-authed ·    ║
// ║  billing-aware · fail-closed · structured logs · /health /metrics. ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import express from 'express';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createLogger } from '@heady/logger';
import { fib, PHI, HEARTBEAT_MS } from '@heady/phi-math';
import {
  buildManifest, estimateBilling, recommend, HEADY_SERVICES,
  REGISTRY_VERSION,
} from '@heady/studio-registry';

const log = createLogger({ base: { service: 'heady-mcp-gateway' } });

// ── Required configuration (no localhost, no hardcoded URLs; AGENTS.md) ──
const PORT = Number(process.env.PORT ?? 8080);
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? '';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const DATABASE_URL = process.env.DATABASE_URL ?? '';     // Neon pgvector — memory authority
const JSON_LIMIT_KB = fib(16);                            // 987kb — φ-derived body ceiling

// ── Metrics (Latent Service: { start, stop, health, metrics }) ──────
const metrics = { startedAt: Date.now(), mcpRequests: 0, toolCalls: 0, authRejects: 0, errors: 0 };

// ── Firebase ID-token verification (RS256 via JWKS, WebCrypto) ──────
const FIREBASE_JWK_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const ISS_PREFIX = 'https://securetoken.google.com/';
let jwkCache = { keys: null, expiresAtMs: 0 };

function b64urlToBytes(s) {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const bin = Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
  return new Uint8Array(bin);
}
const b64urlToJson = (s) => JSON.parse(Buffer.from(b64urlToBytes(s)).toString('utf8'));

async function firebaseJwks() {
  if (jwkCache.keys && Date.now() < jwkCache.expiresAtMs) return jwkCache.keys;
  const res = await fetch(FIREBASE_JWK_URL);
  if (!res.ok) throw new Error(`jwk fetch ${res.status}`);
  const body = await res.json();
  const maxAge = Number((res.headers.get('cache-control') || '').match(/max-age=(\d+)/)?.[1] || 3600);
  const byKid = {};
  for (const k of body.keys) byKid[k.kid] = k;
  jwkCache = { keys: byKid, expiresAtMs: Date.now() + maxAge * 1000 };
  return byKid;
}

async function verifyFirebaseToken(token) {
  if (!FIREBASE_PROJECT_ID) throw new Error('gateway misconfigured: FIREBASE_PROJECT_ID unset');
  if (typeof token !== 'string' || token.split('.').length !== 3) throw new Error('malformed token');
  const [h, p, sig] = token.split('.');
  const header = b64urlToJson(h);
  const claims = b64urlToJson(p);
  if (header.alg !== 'RS256') throw new Error(`unexpected alg ${header.alg}`);
  if (!header.kid) throw new Error('missing kid');
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number' || claims.exp <= now) throw new Error('token expired');
  if (typeof claims.iat !== 'number' || claims.iat > now + 300) throw new Error('iat in the future');
  if (claims.aud !== FIREBASE_PROJECT_ID) throw new Error('aud mismatch');
  if (claims.iss !== `${ISS_PREFIX}${FIREBASE_PROJECT_ID}`) throw new Error('iss mismatch');
  if (!claims.sub) throw new Error('missing sub');
  const jwk = (await firebaseJwks())[header.kid];
  if (!jwk) throw new Error('signing key not found for kid');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(sig), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw new Error('signature verification failed');
  return { uid: claims.sub, email: claims.email ?? null };
}

// Express middleware: fail-closed bearer auth. Attaches req.user.
async function requireAuth(req, res, next) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
  if (!m) { metrics.authRejects++; return res.status(401).json({ error: 'missing bearer token' }); }
  try {
    req.user = await verifyFirebaseToken(m[1]);
    next();
  } catch (err) {
    metrics.authRejects++;
    log.warn({ err: String(err?.message ?? err) }, 'auth rejected');
    res.status(401).json({ error: 'invalid token' });
  }
}

// ── The MCP server factory (stateless: one server per request) ──────
// Every Heady capability is a tool here; the SPA toggles which are active,
// the gateway enforces that permanent services are always available and
// meters discretionary ones. Internal Heady servers fan in here — adding a
// capability is one registerTool call wired to its package.
function buildMcpServer(user) {
  const server = new McpServer(
    { name: 'heady-mcp-gateway', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {} } },
  );

  // Resource: the Studio manifest (models, modes, services, billing…).
  server.registerResource(
    'studio-manifest',
    'heady://studio/manifest',
    { title: 'Heady Studio Manifest', description: 'Full catalog the Studio UI renders from.', mimeType: 'application/json' },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(buildManifest()) }] }),
  );

  // Tool: recommendation engine (fully functional, deterministic, no infra needed).
  server.registerTool(
    'heady_recommend',
    {
      title: 'Heady Recommendation Engine',
      description: 'Rank beneficial next-actions for the current input and selection.',
      inputSchema: { input: z.string().default(''), mode: z.string().optional() },
    },
    async ({ input, mode }) => {
      metrics.toolCalls++;
      const recs = recommend({ input, mode });
      return { content: [{ type: 'text', text: JSON.stringify({ recommendations: recs }) }] };
    },
  );

  // Tool: governance check (deterministic policy gate, AGENTS.md mandatory invocation).
  server.registerTool(
    'heady_governance_check',
    {
      title: 'Heady Governance Check',
      description: 'Verify an action/actor/domain against policy before mutation or deploy.',
      inputSchema: { action: z.string(), actor: z.string(), domain: z.string() },
    },
    async ({ action, actor, domain }) => {
      metrics.toolCalls++;
      const allowedActions = new Set(['read', 'execute', 'analyze', 'recommend']);
      const allowedDomains = new Set(['build', 'research', 'memory', 'studio']);
      const allow = allowedActions.has(action) && allowedDomains.has(domain);
      return {
        content: [{ type: 'text', text: JSON.stringify({ allow, action, actor, domain, reason: allow ? 'policy-permitted' : 'not in least-privilege allowlist' }) }],
        isError: !allow,
      };
    },
  );

  // Tool: persistent memory search. Honest fail-closed — if the Neon pgvector
  // authority is not bound, it returns bound:false with zero fabricated rows.
  server.registerTool(
    'heady_memory_search',
    {
      title: 'Heady Persistent Memory Search',
      description: 'Retrieve the user\'s persistent memories relevant to a query (Neon pgvector, T1 authority).',
      inputSchema: { query: z.string(), topK: z.number().int().positive().max(fib(8)).default(fib(5)) },
    },
    async ({ query, topK }) => {
      metrics.toolCalls++;
      if (!DATABASE_URL) {
        return { content: [{ type: 'text', text: JSON.stringify({ bound: false, reason: 'DATABASE_URL not injected; memory authority offline', uid: user.uid, query, results: [] }) }] };
      }
      // Bound path: the memory-stream package owns retrieval; the gateway never
      // fabricates rows. Wiring point kept explicit for the bound deployment.
      const { searchMemories } = await import('@heady/memory-stream').catch(() => ({ searchMemories: null }));
      if (typeof searchMemories !== 'function') {
        return { content: [{ type: 'text', text: JSON.stringify({ bound: false, reason: 'memory-stream retrieval not available in this build', results: [] }) }] };
      }
      const results = await searchMemories({ tenantId: user.uid, query, topK });
      return { content: [{ type: 'text', text: JSON.stringify({ bound: true, uid: user.uid, query, results }) }] };
    },
  );

  log.debug({ uid: user.uid }, 'mcp server instantiated');
  return server;
}

// ── HTTP surface ────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: `${JSON_LIMIT_KB}kb` }));

// CORS — explicit allowlist only (no wildcard with credentials).
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type, mcp-session-id, mcp-protocol-version');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'heady-mcp-gateway', registry: REGISTRY_VERSION, memoryBound: Boolean(DATABASE_URL) }));
app.get('/metrics', (_req, res) => res.json({ ...metrics, uptimeMs: Date.now() - metrics.startedAt, heartbeatMs: HEARTBEAT_MS }));

// Manifest over REST so the SPA can render controls without an MCP handshake.
app.get('/api/studio/manifest', requireAuth, (_req, res) => res.json(buildManifest()));

// Billing estimate for a selection (validated; permanent services bill zero).
const SelectionSchema = z.object({
  model: z.string().optional(), mode: z.string().optional(), effort: z.string().optional(),
  skills: z.array(z.string()).optional(), workflows: z.array(z.string()).optional(),
  headyServices: z.array(z.string()).optional(), externalMcp: z.array(z.string()).optional(),
});
app.post('/api/studio/estimate', requireAuth, (req, res) => {
  const parsed = SelectionSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(422).json({ error: 'invalid selection', issues: parsed.error.issues });
  res.json(estimateBilling(parsed.data));
});

// The MCP endpoint — stateless Streamable HTTP. A fresh server+transport per
// request keeps the edge simple and avoids cross-request session state.
app.post('/mcp', requireAuth, async (req, res) => {
  metrics.mcpRequests++;
  try {
    const server = buildMcpServer(req.user);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => { transport.close(); server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    metrics.errors++;
    log.error({ err: String(err?.message ?? err) }, 'mcp request failed');
    if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'internal error' }, id: null });
  }
});

// Stateless server does not support server-initiated streams over GET.
app.get('/mcp', requireAuth, (_req, res) => res.status(405).json({ error: 'method not allowed in stateless mode' }));

// Permanent Heady services are advertised as always-on (cannot be billed off).
const PERMANENT = HEADY_SERVICES.filter((s) => s.permanent).map((s) => s.id);

let httpServer = null;
function start() {
  httpServer = app.listen(PORT, () => log.info({ port: PORT, permanentServices: PERMANENT, memoryBound: Boolean(DATABASE_URL) }, 'heady-mcp-gateway listening'));
  return httpServer;
}
function stop() { return new Promise((resolve) => (httpServer ? httpServer.close(resolve) : resolve())); }
function health() { return { status: 'ok', memoryBound: Boolean(DATABASE_URL) }; }

// Latent Service contract.
export { start, stop, health, metrics, app };

// Boot when run directly.
if (import.meta.url === `file://${process.argv[1]}`) start();
