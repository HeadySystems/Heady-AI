/**
 * @heady/heady-infra — Test Suite
 * © 2026 Heady Systems LLC
 */

describe('@heady/heady-infra', () => {
  test('module loads without error', () => {
    expect(() => {
      require('../src/retry-budget.js');
    }).not.toThrow();
  });

  test('exports are defined', () => {
    const mod = require('../src/retry-budget.js');
    expect(mod).toBeDefined();
  });
});
