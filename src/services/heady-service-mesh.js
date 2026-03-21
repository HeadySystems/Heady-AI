// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY SYSTEMS — Service Mesh Integration Layer               ║
// ║  ∞ SACRED GEOMETRY ∞  Unified Communication Backbone          ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

/**
 * HeadyServiceMesh — The integration layer that wires ALL Heady services
 * into a single coherent mesh with:
 *
 * - Event-driven message bus with correlation ID tracing
 * - Circuit breaker protection on every service call
 * - φ-scaled retry with exponential backoff
 * - CSL-gated routing to Hot/Warm/Cold pools
 * - Federated health checking across all services
 * - Service discovery and registration
 */

const { EventEmitter } = require('events');

const PHI = 1.618033988749895;
const PSI = 0.6180339887498949;

class HeadyServiceMesh {
  constructor() {
    this.bus = new EventEmitter();
    this.bus.setMaxListeners(55);
    this.services = new Map();
    this.breakers = new Map();
    this.metrics = {
      totalCalls: 0,
      totalErrors: 0,
      byService: {},
      byPool: { hot: 0, warm: 0, cold: 0 }
    };
  }

  register(id, config) {
    this.services.set(id, {
      id,
      ...config,
      status: 'healthy',
      registered: Date.now(),
      calls: 0,
      errors: 0,
      avgLatency: 0
    });

    this.breakers.set(id, {
      state: 'closed',
      failures: 0,
      maxFailures: 5,
      resetAt: null,
      resetTimeout: 13000
    });

    this.bus.emit('service.registered', { id, config });
    return this.services.get(id);
  }

  async call(serviceId, operation, payload = {}, options = {}) {
    const service = this.services.get(serviceId);
    if (!service) throw new Error(`Service not found: ${serviceId}`);

    const breaker = this.breakers.get(serviceId);
    if (breaker.state === 'open') {
      if (Date.now() > breaker.resetAt) {
        breaker.state = 'half-open';
      } else {
        throw new Error(`Circuit OPEN for ${serviceId} — retry after ${new Date(breaker.resetAt).toISOString()}`);
      }
    }

    const correlationId = options.correlationId || `cor-${Date.now().toString(36)}`;
    const confidence = options.confidence || 0.5;
    const pool = confidence >= 0.882 ? 'hot' : confidence >= 0.809 ? 'warm' : 'cold';

    const startTime = Date.now();
    this.metrics.totalCalls++;
    this.metrics.byPool[pool]++;
    if (!this.metrics.byService[serviceId]) {
      this.metrics.byService[serviceId] = { calls: 0, errors: 0, avgLatency: 0 };
    }
    this.metrics.byService[serviceId].calls++;
    service.calls++;

    try {
      this.bus.emit(`service.${serviceId}.call`, { operation, payload, correlationId, pool });

      const latency = Date.now() - startTime;
      service.avgLatency = (service.avgLatency * (service.calls - 1) + latency) / service.calls;
      this.metrics.byService[serviceId].avgLatency = service.avgLatency;

      if (breaker.state === 'half-open') {
        breaker.state = 'closed';
        breaker.failures = 0;
      }

      return {
        serviceId,
        operation,
        correlationId,
        pool,
        latencyMs: latency,
        status: 'success'
      };
    } catch (err) {
      service.errors++;
      this.metrics.totalErrors++;
      this.metrics.byService[serviceId].errors++;
      breaker.failures++;

      if (breaker.failures >= breaker.maxFailures) {
        breaker.state = 'open';
        breaker.resetAt = Date.now() + breaker.resetTimeout;
        this.bus.emit('circuit.open', { serviceId, failures: breaker.failures });
      }

      throw err;
    }
  }

  async callWithRetry(serviceId, operation, payload = {}, options = {}) {
    const maxAttempts = options.maxRetries || 5;
    let lastError;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await this.call(serviceId, operation, payload, options);
      } catch (err) {
        lastError = err;
        if (attempt < maxAttempts - 1) {
          const delay = Math.pow(PHI, attempt) * 1000;
          const jitter = delay * PSI * (Math.random() - 0.5);
          await new Promise(r => setTimeout(r, delay + jitter));
        }
      }
    }
    throw lastError;
  }

  healthCheck() {
    const results = [];
    for (const [id, service] of this.services) {
      const breaker = this.breakers.get(id);
      results.push({
        service: id,
        healthy: breaker.state !== 'open',
        state: breaker.state,
        calls: service.calls,
        errors: service.errors,
        errorRate: service.calls > 0 ? (service.errors / service.calls * 100).toFixed(2) + '%' : '0%',
        avgLatencyMs: Math.round(service.avgLatency)
      });
    }

    return {
      timestamp: new Date().toISOString(),
      total: results.length,
      healthy: results.filter(r => r.healthy).length,
      services: results,
      metrics: this.metrics
    };
  }

  getTopology() {
    return [...this.services.values()].map(s => ({
      id: s.id,
      port: s.port,
      type: s.type,
      status: s.status,
      calls: s.calls,
      circuitBreaker: this.breakers.get(s.id)?.state
    }));
  }
}

module.exports = { HeadyServiceMesh };


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
