import { test, expect } from 'vitest';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const targets = [
  path.join(root, 'packages', 'platform', 'src', 'config', 'index.js'),
  path.join(root, 'packages', 'platform', 'src', 'otel', 'index.js'),
  path.join(root, 'packages', 'platform', 'envoy', 'envoy-bootstrap.yaml'),
  path.join(root, 'docker-compose.yml'),
];

const bannedRuntimePatterns = [
  /https?:\/\/localhost(?::\d+)?/i,
  /https?:\/\/127\.0\.0\.1(?::\d+)?/i,
  /address:\s*127\.0\.0\.1/i,
];

test('runtime-critical files avoid banned runtime host contamination', () => {
  for (const file of targets) {
    const text = fs.readFileSync(file, 'utf8');
    for (const pattern of bannedRuntimePatterns) {
      assert.doesNotMatch(text, pattern, `${path.relative(root, file)} contains banned runtime host pattern ${pattern}`);
    }
  }
});

test('root package scripts cover local stack workflows', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  for (const script of ['dev', 'build', 'start', 'lint', 'compose:up', 'health:all']) {
    assert.ok(pkg.scripts?.[script], `missing ${script}`);
  }
});
