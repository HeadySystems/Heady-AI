/**
 * @fileoverview Service Mesh — Discovery, Routing, and Circuit Breaking for Heady Ecosystem
 * @description Service discovery with health tracking, CSL-scored capability matching,
 * circuit breakers with phi-backoff, and dependency graph with cycle detection.
 * @module service-mesh
 */

'use strict';

const {
  PHI, PSI, PHI_SQUARED, FIB, CSL, CSL_ERROR_CODES, CIRCUIT_BREAKER,
  SACRED_GEOMETRY, INTERVALS, phiBackoff, correlationId, structuredLog,
} = require('./phi-constants');

// ─── CIRCUIT BREAKER ─────────────────────────────────────────────────────────

/**
 * @enum {string} CircuitState
 */
const CircuitState = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
};

/**
 * @class PhiCircuitBreaker
 * @description Circuit breaker with phi-exponential backoff and adaptive thresholds
 */
class PhiCircuitBreaker {
  /**
   * @param {string} serviceId - Target service identifier
   * @param {Object} [opts={}]
   */
  constructor(serviceId, opts = {}) {
    this.serviceId = serviceId;
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenAttempts = 0;
    this.lastFailureTime = 0;
    this.openedAt = 0;
    this.failureThreshold = opts.failureThreshold || CIRCUIT_BREAKER.FAILURE_THRESHOLD;
    this.successThreshold = opts.successThreshold || CIRCUIT_BREAKER.SUCCESS_THRESHOLD;
    this.halfOpenMax = opts.halfOpenMax || CIRCUIT_BREAKER.HALF_OPEN_MAX;
    this.resetTimeoutMs = opts.resetTimeoutMs || CIRCUIT_BREAKER.RESET_TIMEOUT_MS;
    this._attempt = 0;
  }

  /**
   * Check if a request can proceed
   * @returns {boolean}
   */
  canExecute() {
    if (this.state === CircuitState.CLOSED) return true;
    if (this.state === CircuitState.OPEN) {
      const elapsed = Date.now() - this.openedAt;
      const backoff = phiBackoff(this._attempt, this.resetTimeoutMs);
      if (elapsed >= backoff) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenAttempts = 0;
        return true;
      }
      return false;
    }
    // HALF_OPEN
    return this.halfOpenAttempts < this.halfOpenMax;
  }

  /**
   * Record a successful call
   */
  recordSuccess() {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this._attempt = 0;
      }
    } else {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  /**
   * Record a failed call
   */
  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.openedAt = Date.now();
      this._attempt++;
    } else if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.openedAt = Date.now();
      this._attempt++;
    }
  }

  /**
   * Get circuit breaker status
   * @returns {Object}
   */
  status() {
    return {
      serviceId: this.serviceId,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      attempt: this._attempt,
    };
  }
}

// ─── SERVICE RECORD ──────────────────────────────────────────────────────────

/**
 * @typedef {Object} ServiceRecord
 * @property {string} id - Unique service ID
 * @property {string} name - Human-readable name
 * @property {string} type - Service type (node, agent, tool, swarm, workflow)
 * @property {string} ring - Sacred geometry ring position
 * @property {string[]} capabilities - Service capabilities
 * @property {string} endpoint - Service endpoint URL
 * @property {number} coherence - Current CSL coherence score
 * @property {string} status - 'healthy' | 'degraded' | 'down'
 * @property {number} registeredAt - Registration timestamp
 * @property {number} lastHealthCheck - Last health check timestamp
 * @property {Object} metadata - Additional metadata
 */

// ─── DEPENDENCY GRAPH ────────────────────────────────────────────────────────

/**
 * @class DependencyGraph
 * @description Directed graph of service dependencies with cycle detection
 */
class DependencyGraph {
  constructor() {
    /** @private {Map<string, Set<string>>} adjacency list */
    this._edges = new Map();
  }

  /**
   * Add a service node
   * @param {string} serviceId
   */
  addNode(serviceId) {
    if (!this._edges.has(serviceId)) {
      this._edges.set(serviceId, new Set());
    }
  }

  /**
   * Add a dependency edge (from depends on to)
   * @param {string} from - Dependent service
   * @param {string} to - Dependency service
   * @returns {boolean} False if adding would create a cycle
   */
  addEdge(from, to) {
    this.addNode(from);
    this.addNode(to);
    // Check if adding this edge would create a cycle
    if (this._hasPath(to, from)) return false;
    this._edges.get(from).add(to);
    return true;
  }

