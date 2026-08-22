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
  { name: "CLOUDFLARE_EMAIL", required: false,
    description: "Cloudflare account email — REQUIRED only when CLOUDFLARE_API_TOKEN is a legacy Global API Key (X-Auth-Email auth). Omit when using a scoped token (Bearer). Non-secret." },
  { name: "CLOUDFLARE_API_TOKEN", required: false, secret: true, minLength: 20,
    rotation: { strategy: "manual", maxAgeDays: FIB[11] },
    description: "Workers AI credential. Preferred: a scoped token (Workers AI:Read → Bearer). Also accepts a legacy Global API Key (account-wide → set CLOUDFLARE_EMAIL). Activates the locked embed path." },

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

  // ── Permanent inter-service event fabric (ADR-0020) ──
  { name: "NATS_SERVERS", required: false, minLength: 8,
    description: "Comma-separated TLS NATS endpoints. Connection credentials must be separate secrets." },
  { name: "NATS_TOKEN", required: false, secret: true, minLength: 16,
    rotation: { strategy: "provider", maxAgeDays: FIB[9] },
    description: "NATS account token injected by GCP Secret Manager." },
  { name: "NATS_USER", required: false,
    description: "NATS account user paired with NATS_PASS; non-secret identifier." },
  { name: "NATS_PASS", required: false, secret: true, minLength: 16,
    rotation: { strategy: "provider", maxAgeDays: FIB[9] },
    description: "NATS account password injected by GCP Secret Manager." },

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
    rotation: { strategy: "manual", maxAgeDays: FIB[9] },
    description: "Owner credential: a bearer recognized as the founder (human) for owner-level governance, incl. sensitive-path approval (ADR-0013). Prefer a Firebase ID token in production; rotate to high-entropy." },

  // ── Extended providers / integrations (added 2026-06-17; rotated set) ──
  { name: "ANTHROPIC_API_KEY2", required: false, secret: true, minLength: 20,
    rotation: { strategy: "manual", maxAgeDays: FIB[11] }, description: "Secondary Anthropic API key (AI-Gateway rotation / load-spread)." },
  { name: "ANTHROPIC_API_KEY3", required: false, secret: true, minLength: 20,
    rotation: { strategy: "manual", maxAgeDays: FIB[11] }, description: "Tertiary Anthropic API key (AI-Gateway rotation / load-spread)." },
  { name: "GITHUB_TOKEN", required: false, secret: true, minLength: 20,
    rotation: { strategy: "manual", maxAgeDays: FIB[11] }, description: "GitHub PAT for repo operations (clone/push/PR)." },
  { name: "NEON_SECRET", required: false, secret: true, minLength: 20,
    rotation: { strategy: "provider", maxAgeDays: FIB[9] }, description: "Neon API key (branch/role management; distinct from DATABASE_URL)." },
  { name: "PERPLEXITY_API_KEY", required: false, secret: true, minLength: 20,
    rotation: { strategy: "manual", maxAgeDays: FIB[11] }, description: "Perplexity Sonar API key." },
  { name: "PINECONE_API_KEY", required: false, secret: true, minLength: 20,
    rotation: { strategy: "manual", maxAgeDays: FIB[11] }, description: "Pinecone API key. ⚠️ VESTIGIAL — the stack uses Neon pgvector (ADR-0003); Pinecone is not in the architecture. Retained per founder request; candidate for removal." },
  { name: "SENTRY_AUTH_TOKEN", required: false, secret: true, minLength: 20,
    rotation: { strategy: "manual", maxAgeDays: FIB[11] }, description: "Sentry auth token for release tracking / observability uploads." },
  { name: "STRIPE_SECRET_KEY", required: false, secret: true, minLength: 20, prefix: "sk_",
    rotation: { strategy: "provider", maxAgeDays: FIB[9] }, description: "Stripe secret key (billing; reserve-commit + Fibonacci tiers, ADR roadmap)." },
  { name: "STRIPE_PUBLIC_KEY", required: false, kind: "id", prefix: "pk_",
    description: "Stripe publishable key — public by design (client-side); non-secret." },

  // ── App auth + extended integrations (2026-06-17; reconciled with .env.example, all code-referenced) ──
  { name: "HEADY_API_KEY", required: false, secret: true, minLength: 20,
    rotation: { strategy: "manual", maxAgeDays: FIB[11] }, description: "Heady platform API key (client → API authentication)." },
  { name: "HEADY_MCP_BEARER", required: false, secret: true, minLength: FIB[8],
    rotation: { strategy: "internal", maxAgeDays: FIB[8] }, description: "Bootstrap bearer for authenticated Heady MCP ingress; Cloud Run receives it from GCP Secret Manager." },
  { name: "HEADY_MCP_TENANT_ID", required: false,
    description: "Tenant bound to the bootstrap MCP bearer; non-secret. Replace with verified token claims for federated clients." },
  { name: "HEADY_MCP_ALLOWED_HOSTS", required: false,
    description: "Comma-delimited MCP Host-header allowlist, without ports; non-secret." },
  { name: "HEADY_MCP_ALLOWED_ORIGINS", required: false,
    description: "Comma-delimited MCP Origin hostname allowlist, without schemes or ports; non-secret." },
  { name: "ADMIN_TOKEN", required: false, secret: true, minLength: 20,
    rotation: { strategy: "manual", maxAgeDays: FIB[9] }, description: "Admin bearer token for privileged portal/admin routes." },
  { name: "SYNC_TOKEN", required: false, secret: true, minLength: 20,
    rotation: { strategy: "internal", maxAgeDays: FIB[8] }, description: "Cross-device sync-fabric bearer: authenticates /ws/sync device upgrades (@heady/sync-fabric) and the platform-control route tier (BuddyAgentHub). Heady-generated; cleanly auto-rotatable." },
  { name: "HF_TOKEN", required: false, secret: true, minLength: 20,
    rotation: { strategy: "manual", maxAgeDays: FIB[11] }, description: "Hugging Face access token (legacy alias of HUGGINGFACE_TOKEN; both names are consumed across paths)." },
  { name: "GOOGLE_API_KEY", required: false, secret: true, minLength: 20,
    rotation: { strategy: "manual", maxAgeDays: FIB[11] }, description: "Google API key for non-Gemini Google services (Maps/etc.); distinct from GEMINI_API_KEY." },
  { name: "NEON_API_KEY", required: false, secret: true, minLength: 20,
    rotation: { strategy: "provider", maxAgeDays: FIB[9] }, description: "Neon management API key (project/branch ops); paired with NEON_PROJECT_ID, distinct from DATABASE_URL / NEON_SECRET." },
  { name: "OP_SERVICE_ACCOUNT_TOKEN", required: false, secret: true, minLength: 20,
    rotation: { strategy: "provider", maxAgeDays: FIB[9] }, description: "1Password service-account token for secrets bootstrap." },
  { name: "SENTRY_PERSONAL_TOKEN", required: false, secret: true, minLength: 20,
    rotation: { strategy: "manual", maxAgeDays: FIB[11] }, description: "Sentry personal token (CLI / source-map uploads)." },
  { name: "FIREBASE_API_KEY", required: false, kind: "id", minLength: 20,
    description: "Firebase web API key — public by design (shipped in client Auth config; security via Firebase rules, not key secrecy); non-secret." },
  { name: "SENTRY_DSN", required: false, kind: "url", prefix: "https",
    description: "Sentry DSN — client ingestion endpoint, public by Sentry design; non-secret." },
  { name: "ANTHROPIC_ORG_ID", required: false, kind: "id", minLength: 8,
    description: "Anthropic organization id (non-secret)." },
  { name: "NEON_PROJECT_ID", required: false, kind: "id", minLength: 4,
    description: "Neon project id, paired with NEON_API_KEY (non-secret)." },
  { name: "SENTRY_ORG", required: false,
    description: "Sentry organization slug, paired with SENTRY_AUTH_TOKEN/PERSONAL_TOKEN (non-secret)." },
  { name: "SENTRY_PROJECT", required: false,
    description: "Sentry project slug for observability uploads (non-secret)." },
]);

/** Look up one registry spec by name. */
export function specFor(name) {
  return SECRETS.find((s) => s.name === name) ?? null;
}

/** The set of known secret names — used by the CLI to reject unknown keys on rotate. */
export const SECRET_NAMES = Object.freeze(SECRETS.map((s) => s.name));
