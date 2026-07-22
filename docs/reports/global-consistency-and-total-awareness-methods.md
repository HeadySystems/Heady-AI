# Global Data Consistency & Total Self-Awareness — Best Methods for the Rebuild

- **Status:** Research report — for founder review
- **Date:** 2026-07-22
- **Author:** Claude Code (grounded in live inspection of `/home/headyme/Heady-AI` on branch `feat/service-registry`, three parallel code inventories, live MCP/CI probes)
- **Companion to:** `docs/reports/stale-orphan-archive-remediation-during-rebuild.md` (same "sophisticated architecture, operational gaps — activate what you built" thesis)
- **Question answered:** how to keep the rebuild's data, systems, and services globally consistent and continuously updated, so Heady is fully aware of *all* things in the system — down to *every reference to data globally*.

---

## 1. The answer in one paragraph

Heady already has a genuinely sophisticated, largely-**designed** global-consistency and self-awareness architecture — arguably ahead of most production systems in ambition. The problem is **not missing design; it is three operational gaps**: (A) **authority is not singular** (the source of truth is duplicated and drifted, and the thing running in production is not the governed tree at all); (B) **enforcement is not continuous** (the live consistency gate runs only in CI, never fires on the active branch, and there is no commit-time or runtime-mesh-wide gate); and (C) **the real-time awareness loop is switched off** (no live embeddings, no hosted lens, stale snapshots). And directly on the literal ask — (D) **there is no materialized graph of "every reference to data globally," and no verifier of data connectivity.** Heady can prove its *locked scalar values* are consistent everywhere; it cannot yet *enumerate or verify every data reference and connection*. That is precisely the gap between "consistent facts" and "fully aware of all references." The best method is to **make authority singular, make enforcement continuous across every write boundary (commit → CI → runtime → deploy), turn the awareness loop on, and build the reference/connectivity graph** — reusing the strong machinery that already exists rather than inventing new.

---

## 2. The literal ask first — "every reference to data globally"

**Today, global reference-awareness is grep-based and scalar-only. There is no materialized reference graph and no connectivity verifier.** Three cooperating mechanisms exist, all real, none complete for the goal:

| Mechanism | Path | What it covers | The gap |
|---|---|---|---|
| **System Map** (structural graph) | `tooling/coherence/src/coherence.mjs` `buildMap()` → `.data/coherence/system-map.json` | Nodes = facts, packages, ADRs, skills, tools; edges = `pkg→pkg` (package.json deps), `group→group` (decomposition manifest) | Structural only. Does not include DB columns, cache keys, event topics, or *data* references — only code/artifact topology. |
| **LinkIndex** (value registry) | `packages/consistency-bus/src/link-index.mjs` over `.data/coherence/variable-registry.json` | Every registered key → canonical value, class, source-of-truth, lock status (`fact`/`constant`/`secret` = LOCKED) | Covers **locked scalar values** (embedding dim, patent count, versions, domains). Not arbitrary data references. |
| **Ripple / blast-radius** | `coherence.mjs ripple()`, `consistency-bus/src/propagate.mjs` `blastRadius()` | "Every reference to value X" = **grep the canonical roots** (`docs packages tooling configs facts.yaml lexicon.yaml AGENTS.md …`) for the key-tail and value | It is a text grep, not a queryable edge set. Finds string references in tracked text/config; blind to runtime data-flow. |

**And the connectivity axis is entirely unbuilt.** `docs/adr/0025-...non-orphanage-governance.md` §4 mandates verbatim: *"Every database column (Neon), cache namespace (Redis), and event topic (NATS) must be mapped to an active publisher and consumer."* **No mechanism verifies this.** Event topics are ad-hoc strings (`'memory:written'`, `heady.observation.task.done`) with no registry mapping topic → publisher + consumer; the `tenant:{id}:*` Redis namespace convention from the AGENTS.md rules **does not exist in the code** (only legacy domain→tenant slugs). So the system cannot answer "is every column read by someone? is every topic consumed? is any reference dangling?" — the core of *"aware of every reference to data globally."*

**This is the single most important thing to build (see §6, Method 5).**

---

## 3. What is genuinely good — the foundation to build on

This is not a broken system; the write-side content-consistency half is real, principled, and blocking in CI. The recommendations reuse all of it.

