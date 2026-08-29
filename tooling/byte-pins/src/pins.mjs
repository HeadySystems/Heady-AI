// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Byte Pins — what you may not edit casually                 ║
// ║  A registry of every path whose BYTES are bound somewhere else:    ║
// ║  a checksum journal, a manifest hash, a signed tag, an equality    ║
// ║  gate. Editing one silently breaks a build, a deploy, or a         ║
// ║  migration in an environment you are not looking at.               ║
// ║  Made with ❤️ by HeadySystems Inc.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// WHY THIS EXISTS. On 2026-08-27 a repo-wide branding sweep (f69ddccdcd) changed
// one comment line in 550 files. Two of them were byte-pinned:
//   • policies/approval.rego  — pinned by packages/approvals/policy/manifest.json
//     sourceSha256 and asserted by prepare-genesis-manifest.mjs. The @heady/approvals
//     build started failing and genesis was blocked (fixed in 51d3030c2b).
//   • apps/headyme-portal/**  — the source tree of four projection manifests. The
//     ADR-0017 drift gate went red on the checkpoint branch and every PR branched
//     from it (fixed in c82c7416e5).
// The SQL migrations were spared only because that one pin happened to be noticed.
// One noticed instance is not a method; this registry is the method.
//
// This module is a REGISTRY AND DISPATCHER, never a second hash engine. Where a
// checker already exists it is named and delegated to, so there is exactly one
// implementation of each rule.

/** Does a changed path fall under this pin? `prefix` matches a subtree. */
const underPrefix = (p, prefix) => p === prefix || p.startsWith(`${prefix}/`);

/**
 * Every known byte pin. Add a row when you bind a file's bytes to a hash, a
 * journal, or a signature — that is the whole maintenance burden.
 *
 * @property {string}  id       stable identifier
 * @property {(p:string)=>boolean} covers  does this pin apply to a repo-relative path
 * @property {string}  pinnedBy where the binding lives
 * @property {string}  breaks   what fails, and where, if the bytes move
 * @property {string}  repin    the command or action that re-establishes the pin
 * @property {boolean} offlineVerifiable  false = the authority is remote (a DB, a signature)
 */
export const BYTE_PINS = [
  {
    id: 'db-migrations',
    covers: (p) => underPrefix(p, 'packages/db/migrations') && p.endsWith('.sql'),
    pinnedBy: 'the schema_migrations checksum journal in the DATABASE (packages/db/src/migrate.mjs)',
    breaks: 'MigrationDriftError — "applied migration was edited after apply" — in EVERY environment that already applied it. The checksum is sha256 over raw file text, so a comment edit is indistinguishable from a DDL edit.',
    repin: 'IMPOSSIBLE. An applied migration is immutable; author a new NNNN_*.sql instead.',
    offlineVerifiable: false,
  },
  {
    id: 'approval-policy',
    covers: (p) => p === 'policies/approval.rego',
    pinnedBy: 'packages/approvals/policy/manifest.json → sourceSha256, asserted by packages/approvals/bin/prepare-genesis-manifest.mjs',
    breaks: '`pnpm --filter @heady/approvals build` fails with "approval.rego source hash does not match the compiled policy manifest", which blocks approval genesis.',
    repin: 'node packages/approvals/bin/build-policy.mjs   (recompiles the policy and rewrites both hashes)',
    offlineVerifiable: true,
  },
  {
    id: 'projection-sources',
    covers: (p) => underPrefix(p, 'apps/headyme-portal'),
    pinnedBy: 'configs/projections/*.projection.json → last_sync_hash (ADR-0017), checked by tooling/projection-engine/bin/check-drift.mjs',
    breaks: 'the projection drift gate reports source-ahead and goes RED on this branch and every PR branched from it.',
    repin: 'node tooling/projection-engine/bin/generate-manifests.mjs   (re-projects and updates last_sync_hash)',
    offlineVerifiable: true,
  },
  {
    id: 'adr-ceremony',
    covers: (p) => /^docs\/adr\/00(52|53|54)-.*\.md$/.test(p),
    pinnedBy: 'scripts/adr-acceptance-ceremony.sh → the readonly ADR_*_SHA constants',
    breaks: 'the ceremony aborts with "changed since preparation" and the ADR cannot be signed until the pin is updated ON PURPOSE.',
    repin: 'update the ADR_*_SHA constant in scripts/adr-acceptance-ceremony.sh — and re-read the ADR first, because re-pinning is not reviewing.',
    offlineVerifiable: true,
  },
  {
    id: 'domain-roster-projection',
    covers: (p) => p === 'configs/_generated/domain-roster.json',
    pinnedBy: 'equality against facts.yaml domains: — coherence guard D6',
    breaks: 'coherence exits 2 with D6-roster-drift; the arena spec and the domain-guard allowlist both read this file.',
    repin: 'node tooling/coherence/src/coherence.mjs domains',
    offlineVerifiable: true,
  },
  {
    id: 'arena-spec-dumps',
    covers: (p) => p === 'configs/battle-blueprint.json' || underPrefix(p, 'configs/battle-contexts'),
    pinnedBy: 'roster equality against facts.yaml — coherence guard D7',
    breaks: 'coherence exits 2 with D7-spec-drift.',
    repin: 'node tooling/arena-spec/dump.mjs',
    offlineVerifiable: true,
  },
  {
    id: 'edge-inventory',
    covers: (p) => p === 'configs/edge-inventory.json',
    pinnedBy: 'a strict schema plus reconciliation against the live Cloudflare account (tooling/edge-inventory/bin/check-edge.mjs)',
    breaks: 'the edge gate reports undeclared/missing scripts, or rejects an unrecognized key outright.',
    repin: 'node tooling/edge-inventory/bin/check-edge.mjs   (reconcile, then edit rows to match reality)',
    offlineVerifiable: false,
  },
];

/**
 * Which of these changed paths are byte-pinned?
 * @param {string[]} paths repo-relative paths
 * @returns {{path:string, pin:typeof BYTE_PINS[number]}[]} one row per (path, pin) hit
 */
export function classify(paths) {
  const hits = [];
  for (const p of paths ?? []) {
    for (const pin of BYTE_PINS) {
      if (pin.covers(p)) hits.push({ path: p, pin });
    }
  }
  return hits;
}

/** Group hits by pin id, so a 500-file sweep reports 2 pins rather than 500 lines. */
export function groupByPin(hits) {
  const by = new Map();
  for (const h of hits) {
    if (!by.has(h.pin.id)) by.set(h.pin.id, { pin: h.pin, paths: [] });
    by.get(h.pin.id).paths.push(h.path);
  }
  return [...by.values()];
}
