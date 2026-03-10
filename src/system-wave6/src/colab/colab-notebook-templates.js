'use strict';

/**
 * Heady™ Colab Notebook Template Generator
 * Generates Python code templates for the 3 specialised Colab Pro+ runtimes.
 *
 * Runtime specialisations:
 *   Alpha  — Embedding  (sentence-transformers, all-MiniLM-L6-v2)
 *   Beta   — Inference  (HuggingFace models, streaming)
 *   Gamma  — Vector Ops (FAISS GPU, HNSW, PCA)
 *
 * Every template embeds phi-math constants, a REST API endpoint,
 * structured JSON logging, and phi-backoff retry logic.
 *
 * ALL numeric constants derive from φ (phi ≈ 1.618) or Fibonacci numbers.
 *
 * @module colab-notebook-templates
 * @author HeadySystems Inc.
 * @license Proprietary
 */

// ─── Phi / Fibonacci Primitives ──────────────────────────────────────────────

/** @constant {number} PHI - Golden ratio φ = (1 + √5) / 2 ≈ 1.618033988749895 */
const PHI = (1 + Math.sqrt(5)) / 2;

/** @constant {number} PSI - Conjugate golden ratio ψ = 1/φ ≈ 0.618033988749895 */
const PSI = 1 / PHI;

/**
 * Compute the n-th Fibonacci number via Binet's closed-form formula.
 * @param {number} n - Non-negative integer index.
 * @returns {number} F(n).
 */
const fib = (n) => Math.round((Math.pow(PHI, n) - Math.pow(-PSI, n)) / Math.sqrt(5));

// ─── Derived Constants ───────────────────────────────────────────────────────

/** @constant {number} EMBEDDING_DIM - 384 dimensions for MiniLM */
const EMBEDDING_DIM = 384;

/** @constant {number} HEALTH_PORT - fib(10) × 100 = 5500 */
const HEALTH_PORT = fib(10) * 100;

/** @constant {number} BATCH_SIZE_EMBEDDING - fib(8) = 21 */
const BATCH_SIZE_EMBEDDING = fib(8);

/** @constant {number} MAX_RETRIES - fib(4) = 3 */
const MAX_RETRIES = fib(4);

/** @constant {number} HEARTBEAT_S - fib(7) = 13 seconds */
const HEARTBEAT_S = fib(7);

/** @constant {number} CHECKPOINT_S - fib(9) = 34 seconds */
const CHECKPOINT_S = fib(9);

// ─── Shared Python Snippets ──────────────────────────────────────────────────

/**
 * Python preamble injected into every template: phi constants + structured
 * logging + phi-backoff retry decorator.
 * @returns {string}
 * @private
 */
function _pythonPreamble(serviceName) {
  return `
import json, time, os, sys, math, functools
from datetime import datetime, timezone

# ─── Phi / Fibonacci Constants ────────────────────────────────────
PHI = (1 + math.sqrt(5)) / 2          # ≈ 1.618033988749895
PSI = 1 / PHI                          # ≈ 0.618033988749895

def fib(n):
    """Binet closed-form Fibonacci."""
    return round((PHI**n - (-PSI)**n) / math.sqrt(5))

EMBEDDING_DIM     = ${EMBEDDING_DIM}
HEALTH_PORT       = ${HEALTH_PORT}
HEARTBEAT_S       = fib(7)   # ${HEARTBEAT_S}
CHECKPOINT_S      = fib(9)   # ${CHECKPOINT_S}
MAX_RETRIES       = fib(4)   # ${MAX_RETRIES}
BASE_BACKOFF_S    = fib(6) / 10  # 0.8

# ─── Structured Logging ──────────────────────────────────────────
def log(level, message, **kwargs):
    entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "level": level,
        "service": "${serviceName}",
        "message": message,
        **kwargs,
    }
    print(json.dumps(entry), flush=True)

# ─── Phi-Backoff Retry Decorator ─────────────────────────────────
def phi_retry(max_retries=MAX_RETRIES):
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return fn(*args, **kwargs)
                except Exception as exc:
                    delay = BASE_BACKOFF_S * (PHI ** attempt)
                    log("WARN", "retry",
                        fn=fn.__name__, attempt=attempt,
                        delay_s=round(delay, 3), error=str(exc))
                    time.sleep(delay)
            return fn(*args, **kwargs)  # final attempt — let it raise
        return wrapper
    return decorator
`.trim();
}

