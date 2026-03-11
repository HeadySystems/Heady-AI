"""
Heady Runtime 1: Vector Brain
384D embedding generation, semantic memory, CSL gate operations.
Phi-scaled batch sizes. gRPC service for inter-runtime communication.
"""

import asyncio
import json
import math
import os
import signal
import time
import uuid
from dataclasses import dataclass
from typing import Optional

import numpy as np
import structlog
from aiohttp import web

logger = structlog.get_logger("heady.vector_brain")

# ─── Sacred Constants ───────────────────────────────────────────────────────
PHI = 1.618033988749895
PSI = 1.0 / PHI  # ≈ 0.618
FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987]
EMBEDDING_DIM = 384

# Batch sizes (Fibonacci)
BATCH_SIZES = [FIB[5], FIB[6], FIB[7], FIB[8], FIB[9]]  # [8, 13, 21, 34, 55]

# Relevance thresholds (CSL gates, phi-derived)
RELEVANCE_GATES = {
    "include": PSI * PSI,      # ≈ 0.382 — minimum relevance
    "boost": PSI,              # ≈ 0.618 — amplification threshold
    "inject": PSI + 0.1,       # ≈ 0.718 — auto-injection threshold
    "drift_alert": 0.75,       # coherence drift threshold
}

# Cache sizing (Fibonacci)
VECTOR_CACHE_SIZE = FIB[10]    # 89
EMBEDDING_CACHE_SIZE = FIB[11] # 144


class CSLGates:
    """Continuous Semantic Logic — vector operations as logical gates."""

    @staticmethod
    def csl_and(a: np.ndarray, b: np.ndarray) -> float:
        """CSL AND = cosine similarity. Measures agreement."""
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(a, b) / (norm_a * norm_b))

    @staticmethod
    def csl_or(a: np.ndarray, b: np.ndarray) -> np.ndarray:
        """CSL OR = superposition. Merges semantic content."""
        combined = a + b
        norm = np.linalg.norm(combined)
        return combined / norm if norm > 0 else combined

    @staticmethod
    def csl_not(a: np.ndarray, reference: np.ndarray) -> np.ndarray:
        """CSL NOT = orthogonal projection. What remains after removing a from reference."""
        dot = np.dot(reference, a)
        norm_sq = np.dot(a, a)
        if norm_sq == 0:
            return reference
        projection = (dot / norm_sq) * a
        residual = reference - projection
        norm = np.linalg.norm(residual)
        return residual / norm if norm > 0 else residual

    @staticmethod
    def csl_imply(a: np.ndarray, b: np.ndarray) -> np.ndarray:
        """CSL IMPLY = projection of a onto b. Measures how much a implies b."""
        dot = np.dot(a, b)
        norm_sq = np.dot(b, b)
        if norm_sq == 0:
            return np.zeros_like(b)
        return (dot / norm_sq) * b

    @staticmethod
    def csl_xor(a: np.ndarray, b: np.ndarray) -> np.ndarray:
        """CSL XOR = what is unique to each. Symmetric difference in vector space."""
        a_not_b = CSLGates.csl_not(b, a)
        b_not_a = CSLGates.csl_not(a, b)
        return CSLGates.csl_or(a_not_b, b_not_a)

    @staticmethod
    def csl_consensus(vectors: list[np.ndarray]) -> np.ndarray:
        """CSL CONSENSUS = weighted superposition of multiple vectors."""
        if not vectors:
            return np.zeros(EMBEDDING_DIM)
        combined = np.zeros(EMBEDDING_DIM)
        for v in vectors:
            combined += v
        norm = np.linalg.norm(combined)
        return combined / norm if norm > 0 else combined

    @staticmethod
    def csl_gate(value: float, threshold: float) -> float:
        """CSL continuous gate — smooth activation around threshold."""
        return 1.0 / (1.0 + math.exp(-PHI * 10 * (value - threshold)))


