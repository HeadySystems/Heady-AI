# Heady™ Task Management & Sync Architecture
## Research & Implementation Guide: monday.com + Slack + Linear + Sentry + Admin UI

**Prepared for:** Eric Haywood, HeadySystems Inc.
**Date:** July 18, 2026
**Scope:** How to optimally use monday.com and Slack, keep both continuously synced to everything Heady does (now and in the future), and how to set up, configure, build, adjust, and operate Heady's Linear + Sentry task management system — including a control surface through the Heady Admin UI portal.

---

## 1. Executive Summary

Heady already has the right bones for a four-layer task management system. This document turns those bones into a fully wired, self-syncing operating model:

| Layer | Tool | Role in Heady |
|---|---|---|
| **Strategic** | monday.com (`headyconnection-company.monday.com`, workspace `16543097`) | Executive dashboard: roadmap, infra ops, integrations registry, nonprofit ops. Read-mostly; updated automatically by the sync hub. |
| **Execution** | Linear (Business plan, `HEA-` team) | Source of truth for engineering tasks. Tied to PR automation (`linear-github-bee`) and error intake (`sentry-linear-bridge`). |
| **Signal** | Sentry (org `headyconnection-inc`, 11 projects) | Error/incident intake. Auto-creates Linear issues, alerts Slack. |
| **Communication** | Slack (`headybuddy-slack` agentic bot) | Human notification layer + conversational control plane (the bot already has `linear-tool.js`, `sentry-tool.js`, `github-tool.js`, `slack-tool.js`). |

The core architectural decision — confirmed in your July 2026 working sessions — is **asymmetric hub-and-spoke sync**: Linear and GitHub remain the execution layer where changes originate; a webhook relay (Cloudflare Worker) receives every Linear/GitHub/Sentry event, then **pushes** updates outbound into monday.com (via GraphQL mutations) and Slack (via `chat.postMessage`). monday.com's webhooks are outbound-only — there is no native inbound listener — so the relay pattern is not just optimal, it is the only robust option.

Everything below is grounded in your actual repos (`HeadyAI/heady-production`, `HeadyAI/headybuddy-slack`, `HeadyAI/Heady-Main-ddb9351d`), your live monday workspace and board IDs, and current (July 2026) official API documentation.

---

## 2. Current State of the Heady Stack

Before configuring anything, know what already exists:

### 2.1 What is already built

- **Linear** — Business plan, active `HEA-` issue stream (e.g., HEA-100, HEA-129–137, HEA-231, HEA-238, HEA-246). Issues are mirrored into `obsidian-vault :: 05_Ops_Daily/Linear/` as markdown. Role: task/issue workflow tied to PR automation.
- **`linear-github-bee.ts`** — automation that creates a branch and opens a PR when a Linear issue moves to **In Progress**. Env: `LINEAR_API_KEY`, `LINEAR_TEAM_ID`.
- **`sentry-linear-bridge.worker.ts`** — Cloudflare Worker that HMAC-verifies the `Sentry-Hook-Signature` header, deduplicates via Workers KV, maps Sentry severity → Linear priority, and auto-creates Linear issues with stack traces.
- **Sentry** — org `headyconnection-inc` with 11 projects; known project `heady-dynamic-sites` (DSN `o4510998791192576.ingest.us.sentry.io/4511070424006656`). Cloud Run initializer (`sentry.ts`) + Workers variant (`sentry-worker.ts`); production traces sampled at 1/φ ≈ 0.618; auth headers stripped before send. Alert-rule automation exists in `heady-production :: scripts/setup-sentry-alerts.js` and a shared package at `heady-production :: packages/heady-sentry`.
- **monday.com** — live workspace `headyconnection-company.monday.com/workspaces/16543097` with four boards: **Product & Engineering Roadmap** (board `18422517079`), **Infrastructure & Cloud Ops**, **Integrations Registry**, and **Nonprofit & Outreach Ops**. The Roadmap board already has `Linear Project ID` and `GitHub Milestone #` columns plus 12 defined mapping rules for Linear/GitHub state transitions.
- **Slack** — `headybuddy-slack` (repo `HeadyAI/headybuddy-slack`): 13-step agentic loop, multi-model router, 384D pgvector memory, and 8 tools including `linear-tool.js` (full Linear GraphQL: list/create/get/update issues) and `sentry-tool.js` (Sentry Web API: list issues, issue details, events).
- **Admin UI** — `HeadyAI/Heady-Main-ddb9351d :: admin-ui/` — an Express + static SPA served on port 8080 with a Dockerfile (Cloud Run-ready), multi-provider `/api/chat` (Groq → OpenAI → Anthropic → Gemini failover), `/health`, and `/api/status` endpoints. This is the seed of the task-management portal (Section 7).

### 2.2 Known gaps to close