  /**
   * Remove a dependency edge
   * @param {string} from
   * @param {string} to
   */
  removeEdge(from, to) {
    const deps = this._edges.get(from);
    if (deps) deps.delete(to);
  }

  /**
   * Remove a service node and all its edges
   * @param {string} serviceId
   */
  removeNode(serviceId) {
    this._edges.delete(serviceId);
    for (const deps of this._edges.values()) {
      deps.delete(serviceId);
    }
  }

  /**
   * Get all dependencies of a service
   * @param {string} serviceId
   * @returns {string[]}
   */
  getDependencies(serviceId) {
    const deps = this._edges.get(serviceId);
    return deps ? Array.from(deps) : [];
  }

  /**
   * Get all dependents (reverse dependencies) of a service
   * @param {string} serviceId
   * @returns {string[]}
   */
  getDependents(serviceId) {
    const dependents = [];
    for (const [node, deps] of this._edges.entries()) {
      if (deps.has(serviceId)) dependents.push(node);
    }
    return dependents;
  }

  /**
   * Detect all cycles in the graph
   * @returns {string[][]} Array of cycles, each as array of service IDs
   */
  detectCycles() {
    const visited = new Set();
    const recStack = new Set();
    const cycles = [];

    for (const node of this._edges.keys()) {
      if (!visited.has(node)) {
        this._detectCycleDFS(node, visited, recStack, [], cycles);
      }
    }
    return cycles;
  }

  /**
   * Topological sort of services
   * @returns {string[]} Sorted service IDs
   * @throws {Error} If graph has cycles
   */
  topologicalSort() {
    const inDegree = new Map();
    for (const node of this._edges.keys()) {
      if (!inDegree.has(node)) inDegree.set(node, 0);
    }
    for (const deps of this._edges.values()) {
      for (const dep of deps) {
        inDegree.set(dep, (inDegree.get(dep) || 0) + 1);
      }
    }

    const queue = [];
    for (const [node, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(node);
    }

    const sorted = [];
    while (queue.length > 0) {
      const node = queue.shift();
      sorted.push(node);
      const deps = this._edges.get(node);
      if (deps) {
        for (const dep of deps) {
          const newDeg = inDegree.get(dep) - 1;
          inDegree.set(dep, newDeg);
          if (newDeg === 0) queue.push(dep);
        }
      }
    }

    if (sorted.length !== this._edges.size) {
      throw new Error(`${CSL_ERROR_CODES.E_PIPELINE_FAILED.code}: Dependency graph contains cycles`);
    }
    return sorted;
  }

  /**
   * BFS path check
   * @private
   */
  _hasPath(from, to) {
    const visited = new Set();
    const queue = [from];
    while (queue.length > 0) {
      const node = queue.shift();
      if (node === to) return true;
      if (visited.has(node)) continue;
      visited.add(node);
      const deps = this._edges.get(node);
      if (deps) {
        for (const dep of deps) queue.push(dep);
      }
    }
    return false;
  }

  /**
   * DFS cycle detection
   * @private
   */
  _detectCycleDFS(node, visited, recStack, path, cycles) {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    const deps = this._edges.get(node);
    if (deps) {
      for (const dep of deps) {
        if (!visited.has(dep)) {
          this._detectCycleDFS(dep, visited, recStack, [...path], cycles);
        } else if (recStack.has(dep)) {
          const cycleStart = path.indexOf(dep);
          if (cycleStart !== -1) {
            cycles.push(path.slice(cycleStart).concat(dep));
          }
        }
      }
    }
    recStack.delete(node);
  }

  /**
   * Get the full graph as adjacency list
   * @returns {Object}
   */
  toJSON() {
    const result = {};
    for (const [node, deps] of this._edges.entries()) {
      result[node] = Array.from(deps);
    }
    return result;
  }
}

// ─── SERVICE MESH ────────────────────────────────────────────────────────────

/**
 * @class ServiceMesh
 * @description Service discovery, capability routing, and circuit breaking mesh
 */
class ServiceMesh {
  /**
   * @param {Object} [config={}]
   * @param {number} [config.healthCheckIntervalMs] - Health check interval
   * @param {number} [config.staleThresholdMs] - Stale service threshold
   */
  constructor(config = {}) {
    /** @private */
    this._config = {
      healthCheckIntervalMs: config.healthCheckIntervalMs || INTERVALS.HEALTH_CHECK,
      staleThresholdMs: config.staleThresholdMs || INTERVALS.DEEP_SCAN * PHI,
    };

    /** @private {Map<string, ServiceRecord>} */
    this._services = new Map();

    /** @private {Map<string, PhiCircuitBreaker>} */
    this._breakers = new Map();

    /** @private */
    this._graph = new DependencyGraph();

    /** @private */
    this._healthTimer = null;
    this._running = false;
    this._corrId = correlationId('mesh');

    /** @private */
    this._stats = {
      registrations: 0,
      deregistrations: 0,
      routingRequests: 0,
      circuitOpens: 0,
      healthChecks: 0,
    };
  }

