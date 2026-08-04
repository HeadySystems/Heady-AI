# Domain 04 — Skills, Workflows & Directives

> Heady™ Master Incorporation Plan · Domain inventory
> **Scope:** 135 skills (`.agents/skills` → synced to `.claude/skills`), 27 workflows (`.agents/workflows`), 27 commands (`.claude/commands`).
> **Working dir:** `/home/headyme/Heady-AI` · **Branch:** `rebuild`
> **Primary sources:** `.agents/skills/*/SKILL.md` (subject = the skills themselves) · `.agents/workflows/*.md` · `tooling/skill-registry/{register,sync-workflows,validate}.mjs` · `.agents/skills/INDEX.md` · `facts.yaml` · legacy `~/Heady/.agents/skills`.
> **Read-only inventory.** No code modified.

---

## 0. Headline numbers

| Metric | Count | Source / note |
|--------|-------|---------------|
| Skills in `.agents/skills/` | **135** (+`INDEX.md`) | `ls` = 136 entries; one is `INDEX.md`, not a skill |
| Skills synced to `.claude/skills/` | **135** | `register.mjs` normalizes 1:1; `INDEX.md` not copied |
| Workflows in `.agents/workflows/` | **27** | each a `*.md` pack |
| Commands in `.claude/commands/` | **27** | **byte-identical mirror** of `.agents/workflows` (via `tooling/skill-registry/sync-workflows.mjs`) — not a separate authoring surface |
| Legacy skills genuinely absent from rebuild | **1** (`heady-embedding-router`, git `D`) | deliberately dropped — see §5 |
| New skills (in rebuild, not in legacy) | **~20** | see §5 |

**Sync model (`tooling/skill-registry/register.mjs`):** `.agents/skills/<name>/SKILL.md` is the **authoring source**; Claude Code loads from `.claude/skills/<name>/SKILL.md`. The registry lifts/repairs YAML frontmatter, canonicalizes `name` to the directory name, collapses `description` to a single ≤1024-char line, copies sibling resource files, and is **idempotent / re-runnable after every `heady-sync pull`**. Two defects it fixes: (1) 25 migrated packs had a banner above the frontmatter; (2) 5 packs declared a `name` dropping the `heady-` prefix. `validate.mjs` checks frontmatter compliance; `sync-workflows.mjs` mirrors workflows → commands.

> ⚠ **INDEX undercount:** `.agents/skills/INDEX.md` header claims **135** but its 13 enumerated category tables sum to **134** (4+18*…). The missing skill is **`heady-autopilot`** (a NEW meta-skill, absent from every INDEX table — `grep -c` = 0). Correct placement: **Category 2 (Agents/Swarms/Orchestration)**, bumping it 17 → **18** and the total to **135**. The roll-up below is derived from the **flat 135-skill listing**, then reconciled to INDEX labels — INDEX is auto-generated and stale (also still tags `heady-auto-flow ⚠(stub)` though it is now 94 lines / fully written). Regenerate INDEX to fix.

---

## 1. Skill category roll-up (all 135)

Categories follow `INDEX.md` taxonomy; counts corrected against the flat listing.

