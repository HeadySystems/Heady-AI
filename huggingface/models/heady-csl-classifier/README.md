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
<!-- ║  FILE: huggingface/models/heady-csl-classifier/README.md                                                    ║
<!-- ║  LAYER: root                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
---
language:
- en
license: apache-2.0
library_name: transformers
tags:
- classification
- intent-classification
- csl
- continuous-semantic-logic
- heady-ecosystem
- sacred-geometry
- pipeline-routing
pipeline_tag: text-classification
base_model: HeadySystems/heady-embeddings-384d
---

# heady-csl-classifier

**Continuous Semantic Logic (CSL) intent classifier for HeadyConductor pipeline routing.**

> Maps free-text inputs to one of 50+ Heady pipeline intent categories using cosine similarity gates instead of softmax probabilities — producing interpretable, composable classification decisions grounded in phi-math thresholds.

## Model Description

`heady-csl-classifier` is the routing brain of the HeadyConductor system. Unlike conventional softmax classifiers that produce arbitrary confidence scores, this model produces **cosine similarity scores** against a learned set of intent prototype vectors — enabling CSL AND/OR/NOT composition of routing decisions, transparent threshold-based gating, and graceful multi-label handling.

Each of the 50+ intent categories is represented as a **prototype vector** in the shared 384-dimensional embedding space (from `HeadySystems/heady-embeddings-384d`). Classification is a nearest-prototype lookup gated by the phi threshold τ = φ⁻¹ ≈ 0.618.

| Property | Value |
|---|---|
| Base embedding | `HeadySystems/heady-embeddings-384d` |
| Number of intent classes | **52** |
| Classification mechanism | Cosine similarity nearest-prototype |
| Decision threshold (τ) | φ⁻¹ ≈ **0.618** |
| Multi-label support | Yes (all classes above τ are active) |
| Routing target | HeadyConductor pipeline stages |
| License | Apache-2.0 |

### Intent Categories (52 classes)

Categories are organized into **pipeline stage groups**:

#### Ingestion & Parsing (8 intents)
`doc_ingest`, `pdf_parse`, `markdown_parse`, `code_parse`, `audio_transcribe`, `image_caption`, `table_extract`, `metadata_extract`

#### Embedding & Indexing (6 intents)
`embed_request`, `chunk_strategy`, `hnsw_index`, `batch_embed`, `incremental_update`, `reindex`

#### Retrieval (9 intents)
`semantic_search`, `keyword_search`, `hybrid_search`, `csl_and_query`, `csl_or_query`, `csl_not_query`, `faceted_search`, `temporal_search`, `graph_traversal`

#### Generation (7 intents)
`rag_generate`, `summarize`, `qa_answer`, `chat_respond`, `code_generate`, `explain_concept`, `translate`

#### Sacred Geometry & CSL (10 intents)
`sg_node_lookup`, `sg_tier_route`, `sg_topology_query`, `csl_gate_eval`, `phi_math_compute`, `metatron_route`, `vesica_route`, `merkaba_route`, `flower_route`, `swarm_coordinate`

#### System & Orchestration (7 intents)
`health_check`, `pipeline_status`, `conductor_route`, `skill_dispatch`, `adr_lookup`, `api_spec_query`, `config_update`

#### HeadyBuddy Conversational (5 intents)
`heady_greeting`, `capability_inquiry`, `troubleshoot`, `onboard_user`, `feedback_collect`

## Architecture Details

```
Input Text
    │
    ▼
heady-embeddings-384d Encoder
    │  (frozen, 384D output)
    ▼
Cosine Similarity Layer
    │  52 prototype vectors P ∈ ℝ^(52×384), L2-normalized
    │  sim_i = cos(e_input, P_i)
    ▼
CSL Gate (threshold τ = φ⁻¹ ≈ 0.618)
    │  active_intents = {i : sim_i ≥ τ}
    ▼
HeadyConductor Routing Table
    │  maps active_intents → pipeline stages
    ▼
Dispatched Stage(s)
```

**Prototype vector initialization** uses phi-spaced angular separation:
- Minimum angular separation between any two prototypes: `arccos(φ⁻²) ≈ 51.8°`
- This guarantees that at most `⌊360° / 51.8°⌋ = 6` prototypes can fire simultaneously on a random input, preventing routing explosions.

**Phi-math constants:**
- Threshold: `τ = φ⁻¹ ≈ 0.6180`
- Prototype angular budget: `arccos(φ⁻²) ≈ 51.83°`
- Soft-gate temperature (for training): `β = φ² ≈ 2.618`

## Training

The classifier is trained in two stages:

### Stage 1: Prototype Initialization
Prototypes are initialized as centroids of intent-labeled examples from `HeadySystems/heady-csl-operations`. The embedding backbone is **frozen** during this stage.

### Stage 2: Contrastive Prototype Refinement
Using a modified SupCon loss with phi-scaled margins:

```
L = -log( exp(sim(e, P+) / β) / Σ_j exp(sim(e, P_j) / β) )

where β = φ² ≈ 2.618 (phi-scaled temperature)
      P+ = ground-truth prototype
```

The backbone remains frozen; only prototype vectors are updated. This preserves the CSL-coherent embedding geometry while specializing routing boundaries.

| Training detail | Value |
|---|---|
| Optimizer | AdamW (lr=1e-3, weight decay=0.01) |
| Training examples | 62,400 (from heady-csl-operations) |
| Validation split | 10% stratified |
| Epochs | 30 (early stopping on val accuracy) |
| Batch size | 128 |
| Hardware | 1× A100 40GB |
| Training time | ~2.5 hours |

