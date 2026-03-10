/**
 * Unit Tests — Audit Logger
 * @author Eric Haywood, HeadySystems Inc.
 */

'use strict';

const assert = require('assert');
const crypto = require('crypto');

function computeHash(entry, prevHash) {
  const data = JSON.stringify({
    timestamp: entry.timestamp,
    severity: entry.severity,
    action: entry.action,
    actor: entry.actor,
    prevHash
  });
  return crypto.createHash('sha256').update(data).digest('hex');
}

module.exports = {
  'audit hash is deterministic': () => {
    const entry = { timestamp: '2026-01-01T00:00:00Z', severity: 'info', action: 'test', actor: 'system' };
    const h1 = computeHash(entry, 'prev');
    const h2 = computeHash(entry, 'prev');
    assert.strictEqual(h1, h2);
  },

  'different entries produce different hashes': () => {
    const e1 = { timestamp: '2026-01-01T00:00:00Z', severity: 'info', action: 'test1', actor: 'system' };
    const e2 = { timestamp: '2026-01-01T00:00:00Z', severity: 'info', action: 'test2', actor: 'system' };
    const h1 = computeHash(e1, 'prev');
    const h2 = computeHash(e2, 'prev');
    assert.notStrictEqual(h1, h2);
  },

  'chain integrity holds for sequential entries': () => {
    const genesis = 'GENESIS';
    const entries = [];

    let prevHash = crypto.createHash('sha256').update(genesis).digest('hex');
    for (let i = 0; i < 10; i++) {
      const entry = {
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
        severity: 'info',
        action: `action-${i}`,
        actor: 'test'
      };
      entry.hash = computeHash(entry, prevHash);
      entry.prevHash = prevHash;
      entries.push(entry);
      prevHash = entry.hash;
    }

    for (let i = 1; i < entries.length; i++) {
      assert.strictEqual(entries[i].prevHash, entries[i - 1].hash, `Chain broken at ${i}`);
      const expected = computeHash(entries[i], entries[i - 1].hash);
      assert.strictEqual(entries[i].hash, expected, `Hash mismatch at ${i}`);
    }
  },

  'tampered entry breaks chain': () => {
    const entries = [];
    let prevHash = 'genesis';

    for (let i = 0; i < 5; i++) {
      const entry = { timestamp: `t${i}`, severity: 'info', action: `a${i}`, actor: 'test' };
      entry.hash = computeHash(entry, prevHash);
      entry.prevHash = prevHash;
      entries.push(entry);
      prevHash = entry.hash;
    }

    entries[2].action = 'TAMPERED';
    const recomputed = computeHash(entries[2], entries[1].hash);
    assert.notStrictEqual(entries[2].hash, recomputed, 'Tampered entry should produce different hash');
  }
};
