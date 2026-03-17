/**
 * @heady/heady-memory — Test Suite
 * © 2026 Heady Systems LLC
 */

describe('@heady/heady-memory', () => {
  test('module loads without error', () => {
    expect(() => {
      require('../src/t0-redis.js');
    }).not.toThrow();
  });

  test('exports are defined', () => {
    const mod = require('../src/t0-redis.js');
    expect(mod).toBeDefined();
  });
});
