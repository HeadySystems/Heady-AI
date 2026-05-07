const { PSI } = require('../../../src/kernel');

class RoutingBias {
  constructor(telemetryInstance) {
    this.telemetry = telemetryInstance;
    this.SKEW_THRESHOLD = PSI;
  }

  /**
   * Compute weight multiplier for all nodes.
   * 1.0 = neutral
   * < 1.0 = penalty (overutilized)
   * > 1.0 = bonus (underutilized)
   */
  computeBiasWeights() {
    const utilVector = this.telemetry.getUtilizationVector();
    const gini = this.telemetry.computeGiniCoefficient();
    
    const weights = new Map();
    
    if (utilVector.length === 0) return weights;
    
    // If skew is below threshold, bias is minimal/neutral
    if (gini <= this.SKEW_THRESHOLD) {
      utilVector.forEach(({id}) => weights.set(id, 1.0));
      return weights;
    }

    // High skew -> penalize overutilized, boost underutilized
    let sum = 0;
    utilVector.forEach(({count}) => sum += count);
    
    const mean = sum / utilVector.length;

    utilVector.forEach(({id, count}) => {
      if (mean === 0) {
        weights.set(id, 1.0);
        return;
      }
      
      const ratio = count / mean;
      let weight = 1.0;
      
      if (ratio > 0) {
        // Dampen the ratio using square root to avoid extreme routing swings
        weight = 1 / Math.sqrt(ratio); 
      } else {
        weight = 2.0; // Max boost for zero utilization nodes
      }
      
      weights.set(id, weight);
    });

    return weights;
  }

  getWeightForNode(nodeId) {
    const weights = this.computeBiasWeights();
    return weights.has(nodeId) ? weights.get(nodeId) : 1.0;
  }

  /**
   * Applies bias weights to a list of node candidates and sorts them.
   * Integrates into conductor's routeTask() dispatch path.
   * @param {Array} nodeCandidates - List of node objects or identifiers
   * @returns {Array} Sorted candidates favoring underutilized nodes
   */
  applyBias(nodeCandidates) {
    const weights = this.computeBiasWeights();
    
    return nodeCandidates.map(node => {
      const id = typeof node === 'string' ? node : (node.id || node.name);
      const weight = weights.has(id) ? weights.get(id) : 1.0;
      
      if (typeof node === 'string') {
        return { id: node, biasWeight: weight };
      }
      
      return {
        ...node,
        biasWeight: weight
      };
    }).sort((a, b) => b.biasWeight - a.biasWeight);
  }
}

module.exports = { RoutingBias };
