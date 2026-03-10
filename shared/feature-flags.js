/**
 * Feature Flags — Heady Systems
 * Eric Haywood — Sacred Geometry v4.0
 *
 * Phi-scaled rollout: 6.18% -> 38.2% -> 61.8% -> 100%
 * CSL confidence gate on each flag.
 */
'use strict';

const PHI  = 1.618033988749895;
const PSI  = 1 / PHI;
const PSI2 = PSI * PSI;

const ROLLOUT_STAGES = [
  0.0618,  // Stage 1: 6.18% (PSI * 0.1)
  PSI2,    // Stage 2: 38.2%
  PSI,     // Stage 3: 61.8%
  1.0,     // Stage 4: 100%
];

class FeatureFlagManager {
  constructor(store) {
    this.store = store; // KV store (Cloudflare KV, Redis, or in-memory)
    this.cache = new Map();
    this.cacheMaxSize = 233; // fib(12)
    this.cacheTtlMs = 21000; // 21s (fib(8))
  }

  async isEnabled(flagName, userId, context = {}) {
    const flag = await this._getFlag(flagName);
    if (!flag || !flag.enabled || flag.kill_switch) {
      return false;
    }

    // CSL gate check
    const cslScore = context.cslScore || PSI;
    if (cslScore < flag.csl_gate) {
      return false;
    }

    // Deterministic hash for consistent user experience
    const hash = this._deterministicHash(flagName + ':' + userId);
    const normalized = (hash % 10000) / 10000;
    return normalized < flag.rollout_pct;
  }

  async setRollout(flagName, stage) {
    const pct = ROLLOUT_STAGES[Math.min(stage, ROLLOUT_STAGES.length - 1)];
    await this.store.set(`flag:${flagName}`, JSON.stringify({
      name: flagName,
      rollout_pct: pct,
      csl_gate: PSI,
      enabled: true,
      kill_switch: false,
      updated_at: Date.now(),
    }));
    this.cache.delete(flagName);
  }

  async killSwitch(flagName) {
    const flag = await this._getFlag(flagName);
    if (flag) {
      flag.kill_switch = true;
      await this.store.set(`flag:${flagName}`, JSON.stringify(flag));
      this.cache.delete(flagName);
    }
  }

  async _getFlag(name) {
    const cached = this.cache.get(name);
    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      return cached.data;
    }
    const raw = await this.store.get(`flag:${name}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (this.cache.size >= this.cacheMaxSize) {
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
    }
    this.cache.set(name, { data, fetchedAt: Date.now() });
    return data;
  }

  _deterministicHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

module.exports = { FeatureFlagManager, ROLLOUT_STAGES, PHI, PSI, PSI2 };
