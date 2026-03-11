// ═══════════════════════════════════════════════════════════════════════════════
// HEADY™ Manager Kernel — Modular Microkernel (replaces 78KB monolith)
// © 2026 HeadySystems Inc. — Eric Haywood, Founder
// ═══════════════════════════════════════════════════════════════════════════════

import {
  PHI, PSI, PSI2, PSI3, FIB, CSL_THRESHOLDS,
  sha256, cslGate, phiBackoff, deterministicRandom, SEED
} from '../shared/phi-math-v2.js';
import { textToEmbedding, DIM } from '../shared/csl-engine-v2.js';

const MODULE_STATES = Object.freeze({
  UNLOADED: 'unloaded',
  LOADING:  'loading',
  READY:    'ready',
  ERROR:    'error',
  DRAINING: 'draining',
});

class HeadyManagerKernel {
  #modules;
  #modulePool;
  #maxPoolSize;
  #dispatchQueue;
  #maxQueueDepth;
  #bootSequence;
  #health;
  #startedAt;

  constructor() {
    this.#modules = new Map();
    this.#modulePool = { hot: new Map(), warm: new Map(), cold: new Map() };
    this.#maxPoolSize = FIB[16];
    this.#dispatchQueue = [];
    this.#maxQueueDepth = FIB[13];
    this.#bootSequence = [];
    this.#health = { status: 'initializing', uptime: 0, modulesLoaded: 0 };
    this.#startedAt = null;
  }

  async boot(coreModules = []) {
    this.#startedAt = Date.now();
    this.#health.status = 'booting';

    const defaultCore = [
      'phi-math', 'csl-engine', 'sacred-geometry',
      'heady-soul', 'heady-conductor', 'heady-vinci',
      'heady-brains', 'heady-lens',
    ];

    const toLoad = coreModules.length > 0 ? coreModules : defaultCore;

    for (const modName of toLoad) {
      await this.loadModule(modName, 'hot');
      this.#bootSequence.push({ module: modName, loadedAt: Date.now() });
    }

    this.#health.status = 'ready';
    this.#health.modulesLoaded = this.#modules.size;

    return {
      status: 'ready',
      modulesLoaded: this.#modules.size,
      bootTimeMs: Date.now() - this.#startedAt,
      sequence: this.#bootSequence.map(b => b.module),
    };
  }

  async loadModule(name, pool = 'warm') {
    if (this.#modules.has(name)) {
      return { loaded: false, reason: 'Already loaded', name };
    }

    const moduleEntry = {
      name,
      state: MODULE_STATES.LOADING,
      pool,
      embedding: textToEmbedding('module:' + name),
      loadedAt: Date.now(),
      lastUsed: Date.now(),
      useCount: 0,
      health: 1.0,
    };

    this.#modules.set(name, moduleEntry);
    this.#modulePool[pool].set(name, moduleEntry);

    moduleEntry.state = MODULE_STATES.READY;
    moduleEntry.hash = await sha256('module:' + name + ':' + Date.now());

    return { loaded: true, name, pool, hash: moduleEntry.hash };
  }

  async unloadModule(name) {
    const mod = this.#modules.get(name);
    if (!mod) return { unloaded: false, reason: 'Not found' };

    mod.state = MODULE_STATES.DRAINING;

    const poolMap = this.#modulePool[mod.pool];
    if (poolMap) poolMap.delete(name);
    this.#modules.delete(name);

    this.#health.modulesLoaded = this.#modules.size;

    return { unloaded: true, name };
  }

  getModuleHealth(name = null) {
    if (name) {
      const mod = this.#modules.get(name);
      if (!mod) return null;
      return {
        name: mod.name,
        state: mod.state,
        pool: mod.pool,
        health: mod.health,
        useCount: mod.useCount,
        lastUsed: mod.lastUsed,
        uptime: Date.now() - mod.loadedAt,
      };
    }

    const modules = {};
    for (const [n, mod] of this.#modules) {
      modules[n] = {
        state: mod.state,
        pool: mod.pool,
        health: mod.health,
        useCount: mod.useCount,
      };
    }

    return {
      kernel: {
        status: this.#health.status,
        uptime: this.#startedAt ? Date.now() - this.#startedAt : 0,
        totalModules: this.#modules.size,
        queueDepth: this.#dispatchQueue.length,
      },
      pools: {
        hot: this.#modulePool.hot.size,
        warm: this.#modulePool.warm.size,
        cold: this.#modulePool.cold.size,
      },
      modules,
    };
  }

  async dispatch(taskName, targetModule = null) {
    let mod;
    if (targetModule) {
      mod = this.#modules.get(targetModule);
    } else {
      mod = this.#findBestModule(taskName);
    }

    if (!mod || mod.state !== MODULE_STATES.READY) {
      if (this.#dispatchQueue.length < this.#maxQueueDepth) {
        this.#dispatchQueue.push({ taskName, targetModule, queuedAt: Date.now() });
        return { dispatched: false, queued: true, queuePosition: this.#dispatchQueue.length };
      }
      return { dispatched: false, queued: false, reason: 'No ready module and queue full' };
    }

    mod.useCount++;
    mod.lastUsed = Date.now();

    const result = {
      dispatched: true,
      module: mod.name,
      pool: mod.pool,
      hash: await sha256('dispatch:' + taskName + ':' + mod.name + ':' + Date.now()),
    };

    return result;
  }

  getBootSequence() { return this.#bootSequence; }
  getQueueDepth() { return this.#dispatchQueue.length; }
  getLoadedModules() { return Array.from(this.#modules.keys()); }

  #findBestModule(taskName) {
    const taskEmb = textToEmbedding(taskName);
    let best = null;
    let bestScore = -Infinity;

    for (const [name, mod] of this.#modules) {
      if (mod.state !== MODULE_STATES.READY) continue;
      const score = mod.embedding.reduce((s, v, i) => s + v * taskEmb[i], 0);
      const gated = cslGate(score, mod.health, CSL_THRESHOLDS.LOW, PSI3);
      if (gated > bestScore) {
        bestScore = gated;
        best = mod;
      }
    }

    return best;
  }
}

export { HeadyManagerKernel, MODULE_STATES };
export default HeadyManagerKernel;
