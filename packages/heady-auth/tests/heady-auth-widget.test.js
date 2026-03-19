/**
 * @heady-ai/heady-auth — Test Suite
 * © 2026 Heady Systems LLC
 */

describe('@heady-ai/heady-auth', () => {
  test('module loads without error', () => {
    expect(() => {
      require('../src/heady-auth-widget.js');
    }).not.toThrow();
  });

  test('exports are defined', () => {
    const mod = require('../src/heady-auth-widget.js');
    expect(mod).toBeDefined();
  });
});
