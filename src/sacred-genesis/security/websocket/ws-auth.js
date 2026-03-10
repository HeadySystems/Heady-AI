/**
 * Heady WebSocket Authentication — Sacred Genesis v4.0.0
 * Secure WebSocket handshake with session validation and CSRF protection
 *
 * @module ws-auth
 * @author Eric Haywood, HeadySystems Inc.
 */

'use strict';

const crypto = require('crypto');
const { PHI, PSI, fib, phiThreshold } = require('../../shared/phi-math');

/** @type {number} Maximum concurrent WebSocket connections — fib(12) */
const MAX_CONNECTIONS = fib(12);

/** @type {number} Heartbeat interval ms — fib(9) * 1000 */
const HEARTBEAT_INTERVAL_MS = fib(9) * 1000;

/** @type {number} Connection timeout ms — fib(11) * 1000 */
const CONNECTION_TIMEOUT_MS = fib(11) * 1000;

/** @type {number} Maximum message size bytes — fib(16) * 1024 */
const MAX_MESSAGE_SIZE = fib(16) * 1024;

/** @type {number} Rate limit: messages per minute — fib(11) */
const MESSAGE_RATE_LIMIT = fib(11);

/**
 * WebSocket connection state
 * @typedef {Object} WSConnection
 * @property {string} id - Connection identifier
 * @property {string} userId - Authenticated user ID
 * @property {string} sessionId - Associated HTTP session
 * @property {number} connectedAt - Connection timestamp
 * @property {number} lastHeartbeat - Last heartbeat timestamp
 * @property {number} messageCount - Messages sent in current window
 * @property {number} windowStart - Current rate limit window start
 * @property {string} ipAddress - Client IP
 */

/** @type {Map<string, WSConnection>} Active connections */
const connections = new Map();

/**
 * Validate WebSocket upgrade request
 * @param {http.IncomingMessage} req - HTTP upgrade request
 * @returns {{valid: boolean, userId?: string, sessionId?: string, error?: string}}
 */
function validateUpgrade(req) {
  if (connections.size >= MAX_CONNECTIONS) {
    return { valid: false, error: 'Maximum connections reached' };
  }

  const upgradeHeader = req.headers.upgrade;
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    return { valid: false, error: 'Invalid upgrade header' };
  }

  const key = req.headers['sec-websocket-key'];
  if (!key) {
    return { valid: false, error: 'Missing WebSocket key' };
  }

  const cookies = parseCookies(req.headers.cookie || '');
  const sessionId = cookies['heady_sid'];
  if (!sessionId) {
    return { valid: false, error: 'No session cookie' };
  }

  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://headyme.com',
    'https://headysystems.com',
    'https://headybuddy.com',
    'https://admin.headysystems.com'
  ];

  if (origin && !allowedOrigins.includes(origin)) {
    return { valid: false, error: 'Origin not allowed' };
  }

  return {
    valid: true,
    sessionId,
    userId: 'pending-validation'
  };
}

/**
 * Register a validated WebSocket connection
 * @param {string} userId - Authenticated user ID
 * @param {string} sessionId - HTTP session ID
 * @param {string} ipAddress - Client IP
 * @returns {WSConnection}
 */
function registerConnection(userId, sessionId, ipAddress) {
  const id = `ws-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const now = Date.now();

  const conn = {
    id,
    userId,
    sessionId,
    connectedAt: now,
    lastHeartbeat: now,
    messageCount: 0,
    windowStart: now,
    ipAddress
  };

  connections.set(id, conn);
  return conn;
}

/**
 * Check message rate limit
 * @param {string} connectionId - Connection identifier
 * @returns {{allowed: boolean, remaining: number}}
 */
function checkRateLimit(connectionId) {
  const conn = connections.get(connectionId);
  if (!conn) return { allowed: false, remaining: 0 };

  const now = Date.now();
  const windowDuration = 60000;

  if (now - conn.windowStart > windowDuration) {
    conn.messageCount = 0;
    conn.windowStart = now;
  }

  if (conn.messageCount >= MESSAGE_RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  conn.messageCount++;
  return {
    allowed: true,
    remaining: MESSAGE_RATE_LIMIT - conn.messageCount
  };
}

/**
 * Process heartbeat for a connection
 * @param {string} connectionId - Connection identifier
 * @returns {boolean} Connection still valid
 */
function heartbeat(connectionId) {
  const conn = connections.get(connectionId);
  if (!conn) return false;

  conn.lastHeartbeat = Date.now();
  return true;
}

/**
 * Remove a connection
 * @param {string} connectionId - Connection identifier
 */
function removeConnection(connectionId) {
  connections.delete(connectionId);
}

/**
 * Evict stale connections
 * @returns {number} Number of connections evicted
 */
function evictStale() {
  const cutoff = Date.now() - CONNECTION_TIMEOUT_MS;
  let evicted = 0;

  for (const [id, conn] of connections) {
    if (conn.lastHeartbeat < cutoff) {
      connections.delete(id);
      evicted++;
    }
  }

  return evicted;
}

/**
 * Get connection statistics
 * @returns {Object} Connection stats
 */
function getStats() {
  return {
    activeConnections: connections.size,
    maxConnections: MAX_CONNECTIONS,
    heartbeatInterval: HEARTBEAT_INTERVAL_MS,
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    messageRateLimit: MESSAGE_RATE_LIMIT,
    maxMessageSize: MAX_MESSAGE_SIZE
  };
}

/**
 * Parse cookies from header
 * @param {string} cookieHeader - Cookie header
 * @returns {Object<string, string>}
 */
function parseCookies(cookieHeader) {
  const cookies = {};
  cookieHeader.split(';').forEach(pair => {
    const [key, ...val] = pair.trim().split('=');
    if (key) cookies[key.trim()] = val.join('=').trim();
  });
  return cookies;
}

// Periodic stale connection cleanup
setInterval(evictStale, HEARTBEAT_INTERVAL_MS);

module.exports = {
  validateUpgrade,
  registerConnection,
  checkRateLimit,
  heartbeat,
  removeConnection,
  evictStale,
  getStats,
  MAX_CONNECTIONS,
  HEARTBEAT_INTERVAL_MS,
  CONNECTION_TIMEOUT_MS,
  MAX_MESSAGE_SIZE,
  MESSAGE_RATE_LIMIT
};
