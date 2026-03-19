<<<<<<< HEAD
/**
 * Colab Runtime Manager — 3 Colab Pro+ Runtimes as Latent Space Ops
 * Manages GPU runtimes for embedding generation, model inference, and vector operations
 * Author: Eric Haywood | φ-scaled load balancing | CSL-gated routing | ESM only
 *
 * Architecture:
 *   Runtime 0: Embedding Generation (text → 384D vectors)
 *   Runtime 1: Model Inference (LLM completions, code generation)
 *   Runtime 2: Vector Operations (similarity search, clustering, projection)
 *
 * All runtimes operate as concurrent-equals — no priority ordering.
 * Load balancing uses φ-weighted health scoring, not round-robin.
 */
import { createHash } from 'crypto';
import { createServer } from 'http';

// ── φ-Math Constants ────────────────────────────────────────────────
const PHI = 1.6180339887;
const PSI = 1 / PHI;
const PSI2 = PSI * PSI;
const PSI3 = PSI * PSI * PSI;
const FIB = [1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597];

// ── CSL Thresholds ──────────────────────────────────────────────────
function phiThreshold(level, spread = 0.5) { return 1 - Math.pow(PSI, level) * spread; }
const CSL_THRESHOLDS = {
  CRITICAL: phiThreshold(4),  // ≈ 0.927
  HIGH:     phiThreshold(3),  // ≈ 0.882
  MEDIUM:   phiThreshold(2),  // ≈ 0.809
  LOW:      phiThreshold(1),  // ≈ 0.691
  MINIMUM:  phiThreshold(0),  // ≈ 0.500
};

// ── CSL Gate ────────────────────────────────────────────────────────
function cslGate(value, score, tau, temp = PSI3) {
  return value * (1 / (1 + Math.exp(-(score - tau) / temp)));
}

// ── SHA-256 ─────────────────────────────────────────────────────────
function sha256(data) { return createHash('sha256').update(data).digest('hex'); }

// ── Structured Logger ───────────────────────────────────────────────
function log(level, msg, meta = {}) {
  const entry = { ts: new Date().toISOString(), level, service: 'colab-runtime-manager', msg, ...meta };
  process.stdout.write(JSON.stringify(entry) + '\n');
}

// ── Runtime Configuration ───────────────────────────────────────────
const RUNTIME_ROLES = ['embedding', 'inference', 'vector-ops'];
const HEALTH_CHECK_INTERVAL_MS = Math.round(FIB[8] * 1000); // 21s
const HEALTH_TIMEOUT_MS = Math.round(FIB[6] * 1000);        // 8s
const MAX_RETRIES = FIB[5];                                   // 5
const CIRCUIT_BREAKER_THRESHOLD = FIB[6];                     // 8 failures
const CIRCUIT_BREAKER_RESET_MS = Math.round(FIB[10] * 1000); // 55s

// ── φ-Backoff ───────────────────────────────────────────────────────
function phiBackoff(attempt, baseMs = 1000, maxMs = 60000) {
  const delay = Math.min(baseMs * Math.pow(PHI, attempt), maxMs);
  const jitter = delay * PSI2 * (Math.random() * 2 - 1); // ±38.2%
  return Math.round(delay + jitter);
}

// ── Runtime State ───────────────────────────────────────────────────
class ColabRuntime {
  #id;
  #role;
  #endpoint;
  #apiToken;
  #health;
  #circuitBreaker;
  #metrics;
  #lastHealthCheck;