- **Sound first principles, encoded.** `docs/LIQUID_LATENT_OS_COHERENCE.md`: *"self-aware means concrete, derived, queryable — not magic; Propagation = SoT + generation + gate + blast-radius."* Two invariants enforced by the kernel: **DERIVE, never author** and **the gate fails on CONTRADICTION, not INCOMPLETENESS** (declared-but-unbuilt never blocks; two-sources-disagree blocks, exit 2). `docs/adr/0000` fixes **Postgres as the sole system of record, latent/vector space as a *derived, reconstructible* projection** — the right data-authority model.
- **The coherence kernel is live and blocking in CI** (`ci.yml` `scan` job, "the OS of the OS"): derives the System Map, regenerates the variable registry, runs contradiction checks (`S1–S8`, `C-patents`, `C-hcfp-stages`, `C-dropped-store`), and **federates `tooling/data-consistency`** as a sub-gate — which enforces `EMBED-DIM-384`, `PGVECTOR-SOLE-AUTHORITY`, `QDRANT-DROPPED`, `EMBED-MODEL-LOCK`, `STALE-MECHANISM`. Its current report: `errors: 0, info: 6` over 681 files (the earlier patent-count 60→51 and `@heady/csl` naming drifts are resolved).
- **The derive layer closes the write side** (`tooling/heady-derive`, `derive-gate.yml`): every `<!--heady:inject KEY-->` region is overwritten from `facts.yaml`/`lexicon.yaml`; "the lock that makes the '60-vs-51 patents' / '8-vs-21 stages' class of drift impossible."
- **The runtime consistency middleware exists** (`packages/consistency-bus`, mounted in `apps/heady-manager/src/app.mjs`): `ingressGuard` returns **409 on locked-value drift**, `egressNormalize` rewrites stale→canonical on the way out, `propagate` computes blast radius and routes edits through `@heady/codeflow` govern/approve/apply. This is real runtime referential-integrity enforcement.
- **The substrate is correctly shaped.** `packages/db/migrations/0001_init.sql`: `vector_memory.embedding vector(384) NOT NULL` + HNSW cosine index; a **transactional outbox** (`task_outbox`, ADR-0002); WAL-CDC projection (ADR-0014). The embedding lock (`@cf/baai/bge-small-en-v1.5`, 384, mean) is asserted in **three** code sites (`packages/embedding/core.mjs` `LOCKED_MODEL`, `packages/db` `assertEmbedding` "rejects the 1536 drift", `packages/csl-engine` `DIM`) **and** CI. Tiers are authority-correct: **pgvector = authority**, Vectorize = derived edge cache (write-through-warm + outbox), CF-KV = ≤60s best-effort cache.

**Keep every one of these. The methods below activate and complete them; they do not replace them.**

---

## 4. Diagnosis — why Heady is not globally consistent or fully aware *today*

### A. Authority is not singular (root cause)

1. **Two `facts.yaml`, already drifted.** `/home/headyme/Heady-AI/facts.yaml` is the canonical **217-line** golden record; `/home/headyme/Heady/facts.yaml` (the legacy tree that is actually *running*) is a stale **116-line** fork — nearly the entire file differs. The authoritative SoT is not the one in production.
2. **A stale competing manifest that contradicts the SoT.** `heady-registry.json` declares `embeddingPipeline.model: "all-MiniLM-L6-v2"` — a model that is **on the ban-list** of `tooling/data-consistency/invariants.json` (`EMBED-MODEL-LOCK`), directly contradicting `facts.yaml`'s locked `bge-small-en-v1.5`. It is read only by legacy `src/` runtime code, and is not on any consistency propagation path.
3. **The decision record itself has two authorities.** `docs/adr/` (0000–0030) and `docs/ADR/` (0019–0025) both exist with a **numbering collision** (0019/0020/0021/0025 appear in both with different titles) — a consistency defect the invariants file explicitly forbids (`structural.adrUniqueNumbers: true`).
4. **SoT tree ≠ runtime tree (the boundary condition).** Everything in `ecosystem.config.cjs` runs from legacy `/home/headyme/Heady` + `/home/headyme/sites/*` (98 site dirs, ~45 wired, sampled `dist/` missing; only `heady-manager` is up, with **102 restarts**). The rebuild deploys to Cloud Run (`deploy/cloudrun-worker-service.yaml`). **SoT consistency governs nothing in production until the runtime *is* the rebuild** — see §7.

