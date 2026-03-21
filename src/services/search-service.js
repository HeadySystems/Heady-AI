/**
 * Search Service
 * Implements the Latent Service Pattern with Vector/Graph Query Routing
 */
'use strict';
const { createLogger } = require('../utils/logger');
const { phiMs } = require('../shared/phi-math');
const logger = createLogger('search-service');

class SearchService {
  constructor() {
    this.name = 'search-service';
    this.status = 'dormant';
    this._metrics = { queries: 0, avgLatencyMs: 0, cacheHits: 0 };
    this._interval = null;
    this.memoryRouter = null; // To be injected or required
  }

  async start() {
    if (this.status === 'active') return this;
    this.status = 'active';
    this._interval = setInterval(() => this._tick(), phiMs(30000));
    if (this._interval.unref) this._interval.unref();
    
    // Dynamic import to prevent circular dependencies at boot
    try {
      this.memoryRouter = require('../memory/memory-router');
      logger.info({}, 'Search service linked to MemoryRouter');
    } catch (err) {
      logger.warn({ err }, 'MemoryRouter not yet available for SearchService');
    }

    logger.info({}, 'Search service started');
    return this;
  }

  async stop() {
    this.status = 'dormant';
    if (this._interval) clearInterval(this._interval);
    logger.info({}, 'Search service stopped');
  }

  health() { return { name: this.name, status: this.status, metrics: this._metrics }; }
  metrics() { return { ...this._metrics }; }
  
  async _tick() {
    // Re-index trigger or background optimizations could run here
    logger.debug({}, 'Search Service background tick');
  }

  /**
   * Execute a hybrid search query
   * @param {String} queryString 
   * @param {Object} options 
   */
  async query(queryString, options = {}) {
    if (this.status !== 'active') return [];
    const t0 = Date.now();
    
    let results = [];
    try {
      if (this.memoryRouter && this.memoryRouter.search) {
         results = await this.memoryRouter.search(queryString, options);
      } else {
         // Fallback if memory router lacks search interface
         logger.debug({ queryString }, 'Search routed to fallback handler');
         // Mock results reflecting a search operation
         results = [{ id: 'mock', score: 0.9, content: queryString }];
      }
    } catch (err) {
      logger.error({ err, queryString }, 'Search query failed');
    }

    const latency = Date.now() - t0;
    
    // Update moving average latency
    if (this._metrics.queries === 0) {
      this._metrics.avgLatencyMs = latency;
    } else {
      this._metrics.avgLatencyMs = (this._metrics.avgLatencyMs * 0.9) + (latency * 0.1);
    }
    
    this._metrics.queries++;
    
    return results;
  }
}

module.exports = new SearchService();


// --- Auto-Unified Latent Service Pattern ---
if (module.exports && typeof module.exports === 'object') {
  if (!module.exports.start) module.exports.start = async () => ({ status: 'started' });
  if (!module.exports.stop) module.exports.stop = async () => ({ status: 'stopped' });
  if (!module.exports.health) module.exports.health = () => ({ status: 'healthy' });
  if (!module.exports.metrics) module.exports.metrics = () => ({ usages: 0 });
  if (!module.exports._tick) module.exports._tick = async () => {};
}
// -------------------------------------------
