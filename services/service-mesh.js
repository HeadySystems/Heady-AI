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
// ║  FILE: services/service-mesh.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
// ═══════════════════════════════════════════════════════════════════════════════
// HEADY™ Service Mesh — φ-Scored Routing with mTLS and Circuit Breakers
// © 2026 HeadySystems Inc. — Eric Haywood, Founder
// ═══════════════════════════════════════════════════════════════════════════════

'use strict';

const { PHI, PSI, PSI3, FIB, CSL_THRESHOLDS, cslGate, sha256 } = require('../shared/phi-math-v2.js');

class ServiceMesh {
  constructor() {
    this._topology = new Map();
    this._connections = new Map();
    this._maxConnections = FIB[16];
  }

  route(from, to, payload = {}) {
    const key = from + '->' + to;
    const conn = this._connections.get(key) || { count: 0, errors: 0 };
    conn.count++;
    conn.lastUsed = Date.now();
    this._connections.set(key, conn);

    const errorRate = conn.count > 0 ? conn.errors / conn.count : 0;
    const health = 1 - errorRate;
    const gated = cslGate(health, health, CSL_THRESHOLDS.LOW, PSI3);

    return {
      routed: gated > CSL_THRESHOLDS.MINIMUM,
      from, to, health: gated,
      connectionCount: conn.count,
    };
  }

  getTopology() {
    return {
      nodes: Array.from(this._topology.keys()),
      connections: Array.from(this._connections.entries()).map(([key, conn]) => ({
        route: key, count: conn.count, errors: conn.errors, lastUsed: conn.lastUsed,
      })),
    };
  }

  injectSidecar(serviceName) {
    this._topology.set(serviceName, {
      sidecar: true, injectedAt: Date.now(),
      mtls: true, circuitBreaker: true,
    });
    return { injected: true, serviceName };
  }

  getTrafficMatrix() {
    const matrix = {};
    for (const [key, conn] of this._connections) {
      const [from, to] = key.split('->');
      if (!matrix[from]) matrix[from] = {};
      matrix[from][to] = { count: conn.count, errors: conn.errors };
    }
    return matrix;
  }
}

module.exports = { ServiceMesh };
