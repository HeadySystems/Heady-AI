// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Enforcer — Boundary-Validation v1.0.0                      ║
// ║  Realizes Unbreakable Law 5 (validated boundaries): any source     ║
// ║  file that READS a request body (req.body / request.json()) must   ║
// ║  import its validator from @heady/contracts (the shape authority)  ║
// ║  or zod (once ADR-0002 codegen lands). Fail-closed on unvalidated  ║
// ║  ingress. Made with ❤️ by HeadySystems Inc.                        ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, selectFiles } from './lib/files.mjs';

const log = (level, msg, f = {}) => process.stdout.write(`${JSON.stringify({ t: 'enforcer', enforcer: 'zod-boundary', level, msg, ...f })}\n`);

// Boundary reads live in the rebuild substrate's app/package sources.
const SCAN_DIRS = /^(apps|packages)\//;
const CODE_EXT = /\.(mjs|cjs|js|jsx|ts|tsx)$/;
const EXEMPT = /(\.test\.|\.spec\.|[/^]__tests__\/|\/fixtures\/|\/mocks\/|\/dist\/)/;

// A line that ingests an unparsed request body across the API boundary.
// (Contract mirrored by test/boundary-timing.test.mjs — keep in lock-step.)
const BOUNDARY_READ = /\breq\.body\b|\brequest\.json\s*\(/;
// The file-level anchor proving a contract-owned (or zod) validator is in scope.
const VALIDATOR_ANCHOR = /from\s+['"]@heady\/contracts['"]|from\s+['"]zod['"]/;
// Per-line waiver: `// heady-allow:zod-boundary — reason`
const WAIVER = /heady-allow:\s*zod-boundary/;

const sel = selectFiles(process.argv.slice(2));
const files = sel.files.filter((f) => SCAN_DIRS.test(f) && CODE_EXT.test(f) && !EXEMPT.test(f));
const findings = [];
let waived = 0;

for (const rel of files) {
  let text;
  try { text = readFileSync(resolve(ROOT, rel), 'utf8'); } catch { continue; }
  const anchored = VALIDATOR_ANCHOR.test(text);
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (!BOUNDARY_READ.test(lines[i])) continue;
    if (WAIVER.test(lines[i])) { waived += 1; continue; }
    if (anchored) continue;
    findings.push({ file: rel, line: i + 1, text: lines[i].trim().slice(0, 200) });
  }
}

for (const f of findings) log('error', 'BOUNDARY unvalidated body read', { file: f.file, line: f.line, evidence: f.text });
log(findings.length ? 'error' : 'info', 'zod-boundary complete', {
  mode: sel.mode, base: sel.base, scanned: files.length, violations: findings.length, waived,
});
if (findings.length) process.exit(2);
