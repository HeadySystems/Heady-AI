# Feature Spec: Permission Graph and Delegation Vault

**Feature ID:** HEADY-FEAT-001  
**Domain:** headysystems.com / headyme.com  
**Status:** Draft  
**Author:** Eric Haywood  
**Date:** 2026-03-17  
**Version:** 1.0

---

## 1. Problem Statement

Heady's growing surface area — spanning companion AI, browser automation, IDE actions, connector integrations, and multi-model routing — creates an increasingly complex trust boundary problem. Users have no unified, auditable model for which agents, skills, connectors, or services are permitted to do what on their behalf. Without explicit, versioned permission grants, users face silent over-authorization, accidental data leakage across context boundaries, and no way to revoke delegated access without destroying an entire integration.

The absence of a structured delegation layer forces users to rely on implicit trust inherited from account-level auth tokens, which cannot represent time-bound, scope-limited, or condition-gated permissions. This is both a security risk and a user experience failure: there is no single place to see, modify, or revoke what the AI ecosystem can do on your behalf.

**Who experiences this:** All Heady users who connect external services, run automations, or use HeadyBuddy in agentic or autonomous modes. Most acute for power users managing 5+ integrations.

**Cost of not solving it:** Unauthorized or overly broad agent actions, broken trust in agentic AI, regulatory exposure under GDPR/CCPA delegation rules, and inability to achieve enterprise adoption.

---

## 2. Goals

| Goal | Measurement | Target |
|---|---|---|
| Users can see all active permission grants in one surface | % users who view permission dashboard within 7 days of first connector auth | ≥ 60% |
| Users can create scoped, time-limited delegation tokens | Delegation token creation events per active user/month | ≥ 2 per active user |
| Zero unauthorized agent actions cross context boundary | Agent-action policy violation rate | < 0.01% of actions |
| Permissions can be revoked in ≤ 3 interactions | Task completion rate for "revoke permission" scenario | ≥ 95% |
| Audit log is complete and exportable | % of delegated actions present in exportable log | 100% |

---

## 3. Non-Goals

- **Not an OAuth provider replacement.** The Vault holds and annotates delegation records; it does not replace standard OAuth flows for first-party connector authentication.
- **Not a billing or subscription gate.** Permission tiers may exist but the Vault itself is not a monetization surface in v1.
- **Not multi-tenant enterprise RBAC.** Organization-wide role hierarchies are out of scope; this serves individual and small-team contexts in v1.
- **Not real-time threat detection.** Anomaly detection on permission usage is a future capability; v1 is declarative and audit-focused.
- **Not a password manager.** Credentials themselves are stored in existing secure vaults (e.g., Cloudflare Secrets, system keychain); this manages what those credentials are authorized to do.

---

## 4. User Stories

### Core Delegation

- **As a Heady user**, I want to see every service, agent, and skill that has been granted access to act on my behalf, so that I know what my AI ecosystem can do without asking me.
- **As a Heady user**, I want to create a scoped delegation token that limits an agent to read-only access on a specific connector for 24 hours, so that I can run an automation without exposing permanent write access.
- **As a Heady user**, I want to revoke a specific delegation grant instantly, so that I can cut off an agent's access the moment I no longer need it or trust it.
- **As a Heady user**, I want to set conditional permissions (e.g., "allow this skill to send email only if the subject matches my approval"), so that I can run semi-autonomous agents with guardrails.

### Delegation Review and Audit

- **As a Heady user**, I want to see a time-ordered log of every action taken under each delegation grant, so that I can audit what my agents did on my behalf.
- **As a Heady user**, I want to export my full permission audit log as JSON or CSV, so that I can retain records for compliance or personal review.
- **As a HeadyBuddy user running agentic sessions**, I want Buddy to request permission escalation explicitly and wait for my approval before taking an action outside its current grant, so that I am never surprised by autonomous actions.

### Developer / Power User

- **As a developer using HeadyIO**, I want to define permission schemas for skills I publish so that users know exactly what access my skill requires before installation, so that my skill can be trusted and adopted.
- **As a developer**, I want to receive a structured permission-check response when my skill requests an out-of-scope action, so that I can handle graceful degradation cleanly.

---

## 5. Requirements

### P0 — Must Have

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| PGV-001 | Permission Graph data model representing subjects (agents/skills/connectors), objects (services/data scopes), and grants (conditions, expiry, scope) | Given a new connector auth, When it is linked to an agent, Then a permission edge is created in the graph with explicit scope and expiry |
| PGV-002 | Delegation Vault UI: a single page listing all active grants grouped by subject (agent/skill) | Given any active grant exists, When the user opens the Vault, Then all grants are visible with subject, scope, expiry, and last-used timestamp |
| PGV-003 | Revocation: any grant can be individually revoked with one confirmation | Given a grant is displayed, When the user selects "Revoke", Then the grant is invalidated within 500ms and all subsequent actions using that grant return a permission-denied error |
| PGV-004 | Time-bound grants: all grants have an explicit expiry (max 90 days; default 7 days) | Given a grant is created without explicit expiry, Then the system applies a 7-day default and displays the expiry to the user |
| PGV-005 | Scope-limited grants: grants carry explicit action scopes (read, write, execute, delete) per resource type | Given a skill requests a write action under a read-only grant, Then the action is rejected and an audit entry is created |
| PGV-006 | Audit log: every action taken under a delegation is recorded with timestamp, subject, object, action type, and outcome | Given an agent completes an action under a delegation, Then within 2 seconds the action appears in the audit log |
| PGV-007 | Permission escalation request: agents can request expanded scope; user receives notification and must approve or deny | Given an agent requests out-of-scope access, When the user has not pre-approved, Then execution is paused and a permission request is surfaced to the user |

