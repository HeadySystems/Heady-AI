// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Enforcer tests — the gates are not no-ops                  ║
// ║  Proves each rule set FLAGS known violations and IGNORES known     ║
// ║  safe forms. Realizes Law 8 (tests alongside code).                ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCALHOST_RULES, GLASSBOX_LINE_RULES, GLASSBOX_BLOCK_RULES,
  SECRET_RULES, SECRET_DUMMY_ALLOW, FIREBASE_PUBLIC, scanText,
} from '../lib/rules.mjs';

const ids = (hits) => hits.map((h) => h.rule);

test('no-localhost FLAGS localhost / 127.0.0.1 / 0.0.0.0 / ::1 / hardcoded port', () => {
  const bad = [
    'const url = "http://localhost:3301/health";',
    'const ip = "127.0.0.1";',
    'server.listen("0.0.0.0");',
    'const v6 = "::1";',
    'fetch("https://api.internal:8443/x");',
  ].join('\n');
  const hits = ids(scanText(bad, LOCALHOST_RULES));
  assert.ok(hits.includes('localhost'));
  assert.ok(hits.includes('loopback-v4'));
  assert.ok(hits.includes('all-ifaces'));
  assert.ok(hits.includes('loopback-v6'));
  assert.ok(hits.includes('hardcoded-port'));
});

test('no-localhost IGNORES env-driven targets', () => {
  const ok = [
    'const url = process.env.HEADY_API_URL;',
    'const host = config.get("dbHost");',
    'const base = `https://${env.GATEWAY_HOST}`;',
  ].join('\n');
  assert.equal(scanText(ok, LOCALHOST_RULES).length, 0);
});

test('glass-box FLAGS console.* / placeholders / suppression / stub throw', () => {
  const bad = [
    'console.log("hi");',
    '// TODO: wire this up',
    '// @ts-ignore',
    "throw new Error('not implemented');",
  ].join('\n');
  const hits = ids(scanText(bad, GLASSBOX_LINE_RULES));
  assert.ok(hits.includes('console'));
  assert.ok(hits.includes('placeholder'));
  assert.ok(hits.includes('ts-suppress'));
  assert.ok(hits.includes('stub-throw'));
});

test('glass-box FLAGS empty catch and empty .then', () => {
  const bad = 'try { x(); } catch (e) {}\np.then(() => {})';
  const hits = ids(scanText(bad, GLASSBOX_BLOCK_RULES));
  assert.ok(hits.includes('empty-catch'));
  assert.ok(hits.includes('empty-then'));
});

test('glass-box IGNORES structured logging + eslint-disable-next-line', () => {
  const ok = [
    'log.info({ trace }, "request handled");',
    '// eslint-disable-next-line no-console',
    'try { x(); } catch (e) { log.error({ e }, "failed"); }',
  ].join('\n');
  assert.equal(scanText(ok, [...GLASSBOX_LINE_RULES, ...GLASSBOX_BLOCK_RULES]).length, 0);
});

test('secret-scan FLAGS provider credential signatures', () => {
  const bad = [
    'aws = "AKIAIOSFODNN7EXAMPLE";',
    'gh = "ghp_0123456789012345678901234567890123ab";',
    'stripe = "sk_live_0123456789abcdef0123";',
  ].join('\n');
  const hits = ids(scanText(bad, SECRET_RULES));
  assert.ok(hits.includes('aws-access-key'));
  assert.ok(hits.includes('github-token'));
  assert.ok(hits.includes('stripe-key'));
});

test('secret-scan generic rule defers to dummy/env allowlist', () => {
  const refs = [
    'const apiKey = process.env.HEADY_API_KEY;',
    'password: "${DB_PASSWORD}"',
    'token = "<your-token-here>"',
  ];
  for (const line of refs) {
    const hits = scanText(line, SECRET_RULES).filter((h) => h.rule === 'generic-secret' && !SECRET_DUMMY_ALLOW.test(h.text));
    assert.equal(hits.length, 0, `should be allowlisted: ${line}`);
  }
});

test('secret-scan treats Firebase web apiKey as public (not a secret)', () => {
  const line = '  apiKey: "AIzaSyBpPClFwr0VDxl_D1SLe2dtvq2MX05QL6g",';
  assert.ok(FIREBASE_PUBLIC.test(line), 'firebase public matcher fires');
});

test('scanText reports 1-based line numbers', () => {
  const text = 'safe line\nconsole.log("x");';
  const hits = scanText(text, GLASSBOX_LINE_RULES);
  assert.equal(hits[0].line, 2);
});