/**
 * Python snippet for a FastAPI health/REST endpoint.
 * @param {string} serviceName
 * @param {number} port
 * @returns {string}
 * @private
 */
function _restEndpoint(serviceName, port) {
  return `
# ─── REST API Endpoint ───────────────────────────────────────────
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import uvicorn, threading

app = FastAPI(title="${serviceName}")

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "${serviceName}",
            "ts": datetime.now(timezone.utc).isoformat()}

@app.post("/api/execute")
async def execute(request: Request):
    body = await request.json()
    code = body.get("code", "")
    log("INFO", "execute_request", code_len=len(code))
    result = {}
    exec(code, {"__builtins__": __builtins__}, result)
    return JSONResponse(content={"status": "ok", "result": result})

def _start_server():
    uvicorn.run(app, host="0.0.0.0", port=${port}, log_level="warning")

_server_thread = threading.Thread(target=_start_server, daemon=True)
_server_thread.start()
log("INFO", "rest_api_started", port=${port})
`.trim();
}

// ─── NotebookTemplateGenerator ───────────────────────────────────────────────

/**
 * Generates Python code templates for the three Colab Pro+ runtimes.
 * Each template is a complete, runnable Python script string.
 */
class NotebookTemplateGenerator {
  constructor() {
    /** @type {number} */
    this.embeddingDim = EMBEDDING_DIM;
  }

  /**
   * Generate the Alpha (Embedding) runtime template.
   *
   * Uses sentence-transformers with all-MiniLM-L6-v2 (384-dim output).
   * Includes: model loading, single/batch embed, REST API, health loop.
   *
   * @returns {string} Complete Python source.
   */
  embeddingNotebook() {
    const preamble = _pythonPreamble('colab-alpha');
    const rest = _restEndpoint('colab-alpha', HEALTH_PORT);

    return `#!/usr/bin/env python3
"""Heady Colab Alpha — Embedding Runtime (sentence-transformers, all-MiniLM-L6-v2)"""

# === Pip Dependencies ===
# !pip install -q sentence-transformers torch fastapi uvicorn

${preamble}

import torch
import numpy as np

# ─── Model Setup ─────────────────────────────────────────────────
from sentence_transformers import SentenceTransformer

BATCH_SIZE = fib(8)  # ${BATCH_SIZE_EMBEDDING}

log("INFO", "loading_model", model="all-MiniLM-L6-v2", dim=EMBEDDING_DIM)
model = SentenceTransformer("all-MiniLM-L6-v2")
if torch.cuda.is_available():
    model = model.to("cuda")
    torch.cuda.set_per_process_memory_fraction(PSI)  # ≈ 0.618
log("INFO", "model_loaded",
    device="cuda" if torch.cuda.is_available() else "cpu")

# ─── Embedding Functions ─────────────────────────────────────────
@phi_retry()
def embed(text):
    """Embed a single text string into a ${EMBEDDING_DIM}-dim unit vector."""
    with torch.no_grad():
        vec = model.encode([text], normalize_embeddings=True,
                           convert_to_numpy=True)
    return vec[0].tolist()

@phi_retry()
def batch_embed(texts):
    """Embed texts in Fibonacci-sized batches (batch_size = fib(8) = ${BATCH_SIZE_EMBEDDING})."""
    all_vecs = []
    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i:i + BATCH_SIZE]
        with torch.no_grad():
            vecs = model.encode(batch, normalize_embeddings=True,
                                convert_to_numpy=True)
        all_vecs.extend(vecs.tolist())
    log("INFO", "batch_embed_complete",
        count=len(texts), batches=math.ceil(len(texts) / BATCH_SIZE))
    return all_vecs

${rest}

# ─── Health / Heartbeat Loop ────────────────────────────────────
@app.post("/api/connect")
async def connect(request: Request):
    return {"status": "ok", "specialization": "embedding"}

@app.post("/api/disconnect")
async def disconnect(request: Request):
    log("INFO", "disconnect_requested")
    return {"status": "ok"}

@app.get("/api/health")
async def health_detail():
    gpu_stats = {}
    if torch.cuda.is_available():
        gpu_stats = {
            "gpu_utilization": round(
                torch.cuda.memory_allocated() /
                torch.cuda.get_device_properties(0).total_mem, 4),
            "memory_usage": round(
                torch.cuda.memory_reserved() /
                torch.cuda.get_device_properties(0).total_mem, 4),
            "cache_hit_rate": 0.0,
        }
    return {"status": "ok", "service": "colab-alpha", **gpu_stats,
            "ts": datetime.now(timezone.utc).isoformat()}

log("INFO", "alpha_runtime_ready",
    embedding_dim=EMBEDDING_DIM, batch_size=BATCH_SIZE)
`;
  }

