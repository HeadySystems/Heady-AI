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
<!-- ║  FILE: huggingface/datasets/heady-ecosystem-docs/README.md                                                    ║
<!-- ║  LAYER: docs                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
---
language:
- en
license: apache-2.0
task_categories:
- text-retrieval
- question-answering
- text-generation
task_ids:
- document-retrieval
- open-domain-qa
- language-modeling
tags:
- heady-ecosystem
- sacred-geometry
- csl
- phi-math
- rag
- fine-tuning
- documentation
size_categories:
- 100K<n<1M
---

# heady-ecosystem-docs

**The complete HeadySystems documentation corpus for fine-tuning and RAG retrieval.**

> 60+ skill documents, Architecture Decision Records, API specifications, and architecture guides — the authoritative knowledge base of the Heady ecosystem, formatted for embedding, fine-tuning, and retrieval-augmented generation.

## Dataset Description

`heady-ecosystem-docs` is the canonical text corpus for the HeadySystems knowledge graph. It contains the full documentation suite of the Heady platform: skill definitions, ADRs, API specs, sacred geometry topology guides, CSL operation references, and developer onboarding materials.

This dataset is the **ground truth** for:
- Fine-tuning `HeadySystems/heady-buddy-chat` on Heady domain knowledge
- Building the retrieval index for `HeadySystems/heady-embeddings-384d`
- Training `HeadySystems/heady-csl-classifier` intent prototypes
- RAG context injection in production HeadyBuddy deployments

| Property | Value |
|---|---|
| Total documents | **342** |
| Total tokens | ~1.2M |
| Unique vocabulary | ~48,000 terms |
| Languages | English |
| Document categories | 8 |
| License | Apache-2.0 |
| Last updated | 2025 |

## Dataset Structure

### Splits

| Split | Documents | Tokens | Use |
|---|---|---|---|
| `train` | 307 | ~1.08M | Fine-tuning, embedding index |
| `validation` | 18 | ~67K | Eval during training |
| `test` | 17 | ~63K | Final benchmark evaluation |

### Data Fields

```python
{
    "id": str,              # Unique document ID (e.g., "skill-001", "adr-023")
    "category": str,        # One of 8 category labels (see below)
    "title": str,           # Document title
    "content": str,         # Full document text (Markdown)
    "tokens": int,          # Approximate token count (tiktoken cl100k_base)
    "metadata": {
        "source": str,      # "skill_docs" | "adr" | "api_spec" | etc.
        "version": str,     # Document version or date
        "tags": list[str],  # Topic tags
        "phi_refs": bool,   # Contains phi-math constants
        "csl_refs": bool,   # References CSL gate operations
        "sg_refs": bool,    # References Sacred Geometry
    }
}
```

### Document Categories

| Category | Count | Avg Tokens | Description |
|---|---|---|---|
| `skill_docs` | 68 | ~2,800 | Individual Heady skill definitions and usage guides |
| `architecture` | 47 | ~3,400 | System architecture diagrams and explanations |
| `adr` | 63 | ~1,900 | Architecture Decision Records with rationale |
| `api_spec` | 41 | ~2,200 | REST and WebSocket API specifications |
| `csl_reference` | 38 | ~1,600 | CSL gate operation formal definitions |
| `sacred_geometry` | 32 | ~2,100 | Sacred Geometry topology and routing guides |
| `onboarding` | 29 | ~1,400 | Developer onboarding and quickstart guides |
| `changelog` | 24 | ~800 | Version changelogs and migration guides |

## Dataset Creation

### Source Data

All content originates from the HeadySystems internal documentation repository. Documents were:

1. **Exported** from the HeadySystems Notion workspace and GitHub documentation directories
2. **Cleaned**: HTML artifacts removed, code blocks normalized, broken links resolved
3. **Normalized**: Consistent Markdown heading hierarchy, phi-math constants verified to 10 decimal places
4. **Deduplicated**: MinHash LSH (Jaccard threshold 0.85) applied; 14 near-duplicate documents merged
5. **Split**: Stratified train/val/test split preserving category distribution

### Annotation

Each document is annotated with structured metadata:
- **Topic tags**: 2–8 tags per document from a controlled vocabulary of 124 terms
- **Phi-math flag**: Whether the document contains φ, φ⁻¹, or φ² numeric constants
- **CSL flag**: Whether CSL AND/OR/NOT gate operations are referenced
- **Sacred Geometry flag**: Whether SG node names (Metatron, Vesica, Merkaba, Flower) appear
- **Difficulty level**: 1–5 scale rating conceptual complexity (for curriculum learning)

### Instruction Pair Generation

The dataset also includes a `qa_pairs` configuration with 42,100 instruction-following pairs generated from the raw documents:

```python
{
    "id": str,
    "source_doc_id": str,
    "instruction": str,     # Question or task instruction
    "input": str,           # Optional additional context
    "output": str,          # Ground-truth answer
    "pair_type": str,       # "factual" | "reasoning" | "code" | "explain"
    "difficulty": int,      # 1–5
}
```

| Pair type | Count | Generation method |
|---|---|---|
| `factual` | 14,200 | Template-based extraction |
| `reasoning` | 9,800 | Chain-of-thought augmentation |
| `code` | 8,400 | Code snippet extraction + question generation |
| `explain` | 9,700 | GPT-4o with Heady context |

## How to Use

### Installation

```bash
pip install datasets
```

### Load Raw Documents

