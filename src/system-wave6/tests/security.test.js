/**
 * Heady™ Security Layer Tests v6.0
 * Tests encryption, zero-trust, and secret management
 * 
 * @author Eric Haywood — HeadySystems Inc.
 */

'use strict';

const assert = require('assert');
const path = require('path');

const {
  encrypt, decrypt, hmacSign, hmacVerify,
  sha256, hashToken, generateSecureId,
  generateSessionId, generateCsrfToken,
  generateApiKey, secureCompare,
  maskSensitive, maskEmail, maskIp,
} = require(path.resolve(__dirname, '../shared/security/encryption'));

const {
  ZeroTrustGate, computeTrustScore, trustLevel, TRUST_WEIGHTS,
} = require(path.resolve(__dirname, '../shared/security/zero-trust'));

const {
  sanitizeString, sanitizeObject, LIMITS,
} = require(path.resolve(__dirname, '../shared/middleware/request-validator'));

const { validateNoDefaults, REQUIRED_SECRETS } = require(path.resolve(__dirname, '../shared/secret-manager'));

// ═══════════════════════════════════════════════════════════
// ENCRYPTION TESTS
// ═══════════════════════════════════════════════════════════

function testEncryption() {
  const key = 'test-encryption-key-heady-2026';
  const plaintext = 'Heady Sacred Geometry 384D Vector Space';
  
  const encrypted = encrypt(plaintext, key);
  assert(encrypted !== plaintext, 'Encrypted should differ from plaintext');
  assert(typeof encrypted === 'string', 'Encrypted should be a string');
  
  const decrypted = decrypt(encrypted, key);
  assert.strictEqual(decrypted, plaintext, 'Decrypted should match original');
  
  // Wrong key should fail
  try {
    decrypt(encrypted, 'wrong-key-not-matching');
    assert.fail('Should throw with wrong key');
  } catch (e) {
    assert(e.message.includes('Unsupported state') || e.message.includes('authentication') || e.code, 'Should be a crypto error');
  }
  
  return 'PASS';
}

function testHMAC() {
  const secret = 'hmac-secret-key';
  const data = 'important-data';
  
  const sig = hmacSign(data, secret);
  assert(typeof sig === 'string', 'Signature should be a string');
  assert(sig.length > 0, 'Signature should not be empty');
  
  assert(hmacVerify(data, sig, secret), 'Valid signature should verify');
  assert(!hmacVerify('tampered-data', sig, secret), 'Tampered data should not verify');
  
  return 'PASS';
}

function testHashing() {
  const hash = sha256('test');
  assert(typeof hash === 'string');
  assert.strictEqual(hash.length, 64);
  
  const token = hashToken('my-token');
  assert(token.length === 34, `hashToken should be 34 chars, got ${token.length}`);  // fib(9) = 34
  
  return 'PASS';
}

function testRandomGeneration() {
  const id = generateSecureId();
  assert(typeof id === 'string');
  assert(id.length > 0);
  
  const session = generateSessionId();
  assert(session.length === 68, `Session ID should be 68 chars, got ${session.length}`);  // 34 bytes * 2
  
  const csrf = generateCsrfToken();
  assert(csrf.length === 42, `CSRF token should be 42 chars, got ${csrf.length}`);  // 21 bytes * 2
  
  const apiKey = generateApiKey();
  assert(apiKey.startsWith('heady_'), 'API key should start with heady_');
  
  // Uniqueness
  const ids = new Set();
  for (let i = 0; i < 100; i++) {
    ids.add(generateSecureId());
  }
  assert.strictEqual(ids.size, 100, 'All generated IDs should be unique');
  
  return 'PASS';
}

function testSecureCompare() {
  assert(secureCompare('abc', 'abc'), 'Same strings should match');
  assert(!secureCompare('abc', 'def'), 'Different strings should not match');
  assert(!secureCompare('abc', 'abcd'), 'Different lengths should not match');
  assert(!secureCompare(null, 'abc'), 'Null should not match');
  
  return 'PASS';
}

function testMasking() {
  assert.strictEqual(maskSensitive('short'), '***');
  assert(maskSensitive('a-longer-secret').includes('...'));
  
  assert.strictEqual(maskEmail('eric@headyconnection.org'), 'er***@headyconnection.org');
  assert.strictEqual(maskEmail(null), '***');
  
  assert.strictEqual(maskIp('192.168.1.100'), '192.168.*.*');
  
  return 'PASS';
}

// ═══════════════════════════════════════════════════════════
// ZERO-TRUST TESTS
// ═══════════════════════════════════════════════════════════

