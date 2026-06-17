# ADR-0003 — Source-of-truth ledger (one place per fact)

**Status:** Accepted (2026-06-14)

## Context
Multiple artifacts currently claim authority over the same facts: `heady-registry.json`, `docs/`, `.agents/` context, and (historically) `heady-context` / `HeadyAutoContext` / `heady-docs` repos. When every artifact is "the source of truth," none is, and they disagree (the audit found the same fact — repo count, system health, route definitions — stated three different ways across docs). The cure is one declared owner per concern, with everything else **mechanically derived or alerted on**.

## Decision
Maintain this ledger. Each row names exactly one authoritative source; everything else is a projection of it.

| Concern | Single source of truth | Derived from it |
|---|---|---|
| Code, schemas, contracts | `latent-core-dev` repo (ADR-0001) | the clones, `-core` repos |
| API + MCP tool shape | `packages/contracts/openapi.yaml` (to build, ADR-0006) | server routes, SDK, `heady-registry.json`, MCP registry, docs |
| What happened (state changes) | the append-only event log (ADR-0004) | pgvector, latent/Vectorize cache, read models |
| Prose docs | `docs/` in canonical repo | any external doc mirror |
| Architectural decisions | `docs/adr/` | — (this ledger) |
| Secrets | GCP Secret Manager, pinned versions (ADR-0005) | runtime env only; never the repo |

## Consequences
- Hand-edits to generated artifacts (`heady-registry.json`, SDK, generated contracts) **fail CI** once the contract pipeline lands.
- Any new "source of truth" must be added here by ADR, or it is by definition a projection.
- A fact may appear in many places, but is *authored* in exactly one; divergence is a bug the fidelity gate (ADR-0007) catches, not a judgement call.
