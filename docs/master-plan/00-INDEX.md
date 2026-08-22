# Heady™ Master Incorporation Plan — Index

> The authoritative, decomposed inventory + incorporation plan for **every** significant Heady
> system: agents, bees/swarms, the named cognitive/orchestration engines, skills, workflows,
> directives, unbreakable laws, service providers + services, OSS (current + planned), UIs +
> projections, and legacy transfer disposition. © 2026 HeadySystems Inc. — Eric Haywood.
>
> **Status:** BUILDING (autopilot, full master plan). Approve or adjust any section.

## Ground-truth rule (why this plan exists)

Skill/prompt summaries in `.agents/skills/` were found to contain **fabricated simplifications**
(e.g. `heady-maximum-potential` claimed HCFullPipeline had "8 stages" — it is a **21-stage DAG**;
the patent count was wrongly "60" — it is **51**). Therefore **every entry here is ground-truthed
against primary sources** in this priority order, and any skill-vs-reality drift is flagged:

1. **Legacy source** — `~/Heady`, `~/workspace/Heady` (actual code/config that ran)
2. **Compendium** — `docs/compendium/*` (the rebuild catalog)
3. **Decomposition manifest** — `tooling/decomposition/manifest.json` (14 transfer groups / 150 components)
4. **ADRs + facts.yaml + lexicon.yaml** (locked decisions, stack, named entities)
5. Skills are treated as **claims to verify**, never as truth.

## Per-system entry template

Each system is decomposed with BOTH an incorporation plan and a status log:

```
### <System>
- Category · Status (built|partial|legacy-only|planned/potential) · Confidence (defined|inferred)
- What it is (1–2 lines)
- Legacy presence: ref count + key file paths
- Rebuild presence: package/path (or none)
- Decomposed parts: component → subparts/ports
- OSS: current impl + planned/potential alternatives
- UI / projection (if any)
- Transfer disposition: transfer-as-is | rebuild | rewrite | drop | patent-gated → target pkg + transfer group
- Incorporation steps (ordered)
- ⚠ Drift / open decisions / ADR + unbreakable-law touchpoints
```

## Sections

> **Status: COMPLETE** — all 9 sections written by parallel ground-truth agents (2026-06-17),
> ~2,400 lines. Each flagged skill-vs-reality drift; the consolidated findings + decisions are below.
> **Legacy = this repo's top-level `src/` + root `.js`** (`~/Heady` and `~/workspace/Heady` symlink
> here); **rebuild = `packages/*` + `tooling/*`**.

| # | Domain | File | Status |
|---|--------|------|--------|
| 01 | Cognitive & orchestration engines (24 covered) | `01-engines.md` | ✅ done (493L, 11 drift) |
| 02 | HeadyBees (35) + HeadySwarms + swarm coordination | `02-bees-swarms.md` | ✅ done (250L, 4 drift) |
| 03 | Agents (8) + agent harness + perspective roles | `03-agents.md` | ✅ done (210L, 7 drift) |
| 04 | Skills (135) + workflows (27) + commands | `04-skills-workflows.md` | ✅ done (180L, 5 drift) |
| 05 | Unbreakable laws + directives + governance | `05-laws-directives.md` | ✅ done (354L, 7 drift) |
| 06 | Service providers + services (current + potential) | `06-providers-services.md` | ✅ done (197L, 8 drift) |
| 07 | OSS implementations (current + planned) | `07-oss.md` | ✅ done (192L) |
| 08 | UIs + projections (portal, 9 domains, edge) | `08-uis-projections.md` | ✅ done (138L) |
| 09 | Legacy transfer disposition (14 groups / 150 components) | `09-legacy-transfer.md` | ✅ done (330L) |

## Headline reality

- **The cognitive layer is ~0% built.** Engines, bees, agents, orchestration are *defined* (lexicon/
  ADRs/skills) but **not running** — the manifest routes them to **4 phantom packages that don't exist**
  (`packages/orchestration`, `packages/bees`, `packages/engines`, `packages/projections`). Built &
  verified: `@heady/perspective`, `@heady/headylens`, `@heady/secrets` (HeadyVault), `@heady/narrative`,
  `@heady/kernel`. Everything else is legacy `src/` CJS pending rewrite.
- **Recommended path: build the cognitive layer as drop-in modules** — see `docs/MODULE_ARCHITECTURE.md`.

## Aggregated drift / inconsistency findings (from all 9 sections)

