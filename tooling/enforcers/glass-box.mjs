// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Enforcer — Glass-Box v1.0.0                                ║
// ║  Fail-closed scan for unstructured logging, swallowed failures,    ║
// ║  and placeholder shortcuts. Realizes Unbreakable Laws 1 & 2:       ║
// ║  structured JSON logging only, no empty catch, no TODO/FIXME/stub. ║
// ║  Made with ❤️ by HeadySystems Inc.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, selectFiles } from './lib/files.mjs';
import { GLASSBOX_LINE_RULES, GLASSBOX_BLOCK_RULES, scanText } from './lib/rules.mjs';

const log = (level, msg, f = {}) => process.stdout.write(`${JSON.stringify({ t: 'enforcer', enforcer: 'glass-box', level, msg, ...f })}\n`);

// Code surfaces under enforcement.
const SCAN_DIRS = /^(apps|packages|services|tooling|scripts|workers)\//;
// Only real source extensions — keep the gate deterministic and fast.
const CODE_EXT = /\.(mjs|cjs|js|jsx|ts|tsx)$/;
// Exemptions — tests/fixtures/mocks, the enforcers' own definitions, governance
// prose, and the data-consistency tooling (CLI scripts that print reports).
const EXEMPT = /(\.test\.|\.spec\.|[/^]__tests__\/|\/fixtures\/|\/mocks\/|^governance\/|^tooling\/enforcers\/|^tooling\/data-consistency\/|^tooling\/doc-hydrator\/)/;
// Per-line waiver: `// heady-allow:<rule> — reason`
const waiverFor = (rule) => new RegExp(`heady-allow:\\s*(glass-box|${rule})`);
const RULES = [...GLASSBOX_LINE_RULES, ...GLASSBOX_BLOCK_RULES];

const sel = selectFiles(process.argv.slice(2));
const files = sel.files.filter((f) => SCAN_DIRS.test(f) && CODE_EXT.test(f) && !EXEMPT.test(f));
const findings = [];
let waived = 0;

for (const rel of files) {
  let text;
  try { text = readFileSync(resolve(ROOT, rel), 'utf8'); } catch { continue; }
  for (const hit of scanText(text, RULES)) {
    if (waiverFor(hit.rule).test(hit.text)) { waived += 1; continue; }
    findings.push({ rule: hit.rule, file: rel, line: hit.line, text: hit.text });
  }
}

for (const f of findings) log('error', `GLASS_BOX ${f.rule}`, { file: f.file, line: f.line, evidence: f.text });
log(findings.length ? 'error' : 'info', 'glass-box complete', {
  mode: sel.mode, base: sel.base, scanned: files.length, violations: findings.length, waived,
});
if (findings.length) process.exit(2);
