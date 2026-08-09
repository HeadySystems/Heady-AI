# Legacy Command & ADR Transfer — 2026-08-09

Disposition record for the sweep-and-transfer of archived/used `/heady` slash commands and legacy
Architecture Decision Records into the rebuild repo. This document is the single answer to "where
did decision X / command Y go, and why" — it exists so nobody has to re-excavate the archives.

**Method.** Exhaustive sweep of every surviving legacy source (`~/_archive/` and its ~26 snapshot
mirrors, `~/_heady_skeleton_export/`, `~/HeadyAI` [symlink into `_archive`], `~/heady-production/`,
`~/workspace/`, `~/.agents/` user-global, `Heady-AI/_archive/`, `Heady-AI/governance/legacy/`,
`Heady-AI/docs/ADR/`), md5-deduplicated across mirrors, then classified against the active
`.agents/workflows/` set (33 flows) and the canonical `docs/adr/` corpus (`0000`–`0032`).
`~/Heady` and `~/workspace/Heady` are broken symlinks — those clones are gone; the archives above
are the only surviving sources.

---

## 1. Slash commands transferred → `.agents/workflows/` (active)

Eighteen commands, none of which existed in the rebuild repo. Each carries a provenance
blockquote; symlinked into `.claude/commands/` by `tooling/skill-registry/sync-workflows.mjs`.

**From `~/.agents/workflows/` (live user-global config, authored by Eric — includes the three
commands the org instructions reference):**

| Command | Purpose |
|---|---|
| `heady-no-local` | MANDATORY zero-localhost/tunnel policy + hard rules |
| `no-placeholders` | MANDATORY zero placeholders / fake data / dead-end code |
| `heady-translator` | MANDATORY operating mode: intent → action, no permission-asking |
| `heady-secret-rotation` | Incident-driven rotation of **exposed** keys via GCP Secret Manager |
| `heady-pre-commit` | Install/configure pre-commit hooks enforcing the coding mandates |
| `heady-multi-remote-sync` | Sync the 16+ git-remote topology |
| `heady-site-deploy` | Unified deploy across the Heady web properties (Cloud Run + CF) |
| `heady-deploy-cloudrun` | Cloud Run deploy for the Admin UI (⚠ project refs predate ADR-0036 lock) |
| `heady-emergency-protocol` | Full-system breakage diagnostic + recovery |
| `heady-env-sanity-checks` | DNS/hosts/service-matrix verification before any change |
| `auto-context` | Pull per-repo rules from `~/.agents/registry/rules-registry.json` via MCP |
| `heady-ide-rules` | Unified HeadyAI-IDE rules (Windsurf-Next + AntiGravity) |
| `heady-patent-lock` | Insert `HEADY_BRAND [PATENT_LOCK]` zones requiring explicit approval |
| `max-effort` | Maximum-resource execution mode |
| `heady-connectors` | List/verify the active MCP connectors |
| `heady-sync-sentry` | Sentry error tracks → Linear via Neon cache |
| `heady-localhost-migration` | Localhost→domain migration (defers to `/heady-no-local`) |

**From the archives (existed nowhere else):**

| Command | Source | Purpose |
|---|---|---|
| `secret-rotation` | `_archive/HeadyClone/Heady-pre-production-9f2f0642/.agents/workflows/` | Scheduled, manifest-driven rotation (`configs/governance/secrets-manifest.yaml` → `gcloud secrets versions add` → Cloud Run/`wrangler` secret update). Complementary to the incident-driven `heady-secret-rotation`. |

**Deliberately NOT overwritten (active version is the newer rewrite):**
`deep-scan-init`, `continuous-embedding`, `auto-extract-tasks` — the user-global variants are
Windsurf-era and reference dead paths (`~/Heady/HEADY_CONTEXT.md`, `HeadyClone/...`).
Also skipped as peripheral or other-repo-scoped: `heady-battle-arena` (active `heady-battle-sim`
covers the domain), `heady-fix-broken-links`, `heady-memory-debug`, `heady-optimal-onboard`,
`heady-video-prompt`.

**Known rich variant, flagged not merged:** the archived Windsurf `heady-sync.md` (229 lines,
"full system awareness") vs the active 63-line `heady-sync`. Preserved in the Windsurf corpus
(§2); worth mining when fixing the known heady-sync mass-deletion hazard (`git add -A` with no
deletion guard).

