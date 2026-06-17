// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Secret Registry v1.0.0                                    ║
// ║  The single catalog of every secret the system consumes — names,  ║
// ║  required-ness, and validation shape. Mirrors .env.example and is ║
// ║  the authority for `heady-secrets` and loadSecrets().             ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Pure data — the only import is the FIB constant array (φ-scaling, AGENTS.md #8). `kind: "url"`
// triggers the loopback guard (AGENTS.md #4). `secret: true` marks values the CLI must never print.
// `prefix`/`minLength` are lightweight format guards (the loader fails closed on missing/malformed).
//
// `rotation` (ARBITER-cleared metadata only — declares WHEN a secret is due and by WHICH path; it
// does NOT encode any overlap-window or disable-cadence, which are patent-zone executor mechanics,
// HS-2026-051+, gated by founder clearance):
//   strategy "internal" — Heady-generated (random); cleanly auto-rotatable.
//   strategy "provider" — rotatable only via the upstream provider's admin API.
//   strategy "manual"   — no rotation API; rotated by a human via `heady-secrets rotate`.
//   strategy "root"     — an encryption root; unsafe to rotate without a KEK/DEK envelope (separate design).
//   (omitted)           — non-secret identifier / endpoint; nothing to rotate.
// maxAgeDays is FIB-derived: FIB[8]=21, FIB[9]=34, FIB[11]=89.

import { FIB } from "../../phi-math/src/index.mjs";

export const ROTATION_STRATEGIES = Object.freeze(["internal", "provider", "manual", "root"]);

export const SECRETS = Object.freeze([
  // ── Sanctioned embedding binding (ADR-0015) ──
  { name: "CLOUDFLARE_ACCOUNT_ID", required: false, kind: "id", minLength: 8,
    description: "Cloudflare account id for the Workers AI embedding binding (non-secret)." },
  { name: "CLOUDFLARE_API_TOKEN", required: false, secret: true, minLength: 20,
    rotation: { strategy: "manual", maxAgeDays: FIB[11] },
    description: "Workers AI token (scope: Workers AI:Read). Activates the locked embed path." },

  // ── Retrieval authority (ADR-0003: Neon pgvector) ──
  { name: "DATABASE_URL", required: true, kind: "url", secret: true, prefix: "postgres",
    rotation: { strategy: "provider", maxAgeDays: FIB[9] },
    description: "Neon Postgres connection string (retrieval authority)." },

  // ── Cache / best-effort hot tier (Upstash Redis) ──
  { name: "UPSTASH_REDIS_REST_URL", required: false, kind: "url",
    description: "Upstash Redis REST endpoint." },
  { name: "UPSTASH_REDIS_REST_TOKEN", required: false, secret: true, minLength: 16,
    rotation: { strategy: "provider", maxAgeDays: FIB[9] },
    description: "Upstash Redis REST token." },

  // ── Inter-service trust + key vault ──
  { name: "INTERNAL_NODE_SECRET", required: true, secret: true, minLength: 16,
    rotation: { strategy: "internal", maxAgeDays: FIB[8] },
    description: "Inter-service auth secret (Heady-generated; cleanly auto-rotatable)." },
  { name: "VAULT_PASSPHRASE", required: true, secret: true, minLength: 16,
    rotation: { strategy: "root", maxAgeDays: FIB[9] },
    description: "Encryption root for API-key encryption at rest (envelope-gated rotation)." },

  // ── Model providers (AI Gateway chokepoint) ──
  { name: "ANTHROPIC_API_KEY", required: false, secret: true, minLength: 20,
    rotation: { strategy: "manual", maxAgeDays: FIB[11] }, description: "Anthropic API key." },
  { name: "GROQ_API_KEY", required: false, secret: true, minLength: 20,
    rotation: { strategy: "manual", maxAgeDays: FIB[11] }, description: "Groq API key." },
  { name: "OPENAI_API_KEY", required: false, secret: true, minLength: 20,
    rotation: { strategy: "manual", maxAgeDays: FIB[11] }, description: "OpenAI API key." },
  { name: "GEMINI_API_KEY", required: false, secret: true, minLength: 20,
    rotation: { strategy: "manual", maxAgeDays: FIB[11] }, description: "Gemini API key." },

  // ── Non-locked embedding fallback (Hugging Face) — OFF by default; transmits corpus off-platform ──
  { name: "HUGGINGFACE_TOKEN", required: false, secret: true, minLength: 20,
    rotation: { strategy: "manual", maxAgeDays: FIB[11] },
    description: "Hugging Face token for the non-locked embed fallback (BAAI/bge-small-en-v1.5). Requires --allow-hf; off by default." },
  { name: "HEADY_ALLOW_HF_EMBED", required: false,
    description: "Flag (0/1) opting into the off-platform Hugging Face embed fallback. Non-secret; default 0." },

  // ── Owner / founder governance credential (ADR-0013) ──
  { name: "HEADY_OWNER", required: false,
    description: "Owner/founder identity (email) bound to the owner credential — non-secret." },
  { name: "HEADY_OWNER_PASS", required: false, secret: true, minLength: 16,
    rotation: { strategy: "internal", maxAgeDays: FIB[9] },
    description: "Owner credential: a bearer recognized as the founder (human) for owner-level governance, incl. sensitive-path approval (ADR-0013). Prefer a Firebase ID token in production; rotate to high-entropy." },
]);

/** Look up one registry spec by name. */
export function specFor(name) {
  return SECRETS.find((s) => s.name === name) ?? null;
}

/** The set of known secret names — used by the CLI to reject unknown keys on rotate. */
export const SECRET_NAMES = Object.freeze(SECRETS.map((s) => s.name));
