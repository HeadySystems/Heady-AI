// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Codeflow tests — the governed proposal lifecycle           ║
// ║  Bad inputs are fragment-built so this source embeds no banned      ║
// ║  literal. Made with ❤️ by HeadySystems Inc.                        ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Codeflow, STATES, validate } from '../src/index.mjs';

const fresh = () => new Codeflow({ root: mkdtempSync(join(tmpdir(), 'cf-')) });

test('non-sensitive change: validate → auto-approve → apply → rollback', () => {
  const cf = fresh();
  const p0 = cf.submit({ actor: 'tester', intent: 'add note', targetFile: 'docs/note.md', content: '# Note\nclean line\n' });
  assert.equal(p0.state, STATES.SUBMITTED);
  const p1 = cf.evaluate(p0.id);
  assert.equal(p1.state, STATES.APPROVED, 'clean non-sensitive change auto-approves at the validation gate');
  const p2 = cf.apply(p0.id);
  assert.equal(p2.state, STATES.APPLIED);
  assert.equal(readFileSync(join(cf.root, 'docs/note.md'), 'utf8'), '# Note\nclean line\n');
  const p3 = cf.rollback(p0.id);
  assert.equal(p3.state, STATES.ROLLED_BACK);
  assert.ok(!existsSync(join(cf.root, 'docs/note.md')), 'rollback removes a newly-created file');
});

test('validation FAILS closed on credential / loopback / placeholder / require', () => {
  const cred = 'AIza' + 'B'.repeat(35);
  const loop = 'const u = "http://' + 'local' + 'host:9"';
  const ph = '// ' + 'TO' + 'DO finish';
  const cjs = 'const x = ' + 'requir' + 'e("y")';
  for (const bad of [cred, loop, cjs]) {
    assert.equal(validate('src/x.mjs', bad).verdict, 'BLOCK', `should block: ${bad.slice(0, 12)}`);
  }
  const r = validate('src/x.mjs', ph);
  assert.equal(r.verdict, 'BLOCK');
  assert.ok(r.autoCorrectable, 'placeholder-only is auto-correctable');
});

test('diff-bounds: oversized change is blocked', () => {
  const big = Array.from({ length: 500 }, (_, i) => `line ${i}`).join('\n');
  assert.equal(validate('src/big.mjs', big).verdict, 'BLOCK');
});

test('sensitive path requires a HUMAN approver — no self-approve (ADR-0005)', () => {
  const cf = fresh();
  const p = cf.submit({ actor: 'ai:coder', intent: 'touch auth', targetFile: 'packages/security-mesh/src/rbac.mjs', content: 'export const ok = true;\n' });
  const e = cf.evaluate(p.id);
  assert.equal(e.state, STATES.GOVERNANCE_PENDING, 'sensitive path holds for governance');
  assert.throws(() => cf.approve(p.id, { approver: 'ai:coder', human: false }), /human/, 'AI cannot self-approve a sensitive path');
  const a = cf.approve(p.id, { approver: 'eric@headysystems.com', human: true });
  assert.equal(a.state, STATES.APPROVED);
  assert.equal(a.governance.human, true);
});

test('auto-correction is bounded and recorded', () => {
  const cf = fresh();
  const p = cf.submit({ actor: 't', intent: 'note w/ placeholder', targetFile: 'docs/x.md', content: 'real line\n// ' + 'TO' + 'DO drop me\n' });
  const e = cf.evaluate(p.id);
  assert.equal(e.state, STATES.APPROVED, 'auto-correct cleared the placeholder, then validated');
  assert.ok(e.corrections >= 1 && e.corrections <= 2, 'corrections are bounded');
});

test('ledger persists across instances + redacts content', () => {
  const cf = fresh();
  const p = cf.submit({ actor: 't', intent: 'x', targetFile: 'docs/p.md', content: 'secret-ish body' });
  assert.equal(p.content, undefined, 'public payload never includes raw content');
  assert.ok(typeof p.contentBytes === 'number');
  const cf2 = new Codeflow({ root: cf.root });
  assert.equal(cf2.get(p.id).id, p.id, 'a fresh instance reads the persisted ledger');
});
