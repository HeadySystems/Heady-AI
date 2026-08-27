// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Projection Engine — the Node projector (ADR-0017 §3)        ║
// ║  Owns hashing, drift classification, and manifest emission. A       ║
// ║  projection is a pure one-way derivation from the monorepo SoR;      ║
// ║  the projector NEVER writes upstream. Pure core (IO injected): the   ║
// ║  caller supplies source files + the prior projection.yaml; this      ║
// ║  returns the drift verdict, the emitted ServerManifest (validated    ║
// ║  by @heady/contracts), and the next manifest to persist.             ║
// ║  Made with ❤️ by HeadySystems Inc.                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { validateServerManifest, validateProjectionManifest } from "@heady/contracts";
import { treeHash } from "./hash.mjs";

/**
 * Classify drift by comparing the freshly-computed source hash against the
 * projection's recorded last_sync_hash (ADR-0017 §4).
 *   - no prior hash            → source-ahead (never projected)
 *   - source hash == recorded  → in-sync
 *   - source hash != recorded  → source-ahead (re-project)
 * `projection-ahead` is only reachable when an external observed hash exceeds
 * the source — an unexpected anomaly the caller passes in explicitly.
 * @returns {"in-sync"|"source-ahead"|"projection-ahead"}
 */
export function classifyDrift({ sourceHash, lastSyncHash, observedProjectionHash = null }) {
  if (observedProjectionHash && lastSyncHash && observedProjectionHash !== lastSyncHash && sourceHash === lastSyncHash) {
    return "projection-ahead"; // projection mutated out from under the source → page + freeze
  }
  if (!lastSyncHash) return "source-ahead";
  return sourceHash === lastSyncHash ? "in-sync" : "source-ahead";
}

/**
 * Project one shell from its source. Pure — deterministic given inputs.
 * @param {object} args
 * @param {object} args.manifest     the prior projection.yaml (validated)
 * @param {Array<{rel,content}>} args.sourceFiles  the source_path file set
 * @param {string} args.sourceSha    the monorepo commit SHA (provenance)
 * @param {string} args.nowIso       timestamp (injected — deterministic tests)
 * @param {string|null} [args.observedProjectionHash]
 * @returns {{ok, errors, drift, sourceHash, serverManifest, nextManifest}}
 */
export function project({ manifest, sourceFiles, sourceSha, nowIso, observedProjectionHash = null }) {
  const mv = validateProjectionManifest(manifest);
  if (!mv.ok) return { ok: false, errors: mv.errors, drift: null, sourceHash: null, serverManifest: null, nextManifest: null };

  const { root: sourceHash, count } = treeHash(sourceFiles, { privatePaths: manifest.private_paths ?? [] });
  const drift = classifyDrift({ sourceHash, lastSyncHash: manifest.last_sync_hash ?? null, observedProjectionHash });

  // The anti-masquerade ServerManifest the §8 console reads — a projection shell
  // always declares projection_only:true with honest provenance.
  const serverManifest = {
    schema: "server-manifest.v1",
    name: manifest.id,
    projection_only: true,
    provenance: { source_repo: manifest.target_repo, source_sha: sourceSha, projected_at: nowIso },
  };
  const sv = validateServerManifest(serverManifest);
  if (!sv.ok) return { ok: false, errors: sv.errors, drift, sourceHash, serverManifest: null, nextManifest: null };

  // Next manifest: advance the sync bookkeeping only (never a backward lifecycle move).
  const nextManifest = {
    ...manifest,
    last_sync_hash: sourceHash,
    last_sync_commit: sourceSha,
    last_verified_at: nowIso,
  };

  return { ok: true, errors: [], drift, sourceHash, fileCount: count, serverManifest, nextManifest };
}