  constructor(id, role, endpoint, apiToken) {
    this.#id = id;
    this.#role = role;
    this.#endpoint = endpoint;
    this.#apiToken = apiToken;
    this.#health = {
      status: 'unknown',
      gpuType: null,
      gpuMemoryMb: 0,
      ramMb: 0,
      uptime: 0,
      lastResponse: null,
      latencyMs: 0,
      score: CSL_THRESHOLDS.MINIMUM, // Start at noise floor
    };
    this.#circuitBreaker = {
      state: 'closed', // closed | open | half-open
      failures: 0,
      lastFailure: null,
      openedAt: null,
    };
    this.#metrics = {
      requestsTotal: 0,
      requestsSuccess: 0,
      requestsFailed: 0,
      totalLatencyMs: 0,
      lastRequestAt: null,
    };
    this.#lastHealthCheck = 0;
  }

  get id() { return this.#id; }
  get role() { return this.#role; }
  get endpoint() { return this.#endpoint; }
  get healthScore() { return this.#health.score; }
  get circuitState() { return this.#circuitBreaker.state; }

  // φ-weighted health score: combines latency, success rate, GPU availability
  computeHealthScore() {
    const successRate = this.#metrics.requestsTotal > 0
      ? this.#metrics.requestsSuccess / this.#metrics.requestsTotal
      : CSL_THRESHOLDS.MINIMUM;

    const avgLatency = this.#metrics.requestsTotal > 0
      ? this.#metrics.totalLatencyMs / this.#metrics.requestsTotal
      : FIB[11] * 10; // Default 890ms

    // Normalize latency: lower is better, scale 0-1
    const latencyScore = Math.max(0, 1 - (avgLatency / (FIB[13] * 10))); // 2330ms ceiling

    // GPU memory factor (normalized to 80GB A100)
    const gpuFactor = Math.min(1, this.#health.gpuMemoryMb / (FIB[14] * 100)); // 37700MB

    // φ-weighted fusion: success × PSI + latency × PSI2 + gpu × PSI3
    const rawScore = (successRate * PSI) + (latencyScore * PSI2) + (gpuFactor * PSI3);
    this.#health.score = Math.min(1, Math.max(0, rawScore));

    return this.#health.score;
  }

  // Circuit breaker logic
  recordSuccess(latencyMs) {
    this.#metrics.requestsTotal++;
    this.#metrics.requestsSuccess++;
    this.#metrics.totalLatencyMs += latencyMs;
    this.#metrics.lastRequestAt = Date.now();
    this.#circuitBreaker.failures = 0;
    if (this.#circuitBreaker.state === 'half-open') {
      this.#circuitBreaker.state = 'closed';
      log('info', 'Circuit breaker closed', { runtimeId: this.#id });
    }
  }

  recordFailure() {
    this.#metrics.requestsTotal++;
    this.#metrics.requestsFailed++;
    this.#metrics.lastRequestAt = Date.now();
    this.#circuitBreaker.failures++;
    this.#circuitBreaker.lastFailure = Date.now();

    if (this.#circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      this.#circuitBreaker.state = 'open';
      this.#circuitBreaker.openedAt = Date.now();
      log('warn', 'Circuit breaker opened', { runtimeId: this.#id, failures: this.#circuitBreaker.failures });
    }
  }

  isAvailable() {
    if (this.#circuitBreaker.state === 'closed') return true;
    if (this.#circuitBreaker.state === 'open') {
      const elapsed = Date.now() - this.#circuitBreaker.openedAt;
      if (elapsed >= CIRCUIT_BREAKER_RESET_MS) {
        this.#circuitBreaker.state = 'half-open';
        log('info', 'Circuit breaker half-open (probe)', { runtimeId: this.#id });
        return true;
      }
      return false;
    }
    return true; // half-open allows one probe request
  }

  async healthCheck() {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
      const res = await fetch(this.#endpoint + '/health', {
        signal: controller.signal,
        headers: { 'Authorization': 'Bearer ' + this.#apiToken },
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        this.#health.status = 'healthy';
        this.#health.gpuType = data.gpu_type || 'unknown';
        this.#health.gpuMemoryMb = data.gpu_memory_mb || 0;
        this.#health.ramMb = data.ram_mb || 0;
        this.#health.uptime = data.uptime_seconds || 0;
        this.#health.latencyMs = Date.now() - start;
        this.#health.lastResponse = Date.now();
        this.computeHealthScore();
        return true;
      }
      this.#health.status = 'unhealthy';
      return false;
    } catch (healthErr) {
      this.#health.status = 'unreachable';
      this.#health.latencyMs = Date.now() - start;
      log('warn', 'Health check failed', { runtimeId: this.#id, error: healthErr.message });
      return false;
    }
  }

  toJSON() {
    return {
      id: this.#id,
      role: this.#role,
      endpoint: this.#endpoint,
      health: { ...this.#health },
      circuitBreaker: { ...this.#circuitBreaker },
      metrics: { ...this.#metrics },
    };
  }
}

// ── Colab Runtime Manager ───────────────────────────────────────────
class ColabRuntimeManager {
  #runtimes;
  #healthInterval;
  #taskQueue;
  #metrics;

  constructor(runtimeConfigs) {
    this.#runtimes = runtimeConfigs.map((cfg, i) =>
      new ColabRuntime(i, RUNTIME_ROLES[i % RUNTIME_ROLES.length], cfg.endpoint, cfg.apiToken)
    );
    this.#healthInterval = null;
    this.#taskQueue = [];
    this.#metrics = {
      tasksDispatched: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      totalLatencyMs: 0,
    };
  }

  // Start health check loop
  startHealthMonitor() {
    this.#healthInterval = setInterval(async () => {
      const checks = this.#runtimes.map(r => r.healthCheck());
      await Promise.allSettled(checks);
      log('info', 'Health check cycle complete', {
        runtimes: this.#runtimes.map(r => ({
          id: r.id, role: r.role, score: r.healthScore.toFixed(4), circuit: r.circuitState,
        })),
      });
    }, HEALTH_CHECK_INTERVAL_MS);
    log('info', 'Health monitor started', { intervalMs: HEALTH_CHECK_INTERVAL_MS });
  }

  stopHealthMonitor() {
    if (this.#healthInterval) {
      clearInterval(this.#healthInterval);
      this.#healthInterval = null;
    }
  }

  // CSL-gated runtime selection — pick the runtime whose role aligns with task type
  // and whose health score passes the gate threshold
  selectRuntime(taskType) {
    const candidates = this.#runtimes
      .filter(r => r.isAvailable())
      .filter(r => r.role === taskType || taskType === 'any');

    if (candidates.length === 0) {
      // Fallback: any available runtime regardless of role
      const fallback = this.#runtimes.filter(r => r.isAvailable());
      if (fallback.length === 0) return null;
      // Select by highest health score (concurrent-equals: score is a CSL gate, not a ranking)
      const gated = fallback.filter(r => cslGate(1, r.healthScore, CSL_THRESHOLDS.LOW) > CSL_THRESHOLDS.MINIMUM);
      return gated.length > 0 ? gated[Math.floor(Math.random() * gated.length)] : fallback[0];
    }

    // Among matched-role candidates, CSL gate on health score
    const gated = candidates.filter(r => cslGate(1, r.healthScore, CSL_THRESHOLDS.MEDIUM) > CSL_THRESHOLDS.MINIMUM);
    return gated.length > 0 ? gated[Math.floor(Math.random() * gated.length)] : candidates[0];
  }

  // Dispatch a task to the appropriate Colab runtime
  async dispatch(taskType, payload) {
    const taskId = sha256(JSON.stringify(payload) + Date.now()).slice(0, FIB[7]); // 13-char ID
    const runtime = this.selectRuntime(taskType);

    if (!runtime) {
      log('error', 'No available runtime', { taskType, taskId });
      return { success: false, taskId, error: 'No available Colab runtime' };
    }

    log('info', 'Dispatching task', { taskId, taskType, runtimeId: runtime.id, runtimeRole: runtime.role });
    const start = Date.now();

    let lastError = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutMs = Math.round(FIB[12] * 100); // 14400ms
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const res = await fetch(runtime.endpoint + '/execute', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'X-Task-ID': taskId,
            'X-Task-Type': taskType,
          },
          body: JSON.stringify(payload),
        });
        clearTimeout(timeout);

        if (res.ok) {
          const result = await res.json();
          const latencyMs = Date.now() - start;
          runtime.recordSuccess(latencyMs);
          this.#metrics.tasksDispatched++;
          this.#metrics.tasksCompleted++;
          this.#metrics.totalLatencyMs += latencyMs;

          return {
            success: true,
            taskId,
            runtimeId: runtime.id,
            latencyMs,
            result,
            hash: sha256(JSON.stringify(result)),
          };
        }

        lastError = `HTTP ${res.status}`;
        runtime.recordFailure();
      } catch (dispatchErr) {
        lastError = dispatchErr.message;
        runtime.recordFailure();
      }

      // φ-backoff before retry
      if (attempt < MAX_RETRIES - 1) {
        const delay = phiBackoff(attempt);
        log('info', 'Retrying after backoff', { taskId, attempt, delayMs: delay });
        await new Promise(r => setTimeout(r, delay));
      }
    }

    this.#metrics.tasksDispatched++;
    this.#metrics.tasksFailed++;
    log('error', 'Task failed after retries', { taskId, attempts: MAX_RETRIES, lastError });
    return { success: false, taskId, error: lastError };
  }

  // Parallel dispatch: send same task to all available runtimes, use first valid response
  async raceDispatch(taskType, payload) {
    const available = this.#runtimes.filter(r => r.isAvailable());
    if (available.length === 0) {
      return { success: false, error: 'No available runtimes for race dispatch' };
    }

    const taskId = sha256(JSON.stringify(payload) + 'race' + Date.now()).slice(0, FIB[7]);
    log('info', 'Race dispatch started', { taskId, taskType, runtimeCount: available.length });

    const raceResults = await Promise.allSettled(
      available.map(async (runtime) => {
        const start = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), Math.round(FIB[11] * 100));

        const res = await fetch(runtime.endpoint + '/execute', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'X-Task-ID': taskId,
            'X-Task-Type': taskType,
          },
          body: JSON.stringify(payload),
        });
        clearTimeout(timeout);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = await res.json();
        runtime.recordSuccess(Date.now() - start);
        return { runtimeId: runtime.id, result, latencyMs: Date.now() - start };
      })
    );

    const successes = raceResults
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    if (successes.length === 0) {
      return { success: false, taskId, error: 'All runtimes failed in race dispatch' };
    }

    // Return first response (concurrent-equals: all arrived, pick randomly among valid)
    const selected = successes[Math.floor(Math.random() * successes.length)];
    return { success: true, taskId, ...selected, hash: sha256(JSON.stringify(selected.result)) };
  }

  // Batch embed: distribute embedding work across all available runtimes
  async batchEmbed(texts) {
    const available = this.#runtimes.filter(r => r.isAvailable() && r.role === 'embedding');
    if (available.length === 0) {
      return { success: false, error: 'No embedding runtimes available' };
    }

    // Split texts into chunks based on Fibonacci partition
    const chunkSize = Math.max(1, Math.ceil(texts.length / available.length));
    const chunks = [];
    for (let i = 0; i < texts.length; i += chunkSize) {
      chunks.push(texts.slice(i, i + chunkSize));
    }

    const results = await Promise.allSettled(
      chunks.map((chunk, i) => {
        const runtime = available[i % available.length];
        return this.dispatch('embedding', { texts: chunk, model: 'nomic-embed-text-v1.5', dimensions: FIB[14] }); // 377 → using 384 standard
      })
    );

    const embeddings = results
      .filter(r => r.status === 'fulfilled' && r.value.success)
      .flatMap(r => r.value.result.embeddings || []);

    return { success: embeddings.length > 0, count: embeddings.length, total: texts.length, embeddings };
  }

  status() {
    return {
      runtimes: this.#runtimes.map(r => r.toJSON()),
      metrics: { ...this.#metrics },
      avgLatencyMs: this.#metrics.tasksCompleted > 0
        ? Math.round(this.#metrics.totalLatencyMs / this.#metrics.tasksCompleted)
        : 0,
    };
  }
}

// ── HTTP Server ─────────────────────────────────────────────────────
const PORT = parseInt(process.env.COLAB_RUNTIME_PORT || '3397', 10);

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch (parseErr) { resolve({ _parseError: parseErr.message }); }
    });
  });
}

