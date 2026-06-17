// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Enforcer — Auto-Context (Law 4) v1.0.0                     ║
// ║  Context Maximization is SYSTEMIC, not optional. A reasoning call  ║
// ║  (gateway.complete / .battle / .council) that does not route       ║
// ║  through the @heady/auto-context enrichment middleware is a Law 4  ║
// ║  violation — the request would reach a model on partial state.     ║
// ║  Realizes Unbreakable Law 4 + Master Directive 1.                  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// HOW IT GATES (fail-closed, low-false-positive):
//   For each scanned source file we find raw reasoning call-sites — `.complete(`, `.battle(`,
//   `.council(` — and FLAG them UNLESS the file demonstrates enrichment, i.e. it references one
//   of the middleware anchors: wrapGateway / assertEnriched / autoContext / @heady/auto-context.
//   A file that wraps its gateway once (the chokepoint pattern) satisfies the gate for all its
//   call-sites. Per-line waiver `// heady-allow:autocontext — reason` covers deliberate
//   exceptions (e.g. a unit test that calls a bare model double).
//
// WHY A WHOLE-FILE ANCHOR (not per-call): the design is "wrap the gateway once, every call is
// enriched". Demanding the token on every call-site would punish the correct pattern. The anchor
// proves the file participates in the enrichment contract; mixing enriched + bare gateways in one
// file is itself a smell the reviewer should see — so we still flag bare calls in anchor-less files.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, selectFiles } from './lib/files.mjs';

const log = (level, msg, f = {}) => process.stdout.write(`${JSON.stringify({ t: 'enforcer', enforcer: 'autocontext', level, msg, ...f })}\n`);

// Only runtime source participates in reasoning routing.
const SCAN_DIRS = /^(apps|packages|services|workers)\//;
// Exempt: tests/fixtures/mocks, docs, governance prose, lockfiles, the auto-context package itself
// (it DEFINES the middleware), and HeadyLens/events (the substrate, not a reasoning caller).
const EXEMPT = /(\.test\.|\.spec\.|[/^]__tests__\/|\/fixtures\/|\/mocks\/|^governance\/|\.md$|\.mdx$|\.json$|\.lock$|^pnpm-lock|^packages\/auto-context\/)/;
// A raw reasoning call-site: a receiver (identifier / `)` / `]`) then `.method(`. Requiring a
// receiver before the dot avoids matching prose, comments, or bare functions like `incomplete(`.
const REASONING_CALL = /[A-Za-z0-9_$)\]]\s*\.\s*(complete|battle|council)\s*\(/;
// Anchors that prove the file routes reasoning through enrichment middleware.
const ENRICH_ANCHOR = /(wrapGateway|assertEnriched|autoContext|@heady\/auto-context)/;
// Per-line waiver: `// heady-allow:autocontext — reason`
const WAIVER = /heady-allow:\s*autocontext/;

const sel = selectFiles(process.argv.slice(2));
const files = sel.files.filter((f) => SCAN_DIRS.test(f) && !EXEMPT.test(f) && /\.(mjs|js|cjs|ts|tsx)$/.test(f));
const findings = [];
let waived = 0;
let anchoredFiles = 0;

for (const rel of files) {
  let text;
  try { text = readFileSync(resolve(ROOT, rel), 'utf8'); } catch { continue; }
  const anchored = ENRICH_ANCHOR.test(text);
  if (anchored) anchoredFiles += 1;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!REASONING_CALL.test(line)) continue;
    if (WAIVER.test(line)) { waived += 1; continue; }
    if (anchored) continue; // file participates in the enrichment contract
    findings.push({ file: rel, line: i + 1, text: line.trim().slice(0, 200) });
  }
}

for (const f of findings) {
  log('error', 'LAW-4 reasoning call bypasses auto-context enrichment', { file: f.file, line: f.line, evidence: f.text });
}
log(findings.length ? 'error' : 'info', 'autocontext complete', {
  mode: sel.mode, base: sel.base, scanned: files.length, anchoredFiles, violations: findings.length, waived,
});
if (findings.length) process.exit(2);
