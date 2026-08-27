// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ zod-boundary + phi-timing enforcer tests                   ║
// ║  Proves the Law-5 boundary gate and the Law-8 timing slice FLAG    ║
// ║  known violations, IGNORE known-safe forms, and honor waivers.      ║
// ║  Made with ❤️ by HeadySystems Inc.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Mirror the enforcers' matching contracts (lock-step with zod-boundary.mjs / phi-timing.mjs).
const BOUNDARY_READ = /\breq\.body\b|\brequest\.json\s*\(/;
const VALIDATOR_ANCHOR = /from\s+['"]@heady\/contracts['"]|from\s+['"]zod['"]/;
const BOUNDARY_WAIVER = /heady-allow:\s*zod-boundary/;
const TIMING_LITERAL = /\bset(?:Timeout|Interval)\s*\(.*,\s*\d{2,}\s*\)/;
const TIMING_WAIVER = /heady-allow:\s*phi-timing/;

// Scan one file's text the way zod-boundary.mjs does.
function scanBoundary(text) {
  const anchored = VALIDATOR_ANCHOR.test(text);
  let violations = 0, waived = 0;
  for (const line of text.split('\n')) {
    if (!BOUNDARY_READ.test(line)) continue;
    if (BOUNDARY_WAIVER.test(line)) { waived += 1; continue; }
    if (anchored) continue;
    violations += 1;
  }
  return { anchored, violations, waived };
}

test('boundary: FLAGS req.body in a file with no validator import', () => {
  const r = scanBoundary('app.post("/x", (req, res) => res.json(req.body));');
  assert.equal(r.violations, 1);
});

test('boundary: PASSES when the validator comes from @heady/contracts', () => {
  const r = scanBoundary([
    'import { validateEnqueueTask } from "@heady/contracts";',
    'app.post("/tasks", (req, res) => { const v = validateEnqueueTask(req.body); });',
  ].join('\n'));
  assert.equal(r.anchored, true);
  assert.equal(r.violations, 0);
});

test('boundary: PASSES a zod-anchored file and honors the line waiver', () => {
  assert.equal(scanBoundary('import { z } from "zod";\nconst b = schema.parse(req.body);').violations, 0);
  const w = scanBoundary('const raw = req.body; // heady-allow:zod-boundary — proxied verbatim, validated downstream');
  assert.equal(w.violations, 0);
  assert.equal(w.waived, 1);
});

test('boundary: IGNORES prose and non-boundary code', () => {
  assert.equal(scanBoundary('// the request body is validated upstream\nconst body = payload.body;').violations, 0);
});

test('timing: FLAGS bare millisecond literals in setTimeout/setInterval', () => {
  assert.ok(TIMING_LITERAL.test('setTimeout(fn, 500)'));
  assert.ok(TIMING_LITERAL.test('setInterval(() => sweep(), 30000);'));
});

test('timing: IGNORES φ-derived and symbolic delays, waivers honored', () => {
  assert.ok(!TIMING_LITERAL.test('setInterval(sweep, HEARTBEAT_MS);'));
  assert.ok(!TIMING_LITERAL.test('setTimeout(retry, PHI * 1000);'));
  assert.ok(!TIMING_LITERAL.test('setTimeout(retry, backoffMs(attempt));'));
  assert.ok(!TIMING_LITERAL.test('setTimeout(fn, 0); // event-loop yield'));
  const line = 'setTimeout(fn, 750); // heady-allow:phi-timing — vendor-mandated debounce';
  assert.ok(TIMING_LITERAL.test(line) && TIMING_WAIVER.test(line));
});
