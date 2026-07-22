# Getting the Rebuild Foundation Functional & Performing Autonomous Actions — As Designed

- **Status:** Research report — for founder review
- **Date:** 2026-07-22
- **Author:** Claude Code (grounded in live inspection of `/home/headyme/Heady-AI`, two deep code inventories — autonomous-execution engine + runtime boot path — and live pm2/runtime probes)
- **Series:** fourth of four this session (stale-orphan remediation · global-consistency methods · this). Reuses the same **port-and-verify** method (`REBUILD_PLAN_V2`) and the **governance-as-precondition** thesis.
- **Question answered:** how to get the rebuild foundation *fully functional* and *performing autonomous actions as designed* — the concrete route, not another audit.

---

## 1. The route in one paragraph

Getting here is **not a switch-on** — and that is the single most important correction to make. The first three reports could honestly say "activate what you already built," because the *foundation substrate* (microkernel, health, SSE fabric, config/secrets/db packages, the consistency/coherence/derive machinery) really is built and merely unwired. But the **autonomous-action layer is genuinely partly unbuilt**: the rebuild origin has no action/agent API surface, its cognition is a deterministic stub, and the *designed* autonomous executor — the Vercel-AI-SDK native agent loop from `REBUILD_PLAN_V2` §7 / ADR-0016 — **does not exist yet** (grep-clean on `@ai-sdk`, scaffold `pending`). So the work splits cleanly into **WIRE** (activate the foundation) and **BUILD** (construct the action surface + native agent loop). And it is gated by one precondition proven the hard way this very session: **ungoverned autonomy over this foundation is the damage, not the goal** — the legacy `AUTO-COMMIT` engine, running unattended, flooded `main`, corrupted the working tree, and deleted the `configs/`+ADR corpus and the `data/` runtime dir *during this session*. Therefore the route is: **stabilize → ground → build the executor → route it through the governance rails → prove one autonomous action end-to-end → scale.**

**The finish line to aim at (Milestone M1):** one task flowing `task-ledger → native-agent-loop → consistency-bus-gated action → codeflow-approved auto-commit`, end to end. That single path turns five parallel workstreams into one critical path with a visible finish.

---

## 2. WIRE vs BUILD — the spine

The foundation is two layers with very different remediation. Naming which is which is the whole point.

### Layer A — WIRE (built, installed, boots clean — activate it)
| Component | Path | State |
|---|---|---|
| Microkernel (topological boot, retry+timeout) | `packages/kernel` | Real; `apps/heady-manager` boots on it with **zero external deps** |
| Latent Service Pattern + health aggregation | `apps/heady-manager/src/{index,app}.mjs` | Real; `/health` → 200 via worst-status-wins over `intelligence/events/http` |
| SSE fabric | `apps/heady-manager/src/events.mjs` (`@heady/events`) | Real; typed in-process bus + `/api/events` |
| Config / secrets / db packages | `packages/{config,secrets,db}` | Real helpers; fail-closed loaders exist (see the gap below) |
| Consistency / coherence / derive gate | `tooling/{coherence,heady-derive,data-consistency}`, `packages/consistency-bus` | Real; coherence blocks in `ci.yml`; consistency-bus middleware mounted on the origin |
| φ-math, CSL, perspective, embedding lock | `packages/{phi-math,csl-engine,perspective,embedding}` | Real, tested; embedding model/dim locked (384, bge-small) in 3 code sites |