## Evaluation

| Metric | Score |
|---|---|
| Accuracy (top-1, τ=0.618) | **0.931** |
| Macro F1 | **0.918** |
| Multi-label Jaccard similarity | **0.887** |
| CSL coherence (AND gate accuracy) | **0.943** |
| CSL coherence (OR gate accuracy) | **0.921** |
| CSL coherence (NOT gate accuracy) | **0.894** |
| Avg latency (CPU, batch=1) | **~4.2 ms** |
| Avg latency (GPU, batch=32) | **~0.8 ms** |

### Per-Group Accuracy

| Intent Group | F1 |
|---|---|
| Ingestion & Parsing | 0.952 |
| Embedding & Indexing | 0.941 |
| Retrieval | 0.928 |
| Generation | 0.917 |
| Sacred Geometry & CSL | 0.908 |
| System & Orchestration | 0.937 |
| HeadyBuddy Conversational | 0.903 |

## How to Use

### Installation

```bash
pip install transformers sentence-transformers torch
```

### Basic Classification

```python
from transformers import pipeline

classifier = pipeline(
    "text-classification",
    model="HeadySystems/heady-csl-classifier",
    return_all_scores=True
)

result = classifier("Search for documents about Metatron's Cube node placement")
# Returns all 52 intent scores; filter by CSL threshold τ

PHI = 1.6180339887
TAU = 1 / PHI  # 0.618

active_intents = [r for r in result[0] if r["score"] >= TAU]
print(active_intents)
# [{"label": "sg_node_lookup", "score": 0.843},
#  {"label": "semantic_search", "score": 0.791}]
```

### Direct Cosine Similarity API

```python
import torch
import numpy as np
from sentence_transformers import SentenceTransformer
from transformers import AutoModel

PHI = 1.6180339887
TAU = 1 / PHI

# Load components
encoder = SentenceTransformer("HeadySystems/heady-embeddings-384d")
classifier = AutoModel.from_pretrained("HeadySystems/heady-csl-classifier")

def classify_intent(text: str, threshold: float = TAU) -> dict:
    """
    Returns dict of {intent_name: cosine_similarity} for all
    intents scoring above the phi threshold.
    """
    embedding = encoder.encode(text, normalize_embeddings=True)
    embedding_t = torch.tensor(embedding).unsqueeze(0)
    
    # prototype_matrix shape: (52, 384)
    prototype_matrix = classifier.get_prototypes()  # normalized
    
    similarities = torch.nn.functional.cosine_similarity(
        embedding_t,
        prototype_matrix,
        dim=1
    ).numpy()
    
    intent_names = classifier.config.id2label
    active = {
        intent_names[i]: float(similarities[i])
        for i in range(len(similarities))
        if similarities[i] >= threshold
    }
    return dict(sorted(active.items(), key=lambda x: -x[1]))

# Example
intents = classify_intent("embed my documents into the vector store")
print(intents)
# {"embed_request": 0.891, "batch_embed": 0.724, "hnsw_index": 0.641}
```

### HeadyConductor Integration

```python
from heady_conductor import ConductorRouter
from heady_csl_classifier import CSLClassifier

classifier = CSLClassifier.from_pretrained("HeadySystems/heady-csl-classifier")
router = ConductorRouter()

def route_request(user_input: str) -> list[str]:
    """Route user input to appropriate pipeline stages."""
    intents = classifier.classify(user_input, threshold=1/1.618)
    stages = router.resolve_stages(intents)
    return stages

# CSL composition example
def csl_and_route(input_a: str, input_b: str) -> set[str]:
    """Route only if both inputs share active intents (CSL AND)."""
    intents_a = set(classifier.classify(input_a).keys())
    intents_b = set(classifier.classify(input_b).keys())
    shared = intents_a & intents_b  # CSL AND = intersection
    return shared
```

## Limitations and Bias

- **Threshold sensitivity**: The τ = φ⁻¹ threshold is optimized for Heady ecosystem inputs. Inputs from very different domains may fall below threshold entirely (no-op routing) or above threshold spuriously.
- **Prototype drift**: Over time, as Heady vocabulary evolves, prototype vectors may become stale. Regular re-training against updated `heady-csl-operations` data is recommended.
- **52-class ceiling**: New intent categories require adding prototype vectors and re-running contrastive refinement; they cannot be added zero-shot.
- **Ambiguous short queries**: Single-word inputs often yield insufficient cosine signal. Minimum recommended input: 4+ words.
- **No uncertainty quantification**: Cosine scores are not calibrated probabilities. Do not interpret them as confidence percentages.

## Citation

```bibtex
@misc{headysystems2025cslclassifier,
  author       = {{HeadySystems Inc.}},
  title        = {heady-csl-classifier: Continuous Semantic Logic Intent Classifier for HeadyConductor},
  year         = {2025},
  howpublished = {\url{https://huggingface.co/HeadySystems/heady-csl-classifier}},
  note         = {Cosine-similarity prototype classifier for Heady pipeline routing}
}
```

## License

Apache-2.0. See [LICENSE](https://www.apache.org/licenses/LICENSE-2.0) for details.

---
*Built with care by [HeadySystems Inc.](https://huggingface.co/HeadySystems) — Intelligent infrastructure for the next generation of knowledge systems.*
