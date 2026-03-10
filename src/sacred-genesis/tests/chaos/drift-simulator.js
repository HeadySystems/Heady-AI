/**
 * Heady Chaos Engineering — Semantic Drift Simulator
 * Simulates coherence drift for testing self-healing lifecycle
 *
 * @module drift-simulator
 * @author Eric Haywood, HeadySystems Inc.
 */

'use strict';

const { PHI, PSI, fib, phiThreshold } = require('../../shared/phi-math');

/**
 * Drift simulation types
 * @readonly
 * @enum {string}
 */
const DRIFT_TYPES = {
  GRADUAL: 'gradual',
  SUDDEN: 'sudden',
  OSCILLATING: 'oscillating',
  CASCADE: 'cascade'
};

/** @type {number} Coherence threshold — phiThreshold(2) */
const COHERENCE_THRESHOLD = phiThreshold(2);

/**
 * Simulate gradual coherence drift
 * @param {number} startCoherence - Starting coherence score
 * @param {number} driftRate - Drift per tick (default psi^4)
 * @param {number} ticks - Number of simulation ticks
 * @returns {Array<{tick: number, coherence: number, alert: boolean}>}
 */
function simulateGradualDrift(startCoherence = 0.95, driftRate = PSI * PSI * PSI * PSI, ticks = fib(8)) {
  const results = [];
  let coherence = startCoherence;

  for (let t = 0; t < ticks; t++) {
    coherence -= driftRate * (1 + Math.random() * PSI);
    coherence = Math.max(0, Math.min(1, coherence));

    results.push({
      tick: t,
      coherence: Math.round(coherence * 10000) / 10000,
      alert: coherence < COHERENCE_THRESHOLD,
      severity: coherence < phiThreshold(1) ? 'critical' :
                coherence < phiThreshold(2) ? 'warning' : 'normal'
    });
  }

  return results;
}

/**
 * Simulate sudden coherence drop
 * @param {number} startCoherence - Starting coherence
 * @param {number} dropMagnitude - Drop size (default psi)
 * @param {number} dropTick - Tick at which drop occurs
 * @param {number} ticks - Total ticks
 * @returns {Array<{tick: number, coherence: number, alert: boolean}>}
 */
function simulateSuddenDrop(startCoherence = 0.95, dropMagnitude = PSI, dropTick = fib(5), ticks = fib(8)) {
  const results = [];
  let coherence = startCoherence;

  for (let t = 0; t < ticks; t++) {
    if (t === dropTick) {
      coherence -= dropMagnitude;
    }
    coherence += (Math.random() - 0.5) * PSI * PSI * PSI * PSI;
    coherence = Math.max(0, Math.min(1, coherence));

    results.push({
      tick: t,
      coherence: Math.round(coherence * 10000) / 10000,
      alert: coherence < COHERENCE_THRESHOLD,
      severity: coherence < phiThreshold(1) ? 'critical' :
                coherence < phiThreshold(2) ? 'warning' : 'normal'
    });
  }

  return results;
}

/**
 * Simulate oscillating coherence
 * @param {number} center - Center coherence value
 * @param {number} amplitude - Oscillation amplitude
 * @param {number} period - Oscillation period in ticks
 * @param {number} ticks - Total ticks
 * @returns {Array<{tick: number, coherence: number, alert: boolean}>}
 */
function simulateOscillation(center = 0.85, amplitude = PSI * PSI, period = fib(6), ticks = fib(9)) {
  const results = [];

  for (let t = 0; t < ticks; t++) {
    const coherence = center + amplitude * Math.sin(2 * Math.PI * t / period);
    const bounded = Math.max(0, Math.min(1, coherence));

    results.push({
      tick: t,
      coherence: Math.round(bounded * 10000) / 10000,
      alert: bounded < COHERENCE_THRESHOLD,
      severity: bounded < phiThreshold(1) ? 'critical' :
                bounded < phiThreshold(2) ? 'warning' : 'normal'
    });
  }

  return results;
}

/**
 * Simulate cascade drift (one node affects others)
 * @param {number} nodeCount - Number of nodes to simulate
 * @param {number} infectionRate - Rate of drift spread (default psi^2)
 * @param {number} ticks - Total ticks
 * @returns {Array<{tick: number, nodes: Array<{id: number, coherence: number, alert: boolean}>}>}
 */
function simulateCascade(nodeCount = fib(6), infectionRate = PSI * PSI, ticks = fib(9)) {
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    id: i,
    coherence: 0.95,
    infected: i === 0
  }));

  const results = [];

  for (let t = 0; t < ticks; t++) {
    for (const node of nodes) {
      if (node.infected) {
        node.coherence -= PSI * PSI * PSI;
        for (const other of nodes) {
          if (!other.infected && Math.random() < infectionRate) {
            other.infected = true;
          }
        }
      }
      node.coherence = Math.max(0, Math.min(1, node.coherence));
    }

    results.push({
      tick: t,
      nodes: nodes.map(n => ({
        id: n.id,
        coherence: Math.round(n.coherence * 10000) / 10000,
        alert: n.coherence < COHERENCE_THRESHOLD,
        infected: n.infected
      }))
    });
  }

  return results;
}

/**
 * Evaluate self-healing response to drift simulation
 * @param {Array<{tick: number, coherence: number, alert: boolean}>} simulation - Simulation results
 * @returns {{alertsTriggered: number, maxDrift: number, recoveryNeeded: boolean, timeToDetect: number|null}}
 */
function evaluateResponse(simulation) {
  let alertsTriggered = 0;
  let maxDrift = 1.0;
  let firstAlert = null;

  for (const tick of simulation) {
    if (tick.alert) {
      alertsTriggered++;
      if (firstAlert === null) firstAlert = tick.tick;
    }
    if (tick.coherence < maxDrift) {
      maxDrift = tick.coherence;
    }
  }

  return {
    alertsTriggered,
    maxDrift: Math.round(maxDrift * 10000) / 10000,
    recoveryNeeded: maxDrift < phiThreshold(1),
    timeToDetect: firstAlert
  };
}

module.exports = {
  DRIFT_TYPES,
  COHERENCE_THRESHOLD,
  simulateGradualDrift,
  simulateSuddenDrop,
  simulateOscillation,
  simulateCascade,
  evaluateResponse
};
