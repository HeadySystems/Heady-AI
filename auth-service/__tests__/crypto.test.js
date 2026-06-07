// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: auth-service/__tests__/crypto.test.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
'use strict';

const {
  generateApiKey,
  hashApiKey,
  generateSessionToken,
  hashPassword,
  verifyPassword,
  generateId,
} = require('../src/crypto');

describe('generateApiKey', () => {
  test('returns object with raw, hash, and prefix', () => {
    const key = generateApiKey();
    expect(key).toHaveProperty('raw');
    expect(key).toHaveProperty('hash');
    expect(key).toHaveProperty('prefix');
  });

  test('raw key starts with hdy_ prefix', () => {
    const { raw } = generateApiKey();
    expect(raw.startsWith('hdy_')).toBe(true);
  });

  test('prefix is first 12 chars of raw key', () => {
    const { raw, prefix } = generateApiKey();
    expect(prefix).toBe(raw.slice(0, 12));
  });

  test('hash is deterministic for same input', () => {
    const raw = 'hdy_testkey123';
    expect(hashApiKey(raw)).toBe(hashApiKey(raw));
  });

  test('generates unique keys', () => {
    const keys = new Set();
    for (let i = 0; i < 50; i++) {
      keys.add(generateApiKey().raw);
    }
    expect(keys.size).toBe(50);
  });
});

describe('hashApiKey', () => {
  test('returns 64-char hex string (SHA-256)', () => {
    const hash = hashApiKey('hdy_test');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('different inputs produce different hashes', () => {
    expect(hashApiKey('hdy_a')).not.toBe(hashApiKey('hdy_b'));
  });
});

describe('generateSessionToken', () => {
  test('returns hex string', () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[a-f0-9]+$/);
  });

  test('generates unique tokens', () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
  });

  test('has expected length (34 bytes = 68 hex chars)', () => {
    const token = generateSessionToken();
    expect(token.length).toBe(68);
  });
});

describe('password hashing', () => {
  test('hashPassword returns bcrypt hash', async () => {
    const hash = await hashPassword('testpassword');
    expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true);
  });

  test('verifyPassword returns true for correct password', async () => {
    const hash = await hashPassword('correct');
    expect(await verifyPassword('correct', hash)).toBe(true);
  });

  test('verifyPassword returns false for wrong password', async () => {
    const hash = await hashPassword('correct');
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});

describe('generateId', () => {
  test('returns valid UUID v4', () => {
    const id = generateId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  test('generates unique IDs', () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
  });
});