### Layer B — BUILD (designed but not constructed — build it)
| Component | Path / authority | State |
|---|---|---|
| Origin **action/API surface** | `apps/heady-manager/src/app.mjs` route table | **Absent.** Only `/health`, `/metrics`, `/api/events`, `/intelligence`, `/`. No chat/action/MCP/agent endpoint. |
| Production **cognition wiring** | `apps/heady-manager/src/intelligence.mjs` | **Stub.** Seeded 5-line corpus + SHA-256 `embed384`. `@heady/db`, `@heady/memory-stream`, `@heady/secrets` are **not dependencies** — Neon pgvector / Workers-AI / model gateway are not in the origin's graph. |
| **Native agent loop** (the designed executor) | `REBUILD_PLAN_V2` §7, ADR-0016 (Accepted); `apps/headyme-portal/public/scaffold-plan.json` `p3.agent-loop` | **Not built.** No `@ai-sdk`/`streamText`/`core/modules/coder/` anywhere; scaffold status `pending` (Phase 3). |
| Rebuild **deployment path** | `Dockerfile`, `deploy/cloudrun-worker-service.yaml`, `.github/workflows/deploy.yml` | **Targets the legacy monolith.** Dockerfile → `node heady-manager.js`; `start:worker` script doesn't exist; deploy smoke-tests legacy-only endpoints. |
| Runtime **service catalog** | `configs/service-catalog.yaml` | **Stub** — `test-service` only (54 bytes); the real ~19 Latent Services are not present. |

**Rule of thumb:** if it's in `packages/` or `tooling/`, it's usually WIRE (activate). If it's the origin's *action surface*, its *production cognition*, or the *native agent loop*, it's BUILD.

---

## 3. Why autonomy today is damage, not design (the precondition)

This is the strongest argument in the report because this session *demonstrated* it. The system is **already performing autonomous actions** — from the wrong place, without rails:

- The **legacy `heady-manager` embeds an `AUTO-COMMIT` node** (visible in its own pino logs alongside BrainAPI/self-critique). Running unattended, this class of autonomy produced the effects the earlier reports documented: **~3,399 `HeadyAutoCommit` commits flooding `main`**, and, *during this session*, the **working-tree deletion of the entire `configs/`+ADR corpus** (282 files, which I restored) and the disappearance of the **`data/` runtime dir** (24 MB at session start, gone now).
- The runtime is **disconnected from every governed tree.** Four working copies exist on disk — `/home/headyme/Heady-AI` (this rebuild), `/home/headyme/Heady`, `/home/headyme/workspace/heady-ai`, and `/home/headyme/workspace/latent-core-dev` — and the one actually running (`heady-manager`, **147 restarts and climbing**, crash-looping) runs from `latent-core-dev`, which no governance, SoT, or CI covers. Its logs froze on 2026-06-14, so the crash-loop is real but its cause is not established from here.

**Conclusion:** autonomous execution over a multi-authority, unstable, ungoverned foundation *amplifies* damage. "As designed" is not "more autonomy sooner" — it is autonomy **routed through the rails** (`task-ledger` → `consistency-bus` ingress-block/egress-normalize → `codeflow` govern/approve/apply). The rails must exist in the execution path *before* the executor runs, or you get exactly what this session cleaned up.

---

## 4. The critical path — six gated rungs

Each rung has an exit gate; do not start the next until the prior gate is green. Everything here is **recommended, confirmation-gated** — do not execute stabilization blindly (especially not against `latent-core-dev`, which is uninspected).

**Rung 0 — Stabilize & unify authority *(P0; precondition)***
- Stop the crash-loop: after confirming what `latent-core-dev` is, retire the ungoverned `heady-manager` process (it is the source of the destructive auto-commit). *Gate:* no ungoverned auto-committer running.
- Collapse the four trees to one canonical runtime tree = the rebuild. Freeze the others read-only. *Gate:* exactly one tree is the runtime; SoT (`facts.yaml`) is singular (see report 2).
- *Exit:* nothing is autonomously writing the repo; one authority.

**Rung 1 — Stand up the rebuild origin skeleton *(P0; trivial, safe)***
- Run `node apps/heady-manager/src/index.mjs` (port 3300, free; modules installed; **no DB/secrets/cloud needed**) under a supervisor, as an `ecosystem.config.cjs`/Cloud Run entry that points at the **rebuild** app, replacing the legacy entries.
- *Exit:* a clean, governed origin process answering `/health: 200`. **Necessary, not sufficient** — this is a healthy *skeleton*, not a functional service; it exposes no action surface. Do not let "skeleton up" be reported as "functional."

