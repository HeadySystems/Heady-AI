<!-- HEADY_BRAND:BEGIN
  HEADY™ · START_HERE.md
  The agent front door — every AI agent reads this first.
  ∞ Sacred Geometry · Liquid Intelligence ∞
  © 2026 HeadySystems Inc. — Eric Haywood, Founder
HEADY_BRAND:END -->

# 🛑 START HERE — Agent Onboarding for the Heady Monorepo

**If you are an AI agent (Claude Code, Cursor, Copilot, or any other) opening this
repository, read this file before doing anything else.** It tells you *what's going
on* and *exactly what to do*. It is short on purpose. The files it points to are the
spec — neighbouring files are only examples, never a substitute for the spec.

---

## 1. What this is

The **Heady™ Latent OS** modular-monolith rebuild: one **Turborepo + pnpm** monorepo
(**Node 22, ESM only**) consolidating 75+ legacy repos. Core runs on **Cloud Run**,
edge on **Cloudflare Workers**; storage is **Neon Postgres + pgvector** (384-dim,
embedding-locked); reasoning uses **Continuous Semantic Logic (CSL)** gates and
**φ-scaled (Golden Ratio) constants**. 51 provisional patents — patent-locked zones
require review.

## 2. Read these first, in this order (the spec)

| # | File | What it gives you |
|---|------|-------------------|
| 1 | [`AGENTS.md`](./AGENTS.md) | The hard coding rules + architecture patterns. Non-negotiable. |
| 2 | [`CLAUDE_MEMORY.md`](./CLAUDE_MEMORY.md) | **Current state & the next tasks** — what's done, what's blocked, what to do now. |
| 3 | [`governance/CONSTITUTION.md`](./governance/CONSTITUTION.md) | The 8 + 1 Unbreakable Laws. |
| 4 | [`governance/enforcement/ENF-anti-shortcut.md`](./governance/enforcement/ENF-anti-shortcut.md) | Exactly which patterns CI will reject, and why. |

## 3. What's going on right now

- **Branch model:** develop on **`rebuild`** (the active canonical line). `main` is
  legacy — do **not** target it.
- **Current state & next tasks live in [`CLAUDE_MEMORY.md`](./CLAUDE_MEMORY.md)** —
  it is the live handoff record; read its "Immediate Next Steps" section.
- **Live state is pushed to you, actively.** At session start
  `.claude/hooks/heady-session-context.mjs` reads the live `@heady/awareness`
  snapshot (`.data/awareness/context.json`) and fires a non-blocking
  `heady-awareness react`, registering your session as a durable event in the
  awareness lens. The front door is a *sensor*, not a sign — see §6.

> **Build ACTIVE, not passive (AGENTS.md #12).** Heady is an always-on projection
> system. Anything you build for it should react, emit, or stay current — wired
> into `@heady/awareness` / `@heady/auto-context` / the event bus / a projection.
> A static, inert file is the rare exception, not the default.

## 4. The rules that will fail CI (non-negotiable)

These are machine-enforced — *a rule that is not machine-checked is not a rule.* See
[`governance/enforcement/law-enforcers.yaml`](./governance/enforcement/law-enforcers.yaml)
for the Law → enforcer → CI-job map.

- **No `localhost` / `127.0.0.1` / hardcoded ports** — targets come from env / secret manager.
- **No placeholders** — no `TODO` / `FIXME` / `HACK` / stub throws / "coming soon".
- **Glass-box logging** — no `console.*`; structured pino + `X-Heady-Trace-Id` only. No empty catches.
- **No committed secrets** — keys/tokens/PEM are blocked; secrets resolve from GCP Secret Manager.
- **ESM only** (`import`/`export`), **`HEADY_BRAND` header** in every new file, **φ/Fibonacci constants** (no magic numbers), **tests alongside code**.

## 5. How to work here

1. Branch off `rebuild`. Make the change real and complete (no stubs).
2. **Run the gates locally before pushing** (they are the same ones CI runs):
   ```bash
   node tooling/enforcers/no-localhost.mjs --all
   node tooling/enforcers/glass-box.mjs --all
   node tooling/enforcers/secret-scan.mjs --all
   node tooling/enforcers/agent-onboarding.mjs
   node --test tooling/enforcers/test/
   ```
3. Conventional Commits. Open a PR into `rebuild`. Keep generated files generated.

## 6. The environment enforces

*agent proposes, human approves, environment enforces.* Two layers back these rules
so they hold whether you remember them or not:

- **Live, while you edit:** `.claude/` PreToolUse hooks (`heady-rules.mjs`,
  `skeleton-guard-hook.mjs`) block non-compliant writes immediately.
- **At merge:** the CI jobs in [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)
  (`verify`, `law-check`, `governance`, `scan`) fail closed on any violation —
  including `agent-onboarding`, which keeps **this front door** present and linked
  from every entry point so the next agent is never lost.

---

*∞ Sacred Geometry · Liquid Intelligence · Permanent Life ∞*
*© 2026 HeadySystems Inc. — Eric Haywood, Founder*
