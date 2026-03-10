# Heady System Build — Skills Summary

**Generated:** 2026-03-09  
**Author:** Heady Connection (eric@headyconnection.org)  
**Location:** `/home/user/workspace/heady-system-build/skills/`  
**Validation:** All 14 skills passed `agentskills validate` (skills-ref)

---

## Overview

This document summarizes all 14 Agent Skills built for the Heady platform. Each skill follows the [agentskills.io](https://www.perplexity.ai/computer/skills) specification: a directory containing a `SKILL.md` file with valid YAML frontmatter, a clear description for agent discovery, and substantive step-by-step instructions.

**Total corpus:** 14 skills | 104,593 bytes | 2,775 lines of instruction content

---

## Skills by Category

### Automation & Computer Use

#### `heady-perplexity-computer-use`
- **File:** `heady-perplexity-computer-use/SKILL.md` (117 lines, 4,919 bytes)
- **Purpose:** Orchestrates Perplexity Computer Use sessions for browser automation, web interactions, form filling, and multi-step workflows.
- **Key capabilities:** Session initialization, action planning loop, data extraction, error handling (CAPTCHA, auth, timeouts), session teardown with JSON output.
- **Trigger phrases:** "browse the web", "take a screenshot of", "fill out the form at", "automate the website"

---

### Research & Intelligence

#### `heady-perplexity-deep-research`
- **File:** `heady-perplexity-deep-research/SKILL.md` (124 lines, 5,414 bytes)
- **Purpose:** Multi-source, citation-grounded deep research with structured reporting.
- **Key capabilities:** Query decomposition into sub-questions, source triangulation across 5 categories, confidence-level synthesis, structured report formats (quick brief → deep-dive), quality checklist.
- **Trigger phrases:** "research", "deep dive", "comprehensive report on", "literature review"

#### `heady-perplexity-competitor-intel`
- **File:** `heady-perplexity-competitor-intel/SKILL.md` (155 lines, 6,783 bytes)
- **Purpose:** Competitive intelligence for the cannabis accessories and headshop market.
- **Key capabilities:** Competitor profiling, product/pricing matrices, SEO & social benchmarking, UX analysis, battlecard generation, SWOT, market gap analysis.
- **Competitor categories covered:** Direct heady glass (DankStop, Smoke Cartel), broad headshop, marketplaces, local/regional.
- **Trigger phrases:** "competitor analysis", "how does X compare", "competitive pricing", "market landscape"

#### `heady-perplexity-patent-search`
- **File:** `heady-perplexity-patent-search/SKILL.md` (146 lines, 6,120 bytes)
- **Purpose:** Patent research, prior art analysis, and freedom-to-operate assessment.
- **Key capabilities:** Multi-database search (USPTO, Google Patents, Espacenet, WIPO), CPC classification mapping for cannabis accessories (A24F, A61M15, C03B), claim element analysis, FTO risk ratings, landscape reports.
- **Legal disclaimer:** Informational only; not legal advice.
- **Trigger phrases:** "search patents", "prior art for", "freedom to operate", "is this patented"

---

### Content & Design

#### `heady-perplexity-content-generation`
- **File:** `heady-perplexity-content-generation/SKILL.md` (148 lines, 6,470 bytes)
- **Purpose:** Brand-aligned content generation across all Heady content types.
- **Key capabilities:** Brand voice specification (5 attributes: knowledgeable, authentic, community-centered, inclusive, compliant), product description format, blog post structure, platform-specific social templates, email campaign structure, SEO metadata (title tag, meta description, OG, schema), compliance checklist.
- **Content pillars:** Artist Spotlight, Terpene/Strain Science, New Arrivals, Community Moments, Culture & History.
- **Trigger phrases:** "write a blog post", "product description for", "social media post about"

#### `heady-sacred-geometry-css-generator`
- **File:** `heady-sacred-geometry-css-generator/SKILL.md` (250 lines, 8,711 bytes)
- **Purpose:** Generates CSS, SVG, and Canvas-based sacred geometry patterns for Heady's UI.
- **Key capabilities:** Complete reference table of 8 sacred geometry patterns (Flower of Life, Seed of Life, Metatron's Cube, Sri Yantra, Fibonacci Spiral, Vesica Piscis, Torus Knot, Merkaba), Heady CSS color palette with custom properties, working SVG/JS/CSS code for Flower of Life, Fibonacci spiral, animated mandala, SVG gradient/filter definitions.
- **Output formats:** Inline SVG, CSS-only, React component, Canvas script, SCSS mixin.
- **Trigger phrases:** "sacred geometry", "mandala pattern", "Flower of Life", "Fibonacci spiral"

---

### CMS & Backend Integration

#### `heady-drupal-content-sync`
- **File:** `heady-drupal-content-sync/SKILL.md` (214 lines, 6,988 bytes)
- **Purpose:** Content synchronization between Drupal CMS and external sources.
- **Key capabilities:** Three sync channels (JSON:API, Migrate API, Drush), full CRUD examples via JSON:API, Migration YAML template for CSV imports, Firebase → Drupal Cloud Function bridge with HMAC webhook, staging-to-production promotion, conflict resolution policy, sync verification steps.
- **Environments:** Local, Staging, Production with auth method mapping.
- **Trigger phrases:** "sync content to Drupal", "import products to Drupal", "migrate from staging"

#### `heady-firebase-auth-orchestrator`
- **File:** `heady-firebase-auth-orchestrator/SKILL.md` (253 lines, 8,934 bytes)
- **Purpose:** Firebase Authentication design, implementation, and troubleshooting.
- **Key capabilities:** Auth architecture diagram, 6 supported providers, custom claims schema (role, heady_tier, drupal_uid), full implementation code (email/password, Google, ID token), Cloud Function examples for custom claims and role promotion, Drupal JWT bridge implementation, Firestore security rules (users, products, portfolios, orders), MFA enrollment, troubleshooting table, auth security checklist.
- **Trigger phrases:** "set up Firebase Auth", "user login flow", "custom claims", "role-based access"

---

### AI Quality & Evaluation

#### `heady-perplexity-eval-orchestrator`
- **File:** `heady-perplexity-eval-orchestrator/SKILL.md` (186 lines, 7,423 bytes)
- **Purpose:** Structured evaluation of AI outputs using multi-criteria rubrics.
- **Key capabilities:** FACTS framework (Factual Accuracy 30%, Alignment 25%, Cohesion 20%, Tone & Style 15%, Specificity 10%), single output eval, A/B/N comparative eval with matrix, regression evaluation with pass/fail delta thresholds, automated signals (hallucination, toxicity, reading level, brand compliance), batch eval pipeline, continuous eval integration spec.
- **Trigger phrases:** "evaluate this output", "score the responses", "run an eval", "benchmark these answers"

#### `heady-perplexity-rag-optimizer`
- **File:** `heady-perplexity-rag-optimizer/SKILL.md` (259 lines, 9,152 bytes)
- **Purpose:** RAG pipeline design, audit, and optimization.
- **Key capabilities:** Full architecture diagram, platform stack recommendations (Pinecone, text-embedding-3-large, Cohere Rerank, LangChain), document preprocessing with deduplication, chunking strategy table by content type, semantic chunking, context-prefixed embedding, Pinecone upsert/query with metadata filters, retrieval tuning via Recall@k/MRR, HyDE, multi-query, re-ranking, hybrid search (BM25 + vector), RAGAs evaluation metrics.
- **Trigger phrases:** "RAG pipeline", "improve retrieval", "vector search quality", "chunking strategy"

#### `heady-perplexity-feedback-loop`
- **File:** `heady-perplexity-feedback-loop/SKILL.md` (246 lines, 8,954 bytes)
- **Purpose:** Feedback collection, analysis, and continuous improvement loops for AI pipelines.
- **Key capabilities:** Feedback signal taxonomy (7 types with strength ratings), Firestore schema (TypeScript interface), React feedback widget component, analysis pipeline (aggregation, LLM classification, failure clustering), improvement action decision table, few-shot training data collection from corrections, KPI dashboard with alert thresholds, feedback loop closure checklist.
- **Trigger phrases:** "collect feedback", "feedback loop", "thumbs up down system", "learn from corrections"

#### `heady-perplexity-multi-agent-eval`
- **File:** `heady-perplexity-multi-agent-eval/SKILL.md` (274 lines, 9,187 bytes)
- **Purpose:** Multi-agent evaluation frameworks where agents cross-evaluate each other's outputs.
- **Key capabilities:** 5 evaluation patterns (Panel of Judges, Adversarial Debate, Specialization Panel, Cascading Review, Tournament Ranking), panel configuration YAML, judge/advocate/critic/moderator prompt templates, aggregation methods (weighted mean, agreement measurement, majority vote), dissent detection and handling, Elo-based tournament ranking, structured eval report format.
- **Trigger phrases:** "multi-agent eval", "agents judge each other", "consensus scoring", "panel of judges"

#### `heady-perplexity-domain-benchmarker`
- **File:** `heady-perplexity-domain-benchmarker/SKILL.md` (263 lines, 9,889 bytes)
- **Purpose:** Domain-specific AI benchmarks for Heady's cannabis industry tasks.
- **Key capabilities:** 5 benchmark categories (Cannabis Science, Product Catalog, Brand Voice, Platform Tasks, Compliance), JSONL dataset format, benchmark execution class with latency/token tracking, 3 scoring methods (exact match, semantic similarity, rubric-based), per-model aggregate analysis with difficulty tiers, full benchmark report template, benchmark maintenance guidelines (quarterly refresh, contamination check, human validation, version control).
- **Trigger phrases:** "benchmark models", "which model is best for", "test domain knowledge", "build eval dataset"

---

## Validation Results

```
Validation run: 2026-03-09
Tool: agentskills validate (skills-ref)

heady-drupal-content-sync          PASS
heady-firebase-auth-orchestrator   PASS
heady-perplexity-code-review       PASS
heady-perplexity-competitor-intel  PASS
heady-perplexity-computer-use      PASS
heady-perplexity-content-generation PASS
heady-perplexity-deep-research     PASS
heady-perplexity-domain-benchmarker PASS
heady-perplexity-eval-orchestrator  PASS
heady-perplexity-feedback-loop     PASS
heady-perplexity-multi-agent-eval  PASS
heady-perplexity-patent-search     PASS
heady-perplexity-rag-optimizer     PASS
heady-sacred-geometry-css-generator PASS

Result: 14/14 PASS | 0 failures
```

---

## File Inventory

| Skill | Lines | Bytes |
|---|---|---|
| heady-perplexity-computer-use | 117 | 4,919 |
| heady-perplexity-deep-research | 124 | 5,414 |
| heady-perplexity-code-review | 140 | 5,649 |
| heady-perplexity-content-generation | 148 | 6,470 |
| heady-perplexity-patent-search | 146 | 6,120 |
| heady-perplexity-competitor-intel | 155 | 6,783 |
| heady-drupal-content-sync | 214 | 6,988 |
| heady-firebase-auth-orchestrator | 253 | 8,934 |
| heady-sacred-geometry-css-generator | 250 | 8,711 |
| heady-perplexity-eval-orchestrator | 186 | 7,423 |
| heady-perplexity-rag-optimizer | 259 | 9,152 |
| heady-perplexity-feedback-loop | 246 | 8,954 |
| heady-perplexity-multi-agent-eval | 274 | 9,187 |
| heady-perplexity-domain-benchmarker | 263 | 9,889 |
| **TOTAL** | **2,775** | **104,593** |

---

## Usage

To load any skill in an agent session:

```
load_skill(name="heady-perplexity-deep-research")
```

To publish skills to Perplexity Computer, manage them at:
https://www.perplexity.ai/computer/skills

---

## Skill Interdependencies

Some skills are designed to work together in pipelines:

```
heady-perplexity-deep-research
    └── feeds into → heady-perplexity-content-generation

heady-perplexity-rag-optimizer
    └── feeds into → heady-perplexity-eval-orchestrator
                  → heady-perplexity-feedback-loop

heady-perplexity-eval-orchestrator
    └── feeds into → heady-perplexity-multi-agent-eval
                  → heady-perplexity-domain-benchmarker

heady-perplexity-feedback-loop
    └── feeds into → heady-perplexity-rag-optimizer (corrections trigger RAG update)
                  → heady-perplexity-eval-orchestrator (feedback drives re-eval)

heady-firebase-auth-orchestrator
    └── feeds into → heady-drupal-content-sync (auth tokens used in Drupal bridge)
```
