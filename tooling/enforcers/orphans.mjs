// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Enforcer — Orphan / Dead-Module gate v1.0.0               ║
// ║  Confirmed-orphan = dependency-cruiser graph-orphan ∩ knip unused  ║
// ║  file, scoped to the clean ESM trees (packages, tooling). The      ║
// ║  intersection is the high-confidence signal: depcruise alone flags ║
// ║  CLI entry points (nothing imports them); knip knows entries, so   ║
// ║  the overlap is genuinely dead. Baseline is 0 → fail-closed.       ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, selectFiles } from './lib/files.mjs';

const log = (level, msg, f = {}) => process.stdout.write(`${JSON.stringify({ t: 'enforcer', enforcer: 'orphans', level, msg, ...f })}\n`);
const WAIVER = /heady-allow:\s*orphans/; // a standalone file may carry this to opt out

// ── Pure helpers (exported for the test harness) ─────────────────────

/** depcruise --output-type json → sorted list of orphan module sources. */
export function parseDepcruiseOrphans(json) {
  const j = typeof json === 'string' ? JSON.parse(json) : json;
  return (j.modules || []).filter((m) => m.orphan).map((m) => m.source).sort();
}

/** knip --reporter json → sorted list of unused (dead) file paths.
 * knip 6 shape: { issues: [{ file, files: [{name}], ... }] } — a non-empty
 * `files` array marks that `file` as an unused file. Falls back to the flat
 * { files: [...] } shape for older/simple reporters. */
export function parseKnipUnused(json) {
  const j = typeof json === 'string' ? JSON.parse(json) : json;
  if (Array.isArray(j.issues)) {
    return j.issues.filter((i) => Array.isArray(i.files) && i.files.length > 0).map((i) => i.file).sort();
  }
  return [...(j.files || [])].sort();
}

/** Confirmed orphans = files flagged by BOTH tools. */
export function confirmedOrphans(depOrphans, knipUnused) {
  const k = new Set(knipUnused);
  return depOrphans.filter((f) => k.has(f));
}

// ── Runner ───────────────────────────────────────────────────────────
function bin(name) {
  const p = resolve(ROOT, 'node_modules/.bin', name);
  return existsSync(p) ? p : null;
}

function run() {
  const depBin = bin('depcruise');
  const knipBin = bin('knip');
  if (!depBin || !knipBin) {
    log('error', 'orphans gate cannot run — install deps first (pnpm install)', { depcruise: !!depBin, knip: !!knipBin });
    return 2;
  }

  let depOrphans = [];
  let knipUnused = [];
  try {
    const out = execFileSync(depBin, ['packages', 'tooling', '--output-type', 'json'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] });
    depOrphans = parseDepcruiseOrphans(out);
  } catch (err) {
    // depcruise exits non-zero when its own no-orphans rule fires; the JSON is still on stdout.
    if (err.stdout) depOrphans = parseDepcruiseOrphans(err.stdout);
    else { log('error', 'depcruise failed to run', { evidence: String(err.message).slice(0, 200) }); return 2; }
  }
  try {
    const out = execFileSync(knipBin, ['--reporter', 'json', '--no-exit-code'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] });
    knipUnused = parseKnipUnused(out);
  } catch (err) {
    log('error', 'knip failed to run', { evidence: String(err.message).slice(0, 200) });
    return 2;
  }

  // Diff-aware (matches the other enforcers): in --diff mode only NEW dead files
  // fail; the existing baseline is reported as advisory so we arm the line without
  // retroactively failing the rebuild. --all fails on every confirmed orphan.
  const sel = selectFiles(process.argv.slice(2));
  const inScope = sel.mode === 'diff' ? new Set(sel.files) : null;

  const confirmed = confirmedOrphans(depOrphans, knipUnused);
  const findings = [];
  let waived = 0;
  let baselineDeferred = 0;
  for (const f of confirmed) {
    const abs = resolve(ROOT, f);
    const head = existsSync(abs) ? readFileSync(abs, 'utf8').slice(0, 600) : '';
    if (WAIVER.test(head)) { waived += 1; continue; }
    if (inScope && !inScope.has(f)) { baselineDeferred += 1; continue; } // pre-existing, not in this diff
    findings.push(f);
  }

  for (const f of findings) log('error', 'CONFIRMED ORPHAN (dead file — delete it or wire it in)', { file: f });
  log(findings.length ? 'error' : 'info', 'orphans complete', {
    mode: sel.mode, depcruiseOrphans: depOrphans.length, knipUnused: knipUnused.length,
    confirmed: confirmed.length, violations: findings.length, baselineDeferred, waived,
  });
  return findings.length ? 2 : 0;
}

if (resolve(process.argv[1] ?? '') === resolve(new URL(import.meta.url).pathname)) {
  process.exit(run());
}
