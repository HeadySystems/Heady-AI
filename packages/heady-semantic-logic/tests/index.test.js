/**
 * @heady-ai/heady-semantic-logic — Test Suite
 * © 2026 Heady Systems LLC
 */

describe('@heady-ai/heady-semantic-logic', () => {
  test('module loads without error', () => {
    expect(() => {
      require('../src/index.js');
    }).not.toThrow();
  });

  test('exports are defined', () => {
    const mod = require('../src/index.js');
    expect(mod).toBeDefined();
  });
});
