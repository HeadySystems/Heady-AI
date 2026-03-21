/**
 * @heady-ai/heady-llm — Test Suite
 * © 2026 Heady Systems LLC
 */

describe('@heady-ai/heady-llm', () => {
  test('module loads without error', () => {
    expect(() => {
      require('../src/gateway.js');
    }).not.toThrow();
  });

  test('exports are defined', () => {
    const mod = require('../src/gateway.js');
    expect(mod).toBeDefined();
  });
});
