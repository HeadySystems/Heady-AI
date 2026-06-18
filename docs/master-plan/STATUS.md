<!--
  ⚠️ GENERATED REPORT — DO NOT EDIT DIRECTLY.
  Rendered from tooling/report-templates/templates/master-plan-status.hbs
  by @heady/report-templates (bindings: coherence, ledger + heady-derive canon).
  Refresh: node tooling/report-templates/src/render.mjs render master-plan-status.hbs
-->

# Heady™ Master Plan — Live Status

> Auto-generated projection of the rebuild's real state. © 2026 HeadySystems Inc. — Eric Haywood.
> Full plan: `docs/master-plan/00-INDEX.md`. Rendered from live gates + the golden record.

## Canonical facts (locked — from facts.yaml via heady-derive)

| Fact | Value |
|------|-------|
| Product / version | heady-ai 3.0.0 |
| Provisional patents | <!--heady:inject facts.company.patents_provisional-->51<!--/heady:inject--> |
| HCFullPipeline stages | <!--heady:inject facts.hcfullpipeline.stage_count-->21<!--/heady:inject--> (fib(8)) |
| Agents / Bees / Skills | 8 / 35 / 135 |
| Embedding model / dim | @cf/baai/bge-small-en-v1.5 / 384 |
| Retrieval authority | pgvector · Cloud Run region us-central1 |

## Coherence gate (live)

- **Gate:** GREEN · **contradictions:** 0 · **incomplete:** 6
- **Variable registry:** 368 variables across the system map.

## Decomposition / work

- **Legacy decomposition:** 14 transfer groups · 150 components · 13 bundled.
- **Governed proposals (codeflow):** 2.
- **Task-ledger:** live counts require a DB tx (@heady/task-ledger)

## How this page stays true

Rendered by `@heady/report-templates` from the **heady-derive canon** (facts.yaml — locked values can't
drift), the **coherence** binding (`.data/coherence`), and the **ledger** binding. Refresh:
`node tooling/report-templates/src/render.mjs render master-plan-status.hbs`; CI enforces freshness via
`render.mjs check`.
