/**
 * @heady-ai/heady-ui — Test Suite
 * © 2026 Heady Systems LLC
 */

describe('@heady-ai/heady-ui', () => {
  test('module loads without error', () => {
    expect(() => {
      require('../src/HeadyPostAuthBootstrap.js');
    }).not.toThrow();
  });

  test('exports are defined', () => {
    const mod = require('../src/HeadyPostAuthBootstrap.js');
    expect(mod).toBeDefined();
  });
});