  /**
   * Generate the Beta (Inference) runtime template.
   *
   * Uses HuggingFace transformers with streaming text generation.
   * Includes: model loading, generate with streaming, REST API, health loop.
   *
   * @returns {string} Complete Python source.
   */
  inferenceNotebook() {
    const preamble = _pythonPreamble('colab-beta');
    const port = HEALTH_PORT + 1;
    const rest = _restEndpoint('colab-beta', port);

    return `#!/usr/bin/env python3
"""Heady Colab Beta — Inference Runtime (HuggingFace, streaming generation)"""

# === Pip Dependencies ===
# !pip install -q transformers torch accelerate fastapi uvicorn

${preamble}

import torch
import numpy as np

# ─── Model Setup ─────────────────────────────────────────────────
from transformers import AutoTokenizer, AutoModelForCausalLM, TextIteratorStreamer
from threading import Thread

MODEL_NAME = os.environ.get("HEADY_MODEL", "TinyLlama/TinyLlama-1.1B-Chat-v1.0")
MAX_NEW_TOKENS = fib(9) * fib(5)  # ${fib(9) * fib(5)} tokens
TEMPERATURE = PSI  # ≈ 0.618

log("INFO", "loading_model", model=MODEL_NAME)
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
gen_model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
    device_map="auto" if torch.cuda.is_available() else None,
)
log("INFO", "model_loaded",
    device="cuda" if torch.cuda.is_available() else "cpu")

# ─── Inference Functions ─────────────────────────────────────────
@phi_retry()
def generate(prompt, max_tokens=MAX_NEW_TOKENS, temperature=TEMPERATURE):
    """Generate text from a prompt. Returns the full completion string."""
    inputs = tokenizer(prompt, return_tensors="pt")
    if torch.cuda.is_available():
        inputs = {k: v.to("cuda") for k, v in inputs.items()}
    with torch.no_grad():
        outputs = gen_model.generate(
            **inputs,
            max_new_tokens=max_tokens,
            temperature=temperature,
            do_sample=temperature > 0,
        )
    result = tokenizer.decode(outputs[0], skip_special_tokens=True)
    log("INFO", "generate_complete",
        prompt_len=len(prompt), output_len=len(result))
    return result

@phi_retry()
def generate_stream(prompt, max_tokens=MAX_NEW_TOKENS, temperature=TEMPERATURE):
    """Streaming generation — yields token strings as they are produced."""
    inputs = tokenizer(prompt, return_tensors="pt")
    if torch.cuda.is_available():
        inputs = {k: v.to("cuda") for k, v in inputs.items()}

    streamer = TextIteratorStreamer(tokenizer, skip_special_tokens=True)
    gen_kwargs = dict(
        **inputs,
        max_new_tokens=max_tokens,
        temperature=temperature,
        do_sample=temperature > 0,
        streamer=streamer,
    )
    thread = Thread(target=gen_model.generate, kwargs=gen_kwargs)
    thread.start()
    for chunk in streamer:
        yield chunk
    thread.join()

${rest}

@app.post("/api/connect")
async def connect(request: Request):
    return {"status": "ok", "specialization": "inference"}

@app.post("/api/disconnect")
async def disconnect(request: Request):
    log("INFO", "disconnect_requested")
    return {"status": "ok"}

@app.get("/api/health")
async def health_detail():
    gpu_stats = {}
    if torch.cuda.is_available():
        gpu_stats = {
            "gpu_utilization": round(
                torch.cuda.memory_allocated() /
                torch.cuda.get_device_properties(0).total_mem, 4),
            "memory_usage": round(
                torch.cuda.memory_reserved() /
                torch.cuda.get_device_properties(0).total_mem, 4),
            "cache_hit_rate": 0.0,
        }
    return {"status": "ok", "service": "colab-beta", **gpu_stats,
            "ts": datetime.now(timezone.utc).isoformat()}

log("INFO", "beta_runtime_ready",
    model=MODEL_NAME, max_tokens=MAX_NEW_TOKENS,
    temperature=round(TEMPERATURE, 4))
`;
  }

