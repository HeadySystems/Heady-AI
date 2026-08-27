// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Decomposition Engine v1.0.0                                ║
// ║  Reverse-engineers legacy Heady into transfer-ready component       ║
// ║  bundles + repo scaffolds, fail-closed on secrets & patent IP.      ║
// ║  Made with ❤️ by HeadySystems Inc.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { join, resolve, basename } from 'node:path';

const HERE = resolve(new URL('.', import.meta.url).pathname);
const TOOL_DIR = resolve(HERE, '..');
const MANIFEST = JSON.parse(readFileSync(join(TOOL_DIR, 'manifest.json'), 'utf8'));
const LEGACY = MANIFEST.legacy_root;
const REBUILD = MANIFEST.rebuild_root;
const OUT = join(REBUILD, '.data', 'decomposition');
const BUNDLES = join(OUT, 'bundles');

const FLAGS = new Set(process.argv.slice(2));
const DRY = FLAGS.has('--dry-run');

// φ-structured logging — JSON lines to stdout (no unstructured stdout writes; AGENTS rule 2).
const log = (level, msg, fields = {}) =>
  process.stdout.write(`${JSON.stringify({ t: 'decompose', level, msg, ...fields })}\n`);

const sh = (p) => { try { return statSync(p).isDirectory() ? 'dir' : 'file'; } catch { return null; } };
const du = (p) => {
  try { return Number(execFileSync('du', ['-sb', p], { encoding: 'utf8' }).split('\t')[0]); }
  catch { return 0; }
};
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 16);
const human = (b) => (b > 1 << 20 ? `${(b / (1 << 20)).toFixed(1)}M` : `${(b / 1024).toFixed(0)}K`);

// Global fail-closed exclude args for `zip` (junk + secrets), applied to every bundle.
const EXCLUDES = [
  ...MANIFEST.global_excludes,
  ...MANIFEST.blocked_secret_paths,
  ...MANIFEST.blocked_secret_paths.map((p) => `*/${p}`),
  ...MANIFEST.blocked_secret_paths.map((p) => basename(p)),
];
const SECRET_BASENAMES = new Set(MANIFEST.blocked_secret_paths.map((p) => basename(p)));
// Fail-closed audits: any entry NAME matching a secret-ish file, or any CONTENT matching a
// known live-credential pattern, destroys the bundle (zero-tolerance, AGENTS "Do Not" #5).
const SECRET_NAME_RE = /(^|\/)\.env(\.|$)|api-keys\.json$|(^|\/)credentials\.json$|service-?account.*\.json$|\.(pem|key|p12|pfx|keystore)$|id_(rsa|ed25519)/i;
const SECRET_CONTENT_RES = [
  /AIza[0-9A-Za-z_-]{35}/,                       // Google / Firebase API key (the R-1 leak)
  /\bsk-[A-Za-z0-9]{20,}\b/,                      // OpenAI
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,           // PEM private key
  /\bghp_[A-Za-z0-9]{36}\b/, /\bgithub_pat_[A-Za-z0-9_]{40,}\b/, // GitHub
  /\bAKIA[0-9A-Z]{16}\b/,                          // AWS access key
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,              // Slack
];
// Combined POSIX-ERE for `grep -rlIE` (pre-zip per-file quarantine).
const SECRET_GREP_ERE = [
  'AIza[0-9A-Za-z_-]{35}', 'sk-[A-Za-z0-9]{20,}', '-----BEGIN [A-Z ]*PRIVATE KEY-----',
  'ghp_[A-Za-z0-9]{36}', 'github_pat_[A-Za-z0-9_]{40,}', 'AKIA[0-9A-Z]{16}', 'xox[baprs]-[A-Za-z0-9-]{10,}',
].join('|');
const FINDINGS = [];

