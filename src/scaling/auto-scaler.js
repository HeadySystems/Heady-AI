// ═══════════════════════════════════════════════════════════════════════════════
// HEADY™ Auto-Scaler — φ-Scaled Service Scaling Engine
// © 2026 HeadySystems Inc. — Eric Haywood, Founder
// ═══════════════════════════════════════════════════════════════════════════════

import {
  PHI, PSI, PSI2, PSI3, FIB, CSL_THRESHOLDS,
  cslGate, phiBackoff, PRESSURE_LEVELS
} from '../shared/phi-math-v2.js';

const FIB_STEPS = [FIB[0], FIB[1], FIB[2], FIB[3], FIB[4], FIB[5], FIB[6], FIB[7]];

class AutoScaler {
  #services;
  #history;
  #maxHistory;
  #cooldownMs;
  #lastScaleEvent;

  constructor() {
    this.#services = new Map();
    this.#history = [];
    this.#maxHistory = FIB[16];
    this.#cooldownMs = FIB[8] * 1000;
    this.#lastScaleEvent = new Map();
  }

  evaluate(serviceName, currentLoad, maxCapacity) {
    const utilization = currentLoad / maxCapacity;
    const currentReplicas = this.#services.get(serviceName)?.replicas || 1;

    let action = 'none';
    let targetReplicas = currentReplicas;

    if (utilization > PRESSURE_LEVELS.CRITICAL.min) {
      action = 'scale_up';
      targetReplicas = this.#nextFibStep(currentReplicas, 'up');
    } else if (utilization > PRESSURE_LEVELS.HIGH.min) {
      action = 'scale_up';
      targetReplicas = this.#nextFibStep(currentReplicas, 'up');
    } else if (utilization < PRESSURE_LEVELS.NOMINAL.max && currentReplicas > 1) {
      action = 'scale_down';
      targetReplicas = this.#nextFibStep(currentReplicas, 'down');
    }

    const lastEvent = this.#lastScaleEvent.get(serviceName) || 0;
    const inCooldown = Date.now() - lastEvent < this.#cooldownMs;
    if (inCooldown) action = 'cooldown';

    const gatedConfidence = cslGate(utilization, utilization, CSL_THRESHOLDS.MEDIUM, PSI3);

    return {
      serviceName, currentLoad, maxCapacity, utilization,
      currentReplicas, targetReplicas, action, inCooldown,
      confidence: gatedConfidence,
    };
  }

  scaleUp(serviceName, targetReplicas) {
    const svc = this.#services.get(serviceName) || { replicas: 1 };
    svc.replicas = targetReplicas;
    this.#services.set(serviceName, svc);
    this.#lastScaleEvent.set(serviceName, Date.now());
    this.#record('scale_up', serviceName, targetReplicas);
    return { scaled: true, serviceName, replicas: targetReplicas };
  }

  scaleDown(serviceName, targetReplicas) {
    const svc = this.#services.get(serviceName) || { replicas: 1 };
    svc.replicas = Math.max(1, targetReplicas);
    this.#services.set(serviceName, svc);
    this.#lastScaleEvent.set(serviceName, Date.now());
    this.#record('scale_down', serviceName, svc.replicas);
    return { scaled: true, serviceName, replicas: svc.replicas };
  }

  getScalingHistory(limit = FIB[8]) { return this.#history.slice(-limit); }

  projectLoad(serviceName, currentLoad, growthRate = PHI) {
    const projections = [];
    let load = currentLoad;
    for (let i = 0; i < FIB[6]; i++) {
      load *= growthRate;
      projections.push({ period: i + 1, projectedLoad: Math.round(load) });
    }
    return projections;
  }

  #nextFibStep(current, direction) {
    const idx = FIB_STEPS.indexOf(current);
    if (direction === 'up') {
      return idx >= 0 && idx < FIB_STEPS.length - 1 ? FIB_STEPS[idx + 1] : current + 1;
    }
    return idx > 0 ? FIB_STEPS[idx - 1] : 1;
  }

  #record(action, serviceName, replicas) {
    this.#history.push({ action, serviceName, replicas, timestamp: Date.now() });
    if (this.#history.length > this.#maxHistory) {
      this.#history = this.#history.slice(-this.#maxHistory);
    }
  }
}

export { AutoScaler };
export default AutoScaler;
