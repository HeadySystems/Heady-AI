/**
 * @heady/heady-core — Test Suite
 * © 2026 Heady Systems LLC
 */

describe('@heady/heady-core', () => {
  test('module loads without error', () => {
    expect(() => {
      require('../src/phi.js');
    }).not.toThrow();
  });

  test('exports are defined', () => {
    const mod = require('../src/phi.js');
    expect(mod).toBeDefined();
  });
});
