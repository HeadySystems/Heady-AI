# 08 — Skills Catalog (IDE skills, 136 packs, Foundry, Distiller)

> Three skill layers: the **10 Antigravity IDE skills** (when/how the agent invokes MCP tools), the
> **136 `SKILL.md` packs** (the deep capability library), and the machinery that makes/optimizes skills
> (**Skill Foundry**, **heady-distiller**). **What · Why · How · When · Where · Disposition.**

A "skill" is canonically a **row in the `skills` table pointing at a handler module** (Voyager pattern),
selected by CSL relevance — not a microservice. The agent loads the nearest relevant skill the way it
loads context.

---

## S1. The 10 Antigravity IDE skills (the invocation layer)

**What.** Ten skills wired into the IDE that teach autonomous agents exactly *when and how* to call MCP
tools. **Why.** They are the agent's "muscle memory" — the bridge from intent to the right tool. **When.**
Continuously, inside the coder loop. **Where.** `.agents/workflows/` + the MCP registry. **Disposition:**
baseline (Phase 3 — they front the coder module and MCP gateway).

| Skill | Scope | Tooling |
|---|---|---|
| `heady-research` | web research + real-time ingestion | Perplexity Sonar Pro + scrapers |
| `heady-code-generation` | multi-model synth/refactor/repair | Coder/Codex/Copilot routing |
| `heady-memory-ops` | semantic search, spatial index, consolidation | pgvector, Redis, octree |
| `heady-battle-arena` | multi-model competition + selection | tournament selectors |
| `heady-deployment` | build, stage, edge-route | Cloud Run, CF Worker KV, mTLS |
| `heady-deep-scan` | dependency map, syntax/structure validation | workspace scanners → dep graph |
| `heady-auto-flow` | continuous improvement / self-heal cycles | HCFullPipeline executor |
| `heady-multi-model` | dynamic provider failover | HeadyIO credentials racing |
| `heady-edge-ai` | sub-100ms edge inference | Cloudflare Workers AI |
| `heady-security-audit` | vuln scan, leak detection, risk | secret-scan CI + threat agents |

## S2. The 136 SKILL.md packs (the capability library)

**What.** 136 packs under `.agents/skills/`, each a self-contained capability spec. **Why.** The breadth
of what Heady can do, as composable, distillable units. **Disposition:** **vocabulary/spec library** —
each becomes a `skills` row + handler as its bounded context ships; not 136 services. Grouped:

- **Orchestration & agents:** agent-factory, agent-orchestration, a2a-protocol, swarm-template-ops,
  bee-swarm-ops, task-decomposition, replan, prompt-orchestration, liquid-crew, liquid-graph,
  liquid-conversation, dual-pass, sop-pipeline, evolution-swarm, swarm-evolution.
- **Memory & retrieval:** memory-ops, memory-knowledge-os, memory-ledger-design, graph-rag-memory,
  hybrid-vector-search, embedding-router, vector-projection, merkle-index, companion-memory,
  context-window-manager, vsa-hyperdimensional-computing, semantic-cache, resource-crystallizer.
- **Model & gateway:** multi-model, gateway-routing, liquid-gateway, edge-ai, code-generation,
  cognitive-runtime, csl-engine, phi-math-foundation, narrative-engine, semantic-backpressure.
- **Governance & security:** security-audit, pqc-security, middleware-armor, mcp-gateway,
  mcp-gateway-zero-trust, semantic-firewall, incident-ops, ide-governed-codeflow, linter-gate, hooks,
  buddy-permission-ops, sovereign-identity-byok, auth-provider-federation, firebase-auth-orchestrator,
  trust-receipts, ai-checks, dependency-guard, coding-standards, trading-compliance.
- **Reliability & ops:** reliability-orchestrator, self-healing-lifecycle, drift-detection,
  continuous-action, resilience-cache, durable-execution, durable-agent-state, health-watch-swarm,
  connector-health, cost-guardian, cloud-orchestrator, colab-runtime, deployment, digital-presence,
  installable-package-release-ops, git-ops, repo-map, deep-scan, intelligence-analytics.
- **Connectors & integration:** connector-forge, connector-vault, event-bus, liquid-channel,
  liquid-stream, mcp-streaming-interface, cross-device-handoff, cross-device-sync-fabric,
  crdt-collaboration, buddy-device, voice-relay, drupal-content-sync, drupal-headless-ops,
  domain-architecture-ops, microfrontend-portal, web-container, sandbox-execution.
- **Creative & UI:** midi-creative, design-bridge, visual-builder, sacred-geometry-css-generator,
  projection-composer, manager-surface-design, liquid-module-design, liquid-persona, intent-tracker.
- **Research & knowledge:** research, knowledge-ingestion-briefing, distiller, feature-forge,
  skill-foundry, maximum-potential, knowledge-cartographer, hypothesis-lab, forensic-analyst,
  delegation-architect, living-dashboard.
- **Perplexity suite (15):** perplexity (+ computer-use, deep-research, code-review, content-generation,
  competitor-intel, patent-search, rag-optimizer, eval-orchestrator, multi-agent-eval, feedback-loop,
  domain-benchmarker).
- **Business verticals:** fintech-trading, trading-intelligence, monetization-platform, nonprofit-ops,
  digital-presence, edge-ai.

## S3. Skill Foundry (the maker)

**What.** Design/build/package installable skill packs for Buddy / IDE / Web surfaces. **Why.** New
capability must be created the same governed way every time (manifest, wiring, eval). **How.**
`heady-skill-foundry` + `heady-connector-forge` (ConnectorForgeSwarm) generate skill manifests, wire
handlers, register in the headybee-template-registry, and emit an eval slice. **When.** Whenever a new
capability is needed (and the Socratic loop's Q6 "OSS to extract instead?" is answered). **Where.**
`heady-skill-foundry`, architecture spec `06-skill-foundry.md`. **Disposition:** baseline; new skills
require an ADR if they add a top-level package (anti-sprawl, `06-G11`).

## S4. heady-distiller (the optimizer)

**What.** The recipe engine that reverse-engineers successful execution traces into reusable, optimized
artifacts (Law 9; pipeline stage 21). **Why.** Successes become deterministic fast-paths, not one-offs.
**How — four-tier distillation:** Tier-1 optimized prompt · Tier-2 pipeline config · Tier-3 fast-path DAG
(matched ≥ψ in AutoContext Pass 2.5 → skip to EXECUTE) · Tier-4 model knowledge distillation (DPO
alignment on Colab, fine-tune local models from large-model traces). Trace capture via event sourcing;
DSPy MIPROv2/GEPA optimization. **When.** Every successful pipeline completion. **Where.** `heady-distiller`
node, distiller registry, `wisdom.json`. **Disposition:** baseline (the inverse of the optimization loop,
`06-G10`; recipe retrieval feeds AutoContext, `04-M2`).

**Disposition rollup:** skills are a **data-driven capability library** (rows + handlers + evals),
created by the Foundry and continuously optimized by the Distiller, selected by CSL relevance — the
canonical realization of "116+ skills as data rows" from the liquid-latent-OS synthesis.