**Negative findings:** no workflow was ever deleted from Heady-AI git history; the 17
`_archive/*/.agents/workflows/` mirror sets are byte-duplicates of the active 33 modulo path
prefixes; 7 active flows (`heady-activity-tree`, `heady-g-bundle`, `heady-handoff`,
`heady-handoff-check`, `heady-omni-sync`, `heady-seed`, `heady-trigger-update`) have no archived
counterpart at all — they are rebuild-native.

---

## 2. Windsurf-era workflow corpus → `governance/legacy/windsurf-workflows/` (historical)

All 41 Windsurf/Cascade workflows (`heady-scan-workflow` / `claude-scan-workflow` differ only in
their self-referential `FILE:` header line) from snapshot
`_archive/Heady_20260608_102426/.windsurf/workflows/`, preserved verbatim with a README index. **Not wired as commands** — they use Windsurf `// turbo`
format and their HCFP-era protocols are superseded by the build-plan method, the governance gate,
and REBUILD_PLAN_V2. They remain the primary sources for the HCFP lineage (`hcfp-master-protocol`,
533 lines), PDCA/zero-defect protocols, and the rich `heady-sync` variant above.

---

## 3. ADRs transferred/authored → canonical `docs/adr/` (`0033`–`0050`)

| Canonical | Title | Kind | Source |
|---|---|---|---|
| `0033` | Nine-domain brand architecture (entity split, IRS boundary) | Transfer | `docs/ADR/0019` |
| `0034` | Drupal 11 headless CMS | Transfer | `docs/ADR/0020` |
| `0035` | Post-quantum cryptography mandate | Transfer | `docs/ADR/0021` |
| `0036` | GCP project + region canonical lock (us-east1) | Transfer | `docs/ADR/0022` |
| `0037` | heady-manager decomposition (incl. two named P0 security defects) | Transfer | `docs/ADR/0023` |
| `0038` | Canonical domain-registry file (carrier now root `facts.yaml` `domains:` + `configs/_domains/site-registry.yaml`) | Transfer | `docs/ADR/0024` |
| `0039` | Content-gateway Cloudflare Worker contract | Transfer | `docs/ADR/0025` |
| `0040` | Runtime capacity ceiling fib(20)=6765 (10000 = aspirational only) | Transfer | `_archive/Heady/docs/ADR/0004-capacity.md` + `governance/legacy/RECONCILIATION_DECISIONS.md` |
| `0041` | HCFullPipeline 21-stage canon (0–20, fib(8)=21) | **Authored — Accepted** (ratified 2026-08-09 by founder instruction) | legacy INDEX 0012 (body lost) + RECONCILIATION_DECISIONS |
| `0042` | φ-math single source of truth | Transfer | `_archive/Heady/docs/adrs/001-phi-math-foundation.md` + `docs/adr/ADR-002-phi-scaled-constants.md` |
| `0043` | CSL replaces Boolean gates | Transfer | `_archive/Heady/docs/adr/ADR-005-csl-over-boolean.md` + `ADR-003-continuous-semantic-logic-engine.md` |
| `0044` | Node.js ESM only | Transfer | `_archive/Heady/docs/adrs/004-esm-exports-only.md` |
| `0045` | Structured logging: pino only | **Authored — Accepted** (ratified 2026-08-09 by founder instruction) | resolves legacy INDEX 0017 vs `ADR-002-structured-logging.md` self-conflict |
| `0046` | Deterministic LLM execution + SHA-256 output integrity | Transfer | `_archive/Heady/docs/adrs/008-sha256-output-integrity.md` |
| `0047` | Sacred Geometry node topology | Transfer | `_archive/Heady/docs/adrs/005-sacred-geometry-topology.md` + `docs/adr/ADR-005-sacred-geometry-orchestration.md` |
| `0048` | Canonical schema lineage & migration consolidation | Transfer | `_heady_skeleton_export/Heady-legacy/docs/adr/0001` |
| `0049` | Similarity detects and routes; transactions commit | Transfer | `_heady_skeleton_export/Heady-legacy/docs/adr/0002` |
| `0050` | Consistency spine: CQRS + CDC, **not** event sourcing | Transfer | `_heady_skeleton_export/Heady-legacy/docs/adr/0003` |

Transferred records keep their original Accepted status + date with a transfer annotation; the two
authored records entered as **Proposed** (decisions already live and machine-enforced) and were
**ratified Accepted 2026-08-09 by direct founder instruction** per ADR-0013 — the same acceptance
form as the 0000–0018 batch review; an optional founder-signed tag (0030/0032-style) may be added
by the founder as a stronger anchor per ADR-0031. Every file
carries a Reconciliation section aligning it with the canonical corpus and a Provenance section. The
legacy `docs/ADR/` corpus is banner-marked as transferred (see its `INDEX.md`); originals stay in
place.