**Rung 2 — Ground the origin (production cognition) *(P0/P1; BUILD)***
- Add `@heady/db` + `@heady/memory-stream` + `@heady/secrets` as origin dependencies; wire the Neon pgvector retrieval path, Workers-AI `bge-small-en-v1.5` embeddings, and the ADR-0018 model gateway — replacing the `intelligence.mjs` seed-corpus/hash-embedder stub.
- Provision + apply `packages/db/migrations/0001_init.sql`; have the origin call `loadSecrets()` so the three fail-closed secrets (`DATABASE_URL`, `INTERNAL_NODE_SECRET`, `VAULT_PASSPHRASE`) are actually enforced (they are declared-required but never loaded today; `.env` already holds all 30 keys).
- *Exit:* origin's cognition reads/writes real pgvector; secrets enforced; embeddings written (not enqueued-only — see report 2).

**Rung 3 — Build the executor (native agent loop) + port proven logic *(P1; the core BUILD)***
- Build the designed executor per `REBUILD_PLAN_V2` §7 / ADR-0016: Vercel AI SDK v6 `streamText({tools, stopWhen, prepareStep})` against the Liquid/AI-Gateway `baseURL` (model id = route class), durable via Cloudflare Workflow, in a `core/modules/coder/` bounded context.
- **Port, don't resurrect, the legacy engine.** `src/hc_pipeline.js` (real 40 KB DAG engine, fail-closed), `src/hc_auto_success.js` (real event-reactor), `src/agent-orchestrator.js` (real supervisor pool), and the bee-factory are **proven logic in the tree being deprecated** — port their behavior into the rebuild's governed substrate via port-and-verify (characterization tests), rather than reviving the broken legacy path (its handler module `src/agents/pipeline-handlers.js` can't even load — it requires 5 packages that don't exist: `hc-supervisor/hc-checkpoint/hc-brain/hc-readiness/hc-health`). Reconcile the **stage divergence** while porting: the canonical spec is 21 stages (`facts.yaml` locks `stage_count: 21`) but the runtime YAML (`configs/pipeline/hcfullpipeline.yaml` v3.1.0) runs 14 differently-named stages.
- *Exit:* the native agent loop can execute one tool-calling step against the gateway.

**Rung 4 — Route autonomy through the governance rails *(P1; makes it "as designed")***
- Mount `packages/task-ledger` on Neon (durable state machine + outbox, ADR-0027); every autonomous action must: claim a task from the ledger → run in the native agent loop → have its writes pass `consistency-bus` (409 ingress-block on locked-value drift, egress-normalize) → apply via `@heady/codeflow` govern/approve/apply → commit through the governed auto-commit path (scoped, never `git add -A`).
- *Exit:* no autonomous write can reach the repo except through the rails. This is the structural fix for what this session cleaned up.

**Rung 5 — Prove it, then scale**
- **Milestone M1 (the finish line):** enqueue one task in `task-ledger`; the native agent loop claims and executes a governed action; the change is consistency-gated and codeflow-approved and auto-committed. That is the first real *autonomous action as designed*.
- Then scale: expand `service-catalog.yaml` from the `test-service` stub to the real Latent Services; turn on the awareness loop (inject the Workers-AI embedder credential, install the awareness hooks with approval, host the HeadyLens server); make enforcement continuous (commit-time + CI-fix + branch protection, from report 2); build a real rebuild deployment path (Cloud Run service that builds the monorepo and runs `apps/heady-manager`, replacing the legacy Dockerfile/deploy manifests).

---

## 5. Evidence — component verdicts (autonomous-execution layer)

All verified this session; paths relative to `/home/headyme/Heady-AI`.

