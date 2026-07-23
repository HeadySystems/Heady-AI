// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ SyncProjectionBee — governed work-unit (ADR-0017 runtime)   ║
// ║  Ports the INTENT of the legacy src/bees/sync-projection-bee.js      ║
// ║  (hash-based delta detection → one-way projection) into the          ║
// ║  governed ESM substrate. Corrected paradigm: the source of truth     ║
// ║  is the monorepo SoR, NOT RAM/vector space (ADR-0000); vector space   ║
// ║  is a derived layer. Dropped from the legacy: `git add -A`/push      ║
// ║  (the mass-deletion hazard) and RAM-as-authority framing. A "bee" is  ║
// ║  a pure work-unit — no live-swarm runtime is implied or faked.        ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                   ║
// ╚══════════════════════════════════════════════════════════════════╝
import { project } from "./projector.mjs";

/** Bee identity (parity with the legacy work-unit contract: domain/description/priority). */
export const domain = "sync-projection";
export const description = "ADR-0017 one-way projection: hash the SoR source, classify drift, emit the shell manifest";
// φ-derived priority — high, keeps projections current without magic numbers.
export const PRIORITY = 1 / 1.618033988749895; // ≈ 0.618

/**
 * Delta check: has the source changed since the manifest's last sync? Pure.
 * @returns {{changed:boolean, drift:string, sourceHash:string}}
 */
export function deltaCheck({ manifest, sourceFiles, sourceSha, nowIso }) {
  const r = project({ manifest, sourceFiles, sourceSha, nowIso });
  if (!r.ok) return { changed: false, drift: null, sourceHash: null, errors: r.errors };
  return { changed: r.drift !== "in-sync", drift: r.drift, sourceHash: r.sourceHash };
}

/**
 * Run the projection work-unit for one shell. Returns the projector result plus
 * a structured status record (the legacy bee's sync-status, minus the side
 * effects). The caller (CLI / future durable workflow) owns persistence + deploy
 * dispatch — this unit computes, it does not write upstream.
 * @returns {{bee, action, ok, drift, sourceHash, serverManifest, nextManifest, status, errors}}
 */
export function runProjectionBee({ manifest, sourceFiles, sourceSha, nowIso, observedProjectionHash = null }) {
  const r = project({ manifest, sourceFiles, sourceSha, nowIso, observedProjectionHash });
  return {
    bee: domain,
    action: "project",
    ok: r.ok,
    drift: r.drift,
    sourceHash: r.sourceHash,
    serverManifest: r.serverManifest,
    nextManifest: r.nextManifest,
    status: !r.ok ? "error" : r.drift === "projection-ahead" ? "frozen" : r.drift === "in-sync" ? "in-sync" : "reprojected",
    errors: r.errors,
  };
}
