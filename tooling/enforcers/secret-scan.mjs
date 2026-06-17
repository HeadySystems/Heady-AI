// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Enforcer — Secret-Scan v1.0.0                              ║
// ║  High-signal committed-secret detector. A fast, dependency-free    ║
// ║  complement to gitleaks so an obvious credential leak is caught    ║
// ║  even if the gitleaks config drifts. Realizes Unbreakable Law 0.   ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, selectFiles } from './lib/files.mjs';
import { SECRET_RULES, SECRET_DUMMY_ALLOW, FIREBASE_PUBLIC, scanText } from './lib/rules.mjs';

const log = (level, msg, f = {}) => process.stdout.write(`${JSON.stringify({ t: 'enforcer', enforcer: 'secret-scan', level, msg, ...f })}\n`);

// Scan everything tracked except binaries, lockfiles, docs, governance prose, and tests.
const EXEMPT = /(\.test\.|\.spec\.|[/^]__tests__\/|\/fixtures\/|\/mocks\/|^governance\/|^docs\/|\.md$|\.mdx$|\.lock$|^pnpm-lock|\.(png|jpg|jpeg|gif|webp|ico|pdf|woff2?|ttf|map)$|^tooling\/enforcers\/)/;
const WAIVER = /heady-allow:\s*secret-scan/;

const sel = selectFiles(process.argv.slice(2));
const files = sel.files.filter((f) => !EXEMPT.test(f));
const findings = [];
let waived = 0;

for (const rel of files) {
  let text;
  try { text = readFileSync(resolve(ROOT, rel), 'utf8'); } catch { continue; }
  if (text.includes('\u0000')) continue; // skip binary
  for (const hit of scanText(text, SECRET_RULES)) {
    if (WAIVER.test(hit.text)) { waived += 1; continue; }
    if (FIREBASE_PUBLIC.test(hit.text)) continue;
    // generic-secret is the only rule that defers to the dummy-value allowlist.
    if (hit.rule === 'generic-secret' && SECRET_DUMMY_ALLOW.test(hit.text)) continue;
    findings.push({ rule: hit.rule, file: rel, line: hit.line });
  }
}

// Never print the secret value itself — only location + rule id (glass-box safe).
for (const f of findings) log('error', `SECRET ${f.rule}`, { file: f.file, line: f.line });
log(findings.length ? 'error' : 'info', 'secret-scan complete', {
  mode: sel.mode, base: sel.base, scanned: files.length, violations: findings.length, waived,
});
if (findings.length) process.exit(2);
