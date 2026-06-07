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
<!-- ║  FILE: huggingface/models/heady-buddy-chat/README.md                                                    ║
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
- conversational
- chat
- rag
- heady-ecosystem
- sacred-geometry
- phi-math
- csl
- streaming
pipeline_tag: text-generation
base_model: mistralai/Mistral-7B-Instruct-v0.3
---

# heady-buddy-chat

**HeadyBuddy — The conversational assistant fine-tuned for the Heady ecosystem.**

> Fine-tuned from Mistral-7B-Instruct for authoritative, streaming-capable Q&A across Sacred Geometry topology, Continuous Semantic Logic (CSL) operations, phi-math, and the full HeadySystems architecture stack.

## Model Description

`heady-buddy-chat` is the language model backbone powering **HeadyBuddy**, the primary user-facing conversational interface in the Heady ecosystem. It combines deep domain fine-tuning with Retrieval-Augmented Generation (RAG) capabilities — understanding when to retrieve from the Heady knowledge base versus when to reason directly from internalized domain knowledge.

HeadyBuddy answers questions about:
- **Sacred Geometry topology**: Metatron's Cube, Flower of Life, Vesica Piscis, Merkaba tier routing
- **CSL operations**: AND cosine gates, OR superposition, NOT orthogonal projection, gate composition
- **Phi-math**: φ = 1.6180339887, φ-scaled dimensions, harmonic series, golden angle
- **HeadySystems architecture**: HeadyConductor, pipeline stages, HNSW indexing, pgvector integration
- **Skill system**: 60+ skill documents, ADR rationale, API specifications
- **Bee swarm coordination**: Swarm topology, agent routing, emergent coordination patterns

| Property | Value |
|---|---|
| Base model | `mistralai/Mistral-7B-Instruct-v0.3` |
| Parameters | 7.24B |
| Context window | 32,768 tokens |
| Fine-tuning method | QLoRA (r=64, α=128) |
| Quantization (inference) | GPTQ 4-bit (128 group size) |
| Streaming | Yes (token-by-token, SSE-compatible) |
| RAG integration | HeadySystems/heady-embeddings-384d + pgvector |
| License | Apache-2.0 |

## Intended Uses

### Primary Uses
- **HeadyBuddy interactive assistant**: Real-time Q&A for developers and users working within the Heady ecosystem
- **RAG-augmented responses**: Retrieved context injection from `HeadySystems/heady-ecosystem-docs`
- **Architecture onboarding**: Explaining Heady system design to new engineers
- **CSL reasoning walkthrough**: Step-by-step explanation of gate operations and pipeline routing decisions
- **Debugging assistance**: Interpreting pipeline errors, HNSW index anomalies, CSL threshold failures

### Secondary Uses
- Educational content generation about Sacred Geometry and phi-math
- Documentation drafting for Heady-adjacent projects
- Template generation for CSL operation specifications

### Out-of-Scope Uses
- General-purpose chat unrelated to the Heady ecosystem (degraded performance expected)
- Code generation for languages/frameworks outside the Heady stack
- Medical, legal, financial advice
- Content moderation or safety-critical decisions

## Architecture Details

### Base Architecture: Mistral-7B-Instruct-v0.3

```
MistralForCausalLM
├── Embedding: 32,000 vocab × 4,096 hidden
├── 32 transformer layers
│   ├── Grouped-query attention (GQA): 32 heads, 8 KV heads
│   ├── SwiGLU FFN: 4,096 → 14,336 → 4,096
│   ├── RoPE position encoding (θ = 10,000)
│   └── RMSNorm (pre-norm)
└── LM head: 4,096 → 32,000
```

### QLoRA Fine-Tuning Adapters

Low-rank adapters applied to all attention projection matrices (Q, K, V, O):

```
LoRA rank r = 64
LoRA alpha α = 128 (scaling = α/r = 2.0)
LoRA dropout = 0.05
Target modules: q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj
Trainable parameters: ~167M / 7,240M (2.31%)
```

### Phi-Math System Prompt Anchoring

HeadyBuddy's system prompt includes phi-math constants as grounding context:

