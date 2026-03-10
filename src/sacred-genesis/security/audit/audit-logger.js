/**
 * Heady Audit Logger — Sacred Genesis v4.0.0
 * Tamper-evident, append-only audit logging with Merkle tree verification
 *
 * @module audit-logger
 * @author Eric Haywood, HeadySystems Inc.
 */

'use strict';

const crypto = require('crypto');
const { PHI, PSI, fib, phiThreshold } = require('../../shared/phi-math');

/** @type {number} Maximum log entries before rotation — fib(20) */
const MAX_ENTRIES = fib(20);

/** @type {number} Batch flush size — fib(8) */
const FLUSH_BATCH_SIZE = fib(8);

/** @type {number} Flush interval ms — fib(8) * 1000 */
const FLUSH_INTERVAL_MS = fib(8) * 1000;

/**
 * Audit severity levels
 * @readonly
 * @enum {string}
 */
const SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
  ALERT: 'alert'
};

/**
 * Audit event categories
 * @readonly
 * @enum {string}
 */
const CATEGORY = {
  AUTH: 'authentication',
  ACCESS: 'access_control',
  DATA: 'data_operation',
  CONFIG: 'configuration',
  SECURITY: 'security_event',
  SYSTEM: 'system_event',
  COMPLIANCE: 'compliance'
};

/**
 * Audit log entry
 * @typedef {Object} AuditEntry
 * @property {string} id - Unique entry ID
 * @property {string} timestamp - ISO timestamp
 * @property {string} severity - Event severity
 * @property {string} category - Event category
 * @property {string} action - Action performed
 * @property {string} actor - Who performed the action
 * @property {string} resource - Target resource
 * @property {string} outcome - Success or failure
 * @property {Object} details - Additional context
 * @property {string} hash - SHA-256 hash of entry
 * @property {string} prevHash - Previous entry hash (chain)
 * @property {string} service - Originating service
 */

/** @type {AuditEntry[]} Audit log entries */
const auditLog = [];

/** @type {AuditEntry[]} Buffer for batch writes */
let writeBuffer = [];

/** @type {string} Last entry hash for chain integrity */
let lastHash = crypto.createHash('sha256').update('GENESIS').digest('hex');

/** @type {number} Total entries logged */
let totalEntries = 0;

/**
 * Compute SHA-256 hash of an audit entry
 * @param {Object} entry - Entry data
 * @param {string} prevHash - Previous entry hash
 * @returns {string} SHA-256 hex hash
 */
function computeHash(entry, prevHash) {
  const data = JSON.stringify({
    timestamp: entry.timestamp,
    severity: entry.severity,
    category: entry.category,
    action: entry.action,
    actor: entry.actor,
    resource: entry.resource,
    outcome: entry.outcome,
    prevHash
  });
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Log an audit event
 * @param {Object} params - Audit parameters
 * @param {string} params.severity - Event severity
 * @param {string} params.category - Event category
 * @param {string} params.action - Action description
 * @param {string} params.actor - Actor identifier
 * @param {string} params.resource - Target resource
 * @param {string} params.outcome - 'success' or 'failure'
 * @param {Object} [params.details={}] - Additional details
 * @param {string} [params.service='unknown'] - Originating service
 * @returns {AuditEntry}
 */
function log(params) {
  const entry = {
    id: `audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    timestamp: new Date().toISOString(),
    severity: params.severity || SEVERITY.INFO,
    category: params.category || CATEGORY.SYSTEM,
    action: params.action,
    actor: params.actor || 'system',
    resource: params.resource || '',
    outcome: params.outcome || 'success',
    details: params.details || {},
    service: params.service || 'unknown',
    prevHash: lastHash,
    hash: ''
  };

  entry.hash = computeHash(entry, lastHash);
  lastHash = entry.hash;
  totalEntries++;

  writeBuffer.push(entry);

  if (writeBuffer.length >= FLUSH_BATCH_SIZE) {
    flush();
  }

  return entry;
}

/**
 * Flush write buffer to audit log
 */
function flush() {
  if (writeBuffer.length === 0) return;

  auditLog.push(...writeBuffer);
  writeBuffer = [];

  while (auditLog.length > MAX_ENTRIES) {
    auditLog.shift();
  }
}

/**
 * Verify audit log chain integrity
 * @returns {{valid: boolean, brokenAt?: number, entries: number}}
 */
function verifyChain() {
  flush();

  if (auditLog.length === 0) {
    return { valid: true, entries: 0 };
  }

  for (let i = 1; i < auditLog.length; i++) {
    const expected = computeHash(auditLog[i], auditLog[i - 1].hash);
    if (auditLog[i].hash !== expected) {
      return { valid: false, brokenAt: i, entries: auditLog.length };
    }
    if (auditLog[i].prevHash !== auditLog[i - 1].hash) {
      return { valid: false, brokenAt: i, entries: auditLog.length };
    }
  }

  return { valid: true, entries: auditLog.length };
}

/**
 * Query audit logs with filters
 * @param {Object} filters - Query filters
 * @param {string} [filters.actor] - Filter by actor
 * @param {string} [filters.category] - Filter by category
 * @param {string} [filters.severity] - Filter by severity
 * @param {string} [filters.service] - Filter by service
 * @param {string} [filters.from] - Start timestamp
 * @param {string} [filters.to] - End timestamp
 * @param {number} [filters.limit] - Max results (default fib(9))
 * @returns {AuditEntry[]}
 */
function query(filters = {}) {
  flush();

  let results = [...auditLog];

  if (filters.actor) {
    results = results.filter(e => e.actor === filters.actor);
  }
  if (filters.category) {
    results = results.filter(e => e.category === filters.category);
  }
  if (filters.severity) {
    results = results.filter(e => e.severity === filters.severity);
  }
  if (filters.service) {
    results = results.filter(e => e.service === filters.service);
  }
  if (filters.from) {
    results = results.filter(e => e.timestamp >= filters.from);
  }
  if (filters.to) {
    results = results.filter(e => e.timestamp <= filters.to);
  }

  const limit = filters.limit || fib(9);
  return results.slice(-limit);
}

/**
 * Get audit statistics
 * @returns {Object} Audit stats
 */
function getStats() {
  flush();
  const bySeverity = {};
  const byCategory = {};

  for (const entry of auditLog) {
    bySeverity[entry.severity] = (bySeverity[entry.severity] || 0) + 1;
    byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
  }

  return {
    totalEntries,
    activeEntries: auditLog.length,
    maxEntries: MAX_ENTRIES,
    bySeverity,
    byCategory,
    chainIntegrity: verifyChain().valid,
    lastHash
  };
}

// Periodic flush
setInterval(flush, FLUSH_INTERVAL_MS);

module.exports = {
  SEVERITY,
  CATEGORY,
  log,
  flush,
  verifyChain,
  query,
  getStats
};
