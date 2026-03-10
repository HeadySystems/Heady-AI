# External Skills & Integration Opportunities — Research Findings

> **Purpose:** Reference guide for open-source, external, and community-maintained skill/integration opportunities relevant to Heady's development stack.
> **Prepared:** March 9, 2026 | Sources: public web only

---

## 1. MCP Server Skills (Model Context Protocol)

**What it is:** An open standard from Anthropic that provides a universal, standardized interface for connecting LLM applications to external tools, data sources, and services. Think of it as a "USB port" for AI agents.

### Key Resources

| Resource | What It's Useful For | URL |
|---|---|---|
| **MCP Official GitHub Org** | Official spec, SDKs (Python, TypeScript, Java, C#, Rust), and reference servers | https://github.com/modelcontextprotocol |
| **modelcontextprotocol/servers** | Official reference MCP servers (filesystem, GitHub, Slack, PostgreSQL, Google Drive, Redis, Stripe, Brave search) | https://github.com/modelcontextprotocol/servers |
| **microsoft/mcp-for-beginners** | 11-module open-source curriculum covering MCP fundamentals, security, deployment, PostgreSQL integration, and Azure; 13.3k stars | https://github.com/microsoft/mcp-for-beginners |
| **lastmile-ai/mcp-agent** | Streamlined framework for building AI agents using MCP server capabilities | https://github.com/lastmile-ai/mcp-agent |
| **madtank/autogenstudio-skills** | MCP skill library for AutoGen Studio; shows patterns for multi-server agent configs | https://github.com/madtank/autogenstudio-skills |
| **Context7 MCP** | Pulls up-to-date, version-specific library documentation and code examples into LLM context at query time | https://github.com/upstash/context7 |
| **Cloudflare MCP Server Portals** (Open Beta) | Centralize, secure, and observe every MCP connection in an organization — part of Cloudflare One | https://www.cloudflare.com/innovation-week/ai-week-2025/updates/ |

### Notable Official MCP Servers (from `@modelcontextprotocol` npm scope)
- `@modelcontextprotocol/server-github` — repo management, issue/PR operations
- `@modelcontextprotocol/server-filesystem` — local file read/write
- `@modelcontextprotocol/server-postgres` — schema inspection, read-only queries
- `@modelcontextprotocol/server-brave-search` — web and local search
- `@modelcontextprotocol/server-slack` — Slack workspace interaction
- `@modelcontextprotocol/server-google-drive` — Google Drive file search and read
- `@bytebase/dbhub` — multi-database MCP server (PostgreSQL, MySQL, and more)

### Integration Use Case for Heady
MCP servers allow Heady agents to interact with GitHub repositories, query databases with natural language, search documentation, trigger Slack notifications, and orchestrate multi-tool workflows — all through a single standardized interface without custom per-tool integrations.

---

## 2. Vector Database Optimization

**What it is:** Vector databases store high-dimensional embeddings for semantic search, RAG pipelines, recommendations, and anomaly detection. Choosing the right database and indexing strategy determines latency, recall accuracy, and cost at scale.

### Key Open-Source Options

| Database | Best For | Open Source | Self-Host | URL |
|---|---|---|---|---|
| **Qdrant** | Highest raw performance (Rust core); production-grade; best latency in independent benchmarks | Yes | Yes | https://github.com/qdrant/qdrant |
| **pgvector** | Teams already using PostgreSQL; moderate scale (<50M vectors); simplest ops | Yes | Yes | https://github.com/pgvector/pgvector |
| **Milvus** | Massive scale (billions of vectors); enterprise workloads; 35k+ GitHub stars | Yes | Yes | https://github.com/milvus-io/milvus |
| **Weaviate** | Hybrid search (vector + keyword) natively; GraphQL API; built-in vectorization modules | Yes | Yes | https://github.com/weaviate/weaviate |
| **Chroma** | Fast local prototyping; Python-native; RAG development and notebooks | Yes | Yes | https://github.com/chroma-core/chroma |
| **Faiss** (Meta) | Raw in-memory performance; GPU-accelerated; research and library embedding | Yes | Yes | https://github.com/facebookresearch/faiss |

### Benchmark Reference (2025, 10M vectors @ 99% recall)
| Database | p50 latency | p99 latency | Notes |
|---|---|---|---|
| Qdrant | 14ms | 52ms | Fastest purpose-built option |
| Pinecone (managed) | 18ms | 72ms | Best managed simplicity |
| pgvector | 35ms | 130ms | Degrades faster at >50M vectors |
| Weaviate | 38ms | 145ms | Best hybrid search |

Source: [Athenic Benchmark](https://getathenic.com/blog/pinecone-vs-weaviate-vs-qdrant-vs-pgvector), [Firecrawl Vector DB Guide](https://www.firecrawl.dev/blog/best-vector-databases)

### Optimization Resources

| Resource | What It's Useful For | URL |
|---|---|---|
| **pgvectorscale** (Timescale) | Extension that achieves 471 QPS vs Qdrant's 41 QPS at 50M vectors at 99% recall; dramatically extends pgvector's effective range | https://github.com/timescale/pgvectorscale |
| **VDBBench** | Open-source benchmark tool simulating real production workloads (continuous ingestion, filtering, diverse scenarios) | https://github.com/zilliztech/VectorDBBench |
| **Vector Transport Service (VTS)** | Milvus migration tool for automated schema mapping, incremental migration, validation between vector DBs | https://github.com/zilliztech/vts |
| **Top 5 Open Source Vector DBs Guide** | Comparative analysis of Milvus, Faiss, Weaviate, Qdrant — architecture, filtering, managed options | https://zilliz.com/blog/top-5-open-source-vector-search-engines |

### Integration Use Case for Heady
For Heady's RAG pipelines and semantic search: start with **pgvector + pgvectorscale** if PostgreSQL is already in the stack (up to ~50M vectors). Migrate to **Qdrant** for latency-critical workloads or **Weaviate** if hybrid keyword+vector search is needed.

---

## 3. Cloudflare Workers AI

**What it is:** Serverless, pay-per-use AI inference running on Cloudflare's global edge network. Tightly integrated with Vectorize (vector DB), AI Gateway (observability/caching), R2 (storage), and Workers (compute).

### Key Resources

| Resource | What It's Useful For | URL |
|---|---|---|
| **Workers AI Docs** | 50+ open-source models (Llama, Mistral, Stable Diffusion, Whisper, etc.); text generation, image classification, speech recognition, object detection | https://developers.cloudflare.com/workers-ai/ |
| **Workers AI Model Catalog** | Browse all supported models with pricing and context windows; includes Meta Llama 3, OpenAI open models (gpt-oss-120b/20b), Google Gemma, Deepgram TTS/STT, Leonardo image generation | https://developers.cloudflare.com/workers-ai/models/ |
| **Cloudflare Vectorize** | Globally distributed vector database for semantic search, RAG, recommendations — natively integrated with Workers AI embeddings; 50k namespaces, 5M vectors/index | https://developers.cloudflare.com/vectorize/ |
| **AI Gateway** | Unified observability, caching, rate limiting, request retries, model fallback, and routing across Workers AI + OpenAI + Anthropic + Gemini through a single endpoint | https://developers.cloudflare.com/ai-gateway/ |
| **Cloudflare Agents SDK** | TypeScript framework for building stateful agents with persistent SQL + KV state, streaming AI chat, MCP server exposure, task scheduling, and tool support | https://developers.cloudflare.com/agents/ |
| **AutoRAG** | One-click conversational search over website content — built on Vectorize, R2, and Workflows; pairs with Microsoft NLWeb open project | https://www.cloudflare.com/innovation-week/ai-week-2025/updates/ |
| **AI Week 2025 Announcements** | Full summary of 2025 platform expansions: MCP Server Portals, Infire inference engine (Rust), image/TTS model additions, AI Crawl Control | https://blog.cloudflare.com/welcome-to-ai-week-2025/ |

### Top Tasks on Workers AI (2025)
1. Text generation (48.2% of customer accounts) — Most popular: `@cf/meta/llama-3-8b-instruct`
2. Text-to-image (12.3%)
3. Automatic speech recognition (11.0%)

Source: [Cloudflare Radar Year in Review 2025](https://blog.cloudflare.com/radar-2025-year-in-review/)

### Integration Use Case for Heady
Workers AI enables low-latency AI inference at the edge without infrastructure management. **Vectorize** pairs directly with Workers AI embeddings for semantic search. **AI Gateway** provides cost visibility and caching across all providers. The **Agents SDK** enables MCP-compatible stateful agents deployable on Cloudflare's global network.

---

## 4. Firebase Extensions

**What it is:** Pre-packaged, open-source solutions that deploy backend functionality to Firebase projects via Cloud Functions — no custom coding required. Configured via `extension.yaml` and managed through Firebase console or CLI.

### Key Resources

| Resource | What It's Useful For | URL |
|---|---|---|
| **Extensions Hub** | Central marketplace for browsing and installing all Firebase extensions (community + official) | https://extensions.dev |
| **firebase/extensions (GitHub)** | Official source code for all Firebase-maintained extensions (Apache 2.0); 86 contributors, 230 releases | https://github.com/firebase/extensions |
| **Firebase Extensions Docs** | Architecture overview, installation guide, how to build custom extensions | https://firebase.google.com/docs/extensions |
| **Firebase AI Logic** | Formerly Vertex AI in Firebase; client-side Gemini/Imagen access + Firebase App Check + Remote Config; hybrid inference with Gemini Nano on-device | https://firebase.blog/posts/2025/05/whats-new-at-google-io/ |
| **Genkit** | Google's open-source framework for server-side AI in Firebase — model-agnostic (Gemini, OpenAI, etc.), used alongside Firebase AI Logic | https://firebase.google.com/products/extensions |

### Most Widely Used Extensions (by install count)
| Extension | Installs | Use Case |
|---|---|---|
| Stream Firestore to BigQuery | 93K+ | Real-time data export for analytics |
| Search Firestore with Algolia | 38.4K+ | Full-text search on Firestore data |
| Trigger Email from Firestore | 37.8K+ | Event-driven email automation |
| Translate Text in Firestore | 4.7K+ | Multi-language content automation |
| Search with Typesense | 4.3K+ | Fast full-text search indexing |
| Build Chatbot with Gemini API | 3.1K+ | AI chatbot with Firestore context |
| Vector Search with Firestore | 800+ | Semantic similarity search |
| Cloudflare Turnstile App Check | 90+ | Bot protection for Firebase apps |

### Integration Use Case for Heady
Firebase Extensions reduce custom backend development time. High-value candidates: **Stream Firestore to BigQuery** for analytics pipelines, **Search Firestore with Algolia** or **Typesense** for content search, **Chatbot with Gemini API** for AI-assisted features, and **Vector Search with Firestore** for semantic capabilities.

---

## 5. Drupal JSON:API

**What it is:** Drupal's built-in (since Drupal 8.5 core) module that implements the JSON:API specification, exposing all Drupal entities as a RESTful API with zero configuration required. Foundation of headless/decoupled Drupal architectures.

### Key Resources

| Resource | What It's Useful For | URL |
|---|---|---|
| **Drupal Core JSON:API Module Docs** | Official docs: zero-config RESTful API for all Drupal entities; filtering, sorting, pagination, relationships, sparse fieldsets | https://www.drupal.org/docs/core-modules-and-themes/core-modules/jsonapi-module |
| **Decoupled Drupal Guide (Drupal.org)** | Comprehensive guide to headless architecture patterns, API choices (JSON:API vs GraphQL vs REST), and configuration | https://www.drupal.org/docs/develop/decoupled-drupal |
| **JSON:API Extras module** | Customize API output: rename resource types, fields, disable resources, set API prefix — extends core capabilities | https://www.drupal.org/project/jsonapi_extras |
| **JSON:API Defaults module** | Set default includes, filters, and field sets per resource type so consumers get consistent, opinionated responses | https://www.drupal.org/project/jsonapi_defaults |
| **JSON:API Preview Tab module** | Developer tool: adds a tab to Drupal admin entity pages showing the JSON:API response for quick inspection without browser extensions | https://www.drupal.org/project/jsonapi_preview_tab |
| **next-drupal** | Official Next.js integration for Drupal; handles JSON:API data fetching, static path generation, preview mode, and content moderation | https://next-drupal.org |
| **drupal-jsonapi-params** | npm/yarn helper library for constructing typed JSON:API query params (filters, sorts, includes, sparse fieldsets) in TypeScript/JavaScript | https://www.npmjs.com/package/drupal-jsonapi-params |
| **Drupal Next.js module** (Drupal.org) | Drupal-side companion to next-drupal; enables JSON:API subrequests, preview, and revision support | https://www.drupal.org/project/next |
| **JSON:API Customization Tutorial** (Drupal Academy) | Practical guide to using JSON:API Extras + Defaults to tailor API output for decoupled builds | https://www.thedroptimes.com/64654/drupal-academy-releases-guide-customizing-jsonapi-with-jsonapi-extras |

### Key Pattern: Next.js + Drupal Stack
```
Drupal (JSON:API core) 
  + jsonapi_extras (customize output)
  + jsonapi_defaults (standardize responses)
  + next (Drupal module for previews)
→ next-drupal (Node SDK)
  + drupal-jsonapi-params (query builder)
→ Next.js 15 App Router (frontend)
```

### Integration Use Case for Heady
Drupal JSON:API enables Heady to treat Drupal as a headless CMS, serving structured content to Next.js, React, or other frontends. **JSON:API Extras + Defaults** standardize the API surface. **next-drupal** dramatically reduces boilerplate for content fetching, static generation, and preview workflows.

---

## 6. SEO Optimization Tools

**What it is:** Open-source and free tools covering technical SEO audits, rank tracking, content optimization, site crawling, and API-level SEO analysis — all self-hostable.

### Key Open-Source Tools

| Tool | Primary Use | Tech | URL |
|---|---|---|---|
| **RustySEO** | All-in-one SEO: site crawl, Core Web Vitals, on-page analysis, log analysis, dashboards, CSV/Excel/PDF reporting, built-in AI (Ollama/Gemini) | Cross-platform | https://github.com/alexkataev/rustyseo |
| **SerpBear** | Keyword rank tracking (unlimited keywords); GSC integration; SERP API; Docker deployment; PWA | Next.js + SQLite | https://github.com/towfiqi/serpbear |
| **SEOnaut** | Technical SEO audits: crawlability, indexing issues, crawl budget optimization; MIT license | Self-hosted | https://seonaut.org |
| **Greenflare** | Fast website crawling; adjustable depth; detailed technical SEO exports; enterprise-scale audits | Python | https://github.com/nicktacular/Greenflare |
| **ContentSwift** | SERP-driven content research; keyword density analysis; competitive content optimization | TypeScript | https://github.com/hilmanski/contentswift |
| **python-seo-analyzer** | Site structure analysis; word count; technical SEO warnings; CLI tool | Python | https://github.com/sethblack/python-seo-analyzer |
| **seo-tools-api (oguzhan18)** | Embed SEO scoring (meta tags, sitemap, page analysis) into custom apps via REST API | — | https://github.com/oguzhan18/seo-tools-api |
| **SEO Panel** | Multi-site SEO management; keyword tracking; site audits; multi-user; PHP/MySQL API | PHP/MySQL | https://www.seopanel.org |
| **Google Lighthouse** | Free open-source auditing: performance, accessibility, SEO, best practices; CLI + Chrome DevTools | Node.js | https://github.com/GoogleChrome/lighthouse |
| **Google Search Console** | Free canonical source for impressions, clicks, crawl coverage, Core Web Vitals; GSC API available | — | https://search.google.com/search-console |
| **serpapi/awesome-seo-tools** | Curated reference list of 100+ SEO tools across all categories; maintained by SerpApi team | — | https://github.com/serpapi/awesome-seo-tools |

### Specialized Tools
- **Yoast SEO** (WordPress) — Real-time on-page analysis, readability, schema markup — https://yoast.com/wordpress/plugins/seo/
- **Rank Math** (WordPress) — Advanced free SEO plugin: 404 monitor, redirect manager, rich snippets — https://rankmath.com
- **PageSpeed Insights** — Free Core Web Vitals and field data; Google CrUX integration — https://pagespeed.web.dev

### Integration Use Case for Heady
**Google Lighthouse** and **python-seo-analyzer** integrate directly into CI/CD pipelines for automated regression testing. **SerpBear** provides self-hosted rank tracking with API export for dashboards. **RustySEO** covers comprehensive audits without commercial subscriptions.

---

## 7. WCAG 2.1 Accessibility Resources

**What it is:** WCAG 2.1 (Web Content Accessibility Guidelines) defines three conformance levels (A, AA, AAA). Automated tools catch ~25–33% of violations; manual testing with assistive technology is required for full compliance.

### Core Standards References

| Resource | What It's Useful For | URL |
|---|---|---|
| **W3C WAI Tool List** | Official, curated list of all web accessibility evaluation tools by W3C's Web Accessibility Initiative — authoritative starting point | https://www.w3.org/WAI/test-evaluate/tools/list/ |
| **WCAG 2.1 Guidelines (W3C)** | Full specification: 78 success criteria across perceivable, operable, understandable, robust — the compliance target | https://www.w3.org/TR/WCAG21/ |

### Open-Source Automated Testing Tools

| Tool | Type | WCAG Coverage | URL |
|---|---|---|---|
| **axe-core** | Open-source JS engine (industry standard); zero false-positive guarantee; powers dozens of other tools; 1B+ downloads since 2015 | WCAG 2.1 A/AA | https://github.com/dequelabs/axe-core |
| **axe DevTools** (browser ext.) | Chrome/Firefox/Edge extension built on axe-core; free for page-by-page scanning; code-level insights | WCAG 2.1 A/AA | https://www.deque.com/axe/devtools/ |
| **WAVE** (WebAIM) | Browser extension + web tool; visual overlay of issues on page; no data sent to server; built-in contrast checker | WCAG 2.x | https://wave.webaim.org |
| **Pa11y** | CLI + CI/CD automation tool; Node.js; scriptable; integrates axe or HTMLCS; ideal for pre-deploy scanning | WCAG 2.1 | https://github.com/pa11y/pa11y |
| **Google Lighthouse** (Accessibility audit) | Built into Chrome DevTools; free; identifies missing alt text, contrast failures, ARIA misuse; part of CI/CD pipelines | WCAG 2.1 subset | https://github.com/GoogleChrome/lighthouse |
| **Accessibility Insights** (Microsoft) | Free browser extension + Windows app; FastPass for quick wins; guided Assessment walkthrough for full WCAG evaluation; teaches accessibility | WCAG 2.1/2.2 A/AA | https://accessibilityinsights.io |
| **IBM Equal Access Toolkit** | Open-source Chrome/Firefox/Edge extension + rules engine; scans for WCAG 2.2 issues with fix recommendations | WCAG 2.2 | https://www.ibm.com/able/toolkit |
| **QualWeb** | Open-source CLI + browser extension + JS library; checks against WCAG 2.1 ACT rules; keyboard accessibility, color contrast, alt text | WCAG 2.1 ACT | https://qualweb.di.fc.ul.pt |

### CI/CD Integration Pattern
```
pa11y-ci (pre-deploy) 
  → axe-core (jest-axe or @axe-core/playwright)
  → Lighthouse CI (performance + a11y score)
  → manual screen reader testing (NVDA/JAWS/VoiceOver)
```

### Compliance Checklist Highlights (WCAG 2.1 AA)
- **1.4.3** Color contrast ≥ 4.5:1 (normal text), 3:1 (large text)
- **1.1.1** All non-text content has text alternatives (alt text)
- **2.1.1** All functionality keyboard-accessible
- **2.4.3** Logical focus order
- **4.1.2** All UI components have name, role, value (ARIA)
- **1.3.1** Info and relationships conveyed programmatically

### Integration Use Case for Heady
Integrate **axe-core** via `@axe-core/playwright` or `jest-axe` into existing test suites for zero-overhead regression detection. Add **Pa11y** to CI pipelines as a pre-deploy gate. Use **Accessibility Insights** for manual audits during QA. Target WCAG 2.1 AA as the baseline compliance level.

---

## Summary Matrix

| Domain | Top Open-Source Pick | Managed/Hosted Option | Heady Priority |
|---|---|---|---|
| MCP Servers | `modelcontextprotocol/servers` | Cloudflare MCP Portals | High — agent orchestration |
| Vector DB | Qdrant (performance) / pgvector (simplicity) | Pinecone / Qdrant Cloud | High — RAG/semantic search |
| Edge AI Inference | Cloudflare Workers AI (50+ OSS models) | Cloudflare Workers AI | Medium-High — latency-sensitive features |
| Firebase Extensions | firebase/extensions (GitHub) | Firebase Extensions Hub | Medium — reduces backend dev time |
| Drupal API | Core JSON:API + jsonapi_extras | next-drupal SDK | High — headless CMS integration |
| SEO Tooling | RustySEO / SerpBear / Lighthouse | Google Search Console | Medium — audit automation |
| Accessibility | axe-core / Pa11y / Lighthouse | Accessibility Insights | High — compliance requirement |

---

*All sources public and accessed March 2026. URLs verified at time of research.*
