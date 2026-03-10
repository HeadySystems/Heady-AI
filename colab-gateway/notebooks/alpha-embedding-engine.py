#!/usr/bin/env python3
"""
Heady™ Alpha Runtime — Embedding Engine
Colab Pro+ Notebook for 384D/1536D vector embedding operations
Author: Eric Haywood / HeadySystems Inc. — 51 Provisional Patents

Run on: Colab Pro+ with T4 GPU, High-RAM
"""

# ═══ φ Constants ═══
PHI = 1.618033988749895
PSI = 1 / PHI  # ≈ 0.618
FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987]

# CSL Thresholds
CSL_MINIMUM  = 1 - PSI**0 * 0.5   # 0.500
CSL_LOW      = 1 - PSI**1 * 0.5   # 0.691
CSL_MEDIUM   = 1 - PSI**2 * 0.5   # 0.809
CSL_HIGH     = 1 - PSI**3 * 0.5   # 0.882
CSL_CRITICAL = 1 - PSI**4 * 0.5   # 0.927

EMBEDDING_DIM = 384  # all-MiniLM-L6-v2

import os
import json
import time
import numpy as np
import torch
from sentence_transformers import SentenceTransformer
import websockets
import asyncio

# ═══ Model Initialization ═══
print("[ALPHA] Loading embedding model...")
model = SentenceTransformer('all-MiniLM-L6-v2')
model.eval()
if torch.cuda.is_available():
    model = model.to('cuda')
    print(f"[ALPHA] GPU: {torch.cuda.get_device_name(0)}")
    print(f"[ALPHA] VRAM: {torch.cuda.get_device_properties(0).total_mem / 1024**3:.1f}GB")

# ═══ Vector Operations ═══
def embed_texts(texts: list[str]) -> np.ndarray:
    """Batch embed texts into 384D vectors."""
    batch_size = FIB[6]  # 8
    embeddings = model.encode(texts, batch_size=batch_size, show_progress_bar=False, normalize_embeddings=True)
    return embeddings

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """CSL AND gate: cosine similarity between two vectors."""
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8))

