# /heady-research — Linear ↔ Heady Task Integration & Lifecycle

> **Question.** How should tasks be assigned to Heady and integrated through the Heady ecosystem —
> via Linear task management — so that everything is **recorded, audited, logged, and routed through
> the proper workflows, directives, data scans, and the AutoContext system** during both **autonomous**
> and **user-directed** operation? How do tasks get injected into **HCFullPipeline** and the
> **auto-success engine**, and what task-management/completion systems does Heady already have?
>
> **Method.** Ground-truth: rebuild code (`packages/*`, `tooling/*`), legacy `src/*`, ADRs, compendium,
> + the **live Linear workspace** (verified via MCP: team `Heady`/HEA, 9 projects, 317+ issues).
> Made with ❤️ by HeadySystems Inc.
>
> **Scope tags:** **[BUILT]** working rebuild · **[LEGACY]** `src/`-only · **[PLANNED]** spec/ADR only ·
> **[LIVE-EXT]** external system verified via MCP.

---

## 0. Executive summary

- **Heady's canonical work ledger is `@heady/task-ledger` [BUILT]** — a transactional Postgres state
  machine (`PENDING→RUNNING→SUCCEEDED|FAILED|CANCELLED`) with a **transactional outbox** (`task_outbox`,
  ADR-0002/0027). It is built and tested **but has no outbox consumer wired** — so nothing yet syncs to
  Linear.
- **Linear is live and rich [LIVE-EXT]** (team HEA, 9 projects, 317+ issues, Slack + Sentry +
  external-agent delegates) **but has zero in-repo bridge** — no client, webhook, worker, secret, or skill.
  The integration is **fully specified** (ADR-0027, REBUILD_PLAN_V2 §9, STEPWISE_BUILD_SPEC §2.3,
  migration Step 1) — it just isn't built in the rebuild.
- **The bridge is one well-defined seam: the outbox.** A Cloudflare Queue worker (`tasks-fanout`) drains
  `task_outbox` → Linear GraphQL (issue create / state sync) and marks rows dispatched. Inbound, a Linear
  **webhook → HCFP Stage-00 CHANNEL_ENTRY → task-ledger** path closes the loop. **Never call Linear inside
  a DB transaction** — mirror through the outbox.
- **HCFP already half-knows Linear:** Stage-04 TRIAGE (`src/hcfp/task-dispatcher.js`) routes anything
  keyed on `["linear","issue","project","sync"]` to a **`heady-connection`** sub-agent. The classifier is
  ready; the ingress webhook is missing.
- **One blocker precedes all wiring:** reconcile the **colon-topic** (`task:created`) vs **dotted-topic**
  (`heady.observation.task.done`) event convention so subscribers and the fanout worker agree.
