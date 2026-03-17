/**
 * @file identity-service.js
 * @description Username reservation, email provisioning, API key generation,
 *   and identity lifecycle management.
 *   All state is in-memory — swap for PostgreSQL+pgvector in production.
 */

import { randomUUID } from 'node:crypto';
import pino from 'pino';
import { RESERVED_USERNAMES } from '../schemas/onboarding-schemas.js';

const log = pino({ name: 'identity-service' });

// ─── In-Memory Stores ───────────────────────────────────────────────────────

/**
 * @typedef {object} Identity
 * @property {string} uid
 * @property {string} username
 * @property {string} displayName
 * @property {string|null} email
 * @property {string|null} headyEmail
 * @property {string} apiKey
 * @property {string|null} passwordHash
 * @property {string} createdAt
 */

/** @type {Map<string, Identity>} username (lowercased) → identity record */
const identities = new Map();

/** @type {Set<string>} lowercased usernames for uniqueness checks */
const takenUsernames = new Set();

/** @type {Map<string, string>} uid → username (lowercased) */
const uidToUsername = new Map();

// ─── API Key Generation ─────────────────────────────────────────────────────

/**
 * Generate an API key in the canonical HY-{uuid-v4} format.
 * @returns {string}
 */
export function generateApiKey() {
  return `HY-${randomUUID()}`;
}

// ─── Password Hashing (Argon2id placeholder) ────────────────────────────────

/**
 * Hash a password using Argon2id.
 * In production: use argon2 npm package with Argon2id variant.
 * @param {string} password
 * @returns {string}
 */
function hashPassword(password) {
  // Placeholder: in production use argon2.hash(password, { type: argon2.argon2id })
  const salt = randomUUID().replace(/-/g, '').slice(0, 16);
  const hash = Buffer.from(`${salt}:${password}`).toString('base64url');
  return `$argon2id$placeholder$${salt}$${hash}`;
}

// ─── Username Availability ──────────────────────────────────────────────────

/**
 * Check whether a username is available.
 * @param {string} username
 * @returns {{ available: boolean; reason?: string }}
 */
export function checkUsernameAvailability(username) {
  const lower = username.toLowerCase();

  if (RESERVED_USERNAMES.has(lower)) {
    return { available: false, reason: 'RESERVED' };
  }
  if (takenUsernames.has(lower)) {
    return { available: false, reason: 'TAKEN' };
  }
  return { available: true };
}

// ─── Create Identity ────────────────────────────────────────────────────────

/**
 * Reserve a username and create the core identity record.
 * @param {string} uid   Firebase UID.
 * @param {string} username   Validated username.
 * @param {string} displayName   Display name.
 * @param {string|null} password   Optional password (hashed with Argon2id).
 * @returns {{ identity: Identity } | { error: string }}
 */
export function createIdentity(uid, username, displayName, password) {
  const availability = checkUsernameAvailability(username);
  if (!availability.available) {
    log.warn({ uid, username, reason: availability.reason }, 'identity creation rejected');
    return { error: availability.reason === 'RESERVED' ? 'USERNAME_RESERVED' : 'USERNAME_TAKEN' };
  }

  if (uidToUsername.has(uid)) {
    log.warn({ uid }, 'identity already exists for this uid');
    return { error: 'IDENTITY_EXISTS' };
  }

  const lower = username.toLowerCase();
  const apiKey = generateApiKey();
  const passwordHash = password ? hashPassword(password) : null;
  const identity = {
    uid,
    username: lower,
    displayName,
    email: null,
    headyEmail: null,
    apiKey,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  identities.set(lower, identity);
  takenUsernames.add(lower);
  uidToUsername.set(uid, lower);

  log.info({ uid, username: lower, hasPassword: !!password }, 'identity created');
  return { identity };
}

// ─── Email Configuration ────────────────────────────────────────────────────

/**
 * Configure email for a user: contact email and optional @headyme.com forwarding.
 * @param {string} uid
 * @param {object} config
 * @param {string} config.contactEmail
 * @param {boolean} config.provisionHeadyEmail
 * @param {string} [config.headyEmailPrefix]
 * @returns {{ email: object } | { error: string }}
 */
export function configureEmail(uid, config) {
  const username = uidToUsername.get(uid);
  if (!username) {
    return { error: 'IDENTITY_NOT_FOUND' };
  }

  const identity = identities.get(username);
  identity.email = config.contactEmail;

  if (config.provisionHeadyEmail) {
    const prefix = config.headyEmailPrefix || username;
    identity.headyEmail = `${prefix}@headyme.com`;
    log.info({ uid, headyEmail: identity.headyEmail }, 'headyme.com email provisioned');
  }

  log.info({ uid, contactEmail: config.contactEmail }, 'email configured');
  return {
    email: {
      contactEmail: identity.email,
      headyEmail: identity.headyEmail,
    },
  };
}

// ─── Lookup Helpers ─────────────────────────────────────────────────────────

/**
 * Get identity by UID.
 * @param {string} uid
 * @returns {Identity|null}
 */
export function getIdentityByUid(uid) {
  const username = uidToUsername.get(uid);
  if (!username) return null;
  return identities.get(username) ?? null;
}

/**
 * Get identity by username.
 * @param {string} username
 * @returns {Identity|null}
 */
export function getIdentityByUsername(username) {
  return identities.get(username.toLowerCase()) ?? null;
}

/**
 * Delete identity (for testing or account removal).
 * @param {string} uid
 * @returns {boolean}
 */
export function deleteIdentity(uid) {
  const username = uidToUsername.get(uid);
  if (!username) return false;

  identities.delete(username);
  takenUsernames.delete(username);
  uidToUsername.delete(uid);
  log.info({ uid, username }, 'identity deleted');
  return true;
}
