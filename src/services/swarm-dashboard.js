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
// ║  FILE: src/services/swarm-dashboard.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * T8: Swarm Optimization Dashboard Service
 * @module src/services/swarm-dashboard
 */
'use strict';

class SwarmDashboard {
    constructor() {
        this._runs = [];
        this._bestConfig = null;
    }

    recordRun(config, metrics) {
        const run = {
            id: `run_${Date.now()}`,
            timestamp: new Date().toISOString(),
            config,
            metrics, // { score, latency, cost, tokens }
            confidence: this._computeConfidence(metrics),
        };
        this._runs.push(run);
        if (!this._bestConfig || metrics.score > this._bestConfig.metrics.score) {
            this._bestConfig = run;
        }
        return run;
    }

    _computeConfidence(metrics) {
        if (this._runs.length < 3) return 0.3;
        const scores = this._runs.slice(-10).map(r => r.metrics.score);
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length;
        return Math.max(0, Math.min(1, 1 - Math.sqrt(variance)));
    }

    getExplorationTree() {
        return {
            totalRuns: this._runs.length,
            bestConfig: this._bestConfig,
            recentRuns: this._runs.slice(-20),
            convergence: this._computeConfidence(this._bestConfig?.metrics || {}),
            explorationRate: Math.max(0.1, 1 - this._runs.length / 100),
        };
    }

    getSummary() {
        if (this._runs.length === 0) return { status: 'no_data' };
        const scores = this._runs.map(r => r.metrics.score);
        return {
            totalRuns: this._runs.length,
            bestScore: Math.max(...scores),
            avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
            worstScore: Math.min(...scores),
            bestConfig: this._bestConfig?.config,
            convergenceConfidence: this._computeConfidence(this._bestConfig?.metrics || {}),
        };
    }

    // Express routes
    routes(router) {
        router.get('/swarm/dashboard', (req, res) => res.json(this.getSummary()));
        router.get('/swarm/tree', (req, res) => res.json(this.getExplorationTree()));
        router.post('/swarm/run', (req, res) => {
            const { config, metrics } = req.body;
            res.json(this.recordRun(config, metrics));
        });
        return router;
    }
}

module.exports = SwarmDashboard;


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
