# ADR-0005: Agent Governance & Coder-Agent Blast Radius

- **Status:** Proposed (2026-06-15)
- **Deciders:** Eric Anthony Haywood

## Context

The native agent loop can author and ship code. Unbounded, a coder-agent's blast radius is the entire
production estate — auto-merge plus broad credentials is how a single bad generation becomes an outage
or a credential leak. The legacy auto-commit bot demonstrated this risk in practice.

## Decision

1. **Native agent loop: plan → sandbox → PR → human approval.** No step is skipped.
2. **No auto-merge.** A human approves every agent-authored PR.
3. **Eval gate on every agent PR** — the change must pass the eval suite before it is mergeable.
4. Agents run in a **sandbox** with least-privilege credentials; they cannot write to prod directly.
5. Coder-agent actions are auditable (who/what/why) and reversible (PR-based, never direct push).

## Consequences

- (+) Bounded blast radius: the worst case is a rejected PR, not a prod incident.
- (+) Eval gate + human approval keeps quality and provenance intact.
- (−) Human approval is a throughput ceiling — accepted deliberately (ADR-0013 names the founder
   bottleneck as a governance feature, not a bug, at this stage).
- See ADR-0002 (write path), ADR-0006 (idempotent retries), ADR-0011 (SLO alerting on agent-shipped code).

## Amendment (2026-06-15, REBUILD_PLAN_V2 §7 — implementation-grade spec)

`Heady_Native_Interface.md` upgrades this ADR from principle to mechanism. The decision above stands;
this adds the *how*. Full detail in REBUILD_PLAN_V2 §7 and `docs/compendium/06-governance.md`.

1. **rustc-style bootstrap.** **Stage0** (eval harness, fidelity gate, `phi_circuit_breaker` thresholds,
   CODEOWNERS, Liquid Gateway, the merge button) is **external and untouchable forever** — the agent can
   never edit these regardless of pass-rate (guards the Self-Rewarding-LM failure mode). **Stage1** = a
   hard scope allowlist (docs, new tests, small typed refactors), three-layer enforced, Writer/Reviewer
   mandatory. **Stage2** unlocks by *condition not timer* (eval bar + zero breaker trips + zero
   allowlist violations + fixed-point eval + one human-signed ADR). Not multi-agent, not infra autonomy.
2. **Harness:** Vercel AI SDK v6 against the OpenAI-compatible Liquid Gateway (model = a route, not a
   vendor). **The Anthropic Claude Agent SDK is rejected as the harness** (proprietary, protocol-locked,
   won't run in Workers/DO) — permitted only as one MCP tool.
3. **Three-layer CSL gate, any one blocks merge:** GitHub (branch protection + CODEOWNERS; the
   `blocksorg` App is not a code owner), CI (`coder-fidelity-gate` Check Run signed only by `blocksorg`),
   Workflow (`step.waitForEvent` released only by a Firebase-authed human `respondToApproval`).
   **"Approve all" exists nowhere.**
4. **Sandbox:** Cloudflare Sandboxes + **Outbound Workers hold the credentials** (sandbox never sees the
   token/key); `allowedHosts` allowlist-only; escape hatch = Cloud Run Jobs. Git write via GitHub App
   `blocksorg` + Cloud Run token minter (1-hour downscoped tokens), key only in GCP Secret Manager.
5. **`phi_circuit_breaker`** (outside the LLM loop) trips on cost ceilings, eval-drift, error spikes,
   tool-call-rate anomaly, tool-description hash drift, unallowlisted egress, judge-score drop >2σ, or
   anomalous file-touch. Kill switch = `heady.coder.enabled` + per-task `abandon`, exercised on schedule.

See ADR-0016 (native-agent-loop bootstrap, full), ADR-0018 (model gateway).
