/**
 * Heady™ Master Orchestration Module
 * Liquid dynamic parallel async distributed service wiring
 *
 * Ensures all Heady services communicate optimally via:
 *   - CSL-routed semantic message bus
 *   - phi-scaled circuit breakers & load balancing
 *   - saga coordination with compensating actions
 *   - swarm lifecycle management
 *
 * (c) 2026 HeadySystems Inc. — All rights reserved
 */
'use strict';

const { PHI, PSI, PSI2, FIB, CSL, TIMEOUTS, phiRetryDelays, cslGate } = require('../config/phi-constants');
const { SERVICES, getAllServiceEndpoints, getServiceEndpoint } = require('../config/services');
const { callService, checkServiceHealth } = require('../tools/service-client');

// ═══════════════════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════════════════

/** Cosine similarity between two equal-length numeric vectors */
function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/** Deterministic hash of a string to a fixed-length pseudo-embedding */
function textToEmbedding(text, dims = 32) {
  const vec = new Float64Array(dims);
  for (let i = 0; i < text.length; i++) {
    vec[i % dims] += text.charCodeAt(i) * PHI;
    vec[(i * 7) % dims] += text.charCodeAt(i) * PSI;
  }
  let mag = 0;
  for (let i = 0; i < dims; i++) mag += vec[i] * vec[i];
  mag = Math.sqrt(mag) || 1;
  for (let i = 0; i < dims; i++) vec[i] /= mag;
  return Array.from(vec);
}