1. The **monday relay code is designed but not yet committed** — no `monday` integration files exist in any HeadyAI repo yet (verified by org-wide code search). Section 5 provides the build.
2. `sentry-tool.js` defaults to org slug `heady-ai` while the canonical Sentry org is `headyconnection-inc` — normalize via env var `SENTRY_ORG_SLUG`.
3. The admin/manager surface was flagged in your April 2026 backlog audit for **wildcard CORS** — Section 7.5 includes the hardening fix.
4. The admin UI currently has chat + status only; it needs task-management panels (Section 7.3).

---

## 3. Target Architecture: The Heady Sync Hub

### 3.1 Topology

```
                        ┌────────────────────────────┐
                        │   HEADY SYNC HUB (Worker)   │
                        │  heady-sync-hub.worker.ts   │
  Linear webhooks ─────▶│  /webhooks/linear           │
  GitHub webhooks ─────▶│  /webhooks/github           │───▶ monday.com GraphQL
  Sentry webhooks ─────▶│  /webhooks/sentry           │      (change_multiple_column_values,
                        │                             │       create_item)
                        │  • HMAC verify per source   │
                        │  • KV dedup (idempotency)   │───▶ Slack Web API
                        │  • ID mapping (D1/Neon)     │      (chat.postMessage, Block Kit)
                        │  • Loop-prevention tagging  │
                        │  • Failure → Sentry         │───▶ Linear GraphQL
                        └────────────────────────────┘      (bridge-created issues)
                                    ▲
                                    │ REST/JSON (read + command)
                        ┌───────────┴────────────────┐
                        │  ADMIN UI PORTAL            │
                        │  admin-ui/ on Cloud Run     │
                        │  Task board · Sync health   │
                        │  Error triage · Overrides   │
                        └─────────────────────────────┘
```

- **One receiver, many spokes.** A single hub endpoint that ingests all sources and fans out avoids N² point-to-point integrations and centralizes auth, retries, and logging.
- **Cloudflare Worker as the hub.** Zero servers to patch, scale-to-zero, edge execution, and native Web Crypto HMAC-SHA256 for signature verification; secrets stored via `wrangler secret put`. This matches your existing `sentry-linear-bridge.worker.ts` pattern — the sync hub is its generalization.
- **Relay failures go to Sentry, never block CI** — a deliberate decision from your July session that keeps the strategic layer's availability decoupled from the execution layer's.

### 3.2 Direction-of-truth rules

| Data | Source of truth | Synced to | Direction |
|---|---|---|---|
| Engineering issues, priorities, states | Linear | monday Roadmap board, Slack | One-way outbound |
| Errors, incidents, regressions | Sentry | Linear (issue creation), Slack (alerts) | One-way outbound |
| PRs, releases, milestones | GitHub | Linear (native integration), monday, Slack | One-way outbound |
| Strategic initiatives, quarter goals | monday.com | (manual; optionally Slack digest) | Human-edited |
| Discussion, approvals | Slack | Linear (issue-from-message, thread sync) | Native Linear↔Slack |

Keeping monday **read-mostly** (humans edit strategy rows; machines update status columns) eliminates the hardest sync problem — bidirectional conflict resolution — while still guaranteeing monday always reflects everything Heady is doing. Where limited bidirectionality exists (Linear↔Slack thread sync), it's handled by Linear's native integration, which manages its own loop prevention.

---

## 4. Optimal monday.com Usage

### 4.1 Workspace and board structure

Keep the four-board structure already in workspace `16543097`, organized **by business function** rather than per-project — this is the documented best practice for scale:

1. **Product & Engineering Roadmap** (`18422517079`) — one item per Linear project/epic and per GitHub milestone. This is the board the sync hub writes to.
2. **Infrastructure & Cloud Ops** — Cloud Run services, Cloudflare zones, domains (heady-ai.com, headykey.com, headysystems.com), SSL/DNS status. Feed it from your infra audits (e.g., the expired `headybuddy.com` cert and `apex.headysystems.com` DNS issues found in April belong here as items).
3. **Integrations Registry** — one item per integration (Linear↔GitHub, Sentry↔Linear, hub→monday, hub→Slack) with health status, token rotation dates, and owning repo. This board becomes your integration control inventory.
4. **Nonprofit & Outreach Ops** — Heady Connection nonprofit workflows, kept separate from engineering.

Structural rules:

- **Consistent column names/types across boards** that feed the same dashboard — multi-board widgets require matching columns to aggregate.
- Prefer **timeline/date-range columns** over single deadline dates for Gantt/calendar views.
- Use **folders** to group each initiative's boards + dashboards + docs.
- Keep the **cross-system key columns** on every synced board: `Linear Project ID`, `GitHub Milestone #` (already present on the Roadmap board). These make every item addressable by the sync hub via `items_page_by_column_values` and serve as defense-in-depth if the mapping table is ever lost. **Backfill first**: run a one-off pass matching existing Linear projects/GitHub milestones to existing monday rows via those key columns before enabling live sync, or every existing record will be duplicated as "new."