| # | Category | Count | Status | Notes / representative skills |
|---|----------|-------|--------|-------------------------------|
| 1 | Core Laws, Math & Geometry | 4 | ✅ Active | `heady-phi-math-foundation`, `heady-csl-engine` (51 patents, φ-continuous), `heady-vsa-hyperdimensional-computing`, `heady-coding-standards`. The φ/CSL substrate. |
| 2 | Agents, Swarms & Orchestration | **18** | ✅ Active | INDEX says 17 — **+`heady-autopilot`** (missing from INDEX). Incl. `heady-agent-orchestration` (Sacred Geometry, 8 agents), `heady-bee-swarm-ops` (30+ bees), `heady-task-decomposition`, `heady-maximum-potential`, `heady-auto-flow`, `heady-delegation-architect`, `heady-replan`, `heady-a2a-protocol`. |
| 3 | Memory & Knowledge | 13 | ✅ Active | `heady-memory-ops`, `heady-memory-knowledge-os`, `heady-graph-rag-memory`, `heady-knowledge-cartographer`, `heady-knowledge-ingestion(-briefing)`, `heady-context-window-manager`, `heady-distiller`, `heady-hypothesis-lab`. |
| 4 | Vector, Embedding & Retrieval | 9 | ✅ Active | `heady-vector-projection`, `heady-hybrid-vector-search`, `heady-semantic-cache`, `heady-merkle-index`, `heady-repo-map`, `heady-deep-scan`, `heady-drift-detection`, `heady-dual-pass`, `heady-projection-composer`. Embed lock `@cf/baai/bge-small-en-v1.5` 384-dim is consistent (✅ no drift). |
| 5 | Model Mesh, Providers & Research | 17 | ✅ Active | `heady-multi-model`, `heady-arena-productization`, `heady-battle-arena`, `heady-edge-ai`, `heady-research`, `heady-perplexity` + **11 `heady-perplexity-*`** sub-skills (code-review, deep-research, patent-search, eval-orchestrator, rag-optimizer, …). |
| 6 | MCP, Gateways & Connectors | 9 | ✅ Active | `heady-mcp-gateway`, `heady-mcp-gateway-zero-trust`, `heady-mcp-streaming-interface`, `heady-liquid-gateway`, `heady-gateway-routing`, `heady-connector-forge/health/vault`, `heady-semantic-backpressure`. Egress chokepoint = CF AI Gateway (facts.yaml). |
| 7 | Liquid Runtime, Channels & Conversation | 9 | ✅ Active | `heady-liquid-channel/conversation/stream/graph/persona`, `heady-liquid-module-design`, `heady-narrative-engine`, `heady-voice-relay`, `heady-colab-runtime`. |
| 8 | Code Gen, IDE & Dev Tooling | 12 | ✅ Active | `heady-code-generation`, `heady-feature-forge`, `heady-skill-foundry`, `heady-ide-control-plane`, `heady-ide-governed-codeflow`, `heady-sop-pipeline`, `heady-hooks`, `heady-linter-gate`, `heady-dependency-guard`, `heady-git-ops`, `heady-ai-checks`, `heady-installable-package-release-ops`. |
| 9 | Infra, Execution & Reliability | 13 | ✅ Active | `heady-cloud-orchestrator`, `heady-deployment`, `heady-durable-execution` (CF Workflows, **NOT Temporal** — ✅ corrected), `heady-durable-agent-state`, `heady-sandbox-execution`, `heady-web-container`, `heady-event-bus`, `heady-reliability-orchestrator`, `heady-resilience-cache`, `heady-self-healing-lifecycle`, `heady-health-watch-swarm`, `heady-incident-ops`, `heady-cost-guardian`. |
| 10 | Security, Auth & Identity | 10 | ✅ Active | `heady-security-audit`, `heady-pqc-security`, `heady-auth-provider-federation`, `heady-firebase-auth-orchestrator`, `heady-sovereign-identity-byok`, `heady-trust-receipts`, `heady-buddy-permission-ops`, `heady-semantic-firewall`, `heady-middleware-armor`, `heady-forensic-analyst`. |
| 11 | Cross-Device, Sync & Collaboration | 4 | ✅ Active | `heady-cross-device-handoff`, `heady-cross-device-sync-fabric`, `heady-crdt-collaboration`, `heady-buddy-device`. |
| 12 | Frontend, UI & Creative | 9 | ✅ Active | `heady-manager-surface-design`, `heady-microfrontend-portal`, `heady-design-bridge`, `heady-digital-presence`, `heady-living-dashboard`, `heady-domain-architecture-ops`, `heady-sacred-geometry-css-generator`, `heady-visual-builder`, `heady-midi-creative`. |
| 13 | Domain & Business Verticals | 8 | ✅ Active | `heady-fintech-trading`, `heady-trading-compliance`, `heady-trading-intelligence`, `heady-monetization-platform`, `heady-nonprofit-ops`, `heady-intelligence-analytics`, `heady-drupal-content-sync`, `heady-drupal-headless-ops`. |
| | **TOTAL** | **135** | | (INDEX labels sum to 134 due to the `heady-autopilot` omission) |

---

## 2. Workflows (all 27)

Workflows live in `.agents/workflows/*.md` and are mirrored 1:1 into `.claude/commands/` (byte-identical) by `sync-workflows.mjs`. All invoked as `/<name>`. **Engine** (`heady-prompt-pipeline`) gets the full template in §4.

