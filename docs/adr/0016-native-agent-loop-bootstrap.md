# ADR-0016: Native Agent Loop & rustc-Style Bootstrap

- **Status:** Accepted (2026-06-17, founder approval per ADR-0013)
- **Deciders:** Eric Anthony Haywood

## Context

ADR-0005 set the agent-governance principle (propose→sandbox→PR→human approve, no auto-merge). The
"Heady codes Heady" coder module needs the mechanism: which harness, which sandbox, which credentials, and
how the agent earns more autonomy without ever being able to grade its own homework. Source:
`Heady_Native_Interface.md`; full prose in `docs/compendium/06-governance.md` §G8.

## Decision

1. **Harness = Vercel AI SDK v6** (`streamText({tools, stopWhen, prepareStep})`) against the
   OpenAI-compatible **Liquid Gateway** (model = a route, not a vendor; ADR-0018). **The Anthropic Claude
   Agent SDK is rejected as the harness** (proprietary, protocol-locked, won't run in Workers/DO,
   separately metered) — permitted only as one MCP tool. Fallback: Cline SDK.
2. **rustc-style stages.** **Stage0** (eval harness, fidelity gate, `phi_circuit_breaker` thresholds,
   CODEOWNERS, Liquid Gateway, merge button) is **external and untouchable forever** — guards the
   Self-Rewarding-LM failure mode. **Stage1** = scope allowlist (docs, new tests, small typed refactors),
   three-layer enforced, **Writer/Reviewer mandatory**. **Stage2** unlocks by **condition not timer**
   (eval bar + zero breaker trips + zero allowlist violations + fixed-point eval ≥ baseline + one
   human-signed ADR). Stage2 is not multi-agent and not infra autonomy.
3. **Three-layer CSL gate, any one blocks merge:** GitHub (branch protection + CODEOWNERS; `blocksorg`
   App is not a code owner), CI (`coder-fidelity-gate` Check Run signed only by `blocksorg`), Workflow
   (`step.waitForEvent` released only by a Firebase-authed human). **"Approve all" exists nowhere.**
4. **Sandbox = Cloudflare Sandboxes + Outbound Workers** (credentials live in the Worker; the sandbox
   never sees the token/key); `allowedHosts` allowlist-only; escape hatch = Cloud Run Jobs. Git write via
   GitHub App **`blocksorg`** + Cloud Run token minter (1-hour downscoped tokens); private key only in GCP
   Secret Manager.
5. **`phi_circuit_breaker`** (outside the LLM loop) + kill switch `heady.coder.enabled` + per-task
   `abandon`, drilled on schedule.

## Consequences

- (+) Blast radius bounded to a rejected PR; autonomy is earned by evidence, never granted by clock.
- (+) Runs natively on the committed edge tier (Workers/DO/Workflows).
- (−) Pinning pre-1.0 SDK surfaces (`ai` v6, `agents`, `@cloudflare/ai-chat`) needs version discipline.
- Implements ADR-0005. See ADR-0018 (gateway), ADR-0010/0012 (budgets the breaker enforces).