### 4.2 Recommended columns for the Roadmap board

| Column | Type | Written by |
|---|---|---|
| Item name | Name | Human / hub on create |
| Status | Status (`Backlog / In Progress / In Review / Blocked / Done / Canceled`) | Sync hub (mirrors Linear state) |
| Linear Project ID | Text | Hub on create; human backfill |
| GitHub Milestone # | Text/Number | Hub on create; human backfill |
| Priority | Status (Urgent/High/Medium/Low) | Hub (mirrors Linear priority) |
| Timeline | Timeline | Human (strategic dates) |
| Owner | People | Human |
| Last Synced | Date | Hub on every write |
| Sync Source | Text (e.g., `linear:HEA-231`) | Hub — doubles as the loop-prevention marker |

When writing status values from the hub, address labels by **index, not label text** (`{"status": {"index": 1}}`) — labels can be renamed by admins, indexes cannot.

### 4.3 Dashboards

Build one **Executive Dashboard** over all four boards:

- **Number widgets** — open Linear-mirrored items, items Blocked, errors escalated this week.
- **Chart widgets** — status distribution per board; stacked area of throughput.
- **Battery widget** — % Done per quarter goal.
- **Workload widget** — owner load across boards.

Dashboards and widgets are fully scriptable via `create_dashboard` / `create_widget` mutations (settings blob per widget type; call the `all_widgets_schema` tool first when building programmatically). Keep dashboards under ~30 widgets per view.

### 4.4 Automations (native, in-monday)

Use monday's trigger→action recipes only for **intra-monday** logic; leave cross-tool logic to the sync hub:

- When Status changes to `Blocked` → notify board owner.
- When Status changes to `Done` → move item to a "Shipped" group.
- Cross-board rollups: use **Connect Boards + Mirror columns** to surface Roadmap status inside the Integrations Registry.

### 4.5 monday API essentials (for the hub and any scripts)