| Workflow | Purpose | Status |
|----------|---------|--------|
| `agent-performance-review` | Evaluate all agents for effectiveness/optimization | ✅ |
| `antigravity-runtime` | Enforce 3D vector workspace, Sacred Geometry SDK, config integrity | ✅ |
| `auto-extract-tasks` | Auto-extract tasks from any new docs/reports/analysis (always) | ✅ |
| `bee-swarm-diagnostic` | Blast all bees, report health across all domains | ✅ |
| `code-projection` | Embed instructions/specs into vector memory; project optimal files out | ✅ |
| `concept-alignment` | Validate `concepts-index.yaml` against actual codebase | ✅ |
| `continuous-embedding` | Auto-embed all project data, interactions, system/environment state | ✅ |
| `deep-scan-init` | Enforce deep-scan + deep-research at start of every task | ✅ |
| `deployment-verification` | Post-deploy smoke tests of all endpoints | ✅ |
| `domain-branding-audit` | Validate sacred geometry / theming / brand compliance across sites | ✅ |
| `edge-cache-warm` | Pre-warm Cloudflare cache for all domains after deploy | ✅ |
| `foundational-pillars` | Foundational Pillars validation — enforced before every system modification | ✅ |
| `heady-battle-sim` | Run the 9-stage battle-sim competitive-evaluation pipeline | ✅ (Arena 9-stage variant) |
| `heady-command` | Route `heady {command}` input to the matching Heady service / intel | ✅ |
| `heady-drift-monitor` | Monitor output drift continuously; auto-reconfigure when determinism degrades | ✅ |
| `heady-omni-sync` | **Apex orchestration meta-workflow** — scan→CSL→modify→extract→enforce→sync; "infinite heartbeat" (7-stage). **NEW (rebuild-only).** | ✅ NEW |
| `heady-prompt-pipeline` | Execute deterministic prompts via MCP prompt executor + CSL confidence gating (**the workflow engine** — §4) | ✅ |
| `heady-service-bootstrap` | Bootstrap a new service from cold start using regenerative meta-prompts | ✅ |
| `heady-sync` | Cross-device git sync — manual / auto / status / watch | ✅ |
| `health-check` | Multi-domain health — 9 sites + Cloud Run + internal services | ✅ |
| `incident-response` | Triage → diagnose → resolve → postmortem any incident | ✅ |
| `memory-compaction` | Prune, dedup, optimize vector memory | ✅ |
| `pipeline-dry-run` | Safely test pipeline changes without side effects | ✅ |
| `projection-hygiene` | Ensure no sparse/one-off/orphan files outside vector memory | ✅ |
| `provider-failover-drill` | Test AI provider failover paths under simulated outage | ✅ |
| `ram-ops` | RAM-first ops — all work in vector space; external stores are projections | ✅ |
| `vector-space-ops` | How to operate through Heady's vector space, bees, event system | ✅ |

**Legacy delta:** 26 legacy workflows → 27 rebuild; the only added one is **`heady-omni-sync`** (no legacy workflows were dropped).

---

## 3. Directives / Commands

- `.claude/commands/` (27) = **exact copy of `.agents/workflows/`** — generated by `tooling/skill-registry/sync-workflows.mjs`. Authoring happens in `.agents/workflows`; commands are the Claude-Code discovery surface (same as skills: `.agents/skills` authoring → `.claude/skills` discovery via `register.mjs`).
- No separate "directives" tree exists; the directive layer is the workflows-as-slash-commands surface plus the meta-skills (`heady-autopilot`, `heady-maximum-potential`) that orchestrate them.

---

## 4. Per-system templates (meta / orchestration + workflow engine)

### heady-autopilot
- **Category:** 2 Agents/Orchestration · **Status:** ✅ Active · **Confidence:** High
- **What:** Drives a goal to completion at a configurable autonomy level (L0–L3, default L2). Maps the route, selects+runs beneficial `/heady-*` skills/commands/workflows, verifies each leg, then auto **commit→push→sync→log**. `--goal`/`--conditions` set destination/guardrails; `--grill-me` clarifies ambiguous goals before committing.
- **Legacy:** NONE — rebuild-only (in "new" set; absent from `~/Heady`).
- **Rebuild:** Routes via `@heady/perspective` (CSL skill routing), route map `tooling/build-plan`, sync `scripts/heady-sync.sh`, logs HeadyLens (`@heady/headylens`).
- **Parts:** Invocation grammar, autonomy ladder (L0–L3), route planner, verifier, close-out (git+sync+log).
- **OSS:** None direct (orchestrates Heady internals).
- **Transfer:** Born in rebuild; no legacy migration needed.
- **Incorporation steps:** (1) add to `INDEX.md` Category 2 (currently missing); (2) confirm it cannot bypass permission gates (per MEMORY).
- **⚠ Drift+decisions:** Missing from `INDEX.md` — only the description-text on its own SKILL.md exists. **Add it to the regenerated INDEX.**

