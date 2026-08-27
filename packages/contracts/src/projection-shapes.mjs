// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Projection shapes — ADR-0017 governed projection contract   ║
// ║  A projection is a pure one-way derivation from the monorepo SoR     ║
// ║  → a manifest-authoritative shell. Vector/latent space is a DERIVED  ║
// ║  layer, never the authority (ADR-0000 rejects latent-as-truth).      ║
// ║  Strict dependency-free validators in the facts-schema idiom; the    ║
// ║  §8 console reads the emitted ServerManifest to render real vs       ║
// ║  projection_only. Made with ❤️ by HeadySystems Inc.                 ║
// ╚══════════════════════════════════════════════════════════════════╝

/** ADR-0017 §5 lifecycle — forward-only except deprecated→active. */
export const PROJECTION_STATES = Object.freeze([
  "proposed", "scaffolded", "active", "deprecated", "archived", "eliminated",
]);

/** Legal forward transitions (plus the single sanctioned reversal). */
export const PROJECTION_TRANSITIONS = Object.freeze({
  proposed: ["scaffolded"],
  scaffolded: ["active"],
  active: ["deprecated"],
  deprecated: ["archived", "active"], // the one allowed reversal
  archived: ["eliminated"],
  eliminated: [],
});

/** ADR-0017 §4 drift states from a source-vs-projection hash compare. */
export const DRIFT_STATES = Object.freeze(["in-sync", "source-ahead", "projection-ahead"]);

/** Projection kind — how the shell is rendered from source. */
export const PROJECTION_TYPES = Object.freeze(["static-site", "worker-shell", "pages-app", "doc-site"]);

const isStr = (v) => typeof v === "string" && v.length > 0;
const push = (errors, msg) => { errors.push(msg); return false; };

function noUnknown(obj, known, errors, where) {
  for (const k of Object.keys(obj)) {
    if (!known.includes(k)) push(errors, `${where}: unknown field "${k}" (strict contract)`);
  }
}

/**
 * Validate a projection.yaml manifest (ADR-0017 §2). Required: id, source_path,
 * target_repo, projection_type, deploy_target, status. Optional: live_url,
 * health_url, last_sync_commit, last_sync_hash, last_verified_at, owner, license,
 * drift_policy, private_paths[], transformations[], canary_config.
 * @returns {{ok:boolean, errors:string[]}}
 */
export function validateProjectionManifest(m) {
  const errors = [];
  if (!m || typeof m !== "object" || Array.isArray(m)) return { ok: false, errors: ["projection manifest must be an object"] };
  const known = [
    "schema", "id", "source_path", "target_repo", "projection_type", "deploy_target", "status",
    "live_url", "health_url", "last_sync_commit", "last_sync_hash", "last_verified_at",
    "owner", "license", "drift_policy", "private_paths", "transformations", "canary_config",
  ];
  noUnknown(m, known, errors, `projection ${m.id ?? "?"}`);
  if (m.schema !== "projection.v1") push(errors, `projection.schema must be "projection.v1"`);
  if (!isStr(m.id) || !/^[a-z0-9-]+$/.test(m.id)) push(errors, "projection.id must be kebab-case");
  if (!isStr(m.source_path)) push(errors, `projection ${m.id}: source_path required (the monorepo SoR path)`);
  if (!isStr(m.target_repo)) push(errors, `projection ${m.id}: target_repo required`);
  if (!PROJECTION_TYPES.includes(m.projection_type)) push(errors, `projection ${m.id}: projection_type must be ${PROJECTION_TYPES.join("|")}`);
  if (!isStr(m.deploy_target)) push(errors, `projection ${m.id}: deploy_target required`);
  if (!PROJECTION_STATES.includes(m.status)) push(errors, `projection ${m.id}: status must be ${PROJECTION_STATES.join("|")}`);
  if (m.live_url !== undefined && !(isStr(m.live_url) && m.live_url.startsWith("https://"))) push(errors, `projection ${m.id}: live_url must be https://`);
  if (m.health_url !== undefined && !(isStr(m.health_url) && m.health_url.startsWith("https://"))) push(errors, `projection ${m.id}: health_url must be https://`);
  if (m.last_sync_hash !== undefined && !/^[a-f0-9]{64}$/.test(String(m.last_sync_hash))) push(errors, `projection ${m.id}: last_sync_hash must be a sha256 hex`);
  if (m.private_paths !== undefined && !Array.isArray(m.private_paths)) push(errors, `projection ${m.id}: private_paths must be an array`);
  if (m.transformations !== undefined && !Array.isArray(m.transformations)) push(errors, `projection ${m.id}: transformations must be an array`);
  return { ok: errors.length === 0, errors };
}

/**
 * Is a lifecycle transition legal? (ADR-0017 §5 — forward-only except
 * deprecated→active.) @returns {boolean}
 */
export function isLegalProjectionTransition(from, to) {
  if (!PROJECTION_STATES.includes(from) || !PROJECTION_STATES.includes(to)) return false;
  return (PROJECTION_TRANSITIONS[from] ?? []).includes(to);
}
