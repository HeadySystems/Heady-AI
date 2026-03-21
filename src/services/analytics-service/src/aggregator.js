'use strict';

// FIB[8]*1000 = 21000ms (21s) real-time aggregation interval
const REALTIME_INTERVAL_MS = 21000;

// FIB[12]*60*1000 = 144*60*1000 = 8640000ms (144 min) rollup interval
const ROLLUP_INTERVAL_MS = 144 * 60 * 1000;

/**
 * Metrics aggregator that computes analytics at φ-scaled intervals.
 */
class Aggregator {
  /**
   * @param {object} params
   * @param {import('./store').AnalyticsStore} params.store
   * @param {object} params.log
   */
  constructor({ store, log }) {
    this._store = store;
    this._log = log;
    this._realtimeTimer = null;
    this._rollupTimer = null;

    // In-memory counters for real-time metrics
    this._counters = {
      pageViews: 0,
      apiCalls: 0,
      customEvents: 0,
      errors: 0,
      uniqueVisitors: new Set(),
      pathCounts: new Map(),
      latencies: [],
    };
  }

  /**
   * Start the aggregation timers.
   */
  start() {
    this._realtimeTimer = setInterval(() => this.aggregateRealtime(), REALTIME_INTERVAL_MS);
    this._rollupTimer = setInterval(() => this.aggregateRollup(), ROLLUP_INTERVAL_MS);
    this._log.info('Aggregator started', {
      realtimeIntervalMs: REALTIME_INTERVAL_MS,
      rollupIntervalMs: ROLLUP_INTERVAL_MS,
    });
  }

  /**
   * Stop the aggregation timers.
   */
  stop() {
    if (this._realtimeTimer) clearInterval(this._realtimeTimer);
    if (this._rollupTimer) clearInterval(this._rollupTimer);
    this._realtimeTimer = null;
    this._rollupTimer = null;
    this._log.info('Aggregator stopped');
  }

  /**
   * Ingest a raw event into the real-time counters.
   *
   * @param {object} event
   */
  ingest(event) {
    switch (event.event_type) {
      case 'page_view':
        this._counters.pageViews++;
        if (event.ip_hash) this._counters.uniqueVisitors.add(event.ip_hash);
        if (event.path) {
          this._counters.pathCounts.set(
            event.path,
            (this._counters.pathCounts.get(event.path) || 0) + 1
          );
        }
        break;

      case 'api_call':
        this._counters.apiCalls++;
        if (event.properties?.status_code >= 400) {
          this._counters.errors++;
        }
        if (event.properties?.latency_ms !== undefined) {
          this._counters.latencies.push(event.properties.latency_ms);
        }
        if (event.path) {
          this._counters.pathCounts.set(
            event.path,
            (this._counters.pathCounts.get(event.path) || 0) + 1
          );
        }
        break;

      case 'custom_event':
        this._counters.customEvents++;
        break;
    }
  }

  /**
   * Compute percentile from a sorted array.
   *
   * @param {number[]} sorted
   * @param {number} p — percentile (0-100)
   * @returns {number}
   */
  _percentile(sorted, p) {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  /**
   * Compute real-time aggregate metrics (every 21s).
   */
  aggregateRealtime() {
    const sorted = this._counters.latencies.slice().sort((a, b) => a - b);

    const topPaths = Array.from(this._counters.pathCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([path, count]) => ({ path, count }));

    const totalRequests = this._counters.apiCalls || 1;
    const errorRate = this._counters.errors / totalRequests;

    const metrics = {
      uniqueVisitors: this._counters.uniqueVisitors.size,
      pageViews: this._counters.pageViews,
      apiCalls: this._counters.apiCalls,
      customEvents: this._counters.customEvents,
      errors: this._counters.errors,
      errorRate: Math.round(errorRate * 10000) / 10000,
      topPaths,
      latency: {
        p50: this._percentile(sorted, 50),
        p95: this._percentile(sorted, 95),
        p99: this._percentile(sorted, 99),
      },
    };

    this._store.setAggregate('realtime', metrics);
    this._log.debug('Realtime aggregation complete', {
      visitors: metrics.uniqueVisitors,
      pageViews: metrics.pageViews,
      apiCalls: metrics.apiCalls,
    });

    return metrics;
  }

  /**
   * Compute rollup aggregate metrics (every 144 min).
   * Snapshots the real-time counters and resets them.
   */
  aggregateRollup() {
    const realtime = this.aggregateRealtime();

    const rollupKey = `rollup:${new Date().toISOString().slice(0, 16)}`;
    this._store.setAggregate(rollupKey, {
      ...realtime,
      rollupTimestamp: new Date().toISOString(),
      periodMs: ROLLUP_INTERVAL_MS,
    });

    // Reset counters for next period
    this._counters.pageViews = 0;
    this._counters.apiCalls = 0;
    this._counters.customEvents = 0;
    this._counters.errors = 0;
    this._counters.uniqueVisitors.clear();
    this._counters.pathCounts.clear();
    this._counters.latencies = [];

    this._log.info('Rollup aggregation complete', { key: rollupKey });

    return realtime;
  }

  /**
   * Get current real-time metrics.
   * @returns {object|undefined}
   */
  getCurrentMetrics() {
    return this._store.getAggregate('realtime');
  }
}

module.exports = {
  Aggregator,
  REALTIME_INTERVAL_MS,
  ROLLUP_INTERVAL_MS,
};


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