### P1 — Should Have

| ID | Requirement |
|---|---|
| PGV-008 | Conditional grants: allow permission conditions expressed as simple predicates (e.g., file type = PDF, email domain = trusted) |
| PGV-009 | Delegation templates: pre-built grant configurations for common patterns (research-only, draft-and-review, read-calendar) |
| PGV-010 | Audit log export: JSON and CSV export of full or filtered audit log |
| PGV-011 | Push notification when a grant is 24h from expiry |
| PGV-012 | Per-skill required-permission manifest visible in Skill Foundry install flow |

### P2 — Future Consideration

| ID | Requirement |
|---|---|
| PGV-013 | Anomaly detection: flag agents that use significantly more permissions than baseline |
| PGV-014 | Organization-level permission policies for team accounts |
| PGV-015 | Cross-device sync of permission revocations in < 5 seconds |

---

## 6. User Experience

### Permission Vault Dashboard

```
┌─────────────────────────────────────────────────────────┐
│  HEADY PERMISSION VAULT                        [+ New]  │
│─────────────────────────────────────────────────────────│
│  ACTIVE GRANTS (12)                    Filter ▼  Sort ▼ │
│                                                          │
│  ○ HeadyBuddy Research Mode                             │
│    Scopes: gmail:read, drive:read, calendar:read        │
│    Expires: 2026-03-24  Last used: 2 hours ago  [Revoke]│
│                                                          │
│  ○ Draft-Email Skill                                    │
│    Scopes: gmail:write(draft)                           │
│    Expires: 2026-04-01  Last used: 5 days ago   [Revoke]│
│                                                          │
│  ○ Code-Review Agent (HeadyAI-IDE)                     │
│    Scopes: github:read, github:pr:comment               │
│    Expires: 2026-03-18  Last used: 1 hour ago   [Revoke]│
│                                                          │
│  [View Audit Log]  [Export]  [Manage Templates]         │
└─────────────────────────────────────────────────────────┘
```

### Grant Creation Flow

1. Trigger: user installs skill, authorizes automation, or Buddy requests delegation
2. Scope selection: checkboxes per resource type × action type
3. Expiry picker: preset options (1 day / 7 days / 30 days / custom)
4. Optional conditions: add predicates via simple form
5. Confirmation summary before creation
6. Vault updated immediately; agent receives grant token

### Permission Escalation UX

- Agent execution pauses mid-task
- Notification appears: "HeadyBuddy wants to [action] — this requires [new scope]. Approve for [duration]?"
- User can: Approve once / Approve for session / Approve and save / Deny
- If denied, agent receives structured error and can surface graceful message to user

---

## 7. Architecture

### Core Components

```
┌──────────────────────────────────────────────────────────┐
│                     Heady Permission Graph               │
│                                                          │
│  ┌─────────────┐     ┌──────────────┐    ┌───────────┐  │
│  │  Subject    │────▶│  Grant Node  │───▶│  Object   │  │
│  │  (Agent /   │     │  {scope,     │    │  (Service/│  │
│  │   Skill /   │     │   expiry,    │    │   Data /  │  │
│  │   Connector)│     │   conditions │    │   Action) │  │
│  └─────────────┘     └──────────────┘    └───────────┘  │
│                             │                            │
│                      ┌──────▼──────┐                    │
│                      │  Audit Log  │                    │
│                      │  (append-   │                    │
│                      │   only)     │                    │
│                      └─────────────┘                    │
└──────────────────────────────────────────────────────────┘
```

### Data Model

**Grant Node**
```json
{
  "grant_id": "uuid",
  "subject_type": "skill | agent | connector | session",
  "subject_id": "string",
  "owner_user_id": "string",
  "scopes": [
    { "resource": "gmail", "actions": ["read"] },
    { "resource": "drive", "actions": ["read"] }
  ],
  "conditions": [
    { "field": "file.mime_type", "op": "in", "value": ["application/pdf"] }
  ],
  "created_at": "ISO8601",
  "expires_at": "ISO8601",
  "revoked_at": "ISO8601 | null",
  "last_used_at": "ISO8601 | null",
  "grant_metadata": { "template_id": "string | null", "created_by": "user | agent" }
}
```

