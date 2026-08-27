<!-- HEADY_BRAND:BEGIN — Made with ❤️ by HeadySystems Inc. — HEADY_BRAND:END -->
# @heady/awareness — Heady Change Awareness

Realtime codebase awareness for Heady and any external AI. On every meaningful change it
runs the fail-closed consistency gate, advances the Merkle-triggered embed outbox, and
republishes a **current-state context snapshot** so whoever (or whatever) is working on the
repo has live data. Squash-merge is offered as a **non-destructive proposal** — never an
unattended history rewrite.

> This is the *realtime layer* over the existing one-shot tools. It does **not** re-implement
> the embed pipeline — it spawns `heady-embed`, keeping the **ledger** the single authority
> for "embedded" (CLAUDE_MEMORY §2) and the consistency gate the single fail-closed gate.

## Why git-hooks, not a filesystem watcher

A filesystem-wide watcher already blew up this host (1400% CPU / 11 GB RAM —
CLAUDE_MEMORY §6, the reason `turbo daemon:false`). Awareness fires on the changes any AI
should actually see — **committed / merged state** — via git hooks (zero idle cost), with an
optional cheap `git rev-parse HEAD` poll (φ⁷ ≈ 29 s) to catch commits from *any* source.
This matches AGENTS.md rule 11: the embed trigger is Merkle file-hashing, not CDC — and here,
not raw fs events either.

## Commands

```bash
heady-awareness react            # react once: gate → Merkle embed → snapshot → durable event
heady-awareness context --json   # the current-state snapshot any AI reads (read-only, cheap)
heady-awareness propose-squash --base main   # NON-destructive intelligent squash proposal
heady-awareness install-hooks    # wire git triggers (post-commit/merge/checkout/rewrite)
heady-awareness uninstall-hooks  # remove them (preserves any user hook content)
heady-awareness status --json    # service health + cumulative metrics
heady-awareness serve --poll     # run the service with the φ⁷ HEAD-poll loop armed
```

### Make it realtime (one-time, explicit)

`install-hooks` is **not** run automatically (installing executable git hooks is persistence —
your call). After running it once, every `git commit` / `git merge` / `git checkout` /
rebase silently fires a non-blocking reaction. Alternatively, `serve --poll` gives realtime
awareness with no hooks installed.

## Where "current data" lives

| Surface | Path / API | Consumer |
|---|---|---|
| Snapshot file | `.data/awareness/context.json` | any AI / tool reading the repo |
| `context` CLI | `heady-awareness context --json` | agents, scripts |
| Durable event stream | `.data/awareness/lens.ndjson` | HeadyLens query + SSE (`@heady/headylens` server) |
| Service state | `.data/awareness/state.json` | metrics, last-seen HEAD |

The snapshot is **honest**: with no embedder bound it reports
`embedderBound:false` / `vectorsLive:false` and a `currency.blockedReason` — the outbox is
advanced but **zero vectors are written** until the Cloudflare Workers AI token is injected
(CLAUDE_MEMORY §2). Define "live embeddings" as bound + written, never as enqueued.

## Squash proposals are non-destructive

`propose-squash` clusters the `base..HEAD` range by CSL-style cosine over a hybrid
semantic + structural feature bag (subject/body tokens + touched package scopes), joining
commits at the φ-threshold `CSL_THRESHOLDS.LOW` (0.691). It synthesizes a conventional-commit
message per cluster and emits the **exact** `git` commands — but always with
`autoApply:false`, `destructive:true`, `requiresHumanConfirmation:true`. It never rewrites
history; a human runs the printed commands after review (org rule: destructive ⇒ confirm).

## Architecture (Latent Service)

`createAwarenessService()` exports `{ start, stop, health, metrics }` per the AGENTS.md Latent
Service Pattern. Modules:

- `git.mjs` — read-only, fail-closed git porcelain (never throws on non-zero exit).
- `embed-bridge.mjs` — spawns `heady-embed --json`; the one embed code path.
- `context.mjs` — builds the versioned current-state snapshot (read-only, embeds nothing).
- `react.mjs` — the reaction: observe → gate-then-embed → snapshot → durable event → state.
- `squash.mjs` — the non-destructive proposer.
- `hooks.mjs` — idempotent, reversible git-hook install (preserves user hooks).
- `service.mjs` — the Latent Service + φ⁷ HEAD-poll loop.
- `state.mjs` — atomic durable state (reuses the embed-corpus store).

## Test

```bash
node --test test/awareness.test.mjs
```

*∞ Sacred Geometry · Liquid Intelligence · Permanent Life ∞*
