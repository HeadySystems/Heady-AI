# 06 — The Governance System (complete)

> Every component that constrains, validates, approves, audits, secures, or self-heals Heady. Governance
> is not a module — it is the cross-cutting nervous system. Organized into ten subsystems, each with
> **What · Why · How · When · Where · Disposition**.

The governing thesis (corpus + ADR consensus): **"The agent proposes; the human approves; the
environment enforces."** Approval is accountability-transfer, not a control — so enforcement lives in
independent layers (GitHub, CI, Workflow, OPA, sandbox), any one of which can block. Containment is
*environmental, not behavioral* — "the weakest layer is the one you built yourself."

---

## G1. The constitutional laws (the substrate)

**What.** Two law sets the whole system runs under: the **4 Liquid Architecture laws** (Liquidity,
φ-Scaled Proportionality, Sovereignty, Zero Placeholders) and the **10 Constitutional Laws** of V9
(Law 0 No-localhost · 1 No-placeholders · 2 No-silent-failures/Glass-Box · 3 No-build-steps-in-frontend ·
4 PQC-everywhere · 5 Determinism · 6 Metacognitive-honesty · 7 Safety-over-speed · 8 No-ship-without-tests
· 9 Distill-every-success). **Why.** Absolute invariants prevent the failure modes that actually killed
the legacy estate (credential leaks, stubs, silent errors, sprawl). **How.** Each law maps to an
*automated enforcer* (see G-table), not a guideline — "encode every invariant as automation." **When.**
Checked in the Systematic Scan Protocol before every task and in CI on every change. **Where.** Root
`AGENTS.md` + CI + pre-commit. **Disposition:** baseline, with two reconciliations — Law 3 (frontend) is
**R1** (React/Vite allowed for SPAs; superseded by June docs) and Law 4 (PQC) is **R3** (aspirational; see
G9).

| Law | Enforcer (How) | Where |
|---|---|---|
| No localhost | `grep localhost\|127.0.0.1` scan = zero tolerance | CI scan step |
| No placeholders | lint-staged / pre-commit rejects `// TODO`, stubs | pre-commit + CI |
| No silent failures | Pino structured JSON, never `console.*`; redaction | logger singleton |
| Determinism | `temp=0, top_p=1, seed=42`; SHA-256 output hash; signed | model adapter |
| Metacognitive honesty | confidence `< ψ²(0.382)` → state known/unknown, never hallucinate | CSL gate (G2) |
| No ship without tests | 4-Layer Testing Fortress = definition of "done" | CI gate |
| Distill every success | stage 21 DISTILL triggers `heady-distiller` | pipeline |

---

## G2. CSL gates — governance as geometry

**What.** All decision logic is a **Continuous Semantic Logic** gate: cosine-similarity in vector space
replaces `if/else`. **Why.** Removes brittle hardcoded conditionals; decisions become differentiable,
auditable, drift-detectable surfaces. **How.** `GATE(x) = value · σ((cos(a,b) − τ)/T)`; a decision flow
embeds the input, gates it, and routes EXECUTE/CAUTIOUS/HALT. Two threshold formulations coexist (R6):

- **V9 gate cuts (canonical routing):** `< ψ²(0.382)` → HALT · `≥ ψ²` → CAUTIOUS · `≥ ψ(0.618)` → EXECUTE.
  Score ranges PRIME 0.718+ / BOOST 0.618+ / RECALL 0.382+ / NOISE <0.382.
- **Blueprint privileged-action ladder** (`Threshold = 1 − ψ^level × 0.5`): DEDUP ≥0.972 (skip inference,
  serve cache) · CRITICAL ≥0.927 (authorize high-privilege writes) · HIGH ≥0.882 (core routing) · MEDIUM
  ≥0.809 (below → self-heal) · LOW ≥0.691/0.382 (noise discard) · MIN 0.500.

**When.** Every pipeline stage; especially 03 CLASSIFY, 11 APPROVE, 12 EXECUTE. **Where.** `csl-engine`
package (384-D quick / 1536-D full). **Disposition:** baseline — CSL is for **quality/relevance gating
and privileged-action thresholds, NOT for ranking/ordering** (the "no-ranking" principle). The adaptive
gate temperature `T = ψ^(1+2(1−H/Hmax))` sharpens when confident, softens when uncertain.

---

## G3. MCP security — the confused-deputy gate & tool-poisoning defense

