// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Studio Registry — unit tests                              ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildManifest, estimateBilling, recommend, ManifestSchema,
  MODELS, HEADY_SERVICES,
} from '../src/index.mjs';

test('manifest validates against its own schema', () => {
  const m = buildManifest();
  assert.doesNotThrow(() => ManifestSchema.parse(m));
  assert.equal(m.version, '1.0.0');
  assert.ok(m.models.length >= 1 && m.modes.length === 3 && m.executionModes.length === 3);
});

test('exactly one default model', () => {
  assert.equal(MODELS.filter((x) => x.default).length, 1);
});

test('permanent Heady services never bill', () => {
  const permanent = HEADY_SERVICES.filter((s) => s.permanent).map((s) => s.id);
  const bill = estimateBilling({ headyServices: permanent });
  assert.equal(bill.total, 0, 'permanent services must add zero credits');
});

test('toggling a discretionary service raises the meter', () => {
  const off = estimateBilling({ model: 'claude-haiku-4-5-20251001' });
  const on = estimateBilling({ model: 'claude-haiku-4-5-20251001', headyServices: ['orchestration'] });
  assert.ok(on.total > off.total, 'enabling orchestration must increase credits');
});

test('recommendations rank research intent first', () => {
  const recs = recommend({ input: 'investigate and compare the sources, analyze why' });
  assert.ok(recs.length > 0);
  assert.equal(recs[0].id, 'enable-deep-research');
});

test('recommendations are never empty for empty input', () => {
  assert.ok(recommend({ input: '' }).length > 0);
});
