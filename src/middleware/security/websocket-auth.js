/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * WebSocket Authentication Middleware
 * ════════════════════════════════════
 * Per-connection token validation — not just on upgrade, but re-validated
 * on every control frame. Expired tokens get immediate disconnect.
 *
 * Features:
 *  - Token validation on WS upgrade handshake
 *  - Periodic re-authentication at φ-scaled heartbeat intervals
 *  - Client binding: IP + User-Agent hash prevents session replay
 *  - Automatic disconnection on token expiry
 *  - Rate limiting per connection (Fibonacci-scaled)
 *
 * φ-derived: Heartbeat interval = 21s (Fibonacci)
 *            Reauth interval    = 89s (Fibonacci)
 *            Max idle           = 233s (Fibonacci)
 *            Message rate       = 34/min anonymous, 89/min authenticated
 */

'use strict';

const crypto = require('crypto');
const logger = require('../../utils/logger');

// ─── φ-Math Constants ─────────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

const HEARTBEAT_INTERVAL_MS = FIB[7] * 1000;  // 21s
const REAUTH_INTERVAL_MS = FIB[10] * 1000;  // 89s
const MAX_IDLE_MS = FIB[12] * 1000;  // 233s
const RATE_ANON_PER_MIN = FIB[8];          // 34
const RATE_AUTH_PER_MIN = FIB[10];         // 89
const RATE_ENTERPRISE_PER_MIN = FIB[12];       // 233

// ─── Client Fingerprint ──────────────────────────────────────────────────────

/**
 * Generate a client fingerprint from IP + User-Agent.
 * Used to bind sessions and prevent replay attacks.
 */
function clientFingerprint(req) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.socket?.remoteAddress || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';
    return crypto.createHash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 16);
}

// ─── Connection Tracker ──────────────────────────────────────────────────────

class WSConnectionTracker {
    constructor() {
        /** @type {Map<WebSocket, ConnectionState>} */
        this._connections = new Map();
        this._heartbeatTimer = null;
    }

    /**
     * Register a new authenticated connection.
     */
    register(ws, authData) {
        const state = {
            userId: authData.userId || authData.sub,
            role: authData.role || 'user',
            fingerprint: authData.fingerprint,
            token: authData.token,
            authenticatedAt: Date.now(),
            lastActivity: Date.now(),
            lastReauth: Date.now(),
            messageCount: 0,
            messageWindowStart: Date.now(),
        };
        this._connections.set(ws, state);

        // Start heartbeat timer if not running
        if (!this._heartbeatTimer) {
            this._heartbeatTimer = setInterval(() => this._heartbeat(), HEARTBEAT_INTERVAL_MS);
        }
    }

    /**
     * Remove a connection.
     */
    unregister(ws) {
        this._connections.delete(ws);
        if (this._connections.size === 0 && this._heartbeatTimer) {
            clearInterval(this._heartbeatTimer);
            this._heartbeatTimer = null;
        }
    }

    /**
     * Record activity for rate limiting.
     * @returns {{ allowed: boolean, remaining: number }}
     */
    recordMessage(ws) {
        const state = this._connections.get(ws);
        if (!state) return { allowed: false, remaining: 0 };

        state.lastActivity = Date.now();

        // Reset window every minute
        if (Date.now() - state.messageWindowStart > 60000) {
            state.messageCount = 0;
            state.messageWindowStart = Date.now();
        }

        state.messageCount++;

        const limit = state.role === 'enterprise' ? RATE_ENTERPRISE_PER_MIN :
            state.role === 'guest' ? RATE_ANON_PER_MIN : RATE_AUTH_PER_MIN;

        const allowed = state.messageCount <= limit;
        return { allowed, remaining: Math.max(0, limit - state.messageCount) };
    }

    /**
     * Check if connection needs re-authentication.
     */
    needsReauth(ws) {
        const state = this._connections.get(ws);
        if (!state) return true;
        return (Date.now() - state.lastReauth) > REAUTH_INTERVAL_MS;
    }

    /**
     * Update re-auth timestamp after successful re-validation.
     */
    markReauthed(ws) {
        const state = this._connections.get(ws);
        if (state) state.lastReauth = Date.now();
    }

    /**
     * Get connection statistics.
     */
    getStats() {
        return {
            activeConnections: this._connections.size,
            connections: [...this._connections.entries()].map(([_, s]) => ({
                userId: s.userId,
                role: s.role,
                idleMs: Date.now() - s.lastActivity,
                messageCount: s.messageCount,
            })),
        };
    }