| Component | Path | Verdict |
|---|---|---|
| HCFullPipeline engine | `src/hc_pipeline.js` | **Real but STALLED** — fired every 15 min on 2026-07-17, never cleared stage 1, silent since; fail-closed without handlers |
| Pipeline task handlers | `src/agents/pipeline-handlers.js` | **BROKEN** — `require()`s 5 nonexistent packages → cannot load; `registerAllHandlers` never called |
| Runtime stage config | `configs/pipeline/hcfullpipeline.yaml` v3.1.0 | **DIVERGENT** — 14 stages, differently named vs the canonical 21 |
| AutoSuccess engine | `src/hc_auto_success.js` | **DORMANT** — real event-reactor, wired at `bootstrap/service-routes.js:163`, but no persisted activity (`data/` gone) |
| Agent orchestrator | `src/agent-orchestrator.js` | **DISABLED** — `new AgentOrchestrator()` commented out in `heady-manager.js` |
| Bee swarm | `src/bees/bee-factory.js` + ~60 stubs | **SCAFFOLDING** — JS work-unit factory + template stubs; no live swarm loop |
| 8 cognitive agents | `src/agents/index.js` | **DEFINED, UNDRIVEN** — consumed only by the dead handler path |
| Native agent loop | `REBUILD_PLAN_V2` §7 / ADR-0016; `scaffold-plan.json` `p3.agent-loop` | **NOT BUILT** — no `@ai-sdk`, no `core/modules/coder/`; `pending` |
| task-ledger | `packages/task-ledger` | **DORMANT** — no DB connection, imported by no executor |
| `heady-autopilot` L0–L3 | `.claude/skills/heady-autopilot/SKILL.md` | **SKILL (by design)** — prompt scaffolding for a coding agent, not a daemon |
| Rebuild origin | `apps/heady-manager` | **SKELETON** — boots healthy, no action surface, cognition stub |
| Running process | pm2 `heady-manager` @ `/home/headyme/workspace/latent-core-dev` | **CRASH-LOOP** — 147 restarts, logs frozen since 2026-06-14, ungoverned |

---

## 6. Do / do NOT

- ✅ **Sequence it as the ladder** — each rung gated; aim at Milestone M1 (one autonomous action end-to-end) as the finish line.
- ✅ **Port the legacy engine logic** into the rebuild's governed substrate (port-and-verify) — it's proven code; don't waste it, don't revive it in place.
- ✅ **Stand up the origin skeleton early** (Rung 1) as a clean governed process to replace the crash-loop — but label it necessary-not-sufficient.
- ❌ **Do not run the executor before the rails exist** — ungoverned autonomy over this foundation is the corpus/`data/`/`main` damage this session cleaned up.
- ❌ **Do not execute stabilization blindly** — the crash-looping process runs from `latent-core-dev`, an uninspected tree; confirm what it is before retiring it.
- ❌ **Do not resurrect the legacy pipeline path** (broken handler module, 5 missing packages, commented-out orchestrator) — it's a port-source, not a runtime target.
- ❌ **Do not let "skeleton-healthy" be reported as "functional"** — `/health: 200` with no action surface is not autonomous capability.

---

### Appendix — verification evidence (this session)

```
pm2 jlist                          # heady-manager, 147 restarts, cwd=/home/headyme/workspace/latent-core-dev
ls -d /home/headyme/{Heady-AI,Heady,workspace/heady-ai,workspace/latent-core-dev}   # all 4 trees exist
apps/heady-manager/src/app.mjs     # routes: /health /metrics /api/events /intelligence /  (no action endpoint)
apps/heady-manager/package.json    # deps: no @heady/db, memory-stream, or secrets
grep -r '@ai-sdk\|streamText\|core/modules/coder' packages apps src   # (empty) → native agent loop not built
src/agents/pipeline-handlers.js    # require()s packages/hc-{supervisor,checkpoint,brain,readiness,health} — none exist
configs/pipeline/hcfullpipeline.yaml   # 14 stages; facts.yaml locks stage_count: 21
hc_pipeline.log                    # 15-min cadence 2026-07-17, stalled at 'Channel Entry', silent after 12:12
ls data/                           # ABSENT (was 24M at session start)
packages/db/src/index.mjs          # "Drizzle/pg wire the actual connection at the app layer" — no connection in-repo
```
