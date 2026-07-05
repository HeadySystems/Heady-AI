// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Admin Guard v1.0.0 — deny-by-default mutation auth        ║
// ║  (SEC-002). Generic fail-closed Express middleware: 503 while     ║
// ║  unarmed, 401 on mismatch, never default-allow. Consumes an       ║
// ║  already-resolved token digest — secret loading stays in          ║
// ║  @heady/secrets. Deliberately imports no φ policy and no          ║
// ║  security-mesh surface (ARBITER conditions, 2026-07-04).          ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { createHash, timingSafeEqual } from "node:crypto";

/** sha256 digest of a credential string. Digesting both sides of the
 *  comparison neutralizes length probing and lets the raw value be dropped. */
export function sha256Digest(value) {
  return createHash("sha256").update(String(value), "utf8").digest();
}

/**
 * Create an isolated guard instance.
 * State machine: pending → ready | failed. Anything but "ready" denies.
 * `log` receives structured entries — wire the host's pino/logger here;
 * the guard itself stays logger-agnostic (and never logs values).
 */
export function createAdminGuard({ log = () => {} } = {}) {
  let tokenDigest = null;
  let state = "pending"; // pending | ready | failed
  let errorSummary = null;
  let armPromise = null;
  let logFn = log;

  /** Swap in the host's structured logger after construction. */
  function setLogger(fn) {
    if (typeof fn === "function") logFn = fn;
  }

  /** Arm with an already-resolved credential digest (Buffer from sha256Digest). */
  function arm(digest) {
    if (!Buffer.isBuffer(digest) || digest.length !== 32) {
      throw new TypeError("arm: expected a 32-byte sha256 digest Buffer");
    }
    tokenDigest = digest;
    state = "ready";
    errorSummary = null;
    logFn({ event: "admin-guard.armed" });
    return status();
  }

  /**
   * Arm from the fail-closed @heady/secrets loader (registry-validated:
   * ADMIN_TOKEN, secret, minLength 20; GCP Secret Manager → env fallback).
   * Loading stays in @heady/secrets — this only composes it. Idempotent.
   * @param {object} [opts]
   * @param {Function} [opts.loadSecretsImpl] injection seam for tests
   */
  function armFromSecrets({ loadSecretsImpl } = {}) {
    if (armPromise) return armPromise;
    armPromise = Promise.resolve()
      .then(async () => {
        const load = loadSecretsImpl ?? (await import("@heady/secrets")).loadSecrets;
        const secrets = await load({ only: ["ADMIN_TOKEN"], require: ["ADMIN_TOKEN"] });
        return arm(sha256Digest(secrets.ADMIN_TOKEN));
      })
      .catch((err) => {
        state = "failed";
        errorSummary = String(err && err.message ? err.message : err);
        logFn({ event: "admin-guard.deny-all", error: errorSummary });
        return status();
      });
    return armPromise;
  }

  /** Express middleware for privileged mutation routes. Deny-by-default. */
  function middleware(req, res, next) {
    if (state !== "ready" || !tokenDigest) {
      if (!armPromise) armFromSecrets();
      return res.status(503).json({
        ok: false,
        error: "admin auth unavailable — privileged mutations are fail-closed",
        state,
      });
    }
    const authHeader = (req.headers && req.headers.authorization) || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const provided = (req.headers && req.headers["x-admin-token"]) || bearer;
    if (!provided || !timingSafeEqual(sha256Digest(provided), tokenDigest)) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    return next();
  }

  /** Observability surface — state only, never values. */
  function status() {
    return { state, armed: state === "ready", error: errorSummary };
  }

  return { arm, armFromSecrets, middleware, status, setLogger };
}

// ── Shared default instance ──────────────────────────────────────────────────
// The conductor, the service dispatcher, and any other registrar on the same
// process guard against the SAME armed credential. Silent until the host
// injects its structured logger via setDefaultGuardLogger.
const defaultGuard = createAdminGuard();

export const initAdminAuth = defaultGuard.armFromSecrets;
export const requireAdminMutation = defaultGuard.middleware;
export const adminAuthStatus = defaultGuard.status;
export const setDefaultGuardLogger = defaultGuard.setLogger;