class VectorStore:
    """
    In-memory 384D vector store with semantic search.
    RAM-first architecture — persistence is the backup, not the primary.
    """

    def __init__(self, dim: int = EMBEDDING_DIM):
        self.dim = dim
        self.vectors: dict[str, np.ndarray] = {}
        self.metadata: dict[str, dict] = {}
        self._index_dirty = False

    def store(self, key: str, vector: np.ndarray, meta: Optional[dict] = None):
        if vector.shape != (self.dim,):
            raise ValueError(f"Expected {self.dim}D vector, got {vector.shape}")
        self.vectors[key] = vector / np.linalg.norm(vector)  # normalize
        self.metadata[key] = meta or {}
        self._index_dirty = True

    def retrieve(self, key: str) -> Optional[tuple[np.ndarray, dict]]:
        vec = self.vectors.get(key)
        meta = self.metadata.get(key, {})
        return (vec, meta) if vec is not None else None

    def search(self, query: np.ndarray, top_k: int = FIB[6], threshold: float = RELEVANCE_GATES["include"]) -> list[dict]:
        if not self.vectors:
            return []
        query_norm = query / np.linalg.norm(query) if np.linalg.norm(query) > 0 else query

        results = []
        for key, vec in self.vectors.items():
            sim = CSLGates.csl_and(query_norm, vec)
            if sim >= threshold:
                results.append({
                    "key": key,
                    "similarity": sim,
                    "metadata": self.metadata.get(key, {}),
                    "boosted": sim >= RELEVANCE_GATES["boost"],
                    "auto_inject": sim >= RELEVANCE_GATES["inject"],
                })

        results.sort(key=lambda r: r["similarity"], reverse=True)
        return results[:top_k]

    def detect_drift(self, key: str, new_vector: np.ndarray) -> Optional[float]:
        """Detect semantic drift for a component."""
        old = self.vectors.get(key)
        if old is None:
            return None
        sim = CSLGates.csl_and(old, new_vector)
        if sim < RELEVANCE_GATES["drift_alert"]:
            logger.warning(
                "drift_detected",
                key=key,
                similarity=round(sim, 4),
                threshold=RELEVANCE_GATES["drift_alert"],
            )
        return sim

    def topology(self) -> dict:
        """Get vector space topology statistics."""
        if not self.vectors:
            return {"size": 0, "dim": self.dim}

        all_vecs = np.array(list(self.vectors.values()))
        mean = np.mean(all_vecs, axis=0)
        std = np.std(all_vecs, axis=0)

        # Pairwise similarity distribution
        n = len(all_vecs)
        if n > 1:
            sample_size = min(n, FIB[9])  # max 55 for sampling
            indices = np.random.choice(n, size=sample_size, replace=False)
            sample = all_vecs[indices]
            norms = np.linalg.norm(sample, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            normed = sample / norms
            sim_matrix = normed @ normed.T
            avg_sim = float(np.mean(sim_matrix[np.triu_indices(sample_size, k=1)]))
        else:
            avg_sim = 1.0

        return {
            "size": n,
            "dim": self.dim,
            "mean_norm": float(np.mean(np.linalg.norm(all_vecs, axis=1))),
            "avg_pairwise_similarity": round(avg_sim, 4),
            "std_mean": float(np.mean(std)),
        }

    @property
    def count(self) -> int:
        return len(self.vectors)


class EmbeddingEngine:
    """
    Embedding generation for 384D vector space.
    Supports batch embedding with Fibonacci-sized batches.
    """

    def __init__(self):
        self.model = None
        self.model_name = os.environ.get(
            "HEADY_EMBEDDING_MODEL", "all-MiniLM-L6-v2"
        )
        self._initialized = False

    async def initialize(self):
        try:
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer(self.model_name)
            self._initialized = True
            logger.info("embedding_model_loaded", model=self.model_name, dim=EMBEDDING_DIM)
        except ImportError:
            logger.warning("sentence_transformers_unavailable_using_random")
            self._initialized = True

    def embed(self, text: str) -> np.ndarray:
        if self.model:
            vec = self.model.encode(text, normalize_embeddings=True)
            return np.array(vec, dtype=np.float32)
        # Fallback: deterministic hash-based embedding for testing
        import hashlib
        h = hashlib.sha384(text.encode()).digest()
        vec = np.frombuffer(h, dtype=np.uint8).astype(np.float32)
        # Pad or truncate to EMBEDDING_DIM
        if len(vec) < EMBEDDING_DIM:
            vec = np.pad(vec, (0, EMBEDDING_DIM - len(vec)))
        vec = vec[:EMBEDDING_DIM]
        norm = np.linalg.norm(vec)
        return vec / norm if norm > 0 else vec

    def embed_batch(self, texts: list[str]) -> list[np.ndarray]:
        """Embed a batch of texts using Fibonacci-sized sub-batches."""
        results = []
        optimal_batch = self._select_batch_size(len(texts))

        for i in range(0, len(texts), optimal_batch):
            batch = texts[i:i + optimal_batch]
            if self.model:
                vecs = self.model.encode(batch, normalize_embeddings=True, batch_size=optimal_batch)
                results.extend([np.array(v, dtype=np.float32) for v in vecs])
            else:
                results.extend([self.embed(t) for t in batch])

        return results

    @staticmethod
    def _select_batch_size(total: int) -> int:
        """Select optimal Fibonacci batch size for given total."""
        for bs in reversed(BATCH_SIZES):
            if total >= bs:
                return bs
        return BATCH_SIZES[0]


class PgVectorSync:
    """Syncs in-memory vector store with PostgreSQL pgvector."""

    def __init__(self, store: VectorStore):
        self.store = store
        self.dsn = os.environ.get(
            "HEADY_PGVECTOR_DSN",
            "postgresql://heady:heady@localhost:5432/heady_vectors"
        )
        self.pool = None
        self._sync_interval = PHI * 60  # ~97s

    async def initialize(self):
        try:
            import asyncpg
            self.pool = await asyncpg.create_pool(
                self.dsn, min_size=FIB[2], max_size=FIB[6]
            )
            await self._ensure_table()
            logger.info("pgvector_connected", dsn=self.dsn[:30] + "...")
        except Exception as e:
            logger.warning("pgvector_unavailable", error=str(e))

    async def _ensure_table(self):
        if not self.pool:
            return
        async with self.pool.acquire() as conn:
            await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
            await conn.execute(f"""
                CREATE TABLE IF NOT EXISTS heady_vectors (
                    key TEXT PRIMARY KEY,
                    embedding vector({EMBEDDING_DIM}),
                    metadata JSONB DEFAULT '{{}}',
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)

    async def sync_to_db(self):
        if not self.pool:
            return 0
        count = 0
        async with self.pool.acquire() as conn:
            for key, vec in self.store.vectors.items():
                meta = self.store.metadata.get(key, {})
                vec_str = "[" + ",".join(str(float(v)) for v in vec) + "]"
                await conn.execute("""
                    INSERT INTO heady_vectors (key, embedding, metadata)
                    VALUES ($1, $2::vector, $3::jsonb)
                    ON CONFLICT (key) DO UPDATE SET
                        embedding = EXCLUDED.embedding,
                        metadata = EXCLUDED.metadata,
                        updated_at = NOW()
                """, key, vec_str, json.dumps(meta))
                count += 1
        logger.info("pgvector_synced", count=count)
        return count

    async def load_from_db(self):
        if not self.pool:
            return 0
        count = 0
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("SELECT key, embedding, metadata FROM heady_vectors")
            for row in rows:
                vec = np.array(json.loads(row["embedding"].replace("(", "[").replace(")", "]")), dtype=np.float32)
                meta = json.loads(row["metadata"]) if row["metadata"] else {}
                self.store.store(row["key"], vec, meta)
                count += 1
        logger.info("pgvector_loaded", count=count)
        return count

    async def sync_loop(self):
        while True:
            try:
                await self.sync_to_db()
            except Exception as e:
                logger.error("sync_error", error=str(e))
            await asyncio.sleep(self._sync_interval)

    async def shutdown(self):
        if self.pool:
            await self.sync_to_db()
            await self.pool.close()


class VectorBrainRuntime:
    """
    Runtime 1: Vector Brain
    Manages 384D embeddings, semantic search, CSL gates, and vector topology.
    """

    def __init__(self):
        self.store = VectorStore()
        self.embedder = EmbeddingEngine()
        self.pgvector = PgVectorSync(self.store)
        self.csl = CSLGates()
        self.port = int(os.environ.get("HEADY_VECTOR_PORT", "8080"))
        self.app = web.Application()
        self._setup_routes()
        self._start_time = time.time()
        self._request_count = 0
        self._running = False

    def _setup_routes(self):
        self.app.router.add_get("/health", self._health)
        self.app.router.add_post("/embed", self._embed)
        self.app.router.add_post("/embed/batch", self._embed_batch)
        self.app.router.add_post("/store", self._store_vector)
        self.app.router.add_post("/search", self._search)
        self.app.router.add_post("/csl/and", self._csl_and)
        self.app.router.add_post("/csl/or", self._csl_or)
        self.app.router.add_post("/csl/not", self._csl_not)
        self.app.router.add_post("/drift", self._check_drift)
        self.app.router.add_get("/topology", self._get_topology)
        self.app.router.add_get("/stats", self._stats)

    async def _health(self, request: web.Request) -> web.Response:
        topology = self.store.topology()
        return web.json_response({
            "status": "healthy",
            "service": "heady-vector-brain",
            "role": "vector_brain",
            "uptime_seconds": round(time.time() - self._start_time, 2),
            "vector_count": self.store.count,
            "embedding_dim": EMBEDDING_DIM,
            "topology": topology,
            "request_count": self._request_count,
        })

    async def _embed(self, request: web.Request) -> web.Response:
        self._request_count += 1
        body = await request.json()
        text = body.get("text", "")
        if not text:
            return web.json_response({"error": "text required"}, status=400)

        vec = self.embedder.embed(text)
        key = body.get("key", str(uuid.uuid4()))
        meta = body.get("metadata", {})

        self.store.store(key, vec, meta)

        return web.json_response({
            "key": key,
            "dim": EMBEDDING_DIM,
            "norm": float(np.linalg.norm(vec)),
        })

    async def _embed_batch(self, request: web.Request) -> web.Response:
        self._request_count += 1
        body = await request.json()
        texts = body.get("texts", [])
        if not texts:
            return web.json_response({"error": "texts array required"}, status=400)

        vecs = self.embedder.embed_batch(texts)
        keys = []
        for i, (text, vec) in enumerate(zip(texts, vecs)):
            key = f"batch-{uuid.uuid4().hex[:8]}-{i}"
            self.store.store(key, vec, {"source_text": text[:100]})
            keys.append(key)

        return web.json_response({
            "count": len(keys),
            "keys": keys,
            "batch_size_used": EmbeddingEngine._select_batch_size(len(texts)),
        })

    async def _store_vector(self, request: web.Request) -> web.Response:
        self._request_count += 1
        body = await request.json()
        key = body.get("key")
        vector = body.get("vector")
        meta = body.get("metadata", {})

        if not key or not vector:
            return web.json_response({"error": "key and vector required"}, status=400)

        vec = np.array(vector, dtype=np.float32)
        self.store.store(key, vec, meta)
        return web.json_response({"stored": key, "dim": len(vec)})

    async def _search(self, request: web.Request) -> web.Response:
        self._request_count += 1
        body = await request.json()

        if "text" in body:
            query_vec = self.embedder.embed(body["text"])
        elif "vector" in body:
            query_vec = np.array(body["vector"], dtype=np.float32)
        else:
            return web.json_response({"error": "text or vector required"}, status=400)

        top_k = body.get("top_k", FIB[6])
        threshold = body.get("threshold", RELEVANCE_GATES["include"])
        results = self.store.search(query_vec, top_k=top_k, threshold=threshold)
        return web.json_response({"results": results, "count": len(results)})

    async def _csl_and(self, request: web.Request) -> web.Response:
        self._request_count += 1
        body = await request.json()
        a = np.array(body["a"], dtype=np.float32)
        b = np.array(body["b"], dtype=np.float32)
        similarity = self.csl.csl_and(a, b)
        gate_value = self.csl.csl_gate(similarity, RELEVANCE_GATES["boost"])
        return web.json_response({
            "similarity": round(similarity, 6),
            "gate_value": round(gate_value, 6),
            "passes_boost": similarity >= RELEVANCE_GATES["boost"],
        })

    async def _csl_or(self, request: web.Request) -> web.Response:
        self._request_count += 1
        body = await request.json()
        a = np.array(body["a"], dtype=np.float32)
        b = np.array(body["b"], dtype=np.float32)
        result = self.csl.csl_or(a, b)
        return web.json_response({"result": result.tolist()})

    async def _csl_not(self, request: web.Request) -> web.Response:
        self._request_count += 1
        body = await request.json()
        a = np.array(body["a"], dtype=np.float32)
        ref = np.array(body["reference"], dtype=np.float32)
        result = self.csl.csl_not(a, ref)
        return web.json_response({"result": result.tolist()})

    async def _check_drift(self, request: web.Request) -> web.Response:
        self._request_count += 1
        body = await request.json()
        key = body.get("key")
        new_vec = np.array(body.get("vector", []), dtype=np.float32)
        if not key or len(new_vec) == 0:
            return web.json_response({"error": "key and vector required"}, status=400)

        similarity = self.store.detect_drift(key, new_vec)
        if similarity is None:
            return web.json_response({"error": "key not found"}, status=404)

        drifted = similarity < RELEVANCE_GATES["drift_alert"]
        return web.json_response({
            "key": key,
            "similarity": round(similarity, 6),
            "drifted": drifted,
            "threshold": RELEVANCE_GATES["drift_alert"],
        })

    async def _get_topology(self, request: web.Request) -> web.Response:
        self._request_count += 1
        return web.json_response(self.store.topology())

    async def _stats(self, request: web.Request) -> web.Response:
        return web.json_response({
            "vector_count": self.store.count,
            "embedding_dim": EMBEDDING_DIM,
            "embedding_model": self.embedder.model_name,
            "batch_sizes": BATCH_SIZES,
            "relevance_gates": RELEVANCE_GATES,
            "cache_sizes": {
                "vector_cache": VECTOR_CACHE_SIZE,
                "embedding_cache": EMBEDDING_CACHE_SIZE,
            },
        })

    async def start(self):
        self._running = True
        await self.embedder.initialize()
        await self.pgvector.initialize()
        await self.pgvector.load_from_db()
        asyncio.create_task(self.pgvector.sync_loop())

        runner = web.AppRunner(self.app)
        await runner.setup()
        site = web.TCPSite(runner, "0.0.0.0", self.port)
        await site.start()
        logger.info("vector_brain_started", port=self.port, vectors=self.store.count)
        self._runner = runner

    async def shutdown(self):
        self._running = False
        await self.pgvector.shutdown()
        await self._runner.cleanup()
        logger.info("vector_brain_shutdown")


async def main():
    runtime = VectorBrainRuntime()

    loop = asyncio.get_event_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, lambda: asyncio.create_task(runtime.shutdown()))

    await runtime.start()

    try:
        while True:
            await asyncio.sleep(3600)
    except asyncio.CancelledError:
        await runtime.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
