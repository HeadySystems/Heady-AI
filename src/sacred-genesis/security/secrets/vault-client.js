/**
 * Heady Vault Client — Sacred Genesis v4.0.0
 * Secret management with envelope encryption and rotation tracking
 *
 * @module vault-client
 * @author Eric Haywood, HeadySystems Inc.
 */

'use strict';

const crypto = require('crypto');
const { PHI, PSI, fib, phiBackoff } = require('../../shared/phi-math');

/** @type {string} Encryption algorithm */
const ALGORITHM = 'aes-256-gcm';

/** @type {number} IV length bytes — fib(7) + 1 = 13 (must be 12 for GCM) */
const IV_LENGTH = 12;

/** @type {number} Auth tag length bytes — fib(8) = 16 (must be 16 for GCM) */
const AUTH_TAG_LENGTH = 16;

/** @type {number} Key rotation interval ms — fib(11) hours in ms */
const ROTATION_INTERVAL_MS = fib(11) * 3600 * 1000;

/** @type {number} Maximum secret versions — fib(8) */
const MAX_VERSIONS = fib(8);

/** @type {number} Maximum secrets — fib(16) */
const MAX_SECRETS = fib(16);

/**
 * Encrypted secret record
 * @typedef {Object} EncryptedSecret
 * @property {string} name - Secret name
 * @property {string} encrypted - Base64 encrypted value
 * @property {string} iv - Base64 initialization vector
 * @property {string} tag - Base64 auth tag
 * @property {number} version - Secret version
 * @property {string} createdAt - ISO timestamp
 * @property {string} rotateBy - ISO timestamp for next rotation
 * @property {string} keyId - Encryption key identifier
 */

/**
 * In-memory vault (in production: HashiCorp Vault, GCP Secret Manager, etc.)
 * @type {Map<string, EncryptedSecret[]>}
 */
const vault = new Map();

/**
 * Master encryption keys (in production: HSM-backed or KMS)
 * @type {Map<string, {key: Buffer, createdAt: number}>}
 */
const masterKeys = new Map();

/** @type {string} Current active key ID */
let activeKeyId = null;

/**
 * Generate a new master encryption key
 * @returns {string} Key ID
 */
function generateMasterKey() {
  const keyId = `hk-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const key = crypto.randomBytes(32);
  masterKeys.set(keyId, { key, createdAt: Date.now() });
  activeKeyId = keyId;
  return keyId;
}

/**
 * Encrypt a secret value using envelope encryption
 * @param {string} value - Plaintext secret value
 * @param {string} [keyId] - Specific key ID (defaults to active key)
 * @returns {{encrypted: string, iv: string, tag: string, keyId: string}}
 */
function encrypt(value, keyId) {
  const kid = keyId || activeKeyId;
  const keyRecord = masterKeys.get(kid);
  if (!keyRecord) {
    throw new Error(`Encryption key ${kid} not found`);
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, keyRecord.key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(value, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    keyId: kid
  };
}

/**
 * Decrypt an encrypted secret
 * @param {string} encrypted - Base64 encrypted data
 * @param {string} iv - Base64 IV
 * @param {string} tag - Base64 auth tag
 * @param {string} keyId - Key ID used for encryption
 * @returns {string} Decrypted value
 */
function decrypt(encrypted, iv, tag, keyId) {
  const keyRecord = masterKeys.get(keyId);
  if (!keyRecord) {
    throw new Error(`Decryption key ${keyId} not found`);
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    keyRecord.key,
    Buffer.from(iv, 'base64'),
    { authTagLength: AUTH_TAG_LENGTH }
  );

  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Store a secret in the vault
 * @param {string} name - Secret name
 * @param {string} value - Secret value
 * @returns {{name: string, version: number, keyId: string, rotateBy: string}}
 */
function storeSecret(name, value) {
  if (!vault.has(name) && vault.size >= MAX_SECRETS) {
    throw new Error(`Maximum secret capacity (${MAX_SECRETS}) reached`);
  }

  const { encrypted, iv, tag, keyId } = encrypt(value);
  const versions = vault.get(name) || [];
  const version = versions.length + 1;

  const record = {
    name,
    encrypted,
    iv,
    tag,
    version,
    createdAt: new Date().toISOString(),
    rotateBy: new Date(Date.now() + ROTATION_INTERVAL_MS).toISOString(),
    keyId
  };

  versions.push(record);

  if (versions.length > MAX_VERSIONS) {
    versions.shift();
  }

  vault.set(name, versions);

  return { name, version, keyId, rotateBy: record.rotateBy };
}

/**
 * Retrieve a secret from the vault
 * @param {string} name - Secret name
 * @param {number} [version] - Specific version (default: latest)
 * @returns {{name: string, value: string, version: number} | null}
 */
function getSecret(name, version) {
  const versions = vault.get(name);
  if (!versions || versions.length === 0) return null;

  const record = version
    ? versions.find(v => v.version === version)
    : versions[versions.length - 1];

  if (!record) return null;

  const value = decrypt(record.encrypted, record.iv, record.tag, record.keyId);
  return { name, value, version: record.version };
}

/**
 * List all secret names (not values)
 * @returns {Array<{name: string, versions: number, latestVersion: number, rotateBy: string}>}
 */
function listSecrets() {
  const list = [];
  for (const [name, versions] of vault) {
    const latest = versions[versions.length - 1];
    list.push({
      name,
      versions: versions.length,
      latestVersion: latest.version,
      rotateBy: latest.rotateBy,
      keyId: latest.keyId
    });
  }
  return list;
}

/**
 * Check for secrets needing rotation
 * @returns {Array<{name: string, rotateBy: string, overdue: boolean}>}
 */
function checkRotation() {
  const now = Date.now();
  const results = [];
  for (const [name, versions] of vault) {
    const latest = versions[versions.length - 1];
    const rotateByDate = new Date(latest.rotateBy).getTime();
    results.push({
      name,
      rotateBy: latest.rotateBy,
      overdue: now > rotateByDate
    });
  }
  return results;
}

// Initialize first master key
generateMasterKey();

module.exports = {
  encrypt,
  decrypt,
  storeSecret,
  getSecret,
  listSecrets,
  checkRotation,
  generateMasterKey,
  ROTATION_INTERVAL_MS
};