---

## 4. Explicitly NOT transferred — superseded/reversed decisions

These recur across ~26 archive mirrors; do not resurrect them:

| Legacy decision | Reversed by |
|---|---|
| 50/58-microservice architecture (+ Envoy sidecar mTLS) | canonical `0002` — modular monolith |
| Liquid Latent OS "RAM-first memory" | canonical `0000` — rejected by name |
| NATS JetStream as authoritative event backbone | canonical `0020` — NATS best-effort only; pgmq/CF Queues durable |
| Upstash Redis EventSpine | canonical `0003` — Upstash = best-effort cache, TTL ≤ 60s |
| Multi-provider embedding router (Nomic/Jina/Cohere/Voyage) | canonical `0015` — bge-small-en-v1.5 384-dim lock |
| CQRS + event sourcing as state management | canonical `0050` (this transfer) — CQRS + CDC, not event sourcing |
| Cross-domain relay codes + hidden iframe SSO | canonical `0028` — CHIPS `Partitioned` + `__Host-` cookies |

## 5. Remaining candidates — inventoried, not transferred (lower architectural weight)

Complete bodies exist; transfer if/when the pattern becomes load-bearing in the rebuild:

- Circuit breaker + φ-backoff state machine — `_archive/Heady/docs/adr/ADR-004-circuit-breaker-resilience.md`
- Self-healing lifecycle (7 stages, drift at cosine < 0.809) — `.../ADR-006-self-healing-lifecycle.md`
- Bee-swarm agent pattern — `.../ADR-010-bee-swarm-agent-pattern.md` (⚠ its 10,000 ceiling is overruled by canonical `0040`)
- Concurrent-equals scheduling — `.../ADR-008-concurrent-equals.md`
- Colab GPU as latent compute — `.../ADR-006-colab-pro+-gpu-integration.md` (ADR-0018's fallback tail covers the routing)
- Zero-trust MCP gateway internals (CSL-cosine tool routing, Merkle audit) — `.../ADR-008-zero-trust-mcp-gateway.md`
- Dead-letter queue + quarantine sizing — `_archive/Heady/docs/adrs/012-dead-letter-queue.md`
- Feature flags w/ Fibonacci rollout — `.../010-feature-flag-fibonacci-rollout.md`
- Saga compensation — `.../011-saga-compensation.md`
- VSA over state machines — `_archive/Heady/docs/adr/0001-vsa-over-state-machines.md`
- Liquid Deploy latent→physical projection (SocraticLoop gate) — `.../005-liquid-deploy-projection.md`

## 6. Loose ends surfaced by the sweep

- **ADR-0040 enforcement wired same day**: `facts.yaml` gained `capacity.max_concurrent_runtime: 6765`,
  const-locked in `facts.v1` (`packages/contracts/src/facts-schema.mjs`) and guarded by the new
  `C-capacity` scalar guard in `tooling/coherence/src/coherence.mjs` — same three-layer pattern as
  the 21-stage lock. Verified: contracts 10/10, coherence 23/23, facts gate all-passed.
- **`facts.yaml` `deploy_targets.origin.region` flipped `us-central1` → `us-east1`** in the same
  working-tree window (consistent with ADR-0022/ADR-0036 and with the concurrent node-production
  workstream's `scripts/verify-node-production-readiness.mjs`, which enforces us-east1). Left in
  place; verify against the actually-deployed Cloud Run region before the next deploy.

- **`.gitignore` was swallowing the rotation commands**: the `**/*secret*` glob silently excluded
  `heady-secret-rotation.md` and `secret-rotation.md` from every commit. Fixed 2026-08-09 with
  scoped negations after verifying both files contain zero secret-shaped strings (procedures only).
- `~/.agents/registry/rules-registry.json` has **no entry for `/home/headyme/Heady-AI`** — the
  rebuild repo is invisible to the `/auto-context` rule projector. Add one.
- Two legacy INDEX ADR bodies are lost with no recoverable source: 0008 (dual-active strategy)
  and 0018 (CI/CD gates — substance now lives in canonical `0025` + REBUILD_PLAN_V2 §11).
- The command catalog `_heady_skeleton_export/Heady-AI-rebuild/docs/beneficial-skills-workflows.md`
  documents the activation-layer wiring (commands/agents/hooks/permissions) as of 2026-06-15 —
  useful reference for onboarding docs.
