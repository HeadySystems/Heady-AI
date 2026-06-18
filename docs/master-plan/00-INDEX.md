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

| # | Domain | File | Status |
|---|--------|------|--------|
| 01 | Cognitive & orchestration engines (HCFP, auto-success, Conductor, Manager, Maid, Orchestrator, Scientist, Battle, Coder, Arena, Perspective, Socratic, MC, Sim, + discovered: Soul, Vinci, Brains…) | `01-engines.md` | pending |
| 02 | HeadyBees (35) + HeadySwarms + swarm coordination | `02-bees-swarms.md` | pending |
| 03 | Agents (8) + agent harness + perspective roles | `03-agents.md` | pending |
| 04 | Skills (135) + workflows (27) + directives/commands | `04-skills-workflows.md` | pending |
| 05 | Unbreakable laws + directives + governance | `05-laws-directives.md` | pending |
| 06 | Service providers + specific services + functionality (current + potential) | `06-providers-services.md` | pending |
| 07 | OSS implementations (current + planned) | `07-oss.md` | pending |
| 08 | UIs + projections (portal, admin, dashboards, 9 domains, edge) | `08-uis-projections.md` | pending |
| 09 | Legacy transfer disposition (14 groups / 150 components) | `09-legacy-transfer.md` | pending |

## Known drift already corrected (audit trail)

| Item | Was | Truth | Source |
|------|-----|-------|--------|
| HCFullPipeline stages | 8 | **21 (0–20, fib(8))** | compendium 03 / legacy yaml |
| Patent count | 60 | **51** (HS-2026-001..051) | facts.yaml (founder) |
| Embed model in skills | bge-base / nomic | **@cf/baai/bge-small-en-v1.5** | ADR-0015 |
| pgvector dim (battle configs) | 1536 | **384** | ADR-0015 |