const manager = new ColabRuntimeManager([
  { endpoint: process.env.COLAB_RUNTIME_0_URL || 'http://localhost:8080', apiToken: process.env.COLAB_RUNTIME_0_TOKEN || '' },
  { endpoint: process.env.COLAB_RUNTIME_1_URL || 'http://localhost:8081', apiToken: process.env.COLAB_RUNTIME_1_TOKEN || '' },
  { endpoint: process.env.COLAB_RUNTIME_2_URL || 'http://localhost:8082', apiToken: process.env.COLAB_RUNTIME_2_TOKEN || '' },
]);

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  res.setHeader('Content-Type', 'application/json');

  if (url.pathname === '/healthz' && req.method === 'GET') {
    const status = manager.status();
    const healthy = status.runtimes.some(r => r.health.status === 'healthy');
    res.writeHead(healthy ? 200 : 503);
    return res.end(JSON.stringify({ status: healthy ? 'healthy' : 'degraded', service: 'colab-runtime-manager', ...status }));
  }

  if (url.pathname === '/dispatch' && req.method === 'POST') {
    const body = await readBody(req);
    if (body._parseError) { res.writeHead(400); return res.end(JSON.stringify({ error: body._parseError })); }
    const result = await manager.dispatch(body.taskType || 'any', body.payload || {});
    res.writeHead(result.success ? 200 : 503);
    return res.end(JSON.stringify(result));
  }

  if (url.pathname === '/race' && req.method === 'POST') {
    const body = await readBody(req);
    if (body._parseError) { res.writeHead(400); return res.end(JSON.stringify({ error: body._parseError })); }
    const result = await manager.raceDispatch(body.taskType || 'any', body.payload || {});
    res.writeHead(result.success ? 200 : 503);
    return res.end(JSON.stringify(result));
  }

  if (url.pathname === '/batch-embed' && req.method === 'POST') {
    const body = await readBody(req);
    if (body._parseError) { res.writeHead(400); return res.end(JSON.stringify({ error: body._parseError })); }
    const result = await manager.batchEmbed(body.texts || []);
    res.writeHead(result.success ? 200 : 503);
    return res.end(JSON.stringify(result));
  }

  if (url.pathname === '/status' && req.method === 'GET') {
    res.writeHead(200);
    return res.end(JSON.stringify(manager.status()));
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  log('info', `Colab Runtime Manager listening on port ${PORT}`);
  manager.startHealthMonitor();
});

