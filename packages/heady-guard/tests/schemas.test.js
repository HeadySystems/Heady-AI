/**
 * @heady-ai/heady-guard — Test Suite
 * © 2026 Heady Systems LLC
 */

describe('@heady-ai/heady-guard', () => {
  test('module loads without error', () => {
    expect(() => {
      require('../src/schemas.js');
    }).not.toThrow();
  });

  test('exports are defined', () => {
    const mod = require('../src/schemas.js');
    expect(mod).toBeDefined();
  });
});
