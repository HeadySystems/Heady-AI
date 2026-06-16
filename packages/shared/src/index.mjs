// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Shared v1.0.0 — cross-cutting errors, Result, contracts   ║
// ║  Zero-dep ESM primitives imported across the monorepo.            ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

// ─── Typed errors (structured-logging friendly) ───────────────────────────────
export class HeadyError extends Error {
  /** @param {string} message @param {{code?:string,status?:number,context?:object,cause?:unknown}} [opts] */
  constructor(message, opts = {}) {
    super(message, opts.cause ? { cause: opts.cause } : undefined);
    this.name = new.target.name;
    this.code = opts.code ?? "HEADY_ERROR";
    this.status = opts.status ?? 500;
    this.context = opts.context ?? {};
  }
  /** Stable shape for logs/responses — never leaks a stack to clients. */
  toJSON() {
    return { name: this.name, code: this.code, status: this.status, message: this.message, context: this.context };
  }
}

export class ValidationError extends HeadyError {
  constructor(message, context) { super(message, { code: "VALIDATION", status: 400, context }); }
}
export class NotFoundError extends HeadyError {
  constructor(message, context) { super(message, { code: "NOT_FOUND", status: 404, context }); }
}
export class UnauthorizedError extends HeadyError {
  constructor(message, context) { super(message, { code: "UNAUTHORIZED", status: 401, context }); }
}
export class ConflictError extends HeadyError {
  constructor(message, context) { super(message, { code: "CONFLICT", status: 409, context }); }
}
export class RateLimitError extends HeadyError {
  constructor(message, context) { super(message, { code: "RATE_LIMIT", status: 429, context }); }
}
export class UpstreamError extends HeadyError {
  constructor(message, context) { super(message, { code: "UPSTREAM", status: 502, context }); }
}

// ─── Result<T,E> (explicit success/failure, no thrown control flow) ────────────
export function ok(value) { return { ok: true, value }; }
export function err(error) { return { ok: false, error }; }
export const isOk = (r) => r?.ok === true;
export const isErr = (r) => r?.ok === false;
/** Unwrap a Result or throw its error (use at boundaries, not in hot paths). */
export function unwrap(r) {
  if (isOk(r)) return r.value;
  throw r?.error instanceof Error ? r.error : new HeadyError(String(r?.error ?? "unwrap of non-Result"));
}
/** Map the success value; pass errors through untouched. */
export function mapResult(r, fn) { return isOk(r) ? ok(fn(r.value)) : r; }

// ─── Assertions ────────────────────────────────────────────────────────────────
export function assert(condition, message, context) {
  if (!condition) throw new ValidationError(message ?? "assertion failed", context);
}

// ─── Health / Latent Service Pattern contract ──────────────────────────────────
export const HEALTH = Object.freeze({ OK: "ok", DEGRADED: "degraded", DOWN: "down" });

/** Build a health report from named checks; status is the worst check. */
export function makeHealth(checks = {}) {
  const values = Object.values(checks);
  const status = values.includes(HEALTH.DOWN)
    ? HEALTH.DOWN
    : values.includes(HEALTH.DEGRADED)
      ? HEALTH.DEGRADED
      : HEALTH.OK;
  return { status, checks };
}

/**
 * The Latent Service Pattern surface (AGENTS.md): every service exports
 * { start, stop, health, metrics }. Used by @heady/kernel to validate services.
 */
export const SERVICE_METHODS = Object.freeze(["start", "stop", "health", "metrics"]);
export function isService(obj) {
  return !!obj && SERVICE_METHODS.every((m) => typeof obj[m] === "function");
}
