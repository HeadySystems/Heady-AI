/**
 * @file latent-space-init.js
 * @description Initialize the 3-tier latent space for a new user.
 *   T0 = working memory (Redis-like, in-memory for now)
 *   T1 = short-term (47h TTL, PostgreSQL+pgvector in prod)
 *   T2 = long-term (hot → warm → cold → archive, tiered storage in prod)
 *   All embeddings are 384-dimensional (text-embedding-3-small compatible).
 */

import { randomUUID } from 'node:crypto';
import pino from 'pino';

const log = pino({ name: 'latent-space-init' });

// ─── Constants ──────────────────────────────────────────────────────────────

const EMBEDDING_DIM = 384;
const T1_TTL_HOURS = 47;
const T1_TTL_MS = T1_TTL_HOURS * 60 * 60 * 1000;

const T2_TIERS = ['hot', 'warm', 'cold', 'archive'];

// ─── In-Memory Stores ───────────────────────────────────────────────────────

/**
 * @typedef {object} T0Entry
 * @property {string} id
 * @property {string} content
 * @property {Float32Array} embedding
 * @property {string} createdAt
 */

/**
 * @typedef {object} T1Entry
 * @property {string} id
 * @property {string} content
 * @property {Float32Array} embedding
 * @property {string} createdAt
 * @property {number} expiresAt  Unix ms timestamp.
 */

/**
 * @typedef {object} T2Entry
 * @property {string} id
 * @property {string} content
 * @property {Float32Array} embedding
 * @property {string} tier  'hot' | 'warm' | 'cold' | 'archive'
 * @property {string} createdAt
 */

/** @type {Map<string, T0Entry[]>} uid → working memory entries */
const t0Store = new Map();

/** @type {Map<string, T1Entry[]>} uid → short-term entries */
const t1Store = new Map();

/** @type {Map<string, T2Entry[]>} uid → long-term entries */
const t2Store = new Map();

// ─── Seed Embedding ─────────────────────────────────────────────────────────

/**
 * Generate a deterministic seed embedding from a string.
 * In production, call text-embedding-3-small; here we hash to a 384D vector
 * using FNV-1a with golden-ratio mixing for uniform distribution.
 * @param {string} text
 * @returns {Float32Array}
 */
function seedEmbedding(text) {
  const vec = new Float32Array(EMBEDDING_DIM);
  let hash = 0x811c9dc5; // FNV-1a offset basis
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    hash ^= (i * 0x9e3779b9);
    hash = Math.imul(hash, 0x01000193);
    vec[i] = ((hash >>> 0) / 0xFFFFFFFF) * 2 - 1;
  }
  // L2-normalize
  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < EMBEDDING_DIM; i++) vec[i] /= norm;
  return vec;
}

// ─── Initialization ─────────────────────────────────────────────────────────

/**
 * Initialize the 3-tier latent space for a new user.
 * Seeds T0 with an identity anchor + archetype vector, T1 with onboarding
 * context + domain interest vectors, T2 empty.
 * @param {string} uid
 * @param {object} profile
 * @param {string} profile.username
 * @param {string} profile.displayName
 * @param {string} [profile.archetype]
 * @param {string[]} [profile.domains]
 * @returns {{ t0Count: number; t1Count: number; t2Count: number; embeddingDim: number }}
 */
