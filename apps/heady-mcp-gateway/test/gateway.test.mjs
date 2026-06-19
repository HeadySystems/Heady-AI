// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ MCP Gateway — HTTP smoke tests                            ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/index.mjs';

let base;
let srv;
before(async () => {
  await new Promise((resolve) => { srv = app.listen(0, resolve); });
  base = `http://127.0.0.1:${srv.address().port}`;
});
after(() => new Promise((resolve) => srv.close(resolve)));

test('GET /health is open and reports registry version', async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.service, 'heady-mcp-gateway');
  assert.equal(typeof body.memoryBound, 'boolean');
});

test('GET /metrics exposes the Latent Service meter', async () => {
  const res = await fetch(`${base}/metrics`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Number.isFinite(body.uptimeMs));
  assert.equal(body.heartbeatMs, 29034);
});

test('MCP endpoint is fail-closed without a bearer token', async () => {
  const res = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
  });
  assert.equal(res.status, 401);
});

test('manifest endpoint is auth-gated', async () => {
  const res = await fetch(`${base}/api/studio/manifest`);
  assert.equal(res.status, 401);
});
