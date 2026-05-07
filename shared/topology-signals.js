const { cslAND, cslOR, cslNOT } = require('./csl-engine');
const { CSL_THRESHOLDS } = require('./phi-math');

/**
 * Propagates a signal across a 1-cell (Edge) using CSL operations.
 * Continuous Semantic Logic (CSL) computes truth values between 0 and 1.
 * 
 * @param {number} stateA - Activation state of node A (0.0 to 1.0)
 * @param {number} stateB - Activation state of node B (0.0 to 1.0)
 * @param {number} weight - Edge weight
 * @returns {number} The propagated signal strength
 */
function propagateEdgeSignal(stateA, stateB, weight = 1.0) {
  // CSL AND gives the minimum of the two states, meaning a signal only
  // propagates fully if both ends are activated.
  const coherence = Math.min(stateA, stateB);
  return coherence * weight;
}

/**
 * Propagates a signal across a 2-cell (Triangle) using CSL operations.
 * 
 * @param {number} stateA 
 * @param {number} stateB 
 * @param {number} stateC 
 * @param {number} weight 
 * @returns {number} The tri-node propagated signal strength
 */
function propagateTriangleSignal(stateA, stateB, stateC, weight = 1.0) {
  // For a triangle to activate, all 3 nodes must share context
  const coherence = Math.min(stateA, stateB, stateC);
  return coherence * weight;
}

/**
 * Emergent behavior: Self-Healing
 * Triggered when a node's state drops below NOISE_FLOOR, but its neighbors are healthy.
 * 
 * @param {number} degradedNodeState 
 * @param {number[]} neighborStates 
 * @returns {boolean} Whether to trigger self-healing
 */
function shouldTriggerSelfHealing(degradedNodeState, neighborStates) {
  if (degradedNodeState > CSL_THRESHOLDS.NOISE_FLOOR) return false;
  
  if (neighborStates.length === 0) return false;
  
  // Use CSL OR to check if ANY neighbor is very healthy
  const neighborsHealthy = Math.max(...neighborStates);
  
  return neighborsHealthy >= CSL_THRESHOLDS.HIGH;
}

/**
 * Emergent behavior: Load Rebalance
 * Triggered when one node is overloaded (state close to 1.0) and others are idle.
 */
function shouldTriggerLoadRebalance(states) {
  if (states.length < 2) return false;
  const maxState = Math.max(...states);
  const minState = Math.min(...states);
  
  // High variance indicates imbalance
  return (maxState - minState) >= CSL_THRESHOLDS.MEDIUM;
}

/**
 * Emergent behavior: Topology Sync
 * Ensures the simplicial complex remains coherent.
 */
function shouldTriggerTopologySync(syncScore) {
  // If overall sync score drops below low threshold, we need a sync
  return syncScore <= CSL_THRESHOLDS.LOW;
}

module.exports = {
  propagateEdgeSignal,
  propagateTriangleSignal,
  shouldTriggerSelfHealing,
  shouldTriggerLoadRebalance,
  shouldTriggerTopologySync
};
