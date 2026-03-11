// ═══════════════════════════════════════════════════════════════════════════════
// HEADY™ Auth Gateway — Central Authentication (httpOnly cookies ONLY)
// © 2026 HeadySystems Inc. — Eric Haywood, Founder
// NO localStorage — httpOnly session cookies exclusively
// ═══════════════════════════════════════════════════════════════════════════════

import { PHI, PSI, PSI2, FIB, sha256, CSL_THRESHOLDS, cslGate } from '../shared/phi-math-v2.js';

const SESSION_CONFIG = Object.freeze({
  maxAge:      FIB[8] * 60 * 60 * 1000,       // 21 hours
  renewAfter:  FIB[7] * 60 * 60 * 1000,       // 13 hours
  absoluteMax: FIB[10] * 60 * 60 * 1000,      // 55 hours
  cookieName:  '__Host-heady_session',
  // __Host- prefix forbids domain attribute (browser-enforced)
  path:        '/',
  secure:      true,
  httpOnly:    true,
  sameSite:    'Lax',
});

const AUTH_PROVIDERS = Object.freeze({
  firebase: { name: 'Firebase Auth', enabled: true },
  google:   { name: 'Google OAuth 2.1', enabled: true },
  github:   { name: 'GitHub OAuth', enabled: true },
  email:    { name: 'Email/Password', enabled: true },
});

class AuthGateway {
  #sessions;
  #maxSessions;
  #revokedTokens;

  constructor() {
    this.#sessions = new Map();
    this.#maxSessions = FIB[16];
    this.#revokedTokens = new Set();
  }

  async authenticate(provider, credentials) {
    if (!AUTH_PROVIDERS[provider]) {
      throw new Error('Unknown provider: ' + provider);
    }

    const userId = await sha256(provider + ':' + JSON.stringify(credentials) + ':' + Date.now());
    const sessionId = await sha256('session:' + userId + ':' + Date.now());

    const session = {
      id: sessionId,
      userId,
      provider,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      expiresAt: Date.now() + SESSION_CONFIG.maxAge,
      absoluteExpiry: Date.now() + SESSION_CONFIG.absoluteMax,
      renewedCount: 0,
    };

    this.#sessions.set(sessionId, session);

    return {
      sessionId,
      userId,
      cookie: this.getCookieConfig(sessionId),
      expiresAt: session.expiresAt,
    };
  }

  async refresh(sessionId) {
    const session = this.#sessions.get(sessionId);
    if (!session) return { refreshed: false, reason: 'Session not found' };
    if (this.#revokedTokens.has(sessionId)) return { refreshed: false, reason: 'Session revoked' };

    const now = Date.now();
    if (now > session.absoluteExpiry) {
      this.#sessions.delete(sessionId);
      return { refreshed: false, reason: 'Absolute expiry reached' };
    }

    const age = now - session.lastActivity;
    if (age < SESSION_CONFIG.renewAfter) {
      return { refreshed: false, reason: 'Too early to renew' };
    }

    session.lastActivity = now;
    session.expiresAt = now + SESSION_CONFIG.maxAge;
    session.renewedCount++;

    return {
      refreshed: true,
      sessionId,
      newExpiry: session.expiresAt,
      cookie: this.getCookieConfig(sessionId),
    };
  }

  async validateSession(sessionId) {
    if (this.#revokedTokens.has(sessionId)) return { valid: false, reason: 'Revoked' };

    const session = this.#sessions.get(sessionId);
    if (!session) return { valid: false, reason: 'Not found' };

    const now = Date.now();
    if (now > session.expiresAt) {
      this.#sessions.delete(sessionId);
      return { valid: false, reason: 'Expired' };
    }

    if (now > session.absoluteExpiry) {
      this.#sessions.delete(sessionId);
      return { valid: false, reason: 'Absolute expiry' };
    }

    session.lastActivity = now;
    return {
      valid: true,
      userId: session.userId,
      provider: session.provider,
      expiresIn: session.expiresAt - now,
    };
  }

  revokeSession(sessionId) {
    this.#sessions.delete(sessionId);
    this.#revokedTokens.add(sessionId);
    return { revoked: true, sessionId };
  }

  getCookieConfig(sessionId) {
    return {
      name: SESSION_CONFIG.cookieName,
      value: sessionId,
      options: {
        maxAge: SESSION_CONFIG.maxAge,
        domain: SESSION_CONFIG.domain,
        path: SESSION_CONFIG.path,
        secure: SESSION_CONFIG.secure,
        httpOnly: SESSION_CONFIG.httpOnly,
        sameSite: SESSION_CONFIG.sameSite,
      },
    };
  }

  getActiveSessions() {
    return Array.from(this.#sessions.values()).map(s => ({
      id: s.id, userId: s.userId, provider: s.provider,
      createdAt: s.createdAt, expiresAt: s.expiresAt,
    }));
  }

  getProviders() { return AUTH_PROVIDERS; }
}

export { AuthGateway, SESSION_CONFIG, AUTH_PROVIDERS };
export default AuthGateway;