**What.** The hardening layer for the MCP plane, where an agent with elevated creds acts on untrusted
input. **Why.** The dominant risk class: **Confused Deputy** (server with system privileges executes a
malicious prompt's action), **direct/indirect prompt injection** (hidden payloads in retrieved data), and
**tool poisoning/shadowing** (altered tool metadata redirects a benign call to a dangerous tool).
**How — defense-in-depth:**

1. **`authorize(principal, tool)` policy gate** — the confused-deputy fix. Caller identity propagates;
   deploy-class tools cannot be coerced via a lower-privileged caller. The UI's `deployClass` flag mirrors
   this server-side gate.
2. **Isolated sandboxing** — every MCP server in a micro-container/VM; filesystem `chroot`-scoped;
   network **default-deny egress**, allowlisted endpoints only (Cloudflare Outbound Workers hold the
   creds so the sandbox never sees a token).
3. **Zod `.strict()` validation** at every boundary; params failing schema are rejected pre-execution.
4. **User-bound scopes** — no blanket system permissions; tokens bind to the Firebase-verified user; an
   agent can never do what the user cannot. No token passthrough; per-user credentials.
5. **Explicit approval gates** for destructive/high-impact tools (prod DB writes, shell, billing).
6. **Runtime monitoring** — tool-call-rate anomaly + **tool-description hash drift** trip
   `phi_circuit_breaker` (G8).

**When.** Every MCP invocation. **Where.** `heady-mcp-server` core (`packages/core/policy.ts`), the
**6 permission groups** / ~47 tools taxonomy. **Disposition:** baseline (ADR-0005; MCP Build Guide).

---

## G4. Permission graph & delegation vault

**What.** The data-driven model of *who/what may act on whose behalf, within what scope* — a permission
graph plus a delegation vault that issues scoped, time-boxed delegations. **Why.** AI companions act for
users across services; unscoped delegation is how a companion becomes an attacker. **How.** Permission
nodes (user, agent, tool, resource) and edges (granted scopes) with delegation chains that **attenuate
only downward** (a delegate can never exceed its delegator); OAuth/API-key federation
(`heady-auth-provider-federation`) wires providers; secrets resolve from GCP Secret Manager via
`heady-vault`. **When.** At every cross-boundary action; delegations minted per task, revoked at retire.
**Where.** `heady-buddy-permission-ops`, architecture spec `05-Architecture-Specs/01-permission-graph-
delegation-vault.md`. **Disposition:** baseline; PermissionGuardBee is its runtime enforcer.

---

## G5. Trust receipts & action playback

**What.** An append-only, signed record of every consequential action, replayable step-by-step. **Why.**
Auditability and user trust: a user (or regulator) can see exactly what the agent did and why, and replay
the decision. **How.** Each action emits a **trust receipt** (inputs, CSL scores, model route, cost,
diff/output hash, approver) written append-only and **ML-DSA/Ed25519 signed** (G9); **action playback**
reconstructs the decision timeline from receipts. **When.** Stage 20 RECEIPT of every pipeline run;
streamed to `wisdom.json`. **Where.** `heady-trust-receipts`, spec `07-trust-receipts-action-playback.md`;
surfaced in the MCP Console drawer. **Disposition:** baseline — pairs with Langfuse traces (neither alone
is a sufficient audit log).

---

## G6. The HCP approval system (deploy-gating, not just merge-gating)

**What.** The **Heady Change Proposal** — the human-in-the-loop authority for changes *and deploys*.
**Why.** A solo founder needs a deploy gate that is auditable, signed, and policy-checked, covering
patent-locked zones and canary rollout. **How.**
- **HCP template** = Nygard ADR + MADR 4.0 + Y-statement + Rust-RFC (Drawbacks/Unresolved) + Oxide-RFD
  (state machine), plus three Heady affordances: **gates deploys not just merges**, declares
  `patent_locked_zone`, embeds the φ-canary plan as a reviewable section.
- **Machine-readable approval record** — ULID; state machine (pending/approved/rejected/expired/
  superseded); per-approver **HMAC-SHA256** + a detached **Ed25519 signed_receipt** verifiable from a
  public JWK; `expires_at = created_at + φ×10h`; nightly audit-replay re-verifies every signature.
- **OPA/Rego policy** (`policies/approval.rego`): `required_count := 2 if patent_locked else 1`;
  auto-approve Renovate patch-only PRs; `deny` >5-file changes without HCP and any patent-zone touch
  without explicit declaration. Same policy in CI (`opa eval --fail-defined`) **and** runtime
  (`opa-wasm`) so they never disagree.
- **GitHub-native enforcement** — Environments + **Deployment Protection Rules** (the approval service is
  a GitHub App answering `deployment_protection_rule` webhooks) + CODEOWNERS on `/patent-locked/**`.
- **φ-canary** — 5/25/50/100% with φⁿ soak times (φ²≈2.62h, φ³≈4.24h, φ⁴≈6.85h), Cloud Run revision tags.

**When.** Every deploy and every >5-file or patent-zone change. **Where.** Hono-on-Workers approval API
(`/api/approvals/:id[/approve|/reject]`), Neon `approvals`/`approval_events`(append-only)/`approval_
receipts`. **Disposition:** baseline (Eng_Playbook §6); *caveat:* custom protection rules on private
repos need GitHub Enterprise Cloud.

---

## G7. Projection governance — manifests, drift, lifecycle

**What.** The governance of the public `*-core` projection shells so a shell can never masquerade as a
backend. **Why.** "Projection drift" — thin shells returning `{"projected": true}` signaling false
readiness — was a top legacy smell (ADR-0001). **How.**
- **Projection = a pure one-way derivation** `(monorepo_SHA, source_path, transform_fn) → public repo`;
  four invariants: one-way, content-addressable (SHA-256 tree hash), manifest-authoritative
  (`projection.yaml`, JSON-Schema 2020-12), license/patent-bounded.
- **Manifest** carries `source_path, last_sync_commit, last_sync_hash, deploy_mode, live_url, health_url,
  status, drift_policy, private_paths` — and is what the **MCP Console** reads to render `real_service`
  vs `projection_only`.
- **Drift detection** (cron, 15 min): `in-sync` / `source-ahead` (re-project) / `projection-ahead`
  (**page + freeze** — unexpected).
- **Lifecycle:** `proposed→scaffolded→active→deprecated→archived→eliminated` (backward forbidden except
  `deprecated→active`); deprecate injects RFC-8594 `Sunset = +89d`; eliminate gated on zero inbound refs
  + <13 req/day for 34d + dual approval.
- **Tooling:** Google Copybara (history) + a Node projector (hashing, drift, manifest, deploy). Patent-
  locked content stripped via `.headyignore` + `private_paths` + `// HEADY-INTERNAL-BEGIN/END`.

**When.** Continuously (cron) + on every monorepo merge. **Where.** projections engine; SyncProjectionBee
is the runtime arm. **Disposition:** baseline (ADR-0001 amended posture; ADR-0017 to author).

---

## G8. Agent-loop governance — the rustc bootstrap & circuit breaker

**What.** The containment around "Heady codes Heady." **Why.** A coder-agent's unbounded blast radius is
the whole estate. **How (full spec in `Heady_Native_Interface.md` / ADR-0005 amendment):**
- **Stage0 = external & untouchable forever:** eval harness, fidelity gate, `phi_circuit_breaker`
  thresholds, CODEOWNERS, Liquid Gateway, merge button. The agent can never edit these (blocks the
  Self-Rewarding-LM failure mode). External compiler = Claude Code / Cursor.
- **Stage1 = scope allowlist** (docs, new tests, small typed refactors), enforced in 3 layers (Outbound
  `allowedHosts` + token `permissions`/`repositories` narrowing + server-side `submit_pr` path-glob
  refusal). **Writer/Reviewer pattern mandatory.**
- **Stage2 = condition-gated, never timer** (eval bar + zero breaker trips + zero allowlist violations +
  fixed-point eval ≥ baseline + one human-signed ADR). Not multi-agent, not infra autonomy.
- **Three-layer CSL gate** (any one blocks): GitHub branch protection, CI `coder-fidelity-gate` Check Run
  (signed only by `blocksorg`), Workflow `step.waitForEvent` (released by a Firebase-authed human).
  **"Approve all" exists nowhere.**
- **`phi_circuit_breaker`** (outside the LLM loop) trips on: per-PR/per-day cost ceilings, eval-pass-rate
  drift, error-rate spike, tool-call-rate anomaly, tool-description hash drift, unallowlisted egress,
  rolling-50-trace judge-score drop >2σ, anomalous file-touch (`evals/`/`ci/`/`.github/`/coder/). Kill
  switch `heady.coder.enabled` + per-task `abandon`, drilled on schedule.

**When.** Every agent run. **Where.** `core/modules/coder/`, GitHub App `blocksorg` + Cloud Run token
minter. **Disposition:** baseline (ADR-0005 amended; ADR-0016 to author).

---

## G9. Cryptographic governance — determinism, signing, PQC

**What.** The crypto posture: deterministic auditable execution + signed receipts + (aspirationally)
post-quantum everywhere. **Why.** Trust receipts and approvals must be tamper-evident; Law 4 wants
quantum resistance. **How.** Determinism (Law 5): same input hash → same output (`seed=42`), SHA-256
output hashes. Signing: **Ed25519 today** (approval receipts, commit attribution), **ML-DSA-65 /
ML-KEM-768 / SLH-DSA (NIST L3) aspirationally** (V9 Law 4 "Ed25519 RETIRED"). **When.** Every receipt,
approval, and signed deploy. **Where.** `heady-pqc-security` (WebAuthn, mTLS, ML-DSA), approval receipts.
**Disposition — R3 (the one real conflict here):** V9 retires Ed25519; the approval system *uses* it.
**Resolution:** Ed25519 is the **pragmatic baseline now** (mature tooling, opa-wasm/JWK verifiable); PQC
(ML-DSA/ML-KEM) is **Phase-4 aspirational**, adopted when the ecosystem (libs, HSM/KMS support) is ready,
via a dual-sign transition (sign with both, verify either) — never a flag-day swap.

---

## G10. Self-healing & reliability governance

**What.** The loops that keep the platform correct without a human: the reactive error→armor loop, the
proactive MAPE-K loop, and the self-healing lifecycle. **Why.** A solo operator can't babysit; failures
must become permanent structural defenses. **How.**
- **Buddy Deterministic Optimization Loop (reactive, §24):** Error → halt/freeze → state extraction →
  seeded-replay equivalence → root cause (5-Whys + Ishikawa, supplemented by **Sentry Seer**) → **rule
  synthesis** appended to the Learned Rules Registry (LR-001…LR-006: edge paths, pnpm audit, Redis
  timeouts, pino logging, Host header, zero `console.*`) → enforced before future writes.
- **MAPE-K Self-Improvement Loop (proactive, §25):** Monitor (OTel + Sentry Seer) → Analyze (DuckDB on
  Colab Delta) → Plan (DSPy MIPROv2) → Execute (prompt tuning, distillation, config evolution) → Knowledge
  (permanent). Drift threshold `ψ`; rollback window `φ²≈2.62h`. This is **also the Continuous Consistency
  Engine** (`heady consistency` CLI) over `facts.yaml`, with knip/dependency-cruiser/syncpack/Renovate.
- **Self-Healing Lifecycle:** detect → quarantine → attest → respawn → prevent-repeat; circuit breakers
  (ResilienceBee), health probes (health-bee/WatchdogBee), φ-exponential backoff.

**When.** Continuously. **Where.** `heady-self-healing-lifecycle`, `heady-reliability-orchestrator`,
`heady-drift-detection`, Colab Delta. **Disposition:** baseline; MAPE-K's *self-editing* obeys the same
stage0 untouchables as G8 (it may tune prompts/configs, never the eval gate or thresholds).

---

## G11. Anti-sprawl governance (CI-enforced) & compliance

**What.** The rules that stop the estate from re-fragmenting, plus the regulated-industry compliance
layer. **Why.** Sprawl is the original sin (75 repos, 4 orgs); compliance unlocks fintech/healthcare
revenue. **How — anti-sprawl (all in CI):** one org/one monorepo (CI rejects new top-level dirs without an
ADR); generated-not-authored (`// AUTOGENERATED`, `git diff --exit-code generated/`, CODEOWNERS-lock);
typed module boundaries (`eslint-plugin-boundaries` + `dependency-cruiser` + `api-extractor`); trunk-based
+ flags + expand-migrate-contract; AGENTS.md hierarchy + explicit "Do not create" list. **How —
compliance:** PHI Anomaly Gate (quarantine HIPAA markers before external inference, 0% transit leak),
single-tenant **sovereign DB** per client (CLOUD Act residency), KV audit trails (<50ms), governance bees
at CSL ≥0.70, BYOK/sovereign identity (`heady-sovereign-identity-byok`, SovereignBee). **When.** CI on
every PR; compliance gates from Phase 3/4. **Where.** CI workflows, `heady-nonprofit-ops`, PHI scorecard
(`10`). **Disposition:** anti-sprawl = baseline (P0+); PHI/sovereign = Phase-3/4 evidence-gated.

---

## Governance enforcement bees (runtime arm — x-ref `02`)

| Bee | Enforces | Subsystem |
|---|---|---|
| **PermissionGuardBee** | permission graph, scopes, secret rotation, mTLS | G3, G4 |
| **AuditBee** | trust receipts, immutable audit telemetry | G5 |
| **ComplianceBee** | RBAC, CSL≥0.70, PHI/regulatory | G11 |
| **SecurityBee** | secret/CVE scanning, threat modeling | G3, G11 |
| **WatchdogBee** | loop-stall / memory-leak / drift detection | G10 |
| **GovernanceBee** | policy/OPA evaluation, approval routing | G6 |
| **ResilienceBee** | circuit breakers, backoff, quarantine/respawn | G10 |
| **SovereignBee** | BYOK, client-side key custody, residency | G9, G11 |
| **SyncProjectionBee** | projection manifest truth + drift | G7 |

---

## Disposition summary

Baseline now: G1 (laws+enforcers), G2 (CSL), G3 (MCP security), G4 (permission graph), G5 (trust
receipts), G6 (HCP/OPA), G7 (projection governance), G8 (agent bootstrap), G10 (self-healing),
G11-anti-sprawl. Reconciled: G1-Law3 (**R1** frontend), G9 (**R3** Ed25519 now / PQC later), G2 thresholds
(**R6**). Phase-gated: G11-compliance (PHI/sovereign), PQC. New ADRs implied: 0016 (agent bootstrap),
0017 (projections), and a future PQC-transition ADR.