| # | Finding | Sections | Severity | Suggested resolution |
|---|---------|----------|----------|----------------------|
| AD-1 | **Two ADR directories** `docs/adr` (30+superseded) vs `docs/ADR` (5) with **hard 0019–0023 number collisions** (different decisions) + file-less 0001–0018 in the uppercase INDEX | 05,06,08 | 🔴 | Pick one canonical dir; renumber/merge the other; one ADR per number |
| AD-2 | **HCFP stage count drift is worse than thought:** the *actually-wired* runner `src/hcfp/pipeline-runner.js` is **5 steps**; also 9 (legacy class), 10 (yaml), canonical **21**, stale **22** | 01 | 🔴 | Bless a buildable subset OR build the full 21-stage CF-Workflow DAG; reconcile to facts=21 |
| AD-3 | **`governance/` is outside the coherence scan scope** → "60+ patents" drift sits *unguarded* inside CONSTITUTION.md / MASTER_DIRECTIVES.md | 05 | 🔴 | Add `governance/` to coherence CANON; convert patent strings to `heady:inject` regions |
| AD-4 | **facts.yaml region stale:** `us-central1` vs ADR-0022 + live service `us-east1` | 06 | 🟠 | Fix facts.yaml → us-east1 (or confirm canonical region) |
| AD-5 | ~~**domain registry diverges across ≥3 sources**~~ → **MEMBERSHIP RESOLVED 2026-08-22.** 5 live carriers found (not 3: + `configs/domain-architecture.json`, + the edge router `SITES` map, + a hardcoded roster inside domain-guard). `facts.yaml domains:` = 16 nodes, closed over every carrier; each node's `sources:` names its carriers and is machine-checked one-directionally by coherence guards D1–D6. Arena spec + domain-guard allowlist now derive from `configs/_generated/domain-roster.json`. **STILL OPEN (founder):** field-level — `entity`/`tenant`/`revenue`/`layer` exist for 10 of 16 in `src/config/domain-registry.js`; 6 await brand ratification | 06,08 | 🟡 | Ratify brand architecture for the 6 unratified domains |
| AD-6 | **Bee count drift:** lexicon 35 vs compendium 33 vs skill "30+" vs ~73 legacy files vs blueprint 197 | 02,03 | 🟠 | Canonicalize 35 in facts.yaml; scalar-guard it |
| AD-7 | **`heady-auto-flow` mislabels HCFP** ("Heady Core Functionality Platform"); also the "Battle→Coder→Analyze" chain lives in `cloud-orchestrator.js`, not auto-success | 01,04 | 🟠 | Fix the skill; auto-flow ≠ AutoSuccessEngine |
| AD-8 | **Master-plan/skill counts = 134, missing `heady-autopilot`** (true = 135); INDEX stale (auto-flow "stub", durable-execution "Temporal-flavored") | 04 | 🟡 | Regenerate skill INDEX to 135 |
| AD-9 | **BaseBee timeout:** legacy code `φ⁴×1000≈6854ms` vs compendium `1618ms`; rebuild has neither | 02 | 🟡 | Pick canonical; encode in phi-math |
| AD-10 | **Copy-paste bugs in legacy:** `socratic-service.js` class named `HeadyBattleService`; `swarm-consensus.js` is a file-lock manager, not vote-fusion | 01,02 | 🟡 | Fix on rewrite; don't carry the mislabels |
| AD-11 | **Manifest path bugs:** MCP servers listed without the real `heady-` prefix → would be misread as "missing" | 09 | 🟠 | Fix manifest paths before extraction |
| AD-12 | **Security on port (do NOT carry):** HeadyManager timing-attack token compare + CORS wildcard; `security-middleware` localhost CORS + `skipOnError=true`; R-1/R-3 live-key + AI-Gateway-bypass | 01,06,09 | 🔴 | Fix during rewrite; reroute all model egress through CF AI Gateway |
| AD-13 | **Patent-locked, do NOT implement:** HeadyKey/HCP-0001 rotation executor (HS-2026-051…062); CSL `BZ-05`/HS-058 → ARBITER ALLOW + signed HCP first | 01,09 | 🔴 | Keep founder/ARBITER-gated |
| AD-14 | **NATS locked-vs-best-effort tension:** facts.yaml "locked" vs ADR-0020/R8 best-effort; `@heady/events` has no nats dep (outbox/pgmq is the real path) | 06,07 | 🟡 | Clarify facts.yaml: pgmq authoritative, NATS best-effort |
| AD-15 | **Gateway long-lived SA key** → migrate to WIF; CF Global API Key → scoped token | 06,08 | 🟠 | Least-privilege follow-up |

## Decisions needed (founder)

1. **Canonical ADR directory** (AD-1) — `docs/adr` lowercase or `docs/ADR` uppercase? I'll merge + renumber the other.
2. **HCFP buildable target** (AD-2) — bless the 5-step running spine as the Phase-3 implementation, or build the full 21-stage CF-Workflow DAG now?
3. **Build the cognitive layer as drop-in modules?** (`docs/MODULE_ARCHITECTURE.md`) — create the 4 phantom packages as HMOD modules + the loader, y/n.
4. **Region** (AD-4) — confirm `us-east1` canonical → I fix facts.yaml.
5. **Bee count** (AD-6) — confirm 35 canonical → scalar-guard it.

## Known drift already corrected this session (audit trail)

| Item | Was | Truth | Source |
|------|-----|-------|--------|
| HCFullPipeline stages | 8 → 22 (my overshoot) | **21 (0–20, fib(8))** | super-prompt §6 + ADR + facts.yaml |
| Patent count | 60 | **51** (HS-2026-001..051) | facts.yaml (founder) |
| Embed model in skills | bge-base / nomic | **@cf/baai/bge-small-en-v1.5** | ADR-0015 |
| pgvector dim (battle configs) | 1536 | **384** | ADR-0015 |
| @headyme scope escape | @headyme/sacred-geometry-sdk | **@heady/** | locked scope |

## Known drift already corrected (audit trail)

| Item | Was | Truth | Source |
|------|-----|-------|--------|
| HCFullPipeline stages | 8 | **21 (0–20, fib(8))** | compendium 03 / legacy yaml |
| Patent count | 60 | **51** (HS-2026-001..051) | facts.yaml (founder) |
| Embed model in skills | bge-base / nomic | **@cf/baai/bge-small-en-v1.5** | ADR-0015 |
| pgvector dim (battle configs) | 1536 | **384** | ADR-0015 |