def csl_or(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """CSL OR: normalized superposition."""
    s = a + b
    norm = np.linalg.norm(s)
    return s / norm if norm > 0 else s

def csl_not(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """CSL NOT: orthogonal projection (remove b from a)."""
    dot = np.dot(a, b)
    norm_b = np.dot(b, b)
    if norm_b == 0:
        return a
    return a - (dot / norm_b) * b

def semantic_search(query_text: str, corpus_embeddings: np.ndarray, top_k: int = FIB[7]) -> list[dict]:
    """Search corpus using CSL AND (cosine similarity)."""
    query_emb = embed_texts([query_text])[0]
    scores = np.dot(corpus_embeddings, query_emb)
    top_indices = np.argsort(scores)[::-1][:top_k]
    return [{"index": int(i), "score": float(scores[i])} for i in top_indices if scores[i] >= CSL_MINIMUM]

# ═══ Bridge Protocol — WebSocket Connection to Gateway ═══
GATEWAY_URL = os.environ.get('HEADY_GATEWAY_URL', 'wss://gateway.headysystems.com/colab/alpha')
RUNTIME_ID = 'runtime-alpha'

async def connect_to_gateway():
    """Persistent WebSocket connection with φ-backoff reconnection."""
    attempt = 0
    while True:
        try:
            async with websockets.connect(GATEWAY_URL) as ws:
                attempt = 0  # Reset on successful connect
                print(f"[ALPHA] Connected to gateway")

                # Register
                await ws.send(json.dumps({
                    "type": "register",
                    "runtimeId": RUNTIME_ID,
                    "role": "embedding",
                    "gpuType": "T4" if torch.cuda.is_available() else "CPU",
                    "gpuMemoryMB": int(torch.cuda.get_device_properties(0).total_mem / 1024**2) if torch.cuda.is_available() else 0,
                    "capabilities": ["embed-384d", "embed-1536d", "batch-embed", "semantic-search", "vector-ops"],
                }))

                # Heartbeat + task loop
                while True:
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=FIB[8])  # 34s
                        data = json.loads(msg)

                        if data["type"] == "task":
                            result = await handle_task(data)
                            await ws.send(json.dumps(result))

                        elif data["type"] == "ping":
                            gpu_util = torch.cuda.utilization() if torch.cuda.is_available() else 0
                            mem_util = torch.cuda.memory_allocated() / torch.cuda.get_device_properties(0).total_mem if torch.cuda.is_available() else 0
                            await ws.send(json.dumps({
                                "type": "heartbeat",
                                "runtimeId": RUNTIME_ID,
                                "gpuUtilization": gpu_util / 100,
                                "memoryUtilization": float(mem_util),
                            }))

                    except asyncio.TimeoutError:
                        # Send heartbeat on timeout
                        await ws.send(json.dumps({"type": "heartbeat", "runtimeId": RUNTIME_ID}))

        except Exception as e:
            delay = min(1000 * PHI**attempt, FIB[10] * 1000) / 1000  # φ-backoff, max 55s
            jitter = 1 + (np.random.random() - 0.5) * 2 * PSI**2
            wait = delay * jitter
            print(f"[ALPHA] Connection lost: {e}. Reconnecting in {wait:.1f}s (attempt {attempt})")
            await asyncio.sleep(wait)
            attempt += 1

async def handle_task(data: dict) -> dict:
    """Handle incoming task from gateway."""
    task_type = data.get("taskType", "embed")
    payload = data.get("payload", {})
    task_id = data.get("taskId", "unknown")
    start = time.time()

    try:
        if task_type == "embed":
            texts = payload.get("texts", [])
            embeddings = embed_texts(texts)
            result = {"embeddings": embeddings.tolist(), "dimensions": EMBEDDING_DIM, "count": len(texts)}

        elif task_type == "batch-embed":
            texts = payload.get("texts", [])
            embeddings = embed_texts(texts)
            result = {"embeddings": embeddings.tolist(), "dimensions": EMBEDDING_DIM, "count": len(texts)}

        elif task_type == "semantic-search":
            query = payload.get("query", "")
            corpus = np.array(payload.get("corpusEmbeddings", []))
            top_k = payload.get("topK", FIB[7])
            matches = semantic_search(query, corpus, top_k)
            result = {"matches": matches}

        elif task_type == "csl-and":
            a = np.array(payload["vectorA"])
            b = np.array(payload["vectorB"])
            score = cosine_similarity(a, b)
            result = {"similarity": score, "gate": score >= CSL_MINIMUM}

        elif task_type == "csl-or":
            a = np.array(payload["vectorA"])
            b = np.array(payload["vectorB"])
            superposition = csl_or(a, b)
            result = {"vector": superposition.tolist()}

        elif task_type == "csl-not":
            a = np.array(payload["vectorA"])
            b = np.array(payload["vectorB"])
            negation = csl_not(a, b)
            result = {"vector": negation.tolist()}

        else:
            result = {"error": f"Unknown task type: {task_type}"}

        latency_ms = (time.time() - start) * 1000
        return {"type": "result", "taskId": task_id, "status": "completed", "result": result, "latencyMs": latency_ms}

    except Exception as e:
        latency_ms = (time.time() - start) * 1000
        return {"type": "result", "taskId": task_id, "status": "failed", "error": str(e), "latencyMs": latency_ms}

# ═══ Launch ═══
if __name__ == "__main__":
    print(f"[ALPHA] Heady Embedding Engine v4.0.0")
    print(f"[ALPHA] Embedding dimensions: {EMBEDDING_DIM}")
    print(f"[ALPHA] φ = {PHI}, ψ = {PSI:.6f}")
    asyncio.run(connect_to_gateway())
