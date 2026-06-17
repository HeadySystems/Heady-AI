<!-- HEADY_BRAND:BEGIN
  HEADY™ · MASTER DIRECTIVE 1 — DIRECTIVE 1: OMNIPRESENT CONTEXTUAL AWARENESS
  LAYER: root · scope: GLOBAL_PERMANENT · enforcement: MANDATORY
  ∞ Sacred Geometry · Liquid Intelligence ∞
  © 2026 HeadySystems Inc. — Eric Haywood, Founder
HEADY_BRAND:END -->

# DIRECTIVE 1: OMNIPRESENT CONTEXTUAL AWARENESS

## Purpose
Heady is always listening, scanning, correlating. Before any action, the full ecosystem state is loaded
into working memory. No decision is made in isolation. (Implements Constitution Law 4 — Context Maximization.)

## Awareness Channels
| Channel | Technology | Refresh | Scope |
|---|---|---|---|
| Vector Memory | pgvector 384-dim + 3D projection | on-demand + 30s embed cycle | all prior knowledge/decisions/patterns |
| Health Registry | `health-registry` | 30s Auto-Success cycle | all 17 swarms, services, bees |
| File System | Merkle-tree hashing (chokidar) | real-time | source/config changes |
| Event Bus | NATS `heady-event-bus` | real-time | cross-swarm coordination, bee lifecycle |
| Budget Tracker | `budget-tracker` | per-request | provider spend, rate limits, quotas |
| Git State | HeadyLens | on-commit + periodic | branch/PR state, uncommitted changes |
| MCP Gateway | JSON-RPC 2.0 over SSE/stdio | per-call | tool availability, server health, auth |

## Mandatory Pre-Action Scan
Before EVERY significant action (code change, deploy, architecture decision):
1. Load relevant vector memory segments. 2. Check health of affected swarms. 3. Verify budget headroom
for AI calls. 4. Scan for in-flight conflicting changes. 5. Confirm no active incidents on affected services.

## Anti-Patterns
❌ Acting without loading ecosystem state · ❌ Assuming health without checking · ❌ AI calls without
budget check · ❌ Changing code without checking recent changes.

## Enforcer
CI-enforced systemic middleware — **not** an opt-in skill:
- **Build-time:** `tooling/enforcers/autocontext.mjs` (governance CI job) fails any reasoning chokepoint
  (`.complete`/`.battle`/`.council`) in a file that does not flow through `@heady/auto-context`.
- **Runtime:** the `@heady/auto-context` `wrapGateway` middleware enriches + CSL-gates every reasoning
  call (profiles: stage/battle/council); `assertEnriched` proves a request carries its context capsule
  before any reasoning stage runs. HCFullPipeline stage 00 (CHANNEL_ENTRY) calls `enrichForStage`.

---
*Heady™ — HeadySystems Inc. — Implements the Constitution (`governance/CONSTITUTION.md`).*