### B. Enforcement is not continuous (operational failure)

1. **No commit-time gate.** `git config core.hooksPath = tooling/hooks`, and `tooling/hooks/` contains **only Git-LFS hooks** — so the native `.git/hooks/pre-commit`/`pre-push` secret-scan is **overridden and never runs**. There is no husky/lint-staged. **No coherence/derive/consistency check runs on any human `git commit` or `git push`.** Drift is freely committable.
2. **The live gate does not fire on active work.** The coherence/derive gates are wired in `ci.yml`/`derive-gate.yml` (push/PR/dispatch), but: pushes are **account-suppressed** (the workflow header states owner pushes create zero runs → `workflow_dispatch` is the only lever); the active `feat/service-registry` branch receives **zero** CI runs; and **every observed `ci.yml`/`derive-gate.yml` run is Dependabot-triggered and completes in 3–8 seconds** — too fast for the coherence scan over 681 files to have executed, i.e. failing at setup before the gate logic runs. Net: no consistency gate has demonstrably executed-to-completion on a real code change in the observable window. (Structurally, a PR into the canonical `rebuild` trunk *would* invoke the gate — the mechanism exists; it is the *operation* that is absent today.)
3. **The structural half of ADR-0025 is dormant or absent.** `audit-orphans`/`verify-placement` (`tooling/skeleton-guard`) run **only** as a Claude-agent write-hook, never in CI — the one workflow that would wire them, `heady-consolidated-ci.yml`, is a **triggerless dead stub** (no `on:`, no `runs-on:`). `knip` (dead exports), `dependency-cruiser` (module disconnect), and `check-facts` **do not exist in the tree**. The **Continuous Consistency Engine (CCE)** mandated by ADR-0025 §5 is unbuilt (`@heady/consistency` = 🔲 in `docs/PACKAGE_CATALOG.md`).
4. **Deploy is rubber-stamped.** Every job in `deploy.yml` is `continue-on-error: true` and the final `verify-projections` **always `exit 0`** ("auto-success") — deployment is never blocked by consistency or health.

### C. The real-time awareness loop is off (no live self-knowledge)

1. **Change-awareness is not running.** The 4 `tooling/awareness` git hooks (`post-commit/merge/checkout/rewrite`) are **not installed**; `.data/awareness/state.json` shows **1 manual reaction, 2026-06-17**, and `lastSeenHead` lags current HEAD — the on-disk snapshot is stale. Between (non-firing) CI runs, a local change is noticed by nothing.
2. **The vector self-model is semantically inert.** `.data/vector-memory/embed-corpus-report.json`: **`embedded: 0, enqueued: 432, embedderBound: false`**. The corpus is Merkle-indexed and enqueued but **no vectors exist** — no Cloudflare Workers AI embedder credential is bound. Semantic drift/similarity awareness cannot function until that credential is injected. This is the single highest-leverage switch.
3. **No queryable live surface.** `packages/headylens` (redacted, time-ordered, detail-graded stream with a query + SSE API on port 8377) is tested but **its server is not hosted** — nothing calls `startLensServer`. The signed tamper-evident audit-of-record is intentionally deferred (patent zone G5/G9).
4. **Edge/origin drift is undetected.** `packages/auto-context` `VectorizeProjector` (Neon↔Vectorize **count-parity + PK-hash drift** check + `reconcile()`) is code-complete but has **no runtime caller** wired to a WAL listener.
5. **The context-write path and the query API are broken.** `heady_autocontext_enrich` — the mandated call to push new invariants/routes/secret-metadata into the awareness substrate — **is unimplemented** (prose-only in AGENTS.md/CLAUDE.md; no tool or function). And the live MCP awareness tools (`get_coherence`, `list_services`, `search_memory`) currently **error with `callback is not a function`** — the operator/AI query surface for self-awareness is down.

### D. The reference/connectivity graph is incomplete

Covered in §2 — this is the center of the literal ask. In short: reference-awareness is grep + locked-scalar-registry; there is no materialized data-reference graph and no ADR-0025-§4 connectivity verifier.

---

## 5. The overarching method

**A "consistency gradient": one authority, enforced continuously at every write boundary, observed continuously, over a graph that captures every reference.** Four moves, each reusing existing machinery:

1. **Singular authority** — one `facts.yaml`, one ADR tree, derived (never hand-authored) registries, and (boundary condition) one runtime that *is* the SoT tree.
2. **Continuous enforcement** — the same gate at **commit → CI → runtime → deploy**, fail-closed, so drift is impossible to introduce, not merely impossible to merge.
3. **Continuous observation** — the awareness loop *on*: live embeddings, hosted lens, active projection-drift detection, a working query surface.
4. **Complete graph** — a materialized reference + connectivity graph so "every reference to data globally" is enumerable and verifiable, not grepped.

---

## 6. Best methods, in priority order

### Method 1 — Collapse to one authority *(fixes Diagnosis A; highest leverage, lowest risk)*
- **One `facts.yaml`.** Make `packages/config.loadFacts()` the only loader; delete/redirect the legacy `/home/headyme/Heady/facts.yaml`; forbid a second copy (a coherence check: exactly one `facts.yaml`, at the canonical path).
- **Retire `heady-registry.json` as an authored file.** Either drop it or **regenerate it *from* `facts.yaml`** via `heady-derive` so it can never again contradict the SoT (it currently declares a banned embedding model).
- **Resolve the `docs/adr` vs `docs/ADR` collision** — merge to one directory, renumber the duplicates; the `adrUniqueNumbers` invariant already wants this.
- **Derive, don't author, every registry** (System Map, variable registry, service registry, compendium) — the kernel's Invariant #1. Anything hand-editable is a future drift source.

### Method 2 — Make enforcement continuous and fail-closed at every boundary *(fixes B)*
- **Commit-time gate.** Point `core.hooksPath` at a hooks dir that runs a fast subset of `coherence` + `derive --check` + `secret-scan` on `pre-commit`/`pre-push` (the design doc §9 already recommends this; today `core.hooksPath` neutralizes the secret-scan entirely). *Installing executable git hooks is persistence — present as a proposal and get explicit approval per `CLAUDE.md` §IV before wiring.*
- **Fix CI so the live gate actually runs on real work:** resolve the account-level Actions suppression (the tracked GitHub-support blocker), diagnose the 3–8s Dependabot failures (fix the failing `pnpm install`/setup so the gate can reach its logic), extend `ci.yml` triggers to feature branches, and add **branch-protection required-status-checks** so the coherence/derive gates actually gate merges into `rebuild`.
- **Runtime mesh-wide.** `consistency-bus` middleware is mounted only on `heady-manager` — mount it on every write-facing service so ingress-block/egress-normalize is uniform.
- **Un-rubber-stamp deploy.** Remove `continue-on-error`/always-`exit 0` from `deploy.yml`; gate deploys on the coherence + projection-parity checks.