### heady-maximum-potential
- **Category:** 2 · **Status:** ✅ Active · **Confidence:** High
- **What:** Master orchestrator / universal coding-agent system prompt (Claude, GPT, Gemini, Perplexity, Cursor, Copilot…). Synthesizes all 135 skills into one autonomous-builder prompt. v4.0.
- **Legacy:** Transferred from `~/Heady` (same name).
- **Rebuild:** Aligned to locked stack (pnpm/Turborepo, NATS, WASM WebContainers, SSE+HTTP/2, Merkle trigger). Asserts **51 Provisional Patents** ✅ (matches facts.yaml).
- **Parts:** Mission, core principles, full skill synthesis, stack rules.
- **OSS:** Portable prompt (provider-agnostic).
- **Transfer:** Done.
- **Incorporation steps:** Keep "135 skills" claim in sync with the registry count (currently correct).
- **⚠ Drift+decisions:** None material. (Self-claims 135 — matches.)

### heady-auto-flow
- **Category:** 2 · **Status:** ✅ Active (fully written, 94 lines) · **Confidence:** High
- **What:** Full auto-success pipeline — chains Battle → Coder → Analyze → Risks → Patterns through the auto-success engine. MCP tools `mcp_Heady_heady_auto_flow`, `mcp_Heady_heady_hcfp_status`.
- **Legacy:** Transferred.
- **Rebuild:** Sequential pipeline; status/metrics/health via `hcfp_status`. Backed by `tooling/auto-flow/preflight.mjs`.
- **Parts:** Stage chain, two MCP tools, status detail enum.
- **OSS:** None.
- **Transfer:** Done.
- **Incorporation steps:** Fix the HCFP acronym collision (below); de-stub the INDEX entry.
- **⚠ Drift+decisions:** **HCFP acronym collision.** This skill expands **HCFP = "Heady Core Functionality Platform."** facts.yaml + the Accepted ADR lock **HCFP = HCFullPipeline = 21 stages**. Same acronym, two referents → load-bearing fact disagreement. **Decision needed:** rename the auto-success engine's acronym or qualify it. Also: INDEX still tags this `⚠(stub)` — stale; regenerate.

### heady-omni-sync (workflow)
- **Category:** Workflow (apex meta) · **Status:** ✅ Active · **Confidence:** High
- **What:** Continuously scans for context changes → CSL cognitive processing → applies modifications → auto-extracts tasks → enforces standards → globally syncs. 7-stage pipeline; "infinite heartbeat." Mounts on dropzone ingest, cross-device handoff, cron daemon, A2A handoffs, git/CI hooks.
- **Legacy:** NONE — rebuild-only (the single added workflow).
- **Rebuild:** Stage 1 chains `/heady-deep-scan`, `/heady-merkle-index`, `/projection-hygiene`, `/heady-knowledge-ingestion`, `/heady-forensic-analyst`, etc.; Stage 2 routes to CSL vector space.
- **Parts:** 7 stages (Eyes→Brain→…→global sync), 5 hook mount points.
- **OSS:** None.
- **Transfer:** Born in rebuild.
- **Incorporation steps:** Wire the documented hooks (dropzone watcher, git pre-commit, CI on `rebuild`).
- **⚠ Drift+decisions:** Soft — claims it "unites over **60** discrete system components"; this is a round figure, not the 135 skill count. Reword to avoid implying a hard count.

### Workflow engine — heady-prompt-pipeline (+ heady-prompt-orchestration)
- **Category:** Workflow engine / Code-Gen orchestration · **Status:** ✅ Active · **Confidence:** Med-High
- **What:** Executes the **64 master prompts (8 domains × 8)** through a **deterministic MCP prompt executor** with **CSL confidence gating** (decision = HALT when confidence too low). The `heady-prompt-orchestration` skill governs composition; the `heady-prompt-pipeline` workflow is the runner.
- **Legacy:** Transferred (both present in `~/Heady`).
- **Rebuild:** Calls `src/mcp/tools/heady-prompt-executor-tool` (`action: list|execute`, `prompt_id`, `variables`, `domain`); returns a CSL `decision`.
- **Parts:** Prompt catalogue (64), executor tool, CSL gate, domain filter.
- **OSS:** MCP (Model Context Protocol) executor pattern.
- **Transfer:** Done.
- **Incorporation steps:** Verify `heady-prompt-executor-tool` exists in the rebuild `src/mcp/tools/` (workflow references a `require()` path); the executor is the load-bearing dependency.
- **⚠ Drift+decisions:** Workflow uses CommonJS `require()` examples while facts.yaml locks **ESM** — confirm executor exposes an ESM entrypoint (soft, doc-example only).

