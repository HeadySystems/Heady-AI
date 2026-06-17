// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Enforcer — No-Localhost v1.0.0                             ║
// ║  Zero-tolerance scan for localhost / 127.0.0.1 / 0.0.0.0 and       ║
// ║  hardcoded host:port in committed source. Realizes Unbreakable     ║
// ║  Law 0 — connection targets come from env / secret manager only.   ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, selectFiles } from './lib/files.mjs';
import { LOCALHOST_RULES, scanText } from './lib/rules.mjs';

const log = (level, msg, f = {}) => process.stdout.write(`${JSON.stringify({ t: 'enforcer', enforcer: 'no-localhost', level, msg, ...f })}\n`);

// Directories whose tracked files are subject to the gate.
const SCAN_DIRS = /^(apps|packages|services|tooling|scripts|workers)\//;
// Exemptions — tests/fixtures/mocks, docs, governance prose, lockfiles, manifests,
// and the enforcement/metadata tooling that legitimately *names* the forbidden
// tokens rather than opening a localhost connection.
const EXEMPT = /(\.test\.|\.spec\.|[/^]__tests__\/|\/fixtures\/|\/mocks\/|^governance\/|\.md$|\.mdx$|\.hbs$|\.lock$|^pnpm-lock|^tooling\/enforcers\/|^tooling\/data-consistency\/|^tooling\/decomposition\/|^tooling\/skill-registry\/|^packages\/config\/src\/index\.mjs$)/;
// Per-line waiver: `// heady-allow:no-localhost — reason`
const WAIVER = /heady-allow:\s*no-localhost/;

const sel = selectFiles(process.argv.slice(2));
const files = sel.files.filter((f) => SCAN_DIRS.test(f) && !EXEMPT.test(f));
const findings = [];
let waived = 0;

for (const rel of files) {
  let text;
  try { text = readFileSync(resolve(ROOT, rel), 'utf8'); } catch { continue; }
  for (const hit of scanText(text, LOCALHOST_RULES)) {
    if (WAIVER.test(hit.text)) { waived += 1; continue; }
    findings.push({ rule: hit.rule, file: rel, line: hit.line, text: hit.text });
  }
}

for (const f of findings) log('error', `LOCALHOST ${f.rule}`, { file: f.file, line: f.line, evidence: f.text });
log(findings.length ? 'error' : 'info', 'no-localhost complete', {
  mode: sel.mode, base: sel.base, scanned: files.length, violations: findings.length, waived,
});
if (findings.length) process.exit(2);
