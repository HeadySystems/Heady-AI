---
name: heady-colab-runtime
description: >
  Use when wiring Google Colab as the Heady inference FALLBACK TAIL — the last hop of the
  chain Workers AI → Cloudflare AI Gateway → Cloud Run → Colab (ADR-0018). Covers GPU
  notebooks for heavy/experimental inference and embedding backfill that exceed Workers AI,
  reached only through the AI Gateway. Keywords: Colab, GPU, fallback tail, inference fallback,
  A100, notebook, AI Gateway, Workers AI, Cloud Run, batch embedding, model experiments.
metadata:
  author: HeadySystems
  version: '2.0'
  liquid_node: LiquidColabTail
  supersedes: "Colab-as-primary-fabric with FAISS + ngrok/Cloudflare tunnels (superseded — see Reconciliation)"
---

> **OPTIMAL BUILD NOTICE (v2.0.0):** pnpm + Turborepo · Stores: Neon pgvector (authority) · Vectorize (derived cache, 384-dim) · Qdrant dropped · Embedding lock `@cf/baai/bge-small-en-v1.5` · Model egress via the Cloudflare AI Gateway · Follow `AGENTS.md`.

# Heady™ Colab Runtime — Inference Fallback Tail

Colab is the **last resort of the inference fallback chain**, not a primary compute fabric and not a vector store. The model layer is: **Workers AI (fast/cheap/edge) → Cloudflare AI Gateway (single egress chokepoint) → Cloud Run (Node22 origin) → Colab GPU (heavy/experimental tail)** (ADR-0018). Retrieval authority is **Neon pgvector** (ADR-0003) — Colab never holds the authoritative index.

## When to Use This Skill

- A model/embedding job is **too heavy for Workers AI and Cloud Run** (large batch, a GPU-only model, an experiment) and must run on a Colab A100/L4.
- **Batch embedding backfill**: compute `@cf/baai/bge-small-en-v1.5` (384-D, mean) vectors at scale, then **write them to Neon pgvector** (the authority) and let the projector populate the Vectorize edge cache.
- Prototyping a model before it earns a place earlier in the chain.

Do **NOT** use Colab as: the live vector store (that's pgvector), a primary inference endpoint (that's Workers AI/Cloud Run), or a service exposed via ngrok/Cloudflare tunnels (superseded — see below).

## How it connects (locked)

- **Reached only through the AI Gateway.** The gateway routes a request to Colab only after Workers AI and Cloud Run decline/exceed limits; Colab is registered as a gateway fallback target, so caching, rate-limiting, and observability are uniform. Colab does **not** expose its own public endpoint via tunnels.
- **Embedding lock.** Any embeddings Colab produces use `@cf/baai/bge-small-en-v1.5` at 384-D — never a second model — so vectors are dimension-compatible with pgvector and Vectorize.
- **Results land in the system of record.** Colab writes results back to **Neon** (vectors → `vector_memory`, job state → tasks/outbox via `@heady/db`); derived stores rebuild from there. Colab holds no authoritative state.
- **Secrets** come from GCP Secret Manager via the standard injection path (`@heady/secrets`) — never hardcoded in a notebook.

```python
# Colab fallback-tail embedding backfill — locked model, results to pgvector (the authority).
from sentence_transformers import SentenceTransformer
import psycopg  # write to Neon

model = SentenceTransformer("BAAI/bge-small-en-v1.5")  # 384-D, mean pooling (ADR-0015)

def backfill(rows, conn):
    for r in rows:
        vec = model.encode(r["content"], normalize_embeddings=True).tolist()  # 384 dims
        assert len(vec) == 384, "embedding dimension is locked to 384"
        conn.execute(
            "INSERT INTO vector_memory (content, embedding, metadata) VALUES (%s, %s, %s)",
            (r["content"], vec, r.get("metadata", {})),
        )
    conn.commit()  # Neon pgvector is the retrieval authority; Vectorize cache is projected from it
```

## Reconciliation (v2 — what changed and why)

The earlier version of this skill treated three Colab Pro+ runtimes as the system's "latent space operations layer," used **FAISS** as the vector store, and exposed runtimes via **ngrok / Cloudflare tunnels** with **Ray** for inter-runtime work. All of that is **superseded**:

- **Vector store:** FAISS is **dropped** (superseded); Neon pgvector is the sole retrieval authority (ADR-0003), Vectorize the derived edge cache.
- **Exposure:** ngrok / Cloudflare tunnels are **dropped** (superseded); reach Colab only via the Cloudflare AI Gateway. Public surfaces are CF Workers / Cloud Run.
- **Topology:** Colab-as-primary fabric is superseded by Colab-as-fallback-tail (ADR-0018); Workers AI is the primary edge tier.

See [[heady-edge-ai]] (Workers AI edge tier) and [[heady-gateway-routing]] (AI Gateway). The former `heady-embedding-router` skill is **retired** — the embedder is a single locked model, so there is no provider to route across.