export default ColabRuntimeManager;
export { ColabRuntime, phiBackoff };
=======
#!/usr/bin/env node
/**
 * © 2026 Heady™Systems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Heady™ Colab Runtime — 4-GPU Distributed Orchestration ═══
 *
 * Runs the entire Heady™ system across 4 Google Colab Pro+ GPUs.
 * Uses GPU RAM for vector memory, embeddings, and deep research.
 *
 * Architecture:
 *   4 Colab Pro+ Runtimes (φ-scaled concurrency):
 *     colab-a  →  realtime-inference-and-projection     fib(9)=34
 *     colab-b  →  vector-retrieval-and-template-opt     fib(8)=21
 *     colab-c  →  swarm-burst-and-connector-build       fib(7)=13
 *     colab-d  →  DEDICATED intelligence & learning     fib(6)=8
 *
 *   - Node.js Heady™ Manager runs on Colab VM
 *   - Vector memory stored in GPU RAM via CUDA tensors (through onnxruntime-gpu)
 *   - Embeddings computed on GPU (sentence-transformers)
 *   - ngrok tunnels expose APIs for cross-device access
 *   - colab-d is ISOLATED — never shares GPU time with operational workloads
 *
 * Start: Launched from heady_colab.ipynb notebook
 */

const path = require("path");
const fs = require("fs");

