# Exhaustive Analysis: Beneficial Skills, Workflows, and Actions for the Heady Rebuild

> **Status (2026-06-15): these are now real, invokable Claude Code slash commands.**
> Previously the 26 entries below lived only as markdown in `.agents/workflows/` and were
> *not* discoverable by the CLI. They are now wired into `.claude/commands/` as symlinks back
> into `.agents/workflows/` — so `.agents/` remains the single source of truth while every
> `/command` below resolves. See **§0 How they're wired** for the activation layer.

This document evaluates and categorizes **all** Heady `/` commands and workflows that provide
strategic benefit for migrating, rebuilding, and operating the new `Heady-AI` monorepo.

## 0. How They're Wired (Activation Layer)

Claude Code only discovers commands, subagents, hooks, and settings under `.claude/`. The
Heady corpus lives under `.agents/`. The two are bridged so nothing is duplicated:

| Layer | Location | Mechanism |
|-------|----------|-----------|
| **Slash commands** (26) | `.claude/commands/*.md` | Symlinks → `.agents/workflows/*.md` |
| **Subagents** (3) | `.claude/agents/*.md` | Symlinks → `.agents/agents/*.md` (`arbiter`, `security-bee`, `eval-gate`) |
| **Rule-gate hook** | `.claude/hooks/heady-rules.mjs` | Registered in `.claude/settings.json` as a `PreToolUse` gate; blocks `console.log`, `require()`, `TODO/FIXME/HACK`, `localhost`, and missing `HEADY_BRAND` headers on Edit/Write of in-scope code |
| **Permissions** | `.claude/settings.json` | Durable allowlist (`pnpm`, `node --test`, `eslint`, `turbo`, read-only `git`, `rg`/`grep`) |

> **Executable vs. conceptual:** commands marked _(conceptual)_ below encode Heady's RAM-first /
> 3D-vector *framing* and feed it in as a prompt, but won't run real operations until the
> underlying Heady services exist. Commands marked _(executable)_ already run concrete steps
> (curl/pnpm/node) today.

## 1. Core System Operations (The Latent OS Layer)
These workflows establish and enforce the fundamental operations of Heady's 3D Vector environment. _(mostly conceptual — activate fully once the vector-memory backend is live.)_
- **/antigravity-runtime** _(conceptual)_: **CRITICAL.** Enforces that the `Heady-AI` workspace operates exclusively within a 3D vector workspace and validates the Sacred Geometry SDK and configuration integrity.
- **/vector-space-ops**: Defines the methodology for operating strictly through Heady's vector space, event systems, and bees instead of traditional file manipulation.
- **/ram-ops**: **CRITICAL.** Mandates RAM-first operations. All development work occurs in vector space; external files in `/apps` and `/packages` are merely outward projections.
- **/continuous-embedding**: Continuously syncs system state, code logic, and user interactions directly into the 3D vector memory layer in real time.
- **/memory-compaction**: Automates the pruning, deduplication, and optimization of the vector memory to prevent bloat during the migration of 75+ repos.
- **/code-projection**: Replaces manual coding by projecting instructions and specs directly from vector memory into the target Turborepo structure.
- **/projection-hygiene**: Cleans up sparse, one-off, or orphaned files that fall out of sync with vector memory targets, a key defense against the "Projection Drift" issue identified in the audit.
- **/heady-drift-monitor**: Runs continuously to detect semantic or operational drift in outputs, auto-reconfiguring parameters when determinism degrades.

## 2. Rebuilding & Scaffolding (The Migration Layer)
These workflows are used directly to convert the legacy infrastructure into the unified structure.
- **/deep-scan-init**: **CRITICAL.** Forced at the start of every task to map the full context of the codebase and run Perplexity deep-research before implementing any fixes.
- **/auto-extract-tasks**: Automates the parsing of legacy docs (e.g., `Gem_Heady_Rebuild.md`, `heady_current_state_handoff.md`) into executable JSON tasks.
- **/heady-service-bootstrap**: Generates new Turborepo modules (`api-gateway`, `csl-engine`, `heady-vault`) from a cold start using regenerative meta-prompts.
- **/concept-alignment**: Validates that our generated codebase matches the abstract `concepts-index.yaml` ontology.
- **/pipeline-dry-run**: Allows us to safely simulate our Turborepo and CI pipeline changes before committing them.
- **/foundational-pillars**: Validates every structural change against Heady's rules (Liquid Architecture, Swarm Intelligence, Sacred Geometry).

