import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const indexPath = path.join(process.cwd(), 'services', 'SERVICE_INDEX.json');

test('service index lists 50 services with health endpoints', () => {
  const data = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  assert.equal(data.service_count, 50);
  assert.equal(data.services.length, 50);
  for (const service of data.services) {
    assert.ok(Array.isArray(service.health_endpoints));
    assert.ok(service.health_endpoints.length >= 5);
  }
});
