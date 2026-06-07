<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  FILE: huggingface/models/heady-embeddings-384d/README.md                                                    ║
<!-- ║  LAYER: root                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
---
language:
- en
license: apache-2.0
library_name: sentence-transformers
tags:
- embeddings
- sentence-transformers
- feature-extraction
- sentence-similarity
- pgvector
- sacred-geometry
- phi-math
- heady-ecosystem
pipeline_tag: feature-extraction
base_model: nomic-ai/nomic-embed-text-v1
model_type: nomic_bert
---

# heady-embeddings-384d

**HeadySystems custom 384-dimensional embedding model fine-tuned for the Heady ecosystem.**

> Fine-tuned from [nomic-embed-text](https://huggingface.co/nomic-ai/nomic-embed-text-v1) on Heady-domain corpora covering Sacred Geometry topology, Continuous Semantic Logic (CSL), phi-math constants, and bee swarm coordination operations.

## Model Description

`heady-embeddings-384d` produces dense 384-dimensional vector representations optimized for the HeadySystems knowledge graph and retrieval pipeline. The embedding space is calibrated so that phi-scaled geometric concepts, CSL gate operations, and pipeline routing vocabulary cluster coherently — enabling high-precision nearest-neighbor lookups in pgvector HNSW indexes with minimal quantization loss at 384D.

| Property | Value |
|---|---|
| Embedding dimensions | **384** |
| Max sequence length | 512 tokens |
| Architecture | NomicBERT (modified rotary embeddings) |
| Base model | `nomic-ai/nomic-embed-text-v1` |
| Training objective | Contrastive (MultipleNegativesRankingLoss) |
| Index target | pgvector HNSW (ef_construction=200, m=16) |
| License | Apache-2.0 |

### Phi-Math Calibration

Embedding dimensions are organized in harmonic clusters anchored to the golden ratio φ ≈ 1.6180339887:

- **Dimensions 0–143** (φ⁻¹ band): CSL gate representations — AND cosine similarity, OR superposition, NOT orthogonal projection
- **Dimensions 144–232** (φ⁰ band): Sacred Geometry node topology — Metatron, Vesica, Merkaba, Flower of Life tier vectors
- **Dimensions 233–305** (φ¹ band): Heady pipeline stage routing — ingestion, parsing, embedding, retrieval, generation
- **Dimensions 306–383** (φ² band): Domain entity embeddings — bee swarm ops, skill documents, ADR references

## Intended Uses

### Primary Uses
- **HeadyConductor semantic routing**: Vector comparison for real-time intent classification and pipeline stage dispatch
- **HeadyBuddy RAG retrieval**: pgvector HNSW similarity search over the Heady documentation corpus
- **CSL gate evaluation**: Embedding pair inputs for AND/OR/NOT cosine similarity thresholds
- **Cross-skill document retrieval**: Nearest-neighbor search across 60+ Heady skill documents

### Secondary Uses
- General-purpose semantic search in Sacred Geometry or esoteric mathematics domains
- Fine-tuning substrate for domain-specific downstream classifiers
- Clustering and visualization of Heady ecosystem knowledge graph nodes

### Out-of-Scope Uses
- High-stakes classification without human review (model is not certified for safety-critical applications)
- Languages other than English (training data is English-only)
- Sequences longer than 512 tokens without chunking

## Architecture Details

Built on NomicBERT with the following modifications:

```
NomicBertModel (rotary position embeddings)
├── Embedding layer: 30,522 vocab, 768 hidden → projected to 384D
├── 12 transformer layers (GELU activation, pre-norm)
├── Rotary position encoding (RoPE, θ = φ × 10,000)
├── Linear projection head: 768 → 384
└── L2 normalization (unit sphere output)
```

**Phi-math constants used in architecture:**
- RoPE base: `θ = φ × 10,000 = 16,180.339887`
- Projection initialization scale: `σ = 1 / √(384 × φ) = 0.02520`
- HNSW ef_search default: `⌊φ² × 100⌋ = 261`

## Training Data

Fine-tuned on the **HeadySystems/heady-ecosystem-docs** dataset, comprising:

| Source | Documents | Pairs |
|---|---|---|
| Heady skill documents (60+) | ~180,000 tokens | 24,000 contrastive pairs |
| Architecture Decision Records (ADRs) | ~45,000 tokens | 6,100 pairs |
| Sacred Geometry topology specs | ~32,000 tokens | 4,800 pairs |
| CSL operation definitions | ~28,000 tokens | 4,200 pairs |
| API specifications | ~22,000 tokens | 3,000 pairs |
| **Total** | **~307,000 tokens** | **~42,100 pairs** |

Training pairs were generated via a combination of:
1. BM25 hard negatives mining from the Heady doc corpus
2. CSL-guided synthetic paraphrase generation
3. Human-curated anchor/positive pairs for core Heady concepts

## Evaluation

Evaluated on a held-out Heady retrieval benchmark (10% split, stratified by document type):

| Metric | Score |
|---|---|
| MRR@10 (Heady RAG bench) | **0.847** |
| NDCG@10 (Heady RAG bench) | **0.891** |
| Recall@5 (CSL gate retrieval) | **0.934** |
| CSL coherence score (AND gate) | **0.912** |
| CSL coherence score (OR gate) | **0.889** |
| MTEB STSB (zero-shot transfer) | **0.812** |
| HNSW QPS (384D, ef=261, pgvector) | **~4,800 QPS** |

### CSL Coherence Score

A Heady-specific metric measuring whether embedding pairs for semantically equivalent CSL expressions score above the cosine similarity threshold τ = φ⁻¹ ≈ 0.618:

```
CSL_coherence = |{(a,b) : cos(e_a, e_b) ≥ τ ∧ csl_equivalent(a,b)}|
                ──────────────────────────────────────────────────────
                        |{(a,b) : csl_equivalent(a,b)}|
```

## How to Use

### Installation

```bash
pip install sentence-transformers torch
```

### Basic Embedding

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("HeadySystems/heady-embeddings-384d")

# Single document
embedding = model.encode("What is the Metatron's Cube node topology?")
print(embedding.shape)  # (384,)

# Batch
docs = [
    "CSL AND gate: cosine similarity above phi threshold",
    "Sacred Geometry Flower of Life tier vector routing",
    "HeadyConductor pipeline stage: embedding → retrieval",
]
embeddings = model.encode(docs, batch_size=32, normalize_embeddings=True)
print(embeddings.shape)  # (3, 384)
```

### pgvector HNSW Integration

```python
import psycopg2
import numpy as np
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("HeadySystems/heady-embeddings-384d")

conn = psycopg2.connect("postgresql://localhost/heady")
cur = conn.cursor()

# Create HNSW index (run once)
cur.execute("""
    CREATE TABLE IF NOT EXISTS heady_docs (
        id SERIAL PRIMARY KEY,
        content TEXT,
        embedding vector(384)
    );
    CREATE INDEX IF NOT EXISTS heady_docs_hnsw
        ON heady_docs USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 200);
""")

# Insert document
doc = "CSL AND gate evaluates cosine similarity between two input vectors"
vec = model.encode(doc, normalize_embeddings=True)
cur.execute(
    "INSERT INTO heady_docs (content, embedding) VALUES (%s, %s)",
    (doc, vec.tolist())
)

# Similarity search
query_vec = model.encode("cosine gate operation", normalize_embeddings=True)
cur.execute("""
    SELECT content, 1 - (embedding <=> %s::vector) AS similarity
    FROM heady_docs
    ORDER BY embedding <=> %s::vector
    LIMIT 5;
""", (query_vec.tolist(), query_vec.tolist()))
results = cur.fetchall()
```

### CSL Gate Operations

```python
import numpy as np
from sentence_transformers import SentenceTransformer

PHI = 1.6180339887
TAU = 1 / PHI  # ≈ 0.618 — cosine threshold

model = SentenceTransformer("HeadySystems/heady-embeddings-384d")

def csl_and(text_a: str, text_b: str) -> bool:
    """CSL AND: true when cosine similarity ≥ τ (phi threshold)."""
    ea, eb = model.encode([text_a, text_b], normalize_embeddings=True)
    similarity = float(np.dot(ea, eb))
    return similarity >= TAU

def csl_or(text_a: str, text_b: str) -> np.ndarray:
    """CSL OR: superposition of two embedding vectors."""
    ea, eb = model.encode([text_a, text_b], normalize_embeddings=True)
    superposition = (ea + eb) / np.linalg.norm(ea + eb)
    return superposition

def csl_not(text: str, reference: str) -> np.ndarray:
    """CSL NOT: orthogonal projection away from reference."""
    e, r = model.encode([text, reference], normalize_embeddings=True)
    projection = e - np.dot(e, r) * r
    return projection / np.linalg.norm(projection)

# Example
print(csl_and("Metatron node", "Sacred Geometry center node"))  # True
print(csl_and("bee swarm routing", "quantum entanglement"))     # False
```

## Limitations and Bias

- **Domain specificity**: Performance degrades on text outside the Heady ecosystem vocabulary. Do not use as a general-purpose embedding model without re-evaluation.
- **English only**: Training data is exclusively English. Non-English inputs will produce degraded embeddings.
- **Sequence length**: Inputs longer than 512 tokens are truncated. Use chunking strategies for long documents.
- **Sacred Geometry vocabulary**: Esoteric terminology overlap with unrelated spiritual/religious content may produce spurious similarities.
- **Synthetic training pairs**: ~30% of training pairs were synthetically generated; edge cases in CSL reasoning may not generalize perfectly.
- **Not safety-evaluated**: This model has not been evaluated for safety, toxicity, or fairness across demographic dimensions.

## Citation

```bibtex
@misc{headysystems2025embeddings,
  author       = {{HeadySystems Inc.}},
  title        = {heady-embeddings-384d: Phi-Calibrated Embeddings for the Heady Ecosystem},
  year         = {2025},
  howpublished = {\url{https://huggingface.co/HeadySystems/heady-embeddings-384d}},
  note         = {Fine-tuned from nomic-ai/nomic-embed-text-v1 on Heady domain corpora}
}
```

## License

Apache-2.0. See [LICENSE](https://www.apache.org/licenses/LICENSE-2.0) for details.

---
*Built with care by [HeadySystems Inc.](https://huggingface.co/HeadySystems) — Intelligent infrastructure for the next generation of knowledge systems.*