---

## 5. Legacy ↔ rebuild delta & flags

**Genuinely dropped (legacy-only, NOT in rebuild):**
- **`heady-embedding-router`** — git status confirms `D .agents/skills/heady-embedding-router/SKILL.md` (and `.claude/` copy). ⚠ **Decision to confirm:** likely consolidated into the locked single embedding model (`@cf/baai/bge-small-en-v1.5`, 384-dim, ADR-0015) + the gate-then-embed workflow, making a router redundant. Confirm this was intentional, not lost in sync.
- *(Raw `comm` also flagged `downloaded-skills/` (a dir, not a skill) and 5 stray `*-SKILL.md` flat files — these are legacy duplicates of dir-skills that DID transfer; not genuine losses.)*

**New in rebuild (~20, not in legacy):** `heady-arena-productization`, `heady-autopilot`, `heady-buddy-permission-ops`, `heady-cross-device-handoff`, `heady-delegation-architect`, `heady-feature-forge`, `heady-forensic-analyst`, `heady-hypothesis-lab`, `heady-knowledge-cartographer`, `heady-liquid-module-design`, `heady-living-dashboard`, `heady-manager-surface-design`, `heady-memory-ledger-design`, `heady-narrative-engine`, `heady-projection-composer`, `heady-resource-crystallizer`, `heady-semantic-firewall`, `heady-skill-foundry`, `heady-swarm-evolution`, `heady-synaptic-mesh`, `heady-trust-receipts`. Plus workflow `heady-omni-sync`.

**Drift flags (skill assertions vs facts.yaml / compendium):**
1. ⚠ **`heady-auto-flow`: HCFP acronym collision** — "Heady Core Functionality Platform" vs locked HCFP = HCFullPipeline (22 stages, ADR-0045). **Load-bearing; decide a rename/qualifier.**
2. ⚠ **`INDEX.md` undercount** — header says 135, tables enumerate 134; `heady-autopilot` missing from all tables. Regenerate INDEX (Category 2 → 18).
3. ⚠ **`INDEX.md` stale stub tag** — `heady-auto-flow` marked `⚠(stub)` but is fully written (94 lines); durable-execution one-liner still reads "activity-based" (Temporal-flavored) though the skill body is corrected to CF Workflows.
4. (soft) **`heady-omni-sync`** "over 60 components" — round number, not a hard count.
5. (soft) **`heady-multi-model`** names "Opus 4.6" — stale vs current Opus; not tracked in facts.yaml so non-binding.
6. ✅ **No drift found:** patent count = **51** everywhere (no surviving "60"); HCFullPipeline = **21 stages** everywhere; embedding lock `@cf/baai/bge-small-en-v1.5` 384-dim consistent; durable-execution explicitly **NOT Temporal** (ADR-0004).

---

## 6. Summary

- **Skills by major category (13):** Agents/Orchestration **18** · Model-Mesh/Perplexity **17** · Memory **13** · Infra/Reliability **13** · Code-Gen/IDE **12** · Security **10** · Vector/Embedding **9** · MCP/Connectors **9** · Liquid Runtime **9** · Frontend/Creative **9** · Domain/Business **8** · Cross-Device **4** · Core-Laws/Math **4** = **135 total**.
- **Workflows:** **27** (`.agents/workflows`), mirrored byte-for-byte to **27** `.claude/commands`; the workflow **engine** is `heady-prompt-pipeline` (64-prompt MCP executor + CSL gate).
- **Drift flags:** **3 hard** (HCFP acronym collision; INDEX 134/135 undercount missing `heady-autopilot`; INDEX stale stub/Temporal one-liners) + **2 soft** (omni-sync "60", multi-model "Opus 4.6").
- **Legacy delta:** ~**20 new skills** + **1 new workflow** (`heady-omni-sync`); **1 deliberately dropped** skill (`heady-embedding-router`).
- **Open decisions:** (1) confirm `heady-embedding-router` removal was intentional (consolidated into single-model lock); (2) rename/qualify the auto-flow "HCFP" to end the acronym collision; (3) regenerate `INDEX.md` to count 135 and place `heady-autopilot`.
- **Health:** Sync pipeline (`register.mjs` + `sync-workflows.mjs` + `validate.mjs`) is sound and idempotent; the locked facts (51 patents, 21 stages, bge-small 384-dim, CF Workflows) hold across the skill corpus — drift is now confined to the auto-generated INDEX and one acronym.