export function initLatentSpace(uid, profile) {
  const now = new Date().toISOString();
  const nowMs = Date.now();

  // ── T0: Working memory — identity anchor + archetype ──────────────────
  const t0Entries = [
    {
      id: randomUUID(),
      content: `identity:${profile.username}:${profile.displayName}`,
      embedding: seedEmbedding(`identity ${profile.username} ${profile.displayName}`),
      createdAt: now,
    },
  ];

  if (profile.archetype) {
    t0Entries.push({
      id: randomUUID(),
      content: `archetype:${profile.archetype}`,
      embedding: seedEmbedding(`cognitive archetype ${profile.archetype}`),
      createdAt: now,
    });
  }

  t0Store.set(uid, t0Entries);

  // ── T1: Short-term — onboarding context + domain interests ────────────
  const t1Entries = [
    {
      id: randomUUID(),
      content: `onboarding:started:${now}`,
      embedding: seedEmbedding(`onboarding started ${now}`),
      createdAt: now,
      expiresAt: nowMs + T1_TTL_MS,
    },
  ];

  if (profile.domains?.length) {
    for (const domain of profile.domains) {
      t1Entries.push({
        id: randomUUID(),
        content: `interest:${domain}`,
        embedding: seedEmbedding(`user interest domain ${domain}`),
        createdAt: now,
        expiresAt: nowMs + T1_TTL_MS,
      });
    }
  }

  t1Store.set(uid, t1Entries);

  // ── T2: Long-term — start empty ──────────────────────────────────────
  t2Store.set(uid, []);

  log.info(
    { uid, t0: t0Entries.length, t1: t1Entries.length, embeddingDim: EMBEDDING_DIM },
    'latent space initialized',
  );

  return {
    t0Count: t0Entries.length,
    t1Count: t1Entries.length,
    t2Count: 0,
    embeddingDim: EMBEDDING_DIM,
  };
}

// ─── T1 Expiry Sweep ────────────────────────────────────────────────────────

/**
 * Sweep expired T1 entries for a user. In production this is a background job.
 * @param {string} uid
 * @returns {number} Number of entries evicted.
 */
export function sweepT1(uid) {
  const entries = t1Store.get(uid);
  if (!entries) return 0;

  const now = Date.now();
  const before = entries.length;
  const alive = entries.filter((e) => e.expiresAt > now);
  t1Store.set(uid, alive);

  const evicted = before - alive.length;
  if (evicted > 0) {
    log.info({ uid, evicted }, 'T1 entries swept');
  }
  return evicted;
}

// ─── Write Helpers ──────────────────────────────────────────────────────────

/**
 * Write to T0 (working memory).
 * @param {string} uid
 * @param {string} content
 * @param {Float32Array} embedding
 * @returns {T0Entry}
 */
export function writeT0(uid, content, embedding) {
  const entry = { id: randomUUID(), content, embedding, createdAt: new Date().toISOString() };
  const entries = t0Store.get(uid) ?? [];
  entries.push(entry);
  t0Store.set(uid, entries);
  return entry;
}

/**
 * Promote a T0 entry to T2 (long-term, hot tier).
 * @param {string} uid
 * @param {string} entryId  T0 entry ID to promote.
 * @returns {T2Entry|null}
 */
export function promoteToT2(uid, entryId) {
  const t0Entries = t0Store.get(uid);
  if (!t0Entries) return null;

  const idx = t0Entries.findIndex((e) => e.id === entryId);
  if (idx === -1) return null;

  const [source] = t0Entries.splice(idx, 1);
  const t2Entry = { ...source, tier: 'hot' };

  const t2Entries = t2Store.get(uid) ?? [];
  t2Entries.push(t2Entry);
  t2Store.set(uid, t2Entries);

  log.info({ uid, entryId, tier: 'hot' }, 'entry promoted to T2');
  return t2Entry;
}

// ─── Read Helpers ───────────────────────────────────────────────────────────

/**
 * Get latent space stats for a user.
 * @param {string} uid
 * @returns {{ t0Count: number; t1Count: number; t2Count: number; t2Tiers: Record<string,number>; embeddingDim: number } | null}
 */
export function getLatentSpaceStats(uid) {
  if (!t0Store.has(uid)) return null;

  const t2Entries = t2Store.get(uid) ?? [];
  const t2Tiers = {};
  for (const tier of T2_TIERS) {
    t2Tiers[tier] = t2Entries.filter((e) => e.tier === tier).length;
  }

  return {
    t0Count: (t0Store.get(uid) ?? []).length,
    t1Count: (t1Store.get(uid) ?? []).length,
    t2Count: t2Entries.length,
    t2Tiers,
    embeddingDim: EMBEDDING_DIM,
  };
}

/**
 * Tear down latent space for a user (account deletion).
 * @param {string} uid
 */
export function destroyLatentSpace(uid) {
  t0Store.delete(uid);
  t1Store.delete(uid);
  t2Store.delete(uid);
  log.info({ uid }, 'latent space destroyed');
}
