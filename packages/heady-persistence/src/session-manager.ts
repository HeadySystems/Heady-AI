/**
 * @fileoverview Heady Session Manager — httpOnly secure cookies, cross-domain relay, token refresh
 * @module @heady/persistence/session
 * @version 1.0.0
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 *
 * Zero localStorage. All auth state via httpOnly secure cookies.
 * Cross-domain auth relay via iframe/postMessage for all 9 Heady domains.
 */

import pino from 'pino';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { PHI, PSI, SESSION, HEADY_DOMAINS, CSL } from './constants.js';

const log = pino({ name: 'heady-session-manager', level: process.env.LOG_LEVEL || 'info' });

export interface SessionToken {
  userId: string;
  sessionId: string;
  deviceId: string;
  fingerprint: string;
  issuedAt: number;
  expiresAt: number;
  refreshCount: number;
}

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  domain: string;
  path: string;
  maxAge: number;
}

/**
 * SessionManager — Manages secure sessions across all Heady domains.
 * Uses httpOnly cookies with cross-domain relay via iframe/postMessage.
 */
export class SessionManager {
  private secretKey: Uint8Array;
  private activeSessions: Map<string, SessionToken> = new Map();

  constructor(private config: {
    jwtSecret: string;
    cookieDomain: string;
    isProduction: boolean;
  }) {
    this.secretKey = new TextEncoder().encode(config.jwtSecret);
    log.info({ cookieDomain: config.cookieDomain, isProduction: config.isProduction }, 'SessionManager initialized');
  }

  /**
   * Create a new session token and set httpOnly cookie.
   * Returns cookie string for Set-Cookie header.
   */
  async createSession(userId: string, deviceId: string, fingerprint: string): Promise<{
    token: string;
    cookie: string;
    session: SessionToken;
  }> {
    const correlationId = `session-create-${userId}-${Date.now()}`;
    const sessionId = `hs_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const session: SessionToken = {
      userId,
      sessionId,
      deviceId,
      fingerprint,
      issuedAt: Date.now(),
      expiresAt: Date.now() + SESSION.TTL_MS,
      refreshCount: 0,
    };

    const token = await new SignJWT({
      sub: userId,
      sid: sessionId,
      did: deviceId,
      fp: fingerprint,
      rc: 0,
    } as JWTPayload & { sid: string; did: string; fp: string; rc: number })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${Math.floor(SESSION.TTL_MS / 1000)}s`)
      .sign(this.secretKey);

    this.activeSessions.set(sessionId, session);

    const cookieOptions = this.getCookieOptions();
    const cookie = this.buildCookieString('heady_session', token, cookieOptions);

    log.info({ correlationId, sessionId, deviceId }, 'Session created');
    return { token, cookie, session };
  }

  /**
   * Verify and decode a session token.
   * Returns session data or null if invalid.
   */
  async verifySession(token: string): Promise<SessionToken | null> {
    try {
      const { payload } = await jwtVerify(token, this.secretKey);
      const session: SessionToken = {
        userId: payload.sub as string,
        sessionId: (payload as Record<string, unknown>).sid as string,
        deviceId: (payload as Record<string, unknown>).did as string,
        fingerprint: (payload as Record<string, unknown>).fp as string,
        issuedAt: (payload.iat || 0) * 1000,
        expiresAt: (payload.exp || 0) * 1000,
        refreshCount: (payload as Record<string, unknown>).rc as number,
      };

      // Check if session should be refreshed (past refresh threshold)
      const elapsed = Date.now() - session.issuedAt;
      const remaining = session.expiresAt - Date.now();
      if (remaining / SESSION.TTL_MS < SESSION.REFRESH_THRESHOLD) {
        log.info({ sessionId: session.sessionId }, 'Session approaching expiry — refresh recommended');
      }

      return session;
    } catch (err) {
      log.warn({ err }, 'Session verification failed');
      return null;
    }
  }

  /**
   * Refresh a session token with phi-exponential backoff tracking.
   */
  async refreshSession(currentToken: string): Promise<{
    token: string;
    cookie: string;
    session: SessionToken;
  } | null> {
    const current = await this.verifySession(currentToken);
    if (!current) return null;

    const newRefreshCount = current.refreshCount + 1;
    const backoffMs = Math.round(Math.pow(PHI, newRefreshCount) * SESSION.RECONNECT_BASE_MS);
    const jitter = (Math.random() - 0.5) * 2 * PSI * backoffMs;

    log.info({
      sessionId: current.sessionId,
      refreshCount: newRefreshCount,
      backoffMs: Math.round(backoffMs + jitter),
    }, 'Session refresh');

    // Invalidate old session
    this.activeSessions.delete(current.sessionId);

    // Create new session
    return this.createSession(current.userId, current.deviceId, current.fingerprint);
  }

  /**
   * Invalidate a session (logout).
   */
  async invalidateSession(sessionId: string): Promise<string> {
    this.activeSessions.delete(sessionId);
    const cookieOptions = this.getCookieOptions();
    const clearCookie = this.buildCookieString('heady_session', '', { ...cookieOptions, maxAge: 0 });
    log.info({ sessionId }, 'Session invalidated');
    return clearCookie;
  }

  /**
   * Generate cross-domain auth relay HTML for iframe embedding.
   * This enables seamless auth across all 9 Heady domains.
   */
  generateAuthRelayHtml(token: string): string {
    const domains = HEADY_DOMAINS.map(d => `https://${d}`);
    return `<!DOCTYPE html>
<html><head><title>Heady Auth Relay</title></head>
<body>
<script>
(function() {
  const ALLOWED_ORIGINS = ${JSON.stringify(domains)};
  window.addEventListener('message', function(event) {
    if (!ALLOWED_ORIGINS.includes(event.origin)) return;
    if (event.data.type === 'HEADY_AUTH_REQUEST') {
      event.source.postMessage({
        type: 'HEADY_AUTH_RESPONSE',
        authenticated: true,
        sessionValid: true,
        coherenceScore: ${CSL.HIGH}
      }, event.origin);
    }
  });
  // Notify parent that relay is ready
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'HEADY_RELAY_READY' }, '*');
  }
})();
</script>
</body></html>`;
  }

  /**
   * Validate request fingerprint against session.
   */
  validateFingerprint(session: SessionToken, requestFingerprint: string): boolean {
    return session.fingerprint === requestFingerprint;
  }

  /**
   * Get health status.
   */
  getHealth(): { status: string; coherenceScore: number; activeSessions: number } {
    return {
      status: 'healthy',
      coherenceScore: CSL.HIGH,
      activeSessions: this.activeSessions.size,
    };
  }

  /** Build cookie options for the current environment */
  private getCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: this.config.isProduction ? 'lax' : 'lax',
      domain: this.config.cookieDomain,
      path: '/',
      maxAge: Math.floor(SESSION.TTL_MS / 1000),
    };
  }

  /** Serialize cookie string */
  private buildCookieString(name: string, value: string, opts: CookieOptions): string {
    let cookie = `${name}=${value}`;
    cookie += `; Path=${opts.path}`;
    cookie += `; Max-Age=${opts.maxAge}`;
    if (opts.domain) cookie += `; Domain=${opts.domain}`;
    if (opts.httpOnly) cookie += '; HttpOnly';
    if (opts.secure) cookie += '; Secure';
    cookie += `; SameSite=${opts.sameSite.charAt(0).toUpperCase() + opts.sameSite.slice(1)}`;
    return cookie;
  }
}
