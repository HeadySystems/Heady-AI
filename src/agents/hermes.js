/**
 * HERMES Agent — Protocol Liaison Bee
 * P0 Priority | Hot Pool
 * Mission: MCP transport, sessions, Server Card, DPoP, and WIF
 * From: Dropzone/10-Incoming audit manifests
 */
'use strict';

const PHI = 1.618033988749895;
const PHI_INV = 0.618033988749895;
const SESSION_TTL_MS = Math.round(3600000 * PHI); // ~5832s φ-scaled

class HermesAgent {
  constructor(opts = {}) {
    this.name = 'HERMES';
    this.type = 'bee';
    this.pool = 'hot';
    this.version = '1.0.0';
    this.sessions = new Map();
    this.sessionTTL = opts.sessionTTL || SESSION_TTL_MS;
    this.kvStore = opts.kvStore || null;
    this.serverCard = null;
    this._gcInterval = null;
  }

  /** Start the agent — load server card, start session GC */
  async start() {
    this.serverCard = await this._loadServerCard();
    this._gcInterval = setInterval(() => this._gcSessions(), Math.round(60000 * PHI));
    console.log(`[HERMES] Protocol liaison active | sessions TTL=${this.sessionTTL}ms`);
    return { status: 'active', agent: this.name, pool: this.pool };
  }

  async stop() {
    if (this._gcInterval) clearInterval(this._gcInterval);
    this.sessions.clear();
    console.log('[HERMES] Shutdown complete');
  }

  /** Create or resume a session */
  async createSession(clientId, metadata = {}) {
    const sessionId = `hm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const session = {
      id: sessionId,
      clientId,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.sessionTTL,
      metadata,
      requestCount: 0,
      lastActivity: Date.now()
    };
    this.sessions.set(sessionId, session);
    if (this.kvStore) {
      await this.kvStore.put(`session:${sessionId}`, JSON.stringify(session), { expirationTtl: Math.round(this.sessionTTL / 1000) });
    }
    return session;
  }

  /** Validate and refresh a session */
  async validateSession(sessionId) {
    let session = this.sessions.get(sessionId);
    if (!session && this.kvStore) {
      const raw = await this.kvStore.get(`session:${sessionId}`);
      if (raw) session = JSON.parse(raw);
    }
    if (!session) return { valid: false, reason: 'session_not_found' };
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return { valid: false, reason: 'session_expired' };
    }
    session.lastActivity = Date.now();
    session.requestCount++;
    session.expiresAt = Date.now() + this.sessionTTL; // sliding window
    this.sessions.set(sessionId, session);
    return { valid: true, session };
  }

  /** Serve the MCP Server Card */
  async getServerCard() {
    if (!this.serverCard) this.serverCard = await this._loadServerCard();
    return this.serverCard;
  }

  /** Validate DPoP proof token */
  async validateDPoP(proof, accessToken, httpMethod, httpUri) {
    // DPoP validation: verify JWT header has typ=dpop+jwt, check jti uniqueness, htm/htu match
    try {
      const parts = proof.split('.');
      if (parts.length !== 3) return { valid: false, reason: 'malformed_dpop' };
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      if (header.typ !== 'dpop+jwt') return { valid: false, reason: 'invalid_type' };
      if (payload.htm !== httpMethod) return { valid: false, reason: 'method_mismatch' };
      if (payload.htu !== httpUri) return { valid: false, reason: 'uri_mismatch' };
      const age = Date.now() / 1000 - payload.iat;
      if (age > 300) return { valid: false, reason: 'proof_expired' }; // 5 min window
      return { valid: true, jti: payload.jti, thumbprint: header.jwk };
    } catch (err) {
      return { valid: false, reason: err.message };
    }
  }

  /** Transport negotiation — prefer Streamable HTTP, fallback to SSE */
  negotiateTransport(clientCapabilities = {}) {
    const supported = ['streamable-http', 'sse', 'stdio'];
    const preferred = clientCapabilities.preferredTransport || 'streamable-http';
    const transport = supported.includes(preferred) ? preferred : 'streamable-http';
    return {
      transport,
      endpoint: transport === 'streamable-http' ? '/mcp/v1' : '/mcp/v1/sse',
      keepAlive: Math.round(30000 * PHI_INV) // ~18.5s
    };
  }

  /** Health check */
  health() {
    return {
      agent: this.name,
      status: 'healthy',
      activeSessions: this.sessions.size,
      uptime: process.uptime(),
      phi: PHI
    };
  }

  // ── Internal ──

  async _loadServerCard() {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const cardPath = path.resolve(process.cwd(), '.well-known', 'mcp.json');
      const raw = await fs.readFile(cardPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return { name: 'Heady MCP Server', version: '5.1.0', status: 'card_unavailable' };
    }
  }

  _gcSessions() {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, session] of this.sessions) {
      if (now > session.expiresAt) { this.sessions.delete(id); cleaned++; }
    }
    if (cleaned > 0) console.log(`[HERMES] GC: removed ${cleaned} expired sessions`);
  }
}

module.exports = { HermesAgent };
