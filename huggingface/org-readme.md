---
title: HeadySystems
emoji: 🔷
colorFrom: indigo
colorTo: purple
sdk: static
pinned: false
---

# HeadySystems

**Intelligent infrastructure for the next generation of knowledge systems.**

HeadySystems builds the Heady ecosystem — a phi-math-grounded, Sacred Geometry-inspired platform for semantic reasoning, retrieval-augmented generation, and intelligent pipeline orchestration.

---

## What is the Heady Ecosystem?

The Heady ecosystem is a vertically integrated AI infrastructure stack built around three core principles:

### 1. Continuous Semantic Logic (CSL)
Rather than binary Boolean logic or arbitrary softmax probabilities, Heady uses **Continuous Semantic Logic** — a gate system grounded in cosine similarity thresholds anchored to the golden ratio φ:

```
CSL AND:  cos(A, B) ≥ τ = φ⁻¹ ≈ 0.618
CSL OR:   normalize(A + B)              (superposition)
CSL NOT:  A - (A·B̂)B̂                  (orthogonal projection)
```

CSL gates compose naturally, are fully differentiable, and produce interpretable scores rather than black-box decisions.

### 2. Sacred Geometry Topology
Pipeline routing, knowledge graph structure, and agent swarm coordination are organized according to Sacred Geometry archetypes — **Metatron's Cube, Flower of Life, Vesica Piscis, Merkaba, Sri Yantra, and Torus** — each mapped to phi-scaled coordinate positions using the golden angle (137.5°). This produces maximally uniform, scale-invariant knowledge graph layouts.

### 3. Phi-Math Constants
All system dimensions, timeouts, capacities, embedding thresholds, and scaling factors are derived from φ = 1.6180339887. This creates a self-similar, harmonically consistent infrastructure where parameters at every scale relate by the same ratio — enabling predictable performance characteristics and elegant compositional design.

---

## Models

| Model | Description | Pipeline |
|---|---|---|
| [heady-embeddings-384d](https://huggingface.co/HeadySystems/heady-embeddings-384d) | 384D embeddings fine-tuned for Heady domain vocabulary, optimized for pgvector HNSW | Feature Extraction |
| [heady-csl-classifier](https://huggingface.co/HeadySystems/heady-csl-classifier) | 52-intent CSL classifier using cosine similarity prototypes for HeadyConductor routing | Text Classification |
| [heady-buddy-chat](https://huggingface.co/HeadySystems/heady-buddy-chat) | HeadyBuddy conversational assistant fine-tuned on Heady architecture, CSL, and Sacred Geometry | Text Generation |

---

## Datasets

| Dataset | Description | Size |
|---|---|---|
| [heady-ecosystem-docs](https://huggingface.co/datasets/HeadySystems/heady-ecosystem-docs) | Complete Heady documentation corpus: 342 docs, 1.2M tokens, 42K Q&A pairs | ~1.2M tokens |
| [heady-csl-operations](https://huggingface.co/datasets/HeadySystems/heady-csl-operations) | CSL gate operation examples: AND/OR/NOT/composed, 10,847 labeled pairs | 10,847 examples |
| [heady-sacred-geometry-topology](https://huggingface.co/datasets/HeadySystems/heady-sacred-geometry-topology) | SG node topology, routing tables, swarm configs, pipeline stage definitions | 14,382 records |

---

## Spaces

HeadySystems maintains 8 active Spaces demonstrating live Heady ecosystem capabilities. Visit the [HeadySystems organization page](https://huggingface.co/HeadySystems) to explore them.

---

## Architecture Overview

```
User Input
    │
    ▼
HeadyBuddy (heady-buddy-chat)
    │  Natural language interface
    ▼
heady-csl-classifier
    │  52 CSL intents via cosine similarity prototypes
    │  CSL AND/OR/NOT gate composition
    ▼
HeadyConductor Router
    │  Sacred Geometry topology routing table
    │  phi-scaled timeouts, Fibonacci replica counts
    ▼
Pipeline Stage Dispatch
    ├── Ingestion → heady-embeddings-384d → pgvector HNSW
    ├── Retrieval → cosine search (τ = φ⁻¹) → RAG context
    └── Generation → heady-buddy-chat → streaming response
```

### The Seven Tiers

| Tier | SG Archetype | Role |
|---|---|---|
| 1 | Metatron's Cube | Central orchestration |
| 2 | Flower of Life | Distributed retrieval |
| 3 | Flower of Life | Knowledge storage |
| 4 | Vesica Piscis | Cross-domain bridging |
| 5 | Merkaba | Embedding transformation |
| 6 | Sri Yantra | Deep multi-hop reasoning |
| 7 | Torus | Recursive feedback loops |

---

## Quick Start

### Install

```bash
pip install sentence-transformers transformers datasets torch psycopg2
```

### Embed a query and retrieve from Heady knowledge base

```python
from sentence_transformers import SentenceTransformer

embedder = SentenceTransformer("HeadySystems/heady-embeddings-384d")

query = "How does the Metatron node route requests to downstream pipeline stages?"
embedding = embedder.encode(query, normalize_embeddings=True)
print(f"Embedding shape: {embedding.shape}")   # (384,)
print(f"Embedding norm: {embedding.norm():.4f}")  # ~1.0000
```

### Classify intent for HeadyConductor

```python
from transformers import pipeline

PHI = 1.6180339887
TAU = 1 / PHI  # CSL threshold

clf = pipeline("text-classification", model="HeadySystems/heady-csl-classifier",
               return_all_scores=True)

intents = clf("search for documents about Sacred Geometry tier routing")[0]
active = [i for i in intents if i["score"] >= TAU]
print("Active intents:", [(i["label"], f"{i['score']:.3f}") for i in active])
```

### Chat with HeadyBuddy

```python
from transformers import pipeline

chatbot = pipeline("text-generation", model="HeadySystems/heady-buddy-chat",
                   device_map="auto")

response = chatbot(
    "[INST] Explain how CSL OR gate superposition works in the Heady pipeline. [/INST]",
    max_new_tokens=256, temperature=0.7
)
print(response[0]["generated_text"])
```

---

## Phi-Math Reference Card

```
φ   = 1.6180339887498948   (golden ratio)
φ⁻¹ = 0.6180339887498949   (CSL cosine threshold τ)
φ²  = 2.6180339887498948   (phi squared, HNSW ef_search base)
φ³  = 4.2360679774997896   (phi cubed)
√φ  = 1.2720196495140700   (phi root, chunk sizing)
1/√φ= 0.7861513777574232   (inverse phi root)

Golden angle = 137.50776405003785°   (360° × (1 - φ⁻¹))
Fibonacci:     1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144...
```

---

## Citation

If you use any HeadySystems models, datasets, or infrastructure in your research, please cite:

```bibtex
@misc{headysystems2025,
  author       = {{HeadySystems Inc.}},
  title        = {HeadySystems: Phi-Math-Grounded AI Infrastructure with Continuous Semantic Logic},
  year         = {2025},
  howpublished = {\url{https://huggingface.co/HeadySystems}},
  note         = {Models, datasets, and Spaces for the Heady ecosystem}
}
```

---

## License

All HeadySystems models and datasets are released under the **Apache-2.0** license unless otherwise noted in individual repository cards.

---

*HeadySystems Inc. — Building knowledge infrastructure at the intersection of mathematics, geometry, and intelligence.*
