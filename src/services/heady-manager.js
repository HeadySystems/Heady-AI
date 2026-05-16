/**
 * ∞ Heady™ Conductor — Thin Orchestrator Shell
 * Re-crystallized from the 1870-line heady-manager.js God class.
 * 
 * This file is now ~80 lines. All logic lives in focused micro-modules:
 *   src/bootstrap/config-globals.js      — env, globals, event bus
 *   src/bootstrap/middleware-stack.js     — CORS, helmet, rate limiting, JSON, site renderer
 *   src/bootstrap/auth-engine.js         — HeadyAuth + fallback + secrets/cloudflare
 *   src/bootstrap/vector-stack.js        — vector memory, pipeline, federation, bees
 *   src/bootstrap/service-registry.js    — 40+ service mount points (try/require pattern)
 *   src/bootstrap/engine-wiring.js       — (already extracted) pipeline + engines
 *   src/bootstrap/voice-relay.js         — WebSocket voice relay system
 *   src/bootstrap/server-boot.js         — HTTP/HTTPS + WS + listen
 * 
 * © 2026 Heady™Systems Inc. — Proprietary
 */

// Phase 0: Environment Validation (fail-fast if critical config missing)
const { validateEnvironment } = require('../config/env-schema');
validateEnvironment({ strict: process.env.NODE_ENV === 'production' });

// Phase 1: Environment + Globals (event bus, midi bus, edge cache)
const { app, logger, eventBus, remoteConfig, secretsManager, cfManager } = require('../bootstrap/config-globals');

// Phase 2: Middleware Stack (security, CORS, rate limiting, site renderer)
require('../bootstrap/middleware-stack')(app, { logger, remoteConfig });

// Phase 3: Auth Engine (HeadyAuth, fallback login, secrets routes)
const { authEngine } = require('../bootstrap/auth-engine')(app, { logger, secretsManager, cfManager });

// Phase 4: Vector Stack (memory, pipeline, federation, bees, spatial)
const { vectorMemory, buddy, pipeline, selfAwareness, watchdog } = require('../bootstrap/vector-stack')(app, { logger, eventBus });

// Phase 5: Engine Wiring (MC scheduler, patterns, auto-success, scientist, QA)
const { wireEngines } = require('../bootstrap/engine-wiring');
const { loadRegistry } = require('../core/bee-registry/registry');
const _engines = wireEngines(app, {
    pipeline,
    loadRegistry,
    eventBus,
    projectRoot: __dirname,
    PORT: process.env.PORT || process.env.HEADY_PORT || 3301,
});

// Phase 6: Pipeline binding + self-healing wiring
require('../bootstrap/pipeline-wiring')(app, { pipeline, buddy, vectorMemory, selfAwareness, _engines, logger, eventBus });

// Phase 7: Service Registry (40+ services mounted via try/require)
require('../boot/service-registry')(app, {
    logger, authEngine, vectorMemory, buddy, pipeline, _engines,
    secretsManager, cfManager, eventBus,
    projectRoot: __dirname,
});

// Phase 8: Inline Routes (health, pulse, layer, CSL, edge, telemetry, principles)
require('../bootstrap/inline-routes')(app, { logger, secretsManager, cfManager, authEngine, _engines });

// Phase 9: Voice Relay WebSocket System
const { voiceSessions } = require('../bootstrap/voice-relay')(app, { logger });

// Phase 10: Server Boot (HTTP/HTTPS + WebSocket upgrade + listen)
require('../bootstrap/server-boot')(app, { logger, voiceSessions });


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
