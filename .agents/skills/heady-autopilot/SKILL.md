---
name: heady-autopilot
description: "Autonomous execution autopilot for the Heady ecosystem. Drives a goal to completion with a configurable level of autonomy: maps the route, intelligently selects and runs beneficial /heady-* skills/commands/workflows, verifies, then auto commit→push→sync→logs. Optional --goal and --conditions set the destination; --grill-me clarifies ambiguous goals/parameters before committing. Use when the user says 'proceed as recommended', 'autopilot', 'ship it', 'do everything needed', 'auto mode', or wants hands-off forward motion toward a destination. Keywords: autopilot, auto mode, autonomy, proceed, ship, orchestrate, auto-commit, push, sync, goal, conditions, grill-me, hands-off, full throttle."
metadata:
  author: Eric Haywood
  version: '1.0'
  organization: HeadySystems Inc.
---

> **OPTIMAL BUILD NOTICE:** This file targets the Heady-AI Latent OS.
> - **Package Manager:** `pnpm` + `Turborepo`  · **Rule File:** Follow `AGENTS.md`
> - **Sync:** `scripts/heady-sync.sh`  · **Log:** HeadyLens (`@heady/headylens`)
> - **Route map:** `tooling/build-plan`  · **Skill routing:** `@heady/perspective` (CSL)

# Heady™ Autopilot

Drive a goal to completion with a **configurable level of autonomy**. Autopilot maps the route to a
destination, intelligently selects and runs the beneficial Heady skills/commands/workflows, verifies
each leg, and closes out by committing, pushing, syncing, and logging — pausing only for genuine
forks or for steps that are structurally reserved for a human.

## Invocation grammar

```
/heady-autopilot [--goal "<destination>"] [--conditions "<guardrails>"] \
                 [--autonomy=L0|L1|L2|L3] [--options <flags>] \
                 [--grill-me] [--dry-run] [--no-sync] [--budget <tokens>] \
                 [/heady-* ...explicit skills to prefer...]
```

Everything is optional. With no arguments, autopilot infers the destination from the live session +
repo state and runs at the default level (**L2**).

| Directive | Meaning |
|-----------|---------|
| `--goal "..."` | The destination. If omitted, infer it from context; if it can't be confidently inferred, trigger **grill-me**. Accepts a `/goal`-style statement. |
| `--conditions "..."` | Guardrails that bound the route — e.g. `"docs only"`, `"no prod deploy"`, `"stay reversible"`, `"under $X budget"`. Hard constraints; never crossed. |
| `--autonomy=L0..L3` | How much to do without asking (table below). Default **L2**. |
| `--options` | Extra flags, comma-sep — e.g. `verify=strict`, `parallel=on`, `adr=auto`. |
| `--grill-me` | Before committing to the route (and at risky forks), ask focused questions (AskUserQuestion) to fine-tune the goal, parameters, or conditions. Auto-engages when the goal is ambiguous or a fork is high-impact, even if not passed. |
| `--dry-run` | Map + propose only; change nothing (equivalent to L0). |
| `--no-sync` | Do the work but skip the commit→push→sync close-out. |
| `--budget <tokens>` | Soft ceiling for fan-out depth (scales how many skills/agents to chain). |
| `/heady-*` | Explicit skills to prefer. Autopilot still adds others it finds beneficial via CSL routing, but these are pinned into the route. |

## Autonomy levels (the destination governor)

| Level | Name | Behavior |
|-------|------|----------|
| **L0** | PREVIEW | Map the route and propose the action list. Change nothing. (`--dry-run`) |
| **L1** | COPILOT | Execute reversible/local steps. Confirm before anything outward, irreversible, or sensitive-path. grill-me on any ambiguity. |
| **L2** | AUTOPILOT *(default)* | Proceed as recommended. Auto-select + run beneficial skills, verify, and auto commit→push→sync→log. Pause only at genuine forks or human-gated steps. |
| **L3** | FULL THROTTLE | Maximize autonomy. Assume approval for all reversible work and for creating/accepting ADRs. Only stop at hard permission gates (which are external and cannot be bypassed anyway). Still fail-closed on secrets and destructive ops. |