  /**
   * Start the service mesh
   * @returns {Promise<void>}
   */
  async start() {
    if (this._running) return;
    this._running = true;
    this._healthTimer = setInterval(() => this._runHealthChecks(), this._config.healthCheckIntervalMs);
  }

  /**
   * Stop the service mesh
   * @returns {Promise<void>}
   */
  async stop() {
    this._running = false;
    if (this._healthTimer) {
      clearInterval(this._healthTimer);
      this._healthTimer = null;
    }
  }

  /**
   * Register a service
   * @param {Object} descriptor - Service descriptor
   * @param {string} descriptor.id - Service ID
   * @param {string} descriptor.name - Service name
   * @param {string} descriptor.type - Service type
   * @param {string} descriptor.ring - Sacred geometry ring
   * @param {string[]} descriptor.capabilities - Capabilities
   * @param {string} descriptor.endpoint - Endpoint URL
   * @param {string[]} [descriptor.dependencies] - Dependency IDs
   * @param {Object} [descriptor.metadata] - Extra metadata
   * @returns {ServiceRecord}
   */
  register(descriptor) {
    const record = {
      id: descriptor.id,
      name: descriptor.name,
      type: descriptor.type || 'service',
      ring: descriptor.ring || 'OUTER_RING',
      capabilities: descriptor.capabilities || [],
      endpoint: descriptor.endpoint,
      coherence: CSL.HIGH,
      status: 'healthy',
      registeredAt: Date.now(),
      lastHealthCheck: Date.now(),
      metadata: descriptor.metadata || {},
    };

    this._services.set(record.id, record);
    this._breakers.set(record.id, new PhiCircuitBreaker(record.id));
    this._graph.addNode(record.id);

    // Register dependencies
    if (descriptor.dependencies) {
      for (const dep of descriptor.dependencies) {
        this._graph.addEdge(record.id, dep);
      }
    }

    this._stats.registrations++;
    return record;
  }

  /**
   * Deregister a service
   * @param {string} serviceId
   */
  deregister(serviceId) {
    this._services.delete(serviceId);
    this._breakers.delete(serviceId);
    this._graph.removeNode(serviceId);
    this._stats.deregistrations++;
  }

  /**
   * Route to a service by capability with CSL scoring
   * @param {string} capability - Required capability
   * @param {number} [minCoherence] - Minimum CSL score
   * @returns {ServiceRecord|null} Best matching service or null
   */
  route(capability, minCoherence = CSL.MEDIUM) {
    this._stats.routingRequests++;
    const candidates = [];

    for (const [id, record] of this._services.entries()) {
      if (record.status === 'down') continue;
      if (record.coherence < minCoherence) continue;

      const breaker = this._breakers.get(id);
      if (!breaker || !breaker.canExecute()) continue;

      // Check capability match
      const hasCapability = record.capabilities.some(cap => {
        return cap === capability || cap.startsWith(capability + '.');
      });
      if (!hasCapability) continue;

      // Score: coherence * ring weight
      const ringConfig = SACRED_GEOMETRY[record.ring];
      const ringWeight = ringConfig ? ringConfig.weight : 1.0;
      const score = record.coherence * ringWeight * PSI;
      candidates.push({ record, score });
    }

    if (candidates.length === 0) return null;

    // Sort by score descending, return best
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].record;
  }

