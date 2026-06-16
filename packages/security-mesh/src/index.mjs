// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Security Mesh v1.0.0 — trust-boundary primitives          ║
// ║  Fail-closed authz, HMAC request signing, RBAC, CSP, injection    ║
// ║  scan. © 2026 HeadySystems Inc. — ⚠️ PATENT zone (HS-2026-051+).   ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Pure primitives (node:crypto only). Secret *loading* lives in @heady/secrets
// (GCP Secret Manager) — this package consumes already-resolved secrets and
// enforces the trust boundary. Every decision FAILS CLOSED (SEC-002): absence of
// proof is denial, never default-allow.

import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { CIRCUIT_BREAKER } from "@heady/phi-math";

// ─── Request signing (inter-service auth) ─────────────────────────────────────
/** Canonical string signed for a request — stable field order, includes timestamp. */
function canonical({ method, path, body = "", timestamp }) {
  if (!method || !path || !timestamp) throw new TypeError("signRequest: method, path, timestamp required");
  return `${method.toUpperCase()}\n${path}\n${timestamp}\n${typeof body === "string" ? body : JSON.stringify(body)}`;
}

export function signRequest(req, secret) {
  if (!secret) throw new TypeError("signRequest: secret required (fail closed)");
  return createHmac("sha256", secret).update(canonical(req)).digest("hex");
}

/** Constant-time verify; rejects stale requests (replay window) and bad signatures. */
export function verifyRequest(req, signature, secret, { maxSkewMs = 60000, now = Date.now } = {}) {
  if (!secret || !signature) return false; // fail closed
  const skew = Math.abs(now() - Number(req.timestamp));
  if (!Number.isFinite(skew) || skew > maxSkewMs) return false; // replay / clock-skew guard
  let expected;
  try {
    expected = signRequest(req, secret);
  } catch {
    return false;
  }
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(String(signature), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// ─── Fail-closed authorization (SEC-002) ──────────────────────────────────────
/**
 * Gate a request. Returns "ALLOW" | "DENY". A missing/empty principal DENIES in
 * production (no fail-open mock mode — the exact legacy bug R-2). Non-production
 * may allow an explicit dev principal only when `allowDevBypass` is set.
 */
export function authorize(ctx = {}, { env = globalThis.process?.env?.NODE_ENV, allowDevBypass = false } = {}) {
  const hasPrincipal = Boolean(ctx.principal && ctx.principal.id);
  if (hasPrincipal) return "ALLOW";
  if (env !== "production" && allowDevBypass) return "ALLOW"; // explicit, never default
  return "DENY"; // fail closed
}

// ─── RBAC ─────────────────────────────────────────────────────────────────────
/** Minimal role→actions policy check. Unknown role or action ⇒ DENY (fail closed). */
export function can(role, action, policy = {}) {
  const allowed = policy[role];
  if (!Array.isArray(allowed)) return false;
  return allowed.includes(action) || allowed.includes("*");
}

// ─── Secret redaction (defense-in-depth for logs/errors) ──────────────────────
const SECRET_PATTERNS = [
  /\bsk-ant-[A-Za-z0-9_-]{8,}/g, // Anthropic
  /\bAIza[0-9A-Za-z_-]{35}\b/g, // Google API key
  /\bghp_[A-Za-z0-9]{20,}\b/g, // GitHub PAT
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];
export function redactSecrets(text) {
  if (typeof text !== "string") return text;
  return SECRET_PATTERNS.reduce((s, re) => s.replace(re, "[REDACTED]"), text);
}

// ─── Prompt-injection heuristic ───────────────────────────────────────────────
const INJECTION_SIGNS = [
  /ignore (?:all |the )?(?:previous|prior|above) (?:instructions|prompts)/i,
  /disregard (?:your|the) (?:system )?(?:prompt|instructions)/i,
  /reveal (?:your|the) (?:system )?prompt/i,
  /you are now (?:a|an|in) /i,
  /\bDAN\b|jailbreak/i,
];
/** Returns { flagged, score∈[0,1], hits[] }. Advisory — pair with a CSL gate. */
export function scanPromptInjection(text = "") {
  const hits = INJECTION_SIGNS.filter((re) => re.test(text)).map((re) => re.source);
  return { flagged: hits.length > 0, score: Math.min(1, hits.length / INJECTION_SIGNS.length), hits };
}

// ─── Content-Security-Policy builder (strict default) ─────────────────────────
export function buildCSP(overrides = {}) {
  const directives = {
    "default-src": ["'self'"],
    "script-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "frame-ancestors": ["'none'"],
    ...overrides,
  };
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${(Array.isArray(v) ? v : [v]).join(" ")}`)
    .join("; ");
}

/** φ-derived breaker policy re-exported for mesh consumers (rate-limit/abuse). */
export const BREAKER = CIRCUIT_BREAKER;

/** Mint a request/correlation id (X-Heady-Trace-Id seed). */
export function newTraceId() {
  return randomUUID();
}