- **This work is already tracked in Linear** as **HEA-279** ("Configure autonomous task execution across
  Heady services") and **HEA-261** (agent orchestration); this report is its blueprint.

---

## 1. The two task substrates

Heady has **two complementary planes**. Conflating them is the main source of confusion.

| | **Linear** (strategic / human plane) | **`@heady/task-ledger`** (execution / machine plane) |
|---|---|---|
| Tag | [LIVE-EXT] | [BUILT] |
| Unit | Issue (`HEA-NNN`), Project, Initiative, Cycle | `task` row (uuid) |
| Status | Backlog · Todo · In Progress · In Review · Done · Canceled · Duplicate | PENDING · RUNNING · SUCCEEDED · FAILED · CANCELLED |
| Owner | humans + **delegates** (Codex, Sentry, Blocks, Jules, Copilot) | Heady runtime (bees/agents/pipeline) |
| Audit | Linear history, comments, SLA, `gitBranchName` | `task_attempt` (per-run) + `task_outbox` (event log) + idempotency |
| Source of truth for | *intent, priority, human review, reporting* | *execution, dependencies (DAG), idempotency, results* |

**Design principle:** Linear is the **system of record for intent & review**; the task-ledger is the
**system of record for execution**. They are kept consistent by mirroring task-ledger **outbox events**
into Linear and by ingesting Linear issues as new ledger tasks. Neither is the other's master — they are
**projections of each other across the outbox seam.**

---

## 2. Unified task-lifecycle state map

The keystone: one canonical mapping so every layer agrees what "in progress" means.

```
 LINEAR              TASK-LEDGER        HCFP STAGE (21-DAG)                  CODEFLOW (if code change)
 ──────              ───────────        ──────────────────                  ────────────────────────
 Backlog             (none)             —                                   —
 Todo            →   PENDING        →   00 CHANNEL_ENTRY (intake+AutoContext)
                                        01 RECON · 02 INTAKE · 03 CLASSIFY
                                        04 TRIAGE (→ heady-connection/bee)
                                        05 DECOMPOSE (subtask DAG)          (each code subtask →)
 In Progress     →   RUNNING        →   06 TRIAL · 07 ORCHESTRATE · 08 MC    SUBMITTED→VALIDATING→VALIDATED
                                        09 ARENA · 10 JUDGE                  →(AUTO_CORRECTING)
 In Review       →   RUNNING        →   11 APPROVE (Progressive Autonomy)   GOVERNANCE_PENDING→APPROVED
                                        12 EXECUTE · 13 VERIFY               APPLIED
 Done            →   SUCCEEDED      →   14–19 (self-improve, MAPE-K)         (committed)
                                        20 RECEIPT (audit + outbox mirror)
 Canceled        →   CANCELLED          —                                   ROLLED_BACK / REJECTED
 (Done, failed)  →   FAILED         →   06 rollback / 16 MISTAKE_ANALYSIS   VALIDATION_FAILED
```

Every transition emits a `task_outbox` row (`task:created|started|completed|failed|cancelled`) →
**HeadyLens** sees it (audit) and the **fanout worker** mirrors it to the matching Linear status.
Code-bearing subtasks additionally flow the **codeflow** governance machine (ADR-0005) — sensitive paths
land in `GOVERNANCE_PENDING` = Linear **In Review** awaiting human/ARBITER approval.

---

## 3. Wiring — the integration architecture

```
                          ┌─────────────────────────  HEADY ECOSYSTEM  ─────────────────────────┐
   USER / SYSTEM          │                                                                       │
   identifies work        │   ┌───────────── INTEGRATION INTAKE (the front door) ────────────┐   │
        │                 │   │  AutoContext enrich → secret-scan → coherence → derive →      │   │
        ▼                 │   │  consistency-bus ingress → law/skeleton gates  (FAIL-CLOSED)  │   │
  ┌───────────┐  webhook  │   └───────────────────────────────┬───────────────────────────────┘  │
  │  LINEAR   │──────────────► HCFP 00 CHANNEL_ENTRY ──────────┤                                   │
  │ (HEA team)│           │        │ (AutoContext, Law 4)      ▼                                   │
  │  issues   │           │        ▼                  ┌──────────────────┐   createTask (in tx)    │
  │ projects  │           │   03 CLASSIFY → 04 TRIAGE │ @heady/task-ledger│◄──────────────────────  │
  │ delegates │           │     (heady-connection)    │ task / task_dep   │                         │
  └─────▲─────┘           │        │                  │ task_attempt      │── outbox row (same tx)─┐│
        │                 │        ▼ 05 DECOMPOSE      │ task_outbox       │                        ││
        │                 │   subtask DAG ─► 07 ORCHESTRATE → bees/swarm  └──────────┬─────────────┘│
        │  GraphQL         │        │ (HeadyPerspective CSL assigns role)            │ (drain)       │
        │  issue.create    │        ▼ 11 APPROVE ─ 12 EXECUTE ─ 13 VERIFY ─ 20 RECEIPT│              │
        │  state-sync      │                                                          ▼              │
        └──────────────────┼──────────────  tasks-fanout  ◄── getUndispatchedOutbox ──┘              │
            [PLANNED]       │            (CF Queue worker)  ── markOutboxDispatched                    │
                           │                   │  also →  Sentry (SLO), Slack (notify), HeadyLens(audit)│
                           └───────────────────┴───────────────────────────────────────────────────────┘
```

**The two directions:**
- **Outbound (Heady → Linear) [the spine]:** every ledger state change writes a `task_outbox` row *in the
  same DB transaction* (ADR-0002). The **`tasks-fanout`** CF Queue worker drains via
  `getUndispatchedOutbox(tx, 100)`, calls Linear GraphQL (create issue / move status), then
  `markOutboxDispatched(tx, seqs)`. Idempotent, retryable, fail-safe — Linear is **never** called inside
  the tx.
- **Inbound (Linear → Heady):** a Linear **webhook** (issue created/assigned to a Heady delegate) hits a
  worker that posts a `TaskManifest` to **HCFP `/api/hcfp/ingest`** (Stage-00), which `createTask`s in the
  ledger. The outbox then mirrors status back, closing the loop.

---

## 4. HCFP & auto-success injection (current + potential)

### 4.1 HCFullPipeline (21-stage DAG)
- **Current [LEGACY]:** external items enter at `POST /api/hcfp/ingest` →
  `pipeline-runner.ingest()` (validate `TaskManifest`) → `decompose()` → `route()` →
  `task-dispatcher.classify()`. **Stage-04 TRIAGE already has a `heady-connection` route keyed on
  `["linear","issue","project","sync"]`** — so a Linear-derived task *already* routes correctly once
  injected. No webhook ingests today.
- **Potential [PLANNED] — three clean injection points:**
  1. **Stage-00 CHANNEL_ENTRY = inbound channel.** Add Linear as a CHANNEL_ENTRY source (webhook → ingest).
     AutoContext (`wrapGateway`, Law 4) enriches every entry → 3D-vector context attached before TRIAGE.
  2. **Stage-04 TRIAGE = routing (already wired)** — keep `heady-connection`; extend to map Linear
     labels/projects → swarm/bee.
  3. **Stage-20 RECEIPT = outbound mirror.** On RECEIPT, the signed audit + result is the trigger to
     mirror final status to Linear (via the outbox, not a direct call).
- **Reconcile first:** the running runner is a reduced **5-step** spine vs the canonical **21**; bless the
  buildable subset or build the full DAG (see master-plan AD-2). Fix the legacy `127.0.0.1:3301` in
  `pipeline-runner.js` (zero-localhost violation) on rewrite.

### 4.2 auto-success engine
- **Current [LEGACY]:** `AutoSuccessEngine` (`src/hc_auto_success.js`) runs ~599 **internal, always-on**
  optimization tasks (event-driven, 4 terminal states: COMPLETED/FAILED_CLOSED/ESCALATED/
  TIMED_OUT_RECOVERED) with its own audit + immutable trial ledger. **Disconnected** from `@heady/task-ledger`.
- **Potential:** keep auto-success **internal** (don't pollute Linear with 599 housekeeping tasks).
  Bridge only its **ESCALATED** terminal state → `task_outbox` → Linear (an escalation becomes a HEA issue
  for human attention). Optionally migrate its persistence onto `@heady/task-ledger` so its results flow
  the *same* outbox→Linear mirror instead of a parallel path. (`tooling/auto-flow/` is advisory preflight
  only — TF-cosine skill match, φ-gates — it does **not** execute tasks; don't confuse it with the engine.)

---

## 5. Task assignment to Heady (delegate + perspective)

Two cooperating mechanisms decide **who** does a task:

1. **Linear `delegate` (the human-facing assignment) [LIVE-EXT].** Linear issues already carry a
   `delegate` field set to AI app-users — **Codex** (HEA-304), **Sentry**, **Blocks** (HEA-261:
   *"assign HEA-\* issues to Blocks agent for implementation"*). Assigning a HEA issue's delegate to a
   Heady agent (e.g. **HeadyBuddy**) is the user-facing "give Heady this task" gesture; the inbound webhook
   filters on `delegate == <Heady agent>`.
2. **HeadyPerspective CSL routing (the internal assignment) [BUILT].** Once a task enters DECOMPOSE/
   ORCHESTRATE, `@heady/perspective` ranks the optimal-company roles (8 agents / 35 bees / 134+ skills) by
   CSL cosine to the subtask (the same `/api/assign` routing) → picks the bee/agent/swarm. Stage-04's
   `heady-connection` keyword route is the coarse pass; perspective is the fine pass.

**Net:** *Linear says "Heady, do this"; HeadyPerspective decides "which bee/agent/skill within Heady."*

---

## 6. Autopilot ↔ Linear mapping

`/heady-autopilot` and Linear are the **same control structure at two altitudes**:

| Autopilot concept | Linear concept | Mechanism |
|---|---|---|
| `--goal` (destination) | **Project / Initiative** | a goal opens/ô maps to a HEA project |
| Execution leg | **Issue** (`HEA-NNN`) | each leg = a tracked issue |
| Leg → branch | `gitBranchName` (`eric/hea-NNN-…`) | Linear already emits the branch name per issue |
| Skill/agent chosen | **delegate** + label | perspective routing recorded on the issue |
| Verify gate | **In Review** status | codeflow `GOVERNANCE_PENDING` ⇒ In Review |
| Drift finding (e.g. the 15 in the master plan) | **auto-filed Issue** | autopilot files a HEA issue per finding |
| Human-gated step (IAM, deploy) | Issue assigned to **you** (not a delegate) | the checklist becomes real issues |
| HeadyLens log | Issue comments / audit | outbox events → Linear comments |

So an autopilot run is **legible in Linear**: the goal is a project, each leg an issue with a branch,
drift becomes issues, human-gated steps become issues assigned to you. This is exactly HEA-279's intent.

---

## 7. Two operating modes (the lifecycle, end to end)

### 7.1 User-directed
```
You create HEA-NNN (or set its delegate → HeadyBuddy)
  → Linear webhook (delegate == Heady) → /api/hcfp/ingest (Stage-00)
  → AutoContext enrich → CLASSIFY → TRIAGE(heady-connection) → createTask(PENDING)
  → DECOMPOSE → perspective assigns bees → EXECUTE (codeflow governs code)
  → sensitive? → GOVERNANCE_PENDING → Linear "In Review" → you approve
  → VERIFY → SUCCEEDED → RECEIPT → outbox → fanout → Linear "Done" + comment(audit)
```

### 7.2 Autonomous
```
Heady/autopilot/auto-success or a drift gate identifies work
  → INTEGRATION INTAKE (AutoContext + scans, fail-closed)
  → createTask(PENDING) → outbox → fanout → opens HEA-NNN (Todo, delegate=the agent)
  → DECOMPOSE → perspective → EXECUTE → (sensitive ⇒ In Review, waits for you)
  → VERIFY → SUCCEEDED → RECEIPT → Linear "Done" + signed receipt
  → on ESCALATED/FAILED → MISTAKE_ANALYSIS + a HEA issue assigned to you
```

In both modes **every transition is recorded** (task_attempt + outbox), **audited** (HeadyLens +
Linear history + immutable trial ledger), **logged** (structured events), routed through **directives/laws**
(coherence + derive + law gates at intake), **scanned** (secret-scan + consistency-bus ingress), and
**AutoContext-enriched at Stage-00 every time** (`wrapGateway`, Law 4 — no task proceeds context-blind).

---

## 8. What task/completion systems Heady has (inventory)

| System | Status | Role |
|---|---|---|
| `@heady/task-ledger` + `task_outbox` | **[BUILT]** | Canonical execution ledger + the sync seam (consumer unbuilt) |
| `codeflow` ledger | **[BUILT]** | Governed **code-proposal** machine (≠ task system) — overlays code subtasks |
| `AutoSuccessEngine` | **[LEGACY]** | ~599 internal always-on tasks; own audit/trial ledger; bridge ESCALATED only |
| HCFP `src/hcfp/*` + `/api/hcfp/ingest` | **[LEGACY]** | Manifest pipeline; Stage-04 already routes "linear" |
| `configs/hcfullpipeline-tasks.json` + `auto-extract-tasks` workflow | **[LEGACY]** | 4 file tasks, **git-mirrored (not Linear yet)** — §9 wants it filing to Linear |
| `tooling/auto-flow` | **[BUILT, advisory]** | Skill-preflight selector (φ-gated), does **not** execute |
| **Linear** (team HEA) | **[LIVE-EXT]** | Strategic system of record: 9 projects, 317+ issues, delegates, SLA, Slack |
| **GitHub** Issues/Projects | **[LIVE-EXT]** | Live (PAT in registry, ADR-0001); PRs driven via Linear branches |
| **Sentry** | **[CONFIGURED]** | Error→issue (HEA-186/194/276 done); planned outbox target; SLO feedback |
| **Slack** | **[LIVE-EXT]** | Linear-integrated (slackChannelId on projects); notifications |
| **monday.com** | **[LIVE-EXT]** | Operator PM; classified ops-only, not product stack |
| **HeadyLens** | **[BUILT]** | Read-only audit lens over `@heady/events` (sees every outbox event) |
| **awareness** (`tooling/awareness`) | **[BUILT]** | Git-hook realtime change layer (not a tracker) |
| **heady-checkpoint** workflow | **[BUILT]** | Manual checkpoint/handoff (commit-push-sync-log) |

**Current Linear integrations that EXIST (mostly Done in Linear):** Sentry↔Linear bidirectional auto-issue
(HEA-186/194/276), agent delegation via Blocks/Codex (HEA-261/304), CI→Linear status (HEA-177), Slack↔Linear
(project channels). **In-repo code bridge to the task stores: none yet.**

---

## 9. Blueprint — the `tasks-fanout` worker (outbound spine)

```js
// apps/heady-tasks-fanout/src/index.ts  [PLANNED → build]
// CF Queue/Cron worker. Drains task_outbox → Linear GraphQL. Idempotent, fail-safe.
export default {
  async scheduled(_e, env) {                       // or queue() consumer
    const rows = await db(env).tx(async (tx) =>     // read-only snapshot
      getUndispatchedOutbox(tx, 100));
    const done = [];
    for (const r of rows) {                          // r.topic: 'task:created'|'task:completed'|...
      try {
        await linear(env, mapTopicToLinear(r));      // create issue OR move status (GraphQL)
        done.push(r.seq);
      } catch (e) { log('error','fanout', {seq:r.seq, err:String(e.message)}); /* retried next tick */ }
    }
    if (done.length) await db(env).tx((tx) => markOutboxDispatched(tx, done));
  }
};
// mapTopicToLinear: 'task:created'→issueCreate(team HEA, status Todo, delegate);
//   'task:started'→status In Progress; 'task:completed'→Done(+receipt comment);
//   'task:failed'→Done?reopen + comment; 'task:cancelled'→Canceled.
```
Required: `LINEAR_API_KEY` in `packages/secrets/src/registry.mjs` (currently absent by policy — promote
Linear from "operator app" to a product secret), the planned **`heady-linear`** skill (Skills Registry
Expansion backlog), and a `task ↔ HEA-NNN` id-map table (add to a migration).

---

## 10. Testing & integration plan

| Test | What it proves | How |
|---|---|---|
| **Outbox contract** | every ledger transition writes exactly one correct outbox row | unit over `createTask/start/complete/cancel` (in-memory tx) |
| **Topic taxonomy** | `subjectMatches` agrees with what `projectOutbox` emits | unit — **fix colon-vs-dotted first** (see §11) |
| **fanout idempotency** | re-draining never double-creates Linear issues | dispatch twice → assert one issue (id-map) |
| **Round-trip (the migration Step-1 gate)** | `Linear issue → task_ledger → outbox → Sentry health` round-trips with idempotency | integration test against a Linear sandbox project |
| **Webhook → ingest** | a Linear issue assigned to the Heady delegate creates a PENDING task | post a sample webhook → assert task row |
| **Delegate handshake** | only issues delegated to a Heady agent are ingested | filter test on `delegate` |
| **Governance gate** | sensitive code subtask lands In Review, not auto-applied | codeflow `GOVERNANCE_PENDING` ⇒ Linear status |
| **Fail-closed intake** | a task with a secret/locked-value/law violation is quarantined | intake gate tests (secret-scan, consistency-bus, coherence) |
| **AutoContext always-on** | no task reaches TRIAGE context-blind | `assertEnriched` on Stage-00 |
| **CI gate** | the fanout + webhook contracts stay green | `node --test` + a `tasks-fanout` dry-run in CI |

---

## 11. Blockers & drift to fix before wiring (ordered)

1. 🔴 **Colon-vs-dotted topic convention.** task-ledger writes `task:created`; `@heady/events` taxonomy is
   `heady.observation.task.done`. `projectOutbox` publishes verbatim → namespaced subscribers miss colon
   topics (only `'>'` catch-all matches). **Pick one** (recommend dotted `heady.task.*`), update the ledger
   emitters + the fanout mapper. *This is the first thing to fix.*
2. 🟠 **No `LINEAR_API_KEY` in secrets** — promote Linear to a product secret in `packages/secrets`.
3. 🟠 **No outbox consumer** — build `tasks-fanout` (§9).
4. 🟠 **`auto-extract-tasks` git-mirrors instead of filing to Linear** — repoint to the outbox path.
5. 🟡 **"Heady Rebuild" team never created** (ENV_SEPARATION §2.7 vs reality) — the legacy/rebuild split is
   **project-level** (Production Live vs Heady). Decide: keep project-split (simplest) or create the team.
6. 🟡 **auto-success ↔ ledger disconnect** — bridge ESCALATED state only.
7. 🟡 **Legacy `127.0.0.1:3301` in `pipeline-runner.js`** — zero-localhost violation; fix on rewrite.

---

## 12. Optimal-use guidance (how to actually drive it)

- **You assign work to Heady** by creating a HEA issue and setting its **delegate** to a Heady agent (or via
  `/heady-autopilot --goal` which opens the project + issues). Heady ingests only delegate-matched issues.
- **Heady assigns work to itself** by opening HEA issues through the outbox when a gate/auto-success/autopilot
  identifies it — so autonomous work is as visible and auditable as your own.
- **Everything funnels through the intake front door** (AutoContext → scans → laws → governance) — there is
  no side door; that's what makes it all recorded/audited/logged.
- **The outbox is the only sync seam** — never let any component call Linear (or Sentry/Slack) inside a DB
  transaction; mirror through `task_outbox` so failures are retried and ordering is preserved.
- **Sensitive/patent-zone tasks** auto-route to **In Review** (codeflow governance + ARBITER) — they never
  auto-apply, satisfying the directives.

---

## 13. Phased roadmap (maps to existing Linear issues)

1. **P0 — Topic reconciliation** (§11.1) + `LINEAR_API_KEY` secret. *(unblocks everything)*
2. **P1 — `tasks-fanout` worker** (outbound mirror) + `task↔HEA` id-map migration + round-trip test (the
   migration Step-1 exit gate). *(HEA-279)*
3. **P2 — Inbound webhook → `/api/hcfp/ingest`** (Stage-00 channel) + delegate filter. *(HEA-261 pattern)*
4. **P3 — `heady-linear` skill** (Skills Registry Expansion backlog) + perspective label→bee mapping.
5. **P4 — auto-success ESCALATED bridge** + repoint `auto-extract-tasks` to the outbox.
6. **P5 — Autopilot↔Linear** (goals→projects, legs→issues, drift→issues) — full legibility.

> Once P0–P2 land, the **Step-1 exit gate** holds: *a probe task flows `Linear issue → task_ledger → outbox
> → Sentry health` round-trip with idempotency proven* — and Heady is genuinely driving Linear, recorded
> and audited end-to-end, in both autonomous and user-directed modes.