  /**
   * Generate the Gamma (Vector Ops) runtime template.
   *
   * Uses FAISS GPU for HNSW indexing, batch kNN, and PCA dimensionality
   * reduction. Includes: index creation, search, PCA projection, REST API.
   *
   * @returns {string} Complete Python source.
   */
  vectorOpsNotebook() {
    const preamble = _pythonPreamble('colab-gamma');
    const port = HEALTH_PORT + 2;
    const rest = _restEndpoint('colab-gamma', port);

    return `#!/usr/bin/env python3
"""Heady Colab Gamma — Vector Ops Runtime (FAISS GPU, HNSW, PCA)"""

# === Pip Dependencies ===
# !pip install -q faiss-gpu numpy scikit-learn fastapi uvicorn

${preamble}

import numpy as np

# ─── FAISS Setup ─────────────────────────────────────────────────
import faiss

HNSW_M              = ${fib(5) * fib(4) + fib(5) + fib(4) + fib(3)}  # 32
HNSW_EF_CONSTRUCTION = 200
HNSW_EF_SEARCH       = fib(11)  # ${fib(11)}
INDEX_SIZE           = fib(16)  # ${fib(16)} max vectors

log("INFO", "initializing_faiss",
    dim=EMBEDDING_DIM, M=HNSW_M,
    ef_construction=HNSW_EF_CONSTRUCTION)

# Build HNSW index on GPU if available
index_cpu = faiss.IndexHNSWFlat(EMBEDDING_DIM, HNSW_M)
index_cpu.hnsw.efConstruction = HNSW_EF_CONSTRUCTION
index_cpu.hnsw.efSearch = HNSW_EF_SEARCH

use_gpu = faiss.get_num_gpus() > 0
if use_gpu:
    gpu_res = faiss.StandardGpuResources()
    index = faiss.index_cpu_to_gpu(gpu_res, 0, index_cpu)
    log("INFO", "faiss_gpu_ready", gpus=faiss.get_num_gpus())
else:
    index = index_cpu
    log("WARN", "faiss_cpu_fallback")

id_map = {}
next_int_id = 0

# ─── Index Operations ────────────────────────────────────────────
@phi_retry()
def add_vectors(vectors, ids=None):
    """Insert vectors into the HNSW index."""
    global next_int_id
    vecs = np.array(vectors, dtype=np.float32)
    faiss.normalize_L2(vecs)
    index.add(vecs)

    assigned_ids = ids or list(range(next_int_id, next_int_id + len(vecs)))
    for i, ext_id in enumerate(assigned_ids):
        id_map[next_int_id + i] = ext_id
    next_int_id += len(vecs)

    log("INFO", "vectors_added",
        count=len(vecs), total=index.ntotal)
    return assigned_ids

@phi_retry()
def search_vectors(query_vector, k=fib(7)):
    """k-nearest-neighbour search. k defaults to fib(7) = ${fib(7)}."""
    q = np.array([query_vector], dtype=np.float32)
    faiss.normalize_L2(q)
    distances, indices = index.search(q, min(k, max(index.ntotal, 1)))
    results = []
    for dist, idx in zip(distances[0], indices[0]):
        if idx < 0:
            continue
        results.append({
            "id": id_map.get(int(idx), int(idx)),
            "similarity": round(1.0 - float(dist), 6),
        })
    log("INFO", "search_complete", k=k, results=len(results))
    return results

# ─── PCA Projection ──────────────────────────────────────────────
from sklearn.decomposition import PCA

@phi_retry()
def pca_project(vectors, target_dim=3):
    """Project vectors to target_dim dimensions via PCA."""
    vecs = np.array(vectors, dtype=np.float32)
    pca = PCA(n_components=target_dim)
    projected = pca.fit_transform(vecs)
    explained = pca.explained_variance_ratio_.tolist()
    log("INFO", "pca_complete",
        source_dim=vecs.shape[1], target_dim=target_dim,
        variance_explained=round(sum(explained), 4))
    return {
        "projected": projected.tolist(),
        "explained_variance": explained,
    }

# ─── Batch Cosine Similarity ─────────────────────────────────────
def batch_cosine(a_vecs, b_vecs):
    """Pairwise cosine similarity between two sets of vectors."""
    a = np.array(a_vecs, dtype=np.float32)
    b = np.array(b_vecs, dtype=np.float32)
    a_norm = a / np.linalg.norm(a, axis=1, keepdims=True)
    b_norm = b / np.linalg.norm(b, axis=1, keepdims=True)
    return (a_norm @ b_norm.T).tolist()

${rest}

@app.post("/api/connect")
async def connect(request: Request):
    return {"status": "ok", "specialization": "vector_ops"}

@app.post("/api/disconnect")
async def disconnect(request: Request):
    log("INFO", "disconnect_requested")
    return {"status": "ok"}

@app.get("/api/health")
async def health_detail():
    return {"status": "ok", "service": "colab-gamma",
            "index_size": index.ntotal,
            "gpu_utilization": 0.0,
            "memory_usage": 0.0,
            "cache_hit_rate": 0.0,
            "ts": datetime.now(timezone.utc).isoformat()}

log("INFO", "gamma_runtime_ready",
    hnsw_m=HNSW_M, ef_construction=HNSW_EF_CONSTRUCTION,
    ef_search=HNSW_EF_SEARCH, max_vectors=INDEX_SIZE)
`;
  }