```
φ = 1.6180339887 (golden ratio)
φ⁻¹ = 0.6180339887 (CSL cosine threshold τ)
φ² = 2.6180339887 (phi-squared, used in HNSW ef_search)
√φ = 1.2720196495 (phi root, used in chunk sizing)
φ-golden angle = 137.5077640° (swarm angular spacing)
```

This grounding significantly reduces hallucination of numeric constants in architecture discussions.

## Training Data

Fine-tuned on the **HeadySystems/heady-ecosystem-docs** dataset with instruction-following pairs:

| Data type | Examples | Source |
|---|---|---|
| Architecture Q&A pairs | 18,400 | HeadySystems internal |
| CSL gate walkthroughs | 9,200 | heady-csl-operations dataset |
| Sacred Geometry explanations | 7,800 | heady-sacred-geometry-topology dataset |
| Code explanation pairs | 6,400 | Heady GitHub codebase |
| ADR rationale discussions | 4,100 | Architecture Decision Records |
| API usage examples | 3,600 | API specification docs |
| Troubleshooting dialogues | 3,200 | Heady issue tracker |
| Multi-turn conversations | 8,700 | Synthetic (GPT-4o augmented) |
| **Total** | **~61,400** | |

All instruction pairs follow the Mistral-Instruct `[INST] ... [/INST]` format.

### Data Quality Filters
- Factual consistency check against `heady-ecosystem-docs` (BM25 + embedding verification)
- Phi-math constant accuracy verification (automated numeric validation)
- Deduplication (MinHash LSH, Jaccard threshold 0.85)
- Length filter: 64–4,096 tokens per example

## Evaluation

### Heady Domain Benchmarks

| Benchmark | Score |
|---|---|
| Heady Q&A Accuracy (exact match) | **0.847** |
| Heady Q&A Accuracy (semantic match) | **0.912** |
| CSL Gate Explanation Correctness | **0.891** |
| Sacred Geometry Topology Accuracy | **0.878** |
| Phi-math Constant Precision (5 sig. fig.) | **0.963** |
| ADR Rationale Faithfulness | **0.834** |
| Code Snippet Executability | **0.882** |

### General Benchmarks (post-fine-tuning)

| Benchmark | Heady-Buddy | Mistral-7B-Base |
|---|---|---|
| MMLU (5-shot) | 0.631 | 0.642 |
| HellaSwag | 0.812 | 0.821 |
| HumanEval (Python) | 0.348 | 0.341 |
| GSM8K | 0.714 | 0.703 |

Minor degradation on general benchmarks is expected; the model is optimized for Heady domain performance.

### Streaming Performance

| Configuration | Throughput |
|---|---|
| GPTQ 4-bit, single A10G | ~68 tokens/sec |
| GPTQ 4-bit, single RTX 4090 | ~82 tokens/sec |
| GPTQ 4-bit, 2× A100 | ~140 tokens/sec |
| bfloat16, single A100 | ~44 tokens/sec |

## How to Use

### Installation

```bash
pip install transformers accelerate auto-gptq optimum torch
```

### Basic Chat

```python
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

model_id = "HeadySystems/heady-buddy-chat"
tokenizer = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    device_map="auto",
    torch_dtype=torch.float16
)

SYSTEM_PROMPT = """You are HeadyBuddy, the intelligent assistant for the HeadySystems ecosystem.
You have deep knowledge of:
- Sacred Geometry topology (Metatron, Vesica, Merkaba, Flower of Life)
- Continuous Semantic Logic (CSL): AND/OR/NOT cosine gates, phi threshold τ = 0.618
- Phi-math constants: φ = 1.6180339887
- HeadyConductor pipeline stages and routing
- heady-embeddings-384d vector space architecture
Be precise, cite ADRs when relevant, and include phi-math constants when discussing dimensions."""

def chat(user_message: str, history: list = None) -> str:
    history = history or []
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for turn in history:
        messages.append({"role": "user", "content": turn[0]})
        messages.append({"role": "assistant", "content": turn[1]})
    messages.append({"role": "user", "content": user_message})
    
    inputs = tokenizer.apply_chat_template(
        messages, return_tensors="pt", add_generation_prompt=True
    ).to(model.device)
    
    with torch.no_grad():
        outputs = model.generate(
            inputs,
            max_new_tokens=512,
            temperature=0.7,
            top_p=0.9,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id
        )
    
    return tokenizer.decode(outputs[0][inputs.shape[1]:], skip_special_tokens=True)

response = chat("How does the CSL AND gate work with phi-threshold routing?")
print(response)
```

