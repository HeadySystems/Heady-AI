const { getLog, FIBS, PSI } = require('../../../src/kernel');

class NodeTelemetry {
  constructor(nodes) {
    this.nodes = nodes || [];
    this.dispatches = new Map();
    // Support nodes being objects with id/name, or just string identifiers
    this.nodes.forEach(n => {
      const id = n.id || n.name || n;
      this.dispatches.set(id, 0);
    });
    this.logger = getLog('node-telemetry');
    this.timer = null;
  }

  static async initialize(nodes) {
    const telemetry = new NodeTelemetry(nodes);
    telemetry.startReporting();
    return telemetry;
  }

  recordDispatch(nodeId) {
    const count = this.dispatches.get(nodeId) || 0;
    this.dispatches.set(nodeId, count + 1);
  }

  getUtilizationVector() {
    return Array.from(this.dispatches.entries()).map(([id, count]) => ({ id, count }));
  }

  // Calculate Gini coefficient (0 = perfect equality, 1 = maximal inequality)
  computeGiniCoefficient() {
    const counts = Array.from(this.dispatches.values()).sort((a, b) => a - b);
    const n = counts.length;
    if (n === 0) return 0;
    
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += counts[i];
    }
    if (sum === 0) return 0;

    let giniSum = 0;
    for (let i = 0; i < n; i++) {
      giniSum += (i + 1) * counts[i]; // i+1 because 1-indexed for formula
    }

    // Gini index formula: (2 * sum(i*y_i)) / (n * sum(y_i)) - (n+1)/n
    return (2 * giniSum) / (n * sum) - ((n + 1) / n);
  }

  startReporting() {
    const intervalMs = FIBS[9] * 1000; // 34 seconds
    this.timer = setInterval(() => {
      const gini = this.computeGiniCoefficient();
      const utilVector = this.getUtilizationVector();
      
      this.logger.info('Node utilization telemetry', {
        gini_coefficient: gini,
        utilization_vector: utilVector
      });

      if (gini > PSI) {
        this.logger.warn('High node utilization skew detected', {
          gini_coefficient: gini,
          threshold: PSI,
          action: 'routing_rebalance_triggered'
        });
      }
    }, intervalMs);
    
    if (this.timer.unref) this.timer.unref();
  }

  stopReporting() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

module.exports = { NodeTelemetry };
