// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Legacy Advisor API v1.0.0                                 ║
// ║  Read-only surface exposing battle-tested knowledge to rebuild.   ║
// ║  Auth: Firebase ID token (Bearer) — same project as portal.       ║
// ║  Mount: app.use('/api/advisor', advisorRoutes)                    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import express  from 'express';

const router = express.Router();
const PHI    = 1.618033988749895;
const FIB    = [1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987];

// ── CORS pre-flight (portal origin) ───────────────────────────────
router.use((req, res, next) => {
  const allowed = [
    'https://headyme.com',
    'https://headyme.firebaseapp.com',
    'https://headyme.web.app',
    ...(process.env.PORTAL_ORIGIN_EXTRA ?? '').split(',').filter(Boolean),
  ];
  const origin = req.headers.origin;
  if (origin && allowed.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Firebase auth middleware ───────────────────────────────────────
router.use(async (req, res, next) => {
  // skip if auth is intentionally disabled (dev mode)
  if (process.env.ADVISOR_AUTH_DISABLED === 'true') { req.uid = 'dev'; return next(); }

  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'missing Authorization Bearer token' });

  try {
    // lazy-init firebase-admin — avoids import at module level for faster cold starts
    const { getAuth } = await import('firebase-admin/auth');
    const decoded = await getAuth().verifyIdToken(token);
    req.uid   = decoded.uid;
    req.email = decoded.email;
    next();
  } catch (e) {
    res.status(403).json({ error: 'invalid token', detail: e.message });
  }
});

// ── GET /api/advisor/health ────────────────────────────────────────
router.get('/health', (_req, res) => {
  res.json({
    status:          'healthy',
    uptimeHours:     (process.uptime() / 3600).toFixed(2),
    lastAutoCommit:  process.env.LAST_AUTOCOMMIT_TS  ?? null,
    services:        parseInt(process.env.ACTIVE_SERVICE_COUNT ?? '21', 10),
    phi:             PHI,
    node:            process.version,
    env:             process.env.NODE_ENV ?? 'production',
  });
});

// ── GET /api/advisor/swarm-status ─────────────────────────────────
router.get('/swarm-status', async (_req, res) => {
  try {
    // attempt live data from the existing swarm coordinator
    const mod = await import('../orchestration/swarm-consensus.js').catch(() => null);
    const status = await mod?.swarmCoordinator?.getStatus?.();
    if (status) return res.json(status);
  } catch { /* fallback */ }

  // static baseline (conservative — update once live swarm reporting is wired)
  res.json({
    active:      17,
    total:       17,
    beesRunning: parseInt(process.env.BEES_RUNNING ?? '0', 10),
    beesIdle:    89,
    lastUpdated: new Date().toISOString(),
  });
});

// ── GET /api/advisor/baseline ─────────────────────────────────────
router.get('/baseline', (_req, res) => {
  // Values sourced from June 2026 audit (session 43ad0ddb).
  // Lower is better for: alerts, PRs, secrets. Higher is better for all others.
  res.json({
    metrics: [
      { name: 'Pipeline stages',   legacy: 22,  rebuild: 21  },
      { name: 'Bee types',         legacy: 89,  rebuild: 30  },
      { name: 'Swarm types',       legacy: 17,  rebuild: 0   },
      { name: 'Active services',   legacy: 21,  rebuild: 3   },
      { name: 'ADRs',              legacy: 26,  rebuild: 26  },
      { name: 'Test coverage %',   legacy: 20,  rebuild: 35  },
      { name: 'Dependabot alerts', legacy: 777, rebuild: 0   },
      { name: 'Open PRs',          legacy: 312, rebuild: 1   },
      { name: 'Hardcoded secrets', legacy: 7,   rebuild: 0   },
    ],
    generatedAt: new Date().toISOString(),
    note: 'Rebuild values improve as packages are ported. Legacy values are frozen at audit.',
  });
});

// ── GET /api/advisor/patterns/:domain ─────────────────────────────
const PATTERN_REGISTRY = {
  auth: {
    strategy:   'Firebase Auth + custom JWT bearer',
    providers:  27,
    sessionTTL: 'FIB[8]=21min access / FIB[16]=987min refresh',
    keyFiles:   ['src/auth/', 'src/07-auth-manager.js'],
    notes:      'Use signInWithCustomToken for agent-to-agent; admin SDK for token minting. WebAuthn passkey flow in heady-pqc-security.',
  },
  routing: {
    strategy:  'Cloudflare Workers edge → Cloud Run origin',
    pattern:   'Wrangler fetch() proxy; Hono on Workers',
    keyFiles:  ['cloudflare/', 'src/routes/'],
    notes:     'Cache-Control: private,no-store for auth-gated; cf.cacheEverything for static. Use X-Request-ID correlation header.',
  },
  vector: {
    strategy:      'pgvector HNSW + BM25 hybrid (Reciprocal Rank Fusion)',
    indexParams:   { m: 21, ef_construction: 89, ef_search: 233 },
    model:         'bge-small-en-v1.5 (384-dim) — @cf/baai/bge-small-en-v1.5',
    quantization:  'halfvec for scalar quantization',
    keyFiles:      ['src/06-vector-memory.js', 'src/vector-memory.js'],
    notes:         'Use halfvec for 2× throughput. DEDUP threshold 0.972 for semantic identity.',
  },
  csl: {
    strategy: 'Cosine similarity as logic gate (Continuous Semantic Logic)',
    gates: {
      AND:       'cosine(a,b) >= 0.809',
      OR:        'normalize(a + b)',
      NOT:       'a − (a·b/‖b‖²)·b',
      IMPLY:     '(a·b/‖b‖²)·b',
      CONSENSUS: 'Σ(wᵢ·vᵢ) / ‖Σ(wᵢ·vᵢ)‖',
    },
    thresholds: { MINIMUM: 0.500, LOW: 0.691, MEDIUM: 0.809, HIGH: 0.882, CRITICAL: 0.927, DEDUP: 0.972 },
    keyFiles: ['src/cognitive/', 'packages/csl-engine/'],
    notes:    'Never use hardcoded thresholds — derive from PHI^n. All constants from phi-math.',
  },
  swarm: {
    strategy: '17 swarm types, each with canonical base genome, DAG task distribution',
    types:    ['BUILDER','GUARDIAN','ORACLE','CIPHER','BRIDGE','MUSE','HERALD','PYTHIA','SENTINEL',
               'OBSERVER','ATLAS','NOVA','LENS','JANITOR','SOPHIA','MURPHY','HEADY_SOUL'],
    routing:  'CSL cosine routing against task embedding (MEDIUM=0.809 gate)',
    keyFiles: ['src/09-swarm-coordinator.js', 'src/orchestration/swarm-consensus.js'],
    notes:    'Fibonacci-sized populations (8,13,21,34). Genetic algorithm for config evolution in heady-swarm-genome.',
  },
  pipeline: {
    strategy:  '22-stage HCFullPipeline (CHANNEL_ENTRY → DISTILLER)',
    stages:    22,
    paths:     { fast: 7, full: 22, arena: 9, learning: 7 },
    keyFiles:  ['src/pipeline/pipeline-core.js', 'src/pipeline/pipeline-infra.js'],
    notes:     'Checkpoint every FIB[8]=21 events. Snapshot on RECEIPT. Auto-context REQUIRED at CHANNEL_ENTRY (Law 4).',
  },
};

const ALLOWED_DOMAINS = Object.keys(PATTERN_REGISTRY);

router.get('/patterns/:domain', (req, res) => {
  const { domain } = req.params;
  if (!ALLOWED_DOMAINS.includes(domain)) {
    return res.status(400).json({ error: `unknown domain: ${domain}`, allowed: ALLOWED_DOMAINS });
  }
  res.json(PATTERN_REGISTRY[domain]);
});

// ── GET /api/advisor/config/:service ──────────────────────────────
router.get('/config/:service', (req, res) => {
  // Placeholder — wire to heady-config-oracle YAML registry
  res.json({
    service:  req.params.service,
    status:   'not_yet_wired',
    note:     'Mount heady-config-oracle to serve live YAML configs here.',
    workaround: `Check src/config/ in heady-production for ${req.params.service} config.`,
  });
});

// ── GET /api/advisor/stream  (SSE — live log stream) ──────────────
// Subscribes to the Pino structured-log stream and forwards as SSE.
// Heartbeat every PHI*1000 ≈ 1618ms to keep the connection alive.
const _logSubscribers = new Set();

// Wire this up in your server.js Pino transport:
//   process.on('heady:log:line', (entry) => _logSubscribers.forEach(fn => fn(entry)));
process.on('heady:log:line', (entry) => {
  _logSubscribers.forEach(fn => {
    try { fn(entry); } catch { _logSubscribers.delete(fn); }
  });
});

router.get('/stream', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');  // disable nginx buffering

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  // welcome beat
  send({ level: 'INFO', msg: `Legacy advisor stream connected. uid=${req.uid}`, ts: Date.now(), phi: PHI });

  // heartbeat every PHI*1000ms
  const heartbeat = setInterval(() => {
    send({ level: 'DEBUG', msg: 'heartbeat', ts: Date.now(), uptime: process.uptime().toFixed(1) });
  }, Math.round(PHI * 1000));  // 1618ms

  // subscribe to Pino log stream
  _logSubscribers.add(send);

  req.on('close', () => {
    clearInterval(heartbeat);
    _logSubscribers.delete(send);
  });
});

export default router;
