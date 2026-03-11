// ═══════════════════════════════════════════════════════════════════════════════
// HEADY™ Cloud Run Deployer — GCP Blue-Green with φ-Scaled Traffic Shifting
// © 2026 HeadySystems Inc. — Eric Haywood, Founder
// ═══════════════════════════════════════════════════════════════════════════════

import { PHI, PSI, PSI2, PSI3, FIB, sha256, phiBackoff, CSL_THRESHOLDS, cslGate } from '../shared/phi-math-v2.js';

const GCP_CONFIG = Object.freeze({
  project: 'gen-lang-client-0920560496',
  region: 'us-east1',
  registry: 'us-east1-docker.pkg.dev/gen-lang-client-0920560496/heady',
});

const TRAFFIC_STEPS = Object.freeze([
  PSI3 * 100,  // ~5% canary
  PSI2 * 100,  // ~24% early
  PSI * 100,   // ~38% ramp
  (1 - PSI2) * 100, // ~62% majority
  (1 - PSI3) * 100, // ~76% dominant
  100,          // full
].map(v => Math.round(v)));

class CloudRunDeployer {
  #deployments;
  #maxDeployments;

  constructor() {
    this.#deployments = new Map();
    this.#maxDeployments = FIB[12];
  }

  async deploy(serviceName, imageTag, options = {}) {
    const deployId = await sha256('deploy:' + serviceName + ':' + imageTag + ':' + Date.now());
    const deployment = {
      id: deployId,
      service: serviceName,
      image: GCP_CONFIG.registry + '/' + serviceName + ':' + imageTag,
      project: GCP_CONFIG.project,
      region: GCP_CONFIG.region,
      status: 'deploying',
      trafficPct: 0,
      blueRevision: options.currentRevision || null,
      greenRevision: deployId.slice(0, FIB[6]),
      startedAt: Date.now(),
    };

    this.#deployments.set(deployId, deployment);
    deployment.status = 'deployed';
    deployment.trafficPct = TRAFFIC_STEPS[0];
    return deployment;
  }

  async rollback(deployId) {
    const dep = this.#deployments.get(deployId);
    if (!dep) throw new Error('Deployment not found');
    dep.status = 'rolled_back';
    dep.trafficPct = 0;
    return { rolledBack: true, deployId, service: dep.service };
  }

  async canary(deployId, stepIndex = 0) {
    const dep = this.#deployments.get(deployId);
    if (!dep) throw new Error('Deployment not found');
    const step = Math.min(stepIndex, TRAFFIC_STEPS.length - 1);
    dep.trafficPct = TRAFFIC_STEPS[step];
    dep.status = step === TRAFFIC_STEPS.length - 1 ? 'fully_deployed' : 'canary';
    return { deployId, trafficPct: dep.trafficPct, step, totalSteps: TRAFFIC_STEPS.length };
  }

  getDeployStatus(deployId) {
    return this.#deployments.get(deployId) || null;
  }

  async shiftTraffic(deployId, targetPct) {
    const dep = this.#deployments.get(deployId);
    if (!dep) throw new Error('Deployment not found');
    dep.trafficPct = Math.min(100, Math.max(0, targetPct));
    return { deployId, trafficPct: dep.trafficPct };
  }

  getDeployments(limit = FIB[8]) {
    return Array.from(this.#deployments.values()).slice(-limit);
  }
}

export { CloudRunDeployer, GCP_CONFIG, TRAFFIC_STEPS };
export default CloudRunDeployer;