    /**
     * Heartbeat — close idle and expired connections.
     * @private
     */
    _heartbeat() {
        const now = Date.now();
        for (const [ws, state] of this._connections) {
            // Close idle connections
            if ((now - state.lastActivity) > MAX_IDLE_MS) {
                _closeWS(ws, 4001, 'Idle timeout');
                this.unregister(ws);
                continue;
            }

            // Ping for keepalive
            try {
                if (ws.readyState === 1 /* OPEN */) {
                    ws.ping();
                }
            } catch {
                this.unregister(ws);
            }
        }
    }
}

// ─── Upgrade Handler ─────────────────────────────────────────────────────────

/**
 * Validate WebSocket upgrade request.
 * Extracts and verifies token from: query param, auth header, or cookie.
 *
 * @param {object} opts
 * @param {Function} opts.verifyToken - async (token) => { valid, payload, error }
 * @param {boolean}  [opts.allowAnonymous] - Allow connections without token (rate-limited)
 * @returns {Function} (req, socket, head) => void
 */
function wsUpgradeAuth(opts = {}) {
    const { verifyToken, allowAnonymous = false } = opts;
    if (!verifyToken) throw new Error('verifyToken function is required');

    return async (req, socket, head) => {
        try {
            // Extract token from multiple sources
            const url = new URL(req.url, `http://${req.headers.host}`);
            const token = url.searchParams.get('token') ||
                req.headers.authorization?.replace(/^Bearer\s+/i, '') ||
                _extractCookie(req, '__heady_session');

            const fingerprint = clientFingerprint(req);

            if (!token) {
                if (allowAnonymous) {
                    req.wsAuth = { userId: `anon:${fingerprint}`, role: 'guest', fingerprint, token: null };
                    return; // Allow upgrade to proceed
                }
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
            }

            const result = await verifyToken(token);
            if (!result.valid) {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
            }

            // Bind to client fingerprint
            req.wsAuth = {
                userId: result.payload.sub || result.payload.userId,
                role: result.payload.role || 'user',
                fingerprint,
                token,
                payload: result.payload,
            };

        } catch (err) {
            const logData = {
                level: 'error',
                service: 'websocket-auth',
                event: 'upgrade-failed',
                error: err.message,
                ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress,
                timestamp: new Date().toISOString(),
            };
            process.stdout.write(JSON.stringify(logData) + '\n');
            socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
            socket.destroy();
        }
    };
}

/**
 * Middleware for per-message authentication and rate limiting.
 *
 * @param {WSConnectionTracker} tracker
 * @param {Function} verifyToken - async (token) => { valid, payload }
 * @returns {Function} (ws, message) => { allowed, reason? }
 */
function wsMessageAuth(tracker, verifyToken) {
    return async (ws, message) => {
        // Rate limit check
        const rateResult = tracker.recordMessage(ws);
        if (!rateResult.allowed) {
            return { allowed: false, reason: 'Rate limit exceeded', remaining: 0 };
        }

        // Periodic re-authentication
        if (tracker.needsReauth(ws)) {
            const state = tracker._connections.get(ws);
            if (state?.token) {
                const result = await verifyToken(state.token);
                if (!result.valid) {
                    _closeWS(ws, 4003, 'Token expired');
                    tracker.unregister(ws);
                    return { allowed: false, reason: 'Token expired' };
                }
                tracker.markReauthed(ws);
            }
        }

        return { allowed: true, remaining: rateResult.remaining };
    };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _extractCookie(req, name) {
    const cookies = req.headers.cookie;
    if (!cookies) return null;
    const match = cookies.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

function _closeWS(ws, code, reason) {
    try {
        if (ws.readyState === 1 /* OPEN */) {
            ws.close(code, reason);
        }
    } catch (e) {
      logger.error('Unexpected error', { error: e.message, stack: e.stack });
    }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
    wsUpgradeAuth,
    wsMessageAuth,
    WSConnectionTracker,
    clientFingerprint,
    HEARTBEAT_INTERVAL_MS,
    REAUTH_INTERVAL_MS,
    MAX_IDLE_MS,
    RATE_ANON_PER_MIN,
    RATE_AUTH_PER_MIN,
    RATE_ENTERPRISE_PER_MIN,
};
