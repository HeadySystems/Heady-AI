/**
 * HeadyAuth Middleware — JWT validation, API key validation, RBAC enforcement.
 *
 * © 2026 HeadySystems Inc. All Rights Reserved.
 */
'use strict';

const jwt = require('jsonwebtoken');
const db = require('./db');
const { hashApiKey } = require('./crypto');
const { log } = require('./logger');

const JWT_SECRET = process.env.JWT_SECRET;

// RBAC role hierarchy
const ROLE_LEVELS = { guest: 1, user: 2, operator: 3, admin: 4 };

/**
 * Extract and validate auth credentials from request.
 * Checks: Authorization Bearer JWT → X-API-Key header → __heady_session cookie
 */
async function requireAuth(req, res, next) {
  try {
    // 1. Check Bearer JWT
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      return next();
    }

    // 2. Check API Key
    const apiKey = req.headers['x-api-key'];
    if (apiKey && apiKey.startsWith('hdy_')) {
      const keyHash = hashApiKey(apiKey);
      const result = await db.query(
        `SELECT ak.id, ak.user_id, ak.role, ak.expires_at, u.email, u.name
         FROM api_keys ak JOIN users u ON ak.user_id = u.id
         WHERE ak.key_hash = $1`,
        [keyHash]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      const key = result.rows[0];
      if (key.expires_at && new Date(key.expires_at) < new Date()) {
        return res.status(401).json({ error: 'API key expired' });
      }

      // Update last_used_at
      await db.query('UPDATE api_keys SET last_used_at = now() WHERE id = $1', [key.id]);

      req.user = {
        userId: key.user_id,
        email: key.email,
        name: key.name,
        role: key.role,
        authMethod: 'api_key',
      };
      return next();
    }

    // 3. Check session cookie
    const sessionToken = req.cookies?.__heady_session;
    if (sessionToken) {
      const result = await db.query(
        `SELECT s.user_id, s.expires_at, u.email, u.name, u.role
         FROM sessions s JOIN users u ON s.user_id = u.id
         WHERE s.session_token = $1`,
        [sessionToken]
      );

      if (result.rows.length > 0) {
        const session = result.rows[0];
        if (new Date(session.expires_at) > new Date()) {
          req.user = {
            userId: session.user_id,
            email: session.email,
            name: session.name,
            role: session.role,
            authMethod: 'session',
          };
          return next();
        }
      }
    }

    return res.status(401).json({ error: 'Authentication required' });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    log('error', 'auth_middleware_error', { error: err.message });
    return res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * RBAC middleware factory — checks minimum role level.
 * @param {number} minLevel - Minimum role level required (1=guest, 2=user, 3=operator, 4=admin)
 */
function requireRole(minLevel) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const userLevel = ROLE_LEVELS[req.user.role] || 0;
    if (userLevel < minLevel) {
      log('warn', 'rbac_denied', {
        userId: req.user.userId,
        role: req.user.role,
        required: minLevel,
        actual: userLevel,
      });
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, ROLE_LEVELS };
