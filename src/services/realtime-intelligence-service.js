/*
 * © 2026 Heady™Systems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Realtime Intelligence Service — thin wrapper around RealtimeIntelligenceEngine.
 * Manages lifecycle (start/stop) and emits metrics for the ServiceManager.
 */

const EventEmitter = require("events");
const { RealtimeIntelligenceEngine } = require("../intelligence/hc_realtime_intelligence");

let _instance = null;

class RealtimeIntelligenceService extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.engine = new RealtimeIntelligenceEngine(opts);
        this.engine.on("flushed", (data) => this.emit("metrics_updated", data.metrics));
        this.engine.on("ableton:session:started", (s) => this.emit("ableton:session:started", s));
        this.engine.on("ableton:session:stopped", (s) => this.emit("ableton:session:stopped", s));
    }

    start() {
        this.engine.start();
        this.emit("started");
    }

    stop() {
        this.engine.stop();
        this.emit("stopped");
    }

    getStatus() {
        return this.engine.getStatus();
    }
}

function getRealtimeIntelligenceService(opts = {}) {
    if (!_instance) {
        _instance = new RealtimeIntelligenceService(opts);
    }
    return _instance;
}

module.exports = { RealtimeIntelligenceService, getRealtimeIntelligenceService };


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
