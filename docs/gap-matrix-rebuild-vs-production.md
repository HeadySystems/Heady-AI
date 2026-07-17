<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  FILE: gap-matrix-rebuild-vs-production.md                       ║
<!-- ║  LAYER: docs                                                     ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->

# Gap Matrix — Rebuild vs Production

Legend: **R** = present in rebuild (`HeadySystems/Heady-AI`@`rebuild`),
**P** = present in production (`HeadyAI/heady-production`). Rationale states why
the component should (or should not) exist in the clean rebuild.

## Registries & manifests

| Component | Category | Rebuild | Production | Rationale |
|---|---|---|---|---|
| Central component registry | registry | ✅ `heady-registry.json` | ✅ `configs/heady-registry.json` | Keep — canonical catalog already present. |
| Service catalog | config | ⚠️ stub (`test-service` only) | ✅ multiple | **FIX** — expanded to the real 19 Latent Services from `heady-registry.json`. A stub fails the "no placeholder" rule and gives no routing/health authority. |
| Node registry | registry | ❌ | ✅ `configs/liquid-os/node-registry.yaml` | **ADD** — rebuild ships a `heady-nodes` service + `src/routes/nodes.js` but no declarative node topology. Added `configs/liquid-os/node-registry.yaml` grounded in `src/orchestration/*`+`src/edge/*`. |
| Bee catalog | registry | ❌ (runtime-only `src/bees/registry.js`) | ✅ `configs/liquid-os/bee-catalog.yaml` | **ADD** — 61 bee modules exist but only auto-discovered at runtime; no static catalog for capability planning / swarm routing. Added, enumerating all workers. |
| Agent registry | registry | ❌ | ✅ `configs/mcp-expansion/heady-agents-registry.yaml` | **ADD** — agents split across `src/agents/`, `.agents/agents/`, `.agents/personas/` with no unifying index. Added `configs/liquid-os/agent-registry.yaml`. |
| Workflow registry | registry | ❌ (surfaces exist, no index) | ✅ `configs/mcp-expansion/heady-workflows-registry.yaml` | **ADD** — 10 CI + 29 internal workflows with no single index. Added `configs/liquid-os/workflow-registry.yaml`. |
| MCP tool manifest | config | ❌ | ✅ `configs/mcp-tool-tiers.json` | **ADD** — 40 `heady_*` tools in `src/heady-mcp-server.js` had no tier/scope classification for the zero-trust gateway. Added `configs/mcp-tools.json`. |
| MCP discovery (`.well-known/mcp.json`) | config | ❌ | ✅ | **ADD** — standard MCP server discovery doc was missing; added, reflecting real tools + OAuth 2.1 metadata. |
| MCP client config | config | ✅ `mcp.json` | ✅ `.mcp.json` | Keep — client config present (path differs; not duplicated). |
| Service wiring manifest | config | ➖ (implicit in code) | ✅ `service-wiring-manifest.yaml` | **DEFER** — inter-service protocols are encoded in `src/bootstrap/*` + resilience config; a separate wiring manifest is production-scale and not yet warranted. Not added. |
| Node deployment manifest | config | ➖ | ✅ `config/node_manifest.yaml` | **DEFER** — single-tenant DID node manifest is a production/sovereign-node concern; out of scope for the engineering rebuild. Not added. |
| OpenAPI contract | contract | ✅ `packages/contracts/openapi/heady.openapi.json` | ✅ | Keep. |

## Root governance / meta docs

| Component | Category | Rebuild | Production | Rationale |
|---|---|---|---|---|
| AGENTS.md | doc | ✅ | ✅ | Keep — authoritative rulebook. |
| CLAUDE.md | doc | ✅ | ✅ | Keep — repo map. |
| CONTRIBUTING.md | doc | ❌ | ✅ | **ADD** — no contributor checklist; added with branch policy + registry-sync table. |
| SECURITY.md | doc | ❌ | ✅ | **ADD** — no vuln-reporting / secrets policy at root; added. |
| ARCHITECTURE.md | doc | ❌ | ✅ | **ADD** — no single architecture overview outside ADRs; added a concise layer map. |
| CHANGELOG.md | doc | ❌ | ✅ | **ADD** — no changelog; added Keep-a-Changelog format. |
| CODEOWNERS | config | ✅ `.github/CODEOWNERS` | ✅ root | Keep — already present under `.github/`; root duplicate not needed. |
| ISSUE/PR templates | config | ✅ | ✅ | Keep. |
| LICENSE | legal | ➖ | ✅ | **DEFER** — proprietary repo; licensing is a founder/legal decision, not auto-added. |
| README.md | doc | ✅ | ✅ | Keep. |

## Runtime component parity (spot check)

| Component | Category | Rebuild | Production | Rationale |
|---|---|---|---|---|
| Conductor / orchestrator | node | ✅ `src/heady-conductor.js` | ✅ | Keep. |
| Buddy core + watchdog | node | ✅ `src/orchestration/buddy-core.js`,`buddy-watchdog.js` | ✅ | Keep — hallucination watchdog present. |
| Resilience (circuit breaker/pool/backoff) | node | ✅ `src/resilience/*` + `packages/resilience` | ✅ | Keep. |
| 3D vector memory | node | ✅ `src/vector-memory.js`,`vector-projection-engine.js` | ✅ | Keep. |
| CSL engine/gate | package | ✅ `packages/csl-engine` | ✅ | Keep. |
| φ-math foundation | package | ✅ `packages/phi-math` | ✅ | Keep. |
| PQC security | module | ✅ `src/security/pqc.js` | ✅ | Keep. |
| Cloud-run deployer bee | bee | ✅ `src/bees/cloud-run-deployer-bee.js` | ✅ | Keep. |
| Full-cloud-deploy swarm bee | bee | ✅ `src/bees/full-cloud-deploy-swarm-bee.js` | ✅ | Keep. |
| Documentation bee | bee | ✅ `src/bees/documentation-bee.js` | ✅ | Keep. |
| MCP server v2 | node | ✅ `src/heady-mcp-server.js` | ✅ | Keep — now documented via manifest + discovery. |
| A2A / AG-UI protocol | protocol | ✅ `src/protocols/a2a.js`,`a2ui.js` | ✅ | Keep. |
| Multi-site / websites tree | site | ➖ | ✅ `sites/`,`websites/` | **EXCLUDE** — downstream projection/marketing surface; belongs to mirrors, not the engineering rebuild. |
| `_archive`,`_downloads`,`dropzone`, `HeadySystems_v13` | archival | ➖ | ✅ (13k+ files) | **EXCLUDE** — archival cruft; explicitly must not be reintroduced into the clean rebuild. |

## Summary of gaps acted on

**Fixed (1):** `configs/service-catalog.yaml` stub → real 19-service catalog.
**Added (9):** `configs/liquid-os/node-registry.yaml`, `bee-catalog.yaml`,
`agent-registry.yaml`, `workflow-registry.yaml`; `configs/mcp-tools.json`;
`.well-known/mcp.json`; `CONTRIBUTING.md`; `SECURITY.md`; `ARCHITECTURE.md`;
`CHANGELOG.md` (10 files created + 1 rewritten).
**Deferred/excluded:** service-wiring manifest, node deployment manifest,
LICENSE (founder/legal), multi-site & archival trees (downstream/mirror scope).
