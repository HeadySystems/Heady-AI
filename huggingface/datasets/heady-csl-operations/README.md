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
<!-- ║  FILE: huggingface/datasets/heady-csl-operations/README.md                                                    ║
<!-- ║  LAYER: root                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
---
language:
- en
license: apache-2.0
task_categories:
- text-classification
- text-retrieval
task_ids:
- intent-classification
- semantic-similarity
tags:
- csl
- continuous-semantic-logic
- cosine-similarity
- phi-math
- heady-ecosystem
- training-data
- gate-operations
size_categories:
- 10K<n<100K
---

# heady-csl-operations

**Training and evaluation dataset for Continuous Semantic Logic (CSL) gate operations.**

> 10,000+ labeled examples covering AND (cosine similarity), OR (superposition), and NOT (orthogonal projection) gate operations — the ground truth for training the Heady CSL reasoning pipeline and the heady-csl-classifier intent system.

## Dataset Description

`heady-csl-operations` is a curated collection of text pair examples annotated with CSL gate operation outcomes, similarity scores, and routing decisions. It provides the training signal for models that must reason about CSL logic — whether two concepts are semantically aligned (AND), how to superpose them (OR), or how to compute their semantic complement (NOT).

The dataset implements CSL as defined in the Heady formal specification:
- **CSL AND**: Two inputs are AND-true if their cosine similarity ≥ τ = φ⁻¹ ≈ 0.618
- **CSL OR**: Two inputs combine via normalized vector superposition
- **CSL NOT**: A vector is negated via orthogonal projection away from a reference

