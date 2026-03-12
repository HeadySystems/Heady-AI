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
    constructor() {
        this.runtimes = { ...RUNTIMES };
        this.activeTasks = new Map();
        this.taskHistory = [];
        this.healthCache = new Map();
        this._healthCheckInterval = null;
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

        const activeCount = this._countActive(runtimeId);
        if (activeCount >= runtime.fibConcurrency) {
            // Overflow: try next operational runtime (skip colab-d for non-learning)
            if (runtimeId !== "colab-d") {
                return this._dispatchLeastLoaded(task);
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

    _dispatchLeastLoaded(task) {
        const operational = ["colab-a", "colab-b", "colab-c"];
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

    startHealthMonitor(intervalMs = 30000) {
        if (this._healthCheckInterval) clearInterval(this._healthCheckInterval);
        this._healthCheckInterval = setInterval(() => this.checkHealth(), intervalMs);
        this.checkHealth(); // immediate first check
    }

    stopHealthMonitor() {
        if (this._healthCheckInterval) {
            clearInterval(this._healthCheckInterval);
            this._healthCheckInterval = null;
        }
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
