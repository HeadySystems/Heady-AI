# Public Domain Tech & Data Assets Beneficial to Heady

## Overview

Across six categories — training data, knowledge graphs, vector infrastructure, agent frameworks, MCP servers, post-quantum cryptography, and government science APIs — a substantial body of freely accessible, production-usable public domain and open-licensed resources exists that maps directly to Heady's architecture. Every item in this report is either CC0, Apache 2.0, MIT, or an equivalent open license permitting unrestricted commercial use. Nothing here requires a vendor contract or recurring API fee to integrate at the infrastructure level.

***

## Foundational Training Datasets

The most significant public domain data release of 2025 is **Common Pile v0.1**, produced by EleutherAI in collaboration with Hugging Face, the Allen Institute for AI, MIT, CMU, Cornell, Lawrence Livermore National Laboratory, and the Vector Institute. Released June 2025, it is an 8TB corpus of openly licensed and public domain text spanning 30 source categories including research publications, open-source code, and 300,000 public domain books digitized by the Library of Congress and the Internet Archive.

### Recommended Training Datasets

| Dataset | Size | License | Best Use in Heady |
|---------|------|---------|-------------------|
| Common Pile v0.1 | 8TB | Permissive / CC0 | Heady model pretraining base |
| Ling-Coder-SFT | 4.48M samples | Open | HeadyVinci/HeadyBrain code fine-tuning |
| StarCoderData | 0.25T tokens | Apache 2.0 | Code generation fine-tuning |
| oasst1 | 161k samples | Apache 2.0 | HeadyBuddy alignment tuning |
| databricks-dolly-15k | 15k samples | CC BY-SA-3.0 | Instruction-following fine-tuning |
| Yambda-5B (Yandex) | 4.79B interactions | Open research | Recommender systems in HeadyPatterns |

***

## Knowledge Graphs & Semantic Data

| Tool | License | Strength | Heady Use Case |
|------|---------|---------|---------------|
| Wikidata (CC0 dump) | CC0 | 1.65B triples, multilingual | WisdomStore knowledge base |
| WikiSnap25 (Parquet) | Open | 7M articles, 314M edges | HeadyBrain graph lookup |
| AllegroGraph | Community free | Neuro-symbolic AI, LLM+vector+GNN | Advanced knowledge reasoning |
| Neo4j Community | GPL v3 | Most adopted, Cypher query | Relationship graph queries |
| ArangoDB | Apache 2.0 | Multi-model ACID, graph+doc | HeadyPatterns storage |
| JanusGraph | Apache 2.0 | Hadoop-scale, distributed | Large-scale analytics |

***

## Vector Databases & Embedding Infrastructure

- **Qdrant** — sparse+dense hybrid vectors, JSON payload filtering, HNSW indexing
- **Chroma** — fastest path to local embedding store, metadata-tagged document embedding
- **pgvector** — PostgreSQL extension, combines SQL queries with vector similarity
- **FAISS** (Meta, MIT) — gold standard for ANN search at scale

***

## Agent Frameworks & Orchestration

| Framework | License | Stars | Streaming | A2A/MCP | Best Heady Use |
|-----------|---------|-------|-----------|---------|---------------|
| LangGraph | Apache 2.0 | High | Per-node token | A2A ready | Orchestration parallel to HeadyConductor |
| CrewAI | MIT | High | Limited | Emerging | Role-based HeadyBuddy personas |
| Google ADK | Apache 2.0 | Mid | Vertex stream | A2A native | GCP/Vertex AI integration |
| Dify | Apache 2.0 | 50k+ | Yes | MCP native | RAG pipelines, HeadyBrain |
| n8n | Fair-code | High | N/A | 400+ connectors | HeadyConnection integrations |
| Ollama | MIT | High | Yes | N/A | Local model runner for all 4 Colab nodes |

***

## MCP Servers (Pre-Built, Ready to Wire)

### Official First-Party
- Filesystem MCP, GitHub MCP, Google Drive MCP, PostgreSQL MCP, Slack MCP, Puppeteer MCP, Fetch MCP

### High-Value Community
- Semgrep MCP, Chroma MCP, Snowflake/BigQuery MCP, Datadog/Sentry/PagerDuty MCP, Docker/Kubernetes MCP, Stripe MCP

***

## Post-Quantum Cryptography Libraries

| Library | Kyber | Dilithium | FALCON | SPHINCS+ | License |
|---------|-------|-----------|--------|----------|---------|
| wolfSSL/wolfCrypt | ✅ | ✅ | ✅ | ✅ | GPL/Commercial |
| liboqs (OQS) | ✅ | ✅ | ✅ | ✅ | Apache 2.0 |
| Bouncy Castle | ✅ | ✅ | ✅ | ✅ | MIT |
| Botan | ✅ | ✅ | Partial | ✅ | BSD-2 |
| OpenSSL 3.5+ | ✅ | ✅ | ✅ | ✅ | Apache 2.0 |

***

## Government & Science Public Data APIs

- **NASA Open APIs** (api.nasa.gov) — APOD, Mars Rover Photos, NEO, EPIC
- **NOAA-NASA NNJA-AI v01** — Earth observations 1979–present, Apache Parquet on GCP/S3
- **Google Cloud Public Datasets** — BigQuery, GitHub activity (2.8M repos), NOAA weather
- **data.gov** — Finance, climate, healthcare, transportation datasets

***

## Open-Source AI Infrastructure Tools

- **Open WebUI** (MIT, 124k stars) — self-hosted ChatGPT-style frontend
- **Ollama** (MIT) — single-command local model runner
- **RAGFlow** (Apache 2.0) — production-grade RAG pipeline framework
- **AnythingLLM** (MIT) — full-stack desktop AI application
- **Langfuse** (Apache 2.0) — LLM engineering platform for observability