```python
from datasets import load_dataset

# Full document corpus
dataset = load_dataset("HeadySystems/heady-ecosystem-docs", "documents")

# Access training split
for doc in dataset["train"]:
    print(doc["title"], doc["category"], doc["tokens"])
    # "HeadyConductor Architecture Overview", "architecture", 3421

# Filter by category
skill_docs = dataset["train"].filter(
    lambda x: x["category"] == "skill_docs"
)
print(f"Skill docs: {len(skill_docs)}")  # ~55

# Filter documents referencing CSL
csl_docs = dataset["train"].filter(lambda x: x["metadata"]["csl_refs"])
```

### Load Q&A Pairs for Fine-Tuning

```python
from datasets import load_dataset

# Instruction-following pairs
qa_dataset = load_dataset("HeadySystems/heady-ecosystem-docs", "qa_pairs")

# Format for Mistral-Instruct fine-tuning
def format_for_mistral(example):
    instruction = example["instruction"]
    context = example["input"] if example["input"] else ""
    answer = example["output"]
    
    if context:
        prompt = f"[INST] Context: {context}\n\n{instruction} [/INST] {answer}"
    else:
        prompt = f"[INST] {instruction} [/INST] {answer}"
    
    return {"text": prompt}

formatted = qa_dataset["train"].map(format_for_mistral)
```

### Build pgvector Index

```python
from datasets import load_dataset
from sentence_transformers import SentenceTransformer
import psycopg2, numpy as np

dataset = load_dataset("HeadySystems/heady-ecosystem-docs", "documents")
model = SentenceTransformer("HeadySystems/heady-embeddings-384d")

conn = psycopg2.connect("postgresql://localhost/heady")
cur = conn.cursor()

# Create table and HNSW index
cur.execute("""
    CREATE TABLE IF NOT EXISTS heady_docs (
        id TEXT PRIMARY KEY,
        title TEXT,
        category TEXT,
        content TEXT,
        embedding vector(384)
    );
    CREATE INDEX IF NOT EXISTS heady_docs_hnsw
        ON heady_docs USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 200);
""")

# Batch embed and insert
docs = dataset["train"]
batch_size = 64
for i in range(0, len(docs), batch_size):
    batch = docs[i:i+batch_size]
    embeddings = model.encode(
        batch["content"], normalize_embeddings=True, batch_size=batch_size
    )
    for j, doc in enumerate(batch):
        cur.execute(
            "INSERT INTO heady_docs (id, title, category, content, embedding) "
            "VALUES (%s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING",
            (doc["id"], doc["title"], doc["category"],
             doc["content"], embeddings[j].tolist())
        )
conn.commit()
print(f"Indexed {len(docs)} documents into pgvector.")
```

### Chunked Embedding (Long Documents)

```python
from datasets import load_dataset
from sentence_transformers import SentenceTransformer
import math

PHI = 1.6180339887
CHUNK_SIZE = int(512 * PHI**-1)  # ≈ 316 tokens — phi-scaled chunk size
CHUNK_OVERLAP = int(CHUNK_SIZE * PHI**-2)  # ≈ 120 tokens overlap

def chunk_document(text: str, chunk_size: int = CHUNK_SIZE,
                   overlap: int = CHUNK_OVERLAP) -> list[str]:
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i:i+chunk_size])
        chunks.append(chunk)
        i += chunk_size - overlap
    return chunks

dataset = load_dataset("HeadySystems/heady-ecosystem-docs", "documents")
model = SentenceTransformer("HeadySystems/heady-embeddings-384d")

for doc in dataset["train"]:
    if doc["tokens"] > 512:
        chunks = chunk_document(doc["content"])
        embeddings = model.encode(chunks, normalize_embeddings=True)
        # Store chunks with parent doc reference...
```

## Data Quality

### Validation Checks Applied

- ✅ UTF-8 encoding verified for all 342 documents
- ✅ Markdown syntax validated (no unclosed code blocks)
- ✅ Phi-math constants verified: φ = 1.6180339887 (10 d.p.) in all 134 documents referencing it
- ✅ CSL gate formulas validated against formal CSL specification
- ✅ Sacred Geometry node names verified against topology registry
- ✅ Code snippets: 89% pass Python syntax check (11% are pseudocode, flagged in metadata)
- ✅ No PII detected (regex scan + manual review of onboarding docs)
- ✅ License compatibility: all source material is HeadySystems-owned or Apache-2.0

### Known Limitations

- Changelog documents (24) contain version numbers that may become stale; check version metadata
- 11% of code snippets are pseudocode and will not execute directly
- Sacred Geometry topology section assumes familiarity with Euclidean geometry; no background material included
- Some ADR documents reference internal Jira/Linear ticket IDs that are not publicly accessible

## Licensing

This dataset is released under the Apache-2.0 license. All content is original HeadySystems documentation. No third-party copyrighted material is included.

## Citation

```bibtex
@misc{headysystems2025ecodocs,
  author       = {{HeadySystems Inc.}},
  title        = {heady-ecosystem-docs: Complete Heady Platform Documentation Corpus},
  year         = {2025},
  howpublished = {\url{https://huggingface.co/datasets/HeadySystems/heady-ecosystem-docs}},
  note         = {342 documents, 1.2M tokens covering Heady architecture, skills, CSL, and Sacred Geometry}
}
```

---
*Built with care by [HeadySystems Inc.](https://huggingface.co/HeadySystems) — Intelligent infrastructure for the next generation of knowledge systems.*