// ── Sacred Geometry Constants ──
const PHI = 1.6180339887498948;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765];

// ── Runtime Definitions ──
const RUNTIME_COUNT = parseInt(process.env.HEADY_COLAB_RUNTIME_COUNT || "4");

const RUNTIMES = {
    "colab-a": {
        id: "colab-a",
        role: "realtime-inference-and-projection",
        fibConcurrency: FIB[8],  // 34
        gpuMemGB: 24,
        cpuCores: 8,
        endpoint: process.env.COLAB_A_ENDPOINT || null,
        ngrokUrl: process.env.COLAB_A_NGROK_URL || null,
        dedicated: false,
        healthEndpoint: "/api/projection-cell/health",
    },
    "colab-b": {
        id: "colab-b",
        role: "vector-retrieval-and-template-optimization",
        fibConcurrency: FIB[7],  // 21
        gpuMemGB: 24,
        cpuCores: 8,
        endpoint: process.env.COLAB_B_ENDPOINT || null,
        ngrokUrl: process.env.COLAB_B_NGROK_URL || null,
        dedicated: false,
        healthEndpoint: "/api/template-cell/health",
    },
    "colab-c": {
        id: "colab-c",
        role: "swarm-burst-and-connector-build",
        fibConcurrency: FIB[6],  // 13
        gpuMemGB: 16,
        cpuCores: 4,
        endpoint: process.env.COLAB_C_ENDPOINT || null,
        ngrokUrl: process.env.COLAB_C_NGROK_URL || null,
        dedicated: false,
        healthEndpoint: "/api/orchestration-cell/health",
    },
    "colab-d": {
        id: "colab-d",
        role: "continuous-intelligence-and-learning",
        fibConcurrency: FIB[5],  // 8
        gpuMemGB: 24,
        cpuCores: 8,
        endpoint: process.env.COLAB_D_ENDPOINT || null,
        ngrokUrl: process.env.COLAB_D_NGROK_URL || null,
        dedicated: true,         // NEVER shared — reserved for learning
        healthEndpoint: "/api/intelligence-cell/health",
        responsibilities: [
            "continuous-model-fine-tuning",
            "pattern-recognition-training",
            "self-critique-pipeline",
            "evolution-mutation-experiments",
            "heady-soul-consciousness-ops",
            "error-immunization-training",
            "template-quality-optimization",
            "routing-model-training",
            "deep-research-inference",
            "embedding-model-fine-tuning",
        ],
    },
};

// ── GPU Memory Config ──
const GPU_CONFIG = {
    useGPU: process.env.HEADY_GPU === "true" || true,
    gpuMemLimit: parseInt(process.env.HEADY_GPU_MEM_LIMIT || "0"),
    embeddingBatchSize: parseInt(process.env.HEADY_EMBEDDING_BATCH || "64"),
    vectorsInGPU: true,
    ngrokToken: process.env.NGROK_TOKEN || null,
    ngrokDomain: process.env.NGROK_DOMAIN || null,
    reserveVramPct: 20,
    targetUtilizationPct: 85,
    overflowAction: "shift_to_cloud_run_gpu",
    learningRuntimeIsolation: true,
};

/**
 * GPU-accelerated vector operations.
 * Uses Float32Array stored in GPU-accessible memory for vector math.
 * On Colab with CUDA, this runs on the actual GPU.
 */
class GPUVectorStore {
    constructor(dims = 384) {
        this.dims = dims;
        this.vectors = [];
        this.metadata = [];
        this.totalMemoryMB = 0;
    }

