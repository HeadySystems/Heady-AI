# Heady-AI Handoff Memory & Context Sync

> **Date:** June 15, 2026
> **Project:** Heady Latent OS Modular Monolith Rebuild
> **Target Directory:** `/home/headyme/Heady-AI/`

## 1. Project Context
We are rebuilding the Heady ecosystem from 75 fragmented legacy repositories and 50+ services into a single **Turborepo** + **pnpm** modular monolith. The architecture relies on the Heady Liquid Latent OS patterns: Cloud Run for the core modular monolith, Cloudflare edge tier, Continuous Semantic Logic (CSL) gating, and φ-scaled (Golden Ratio) constants.

## 2. Work Completed (Current State)
1. **Monorepo Scaffolded:** Created the standard structure in `/home/headyme/Heady-AI` (`apps/`, `packages/`, `configs/`, `tooling/`, `docs/`).
2. **Turbo & pnpm Configured:** Pinned `packageManager` to `pnpm@9.15.9`. `pnpm build` (via Turbo) runs successfully.
3. **Agent Migration:** Migrated the entire `.agents/` folder (skills, workflows, context) to the new repository and updated all hardcoded paths from `/Heady/` to `/Heady-AI/`.
4. **Task Extraction:** Generated `configs/hcfullpipeline-tasks.json` and `docs/extracted-report-tasks.md` from the legacy runbooks.
5. **Master Plan Authored:** Drafted a full concurrent rebuild plan in `artifacts/implementation_plan.md`.
6. **Resource Issues Resolved:**
   - **IDE CPU/Memory Spike:** Removed `"path": "../../.."` from `Heady.code-workspace` which was causing internal IDE `ripgrep` processes to index the entire root filesystem (`/`) and max out CPU/RAM (1400% CPU, 11GB+ RAM).
   - **Turborepo Overload:** Removed the `--parallel` flag from the `dev` script in `package.json` and set `"daemon": false` in `turbo.json` to prevent local memory/CPU starvation.

7. **Gate-Then-Embed Corpus Workflow:** Built `tooling/embed-corpus` (`heady-embed`) — the single
   workflow that systematically embeds the repo corpus only after a fail-closed precondition:
   `phase 0 spec-sync → phase 1 consistency-gate → phase 2 scan → phase 3 merkle-trigger (ADR-0023)
   → phase 4 embed (ADR-0024) → phase 5 commit`. Embedding NEVER runs unless the gate passes.
   - Pure planning/merkle core: `packages/embedding/src/corpus.mjs` (+ `test/corpus.test.mjs`, 8/8).
   - Locked embedder (`@cf/baai/bge-small-en-v1.5`, 384, ADR-0015) resolved from `CLOUDFLARE_ACCOUNT_ID`
     + Workers AI token; **no binding ⇒ emits the merkle index + idempotent outbox, 0 vectors
     fabricated** (HCEmbedPipeline drains it where bound).
   - Durable artifacts (atomic) under `.data/vector-memory/`: `merkle-index.json`, `embedding-jobs.json`,
     `ledger.json`, `vectors.json`, `embed-corpus-report.json`.
   - Brought 3 spec-drifted files to current spec (dropped the Qdrant store refs in favor of
     pgvector + Vectorize, applied the model lock) in
     `.agents/skills/heady-merkle-index` + `heady-health-watch-swarm`; extended the consistency gate
     scope to `tooling/`; hardened `data-consistency/cli.mjs` entry guard (exact realpath) so importing
     `check()` no longer triggers its CLI. Gate is strict-clean (74 canonical + 199 extended, 0/0).
   - Run: `node tooling/embed-corpus/src/embed.mjs [--dry-run|--strict|--json|--no-sync|--allow-hf]`.
   - **Correctness:** the LEDGER (not the Merkle diff) is the authority for "embedded" — a file is
     planned if `vectorKey ∉ ledger`, so cold-start, incremental change, and catch-up (Merkle advanced
     but never embedded) are all covered; idempotent only *after* a successful embed. 37 tests pass.
   - **Sanctioned binding:** the locked path is `cloudflareEmbedder` (Workers AI REST, `@cf/...`),
     auto-selected from `CLOUDFLARE_ACCOUNT_ID` + a Workers AI token (see `.env.example`, secret-
     injected). HF is a non-locked fallback, **fail-safe gated** behind `--allow-hf` because it would
     transmit patent IP to a third party. **Current state: 268 jobs enqueued, 0 vectors written** —
     blocked solely on the Cloudflare token (user-supplied). Inject it and re-run to embed.

8. **Realtime Change Awareness:** Built `tooling/awareness` (`@heady/awareness`, `heady-awareness`)
   — the realtime layer that makes Heady (and any external AI) aware of codebase changes and keeps
   context current. Deliberately git-event-driven (post-commit/merge/checkout/rewrite hooks) + an
   optional φ⁷≈29s HEAD-poll, NOT a filesystem watcher (the fs-wide watcher caused the 1400%CPU/11GB
   blowup, §6). On each reaction it spawns `heady-embed --json` (the ONE embed code path — ledger stays
   authority, gate stays fail-closed), rebuilds `.data/awareness/context.json` (the canonical
   current-state snapshot any AI reads), and emits a durable redacted event to
   `.data/awareness/lens.ndjson` (HeadyLens query + SSE). The snapshot is honest: `embedderBound:false`
   / `currency.blockedReason` while the outbox is enqueue-only (still blocked on the Cloudflare token).
   - "Squash merges" shipped NON-destructively: `heady-awareness propose-squash` clusters `base..HEAD`
     by CSL-cosine over a semantic+structural feature bag (τ=CSL_THRESHOLDS.LOW 0.691), synthesizes a
     conventional-commit message per cluster, and emits the exact git commands but NEVER runs them
     (`autoApply:false, destructive:true, requiresHumanConfirmation:true`).
   - Latent Service `{ start, stop, health, metrics }`. 7/7 unit tests pass; whole-repo consistency
     gate clean (241 canonical + 198 extended).
   - **To make it realtime:** run `heady-awareness install-hooks` once (NOT auto-installed — executable
     git hooks are persistence), or `heady-awareness serve --poll`.

## 3. Immediate Next Steps (Phase 1)
We are currently entering **Phase 1: Security Containment & Math Foundation**.
Claude should focus on the following extracted tasks:
- **SEC-001:** Rotate Cloudflare/MCP credentials and remove committed auth material.
- **SEC-002:** Patch `src/heady-conductor.js` privileged mutation routes to fail closed.
- **INFRA-001:** Fix `ci.yml` canary rollback by capturing the stable Cloud Run revision.
- **Packages:** Scaffold the fundamental `phi-math` and `csl-engine` base packages.

## 4. Strict Heady Rules (Read `AGENTS.md`)
1. **No Magic Numbers:** All retry intervals, pool sizes, and limits must be derived from `phi-constants.js` (φ-scaling).
2. **ESM Only:** No CommonJS `require()`.
3. **Zero `localhost`:** All URLs must come from environment variables. Cloud-deployed only.
4. **Zero Placeholder Code:** No `TODO`, `FIXME`, or `HACK`. If it's not done, don't commit it.
5. **No Vue/Angular:** Vanilla HTML/CSS/JS or React (when strictly beneficial).
6. **Zod Validation:** All API inputs must be validated at service boundaries.

*When starting up, always ensure you are operating exclusively inside `/home/headyme/Heady-AI/`.*
