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
// ║  FILE: src/infrastructure/service-connector.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Heady Service Connector
 * Unified connection manager for all external services
 * Provides connection pooling, circuit breaking, and health monitoring
 */

const PHI = 1.618033988749895;
const PSI = 0.6180339887498949;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000 * PHI;
    this.state = 'CLOSED';
    this.failures = 0;
    this.lastFailure = null;
    this.halfOpenAttempts = 0;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.halfOpenAttempts = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      if (this.state === 'HALF_OPEN') this.state = 'CLOSED';
      this.failures = 0;
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailure = Date.now();
      if (this.failures >= this.failureThreshold) this.state = 'OPEN';
      throw error;
    }
  }
}

class ServiceConnector {
  constructor() {
    this.connections = new Map();
    this.breakers = new Map();
  }

  register(name, connector) {
    this.connections.set(name, connector);
    this.breakers.set(name, new CircuitBreaker());
  }

  async call(serviceName, operation, ...args) {
    const connector = this.connections.get(serviceName);
    if (!connector) throw new Error(`Service ${serviceName} not registered`);
    
    const breaker = this.breakers.get(serviceName);
    return breaker.execute(() => connector[operation](...args));
  }

  getStatus() {
    const status = {};
    for (const [name, breaker] of this.breakers) {
      status[name] = { state: breaker.state, failures: breaker.failures };
    }
    return status;
  }
}

// Singleton
const connector = new ServiceConnector();
module.exports = { ServiceConnector, CircuitBreaker, connector };
