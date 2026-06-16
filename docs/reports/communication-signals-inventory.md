<!-- ⚠️ GENERATED REPORT — DO NOT EDIT DIRECTLY -->
# HEADY™ Ecosystem Routing and Signals Inventory
**Generated on:** 2026-06-16T18:22:06.544Z · **Type:** Static Analysis

---

## 1. Quality & Consistency Health Check

### ✅ Dependency Architecture: Clean
No circular package dependencies detected.

### ▲ Event Bus Signal Integrity Anomalies
#### Published Events without Active Subscribers:
- `swarm.waggle` (Published by: `.agents/skills/heady-agent-orchestration/SKILL.md`, `.claude/skills/heady-agent-orchestration/SKILL.md`)
- `swarm.result` (Published by: `.agents/skills/heady-agent-orchestration/SKILL.md`, `.claude/skills/heady-agent-orchestration/SKILL.md`)

### 🔒 CSL Gating & Endpoint Auditing
Total active CSL gates detected: **28**
#### Endpoints lacking CSL gate protections in their calling files:
- Operation: `getHealth` (Referenced at: `packages/contracts/README.md:14`, `packages/contracts/test/contracts.test.mjs:14`)
- Operation: `enqueueTask` (Referenced at: `packages/contracts/README.md:9`, `packages/contracts/test/contracts.test.mjs:15`)
- Operation: `getTask` (Referenced at: `packages/contracts/README.md:14`, `packages/contracts/test/contracts.test.mjs:22`)

---

## 2. API Routes & OpenApi Contracts
| Method | Path | OperationId | Referencing Files |
|---|---|---|---|
| `GET` | `/health` | `getHealth` | packages/contracts/README.md<br>packages/contracts/test/contracts.test.mjs |
| `POST` | `/tasks` | `enqueueTask` | packages/contracts/README.md<br>packages/contracts/test/contracts.test.mjs |
| `GET` | `/tasks/{taskId}` | `getTask` | packages/contracts/README.md<br>packages/contracts/test/contracts.test.mjs |

## 3. Package Imports Dependency Matrix
| Package | Imports From |
|---|---|
| `@agents` | `@heady/phi-math`, `@heady/csl-engine`, `@heady/shared`, `@heady/mcp` |
| `root` | `@heady/phi-math`, `@heady/csl-engine`, `@heady/shared`, `@heady/mcp` |
| `@apps/heady-manager` | *None* |
| `@apps/headyme-portal` | *None* |
| `@heady/config` | `@heady/shared` |
| `@heady/contracts` | *None* |
| `@heady/csl-engine` | `@heady/phi-math` |
| `@heady/db` | *None* |
| `@heady/embedding` | *None* |
| `@heady/events` | `@heady/shared` |
| `@heady/kernel` | `@heady/shared`, `@heady/resilience`, `@heady/logger` |
| `@heady/logger` | `@heady/phi-math` |
| `@heady/observability` | `@heady/logger` |
| `@heady/phi-math` | *None* |
| `@heady/resilience` | `@heady/phi-math`, `@heady/shared` |
| `@heady/secrets` | *None* |
| `@heady/security-mesh` | `@heady/phi-math` |
| `@heady/shared` | *None* |
| `@tooling/auto-flow` | *None* |
| `@tooling/decomposition` | *None* |
| `@tooling/doc-hydrator` | *None* |
| `@tooling/embed-corpus` | *None* |
| `@tooling/skeleton-guard` | *None* |
| `@tooling/skill-registry` | *None* |