- Endpoint: `POST https://api.monday.com/v2`, `Authorization: <token>` (raw token, no Bearer), `Content-Type: application/json`.
- **Pin the API version** with the `API-Version: 2026-07` header. Unpinned requests silently move each quarter.
- **Find items by key column** (the hub's resolve step):

```graphql
query {
  items_page_by_column_values(
    board_id: 18422517079,
    limit: 1,
    columns: [{ column_id: "linear_project_id", column_values: ["<LINEAR_PROJECT_ID>"] }]
  ) { cursor items { id name } }
}
```

Max 500 per page, cursor pagination via `next_items_page`.

- **Update multiple columns atomically**:

```graphql
mutation {
  change_multiple_column_values(
    board_id: 18422517079,
    item_id: <ITEM_ID>,
    column_values: "{\"status\":{\"index\":1},\"last_synced\":{\"date\":\"2026-07-18\"},\"sync_source\":\"linear:HEA-231\"}"
  ) { id }
}
```

`column_values` is a JSON **string** keyed by column ID.

- **Idempotent retries**: send an `Idempotency-Key` header on mutations so a network-timeout retry replays the cached response instead of double-writing.
- **Budgets**: personal tokens share ~10M complexity points/min; app/OAuth tokens get 5M read + 5M write each; hard ceiling of ~40 mutations/min; 429 responses carry `Retry-After`. The hub should queue and coalesce bursts (e.g., a 50-issue Linear bulk edit becomes ≤40 monday mutations/min).
- **Token choice**: start with a dedicated personal API token (Developer Center → API token); graduate to a monday **app + OAuth token** when you want webhooks end-users can't disable and isolated rate budgets.
- **monday → outside world**: if you later want monday edits (e.g., a human re-prioritizing a Roadmap row) reflected in Slack, register a monday **outbound webhook** (`create_webhook` mutation or board Automations Center → Integrations → "webhooks") pointing at the hub's `/webhooks/monday` route; answer the one-time `challenge` echo and verify the HMAC signature. Failed deliveries retry once per minute for 30 minutes.

---

## 5. Optimal Slack Usage

### 5.1 Channel architecture

Adopt a **prefix-scope-topic** naming scheme so channels cluster alphabetically and their purpose is self-evident. Recommended Heady set (keep the prefix dictionary small — 6–15 prefixes max):

| Channel | Purpose | Posting |
|---|---|---|
| `#ops-sync-hub` | Sync hub health: relay failures, dedup anomalies, rate-limit warnings | Bots only |
| `#alerts-sentry` | Curated Sentry alerts (new issue, regression, escalation) | Bots only |
| `#eng-linear` | Linear digest + high-priority real-time events | Bots + threads |
| `#eng-releases` | GitHub releases, deploys, milestone closes | Bots only |
| `#proj-<name>` | Per-initiative discussion (maps to a Linear project / monday item) | Humans |
| `#help-headybuddy` | Talking to the headybuddy-slack agent | Humans |
| `#announce-heady` | Org-wide announcements | Restricted |

Key rules: hyphens not underscores, lowercase, name after the work not people, one clear owner + topic per channel, quarterly hygiene audit. Critically for a sync hub: **separate alert channels from discussion channels**, restrict posting in alert channels to bots, and push follow-up into threads.

### 5.2 Defeating alert fatigue (the #1 failure mode)

Teams that turn on every native Linear→Slack event type report a "notification firehose" that gets muted and ignored. The proven approach:

1. **Start with nothing.** All real-time event types off.
2. **Digest first.** A scheduled daily digest (headybuddy or the hub posting at 9:00 AM MT) summarizing: issues created/completed yesterday, currently Blocked, new Sentry escalations.
3. **Add narrow real-time alerts** only for low-volume, genuinely urgent events: Urgent-priority issue created, issue moved to Blocked, Sentry escalation, deploy failure.
4. **Filter in the hub, not in your head.** The hub forwards only events matching a priority/state allowlist — a middleware filter layer measurably reduces noise versus native unfiltered forwarding.

### 5.3 Message mechanics: webhooks vs Web API

Use **`chat.postMessage` with a bot token** for the hub and headybuddy — incoming webhooks are locked to a single channel at creation, can't edit/delete/thread flexibly, and can't route dynamically. Notes:

- Add the `chat:write.public` scope or invite the bot to each channel.
- Keep `text` under 4,000 chars; >40,000 is truncated — long stack traces go in a snippet/file.
- Rate limits: ~1 message/second/channel (Special tier), workspace-wide ceiling of several hundred/min, 429 + `Retry-After` on breach; sustained abuse can get the app disabled — implement backoff.
- Events API delivery caps at 30,000 events/app/workspace/hour, after which Slack sends `app_rate_limited` — monitor for it.

### 5.4 Block Kit design for task/alert messages

- ≤50 blocks per message; section text ≤3,000 chars; header ≤150 chars; ≤10 fields of ≤2,000 chars.
- **Front-load the verdict** — put severity/state in the header so it survives collapsed previews; keep field values short (mobile wrapping); primary action button near the top; label buttons with the consequence ("Create Linear issue HEA-…"), and gate destructive actions behind confirm dialogs.
- Pair emoji with text, never emoji-only controls; give images `alt_text`.

Example hub alert payload:

```json
{
  "channel": "#alerts-sentry",
  "text": "Sentry escalation: TypeError in heady-dynamic-sites → HEA-312 created",
  "blocks": [
    { "type": "header", "text": { "type": "plain_text", "text": "🔴 ESCALATED — heady-dynamic-sites" } },
    { "type": "section", "fields": [
      { "type": "mrkdwn", "text": "*Error:*\nTypeError: cannot read 'id'" },
      { "type": "mrkdwn", "text": "*Linear:*\n<https://linear.app/heady/issue/HEA-312|HEA-312> (Urgent)" },
      { "type": "mrkdwn", "text": "*Events:*\n47 in 10m" },
      { "type": "mrkdwn", "text": "*Env:*\nproduction" }
    ]},
    { "type": "actions", "elements": [
      { "type": "button", "style": "primary", "text": { "type": "plain_text", "text": "Open in Sentry" }, "url": "https://headyconnection-inc.sentry.io/issues/..." },
      { "type": "button", "text": { "type": "plain_text", "text": "Open HEA-312" }, "url": "https://linear.app/heady/issue/HEA-312" }
    ]}
  ]
}
```

### 5.5 Transport for headybuddy-slack

- **Socket Mode** (outbound WebSocket via `apps.connections.open` with an `xapp-` app-level token, `connections:write` scope) needs no public endpoint and no signature verification — a reasonable default for internal bots, capped at 10 concurrent connections/app.
- **Events API over HTTP** scales horizontally and is Slack's production recommendation — since headybuddy already runs as a hosted service, prefer Events API in production; keep Socket Mode for local dev. The 3-second acknowledgment contract applies to both transports.
- **Workflow Builder** is fine for human no-code flows (intake forms, emoji-triggered routing) but has **no generic HTTP step** — it cannot query Linear/monday or branch on external data, so all cross-tool logic stays in headybuddy/the hub.

### 5.6 headybuddy-slack as conversational control plane

The bot's existing tools make Slack a full read/write surface over the task system: `linear-tool.js` speaks Linear GraphQL (list/create/get/update issues) and `sentry-tool.js` speaks the Sentry Web API. Standardize usage patterns:

- "@HeadyBuddy what's blocked?" → `linear-tool` list with state filter, formatted as Block Kit.
- "@HeadyBuddy create an urgent issue for the SSL cert on headybuddy.com" → `linear-tool` createIssue → the hub then mirrors it to monday automatically.
- "@HeadyBuddy top Sentry issues today" → `sentry-tool` list (set `SENTRY_ORG_SLUG=headyconnection-inc` — the code's default is `heady-ai`).
- Post the 9:00 AM digest from the bot so replies land in one thread.

---

## 6. The Sync Hub: Keeping monday + Slack Synced to Everything Heady Does

This is the build that guarantees both platforms always reflect current and future Heady changes.

### 6.1 Repo and deployment

Create `heady-production/services/heady-sync-hub/` (or a dedicated repo) containing a single Cloudflare Worker with routes:

```
POST /webhooks/linear    ← Linear workspace webhook
POST /webhooks/github    ← GitHub org webhook (milestones, releases, PRs)
POST /webhooks/sentry    ← Sentry Integration Platform webhook
POST /webhooks/monday    ← optional: monday outbound webhook (strategy edits → Slack)
GET  /api/sync/health    ← consumed by Admin UI
GET  /api/sync/events    ← recent relay log, consumed by Admin UI
```

A single Worker branching per path/provider is an explicitly supported pattern. Bind: **KV** (dedup keys), **D1 or Neon Postgres** (ID mapping + event log), secrets via `wrangler secret put`.

### 6.2 Inbound verification (per source)

| Source | Header | Method |
|---|---|---|
| Linear | `Linear-Signature` | Hex HMAC-SHA256 of the **raw** body with the webhook signing secret; also check payload `webhookTimestamp` is within 1 minute (replay guard); optional source-IP allowlist (`35.231.147.226`, `35.243.134.228`, `34.140.253.14`, `34.38.87.206`, `34.134.222.122`, `35.222.25.142`) |
| Sentry | `Sentry-Hook-Signature` | HMAC-SHA256 of raw body with the internal integration's Client Secret, constant-time compare; respond within **1 second** |
| GitHub | `X-Hub-Signature-256` | Standard GitHub HMAC-SHA256 |
| monday | signature header | HMAC verify against signing secret; echo the one-time `challenge` on registration |

Always verify against the **raw** bytes, not a re-stringified parse — re-serialization breaks signatures. ACK fast (200/202), process async.

### 6.3 Idempotency and dedup

- Scope every event ID by source before use: `linear:<id>`, `sentry:<id>`, `github:<delivery-guid>` — provider IDs aren't globally unique.
- Claim atomically: KV/Redis `SET key NX EX <ttl>`; TTL = provider retry window + margin (monday retries 30 min → keep ≥1 day; keep 7 days as a uniform default).
- Make handlers jackpot-safe regardless: **upserts** and **absolute state writes** ("status = Done"), never relative deltas — replays then converge. On the monday side, add the `Idempotency-Key` header.

### 6.4 ID mapping table

Use a **canonical mapping** shape (scales past 3 systems and survives tool replacement) in D1/Neon:

```sql
CREATE TABLE entity_map (
  canonical_id TEXT NOT NULL,          -- e.g. 'heady:proj:auth-fortress'
  system       TEXT NOT NULL,          -- 'linear' | 'monday' | 'github' | 'sentry' | 'slack'
  external_id  TEXT NOT NULL,          -- Linear project UUID, monday item ID, milestone #...
  created_at   TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ,
  deleted_at   TIMESTAMPTZ,            -- soft delete only
  UNIQUE (system, external_id)
);
```

Flow per event: **resolve** (look up mapping → update path) or **create** (make the monday item, then persist the mapping **before** anything else reads it); treat unique-constraint violations on insert as "already mapped," closing the duplicate-creation race. Defense in depth: also write the foreign key into each side's own record — the `Linear Project ID` column on monday, and a `monday:<item_id>` label/attachment on the Linear project — so the table can be rebuilt if lost. **Backfill first**: run a one-off pass matching existing Linear projects/GitHub milestones to existing monday rows via those key columns before enabling live sync, or every existing record will be duplicated as "new."

### 6.5 Loop prevention

Every hub write is tagged (`Sync Source` column on monday = `linear:HEA-231`; bridge-created Linear issues carry a `sentry-bridge` label). If monday outbound webhooks are enabled, the `/webhooks/monday` handler short-circuits when the changed item's `Sync Source` marks the hub's own recent write; similarly, inspect Sentry's `actor` field to skip self-caused events.

### 6.6 The 12 mapping rules (Linear/GitHub → monday Roadmap)

Codify the rules defined in your July session as a declarative table in the hub:

| # | Trigger | monday action (board 18422517079) |
|---|---|---|
| 1 | Linear project created | `create_item` + write `Linear Project ID` + mapping row |
| 2 | Linear project state → started | Status → `In Progress` |
| 3 | Linear project state → paused | Status → `Blocked` |
| 4 | Linear project state → completed | Status → `Done` |
| 5 | Linear project state → canceled | Status → `Canceled` |
| 6 | Linear epic/issue priority → Urgent | Priority → `Urgent` + Slack `#eng-linear` real-time alert |
| 7 | Linear issue → Blocked (any project) | Roll up: parent item Status → `Blocked` |
| 8 | GitHub milestone created | `create_item` + write `GitHub Milestone #` |
| 9 | GitHub milestone 100% / closed | Status → `Done` |
| 10 | GitHub release published | Post to `#eng-releases`; stamp `Last Synced` |
| 11 | Sentry escalation on mapped project | Priority → `Urgent`; Slack `#alerts-sentry` |
| 12 | Any hub write | `Last Synced` = now, `Sync Source` = scoped event ID |

### 6.7 Rate-limit isolation and failure routing

- Per-spoke throttles so a bulk Linear edit can't exhaust monday's 40 mutations/min or Slack's 1 msg/sec/channel — queue and coalesce.
- All relay exceptions → Sentry project `heady-sync-hub` (create it under `headyconnection-inc`), wrapped with `packages/heady-sentry`. Never fail the inbound ACK because an outbound spoke is down; enqueue and retry with backoff.

---

## 7. Heady's Linear + Sentry Task Management System: Setup, Configuration, Build, and Adjustment

This section is the operating manual for the execution core.

### 7.1 Linear setup and configuration

**Workspace structure**

- Keep one primary team (`HEA` prefix) as the engineering execution stream. Add teams only when a stream needs different workflows (e.g., `NPO` for nonprofit ops) — Linear projects, not teams, should map to monday Roadmap items.
- Workflow states: `Backlog → Todo → In Progress → In Review → Done` plus `Blocked` and `Canceled` — these align 1:1 with the monday Status labels in Section 4.2 and the mapping rules in 6.6.
- Use **projects** for multi-issue initiatives and **labels** for cross-cutting concerns (`sentry-bridge`, `security`, `infra`, `admin-ui`). Bridge-created issues always get `sentry-bridge`.

**API access**

- Endpoint `https://api.linear.app/graphql`; personal API keys are created under Security & access settings and sent as `Authorization: <key>` (no Bearer prefix).
- Store the key as `LINEAR_API_KEY` (already the convention in `linear-github-bee` and `headybuddy-slack`), plus `LINEAR_TEAM_ID`.
- Gotcha: a 200 response can still carry an `errors` array — check it explicitly. Avoid per-issue polling; batch queries or use webhooks — Linear rate-limits naive pollers.

**Webhooks**

- Create one workspace webhook → `https://<hub>/webhooks/linear`, scoped to issue, project, and comment events. Save the signing secret as `LINEAR_WEBHOOK_SECRET`; verify per Section 6.2.
- The payload `actor` distinguishes User vs Integration — use it to skip events caused by the hub's own writes.

**Native integrations (turn all three on)**

1. **GitHub** — Linear Settings → Features → Integrations → GitHub → Enable; requires a GitHub **org owner** on `HeadyAI` to install; grant repo access to `heady-production`, `Heady-Main-ddb9351d`, `headybuddy-slack`. Gives PR↔issue linking with automatic state transitions and forward-only issue sync. Magic words in PR descriptions ("Fixes HEA-231") drive statuses; this replaces most of what `linear-github-bee` does manually — keep the bee for the custom branch-creation flow, let the native integration own status sync.
2. **Slack** — Linear Settings → Integrations → Slack → connect, then map the HEA team to `#eng-linear`; enable issue-creation-from-message and thread syncing; restrict "create from Slack" to approved members via Advanced Options; per Section 5.2, enable only Urgent/Blocked real-time notifications.
3. **Sentry** — enable from Linear workspace settings; supports creating Linear issues from Sentry exceptions and auto-creation from alerts; note it does **not** work with private Linear teams.

### 7.2 Sentry setup and configuration

**Org and projects**

- Canonical org: `headyconnection-inc` (11 projects). Normalize every tool to `SENTRY_ORG_SLUG=headyconnection-inc` — including `headybuddy-slack/src/tools/sentry-tool.js`, whose hardcoded default is `heady-ai`.
- One Sentry project per deployable service (`heady-dynamic-sites`, `heady-sync-hub`, `heady-admin-ui`, `headybuddy-slack`, …). Initialize Cloud Run services with `packages/heady-sentry` / `sentry.ts`, Workers with `sentry-worker.ts`; keep the 1/φ ≈ 0.618 trace sample rate in production and the auth-header scrubbing you already standardized.

**Alert rules (managed as code)**

Extend `scripts/setup-sentry-alerts.js` so every project gets a standard rule set:

- **New issue** in production env → Slack `#alerts-sentry` (filters: level ≥ error).
- **Regression** (resolved → unresolved) → Slack + Linear.
- **Escalation** → action "Notify Integration → Linear" (auto-creates a Linear issue) + Slack. Triggers combine as ANY; filters as ANY/ALL — keep filters tight.

**Native integrations**

1. **Slack** — Settings → Integrations → Slack → Add Workspace (OAuth); invite `@sentry` to private channels; alert actions pick workspace + channel; error alerts get interactive Resolve/Archive/Assign buttons in Slack; link identities with `/sentry link`, route team alerts with `/sentry link team headyconnection-inc`.
2. **Linear** — Settings → Integrations → Linear (requires Owner/Manager/Admin); then alert action "Notify Integration → Linear" for auto-creation, and the "Linked Issues" panel for ad-hoc linking.

**Internal integration for the hub**

Create one **internal integration** (Settings → Developer Settings) named `heady-sync-hub`: no OAuth flow needed, token issued instantly, up to 20 tokens, no auto-expiry. Subscribe webhooks to `issue`, `event_alert`, `metric_alert`, `error` and point them at `/webhooks/sentry`; verify `Sentry-Hook-Signature`; respond <1s.

### 7.3 Choosing native vs bridge per flow (adjustment guide)

| Flow | Use native | Use hub/bridge |
|---|---|---|
| Sentry → Linear issue creation | ✅ default (alert action) | When you need severity→priority mapping, KV dedup, custom stack-trace formatting → keep `sentry-linear-bridge.worker.ts` |
| Linear ↔ GitHub PR status | ✅ native integration | Keep `linear-github-bee` only for auto-branch/PR scaffolding |
| Linear → Slack | ✅ native, minimal event types | Hub filters for digest + allowlist alerts |
| Anything → monday | ❌ (no adequate native path) | ✅ hub only |
| Sentry → Slack | ✅ native alert actions | Hub only if you need cross-referencing (e.g., attach the HEA link in the same message) |

Rule of thumb: **native for pairwise convenience, hub for anything that needs the mapping table, dedup, filtering, or monday.**

### 7.4 Environment variables and secrets reference

Store in HeadyVault / Google Secret Manager / `wrangler secret put` — never in code:

| Variable | Used by |
|---|---|
| `LINEAR_API_KEY`, `LINEAR_TEAM_ID`, `LINEAR_WEBHOOK_SECRET` | hub, linear-github-bee, headybuddy |
| `SENTRY_ORG_SLUG=headyconnection-inc`, `SENTRY_AUTH_TOKEN`, `SENTRY_CLIENT_SECRET` | hub, headybuddy, setup scripts |
| `MONDAY_API_TOKEN`, `MONDAY_ROADMAP_BOARD_ID=18422517079`, `MONDAY_WORKSPACE_ID=16543097` | hub, admin UI |
| `SLACK_BOT_TOKEN` (xoxb-), `SLACK_SIGNING_SECRET`, `SLACK_APP_TOKEN` (xapp-, dev only) | hub, headybuddy |
| `GITHUB_WEBHOOK_SECRET` | hub |
| `ADMIN_UI_SESSION_SECRET`, `ALLOWED_ORIGINS` | admin UI |

---

## 8. The Admin UI Portal: Task Management Control Plane

### 8.1 What exists today

`HeadyAI/Heady-Main-ddb9351d :: admin-ui/` is an Express server (port 8080, Dockerfile included — Cloud Run-ready) serving a static SPA with:

- `POST /api/chat` — HeadyBuddy chat w/ provider failover
- `GET /api/status` — provider readiness, uptime, memory
- `GET /health` — health probe

### 8.2 Target: the wrap-all control surface

Extend the same server into the single pane of glass over the entire task system:

```
admin-ui/
├── server.js               # existing + new routers below
├── routes/
│   ├── tasks.js            # Linear proxy  (GraphQL via LINEAR_API_KEY)
│   ├── errors.js           # Sentry proxy  (Web API via SENTRY_AUTH_TOKEN)
│   ├── roadmap.js          # monday proxy  (GraphQL via MONDAY_API_TOKEN)
│   ├── sync.js             # hub health/log proxy (GET /api/sync/*)
│   └── actions.js          # write actions w/ confirmation
└── public/                 # SPA panels
```

**Panels and their backing endpoints**

| Panel | Shows | Backed by |
|---|---|---|
| **Task Board** | HEA issues by state, priority, assignee; click-through to Linear | `GET /api/tasks?state=&priority=` → Linear GraphQL (reuse `linear-tool.js` — it's dependency-light and already production-grade) |
| **Error Triage** | Top unresolved Sentry issues across all 11 projects, event counts, links to mapped HEA issues | `GET /api/errors` → Sentry Web API (reuse `sentry-tool.js` with corrected org slug) |
| **Roadmap** | monday Roadmap rows w/ Status, Priority, Last Synced | `GET /api/roadmap` → `items_page` on board 18422517079 |
| **Sync Health** | Relay event log, dedup hits, per-spoke rate-limit headroom, last failure | `GET /api/sync/health` + `/api/sync/events` from the hub |
| **Actions** | Create issue, escalate, force re-sync an entity, trigger backfill | `POST /api/actions/*` → writes through the hub (so mapping/tagging stays consistent — never write monday directly from the UI) |
| **HeadyBuddy Chat** | Existing chat, now with task context | existing `/api/chat`, system prompt extended with live task summaries |

Design rule: the Admin UI **reads from each system but writes only through the hub**, so every mutation gets the same loop-prevention tagging, mapping-table persistence, and Sentry-reported failure handling.

### 8.3 Build steps

1. Add the four read routers as thin proxies (copy `linearRequest`/`sentryGet` helpers from headybuddy's tools).
2. Add server-side caching (60s TTL) per panel to stay far inside Linear/monday/Sentry rate budgets.
3. Add `POST /api/actions/create-issue` → hub → Linear `issueCreate` mutation → hub mirrors to monday → hub posts Slack confirmation. One action, three systems, guaranteed consistent.
4. Build the SPA panels (vanilla or lightweight framework) against those endpoints; auto-refresh Sync Health every 30s.
5. Wire the Sentry SDK (`packages/heady-sentry`) into `server.js` itself — the control plane must report its own errors.

### 8.4 Deployment

- Build the container from the existing `admin-ui/Dockerfile`, deploy to Cloud Run (`heady-admin-ui` service), min-instances 0–1.
- Front with Cloudflare: DNS `admin.heady-ai.com` (or `admin.headysystems.com`), proxied, with **Cloudflare Access** in front so only your identity can reach it.

### 8.5 Security hardening

1. **Kill wildcard CORS** — replace with an explicit allowlist from `ALLOWED_ORIGINS` and enable credentials only for those origins.
2. **AuthN before Express** — Cloudflare Access (JWT validated in middleware) or OIDC session; no anonymous access to any `/api/*` route.
3. **Scope tokens** — the UI's Linear/Sentry/monday tokens should be dedicated (rotate independently; log usage in the Integrations Registry board).
4. **Confirmation on writes** — every `POST /api/actions/*` requires an explicit confirm step in the UI; destructive actions double-confirm.
5. **Audit log** — append every action (who, what, when, hub event ID) to the same D1/Neon event log the hub uses.

---

## 9. Rollout Sequence

Ordered so each step is independently verifiable:

1. **Normalize secrets** — create/rotate tokens; register all in HeadyVault + Integrations Registry board.
2. **Backfill the mapping table** — one-off script matching Linear projects & GitHub milestones to monday Roadmap rows; insert `entity_map` rows.
3. **Deploy the sync hub** — Worker w/ Linear + GitHub + Sentry routes, dedup, mapping, monday + Slack outbound.
4. **Enable native integrations** — Linear↔GitHub, Linear↔Slack, Sentry↔Slack, Sentry↔Linear.
5. **Turn on digests** — 9:00 AM MT daily digest to `#eng-linear` via headybuddy.
6. **Extend the Admin UI** — read panels first, then hub-routed actions, then Cloudflare Access + CORS fix.
7. **Add monday outbound webhook (optional)** — only after loop-prevention markers are confirmed working in production for a week.
8. **Operate** — weekly: check Sync Health; monthly: token rotation; quarterly: pin new monday version, Slack channel hygiene audit, alert-noise review.

---

## 10. Failure Modes & Operations Cheatsheet

| Symptom | Likely cause | Fix |
|---|---|---|
| monday item not updating | Mapping row missing | Backfill script |
| Duplicate monday items | Create-path race or backfill skipped | Unique constraint on `entity_map(system, external_id)` |
| Slack messages dropped | 429 during bursts | Hub queue + digest coalescing |
| monday mutations failing | 40 mutations/min ceiling | Queue with per-spoke throttle; `Idempotency-Key` |
| Webhook signature failures | Body re-serialization or rotated secret | Verify raw bytes; redeploy wrangler secret |
| Sentry webhook timeouts | Handler exceeds 1s before ACK | ACK immediately, process via queue |
| Sync silently stale | Webhook deleted/disabled | Sync Health panel checks last-event age |
| Echo loops on monday outbound | Missing `Sync Source` short-circuit | Check tag before relaying |
