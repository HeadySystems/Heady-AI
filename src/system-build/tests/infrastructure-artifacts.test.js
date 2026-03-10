import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

test('docker-compose defines all 50 services plus collector', () => {
  const compose = fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8');
  const containers = compose.match(/^\s{4}container_name:/gm) ?? [];
  assert.equal(containers.length, 51);
  assert.match(compose, /otel-collector:/);
  assert.match(compose, /heady-manager:/);
  assert.match(compose, /heady-cache:/);
});

test('CI workflow and env example exist', () => {
  assert.ok(fs.existsSync(path.join(root, '.github', 'workflows', 'ci.yml')));
  assert.ok(fs.existsSync(path.join(root, '.env.example')));
  assert.ok(fs.existsSync(path.join(root, 'ops', 'otel-collector', 'otel-collector-config.yaml')));
});