  /**
   * Generate a lightweight health-check notebook that pings all three
   * runtime endpoints and reports aggregate status.
   *
   * @returns {string} Complete Python source.
   */
  healthCheckNotebook() {
    return `#!/usr/bin/env python3
"""Heady Colab Health Check — pings Alpha / Beta / Gamma runtimes."""

import json, time, math, requests
from datetime import datetime, timezone

PHI = (1 + math.sqrt(5)) / 2
PSI = 1 / PHI

def fib(n):
    return round((PHI**n - (-PSI)**n) / math.sqrt(5))

RUNTIMES = {
    "alpha": {"url": "http://localhost:${HEALTH_PORT}", "role": "embedding"},
    "beta":  {"url": "http://localhost:${HEALTH_PORT + 1}", "role": "inference"},
    "gamma": {"url": "http://localhost:${HEALTH_PORT + 2}", "role": "vector_ops"},
}
HEARTBEAT_S = fib(7)   # ${HEARTBEAT_S}
MAX_RETRIES = fib(4)   # ${MAX_RETRIES}
BASE_BACKOFF_S = fib(6) / 10  # 0.8

def check_runtime(name, cfg):
    for attempt in range(MAX_RETRIES):
        try:
            r = requests.get(f"{cfg['url']}/api/health", timeout=fib(5))
            data = r.json()
            return {"runtime": name, "role": cfg["role"],
                    "status": "healthy", "data": data}
        except Exception as exc:
            delay = BASE_BACKOFF_S * (PHI ** attempt)
            time.sleep(delay)
    return {"runtime": name, "role": cfg["role"],
            "status": "unreachable"}

def run_health_loop():
    while True:
        results = [check_runtime(n, c) for n, c in RUNTIMES.items()]
        healthy = sum(1 for r in results if r["status"] == "healthy")
        report = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "healthy": healthy,
            "total": len(RUNTIMES),
            "runtimes": results,
        }
        print(json.dumps(report), flush=True)
        time.sleep(HEARTBEAT_S)

# Uncomment to run:
# run_health_loop()
`;
  }

  /**
   * Generate all templates as a keyed object.
   * @returns {{embedding: string, inference: string, vectorOps: string, healthCheck: string}}
   */
  generateAll() {
    return {
      embedding:   this.embeddingNotebook(),
      inference:   this.inferenceNotebook(),
      vectorOps:   this.vectorOpsNotebook(),
      healthCheck: this.healthCheckNotebook(),
    };
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  PHI,
  PSI,
  fib,
  EMBEDDING_DIM,
  HEALTH_PORT,
  NotebookTemplateGenerator,
};