**Audit Entry**
```json
{
  "entry_id": "uuid",
  "grant_id": "uuid",
  "timestamp": "ISO8601",
  "subject_id": "string",
  "action": "read | write | execute | delete",
  "resource_type": "string",
  "resource_id": "string | null",
  "outcome": "allowed | denied | escalated",
  "context_snapshot": { "session_id": "string", "task_id": "string | null" }
}
```

### Storage and Backend

| Layer | Technology |
|---|---|
| Graph store | Cloudflare D1 (SQLite-compatible) with edge-local reads |
| Audit log | Cloudflare R2 (append-only object store per user) |
| Grant token issuance | Cloudflare Workers (stateless JWT with embedded scope claims) |
| Revocation propagation | Cloudflare Durable Objects for real-time invalidation state |
| UI surface | headyme.com (React, fetched via headyapi.com) |

### Data Flows

**Grant Creation:**
```
User action → headyme.com UI → POST /api/grants → Cloudflare Worker
→ Validate scope request → Write Grant Node to D1
→ Issue JWT grant token to requesting agent
→ Return success + grant summary to UI
```

**Agent Action Check:**
```
Agent invokes action → headymcp.com MCP layer
→ Extract grant token from request context
→ Worker validates token: expiry, scope, conditions
→ If valid: allow + write audit entry to R2
→ If invalid scope: reject + write audit entry + optionally emit escalation event
→ If escalation: pause agent, emit notification to headyme.com
```

**Revocation:**
```
User clicks Revoke → PATCH /api/grants/{id}/revoke → Worker
→ Update D1 grant record (revoked_at = now)
→ Durable Object broadcasts invalidation to all active sessions
→ Subsequent token checks for this grant_id return denied immediately
```

---

## 8. Security and Privacy

| Concern | Mitigation |
|---|---|
| Grant token theft | Short-lived JWTs (max 1 hour); bound to session fingerprint |
| Audit log tampering | R2 append-only writes; signed entries with HMAC; user-owned bucket |
| Scope creep via agent | Strict whitelist: agents cannot self-modify their grant; all scope changes require user approval |
| Cross-user data leakage | Grant nodes are user-scoped; all queries include `owner_user_id` predicate |
| Condition bypass | Conditions are evaluated server-side in the Worker, never by the agent itself |
| GDPR/CCPA compliance | Full audit log exportable by user; grant data deletable on account deletion; no cross-user grant visibility |
| Orphaned grants | Automated expiry enforcement; nightly job purges expired grants from active index |

---

## 9. Dependencies

| Dependency | Owner | Risk |
|---|---|---|
| Cloudflare Workers + D1 | Infrastructure | Low — already in use |
| Cloudflare Durable Objects (revocation state) | Infrastructure | Medium — requires DO quota planning |
| headymcp.com MCP request interceptor | HeadySystems | High — must be implemented before grant enforcement |
| headyme.com UI shell | HeadyMe | Medium — Vault page is a new route |
| HeadyBuddy permission escalation hook | HeadyBuddy | High — agent must support pause-and-request flow |
| HeadyIO skill manifest schema | HeadyIO | Medium — required for P1 skill permission manifest |

---

## 10. Phased Rollout

### Phase 1 — Foundation (Weeks 1–4)
- Grant data model and D1 schema
- JWT grant token issuance in Cloudflare Workers
- Audit log writes to R2
- Basic Vault UI: view and revoke grants
- Manual grant creation for connector auth flows

### Phase 2 — Enforcement (Weeks 5–8)
- MCP layer interceptor: validate grant on every agent action
- Permission escalation request flow (pause + notify + approve/deny)
- Automated expiry enforcement
- Audit log export (JSON/CSV)

### Phase 3 — Intelligence (Weeks 9–14)
- Conditional grants (predicate conditions)
- Delegation templates
- Per-skill permission manifest in install flow
- Push notifications for expiring grants

### Phase 4 — Scale (Weeks 15+)
- Cross-device revocation propagation via Durable Objects
- Anomaly detection baseline
- Organization/team permission policies (enterprise track)

---

## 11. Success Metrics

| Metric | Baseline | Target (30 days post-launch) |
|---|---|---|
| Permission Vault DAU / total DAU | 0% | ≥ 30% |
| Delegated action policy violation rate | n/a | < 0.01% |
| Mean time to revoke a grant | n/a (manual) | < 15 seconds |
| Agent escalation request resolution rate | n/a | ≥ 85% resolved within 5 minutes |
| Audit log export usage | 0 | ≥ 10% of active users export within 60 days |

---

## 12. Open Questions

| Question | Owner | Blocking? |
|---|---|---|
| Should grant tokens be passed via MCP context headers or request body? | HeadySystems / MCP | Yes — must decide before Phase 2 |
| What is the maximum number of concurrent active grants per user in v1? | Engineering | No — set a generous limit; tune later |
| Do conditional grants require a DSL or is a simple predicate schema sufficient? | Product / Engineering | No — predicate schema preferred for v1 |
| How are grants handled when a skill is uninstalled? | Product | No — auto-revoke on uninstall is assumed |
| What audit log retention period should be enforced? | Legal / Product | No — 365 days default, user-configurable |
