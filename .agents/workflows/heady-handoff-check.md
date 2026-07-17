---
description: Pre-flight catch-up — locate the latest /heady-handoff bundle, classify it against checkpoint↔HEAD, and ingest it before autonomous work begins. Always runs as step 0 of /heady-autopilot ORIENT.
---

> **OPTIMAL BUILD NOTICE:** This file targets the Heady-AI Latent OS.
> - **Package Manager:** `pnpm` + `Turborepo`  · **Rule File:** Follow `AGENTS.md`
> - **Sync:** `scripts/heady-sync.sh`  · **Log:** HeadyLens (`@heady/headylens`)
> - **Companion:** `/heady-handoff` (writer) — this flow is the READER side

// turbo-all

# Heady Handoff Check

Read-only pre-flight that brings the current agent up to speed on everything a previous agent left
behind. It finds the newest `docs/handoff/HANDOFF-*.md` bundle, compares the handoff checkpoint
(`.data/handoff/checkpoint.json`) against the current git HEAD, and tells the agent exactly what to
ingest before acting.

**Contract:** this flow NEVER generates a bundle and NEVER advances the checkpoint — those side
effects belong exclusively to `/heady-handoff` (`node tooling/handoff/src/handoff.mjs`), which runs
at close-out. Running this check twice in a row is always safe.

## 1. Classify (one shot, read-only)

```bash
cd /home/headyme/Heady-AI
LATEST=$(ls -1 docs/handoff/HANDOFF-*.md 2>/dev/null | sort | tail -1)
HEAD_SHA=$(git rev-parse HEAD)
CKPT_SHA=$(grep -o '"head"[[:space:]]*:[[:space:]]*"[^"]*"' .data/handoff/checkpoint.json 2>/dev/null | cut -d'"' -f4)
if [ -z "$LATEST" ]; then
  echo "HANDOFF-CHECK: NO_BUNDLE — no docs/handoff/HANDOFF-*.md exists yet"
elif [ "$CKPT_SHA" = "$HEAD_SHA" ]; then
  echo "HANDOFF-CHECK: CURRENT — $LATEST covers HEAD $HEAD_SHA"
else
  echo "HANDOFF-CHECK: BEHIND — checkpoint ${CKPT_SHA:-<none>} != HEAD $HEAD_SHA; commit gap:"
  git log --oneline "${CKPT_SHA:+$CKPT_SHA..}HEAD" 2>/dev/null | head -20
fi
```

## 2. Ingest (agent instruction)

Act on the classification **before** doing anything else in the session:

- **CURRENT** → Read `$LATEST` — at minimum §1 TL;DR and §4 verification results — and fold it into
  working context. Red gates listed there are pre-existing debt: account for them, don't rediscover them.
- **BEHIND** → Read `$LATEST` **plus** the commit gap printed above (`git show --stat` any commit
  whose intent is unclear). The bundle is authoritative up to its checkpoint; the gap is yours to map.
- **NO_BUNDLE** → proceed without one. If (and only if) the session is starting multi-leg autonomous
  work where a baseline matters, seed one via `/heady-handoff` — noting its side effects: it writes a
  new `docs/handoff/HANDOFF-*.md` and advances `.data/handoff/checkpoint.json`. Skip seeding for
  read-only or single-shot sessions.

## 3. Wiring

- **Always-on:** `/heady-autopilot` runs this as execution-loop **step 0 (CATCH-UP)** — every run,
  every autonomy level, including `--dry-run`.
- **Manual:** invokable any time as `/heady-handoff-check`.
- **Writer side:** `/heady-handoff` at autopilot close-out (step 8) produces the bundle this flow
  reads at the start of the next run — together they close the agent-to-agent continuity loop.
