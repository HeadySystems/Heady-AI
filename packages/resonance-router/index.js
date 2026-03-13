// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  369-157-248 Resonance Router                                    ║
// ║  Topological Routing via Ternary Resonance Signatures            ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const crypto = require('crypto');

// ═══════════════════════════════════════════════════════════════════
// Resonance Constants
// ═══════════════════════════════════════════════════════════════════

const PHI = 1.618033988749895;
const PSI = 1 / PHI;

// 369-157-248 Resonance Signature Groups
const RESONANCE_GROUPS = Object.freeze({
  CONSTRUCTIVE:  { id: '369', digits: [3, 6, 9], role: 'constructive',  weight: PHI   },
  REALIGNMENT:   { id: '157', digits: [1, 5, 7], role: 'realignment',   weight: 1.0   },
  INTEGRATION:   { id: '248', digits: [2, 4, 8], role: 'integration',   weight: PSI   },
});

// Full resonance sequence
const RESONANCE_SEQUENCE = [3, 6, 9, 1, 5, 7, 2, 4, 8];

// ═══════════════════════════════════════════════════════════════════
// Ternary Logic for Routing Decisions
// ═══════════════════════════════════════════════════════════════════

const TernaryRouting = {
  // Quantize a routing signal to ternary {-1, 0, +1}
  quantize(value, threshold = PSI) {
    if (value > threshold) return 1;
    if (value < -threshold) return -1;
    return 0;
  },

  // Compute resonance between two ternary vectors
  resonance(a, b) {
    if (a.length !== b.length) return 0;
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum / a.length;
  },

  // Classify a digit into its resonance group
  classifyDigit(d) {
    d = Math.abs(d) % 10;
    if ([3, 6, 9].includes(d)) return RESONANCE_GROUPS.CONSTRUCTIVE;
    if ([1, 5, 7].includes(d)) return RESONANCE_GROUPS.REALIGNMENT;
    if ([2, 4, 8].includes(d)) return RESONANCE_GROUPS.INTEGRATION;
    return null; // 0 is neutral
  },
};

// ═══════════════════════════════════════════════════════════════════
// Route — A registered routing destination
// ═══════════════════════════════════════════════════════════════════

class Route {
  constructor(config) {
    this.id = config.id;
    this.target = config.target;
    this.resonanceSignature = config.resonanceSignature || this._computeSignature(config.id);
    this.priority = config.priority || 0;
    this.weight = config.weight || 1.0;
    this.healthy = true;
    this.lastRouted = 0;
    this.routeCount = 0;
  }

  _computeSignature(id) {
    const hash = crypto.createHash('md5').update(id).digest();
    return RESONANCE_SEQUENCE.map((_, i) => {
      const byte = hash[i % hash.length];
      return TernaryRouting.quantize((byte / 128) - 1);
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// ResonanceRouter — Main routing engine
// ═══════════════════════════════════════════════════════════════════

class ResonanceRouter {
  constructor(options = {}) {
    this.routes = new Map();
    this.defaultRoute = options.defaultRoute || null;
    this.routingHistory = [];
    this.maxHistory = options.maxHistory || 200;
    this.resonanceThreshold = options.resonanceThreshold || 0.3;
  }

  // Register a route
  register(config) {
    const route = new Route(config);
    this.routes.set(route.id, route);
    return route;
  }

  // Remove a route
  unregister(routeId) {
    return this.routes.delete(routeId);
  }

  // Mark a route as unhealthy
  markUnhealthy(routeId) {
    const route = this.routes.get(routeId);
    if (route) route.healthy = false;
  }

  // Mark a route as healthy
  markHealthy(routeId) {
    const route = this.routes.get(routeId);
    if (route) route.healthy = true;
  }

  // Compute the resonance signature of a message/task
  computeSignature(input) {
    const str = typeof input === 'string' ? input : JSON.stringify(input);
    const hash = crypto.createHash('sha256').update(str).digest();

    return RESONANCE_SEQUENCE.map((_, i) => {
      const byte = hash[i % hash.length];
      return TernaryRouting.quantize((byte / 128) - 1);
    });
  }

  // Classify a message into resonance groups
  classify(input) {
    const sig = this.computeSignature(input);
    const groups = { constructive: 0, realignment: 0, integration: 0 };

    for (let i = 0; i < sig.length; i++) {
      const digit = RESONANCE_SEQUENCE[i];
      const group = TernaryRouting.classifyDigit(digit);
      if (group && sig[i] !== 0) {
        groups[group.role] += sig[i] * group.weight;
      }
    }

    // Determine dominant group
    let dominant = 'realignment';
    let maxVal = -Infinity;
    for (const [role, val] of Object.entries(groups)) {
      if (Math.abs(val) > maxVal) {
        maxVal = Math.abs(val);
        dominant = role;
      }
    }

    return { signature: sig, groups, dominant };
  }

  // Route a message to the best matching destination
  route(input, options = {}) {
    const classification = this.classify(input);
    const inputSig = classification.signature;
    const candidates = [];

    for (const [, route] of this.routes) {
      if (!route.healthy && !options.includeUnhealthy) continue;

      const resonance = TernaryRouting.resonance(inputSig, route.resonanceSignature);
      const score = resonance * route.weight + route.priority * 0.1;

      if (resonance >= this.resonanceThreshold || options.forceRoute) {
        candidates.push({ route, resonance, score });
      }
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    const selected = candidates[0] || null;

    const result = {
      id: crypto.randomBytes(6).toString('hex'),
      timestamp: Date.now(),
      classification,
      selected: selected ? {
        routeId: selected.route.id,
        target: selected.route.target,
        resonance: selected.resonance,
        score: selected.score,
      } : null,
      candidateCount: candidates.length,
      fallback: !selected && this.defaultRoute ? this.defaultRoute : null,
    };

    // Update route stats
    if (selected) {
      selected.route.lastRouted = Date.now();
      selected.route.routeCount++;
    }

    // Record history
    this.routingHistory.push(result);
    if (this.routingHistory.length > this.maxHistory) {
      this.routingHistory.shift();
    }

    return result;
  }

  // Multi-cast: route to all matching destinations
  multicast(input) {
    const classification = this.classify(input);
    const inputSig = classification.signature;
    const targets = [];

    for (const [, route] of this.routes) {
      if (!route.healthy) continue;
      const resonance = TernaryRouting.resonance(inputSig, route.resonanceSignature);
      if (resonance >= this.resonanceThreshold) {
        targets.push({
          routeId: route.id,
          target: route.target,
          resonance,
        });
        route.lastRouted = Date.now();
        route.routeCount++;
      }
    }

    return {
      timestamp: Date.now(),
      classification,
      targets,
      count: targets.length,
    };
  }

  // Get router status
  status() {
    const routes = [];
    for (const [, route] of this.routes) {
      routes.push({
        id: route.id,
        target: route.target,
        healthy: route.healthy,
        routeCount: route.routeCount,
        lastRouted: route.lastRouted,
        resonanceSignature: route.resonanceSignature,
      });
    }

    return {
      routeCount: this.routes.size,
      routes,
      historySize: this.routingHistory.length,
      resonanceThreshold: this.resonanceThreshold,
      defaultRoute: this.defaultRoute,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════

module.exports = {
  ResonanceRouter,
  Route,
  TernaryRouting,
  RESONANCE_GROUPS,
  RESONANCE_SEQUENCE,
};