function testTrustScoring() {
  // Full trust signals
  const fullTrust = computeTrustScore({
    authenticated: true,
    authorized: true,
    integrityValid: true,
    reputationScore: 1.0,
    contextScore: 1.0,
  });
  assert.strictEqual(fullTrust, 1.0, `Full trust should be 1.0, got ${fullTrust}`);
  
  // Zero trust signals
  const zeroTrust = computeTrustScore({
    authenticated: false,
    authorized: false,
    integrityValid: false,
    reputationScore: 0,
    contextScore: 0,
  });
  assert.strictEqual(zeroTrust, 0, `Zero trust should be 0, got ${zeroTrust}`);
  
  // Partial trust
  const partial = computeTrustScore({
    authenticated: true,
    authorized: true,
    integrityValid: true,
    reputationScore: 0.5,
    contextScore: 0.5,
  });
  assert(partial > 0.5 && partial < 1.0, `Partial trust should be between 0.5 and 1.0, got ${partial}`);
  
  return 'PASS';
}

function testTrustLevels() {
  assert.strictEqual(trustLevel(1.0), 'full');
  assert.strictEqual(trustLevel(0.95), 'full');
  assert.strictEqual(trustLevel(0.9), 'elevated');
  assert.strictEqual(trustLevel(0.85), 'standard');
  assert.strictEqual(trustLevel(0.7), 'limited');
  assert.strictEqual(trustLevel(0.3), 'untrusted');
  assert.strictEqual(trustLevel(0), 'untrusted');
  
  return 'PASS';
}

function testTrustWeightsSum() {
  const sum = Object.values(TRUST_WEIGHTS).reduce((a, b) => a + b, 0);
  assert(Math.abs(sum - 1.0) < 0.01, `Trust weights should sum to ≈1.0, got ${sum}`);
  
  return 'PASS';
}

// ═══════════════════════════════════════════════════════════
// INPUT VALIDATION TESTS
// ═══════════════════════════════════════════════════════════

function testSanitization() {
  assert.strictEqual(sanitizeString('hello\x00world'), 'helloworld');
  assert.strictEqual(sanitizeString('  trimmed  '), 'trimmed');
  assert.strictEqual(sanitizeString('normal text'), 'normal text');
  
  const obj = sanitizeObject({ key: 'value\x00', nested: { deep: 'ok' } });
  assert.strictEqual(obj.key, 'value');
  assert.strictEqual(obj.nested.deep, 'ok');
  
  return 'PASS';
}

function testDeepNesting() {
  // Should reject deeply nested objects
  let obj = { value: 'ok' };
  for (let i = 0; i < 20; i++) {
    obj = { nested: obj };
  }
  
  try {
    sanitizeObject(obj);
    assert.fail('Should reject deeply nested objects');
  } catch (e) {
    assert(e.message.includes('nesting depth'), 'Should mention nesting depth');
  }
  
  return 'PASS';
}

function testSecretValidation() {
  // Should reject default passwords
  try {
    validateNoDefaults({ PG_PASSWORD: 'password' });
    assert.fail('Should reject default password');
  } catch (e) {
    assert(e.message.includes('default'), 'Should mention default');
  }
  
  // Should reject empty secrets
  try {
    validateNoDefaults({ API_KEY: '' });
    assert.fail('Should reject empty secret');
  } catch (e) {
    assert(e.message.includes('default') || e.message.includes('weak'), 'Should detect empty');
  }
  
  // Should reject short secrets
  try {
    validateNoDefaults({ AUTH_TOKEN: 'abc' });
    assert.fail('Should reject short secret');
  } catch (e) {
    assert(e.code === 'DEFAULT_DETECTED');
  }
  
  return 'PASS';
}

function testRequiredSecrets() {
  assert(Object.keys(REQUIRED_SECRETS).length >= 13, 'Should have at least 13 required secrets');
  
  for (const [key, config] of Object.entries(REQUIRED_SECRETS)) {
    assert(config.name, `Secret ${key} should have a name`);
    assert(config.name.startsWith('heady-'), `Secret ${key} should have heady- prefix`);
    assert(config.required === true, `Secret ${key} should be required`);
  }
  
  return 'PASS';
}

// ═══════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════

function runAllTests() {
  const tests = [
    ['AES-256-GCM Encryption', testEncryption],
    ['HMAC Sign/Verify', testHMAC],
    ['SHA-256 Hashing', testHashing],
    ['Random Generation', testRandomGeneration],
    ['Secure Compare', testSecureCompare],
    ['Data Masking', testMasking],
    ['Trust Score Computation', testTrustScoring],
    ['Trust Levels', testTrustLevels],
    ['Trust Weights Sum', testTrustWeightsSum],
    ['Input Sanitization', testSanitization],
    ['Deep Nesting Rejection', testDeepNesting],
    ['Default Secret Rejection', testSecretValidation],
    ['Required Secrets Registry', testRequiredSecrets],
  ];
  
  let passed = 0;
  let failed = 0;
  const results = [];
  
  for (const [name, testFn] of tests) {
    try {
      const result = testFn();
      passed++;
      results.push({ name, status: result || 'PASS' });
    } catch (error) {
      failed++;
      results.push({ name, status: 'FAIL', error: error.message });
    }
  }
  
  const summary = { total: tests.length, passed, failed, results };
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  
  if (failed > 0) process.exit(1);
}

runAllTests();
