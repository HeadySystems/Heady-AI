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
// ║  FILE: packages/heady-auto-context/src/config.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * ═══════════════════════════════════════════════════════════
 * HEADY™ AUTO-CONTEXT CONFIGURATION
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 * All defaults Fibonacci/Phi-derived — zero magic numbers
 * ═══════════════════════════════════════════════════════════
 */

import { fib, PSI, CSL_GATES } from '../shared/phi-math.js';

function envInt(key, fallback) {
  const v = process.env[key];
  return v !== undefined ? parseInt(v, 10) : fallback;
}

function envFloat(key, fallback) {
  const v = process.env[key];
  return v !== undefined ? parseFloat(v) : fallback;
}

function envStr(key, fallback = '') {
  return process.env[key] || fallback;
}

/**
 * Collect HuggingFace tokens for round-robin embedding calls.
 * At least HF_TOKEN_1 is required.
 */
function collectHfTokens() {
  const tokens = [];
  for (let i = 1; i <= 3; i++) {
    const t = process.env[`HF_TOKEN_${i}`];
    if (t) tokens.push(t);
  }
  return tokens;
}

const config = Object.freeze({
  // ── Service ────────────────────────────────────────────
  port: envInt('AUTOCONTEXT_PORT', 8907),
  serviceName: envStr('SERVICE_NAME', 'heady-auto-context'),

  // ── Pass 1: Background Scan ────────────────────────────
  scanIntervalMs: envInt('AUTOCONTEXT_SCAN_INTERVAL_MS', fib(8) * 1000), // 21,000ms

  // ── Database (Neon PostgreSQL + pgvector) ──────────────
  databaseUrl: envStr('NEON_DATABASE_URL'),
  pool: {
    min: fib(3),     // 2
    max: fib(7),     // 13
    idleTimeoutMs: 30000,
    connectionTimeoutMs: 10000,
  },

  // ── Vector Configuration ──────────────────────────────
  vectorDim: envInt('VECTOR_DIM', 384),
  hnswM: fib(8),                // 21 — graph connectivity
  hnswEfConstruction: fib(11),  // 89 — build-time beam width
  hnswEfSearch: fib(11),        // 89 — search beam width
  searchTopK: fib(8),           // 21
  batchSize: fib(7),            // 13
  cacheSize: fib(16),           // 987

  // ── Embeddings (HuggingFace API) ──────────────────────
  embeddingModel: envStr('EMBEDDING_MODEL', 'sentence-transformers/all-MiniLM-L6-v2'),
  hfTokens: collectHfTokens(),

  // ── Redis (Upstash — optional T0) ─────────────────────
  redisUrl: envStr('UPSTASH_REDIS_URL'),
  redisToken: envStr('UPSTASH_REDIS_TOKEN'),

  // ── CSL Gates ─────────────────────────────────────────
  cslGates: {
    VOID:    envFloat('CSL_GATE_VOID',    CSL_GATES.VOID),
    RECALL:  envFloat('CSL_GATE_RECALL',  CSL_GATES.RECALL),
    INCLUDE: envFloat('CSL_GATE_INCLUDE', CSL_GATES.INCLUDE),
    CORE:    envFloat('CSL_GATE_CORE',    CSL_GATES.CORE),
    INJECT:  envFloat('CSL_GATE_INJECT',  CSL_GATES.INJECT),
  },

  // ── CORS ──────────────────────────────────────────────
  allowedOrigins: envStr('ALLOWED_ORIGINS')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),

  // ── Fusion Weights (phi-derived) ──────────────────────
  fusion: {
    scanWeight: Math.pow(PSI, 2),   // ≈ 0.382
    requestWeight: PSI,              // ≈ 0.618
  },
});

// ── Validation ────────────────────────────────────────────
if (!config.databaseUrl) {
  throw new Error('FATAL: NEON_DATABASE_URL is required');
}
if (config.hfTokens.length === 0) {
  throw new Error('FATAL: At least HF_TOKEN_1 is required');
}

export default config;
