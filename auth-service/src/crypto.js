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
// ║  FILE: auth-service/src/crypto.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * HeadyAuth Cryptographic Utilities
 * Ed25519-compatible hashing, API key generation, bcrypt password hashing.
 * All entropy sources use CSPRNG. Key prefix: hdy_
 *
 * © 2026 HeadySystems Inc. All Rights Reserved.
 */
'use strict';

const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

// fib(7) = 13 — bcrypt cost factor
const BCRYPT_ROUNDS = 13;
// fib(9) = 34 — API key entropy bytes
const API_KEY_ENTROPY_BYTES = 34;
// Session token entropy bytes (also fib(9) = 34)
const SESSION_TOKEN_BYTES = 34;

/**
 * Generate a new API key with hdy_ prefix.
 * @returns {{ raw: string, hash: string, prefix: string }}
 */
function generateApiKey() {
  const entropy = crypto.randomBytes(API_KEY_ENTROPY_BYTES).toString('hex');
  const raw = `hdy_${entropy}`;
  const hash = hashApiKey(raw);
  const prefix = raw.slice(0, 12); // hdy_ + first 8 chars for display
  return { raw, hash, prefix };
}

/**
 * SHA-256 hash of an API key.
 * @param {string} raw - Raw API key string
 * @returns {string} Hex-encoded SHA-256 hash
 */
function hashApiKey(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Generate a cryptographically secure session token.
 * @returns {string} Hex-encoded random token
 */
function generateSessionToken() {
  return crypto.randomBytes(SESSION_TOKEN_BYTES).toString('hex');
}

/**
 * Hash a password with bcrypt.
 * @param {string} plain - Plaintext password
 * @returns {Promise<string>} Bcrypt hash
 */
async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a bcrypt hash.
 * @param {string} plain - Plaintext password
 * @param {string} hash - Bcrypt hash
 * @returns {Promise<boolean>}
 */
async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/**
 * Generate a random UUID v4.
 * @returns {string}
 */
function generateId() {
  return crypto.randomUUID();
}

module.exports = {
  generateApiKey,
  hashApiKey,
  generateSessionToken,
  hashPassword,
  verifyPassword,
  generateId,
};