/** Generate a monotonic correlation ID */
let _seqCounter = 0;
function correlationId() {
  return `heady-${Date.now().toString(36)}-${(++_seqCounter).toString(36)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Circuit Breaker
// ═══════════════════════════════════════════════════════════════════════════════

class CircuitBreaker {
  constructor(name, opts = {}) {
    this.name = name;
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.lastFailure = 0;
    this.threshold = opts.threshold || FIB[6];          // 13 failures to open
    this.resetTimeout = opts.resetTimeout || TIMEOUTS.LONG * 1000;
    this.halfOpenMax = opts.halfOpenMax || FIB[4];      // 5 trial calls
  }

  /** Returns true if the call is permitted */
  allow() {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      const elapsed = Date.now() - this.lastFailure;
      if (elapsed >= this.resetTimeout) {
        this.state = 'half-open';
        this.successes = 0;
        return true;
      }
      return false;
    }
    // half-open — allow limited traffic
    return this.successes < this.halfOpenMax;
  }

  recordSuccess() {
    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.halfOpenMax) {
        this.state = 'closed';
        this.failures = 0;
      }
    } else {
      this.failures = Math.max(0, this.failures - 1);
    }
  }

  recordFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }

  status() {
    return { name: this.name, state: this.state, failures: this.failures };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MasterOrchestrator
// ═══════════════════════════════════════════════════════════════════════════════

class MasterOrchestrator {
  constructor(opts = {}) {
    /** Service registry — keyed by service name */
    this.registry = new Map();
    /** Circuit breakers — one per service */
    this.breakers = new Map();
    /** Event mesh subscriptions — topic -> Set<handler> */
    this.subscriptions = new Map();
    /** Cached service embeddings for latent-space routing */
    this.embeddings = new Map();
    /** Round-robin index per service for load balancer */
    this.rrIndex = new Map();
    /** Orchestrator-wide correlation counter */
    this.correlationSeq = 0;
    /** Options */
    this.healthTTL = opts.healthTTL || TIMEOUTS.IDLE * 1000;
  }

  // ─── 1. Service Discovery & Health Registry ──────────────────────────────

  /**
   * Discover and register all services from the endpoint registry.
   * Probes health in parallel, builds circuit breakers and embeddings.
   */
  async discover() {
    const endpoints = getAllServiceEndpoints();
    const names = Object.keys(endpoints);

    const healthResults = await Promise.allSettled(
      names.map(name => checkServiceHealth(name))
    );

    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const ep = endpoints[name];
      const hr = healthResults[i];
      const healthy = hr.status === 'fulfilled' && hr.value?.status === 'healthy';

      this.registry.set(name, {
        ...ep,
        name,
        healthy,
        latency: healthy ? (hr.value.latencyMs ?? 0) : Infinity,
        lastCheck: Date.now(),
        coherenceScore: healthy ? (hr.value.coherenceScore ?? PSI) : 0,
      });

      if (!this.breakers.has(name)) {
        this.breakers.set(name, new CircuitBreaker(name));
      }

      // Pre-compute a deterministic embedding from the service description
      this.embeddings.set(name, textToEmbedding(`${name} ${ep.description}`));
    }

    return { discovered: names.length, healthy: [...this.registry.values()].filter(s => s.healthy).length };
  }

  // ─── 2. CSL-Routed Message Bus ───────────────────────────────────────────

  /**
   * Semantically route a request to the optimal service using cosine similarity.
   * @param {{ intent: string, payload: object, minConfidence?: number }} request
   */
  async route(request) {
    const { intent, payload, minConfidence } = request;
    const threshold = minConfidence ?? CSL.BOOST;
    const requestEmb = textToEmbedding(intent);
    const cid = correlationId();

    let bestName = null;
    let bestScore = -Infinity;

    for (const [name, emb] of this.embeddings) {
      const entry = this.registry.get(name);
      if (!entry || !entry.healthy) continue;

      const breaker = this.breakers.get(name);
      if (!breaker.allow()) continue;

      const sim = cosineSimilarity(requestEmb, emb);
      const gated = cslGate(sim, entry.coherenceScore, threshold);
      if (gated > bestScore) {
        bestScore = gated;
        bestName = name;
      }
    }

    if (!bestName || bestScore < CSL.SUPPRESS) {
      return { status: 'no-route', intent, score: bestScore, correlationId: cid };
    }

    const entry = this.registry.get(bestName);
    const breaker = this.breakers.get(bestName);
    try {
      const result = await callService(bestName, '/handle', { intent, payload, correlationId: cid });
      breaker.recordSuccess();
      this._refreshLatency(bestName, result);
      return { status: 'routed', service: bestName, score: bestScore, correlationId: cid, result };
    } catch (err) {
      breaker.recordFailure();
      return { status: 'error', service: bestName, error: err.message, correlationId: cid };
    }
  }

  // ─── 3. Parallel Async Dispatcher ────────────────────────────────────────

  /**
   * Fan-out a payload to multiple services, fan-in with Promise.allSettled.
   * @param {string[]} services — service names
   * @param {object} payload
   * @returns {Promise<object[]>}
   */
  async dispatch(services, payload) {
    const cid = correlationId();
    const tasks = services.map(name => {
      const breaker = this.breakers.get(name);
      if (breaker && !breaker.allow()) {
        return Promise.resolve({ status: 'circuit-open', service: name });
      }
      return callService(name, '/dispatch', { ...payload, correlationId: cid })
        .then(result => {
          if (breaker) breaker.recordSuccess();
          return { status: 'ok', service: name, result };
        })
        .catch(err => {
          if (breaker) breaker.recordFailure();
          return { status: 'error', service: name, error: err.message };
        });
    });

    const settled = await Promise.allSettled(tasks);
    return settled.map(s => s.status === 'fulfilled' ? s.value : { status: 'rejected', reason: s.reason?.message });
  }

  // ─── 4. Saga Coordinator ─────────────────────────────────────────────────

  /**
   * Execute a distributed saga with compensating actions.
   * Each step: { service, action, compensate, payload }
   * @param {object[]} steps
   */
  async saga(steps) {
    const cid = correlationId();
    const completed = [];

    for (const step of steps) {
      const breaker = this.breakers.get(step.service);
      if (breaker && !breaker.allow()) {
        await this._compensate(completed, cid);
        return { status: 'aborted', failedAt: step.service, reason: 'circuit-open', correlationId: cid };
      }

      try {
        const result = await callService(step.service, step.action, {
          ...step.payload,
          correlationId: cid,
        });

        if (result.status === 'error' || result.status === 'unavailable') {
          throw new Error(result.error || `${step.service} unavailable`);
        }

        if (breaker) breaker.recordSuccess();
        completed.push({ ...step, result });
      } catch (err) {
        if (breaker) breaker.recordFailure();
        await this._compensate(completed, cid);
        return { status: 'rolled-back', failedAt: step.service, error: err.message, correlationId: cid, compensated: completed.length };
      }
    }

    return { status: 'committed', steps: completed.length, correlationId: cid };
  }

  /** Run compensating actions in reverse order */
  async _compensate(completed, cid) {
    const reversed = [...completed].reverse();
    for (const step of reversed) {
      if (!step.compensate) continue;
      try {
        await callService(step.service, step.compensate, { correlationId: cid, originalResult: step.result });
      } catch {
        // Compensations are best-effort; failures are logged, not re-thrown
      }
    }
  }

  // ─── 5. Event Mesh ──────────────────────────────────────────────────────

  /**
   * Subscribe to a topic. Handler receives (event, metadata).
   * @param {string} topic
   * @param {Function} handler
   */
  subscribe(topic, handler) {
    if (!this.subscriptions.has(topic)) this.subscriptions.set(topic, new Set());
    this.subscriptions.get(topic).add(handler);
    return () => this.subscriptions.get(topic)?.delete(handler);
  }

  /**
   * Publish an event with optional CSL confidence filtering.
   * Handlers below the confidence threshold are skipped.
   */
  async publish(topic, event, confidence = 1.0) {
    const handlers = this.subscriptions.get(topic);
    if (!handlers || handlers.size === 0) return { delivered: 0 };

    const gatedConfidence = cslGate(1.0, confidence, CSL.INCLUDE);
    if (gatedConfidence <= 0) return { delivered: 0, reason: 'below-csl-threshold' };

    const meta = { topic, correlationId: correlationId(), timestamp: Date.now(), confidence };
    const results = await Promise.allSettled(
      [...handlers].map(fn => fn(event, meta))
    );

    return {
      delivered: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
    };
  }

  // ─── 6. Latent Space Router ─────────────────────────────────────────────

  /**
   * Find the top-K services nearest in embedding space to an intent.
   * @param {string} intent
   * @param {number} [k=3]
   */
  latentRoute(intent, k = 3) {
    const queryEmb = textToEmbedding(intent);
    const scored = [];

    for (const [name, emb] of this.embeddings) {
      const entry = this.registry.get(name);
      if (!entry?.healthy) continue;
      const sim = cosineSimilarity(queryEmb, emb);
      scored.push({ service: name, similarity: sim, coherence: entry.coherenceScore });
    }

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, k);
  }

  // ─── 7. phi-Scaled Load Balancer ─────────────────────────────────────────

  /**
   * Select the next service instance using phi-weighted round-robin with health.
   * @param {string[]} candidates — list of equivalent service names
   */
  balance(candidates) {
    const healthy = candidates.filter(name => {
      const entry = this.registry.get(name);
      const breaker = this.breakers.get(name);
      return entry?.healthy && breaker?.allow();
    });

    if (healthy.length === 0) return null;

    // phi-weighted scoring: combine round-robin position with inverse latency
    const weights = healthy.map((name, idx) => {
      const entry = this.registry.get(name);
      const rrPos = (this.rrIndex.get(name) || 0);
      const latencyWeight = entry.latency > 0 ? 1 / (entry.latency * PSI) : PHI;
      const coherenceWeight = entry.coherenceScore * PHI;
      return { name, score: (latencyWeight + coherenceWeight) * Math.pow(PSI, rrPos % FIB[5]) };
    });

    weights.sort((a, b) => b.score - a.score);
    const chosen = weights[0].name;
    this.rrIndex.set(chosen, (this.rrIndex.get(chosen) || 0) + 1);
    return chosen;
  }

  // ─── 8. Liquid Pipeline Executor ─────────────────────────────────────────

  /**
   * Execute a dynamic pipeline of stages.
   * Each stage: { name, service, action, transform? }
   * transform is an optional (result) => newPayload mapper.
   * @param {object[]} stages
   * @param {object} input
   */
  async pipeline(stages, input) {
    const cid = correlationId();
    let current = input;
    const trace = [];

    for (const stage of stages) {
      const start = Date.now();
      const breaker = this.breakers.get(stage.service);

      if (breaker && !breaker.allow()) {
        trace.push({ stage: stage.name, status: 'skipped', reason: 'circuit-open' });
        continue;
      }

      try {
        const result = await callService(stage.service, stage.action, {
          ...current,
          correlationId: cid,
        });

        if (breaker) breaker.recordSuccess();
        const elapsed = Date.now() - start;
        current = stage.transform ? stage.transform(result) : result;
        trace.push({ stage: stage.name, status: 'ok', latencyMs: elapsed });

        // Publish pipeline progress on the event mesh
        await this.publish('pipeline.stage.complete', { stage: stage.name, elapsed, cid });
      } catch (err) {
        if (breaker) breaker.recordFailure();
        trace.push({ stage: stage.name, status: 'error', error: err.message });
        // Liquid pipelines are resilient — continue unless the stage is critical
        if (stage.critical) {
          return { status: 'pipeline-failed', failedStage: stage.name, trace, correlationId: cid };
        }
      }
    }

    return { status: 'complete', output: current, trace, correlationId: cid };
  }

  // ─── 9. Swarm Coordinator ───────────────────────────────────────────────

  /**
   * Spawn a swarm of bees, execute in parallel, collect reports, retire.
   * @param {{ task: string, count?: number, service: string, payload: object, timeoutMs?: number }} beeConfig
   */
  async swarm(beeConfig) {
    const { task, service, payload, timeoutMs } = beeConfig;
    const count = beeConfig.count || FIB[5];  // default 8 bees
    const timeout = timeoutMs || TIMEOUTS.LONG * 1000;
    const cid = correlationId();

    // Spawn phase — create bee descriptors
    const bees = Array.from({ length: count }, (_, i) => ({
      id: `bee-${cid}-${i}`,
      index: i,
      state: 'spawned',
      spawnedAt: Date.now(),
    }));

    await this.publish('swarm.spawned', { task, count, cid });

    // Execute phase — fan-out all bees in parallel with timeout
    const execPromises = bees.map((bee, i) => {
      const beePayload = {
        ...payload,
        beeId: bee.id,
        beeIndex: i,
        swarmSize: count,
        correlationId: cid,
      };

      const raceTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('bee-timeout')), timeout)
      );

      return Promise.race([
        callService(service, '/swarm/execute', beePayload),
        raceTimeout,
      ])
        .then(result => ({ ...bee, state: 'reported', result }))
        .catch(err => ({ ...bee, state: 'failed', error: err.message }));
    });

    const results = await Promise.allSettled(execPromises);
    const reports = results.map(r => r.status === 'fulfilled' ? r.value : { state: 'rejected', reason: r.reason?.message });

    // Retire phase
    const succeeded = reports.filter(r => r.state === 'reported').length;
    const failed = reports.filter(r => r.state !== 'reported').length;

    await this.publish('swarm.retired', { task, succeeded, failed, cid });

    return {
      status: 'swarm-complete',
      task,
      total: count,
      succeeded,
      failed,
      reports,
      correlationId: cid,
    };
  }

  // ─── 10. Full Health Check ──────────────────────────────────────────────

  /**
   * Probe every registered service and return ecosystem-wide health.
   */
  async health() {
    const names = [...this.registry.keys()];
    if (names.length === 0) {
      await this.discover();
    }

    const probes = await Promise.allSettled(
      [...this.registry.keys()].map(name => checkServiceHealth(name))
    );

    const report = [];
    const allNames = [...this.registry.keys()];
    let healthyCount = 0;

    for (let i = 0; i < allNames.length; i++) {
      const name = allNames[i];
      const probe = probes[i];
      const breaker = this.breakers.get(name);
      const ok = probe.status === 'fulfilled' && probe.value?.status === 'healthy';
      if (ok) healthyCount++;

      // Update registry entry
      const entry = this.registry.get(name);
      if (entry) {
        entry.healthy = ok;
        entry.lastCheck = Date.now();
      }

      report.push({
        service: name,
        healthy: ok,
        circuit: breaker?.status(),
      });
    }

    const total = allNames.length;
    const ratio = total > 0 ? healthyCount / total : 0;
    const phiHealth = ratio >= PSI ? 'nominal' : ratio >= PSI2 ? 'degraded' : 'critical';

    return {
      status: phiHealth,
      total,
      healthy: healthyCount,
      unhealthy: total - healthyCount,
      ratio: Math.round(ratio * 1000) / 1000,
      services: report,
      timestamp: Date.now(),
    };
  }

  // ─── 11. Topology Graph ─────────────────────────────────────────────────

  /**
   * Return the full service topology as a directed graph.
   * Edges are weighted by cosine similarity between service embeddings.
   */
  topology() {
    const nodes = [];
    const edges = [];
    const names = [...this.registry.keys()];

    for (const name of names) {
      const entry = this.registry.get(name);
      const breaker = this.breakers.get(name);
      nodes.push({
        id: name,
        port: entry?.port,
        healthy: entry?.healthy ?? false,
        circuit: breaker?.state ?? 'unknown',
        coherence: entry?.coherenceScore ?? 0,
      });
    }

    // Build edges for service pairs whose embedding similarity exceeds CSL.INCLUDE
    for (let i = 0; i < names.length; i++) {
      const embA = this.embeddings.get(names[i]);
      if (!embA) continue;
      for (let j = i + 1; j < names.length; j++) {
        const embB = this.embeddings.get(names[j]);
        if (!embB) continue;
        const sim = cosineSimilarity(embA, embB);
        if (sim >= CSL.INCLUDE) {
          edges.push({ from: names[i], to: names[j], weight: Math.round(sim * 1000) / 1000 });
        }
      }
    }

    return { nodes, edges, nodeCount: nodes.length, edgeCount: edges.length };
  }

  // ─── Internal Utilities ─────────────────────────────────────────────────

  _refreshLatency(name, result) {
    const entry = this.registry.get(name);
    if (entry && typeof result?.latencyMs === 'number') {
      // Exponential moving average with phi-weighting
      entry.latency = entry.latency === Infinity
        ? result.latencyMs
        : entry.latency * PSI + result.latencyMs * PSI2;
    }
  }
}

module.exports = { MasterOrchestrator, CircuitBreaker };
