'use strict';

/**
 * Tests for CORS whitelist integrity.
 * Validates that the ALLOWED_ORIGINS array in index.js contains
 * all required product domains and no wildcards.
 */
const fs = require('fs');
const path = require('path');

const indexSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'index.js'),
  'utf8'
);

// Extract ALLOWED_ORIGINS array from source
const originsMatch = indexSource.match(
  /const ALLOWED_ORIGINS\s*=\s*\[([\s\S]*?)\];/
);
const originsBlock = originsMatch ? originsMatch[1] : '';
const origins = originsBlock
  .match(/'https?:\/\/[^']+'/g)
  ?.map((s) => s.replace(/'/g, '')) || [];

describe('CORS whitelist', () => {
  test('contains no wildcard origins', () => {
    const wildcards = origins.filter((o) => o.includes('*'));
    expect(wildcards).toEqual([]);
  });

  test('all origins use https', () => {
    const nonHttps = origins.filter((o) => !o.startsWith('https://'));
    expect(nonHttps).toEqual([]);
  });

  test('includes headykey.com (public auth product)', () => {
    expect(origins).toContain('https://headykey.com');
    expect(origins).toContain('https://www.headykey.com');
  });

  test('includes headyvault.com (public vault product)', () => {
    expect(origins).toContain('https://headyvault.com');
    expect(origins).toContain('https://www.headyvault.com');
  });

  test('includes core ecosystem domains', () => {
    expect(origins).toContain('https://headyme.com');
    expect(origins).toContain('https://headysystems.com');
    expect(origins).toContain('https://auth.headysystems.com');
  });

  test('has no duplicate origins', () => {
    const unique = new Set(origins);
    expect(unique.size).toBe(origins.length);
  });
});
