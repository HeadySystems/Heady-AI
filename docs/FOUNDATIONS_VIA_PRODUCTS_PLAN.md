<!-- HEADY_BRAND:BEGIN
Heady™ Foundations-via-Products Implementation Plan
© 2026 HeadySystems Inc. — Eric Haywood, Founder
HEADY_BRAND:END -->

# Foundations via Products — the plan to ship 990 + headyfinance while building Heady properly

- **Status:** Draft for founder review · **Date:** 2026-07-29
- **Reconciles:** funder's "ship 990 + headyfinance ASAP" with founder's "build the foundations
  properly so automation is a natural later step."
- **Governed by:** `REBUILD_PLAN_V2.md`, `AGENTS.md`, ADR-0000/0016/0017/0032.

## 1. The thesis — products *pull* the foundation into existence

There are two failure modes, and this plan avoids both:

- **Throwaway product hacks** — ship 990/headyfinance as one-off apps bolted on the side; fast now,
  but they don't advance Heady and can't host automation later.
- **A disconnected cathedral** — keep building substrate with no product pulling on it (the trap of
  the last several sessions: real, coherent, gate-green foundation with nothing a customer pays for).

The resolution: **each product is a vertical slice that forces *exactly* the foundation it needs, in
dependency order, with nothing speculative.** You build the data plane because 990 needs it; you build
the audit rails because headyfinance's compliance needs them; you build the eval gate because you
must test the product. **Automation then arrives as the capstone — because by the time the two
products ship, its prerequisites already exist as byproducts.** That is how automation becomes
"natural later" rather than a risky leap.

## 2. What already exists (the foundation you build ON)

The invariant substrate and most horizontal packages are real, tested, and gate-green:

- **Data/SoR:** `@heady/db` (forward-only migration runner, DbPort, real-tx — GATE-1/2), Neon
  pgvector authority, `@heady/config`/`facts.v1`, `@heady/secrets` (+ vault, live CF token).
- **Cognition primitives:** `@heady/embedding` (locked bge-small/384 via Workers AI — credit-funded),
  `@heady/csl-engine`, `@heady/perspective`, `@heady/memory-stream`.
- **Origin + contracts:** `apps/heady-manager` (kernel-managed, `/health`, `/tasks` write path with
  end-to-end trace), `@heady/contracts` (OpenAPI → routes/mcp-tools; strict validators).
- **Governance/observability:** `@heady/consistency-bus`, `@heady/observability` (spans + traceId),
  `@heady/headylens` (narrative), `@heady/approvals` (signed, hash-chained audit-of-record — schema +
  crypto built), `@heady/task-ledger` (durable state + outbox), the 9-gate CI + coherence kernel.
- **Product-relevant skills:** `heady-nonprofit-ops`, `heady-knowledge-ingestion` (990);
  `heady-fintech-trading`, `heady-trading-compliance`, `heady-trading-intelligence` (headyfinance).

Neither product is scaffolded yet — both are clean greenfield slices onto this foundation.

## 3. Phase A — Heady 990 Intelligence (slice 1, the foundation-maker)

990 is the right first slice: lawful public data (IRS 990-series XML bulk), a defined buyer, and it
exercises the whole vertical without regulatory weight. Each step is a real, testable increment that
leaves a reusable foundation piece behind.

