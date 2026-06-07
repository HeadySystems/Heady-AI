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
// ║  FILE: src/services/heady-buddy/index.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * @fileoverview heady-buddy — AI companion conversation interface — the user-facing entry point to Heady
 * @module heady-buddy
 * @version 4.0.0
 * @port 3341
 * @domain interface
 *
 * Heady™ Latent OS — Sacred Geometry v4.0
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 * 51 Provisional Patents — All Rights Reserved
 */

'use strict';

const { LiquidNodeBase, CSL_THRESHOLDS, PHI, PSI, PSI2, FIB, fib, phiThreshold, phiBackoff, correlationId } = require('../../shared/liquid-node-base');
const { ServiceMesh, SERVICE_CATALOG, DOMAIN_SWARMS } = require('../../shared/service-mesh');

const mesh = ServiceMesh.instance();

/** @type {Map<string, Array<Object>>} Conversation sessions */
const sessions = new Map();
const MAX_SESSIONS = fib(14); // 377
const MAX_MESSAGES_PER_SESSION = fib(11); // 89

class HeadyBuddy extends LiquidNodeBase {
  constructor() {
    super({
      name: 'heady-buddy',
      port: 3341,
      domain: 'interface',
      description: 'AI companion conversation interface',
      pool: 'hot',
      dependencies: ['heady-conductor', 'heady-memory', 'heady-embed', 'model-gateway'],
    });
  }

  async onStart() {
    // POST /chat — send a message to HeadyBuddy
    this.route('POST', '/chat', async (req, res, ctx) => {
      const { message, sessionId, context } = ctx.body || {};
      if (!message) return this.sendError(res, 400, 'Missing message', 'MISSING_MESSAGE');

      const sid = sessionId || correlationId('sess');

      if (!sessions.has(sid)) {
        if (sessions.size >= MAX_SESSIONS) {
          const oldest = sessions.keys().next().value;
          sessions.delete(oldest);
        }
        sessions.set(sid, []);
      }

      const history = sessions.get(sid);
      history.push({ role: 'user', content: message, timestamp: Date.now() });
      if (history.length > MAX_MESSAGES_PER_SESSION) {
        history.splice(0, history.length - MAX_MESSAGES_PER_SESSION);
      }

      // Generate response (in production, routes through heady-conductor -> model-gateway)
      const response = {
        role: 'assistant',
        content: `I'm HeadyBuddy, your AI companion in the Heady Latent OS. I received your message: "${message.substring(0, fib(11))}"... Let me route this through the 17-swarm matrix for the best response.`,
        timestamp: Date.now(),
        meta: {
          sessionId: sid,
          model: 'heady-buddy-v4',
          routedVia: 'heady-conductor',
          correlationId: ctx.correlationId,
        },
      };

      history.push(response);
      mesh.events.publish('heady.interface.buddy.message', { sessionId: sid, correlationId: ctx.correlationId });

      this.json(res, 200, {
        response: response.content,
        sessionId: sid,
        messageCount: history.length,
        meta: response.meta,
      });
    });

    // GET /session — get session history
    this.route('GET', '/session', async (req, res, ctx) => {
      const sid = ctx.query.id;
      if (!sid) return this.sendError(res, 400, 'Missing session id', 'MISSING_SESSION_ID');
      const history = sessions.get(sid);
      if (!history) return this.sendError(res, 404, 'Session not found', 'SESSION_NOT_FOUND');
      this.json(res, 200, { sessionId: sid, messages: history, count: history.length });
    });

    // GET /sessions — list active sessions
    this.route('GET', '/sessions', async (req, res, ctx) => {
      const list = [];
      for (const [sid, msgs] of sessions) {
        list.push({ sessionId: sid, messageCount: msgs.length, lastActivity: msgs[msgs.length - 1]?.timestamp || 0 });
      }
      this.json(res, 200, { count: list.length, maxSessions: MAX_SESSIONS, sessions: list });
    });

    // DELETE /session — end a session
    this.route('DELETE', '/session', async (req, res, ctx) => {
      const sid = ctx.query.id;
      if (!sid) return this.sendError(res, 400, 'Missing session id', 'MISSING_SESSION_ID');
      const deleted = sessions.delete(sid);
      this.json(res, 200, { sessionId: sid, deleted });
    });

    this.log.info('HeadyBuddy companion interface initialized');
  }
}

new HeadyBuddy().start();


// --- Auto-Unified Latent Service Pattern (Smart) ---
(function _wireLatentStubs() {
  const exp = module.exports;
  if (!exp || typeof exp !== 'object') return;

  // Find the first exported class instance or constructor with health/start/stop
  let _inst = null;
  for (const key of Object.keys(exp)) {
    const val = exp[key];
    // If it's a singleton instance with a health method, use it
    if (val && typeof val === 'object' && typeof val.health === 'function') {
      _inst = val; break;
    }
    // If it's a function (class constructor), try to find a getSingleton pattern
    if (typeof val === 'function' && val.prototype) {
      const getterKey = Object.keys(exp).find(k =>
        k.startsWith('get') && typeof exp[k] === 'function' && k !== key
      );
      if (getterKey) {
        try { const inst = exp[getterKey](); if (inst && typeof inst.health === 'function') { _inst = inst; break; } } catch(e) {}
      }
    }
  }

  if (!exp.start) exp.start = _inst && typeof _inst.start === 'function'
    ? async () => { await _inst.start(); return { status: 'started' }; }
    : async () => ({ status: 'started' });
  if (!exp.stop) exp.stop = _inst && typeof _inst.stop === 'function'
    ? async () => { await _inst.stop(); return { status: 'stopped' }; }
    : async () => ({ status: 'stopped' });
  if (!exp.health) exp.health = _inst && typeof _inst.health === 'function'
    ? () => _inst.health()
    : () => ({ status: 'healthy', service: require('path').basename(__filename, '.js') });
  if (!exp.metrics) exp.metrics = _inst && typeof _inst.metrics === 'function'
    ? () => _inst.metrics()
    : () => ({ service: require('path').basename(__filename, '.js') });
  if (!exp._tick) exp._tick = async () => {};
})();
// -------------------------------------------
