/**
 * Heady Chaos Engineering — Network Fault Injection
 * Simulates network failures for resilience testing
 *
 * @module network-chaos
 * @author Eric Haywood, HeadySystems Inc.
 */

'use strict';

const http = require('http');
const { PHI, PSI, fib, phiBackoff } = require('../../shared/phi-math');

/**
 * Chaos experiment configuration
 * @typedef {Object} ChaosExperiment
 * @property {string} name - Experiment name
 * @property {string} type - Fault type (latency, error, partition, drop)
 * @property {string} target - Target service or network path
 * @property {number} duration - Experiment duration ms
 * @property {number} intensity - Fault probability 0-1
 * @property {Object} params - Type-specific parameters
 */

/**
 * Chaos experiment types
 * @readonly
 * @enum {string}
 */
const FAULT_TYPES = {
  LATENCY: 'latency',
  ERROR: 'error',
  PARTITION: 'partition',
  DROP: 'drop',
  CORRUPTION: 'corruption'
};

/**
 * Active chaos experiments
 * @type {Map<string, ChaosExperiment>}
 */
const activeExperiments = new Map();

/** @type {number} Maximum concurrent experiments — fib(5) */
const MAX_EXPERIMENTS = fib(5);

/**
 * Create a latency injection experiment
 * @param {string} target - Target service
 * @param {number} delayMs - Injected delay in ms
 * @param {number} probability - Probability of injection 0-1
 * @param {number} durationMs - Experiment duration
 * @returns {ChaosExperiment}
 */
function createLatencyExperiment(target, delayMs, probability = PSI, durationMs = fib(9) * 1000) {
  return {
    name: `latency-${target}-${Date.now()}`,
    type: FAULT_TYPES.LATENCY,
    target,
    duration: durationMs,
    intensity: probability,
    params: { delayMs },
    startedAt: Date.now(),
    injections: 0,
    skips: 0
  };
}

/**
 * Create an error injection experiment
 * @param {string} target - Target service
 * @param {number} statusCode - HTTP status to inject
 * @param {number} probability - Probability of injection 0-1
 * @param {number} durationMs - Experiment duration
 * @returns {ChaosExperiment}
 */
function createErrorExperiment(target, statusCode = 503, probability = PSI * PSI, durationMs = fib(8) * 1000) {
  return {
    name: `error-${target}-${Date.now()}`,
    type: FAULT_TYPES.ERROR,
    target,
    duration: durationMs,
    intensity: probability,
    params: { statusCode },
    startedAt: Date.now(),
    injections: 0,
    skips: 0
  };
}

/**
 * Create a network partition experiment
 * @param {string} sourceService - Source of partition
 * @param {string} targetService - Target of partition
 * @param {number} durationMs - Partition duration
 * @returns {ChaosExperiment}
 */
function createPartitionExperiment(sourceService, targetService, durationMs = fib(7) * 1000) {
  return {
    name: `partition-${sourceService}-${targetService}-${Date.now()}`,
    type: FAULT_TYPES.PARTITION,
    target: `${sourceService}->${targetService}`,
    duration: durationMs,
    intensity: 1.0,
    params: { source: sourceService, target: targetService },
    startedAt: Date.now(),
    injections: 0,
    skips: 0
  };
}

/**
 * Start a chaos experiment
 * @param {ChaosExperiment} experiment
 * @returns {{started: boolean, error?: string}}
 */
function startExperiment(experiment) {
  if (activeExperiments.size >= MAX_EXPERIMENTS) {
    return { started: false, error: `Maximum concurrent experiments (${MAX_EXPERIMENTS}) reached` };
  }

  activeExperiments.set(experiment.name, experiment);

  setTimeout(() => {
    stopExperiment(experiment.name);
  }, experiment.duration);

  return { started: true, name: experiment.name };
}

/**
 * Stop a chaos experiment
 * @param {string} name - Experiment name
 * @returns {ChaosExperiment | null}
 */
function stopExperiment(name) {
  const exp = activeExperiments.get(name);
  if (exp) {
    exp.stoppedAt = Date.now();
    exp.actualDuration = exp.stoppedAt - exp.startedAt;
    activeExperiments.delete(name);
  }
  return exp;
}

/**
 * Check if a request should be faulted by active experiments
 * @param {string} target - Target service name
 * @returns {{fault: boolean, type?: string, params?: Object}}
 */
function shouldInjectFault(target) {
  for (const [, exp] of activeExperiments) {
    if (exp.target === target || exp.target.includes(target)) {
      if (Math.random() < exp.intensity) {
        exp.injections++;
        return { fault: true, type: exp.type, params: exp.params };
      }
      exp.skips++;
    }
  }
  return { fault: false };
}

/**
 * Get all active experiments
 * @returns {ChaosExperiment[]}
 */
function listExperiments() {
  return Array.from(activeExperiments.values());
}

/**
 * Stop all active experiments (emergency kill)
 * @returns {number} Number of experiments stopped
 */
function stopAll() {
  const count = activeExperiments.size;
  for (const [name] of activeExperiments) {
    stopExperiment(name);
  }
  return count;
}

module.exports = {
  FAULT_TYPES,
  createLatencyExperiment,
  createErrorExperiment,
  createPartitionExperiment,
  startExperiment,
  stopExperiment,
  shouldInjectFault,
  listExperiments,
  stopAll,
  MAX_EXPERIMENTS
};