| Property | Value |
|---|---|
| Total examples | **10,847** |
| Gate types covered | AND, OR, NOT, AND-NOT, OR-NOT, composed |
| CSL threshold (τ) | φ⁻¹ = **0.61803** |
| Annotator agreement | κ = 0.89 (Fleiss' kappa) |
| Embedding model used | `HeadySystems/heady-embeddings-384d` |
| License | Apache-2.0 |

## Dataset Structure

### Splits

| Split | Examples | Gate distribution |
|---|---|---|
| `train` | 8,677 | AND: 38%, OR: 28%, NOT: 20%, composed: 14% |
| `validation` | 1,085 | Stratified match |
| `test` | 1,085 | Stratified match, hard negatives upsampled |

### Configurations

The dataset ships three configurations:

#### `gate_pairs` (primary) — Binary gate evaluation

```python
{
    "id": str,
    "gate_type": str,         # "AND" | "OR" | "NOT" | "AND_NOT" | "OR_NOT" | "composed"
    "text_a": str,            # First input text
    "text_b": str,            # Second input text (None for unary NOT)
    "cosine_similarity": float,  # cos(e_a, e_b) from heady-embeddings-384d
    "gate_result": bool,      # True if AND passes threshold, else False
    "threshold_used": float,  # τ = 0.61803 (φ⁻¹)
    "domain": str,            # "sacred_geometry" | "csl_meta" | "pipeline" | "general_heady"
    "difficulty": int,        # 1 (easy) to 5 (hard/adversarial)
    "annotation_source": str, # "human" | "synthetic" | "augmented"
}
```

#### `intent_routing` — CSL gate decisions mapped to HeadyConductor intents

```python
{
    "id": str,
    "input_text": str,
    "active_intents": list[str],    # List of intent labels above τ threshold
    "intent_scores": dict[str, float],  # {intent: cosine_score}
    "routing_decision": list[str],  # Pipeline stages dispatched
    "multi_label": bool,            # True if >1 intent fired
}
```

#### `csl_proofs` — Step-by-step CSL reasoning traces

```python
{
    "id": str,
    "expression": str,           # CSL expression (e.g., "A AND (B OR NOT C)")
    "variables": dict[str, str], # {"A": "text...", "B": "text...", "C": "text..."}
    "steps": list[{
        "op": str,               # Gate operation
        "operands": list[str],   # Variable names
        "result": float | bool,  # Intermediate result
        "explanation": str,      # Natural language reasoning
    }],
    "final_result": bool | float,
    "final_explanation": str,
}
```

## Gate Operation Examples

### AND Gate (cosine similarity ≥ τ)

| text_a | text_b | cosine_sim | gate_result |
|---|---|---|---|
| "Metatron's Cube node placement" | "Sacred Geometry central node topology" | 0.841 | True |
| "HeadyConductor routing stage" | "pipeline dispatch decision" | 0.763 | True |
| "CSL AND gate threshold" | "phi inverse cosine boundary" | 0.812 | True |
| "bee swarm coordination" | "quantum field fluctuations" | 0.198 | False |
| "HNSW index construction" | "agricultural harvest planning" | 0.041 | False |

### OR Gate (normalized superposition)

| text_a | text_b | superposition_concept |
|---|---|---|
| "semantic search retrieval" | "keyword BM25 lookup" | "hybrid document retrieval" |
| "Metatron route" | "Vesica route" | "Sacred Geometry node routing (any tier)" |
| "embed request" | "reindex task" | "vector space operations" |

### NOT Gate (orthogonal complement)

| text | reference | complement_concept |
|---|---|---|
| "vector similarity" | "exact string matching" | "approximate / semantic matching" |
| "cosine gate active" | "threshold exceeded" | "sub-threshold / inactive gate" |
| "retrieval pipeline" | "generation pipeline" | "pre-generation processing stages" |

### Composed Gates

| CSL Expression | Result |
|---|---|
| `(sg_lookup AND csl_eval) OR pipeline_status` | Fires if either (SG+CSL) jointly active or pipeline status intent |
| `semantic_search AND NOT keyword_search` | Pure semantic search intent without keyword fallback |
| `(embed_request OR reindex) AND NOT batch_embed` | Incremental embedding, not batch mode |

## Data Collection and Annotation

### Phase 1: Heady Domain Pairs (3,200 examples)
- Extracted from `heady-ecosystem-docs` cross-reference graph
- Each document pair annotated with cosine similarity (computed via `heady-embeddings-384d`)
- Ground-truth gate results computed from threshold τ = φ⁻¹

### Phase 2: Adversarial Hard Negatives (2,800 examples)
High-cosine-similarity pairs that should **not** trigger AND (cosine 0.55–0.61, just below τ):
- Sacred Geometry vs. general geometry (confusable)
- CSL terms vs. Boolean logic terms (confusable)
- Pipeline terms vs. general software architecture terms (confusable)

These examples train robust τ-boundary discrimination.

### Phase 3: Synthetic CSL Proofs (2,400 examples)
GPT-4o generated step-by-step CSL reasoning traces, verified against formal CSL spec:
- All phi-math constants verified to 5 significant figures
- All cosine similarity values recomputed from actual embeddings
- All routing decisions validated against HeadyConductor routing table

### Phase 4: Human Annotation (2,447 examples)
Domain experts annotated edge cases, composed gate examples, and adversarial inputs:
- 3 annotators per example
- Fleiss' kappa κ = 0.89 (strong agreement)
- Disagreements resolved by HeadySystems architecture team

## Evaluation Metrics

When using this dataset to evaluate CSL models, we recommend:

### Gate Accuracy (Binary AND/NOT)

```python
from sklearn.metrics import accuracy_score, f1_score

def evaluate_gate_accuracy(predictions, labels):
    return {
        "accuracy": accuracy_score(labels, predictions),
        "f1": f1_score(labels, predictions),
        "at_threshold": (predictions == labels).mean()
    }
```

### CSL Coherence Score

```python
import numpy as np

PHI = 1.6180339887
TAU = 1 / PHI  # 0.61803

def csl_coherence(pred_similarities, true_gate_results):
    """
    Coherence: fraction of pairs where model's cosine similarity
    correctly predicts gate result at threshold τ.
    """
    pred_gates = pred_similarities >= TAU
    return (pred_gates == true_gate_results).mean()
```

### Routing Jaccard Similarity

```python
def routing_jaccard(predicted_intents, true_intents):
    """Multi-label routing accuracy via Jaccard similarity."""
    scores = []
    for pred, true in zip(predicted_intents, true_intents):
        pred_set, true_set = set(pred), set(true)
        if not pred_set and not true_set:
            scores.append(1.0)
        else:
            scores.append(len(pred_set & true_set) / len(pred_set | true_set))
    return np.mean(scores)
```

## How to Use

### Load Gate Pairs

```python
from datasets import load_dataset

dataset = load_dataset("HeadySystems/heady-csl-operations", "gate_pairs")

# Filter AND gate examples only
and_examples = dataset["train"].filter(lambda x: x["gate_type"] == "AND")

# Filter hard examples (difficulty >= 4)
hard = dataset["test"].filter(lambda x: x["difficulty"] >= 4)
print(f"Hard test examples: {len(hard)}")  # ~217

# Compute class balance
from collections import Counter
gate_counts = Counter(dataset["train"]["gate_type"])
print(gate_counts)
# Counter({'AND': 3,297, 'OR': 2,430, 'NOT': 1,735, ...})
```

### Train heady-csl-classifier Prototypes

```python
from datasets import load_dataset
from sentence_transformers import SentenceTransformer
import numpy as np

dataset = load_dataset("HeadySystems/heady-csl-operations", "intent_routing")
encoder = SentenceTransformer("HeadySystems/heady-embeddings-384d")

# Collect embeddings per intent label
from collections import defaultdict
intent_embeddings = defaultdict(list)

for example in dataset["train"]:
    embedding = encoder.encode(example["input_text"], normalize_embeddings=True)
    for intent in example["active_intents"]:
        intent_embeddings[intent].append(embedding)

# Compute prototype centroids (normalized)
prototypes = {}
for intent, embeddings in intent_embeddings.items():
    centroid = np.mean(embeddings, axis=0)
    prototypes[intent] = centroid / np.linalg.norm(centroid)

print(f"Initialized {len(prototypes)} prototype vectors")
```

### Evaluate CSL Gate Model

```python
from datasets import load_dataset
import numpy as np

PHI = 1.6180339887
TAU = 1 / PHI

dataset = load_dataset("HeadySystems/heady-csl-operations", "gate_pairs")
test = dataset["test"].filter(lambda x: x["gate_type"] == "AND")

# Use stored cosine similarities (pre-computed from heady-embeddings-384d)
predictions = [sim >= TAU for sim in test["cosine_similarity"]]
ground_truth = test["gate_result"]

accuracy = sum(p == g for p, g in zip(predictions, ground_truth)) / len(predictions)
print(f"AND gate accuracy at τ={TAU:.5f}: {accuracy:.4f}")
```

### CSL Proof Tracing

```python
from datasets import load_dataset

proofs = load_dataset("HeadySystems/heady-csl-operations", "csl_proofs")

for proof in proofs["test"].select(range(3)):
    print(f"Expression: {proof['expression']}")
    for step in proof["steps"]:
        print(f"  {step['op']}({', '.join(step['operands'])}) = {step['result']}")
        print(f"    → {step['explanation']}")
    print(f"Final: {proof['final_result']} — {proof['final_explanation']}\n")
```

## Baseline Results

Models trained and evaluated on this dataset:

| Model | AND Accuracy | OR Jaccard | NOT Accuracy | CSL Coherence |
|---|---|---|---|---|
| `heady-csl-classifier` | **0.943** | **0.887** | **0.921** | **0.912** |
| `heady-embeddings-384d` + τ rule | 0.891 | 0.831 | 0.878 | 0.867 |
| `all-MiniLM-L6-v2` + τ rule | 0.742 | 0.694 | 0.719 | 0.718 |
| `nomic-embed-text` + τ rule | 0.814 | 0.768 | 0.801 | 0.793 |
| BM25 (keyword baseline) | 0.538 | 0.412 | 0.491 | 0.481 |

## Citation

```bibtex
@misc{headysystems2025cslops,
  author       = {{HeadySystems Inc.}},
  title        = {heady-csl-operations: CSL Gate Operation Training Dataset},
  year         = {2025},
  howpublished = {\url{https://huggingface.co/datasets/HeadySystems/heady-csl-operations}},
  note         = {10,847 examples for AND/OR/NOT gate training and evaluation}
}
```

## License

Apache-2.0. See [LICENSE](https://www.apache.org/licenses/LICENSE-2.0) for details.

---
*Built with care by [HeadySystems Inc.](https://huggingface.co/HeadySystems) — Intelligent infrastructure for the next generation of knowledge systems.*