// Pre-zip quarantine: files whose CONTENT carries a live-credential pattern. Excluded from the
// bundle (so valuable source still transfers) and recorded as a finding. A path under /test(s)/
// is classed a fixture (low risk); anything else is a likely-real leak → feeds SEC-001.
function scanQuarantine(groupId, relPaths) {
  let hits = [];
  try {
    hits = execFileSync('grep', ['-rlIE', SECRET_GREP_ERE, ...relPaths],
      { cwd: LEGACY, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean);
  } catch { /* grep exit 1 = no matches */ }
  for (const f of hits) {
    const fixture = /(^|\/)(test|tests|__tests__|spec|fixtures?|examples?)\//i.test(f);
    FINDINGS.push({ group: groupId, file: f, class: fixture ? 'test-fixture' : 'LIKELY-REAL-LEAK' });
  }
  return hits;
}

function bundleGroup(group) {
  const present = [];
  const missing = [];
  for (const c of group.components) {
    for (const p of (c.paths || [])) {
      const full = join(LEGACY, p);
      (sh(full) ? present : missing).push({ id: c.id, path: p, mark: c.mark, target: c.target });
    }
  }
  const result = {
    id: group.id, name: group.name, title: group.title, phase: group.phase,
    depends_on: group.depends_on, target: group.target, patent_lock: !!group.patent_lock,
    transfer_eligible: group.transfer_eligible, present: present.length, missing,
    components: group.components.length,
  };

  if (group.transfer_eligible === false) {
    result.action = 'provenance-only';
    result.zip = null;
    log('info', 'group recorded (not bundled)', { id: group.id, action: 'provenance-only', components: group.components.length });
    return result;
  }
  if (!present.length) {
    result.action = 'skipped-no-source';
    log('warn', 'group has no present source paths', { id: group.id });
    return result;
  }

  const prefix = group.transfer_eligible === 'arbiter_only' ? '_PATENT-LOCKED_' : '';
  const zipName = `${prefix}${group.id}-${group.name}.zip`;
  const zipPath = join(BUNDLES, zipName);
  result.zip = `bundles/${zipName}`;

  if (DRY) {
    result.action = 'dry-run';
    result.est_bytes = present.reduce((a, c) => a + du(join(LEGACY, c.path)), 0);
    log('info', 'dry-run plan', { id: group.id, paths: present.length, est: human(result.est_bytes) });
    return result;
  }

  if (existsSync(zipPath)) rmSync(zipPath);
  const quarantined = scanQuarantine(group.id, present.map((c) => c.path));
  result.quarantined = quarantined;
  const args = ['-r', '-q', '-X', zipPath, ...present.map((c) => c.path)];
  for (const x of EXCLUDES) args.push('-x', x);
  for (const f of quarantined) args.push('-x', f);
  try {
    execFileSync('zip', args, { cwd: LEGACY, stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 1 << 26 });
  } catch (e) {
    // zip exit 12 == "nothing to do" after excludes; treat as soft. Anything else is fatal.
    if (!existsSync(zipPath)) { result.action = 'zip-failed'; result.error = String(e.message).slice(0, 200); log('error', 'zip failed', { id: group.id, error: result.error }); return result; }
  }

  // FAIL-CLOSED secret audit #1 (names): no secret-ish filename may appear in a bundle.
  const listing = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const entries = listing.split('\n').filter(Boolean);
  const leakedNames = entries.filter((e) => SECRET_BASENAMES.has(basename(e)) || SECRET_NAME_RE.test(e));
  // FAIL-CLOSED secret audit #2 (content): no known live-credential pattern may appear in any file.
  let leakedContent = [];
  try {
    const blob = execFileSync('unzip', ['-p', zipPath], { encoding: 'latin1', maxBuffer: 1 << 28 });
    leakedContent = SECRET_CONTENT_RES.filter((re) => re.test(blob)).map((re) => re.source.slice(0, 24));
  } catch { /* unzip -p on an empty archive is non-fatal */ }
  if (leakedNames.length || leakedContent.length) {
    rmSync(zipPath);
    result.action = 'BLOCKED-secret-leak';
    result.leaked = { names: leakedNames.slice(0, 20), content_patterns: leakedContent };
    log('error', 'SECRET LEAK DETECTED — bundle destroyed (fail-closed)', { id: group.id, names: leakedNames.length, content: leakedContent.length });
    return result;
  }

  result.action = 'bundled';
  result.entries = entries.length;
  result.bytes = statSync(zipPath).size;
  result.size = human(result.bytes);
  result.sha256 = sha256(zipPath);
  writeGroupArtifacts(group, result);
  log('info', 'group bundled', { id: group.id, size: result.size, entries: result.entries, quarantined: quarantined.length, sha: result.sha256 });
  return result;
}

function writeGroupArtifacts(group, result) {
  const dir = join(OUT, 'groups', `${group.id}-${group.name}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'MANIFEST.json'), JSON.stringify({ ...group, _bundle: result }, null, 2));

  const guard = group.transfer_eligible === 'arbiter_only'
    ? '\n> 🔒 **PATENT-LOCKED (R-8).** This bundle contains provisional-patent source (HS-2026-051..062).\n> It must NOT be merged without an `arbiter` ALLOW verdict + a signed HCP. Do not bulk-extract.\n'
    : '';
  const r5 = group.r5_gated ? '\n> 🔴 **R-5 GATE.** `DA-01` (canonical schema) extraction is blocked until live Neon state is verified (`\\dt heady_*`). If non-empty → expand-migrate-contract (ADR-0007), not a clean port.\n' : '';

  const rows = group.components.map((c) =>
    `| ${c.id} | ${c.mark} | ${c.name} | \`${(c.paths || []).join('`, `')}\` | ${c.target || '—'} | ${c.gate || c.reason || c.salvage || ''} |`
  ).join('\n');

  const md = `# ${group.id} — ${group.title}

> **Transfer group** · Phase **${group.phase}** · Depends on: ${group.depends_on.length ? group.depends_on.join(', ') : '— (foundation)'}
> **Target:** ${group.target.join(' · ')}
${guard}${r5}
**Rationale.** ${group.rationale}

**Bundle:** \`${result.zip || '(not bundled)'}\` ${result.size ? `(${result.size}, ${result.entries} entries, sha256:${result.sha256})` : ''}

## Components (${group.components.length})

| Disposition ID | Mark | Component | Legacy source | Rebuild target | Gate / note |
|---|---|---|---|---|---|
${rows}

## Extraction order (per docs/LEGACY_EXTRACTION_SYSTEM.md)

Each component runs the Extraction Engine: \`security-bee\` (G1) → \`arbiter\` (G2, patent zones) →
codemod (G2.5) → characterization tests (G3-pre) → \`eval-gate\` (G3) → consistency gate (G4) → ledger.

${result.missing && result.missing.length ? `## Missing source paths (recorded)\n\n${result.missing.map((m) => `- \`${m.path}\` (${m.id})`).join('\n')}\n` : ''}
---
*Made with ❤️ by HeadySystems Inc.*
`;
  writeFileSync(join(dir, 'README.md'), md);
}

function buildReposManifest() {
  const rebuildPkgs = (() => {
    try { return new Set(execFileSync('ls', [join(REBUILD, 'packages')], { encoding: 'utf8' }).split('\n').filter(Boolean)); }
    catch { return new Set(); }
  })();
  const repos = [];
  for (const g of MANIFEST.groups) {
    for (const t of g.target) {
      const pkgName = t.startsWith('packages/') ? t.split('/')[1] : null;
      repos.push({
        target: t,
        from_group: g.id,
        phase: g.phase,
        type: t.startsWith('packages/') ? 'package' : (t.includes('CF ') || t.includes('Workers')) ? 'cf-worker' : 'app-or-service',
        exists_in_rebuild: pkgName ? rebuildPkgs.has(pkgName) : false,
        patent_lock: !!g.patent_lock,
      });
    }
  }
  return { generated: 'decomposition v1.0.0', count: repos.length, repos };
}

// ── main ──────────────────────────────────────────────────────────────────
if (!existsSync(LEGACY)) { log('error', 'legacy root missing', { LEGACY }); process.exit(1); }
mkdirSync(BUNDLES, { recursive: true });
log('info', 'decomposition start', { legacy: LEGACY, groups: MANIFEST.groups.length, dry: DRY });

const results = MANIFEST.groups.map(bundleGroup);
const blocked = results.filter((r) => r.action === 'BLOCKED-secret-leak');
const bundled = results.filter((r) => r.action === 'bundled');
const totalBytes = bundled.reduce((a, r) => a + (r.bytes || 0), 0);

const report = {
  version: MANIFEST.version,
  legacy_root: LEGACY,
  generated_at_note: 'stamp on commit (no Date in deterministic tooling)',
  groups_total: MANIFEST.groups.length,
  bundled: bundled.length,
  provenance_only: results.filter((r) => r.action === 'provenance-only').length,
  blocked_secret_leaks: blocked.length,
  total_bundle_size: human(totalBytes),
  components_total: MANIFEST.groups.reduce((a, g) => a + g.components.length, 0),
  results,
};
const realLeaks = FINDINGS.filter((f) => f.class === 'LIKELY-REAL-LEAK');
report.quarantined_files = FINDINGS.length;
report.likely_real_leaks = realLeaks.length;
writeFileSync(join(OUT, 'decomposition-report.json'), JSON.stringify(report, null, 2));
writeFileSync(join(OUT, 'decomposition-manifest.json'), JSON.stringify(MANIFEST, null, 2));
writeFileSync(join(OUT, 'repos-manifest.json'), JSON.stringify(buildReposManifest(), null, 2));
writeFileSync(join(OUT, 'SECURITY_FINDINGS.json'), JSON.stringify({
  note: 'Files quarantined (excluded) from bundles by content secret-scan. LIKELY-REAL-LEAK feeds SEC-001 — rotate + scrub before any port.',
  total: FINDINGS.length, likely_real_leaks: realLeaks.length, findings: FINDINGS,
}, null, 2));

log(blocked.length || realLeaks.length ? 'error' : 'info', 'decomposition complete', {
  bundled: bundled.length, total: report.total_bundle_size, blocked: blocked.length,
  quarantined: FINDINGS.length, likely_real_leaks: realLeaks.length, components: report.components_total,
});
if (blocked.length) process.exit(2);
