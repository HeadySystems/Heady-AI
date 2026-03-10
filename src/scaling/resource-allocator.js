// ═══════════════════════════════════════════════════════════════════════════════
// HEADY™ Resource Allocator — Sacred Geometry Pool Distribution
// © 2026 HeadySystems Inc. — Eric Haywood, Founder
// ═══════════════════════════════════════════════════════════════════════════════

import { PHI, PSI, PSI2, FIB, POOL_ALLOCATION, CSL_THRESHOLDS, cslGate, PSI3 } from '../shared/phi-math-v2.js';

class ResourceAllocator {
  #pools;
  #totalCapacity;
  #history;

  constructor(totalCapacity = FIB[16]) {
    this.#totalCapacity = totalCapacity;
    this.#history = [];
    this.#pools = {
      hot:        { allocated: Math.round(totalCapacity * POOL_ALLOCATION.HOT), used: 0 },
      warm:       { allocated: Math.round(totalCapacity * POOL_ALLOCATION.WARM), used: 0 },
      cold:       { allocated: Math.round(totalCapacity * POOL_ALLOCATION.COLD), used: 0 },
      reserve:    { allocated: Math.round(totalCapacity * POOL_ALLOCATION.RESERVE), used: 0 },
      governance: { allocated: Math.round(totalCapacity * POOL_ALLOCATION.GOVERNANCE), used: 0 },
    };
  }

  allocate(pool, amount) {
    const p = this.#pools[pool];
    if (!p) throw new Error('Unknown pool: ' + pool);
    if (p.used + amount > p.allocated) {
      return { allocated: false, reason: 'Insufficient capacity', available: p.allocated - p.used };
    }
    p.used += amount;
    this.#history.push({ action: 'allocate', pool, amount, timestamp: Date.now() });
    return { allocated: true, pool, amount, remaining: p.allocated - p.used };
  }

  release(pool, amount) {
    const p = this.#pools[pool];
    if (!p) throw new Error('Unknown pool: ' + pool);
    p.used = Math.max(0, p.used - amount);
    return { released: true, pool, amount, remaining: p.allocated - p.used };
  }

  rebalance() {
    const totalUsed = Object.values(this.#pools).reduce((s, p) => s + p.used, 0);
    const totalAllocated = Object.values(this.#pools).reduce((s, p) => s + p.allocated, 0);
    const globalUtilization = totalAllocated > 0 ? totalUsed / totalAllocated : 0;

    for (const [name, pool] of Object.entries(this.#pools)) {
      const poolUtil = pool.allocated > 0 ? pool.used / pool.allocated : 0;
      if (poolUtil > 1 - PSI3 && name !== 'reserve') {
        const borrow = Math.min(this.#pools.reserve.allocated - this.#pools.reserve.used, Math.round(pool.allocated * PSI2));
        if (borrow > 0) {
          pool.allocated += borrow;
          this.#pools.reserve.used += borrow;
          this.#history.push({ action: 'rebalance', from: 'reserve', to: name, amount: borrow, timestamp: Date.now() });
        }
      }
    }

    return this.getDistribution();
  }

  getDistribution() {
    const dist = {};
    for (const [name, pool] of Object.entries(this.#pools)) {
      dist[name] = {
        allocated: pool.allocated,
        used: pool.used,
        available: pool.allocated - pool.used,
        utilization: pool.allocated > 0 ? pool.used / pool.allocated : 0,
      };
    }
    return { pools: dist, totalCapacity: this.#totalCapacity, timestamp: Date.now() };
  }

  getPoolHealth() {
    const dist = this.getDistribution();
    let healthyPools = 0;
    for (const pool of Object.values(dist.pools)) {
      if (pool.utilization < 1 - PSI3) healthyPools++;
    }
    return { healthy: healthyPools, total: Object.keys(dist.pools).length, score: healthyPools / Object.keys(dist.pools).length };
  }
}

export { ResourceAllocator };
export default ResourceAllocator;
