// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Consistency Bus — Express middleware adapter              ║
// ║  One app-level seam that gives EVERY route ingress recognition    ║
// ║  (locked-value drift ⇒ fail-closed BLOCK) and egress              ║
// ║  normalization (never emit a stale linked value). Extracted from  ║
// ║  the proven codeflow wiring so all service surfaces share it.     ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { loadLinkIndex, ingressGuard, egressNormalize } from "./index.mjs";

/**
 * Build the app-level consistency middleware.
 *
 * Semantics (mirrors packages/codeflow/src/server.mjs, the proven wiring):
 * - Link index loads once, best-effort: if HeadyRegistry cannot be read the
 *   middleware passes traffic through untouched and says so via status() —
 *   consistency checking degrades visibly, it never breaks serving.
 * - INGRESS: mutating methods (POST/PUT/PATCH/DELETE) with a JSON body are
 *   recognized against the registry; DRIFT on a LOCKED value ⇒ 409 BLOCK
 *   (fail-closed) unless the caller names the key in the authorized header.
 * - EGRESS: res.json payloads are rewritten to canonical linked values
 *   (type-preserving) so a stale value can never leave the process.
 *
 * @param {object} [opts]
 * @param {string} [opts.authorizedHeader] header carrying comma-separated keys
 *   authorized to change (the governed channel sets it after approval)
 * @param {string[]} [opts.exemptPaths] path prefixes to skip entirely (e.g. the
 *   governed codeflow channel itself, which owns linked-value changes)
 * @param {object} [opts.log] structured logger (pino-compatible); optional
 */
export function createConsistencyMiddleware({
  authorizedHeader = "x-heady-authorized-keys",
  exemptPaths = [],
  log,
} = {}) {
  let linkIndex = null;
  let loadError = null;
  try {
    const full = loadLinkIndex({});
    // App-level seam matches EXACT dotted paths only (byName). Bare-segment
    // matching (bySeg) over-matches generic keys — e.g. a route's honest
    // `status: "ok"` must not be "normalized" into the registry's product
    // status. Deliberate linked-value payloads always carry the full path.
    linkIndex = { byName: full.byName, bySeg: new Map(), size: full.size };
  } catch (err) {
    loadError = String(err && err.message ? err.message : err);
    if (log) log.warn({ err: loadError }, "consistency-bus: link index unavailable — passthrough mode");
  }

  const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

  function middleware(req, res, next) {
    if (!linkIndex) return next();
    if (exemptPaths.some((p) => req.path.startsWith(p))) return next();

    // EGRESS: wrap res.json so every outbound payload is normalized to
    // canonical linked values before it leaves the process.
    const originalJson = res.json.bind(res);
    res.json = (payload) => {
      try {
        return originalJson(egressNormalize(payload, linkIndex).payload);
      } catch {
        return originalJson(payload); // normalization must never break serving
      }
    };

    // INGRESS: fail-closed on locked-value drift in mutating payloads.
    if (MUTATING.has(req.method) && req.body && typeof req.body === "object") { // heady-allow:zod-boundary — cross-cutting drift guard; shape validation stays at each route
      const authorizedKeys = String(req.headers[authorizedHeader] || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const guard = ingressGuard(req.body, linkIndex, { authorizedKeys }); // heady-allow:zod-boundary — polices ANY payload for locked-value drift, schema-less by design
      if (guard.verdict === "BLOCK") {
        if (log) log.warn({ path: req.path, blocked: guard.blocked }, "consistency-bus: locked-value drift refused");
        return res.status(409).json({
          ok: false,
          error: "locked-value drift (consistency-bus)",
          blocked: guard.blocked,
        });
      }
    }
    return next();
  }

  /** Observability: loaded state + registry size, never values. */
  function status() {
    return {
      loaded: !!linkIndex,
      linkedKeys: linkIndex ? linkIndex.size : 0,
      error: loadError,
    };
  }

  return { middleware, status };
}