**Invariants at every level** (these are not negotiable, regardless of autonomy):
- Never bypass the safety classifier or permission prompts. A higher level does **not** grant
  permissions — IAM grants, uploading credentials to external stores, and public production deploys
  remain human-gated. Autopilot surfaces these as a tight checklist instead of stalling silently.
- Never fake completion or a notification. Report what is actually live and verified.
- Never commit secrets; run the added-line secret scan before any push. `.env` stays untracked.
- Flag destructive/irreversible actions (drops, deletes, key destruction) for explicit confirmation
  even at L3 — `--conditions` may forbid them outright.
- Honor `AGENTS.md` (no placeholders, real + fully wired, fail-closed, structured logging, no
  loopback in production paths).

## Execution loop

```
1. ORIENT   → read live session + repo state; resolve --goal (or grill-me to set the destination)
2. MAP      → tooling/build-plan: map the route to the goal (mapped, straight-through DAG)
3. ROUTE    → @heady/perspective (CSL cosine) ranks which /heady-* skills/agents fit each leg;
              pinned /heady-* from the invocation are forced into the route
4. ACT      → execute legs (parallel where independent); at L0 propose only; at L1 confirm outward steps
5. VERIFY   → prove each leg (tests, health checks, coherence/eval gate) before moving on
6. GATE?    → at a human-only step (classifier/IAM/credential/prod) → record it, keep going on the rest
7. CLOSE    → unless --no-sync: heady-sync (commit → push → sync) + HeadyLens log of what changed
8. REPORT   → 3 buckets: ✅ done & verified · ⚖️ decisions made · 🔒 human-gated steps left
```

Autopilot iterates 2–7 until the goal's acceptance conditions hold or only human-gated steps remain.
It does not loop forever: when nothing executable advances the goal, it stops and reports.

## Skill selection

- Beneficial skills are chosen by semantic relevance to the current leg via `@heady/perspective`
  (CSL cosine, lexical fallback) — the same routing used by `/api/assign`. The route prefers the
  highest-ranked skills whose acceptance the leg needs.
- Common chains it composes: `/heady-auto-flow` (analyze→generate→validate), `/heady-task-decomposition`
  (break big goals into a DAG), `/heady-battle-sim` + `/heady-replan` (compare approaches),
  `/heady-security-audit` (touching auth/secrets), the `eval-gate`/`coherence` gates (verify), and
  `/heady-sync` (close-out).
- Explicit `/heady-*` in the invocation are always included; autopilot logs any it adds and why.

## Close-out (commit → push → sync → log)

Unless `--dry-run` or `--no-sync`:
1. Secret scan of added lines (fail-closed; abort the push on any hit).
2. Surgical commit of the autopilot's own changes with a message summarizing the legs completed.
3. Push + `bash scripts/heady-sync.sh` to reconcile local/remote.
4. HeadyLens entry: a time-ordered, redacted record of the route taken, skills invoked, and outcomes.

## Configuration

Defaults live inline (below). An optional `configs/autopilot.json` overrides them per-repo:

```json
{
  "autonomy": "L2",
  "grillMe": "auto",          // "auto" = engage on ambiguity/high-impact fork; true/false to force
  "sync": true,               // run the commit→push→sync close-out
  "verify": "standard",       // "standard" | "strict" (strict = full eval-gate + coherence)
  "maxParallel": 8,           // fib(6) — concurrent independent legs
  "forbid": ["prod-deploy", "destructive"]  // hard guardrails honored at every level
}
```

CLI directives override `configs/autopilot.json`, which overrides these defaults.

## Examples

```
/heady-autopilot
  → infer the destination from context, run at L2, finish with commit→push→sync→log.

/heady-autopilot --goal "wire the portal to the gateway and verify end-to-end" --autonomy=L3
  → full-throttle to the goal; only the human-gated cloud steps come back as a checklist.

/heady-autopilot --goal "harden all auth paths" --conditions "no prod deploy, stay reversible" \
                 --grill-me /heady-security-audit
  → grill to fine-tune scope, pin the security audit, execute reversibly, never deploy, then sync.

/heady-autopilot --dry-run --goal "migrate logging to structured JSON"
  → map the route + propose the action list; change nothing.
```

## What autopilot will NOT do

- Silently stall on a permission gate — it records the gate and continues on everything else.
- Cross a `--conditions` guardrail or run a destructive op without explicit confirmation.
- Mark a goal complete on the basis of a step it could not actually verify.
