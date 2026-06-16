# Architecture Decision Records

One decision per file. Format: Context → Decision → Consequences. Status lifecycle:
`Proposed → Accepted → (Superseded by ADR-XXXX)`.

Status: **0000–0018** are **Proposed (2026-06-15)**, pending founder approval (ADR-0013). **0019–0029** are **Accepted (2026-06-15)** and carry a v2 Reconciliation section.

Amendments (v2 reconciliation, 2026-06-15): **0003** (stores) and **0005** (agent bootstrap) carry an
Amendment section. **Numbering note:** an earlier set of ADRs also used numbers 0014–0018 (frontend,
event-bus, sandbox, state-sync, vector-trigger); to remove the collision they were **renumbered to
0019–0023** and reconciled with the v2 set. See `REBUILD_PLAN_V2.md` and `docs/compendium/11-reconciliation.md`.

| # | Title | Theme |
|---|---|---|
| 0000 | Reject RAM-First / Latent-as-Truth | Architecture (prior to 0001) |
| 0001 | Canonical Repository Authority | Architecture |
| 0002 | Architecture Backbone | Architecture |
| 0003 | Retrieval Authority — pgvector | Architecture |
| 0004 | Durable Orchestration Center | Architecture |
| 0005 | Agent Governance & Coder-Agent Blast Radius | Architecture / Security |
| 0006 | Idempotency-Key Schema | Operational gap |
| 0007 | DDL Coordination across Logical Replication | Operational gap |
| 0008 | Data Retention & GDPR Posture | Operational gap |
| 0009 | PITR / DR Drill Schedule | Operational gap |
| 0010 | Rate-Limit & Token Budgets | Operational gap |
| 0011 | SLO-Based On-Call Policy | Operational gap |
| 0012 | FinOps Caps & Daily Spend Reporting | Operational gap |
| 0013 | Founder-Bottleneck Governance | Operational gap |
| 0014 | Logical Replication & WAL-Driven CDC | Architecture / Operational |
| 0015 | Embedding-Model Lock | Architecture / Operational |
| 0016 | Native Agent Loop & rustc-Style Bootstrap | Architecture / Security |
| 0017 | Projections Engine & Lifecycle | Architecture / Governance |
| 0018 | Model Gateway & Liquid Routing | Architecture |
| 0019 | Frontend & UI Framework Selection | Architecture (was 0014) · R1 |
| 0020 | Inter-Agent & Swarm Event Bus | Architecture (was 0015) · R8 — NATS best-effort only |
| 0021 | Agent Code Execution Sandbox | Security (was 0016) · scoped vs ADR-0016 |
| 0022 | Real-Time State & UI Sync | Architecture (was 0017) · SSE+HTTP/2 / WS for agent |
| 0023 | Vector Projection Ingestion Trigger | Architecture (was 0018) · Merkle for files / CDC=ADR-0014 |
| 0024 | Embedding Pipeline & Instantaneous-Acquisition Ruleset | Architecture · impl `packages/embedding` |
| 0025 | Strict Global Consistency and Non-Orphanage Governance | Architecture / Governance |
| 0026 | MCP Console (Admin UI) Architecture | Architecture |
| 0027 | Task Ledger & Outbox-driven Sync (Linear/Sentry) | Architecture |
| 0028 | Cross-Domain SSO Partitioned Cookie Governance | Architecture / Security |
| 0029 | WASM WebContainer Sandbox In-Browser Execution | Architecture / Security |