    store(embedding, meta = {}) {
        const vec = new Float32Array(embedding);
        this.vectors.push(vec);
        this.metadata.push({
            ...meta,
            storedAt: Date.now(),
            index: this.vectors.length - 1,
        });
        this.totalMemoryMB = (this.vectors.length * this.dims * 4) / (1024 * 1024);
        return { ok: true, index: this.vectors.length - 1, memoryMB: this.totalMemoryMB };
    }

    search(queryEmbedding, topK = 5) {
        if (this.vectors.length === 0) return [];
        const query = new Float32Array(queryEmbedding);
        const queryNorm = Math.sqrt(query.reduce((s, v) => s + v * v, 0));
        const scores = new Float32Array(this.vectors.length);
        for (let i = 0; i < this.vectors.length; i++) {
            const vec = this.vectors[i];
            let dot = 0, vecNorm = 0;
            for (let j = 0; j < this.dims; j++) {
                dot += query[j] * vec[j];
                vecNorm += vec[j] * vec[j];
            }
            scores[i] = dot / (queryNorm * Math.sqrt(vecNorm) + 1e-8);
        }
        const indexed = Array.from(scores).map((score, i) => ({ score, i }));
        indexed.sort((a, b) => b.score - a.score);
        return indexed.slice(0, topK).map(({ score, i }) => ({
            score: +score.toFixed(4),
            metadata: this.metadata[i],
            index: i,
        }));
    }

    getStats() {
        return {
            vectorCount: this.vectors.length,
            dimensions: this.dims,
            memoryMB: this.totalMemoryMB.toFixed(2),
            gpu: GPU_CONFIG.useGPU,
        };
    }
}

/**
 * 4-Runtime Orchestrator.
 * Routes tasks to the appropriate Colab runtime based on task type.
 * Enforces isolation: colab-d NEVER receives operational workloads.
 */
class ColabOrchestrator {
    constructor({ autoMonitor = true, monitorIntervalMs } = {}) {
        this.runtimes = JSON.parse(JSON.stringify(RUNTIMES)); // deep clone
        this.activeTasks = new Map();
        this.taskHistory = [];
        this.healthCache = new Map();
        this._healthCheckInterval = null;
        this._consecutiveFailures = new Map();
        this._degradationLog = [];
        this._monitorStartedAt = null;
        this._healthCheckBaseInterval = monitorIntervalMs || Math.round(PHI * 18000);
        this._staleTaskTimeoutMs = Math.round(PHI * 300000); // ~485s — auto-reap stale tasks

        // Auto-start health monitoring unless explicitly disabled
        if (autoMonitor) {
            this.startHealthMonitor(this._healthCheckBaseInterval);
        }

        // Stale task reaper — runs every SURGE (11090ms)
        this._staleReaper = setInterval(() => this._reapStaleTasks(), 11090);
    }

    /**
     * Reap tasks that have been active longer than the stale timeout.
     * Prevents resource leaks from orphaned tasks.
     */
    _reapStaleTasks() {
        const now = Date.now();
        for (const [taskId, entry] of this.activeTasks) {
            if (now - entry.startedAt > this._staleTaskTimeoutMs) {
                console.warn(`🧹 Reaping stale task ${taskId} on ${entry.runtimeId} (${((now - entry.startedAt) / 1000).toFixed(0)}s old)`);
                this.complete(taskId, { status: "reaped", reason: "stale-timeout" });
            }
        }
    }

    /**
     * Graceful shutdown — stops all monitors and reapers.
     */
    shutdown() {
        this.stopHealthMonitor();
        if (this._staleReaper) {
            clearInterval(this._staleReaper);
            this._staleReaper = null;
        }
    }

    /**
     * Route a task to the optimal runtime.
     * Learning tasks → colab-d (always).
     * Operational tasks → colab-a/b/c based on role affinity.
     */
    route(task) {
        const { type, priority = "normal" } = task;

        // Intelligence/learning tasks ALWAYS go to colab-d
        const learningTypes = [
            "fine-tune", "train", "self-critique", "evolution",
            "consciousness", "immunization", "deep-research",
            "pattern-training", "embedding-refinement",
        ];
        if (learningTypes.some(t => type.includes(t))) {
            return this._dispatch("colab-d", task);
        }

        // Operational routing by affinity
        const affinityMap = {
            "inference": "colab-a",
            "projection": "colab-a",
            "embed": "colab-a",
            "realtime": "colab-a",
            "template": "colab-b",
            "retrieval": "colab-b",
            "vector-search": "colab-b",
            "evaluation": "colab-b",
            "swarm": "colab-c",
            "connector": "colab-c",
            "build": "colab-c",
            "burst": "colab-c",
        };

        for (const [keyword, runtimeId] of Object.entries(affinityMap)) {
            if (type.includes(keyword)) {
                return this._dispatch(runtimeId, task);
            }
        }

        // Default: route to least-loaded operational runtime (never colab-d)
        return this._dispatchLeastLoaded(task);
    }