  /**
   * Route to multiple services by capability
   * @param {string} capability
   * @param {number} [maxResults] - Max results (default: FIB[5] = 5)
   * @param {number} [minCoherence]
   * @returns {ServiceRecord[]}
   */
  routeAll(capability, maxResults = FIB[5], minCoherence = CSL.LOW) {
    this._stats.routingRequests++;
    const candidates = [];

    for (const [id, record] of this._services.entries()) {
      if (record.status === 'down') continue;
      if (record.coherence < minCoherence) continue;

      const breaker = this._breakers.get(id);
      if (!breaker || !breaker.canExecute()) continue;

      const hasCapability = record.capabilities.some(cap =>
        cap === capability || cap.startsWith(capability + '.')
      );
      if (!hasCapability) continue;

      candidates.push(record);
    }

    return candidates.slice(0, maxResults);
  }

  /**
   * Record a successful call to a service
   * @param {string} serviceId
   */
  recordSuccess(serviceId) {
    const breaker = this._breakers.get(serviceId);
    if (breaker) breaker.recordSuccess();
  }

  /**
   * Record a failed call to a service
   * @param {string} serviceId
   */
  recordFailure(serviceId) {
    const breaker = this._breakers.get(serviceId);
    if (breaker) {
      breaker.recordFailure();
      if (breaker.state === CircuitState.OPEN) {
        this._stats.circuitOpens++;
      }
    }
  }

  /**
   * Get circuit breaker for a service
   * @param {string} serviceId
   * @returns {PhiCircuitBreaker|null}
   */
  getBreaker(serviceId) {
    return this._breakers.get(serviceId) || null;
  }

  /**
   * Get dependency graph
   * @returns {DependencyGraph}
   */
  getGraph() {
    return this._graph;
  }

  /**
   * Run health checks on all services
   * @private
   */
  _runHealthChecks() {
    const now = Date.now();
    for (const [id, record] of this._services.entries()) {
      // Mark stale services as degraded
      if (now - record.lastHealthCheck > this._config.staleThresholdMs) {
        record.status = 'degraded';
        record.coherence = Math.max(CSL.MINIMUM, record.coherence * PSI);
      }
      this._stats.healthChecks++;
    }
  }

  /**
   * Update service health from external check
   * @param {string} serviceId
   * @param {Object} healthResult
   * @param {string} healthResult.status
   * @param {number} healthResult.coherence
   */
  updateHealth(serviceId, healthResult) {
    const record = this._services.get(serviceId);
    if (!record) return;
    record.status = healthResult.status || record.status;
    record.coherence = healthResult.coherence != null ? healthResult.coherence : record.coherence;
    record.lastHealthCheck = Date.now();
  }

  /**
   * Get all registered services
   * @returns {ServiceRecord[]}
   */
  getServices() {
    return Array.from(this._services.values());
  }

  /**
   * Get a specific service
   * @param {string} serviceId
   * @returns {ServiceRecord|null}
   */
  getService(serviceId) {
    return this._services.get(serviceId) || null;
  }

  /**
   * Get health status of the mesh
   * @returns {Object}
   */
  health() {
    const services = this.getServices();
    const healthy = services.filter(s => s.status === 'healthy').length;
    const total = services.length;
    const avgCoherence = total > 0
      ? services.reduce((s, r) => s + r.coherence, 0) / total
      : 0;
    const cycles = this._graph.detectCycles();

    return {
      status: avgCoherence >= CSL.MEDIUM ? 'healthy' : 'degraded',
      coherence: parseFloat(avgCoherence.toFixed(FIB[4])),
      running: this._running,
      totalServices: total,
      healthyServices: healthy,
      degradedServices: services.filter(s => s.status === 'degraded').length,
      downServices: services.filter(s => s.status === 'down').length,
      circuitBreakers: {
        open: Array.from(this._breakers.values()).filter(b => b.state === CircuitState.OPEN).length,
        halfOpen: Array.from(this._breakers.values()).filter(b => b.state === CircuitState.HALF_OPEN).length,
        closed: Array.from(this._breakers.values()).filter(b => b.state === CircuitState.CLOSED).length,
      },
      dependencyCycles: cycles.length,
      stats: { ...this._stats },
      phi: PHI,
    };
  }
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

module.exports = {
  ServiceMesh,
  PhiCircuitBreaker,
  DependencyGraph,
  CircuitState,
};
