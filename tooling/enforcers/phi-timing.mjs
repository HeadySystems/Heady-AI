// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Enforcer — φ-Timing v1.0.0                                 ║
// ║  Realizes the enforceable slice of Unbreakable Law 8 (φ-derived     ║
// ║  constants): no bare numeric millisecond literal as the delay of    ║
// ║  setTimeout/setInterval in substrate sources — timing derives from  ║
// ║  packages/phi-math (e.g. HEARTBEAT_MS = φ⁷×1000). Broader magic-    ║
// ║  number detection stays review-enforced (high false-positive).      ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, selectFiles } from './lib/files.mjs';

const log = (level, msg, f = {}) => process.stdout.write(`${JSON.stringify({ t: 'enforcer', enforcer: 'phi-timing', level, msg, ...f })}\n`);

// The substrate slice under enforcement (legacy src/ + scripts/ are out of scope).
const SCAN_DIRS = /^(apps|packages)\//;
const CODE_EXT = /\.(mjs|cjs|js|jsx|ts|tsx)$/;
const EXEMPT = /(\.test\.|\.spec\.|[/^]__tests__\/|\/fixtures\/|\/mocks\/|\/dist\/)/;

// Same-line timing call whose delay is a bare numeric literal (≥10 ms — 0/1 are
// event-loop yields, not tunables). A φ-derived expression never matches because
// the literal must directly close the call: `, 500)` flags, `, PHI * 500)` and
// `, HEARTBEAT_MS)` do not.
// (Contract mirrored by test/boundary-timing.test.mjs — keep in lock-step.)
const TIMING_LITERAL = /\bset(?:Timeout|Interval)\s*\(.*,\s*\d{2,}\s*\)/;
// Per-line waiver: `// heady-allow:phi-timing — reason`
const WAIVER = /heady-allow:\s*phi-timing/;

const sel = selectFiles(process.argv.slice(2));
const files = sel.files.filter((f) => SCAN_DIRS.test(f) && CODE_EXT.test(f) && !EXEMPT.test(f));
const findings = [];
let waived = 0;

for (const rel of files) {
  let text;
  try { text = readFileSync(resolve(ROOT, rel), 'utf8'); } catch { continue; }
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (!TIMING_LITERAL.test(lines[i])) continue;
    if (WAIVER.test(lines[i])) { waived += 1; continue; }
    findings.push({ file: rel, line: i + 1, text: lines[i].trim().slice(0, 200) });
  }
}

for (const f of findings) log('error', 'PHI_TIMING literal delay', { file: f.file, line: f.line, evidence: f.text });
log(findings.length ? 'error' : 'info', 'phi-timing complete', {
  mode: sel.mode, base: sel.base, scanned: files.length, violations: findings.length, waived,
});
if (findings.length) process.exit(2);