### Streaming Responses

```python
from transformers import TextIteratorStreamer
from threading import Thread

def stream_chat(user_message: str) -> None:
    """Stream HeadyBuddy response token-by-token."""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_message}
    ]
    inputs = tokenizer.apply_chat_template(
        messages, return_tensors="pt", add_generation_prompt=True
    ).to(model.device)
    
    streamer = TextIteratorStreamer(
        tokenizer, skip_prompt=True, skip_special_tokens=True
    )
    generation_kwargs = dict(
        inputs=inputs,
        max_new_tokens=512,
        temperature=0.7,
        do_sample=True,
        streamer=streamer,
    )
    thread = Thread(target=model.generate, kwargs=generation_kwargs)
    thread.start()
    
    for token in streamer:
        print(token, end="", flush=True)
    print()

stream_chat("Explain the Flower of Life tier vector routing in HeadyConductor.")
```

### RAG Integration with heady-embeddings-384d

```python
from sentence_transformers import SentenceTransformer
import psycopg2

embedder = SentenceTransformer("HeadySystems/heady-embeddings-384d")

def retrieve_context(query: str, k: int = 5) -> str:
    """Retrieve relevant Heady docs for RAG context injection."""
    query_vec = embedder.encode(query, normalize_embeddings=True)
    conn = psycopg2.connect("postgresql://localhost/heady")
    cur = conn.cursor()
    cur.execute("""
        SELECT content, 1 - (embedding <=> %s::vector) AS sim
        FROM heady_docs
        ORDER BY embedding <=> %s::vector
        LIMIT %s
    """, (query_vec.tolist(), query_vec.tolist(), k))
    results = cur.fetchall()
    return "\n\n---\n\n".join(f"[sim={r[1]:.3f}] {r[0]}" for r in results)

def rag_chat(user_query: str) -> str:
    context = retrieve_context(user_query)
    augmented_message = f"""Context from Heady knowledge base:
{context}

User question: {user_query}"""
    return chat(augmented_message)
```

## Limitations and Bias

- **Domain over-fit**: The model is heavily optimized for Heady ecosystem knowledge. General reasoning quality may be lower than base Mistral-7B on out-of-domain tasks.
- **Hallucination of Heady-specific details**: Despite fine-tuning, the model may occasionally hallucinate specific API parameter names, ADR numbers, or dimension counts. Always verify against official documentation.
- **Phi-math precision**: Trigonometric and phi-math calculations should be verified programmatically; the model may lose precision beyond 4 significant figures.
- **Context window limits**: RAG retrieval is recommended for questions about specific documents; the model's parametric knowledge covers ~60 skill documents but may miss recent additions.
- **Streaming latency**: First-token latency on CPU is ~800ms; GPU is recommended for production use.
- **Base model biases**: Inherits biases present in Mistral-7B pre-training data. The fine-tuning does not address underlying demographic or cultural biases.

## Citation

```bibtex
@misc{headysystems2025buddychat,
  author       = {{HeadySystems Inc.}},
  title        = {heady-buddy-chat: Conversational AI for the Heady Ecosystem},
  year         = {2025},
  howpublished = {\url{https://huggingface.co/HeadySystems/heady-buddy-chat}},
  note         = {QLoRA fine-tune of Mistral-7B-Instruct-v0.3 on Heady domain Q&A corpora}
}
```

## License

Apache-2.0. See [LICENSE](https://www.apache.org/licenses/LICENSE-2.0) for details.

The base model `mistralai/Mistral-7B-Instruct-v0.3` is licensed under Apache-2.0.

---
*Built with care by [HeadySystems Inc.](https://huggingface.co/HeadySystems) — Intelligent infrastructure for the next generation of knowledge systems.*
