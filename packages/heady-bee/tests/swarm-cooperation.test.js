/**
 * @heady-ai/heady-bee — Test Suite
 * © 2026 Heady Systems LLC
 */

describe('@heady-ai/heady-bee', () => {
  test('module loads without error', () => {
    expect(() => {
      require('../src/swarm-cooperation.js');
    }).not.toThrow();
  });

  test('exports are defined', () => {
    const mod = require('../src/swarm-cooperation.js');
    expect(mod).toBeDefined();
  });
});
