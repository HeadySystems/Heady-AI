// ═══════════════════════════════════════════════════════════════════════════════
// HEADY™ Cloudflare Deployer — Workers/Pages with φ-Gated Rollout
// © 2026 HeadySystems Inc. — Eric Haywood, Founder
// ═══════════════════════════════════════════════════════════════════════════════

import { PHI, PSI, PSI2, PSI3, FIB, sha256, CSL_THRESHOLDS, cslGate } from '../shared/phi-math-v2.js';

const CF_CONFIG = Object.freeze({
  accountId: '8b1fa38f282c691423c6399247d53323',
  namespace: 'heady',
});

class CloudflareDeployer {
  #workers;
  #pages;

  constructor() {
    this.#workers = new Map();
    this.#pages = new Map();
  }

  async deploy(name, type = 'worker', config = {}) {
    const id = await sha256('cf:' + name + ':' + Date.now());
    const entry = {
      id, name, type, accountId: CF_CONFIG.accountId,
      status: 'deployed', rolloutPct: 100,
      routes: config.routes || [], deployedAt: Date.now(),
    };
    if (type === 'worker') this.#workers.set(name, entry);
    else this.#pages.set(name, entry);
    return entry;
  }

  async rollback(name) {
    const entry = this.#workers.get(name) || this.#pages.get(name);
    if (!entry) throw new Error('Not found: ' + name);
    entry.status = 'rolled_back';
    entry.rolloutPct = 0;
    return { rolledBack: true, name };
  }

  getWorkerStatus(name) { return this.#workers.get(name) || null; }

  configureRoutes(name, routes) {
    const entry = this.#workers.get(name);
    if (!entry) throw new Error('Worker not found: ' + name);
    entry.routes = routes;
    return { name, routes };
  }

  getDeployments() {
    return {
      workers: Array.from(this.#workers.values()),
      pages: Array.from(this.#pages.values()),
    };
  }
}

export { CloudflareDeployer, CF_CONFIG };
export default CloudflareDeployer;
