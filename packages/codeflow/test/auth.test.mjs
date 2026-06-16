// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Firebase token-verification tests                         ║
// ║  Signs RS256 tokens with a throwaway keypair, verifies via an      ║
// ║  injected cert resolver, and exercises every reject path.          ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createSign } from 'node:crypto';
import { verifyFirebaseToken } from '../src/auth.mjs';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = publicKey.export({ type: 'spki', format: 'pem' });
const resolver = async () => PEM;
const PROJECT = 'heady-ai';
const NOW = 1_700_000_000_000; // fixed clock (ms)
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

function sign(claims, header = { alg: 'RS256', kid: 'k1' }) {
  const data = `${b64(header)}.${b64(claims)}`;
  const s = createSign('RSA-SHA256'); s.update(data); s.end();
  return `${data}.${s.sign(privateKey).toString('base64url')}`;
}
const valid = () => ({
  aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, sub: 'uid-123',
  email: 'eric@headysystems.com', email_verified: true,
  iat: NOW / 1000 - 60, exp: NOW / 1000 + 3600,
});
const opts = { projectId: PROJECT, now: NOW, certResolver: resolver };

test('verifies a well-formed Firebase token', async () => {
  const v = await verifyFirebaseToken(sign(valid()), opts);
  assert.equal(v.uid, 'uid-123');
  assert.equal(v.email, 'eric@headysystems.com');
  assert.equal(v.emailVerified, true);
});

test('rejects expired token', async () => {
  await assert.rejects(() => verifyFirebaseToken(sign({ ...valid(), exp: NOW / 1000 - 10 }), opts), /expired/);
});

test('rejects audience mismatch', async () => {
  await assert.rejects(() => verifyFirebaseToken(sign({ ...valid(), aud: 'other-project' }), opts), /aud/);
});

test('rejects issuer mismatch', async () => {
  await assert.rejects(() => verifyFirebaseToken(sign({ ...valid(), iss: 'https://evil.example' }), opts), /iss/);
});

test('rejects non-RS256 alg', async () => {
  await assert.rejects(() => verifyFirebaseToken(sign(valid(), { alg: 'HS256', kid: 'k1' }), opts), /alg/);
});

test('rejects a tampered signature', async () => {
  const t = sign(valid());
  const tampered = `${t.slice(0, -4)}AAAA`;
  await assert.rejects(() => verifyFirebaseToken(tampered, opts), /signature|verification/);
});

test('fails closed without a project id', async () => {
  await assert.rejects(() => verifyFirebaseToken(sign(valid()), { now: NOW, certResolver: resolver }), /FIREBASE_PROJECT_ID/);
});