### Method 3 — Complete the structural gates ADR-0025 already specifies *(fixes B, completes the non-orphanage half)*
- **Wire `skeleton-guard` `audit-orphans`/`verify-placement` into a real workflow** (fix `heady-consolidated-ci.yml`'s missing `on:`/`runs-on:`, or fold the step into `ci.yml`) so orphan-file prevention runs for humans and CI, not just agent writes.
- **Add `knip`** (dead exports) and **`dependency-cruiser`** (module disconnect) — both absent; both named by ADR-0025.
- **Assemble the CCE** (`@heady/consistency`, currently 🔲) as the MAPE-K loop that orchestrates coherence + data-consistency + orphan + connectivity + embed on a schedule/trigger, rather than as separate manually-run CLIs.

### Method 4 — Turn the real-time awareness loop on *(fixes C; the "nervous system")*
- **Inject the Cloudflare Workers AI embedder credential** so embeddings are *written*, not just enqueued (`embedded: 0 → N`). This one change activates all semantic/similarity awareness and is the highest-value item in this method.
- **Install the `tooling/awareness` git hooks** so every commit refreshes the context snapshot and publishes an awareness event. *(Persistence — requires approval, as the tool itself states.)*
- **Host the HeadyLens query/SSE server** (`startLensServer`, port 8377, bearer-token) so operators and agents have a live, queryable, redacted stream of everything the system does.
- **Wire `VectorizeProjector` to the WAL/outbox listener** so Neon↔Vectorize count-parity/PK-hash drift is detected and `reconcile()`d continuously.
- **Implement `heady_autocontext_enrich`** as a real MCP tool (the mandated context-*write* path) — or explicitly redirect the AGENTS.md/CLAUDE.md rule to `store_memory` and stop mandating a call that does not exist.
- **Fix the MCP server `callback is not a function` bug** so `get_coherence`/`list_services`/`search_memory` work — without them the self-awareness query surface is dark.

### Method 5 — Build the reference + connectivity graph *(fixes D; the literal ask)*
- **Materialize and host the graph.** The System Map + LinkIndex are already *derived* to `.data/coherence/*.json` — persist them into the pgvector/Postgres SoR and expose a query API, so "what references value X / column Y / topic Z?" is a lookup, not a grep.
- **Build the ADR-0025-§4 connectivity verifier.** Register every **DB column** (from `packages/db` migrations), **cache namespace** (KV/Redis key patterns), and **event topic** (`packages/events` subjects), then check in CI that each maps to an **active publisher and an active consumer** — failing the build on any dangling column, unsubscribed topic, or unwritten namespace. This is what converts "we know our locked facts agree" into "we know every data reference is connected."
- **Register event topics** (they are ad-hoc strings today) and adopt the `tenant:{id}:*` namespace convention in code (currently only prose) so the verifier has real inputs.

---

## 7. Sequencing under the rebuild

- **Now (P0, low-risk, high-leverage):** Method 1 authority-collapse (one `facts.yaml`, regenerate/retire `heady-registry.json`, fix ADR collision) + Method 4's embedder-credential injection. These are reversible, and they make everything downstream meaningful.
- **Next (P0/P1):** Method 2 commit-time + CI-fix + branch protection (with approval for the hook); Method 3 wire skeleton-guard/knip/dependency-cruiser.
- **Then (P1):** Method 4 awareness loop on (hooks, lens server, projector, MCP fix); Method 5 connectivity verifier + materialized graph; assemble the CCE to run them as one loop.
- **Boundary condition (the rebuild itself):** SoT↔runtime unification. Global consistency governs *nothing in production* until the running system is the rebuild (Cloud Run/Cloudflare) rather than the legacy PM2/`sites` tree. This is not a consistency "method" — it is the rebuild's completion — but every method above only reaches production behind it.

---

## 8. Do / do NOT

- ✅ **Reuse the coherence kernel, derive layer, data-consistency invariants, consistency-bus, and the pgvector+outbox substrate** — they are correct; activate and extend them.
- ✅ **Make the embedder credential and the connectivity verifier the two flagship builds** — they unlock semantic awareness and reference-awareness respectively.
- ❌ **Do not add a filesystem watcher** for awareness — the README records one that hit 1400% CPU / 11 GB RAM; the git-hook/poll model is deliberate.
- ❌ **Do not install git hooks or change `core.hooksPath` silently** — that is cross-session persistence; propose and get approval (`CLAUDE.md` §IV).
- ❌ **Do not hand-author derived registries** (`heady-registry.json`, variable registry, compendium) — regenerate from the SoT, or they become the next drift source.
- ❌ **Do not treat CI-wired as enforced** — account-suppression + no-active-branch-runs means "in a YAML file" ≠ "runs on your change." Verify with `gh run list --workflow=…`.

---

### Appendix — verification evidence (this session)

```
diff <(sort Heady-AI/facts.yaml) <(sort Heady/facts.yaml)   # 217 vs 116 lines, near-total divergence
grep embeddingPipeline heady-registry.json                  # all-MiniLM-L6-v2  (banned by EMBED-MODEL-LOCK)
git config core.hooksPath                                   # tooling/hooks  (Git-LFS only → secret-scan hook dormant)
gh run list --workflow=ci.yml                               # all runs Dependabot-triggered, 3–8s, failure
gh run list --branch feat/service-registry                 # (empty) → active branch gets zero CI
git remote -v                                               # (empty) → checkout is push-disconnected
mcp: get_coherence / list_services / search_memory          # "callback is not a function"  (awareness API down)
.data/vector-memory/embed-corpus-report.json                # embedded:0 enqueued:432 embedderBound:false
.data/awareness/state.json                                  # reactions:1 lastTrigger:manual 2026-06-17 (stale)
heady-consolidated-ci.yml                                    # no on:/runs-on: → dead stub (would-be orphan gate)
```
