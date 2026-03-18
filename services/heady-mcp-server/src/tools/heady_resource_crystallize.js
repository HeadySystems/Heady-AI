'use strict';

/**
 * heady_resource_crystallize — Dynamic resource allocation using phi-harmonic
 * resonance patterns. Optimizes compute/memory/token/bandwidth distributions.
 * JSON-RPC 2.0 MCP Tool
 */

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
const CSL = { MINIMUM: 0.500, LOW: 0.691, MEDIUM: 0.809, HIGH: 0.882, CRITICAL: 0.927, DEDUP: 0.972 };

const POOL_RATIOS = { hot: 0.34, warm: 0.21, cold: 0.13, reserve: 0.08, governance: 0.05 };
const RESOURCE_TYPES = ['compute', 'memory', 'tokens', 'bandwidth'];
const allocationHistory = [];
let allocSeq = 0;

function correlationId() {
  return `crystal-res-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function classifyError(code) {
  if (code >= 11000 && code < 11500) return 'RESOURCE_INPUT_ERROR';
  if (code >= 11500 && code < 12000) return 'RESOURCE_ALLOCATION_ERROR';
  return 'UNKNOWN_ERROR';
}

function phiHarmonicResonance(demands, capacity) {
  const allocation = {};
  let totalDemand = 0;
  for (const [key, demand] of Object.entries(demands)) totalDemand += demand;
  if (totalDemand === 0) return allocation;

  const oversubscribed = totalDemand > capacity;
  const phiRatios = {};
  const sortedKeys = Object.keys(demands).sort((a, b) => demands[b] - demands[a]);

  for (let i = 0; i < sortedKeys.length; i++) {
    const key = sortedKeys[i];
    const fibWeight = FIB[Math.min(i + FIB[3], FIB.length - 1)];
    phiRatios[key] = fibWeight * Math.pow(PSI, i);
  }

  const totalRatio = Object.values(phiRatios).reduce((s, r) => s + r, 0);

  for (const key of sortedKeys) {
    const idealShare = (phiRatios[key] / totalRatio) * capacity;
    const demanded = demands[key];
    if (oversubscribed) {
      allocation[key] = Number(Math.min(idealShare, demanded * PSI).toFixed(3));
    } else {
      allocation[key] = Number(Math.min(idealShare * PHI, demanded).toFixed(3));
    }
  }

  return allocation;
}

function poolDistribution(totalCapacity) {
  const pools = {};
  let allocated = 0;
  for (const [pool, ratio] of Object.entries(POOL_RATIOS)) {
    const amount = Number((totalCapacity * ratio).toFixed(3));
    pools[pool] = { capacity: amount, ratio, fib_alignment: FIB[Math.round(ratio * FIB[8])] || FIB[1] };
    allocated += amount;
  }
  pools.unallocated = { capacity: Number((totalCapacity - allocated).toFixed(3)), ratio: Number((1 - Object.values(POOL_RATIOS).reduce((s, r) => s + r, 0)).toFixed(3)) };
  return pools;
}

function crystallize(services, resources) {
  const plan = {};

  for (const resType of RESOURCE_TYPES) {
    const capacity = resources[resType] || 0;
    if (capacity <= 0) continue;

    const demands = {};
    for (const svc of services) {
      demands[svc.name] = svc.demands?.[resType] || 0;
    }

    const allocation = phiHarmonicResonance(demands, capacity);
    const pools = poolDistribution(capacity);
    const totalAllocated = Object.values(allocation).reduce((s, v) => s + v, 0);
    const efficiency = capacity > 0 ? totalAllocated / capacity : 0;

    plan[resType] = {
      capacity,
      allocation,
      pools,
      total_allocated: Number(totalAllocated.toFixed(3)),
      utilization: Number(efficiency.toFixed(6)),
      phi_efficiency: Number((efficiency * PHI * PSI).toFixed(6)),
      oversubscribed: Object.values(demands).reduce((s, d) => s + d, 0) > capacity,
    };
  }

  return plan;
}

function computeCoherence(plan) {
  const efficiencies = Object.values(plan).map(p => p.utilization);
  if (efficiencies.length === 0) return 0;
  const avg = efficiencies.reduce((s, e) => s + e, 0) / efficiencies.length;
  const variance = efficiencies.reduce((s, e) => s + (e - avg) ** 2, 0) / efficiencies.length;
  return Number((avg * (1 / (1 + variance * PHI))).toFixed(6));
}

const name = 'heady_resource_crystallize';

const description = 'Dynamic resource allocation using phi-harmonic resonance patterns. Crystallizes optimal compute/memory/token/bandwidth distributions across services with Fibonacci-weighted pool management.';

const inputSchema = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['crystallize', 'pool_status', 'optimize', 'history'], description: 'Resource action' },
    services: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          priority: { type: 'number' },
          demands: { type: 'object', properties: { compute: { type: 'number' }, memory: { type: 'number' }, tokens: { type: 'number' }, bandwidth: { type: 'number' } } },
        },
        required: ['name'],
      },
      description: 'Services requesting resources',
    },
    resources: {
      type: 'object',
      properties: { compute: { type: 'number' }, memory: { type: 'number' }, tokens: { type: 'number' }, bandwidth: { type: 'number' } },
      description: 'Total available resources per type',
    },
    optimization_rounds: { type: 'number', description: 'Iterative optimization rounds (default: Fib(4)=3)' },
  },
  required: ['action'],
};

async function handler(params) {
  const cid = correlationId();
  const ts = new Date().toISOString();

  try {
    switch (params.action) {
      case 'crystallize': {
        if (!Array.isArray(params.services) || params.services.length === 0) throw { code: 11001, message: 'services array required' };
        if (!params.resources || typeof params.resources !== 'object') throw { code: 11002, message: 'resources object required' };

        const plan = crystallize(params.services, params.resources);
        const coherence = computeCoherence(plan);
        const entry = { id: `alloc_${++allocSeq}`, plan, coherence, service_count: params.services.length, timestamp: ts };
        allocationHistory.push(entry);

        return { jsonrpc: '2.0', result: { allocation_id: entry.id, plan, coherence, phi_harmony: Number((coherence * PHI).toFixed(6)), service_count: params.services.length, resource_types: Object.keys(plan), csl_confidence: coherence >= CSL.HIGH ? CSL.CRITICAL : coherence >= CSL.MEDIUM ? CSL.HIGH : CSL.MEDIUM, correlation_id: cid, timestamp: ts } };
      }

      case 'pool_status': {
        if (!params.resources) throw { code: 11003, message: 'resources required for pool_status' };
        const status = {};
        for (const resType of RESOURCE_TYPES) {
          if (params.resources[resType]) status[resType] = poolDistribution(params.resources[resType]);
        }
        return { jsonrpc: '2.0', result: { pools: status, pool_ratios: POOL_RATIOS, phi: PHI, csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      case 'optimize': {
        if (!Array.isArray(params.services) || !params.resources) throw { code: 11004, message: 'services and resources required' };
        const rounds = params.optimization_rounds || FIB[4];
        const iterations = [];
        let bestPlan = null;
        let bestCoherence = 0;

        for (let r = 0; r < rounds; r++) {
          const jitteredResources = {};
          for (const [k, v] of Object.entries(params.resources)) {
            const jitter = 1 + (Math.random() - PSI) * PSI * Math.pow(PSI, r);
            jitteredResources[k] = Number((v * jitter).toFixed(3));
          }
          const plan = crystallize(params.services, jitteredResources);
          const coherence = computeCoherence(plan);
          iterations.push({ round: r, coherence, phi_decay: Number(Math.pow(PSI, r).toFixed(6)) });
          if (coherence > bestCoherence) { bestCoherence = coherence; bestPlan = plan; }
        }

        return { jsonrpc: '2.0', result: { best_plan: bestPlan, best_coherence: bestCoherence, iterations, optimization_rounds: rounds, csl_confidence: bestCoherence >= CSL.HIGH ? CSL.CRITICAL : CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      case 'history': {
        return { jsonrpc: '2.0', result: { history: allocationHistory.slice(-FIB[6]), total_allocations: allocationHistory.length, csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      default:
        throw { code: 11000, message: `Unknown action: ${params.action}` };
    }
  } catch (err) {
    const code = err.code || 11999;
    return { jsonrpc: '2.0', error: { code, message: err.message || 'Resource crystallization failed', classification: classifyError(code), correlation_id: cid, timestamp: ts } };
  }
}

function health() {
  return { status: 'healthy', resource_types: RESOURCE_TYPES.length, pool_ratios: POOL_RATIOS, allocations: allocationHistory.length, phi: PHI, timestamp: new Date().toISOString() };
}

module.exports = { name, description, inputSchema, handler, health };