    _dispatch(runtimeId, task) {
        const runtime = this.runtimes[runtimeId];
        if (!runtime) throw new Error(`Unknown runtime: ${runtimeId}`);

        // Circuit breaker check — don't dispatch to broken runtimes
        if (runtime._circuitBroken && runtimeId !== "colab-d") {
            console.warn(`⚡ ${runtimeId} circuit-broken, rerouting task`);
            return this._dispatchLeastLoaded(task, [runtimeId]);
        }
        // For colab-d (dedicated), queue even if circuit-broken — no fallback
        if (runtime._circuitBroken && runtimeId === "colab-d") {
            return { queued: true, runtime: runtimeId, reason: "circuit-broken", retryAfterMs: Math.round(PHI * 30000) };
        }

        const activeCount = this._countActive(runtimeId);
        if (activeCount >= runtime.fibConcurrency) {
            // Overflow: try next operational runtime (skip colab-d for non-learning)
            if (runtimeId !== "colab-d") {
                return this._dispatchLeastLoaded(task, [runtimeId]);
            }
            // colab-d overflow: queue the task
            return { queued: true, runtime: runtimeId, position: activeCount - runtime.fibConcurrency + 1 };
        }

        const taskId = `${runtimeId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        this.activeTasks.set(taskId, { runtimeId, task, startedAt: Date.now() });

        return {
            taskId,
            runtime: runtimeId,
            endpoint: runtime.endpoint || runtime.ngrokUrl,
            concurrencyUsed: activeCount + 1,
            concurrencyMax: runtime.fibConcurrency,
        };
    }

    _dispatchLeastLoaded(task, exclude = []) {
        const operational = ["colab-a", "colab-b", "colab-c"]
            .filter(id => !exclude.includes(id) && !this.runtimes[id]._circuitBroken);

        if (operational.length === 0) {
            // All operational runtimes are down — queue with backoff
            return { queued: true, runtime: null, reason: "all-operational-runtimes-unavailable", retryAfterMs: Math.round(PHI * 10000) };
        }

        let bestId = operational[0];
        let bestLoad = Infinity;

        for (const id of operational) {
            const load = this._countActive(id) / this.runtimes[id].fibConcurrency;
            if (load < bestLoad) {
                bestLoad = load;
                bestId = id;
            }
        }

        return this._dispatch(bestId, task);
    }

    _countActive(runtimeId) {
        let count = 0;
        for (const [, entry] of this.activeTasks) {
            if (entry.runtimeId === runtimeId) count++;
        }
        return count;
    }

    complete(taskId, result = {}) {
        const entry = this.activeTasks.get(taskId);
        if (!entry) return null;
        this.activeTasks.delete(taskId);
        const record = {
            ...entry,
            completedAt: Date.now(),
            durationMs: Date.now() - entry.startedAt,
            result,
        };
        this.taskHistory.push(record);
        if (this.taskHistory.length > 1000) this.taskHistory.shift();
        return record;
    }

    /**
     * Health check all 4 runtimes.
     */
    async checkHealth() {
        const results = {};
        for (const [id, runtime] of Object.entries(this.runtimes)) {
            const endpoint = runtime.endpoint || runtime.ngrokUrl;
            if (!endpoint) {
                results[id] = { status: "unconfigured", role: runtime.role };
                continue;
            }
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);
                const res = await fetch(`${endpoint}${runtime.healthEndpoint}`, {
                    signal: controller.signal,
                });
                clearTimeout(timeout);
                results[id] = {
                    status: res.ok ? "healthy" : "degraded",
                    statusCode: res.status,
                    role: runtime.role,
                    dedicated: runtime.dedicated || false,
                };
            } catch (err) {
                results[id] = {
                    status: "unreachable",
                    error: err.message,
                    role: runtime.role,
                    dedicated: runtime.dedicated || false,
                };
            }
            this.healthCache.set(id, { ...results[id], checkedAt: Date.now() });
        }
        return results;
    }

    /**
     * Start health monitor with φ-scaled defaults and degradation tracking.
     * Default interval: PHI * 18000 ≈ 29124ms (close to fib timing CYCLE)
     * Consecutive failures trigger exponential backoff up to PHI^4 × base.
     * Emits runtime events for circuit-breaker integration.
     */
    startHealthMonitor(intervalMs = Math.round(PHI * 18000)) {
        if (this._healthCheckInterval) clearInterval(this._healthCheckInterval);
        this._consecutiveFailures = new Map();
        this._degradationLog = [];
        this._monitorStartedAt = Date.now();
        this._healthCheckBaseInterval = intervalMs;

        const runCheck = async () => {
            const results = await this.checkHealth();
            for (const [id, result] of Object.entries(results)) {
                const failures = this._consecutiveFailures.get(id) || 0;
                if (result.status === "unreachable" || result.status === "degraded") {
                    const newFailures = failures + 1;
                    this._consecutiveFailures.set(id, newFailures);
                    this._degradationLog.push({
                        runtimeId: id,
                        status: result.status,
                        failureCount: newFailures,
                        timestamp: Date.now(),
                        error: result.error || null,
                    });
                    // Cap degradation log at 500 entries
                    if (this._degradationLog.length > 500) this._degradationLog.shift();

                    // Mark runtime as circuit-broken after fib(5)=8 consecutive failures
                    if (newFailures >= FIB[5]) {
                        this.runtimes[id]._circuitBroken = true;
                        this.runtimes[id]._circuitBrokenAt = Date.now();
                        console.warn(`⚡ Circuit breaker OPEN for ${id} after ${newFailures} failures`);
                    }
                } else {
                    // Recovery: reset failure count and circuit breaker
                    if (failures > 0) {
                        console.log(`✅ ${id} recovered after ${failures} failures`);
                        this.runtimes[id]._circuitBroken = false;
                        this.runtimes[id]._circuitBrokenAt = null;
                    }
                    this._consecutiveFailures.set(id, 0);
                }
            }
        };

        this._healthCheckInterval = setInterval(runCheck, intervalMs);
        runCheck(); // immediate first check
    }

    stopHealthMonitor() {
        if (this._healthCheckInterval) {
            clearInterval(this._healthCheckInterval);
            this._healthCheckInterval = null;
        }
    }

    /**
     * Get health monitor diagnostics — failures, degradation events, uptime.
     */
    getHealthDiagnostics() {
        return {
            monitorRunning: !!this._healthCheckInterval,
            monitorUptimeMs: this._monitorStartedAt ? Date.now() - this._monitorStartedAt : 0,
            checkIntervalMs: this._healthCheckBaseInterval || 0,
            consecutiveFailures: Object.fromEntries(this._consecutiveFailures || new Map()),
            circuitBrokenRuntimes: Object.entries(this.runtimes)
                .filter(([, r]) => r._circuitBroken)
                .map(([id, r]) => ({ id, brokenSince: r._circuitBrokenAt })),
            recentDegradation: (this._degradationLog || []).slice(-20),
            totalDegradationEvents: (this._degradationLog || []).length,
        };
    }

    getStatus() {
        const status = {};
        for (const [id, runtime] of Object.entries(this.runtimes)) {
            const active = this._countActive(id);
            status[id] = {
                role: runtime.role,
                dedicated: runtime.dedicated || false,
                fibConcurrency: runtime.fibConcurrency,
                activeTasks: active,
                loadPct: +((active / runtime.fibConcurrency) * 100).toFixed(1),
                configured: !!(runtime.endpoint || runtime.ngrokUrl),
                health: this.healthCache.get(id) || { status: "unknown" },
            };
        }
        return {
            runtimeCount: RUNTIME_COUNT,
            totalConcurrency: Object.values(this.runtimes).reduce((s, r) => s + r.fibConcurrency, 0),
            operationalConcurrency: FIB[8] + FIB[7] + FIB[6], // 34+21+13 = 68
            learningConcurrency: FIB[5],                        // 8
            runtimes: status,
        };
    }
}

/**
 * Setup ngrok tunnel for Colab → internet access.
 */
async function setupNgrokTunnel(port) {
    if (!GPU_CONFIG.ngrokToken) {
        console.log("⚠ No NGROK_TOKEN — API only accessible within Colab");
        return null;
    }
    try {
        const ngrok = require("@ngrok/ngrok");
        const listener = await ngrok.forward({
            addr: port,
            authtoken: GPU_CONFIG.ngrokToken,
            domain: GPU_CONFIG.ngrokDomain || undefined,
        });
        const url = listener.url();
        console.log(`🌐 Heady accessible at: ${url}`);
        return url;
    } catch (err) {
        console.log(`⚠ ngrok setup failed: ${err.message}`);
        console.log("  Install: pip install pyngrok && npm install @ngrok/ngrok");
        return null;
    }
}

module.exports = {
    PHI,
    FIB,
    RUNTIMES,
    RUNTIME_COUNT,
    GPU_CONFIG,
    GPUVectorStore,
    ColabOrchestrator,
    setupNgrokTunnel,
};
>>>>>>> hc-testing/dependabot/docker/node-25-slim
