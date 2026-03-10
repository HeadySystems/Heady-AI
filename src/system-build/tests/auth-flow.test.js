import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

test('auth relay keeps nonce, allowlist, and postMessage flow without localStorage', () => {
  const relay = fs.readFileSync(path.join(root, 'apps', 'sites', 'auth-headysystems', 'relay.html'), 'utf8');
  assert.match(relay, /ALLOWED_ORIGINS/);
  assert.match(relay, /postMessage/);
  assert.match(relay, /nonce/);
  assert.doesNotMatch(relay, /localStorage/);
});

test('shared auth runtime uses explicit allowed origins, relay nonce checks, and visible error dispatching', () => {
  const runtime = fs.readFileSync(path.join(root, 'packages', 'web-shared', 'js', 'heady-shared.js'), 'utf8');
  assert.match(runtime, /allowedOrigins/);
  assert.match(runtime, /_relayNonce/);
  assert.match(runtime, /CustomEvent\('heady:error'/);
  assert.match(runtime, /sandbox', 'allow-scripts allow-same-origin'/);
  assert.doesNotMatch(runtime, /catch \(e\) \{ \/\* silent \*\/ \}/);
});

test('platform auth module exposes JWT and service auth layers', () => {
  const auth = fs.readFileSync(path.join(root, 'packages', 'platform', 'src', 'auth', 'index.js'), 'utf8');
  assert.match(auth, /class JwtValidator/);
  assert.match(auth, /serviceAuthMiddleware/);
  assert.match(auth, /ReceiptSigner/);
});