## 3. Validation, CI/CD, & Health (The Quality Layer)
These workflows ensure the built monorepo functions smoothly in production. _(executable — these run concrete curl/pnpm/node steps today.)_
- **/deployment-verification** _(executable)_: Conducts automated smoke tests against all API endpoints (`heady-manager`, `api-gateway`) immediately after a deploy.
- **/health-check**: A multi-domain validation that guarantees all 9 Heady™ sites, Cloud Run instances, and internal services are up.
- **/domain-branding-audit**: Specifically validates the UI implementations (e.g., in `headyme-portal`) for strict adherence to Sacred Geometry and Heady brand theming.
- **/edge-cache-warm**: Used post-deployment to pre-warm the Cloudflare edge cache layer.
- **/bee-swarm-diagnostic**: Blasts all operating HeadyBees to report health and swarm convergence across all active domains.
- **/agent-performance-review**: Measures and optimizes the effectiveness of agents (e.g., `sync-projection-bee`, `security-bee`).

## 4. Ops, Governance, & Incident Control
Workflows designed for enterprise-grade uptime and orchestration.
- **/incident-response**: Triggers the playbook for triage, diagnosis, and postmortem for any system failure.
- **/heady-sync**: Maintains git state and cross-device synchronization between local development and remote cloud state.
- **/heady-prompt-pipeline**: Manages the deterministic execution of the HMAX Super Prompt through the MCP prompt executor utilizing CSL confidence gating.
- **/provider-failover-drill**: Tests AI provider failover (e.g., switching from Gemini to Claude or Groq) under simulated outages.
- **/heady-command**: Routes specific `heady {command}` CLI inputs dynamically to the relevant internal Heady service.
- **/heady-battle-sim**: Runs the 9-stage battle-sim to pit different AI logic implementations against each other to discover the most optimal code solution.

## 5. Custom Subagents (Heady Roles)
Reusable, role-scoped agents under `.claude/agents/` (canonical in `.agents/agents/`). Invoke via the Agent tool / Task.
- **arbiter**: Patent-lock reviewer. Gate BEFORE modifying any `⚠️ PATENT LOCK` file or HS-2026-051..062 zone. Returns ALLOW/BLOCK with claims at risk. Always BLOCKs the stage0 bootstrap.
- **security-bee**: Phase-1 containment auditor (SEC-001 credential rotation, SEC-002 fail-closed routes) + auth/secrets/boundary review. Returns ranked findings with `file:line`.
- **eval-gate**: The fidelity/CI gate ("the OS of the OS") — verifies build, tests, lint, type-check, and the AGENTS.md hard rules. Returns PASS/FAIL per dimension before merge.

## 6. Standard System Commands & Skills
Built-in Claude Code skills/commands that aid Heady autonomy (availability varies by harness version).
- **/schedule**: Recurring cloud agents — e.g. `/memory-compaction` overnight or `/health-check` on a cron.
- **/loop**: Run a command on an interval or self-paced (e.g. poll a deploy).
- **/code-review**, **/security-review**, **/verify**: Diff review, security pass, and behavioral verification of changes.

## Summary Conclusion
The Heady-AI workspace now exposes **all 26 workflows as real `/` commands**, **3 custom subagents**
(`arbiter`, `security-bee`, `eval-gate`), and a **mechanical rule-gate hook** that enforces the
AGENTS.md hard rules on every write — all bridged from the canonical `.agents/` corpus into the
`.claude/` activation layer without duplication. The executable commands (§3, plus
`/deployment-verification`, `/health-check`, `/incident-response`) run today; the conceptual
commands (§1) come fully online as the vector-memory backend is implemented.
