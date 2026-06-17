# Heady Rebuild — ADR Audit Report
**Generated:** 2026-06-17 | **Auditor:** Perplexity Computer  
**Source repos audited:** `headyai/heady-production`, `headyai/heady-context`  
**Existing ADRs found:** 5 (across `docs/ADR/` and `heady-complete/docs/ADR/`)  
**New ADRs created:** 10 (ADR-0006 through ADR-0015)  
**Total ADR set:** 15

---

## Existing ADR Assessment

### ADR-0001: Adopt MCP as Unified Tool Gateway
**Original quality: THIN** — 6 lines, no alternatives considered, no negative consequences.

Gaps identified:
- Missing: no mention of Durable Objects for stateful session continuity
- Missing: no context on what existed before (20+ custom APIs)
- Missing: latency overhead not quantified
- Missing: MCP 2026 roadmap alignment (Tasks primitive, DPoP, Server Cards)

**Strength after enhancement: ⭐⭐⭐⭐⭐ — Critical acceptance benefit.**
MCP unifies the entire tool surface. Every IDE, coding agent, and automation that
connects to Heady does so through a single auth-bearing protocol. Without this ADR
enforced, the codebase drifts back to custom per-service APIs.

---

### ADR-0001 (duplicate): Canonical Topology
**Original quality: MINIMAL** — 4 lines, no structure.

Note: two files were named `0001-*.md`. The canonical topology decision was renumbered
to **ADR-0002** in this audit to eliminate the collision. The original file had no
Consequences section, no Alternatives Considered, and referenced only Cloudflare's
remote MCP docs without documenting the GCP origin decision.

**Strength after enhancement: ⭐⭐⭐⭐⭐ — Critical acceptance benefit.**
Without a declared topology, every deployment decision becomes a debate. Cloudflare edge
+ Cloud Run origin is non-obvious; it must be recorded to prevent engineers from
"simplifying" to Cloud Run only and destroying edge performance.

---

### ADR-0002 → ADR-0003: Hybrid Vector Memory
**Original quality: MINIMAL** — 3 lines. Named ADR-0002, renumbered to 0003 in the
clean set to respect the topology insertion at 0002.

Gaps identified:
- Missing: pgvector HNSW index parameters
- Missing: Cloudflare Vectorize limitations (no relational joins)
- Missing: Neon branching as migration safety net
- Missing: deduplication threshold (DEDUP = 0.972)

**Strength: ⭐⭐⭐⭐⭐ — Critical.**
Vector memory is the backbone of all agent intelligence. The authoritative write path
(pgvector vs Vectorize) must be unambiguous or dual-write bugs surface in production.

---

### ADR-0003 → ADR-0004: Liquid Gateway Provider Racing
**Original quality: MINIMAL** — 3 lines. References HeadyAPI public docs but no
provider list, no budget-aware logic documented, no edge-vs-origin decision rationale.

**Strength: ⭐⭐⭐⭐⭐ — Critical.**
Provider racing is HeadyAPI's primary differentiator. If this decision is not recorded,
it will be "simplified" to a single provider call during cost-cutting pressure.

---

### ADR-0004 → ADR-0005: Capacity Ceiling
**Original quality: ADEQUATE** — The conflict between 6765 and 10000 was identified.
Enhanced with explicit upgrade path (soak test → CSL gate → next Fibonacci step).

**Strength: ⭐⭐⭐⭐ — High.**
Without a recorded ceiling decision, runtime configs drift to aspirational numbers.
A production system that advertises 10k capacity but crashes at 6765 is a liability.

---

## New ADRs Created

### ADR-0006: φ-Math Single Source of Truth
**Why needed:** The `core/constants/phi.js` consolidation was done in code but never
formalised. Engineers unfamiliar with φ-math will introduce magic numbers (timeouts
at 3000ms, pool sizes at 100, etc.) without a formal prohibition.

**Strength: ⭐⭐⭐⭐⭐ — Critical.**
This is simultaneously an engineering standard ADR and a patent-protection ADR. Every
magic number introduced is a gap in the novel claims of Heady's 60+ provisional patents.
Acceptance benefit: eliminates an entire class of configuration divergence bugs and
strengthens IP claims.

---

### ADR-0007: CSL Replaces Boolean Gates
**Why needed:** CSL is Heady's core invention. Without a formal ADR mandating its use
over boolean gates, new contributors will write `if (score > 0.5)` throughout the
codebase, diluting both the system architecture and the patent claims.

**Strength: ⭐⭐⭐⭐⭐ — Critical.**
Highest strategic acceptance benefit of all ADRs. CSL is patentable. Boolean gates are not.
Every boolean gate that replaces a CSL operation in production code weakens an IP claim.

---

### ADR-0008: Dual-Active Legacy + Rebuild Strategy
**Why needed:** The decision to abandon the hard cutover in favour of dual-active was
made in a session conversation and never written down. Without it, any new engineer or
agent will assume legacy can be retired and will start removing compatibility shims.

**Strength: ⭐⭐⭐⭐⭐ — Critical.**
An unrecorded migration strategy is the most dangerous type of undocumented decision.
The acceptance benefit is proportional to the production risk of accidental legacy retirement.

---

### ADR-0009: Firebase Auth + httpOnly Cookies
**Why needed:** The timing attack in `heady-manager.js:223` and the CORS wildcard in
`:142` are documented in `IMMEDIATE_ACTION_PLAN.md` but the governing auth decision
is absent. The SPEC.md Unbreakable Law is not an ADR — it lacks context and alternatives.