| # | Product step | Foundation it forces (reused forever) | Uses |
|---|---|---|---|
| A1 | 990 domain schema (orgs, filings, financial + governance fields, source refs) | The Tier-4 **data-plane pattern** — a real domain migration | `@heady/db` migration runner |
| A2 | Ingest IRS XML bulk → parse → normalize → load, **provenance to source filing** | The **ingestion + provenance model** (every fact links to its origin) | `@heady/db`, `@heady/embedding` |
| A3 | Hybrid search + compare + **OpenAPI-contracted API** (the origin's first real action surface) | The **action/tool contract** — later becomes the agent action surface | `@heady/contracts`, Firebase auth, `@heady/observability` + HeadyLens |
| A4 | Assisted summaries with **evidence links**, via a minimal governed model-egress path | The **model-egress chokepoint** (Workers AI cheap tier; frontier reserved) | `@heady/embedding`, gateway-minimal |
| A5 | A reproducible **benchmark**: field coverage, provenance, extraction accuracy, query time | The **eval/fidelity gate** — *the* automation prerequisite, built because the product needs it | new `tooling/eval-gate` |

**Exit criteria (testable product):** public filing → source-linked, benchmarked answer in the API;
a design partner can run it on a real dataset. **Foundation laid:** data plane, ingestion+provenance,
hybrid retrieval, first API/action surface, minimal model-egress, eval harness.

## 4. Phase B — headyfinance (slice 2, reuse + compliance)

headyfinance **reuses ~70% of Phase A** (data plane, ingestion, provenance, API/auth, retrieval,
observability) and adds only what a financial product uniquely needs:

- **B-reuse:** everything A1–A4 established.
- **B-add-1 — audit-of-record:** wire sensitive actions to `@heady/approvals` (the signed,
  hash-chained event chain from migration 0004). This is where the audit/verification substrate earns
  its keep — regulated finance is its native use case.
- **B-add-2 — compliance gate:** PII/PHI handling, data-residency, the higher risk classes in the
  approval policy (the `patent_locked`/`standard_sensitive` machinery already in the schema).
- **B-add-3 — data surface:** whatever headyfinance's inputs are (market/real-time feeds vs. static
  financial data) — **scope TBD, see §7.**

**Exit criteria:** a testable headyfinance product with the compliance + signed-audit rails exercised
end-to-end. **Foundation laid:** the governance/approval rails, proven on a real product.

## 5. Phase C — automation as the natural capstone

By the end of A + B, every prerequisite for safe automation exists **as a byproduct**:

| Automation needs… | …built by |
|---|---|
| A real **action/tool surface** for an agent to invoke | A3 (990 API) + B (finance actions) |
| An **eval/fidelity gate** to judge autonomous changes | A5 |
| A **governed, budgeted model-egress chokepoint** | A4 |
| **Audit + signed approval rails** | B-add-1/2 (+ `@heady/approvals`, already built) |
| The **task-ledger + consistency-bus + codeflow** rails | already exist |
| The **wave lifecycle / Field law** | ADR-0032 + `seed.v1` (already defined) |

At that point the native agent loop (ADR-0016) doesn't introduce risk — it **orchestrates actions that
already exist and are already governed**, inside the wave lifecycle, starting at a stage-1 scope
allowlist capped to docs/tests. Automation is a capstone, not a leap. That is the whole point of
sequencing it last.

## 6. Preconditions (carried, honest)

- **The July-6 breach vector is a HARD STOP for *infrastructure* automation** — but it does **not**
  block product build. 990 + headyfinance run on the origin + Neon + Workers AI; they don't touch the
  compromised worker path. So product work proceeds now; the credential vector must be found + rotated
  before Phase C turns on any agent that acts on infra.
- **Cost discipline:** the edge (embeddings, small-model, ingestion) runs on the $5k Cloudflare credit
  (Workers AI, scale-to-zero); frontier model calls stay reserved and metered. Burn stays near zero
  through A + B.

## 7. Decisions needed from you (these shape the plan)

1. **Sequential or parallel?** Recommendation: **990 first, then headyfinance reusing its
   foundation** — fastest path to the funder's first shippable product and it builds the shared
   foundation once (a solo founder splitting across two greenfield products is slower and riskier). If
   the funder needs both moving, we start 990's shared foundation (A1–A3) first, then fork headyfinance
   off it — not two independent builds.
2. **What *is* headyfinance?** "Fintech/trading" spans very different products (personal-finance
   analytics vs. trading intelligence vs. compliance tooling), and the answer sets B's data surface and
   compliance weight. I can fully specify Phase B once you name it.

## 8. First move (on your go)

Phase A, step A1–A2: the 990 domain schema migration + the ingestion-with-provenance job — the two
steps that unlock everything else and produce the first testable artifact (real IRS data, normalized,
provenance-linked, queryable). Reversible, no prod, credit-funded.