**Strength: ⭐⭐⭐⭐⭐ — Critical (security boundary).**
auth.headysystems.com is a single point that all 9 domains and 50 services rely on.
An undocumented auth stance means each service engineer makes independent auth choices.

---

### ADR-0010: Core Module Consolidation
**Why needed:** The `core/` restructure eliminated 22+ duplicate implementations, but
without an ADR no one knows that adding a new circuit breaker outside `core/` is
prohibited. This is already starting to drift — `_archive/` contains old implementations.

**Strength: ⭐⭐⭐⭐ — High.**
Acceptance benefit: prevents accumulation of the exact technical debt that required the
consolidation in the first place.

---

### ADR-0011: Node.js ESM Only
**Why needed:** The `auto-success-engine.ts` TypeScript file and CJS `require()` calls
throughout legacy code create a two-runtime problem. Without this ADR the runtime target
is ambiguous and new files default to whatever the contributor is comfortable with.

**Strength: ⭐⭐⭐⭐ — High.**
Acceptance benefit is proportional to build complexity avoided. TypeScript compilation
adds CI latency; CJS/ESM interop bugs are notoriously difficult to diagnose.

---

### ADR-0012: 21-Stage HCFullPipeline as Canonical
**Why needed:** `RECONCILIATION_DECISIONS.md` noted the `hcfullpipeline.yaml` vs
`.json` conflict but did not elevate the resolution to an ADR. The stage count and
variant table must be in a formal decision record to be enforced.

**Strength: ⭐⭐⭐⭐⭐ — Critical.**
The pipeline is the operational spine of every Heady request. Stage count divergence
between configs and runtime is the highest-probability bug source in the rebuild.

---

### ADR-0013: Upstash Redis EventSpine
**Why needed:** `liquid-microservice-architecture.yaml` declares an EventSpine but
does not name the vendor. An engineer unfamiliar with the stack could introduce a
second message broker (e.g., Pub/Sub) without knowing Upstash Redis Streams already
fills this role.

**Strength: ⭐⭐⭐⭐ — High.**
Acceptance benefit: prevents dual-broker sprawl, keeps operational surface minimal.

---

### ADR-0014: Deterministic LLM Execution
**Why needed:** Temperature=0 and seed=42 appear in SPEC.md Laws #3 and #4 but lack
the context of why (patent auditability, regression testing, OracleChain receipts).
Without the why, developers will override temperature for "better" outputs and
break the audit trail.

**Strength: ⭐⭐⭐⭐ — High.**
Acceptance benefit compounds over time: every pipeline run with deterministic execution
adds a reproducible evidence trail for patent claims and compliance audits.

---

### ADR-0015: Sacred Geometry Node Topology
**Why needed:** The topology is heavily referenced in skills, configs, and SPEC.md but
no ADR formally adopts it as the canonical organisational model. Without this, new
services are added without ring assignment, degrading resource allocation precision.

**Strength: ⭐⭐⭐⭐⭐ — Critical.**
Acceptance benefit is both structural (resource allocation clarity) and IP-related
(Sacred Geometry topology is a patent claim).

---

## Gap Analysis — ADRs Still Missing

The following decisions are visible in the codebase but not yet formalised:

| Decision | Evidence | Priority |
|----------|---------|---------|
| **CI/CD pipeline design** — GitHub Actions gates, CodeQL, TruffleHog | `IMMEDIATE_ACTION_PLAN.md` Phase 4 | High |
| **Neon Postgres as primary OLTP DB** — why not Supabase, PlanetScale, or Spanner | `ARCHITECTURE.md`, connection pool config | High |
| **Structured logging standard** — Pino vs Winston, replacing console.log | `IMMEDIATE_ACTION_PLAN.md` Phase 5 | Medium |
| **Drupal 11 as CMS** — why Drupal, headless approach, Cloudflare Pages delivery | `domain-architecture.yaml`, heady-drupal service | High |
| **9-domain brand architecture** — nonprofit/commercial split, HeadyConnection governance | `domain-architecture.yaml` | Medium |
| **GCP project + region lock** — us-east1, gen-lang-client-0920560496 canonical | `SPEC.md` | High |
| **heady-manager.js decomposition** — 76KB → route modules, not a config decision yet | `IMMEDIATE_ACTION_PLAN.md` Phase 3b | Medium |
| **Post-quantum cryptography readiness** — ML-DSA, ML-KEM, hybrid classical+PQC | `heady-pqc-security` skill | High |

---

## Summary Scorecard

| Category | ADR Count | Critical | High | Notes |
|----------|-----------|---------|------|-------|
| Protocol / Integration | 2 | 2 | 0 | ADR-0001, 0004 |
| Infrastructure / Topology | 3 | 3 | 0 | ADR-0002, 0003, 0015 |
| Mathematics / Constants | 2 | 2 | 0 | ADR-0005, 0006 |
| Logic / Execution Model | 3 | 3 | 0 | ADR-0007, 0012, 0014 |
| Migration / Strategy | 1 | 1 | 0 | ADR-0008 |
| Security / Auth | 1 | 1 | 0 | ADR-0009 |
| Code Structure | 2 | 0 | 2 | ADR-0010, 0011 |
| Data / Messaging | 2 | 0 | 2 | ADR-0003, 0013 |
| **Total** | **15** | **11** | **4** | |

**8 additional ADRs recommended** to cover CI/CD, Neon selection, logging standard,
Drupal CMS, 9-domain architecture, GCP region lock, module decomposition, and PQC.
