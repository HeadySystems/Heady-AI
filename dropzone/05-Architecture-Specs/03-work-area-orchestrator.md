# Feature Spec: Work-Area Orchestrator for Android/Desktop Isolation

**Feature ID:** HEADY-FEAT-003  
**Domain:** headyme.com / headysystems.com / headybot.com  
**Status:** Draft  
**Author:** Eric Haywood  
**Date:** 2026-03-17  
**Version:** 1.0

---

## 1. Problem Statement

Heady users operate across multiple contexts simultaneously: a personal project, a client engagement, a research thread, and daily operations may all be active at once. Today there is no concept of an isolated "work area" — all Heady agent activity, connector access, history, and AI context bleeds across every interaction. A question about a client project can surface memory and context from a personal hobby project. An automation triggered for one context can access connectors scoped to another.

On Android and desktop, this creates a compounding problem: users cannot switch between work contexts cleanly without either manually re-establishing context or risking cross-contamination of sensitive information between contexts (e.g., work vs. personal, client A vs. client B).

**Who experiences this:** Power users running parallel workstreams; professionals with client or confidentiality boundaries; users who want to separate personal AI use from professional use on the same device.

**Cost of not solving it:** Context contamination reduces AI accuracy; users lack confidence in agentic automation; Heady cannot serve professionals with confidentiality obligations; no competitive differentiation against single-context AI tools.

---

## 2. Goals

| Goal | Measurement | Target |
|---|---|---|
| Users can create and switch work areas in ≤ 5 interactions | Task completion rate for "create work area + switch" | ≥ 90% |
| Context bleed between work areas is zero by default | Cross-area memory/context bleed incidents | 0 in QA; < 0.001% in production |
| Agent connectors are scoped to the active work area | % of agentic actions correctly scoped to current area | 100% |
| Users report cleaner task separation | Post-switch user satisfaction score | ≥ 4.2/5 |
| Work area state persists across device restarts | State restoration success rate | ≥ 99.5% |

---

## 3. Non-Goals

- **Not a multi-user account system.** Work areas are per-user context partitions, not separate accounts.
- **Not a virtual machine or OS-level sandbox.** Isolation is at the Heady application data layer, not at OS process level.
- **Not a billing boundary.** Work areas do not map to separate subscription plans in v1.
- **Not a team workspace.** Sharing a work area with other users is out of scope for v1.
- **Not a file system partition.** Work areas do not physically separate file storage; they scope references and access patterns.

---

## 4. User Stories

### Work Area Creation and Management

- **As a Heady power user**, I want to create named work areas (e.g., "Client: Acme", "Personal", "Side Project: Heady"), so that my AI context, connectors, and history are cleanly separated.
- **As a mobile user on Android**, I want to switch my active work area from a persistent UI element, so that I can context-switch in one tap without navigating menus.
- **As a desktop user**, I want keyboard shortcuts to switch between work areas, so that I can shift contexts as quickly as switching browser tabs.
- **As a Heady user**, I want to archive a completed work area without deleting it, so that I can preserve its history while keeping my active areas list clean.

### Isolation and Access Control

- **As a Heady user**, I want each work area to have its own set of active connectors, so that my personal Gmail is not accessible from my client work area.
- **As a Heady user**, I want the Memory Ledger to be scoped per work area, so that memories from one context do not bleed into another.
- **As a HeadyBuddy user**, I want Buddy's conversation history to be isolated per work area, so that switching areas feels like a genuine context reset.
- **As a Heady user running automations**, I want automations and agents in one work area to be unable to read or write resources from another work area, so that I have hard isolation guarantees.

### Cross-Area Visibility (Controlled)

- **As a Heady user**, I want to optionally promote a specific memory or resource to "global" so that it is visible across all work areas, so that I can share universal preferences without duplicating them.
- **As a Heady user**, I want a unified activity view that shows recent activity across all work areas with clear labeling, so that I can track what is happening everywhere from one surface.

---

## 5. Requirements

### P0 — Must Have

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| WAO-001 | Work area entity: named, color-coded, with icon; stored per user | Given a user creates a work area with a name, Then it is persisted and appears in the area switcher |
| WAO-002 | Active area context: all agent actions, memory retrieval, and history queries are scoped to the currently active area | Given area A is active, When an agent runs, Then it only accesses connectors and memory scoped to area A |
| WAO-003 | Connector scoping: connectors can be assigned to one or more work areas; by default, new connectors are area-specific | Given connector Gmail-Work is assigned to area "Work", Then it is not accessible from area "Personal" |
| WAO-004 | Memory scoping: Memory Ledger entries are tagged with the area they were created in; retrieval filters by active area | Given memory M was created in area A, When area B is active, Then memory M is not injected into prompts |
| WAO-005 | Conversation history isolation: conversation history per surface (Buddy, IDE, Web) is per work area | Given user switches from area A to area B, Then conversation history view shows area B history only |
| WAO-006 | Area switcher UI: persistent element on Android and desktop showing current area with one-tap/click switch | Given any Heady surface, When user taps/clicks the area switcher, Then a list of areas is shown and selection takes effect immediately |
| WAO-007 | Default area: new users have a "Default" work area pre-created; all activity goes there until additional areas are created | Given a new user, Then a Default work area exists and is active |

### P1 — Should Have

| ID | Requirement |
|---|---|
| WAO-008 | Area templates: pre-built area configurations (Client Work, Personal, Research) with suggested connector sets and memory categories |
| WAO-009 | Global memories and resources: specific memories or connectors can be flagged as "global" and accessible from all areas |
| WAO-010 | Cross-area activity feed: a unified view of recent activity labeled by area |
| WAO-011 | Area archiving: completed areas can be archived (read-only, removed from switcher) |
| WAO-012 | Area-level permission grants: work areas inherit the Permission Vault grants assigned to them (integration with HEADY-FEAT-001) |
| WAO-013 | Quick-switch keyboard shortcut on desktop (Cmd/Ctrl + number key per area) |

### P2 — Future Consideration

| ID | Requirement |
|---|---|
| WAO-014 | Android system-level work profile integration (Android Work Profile API) |
| WAO-015 | Area sharing/collaboration for team workspaces |
| WAO-016 | Automatic area detection based on calendar context or active app |

---

## 6. User Experience

### Area Switcher (Mobile)

```
┌─────────────────────────────┐
│  ● Heady          [▼ WORK]  │   ← Area badge always visible
│─────────────────────────────│
│  [Switch Area]              │
│  ○ Default          [recent]│
│  ● Work: Acme       [active]│
│  ○ Personal                 │
│  ○ Side Project: Heady      │
│  [+ New Area]               │
└─────────────────────────────┘
```

### Area Configuration Panel

```
┌─────────────────────────────────────────────────────────┐
│  WORK AREA: Acme Client                         [Archive]│
│─────────────────────────────────────────────────────────│
│  Color: ● Blue    Icon: 🏢    Name: Acme Client         │
│                                                          │
│  CONNECTORS IN THIS AREA                                │
│  ✓ Gmail (work@company.com)                             │
│  ✓ GitHub (acme-org)                                    │
│  ✗ Notion (personal workspace) — not included           │
│  [+ Add Connector]                                       │
│                                                          │
│  MEMORY SCOPE                                           │
│  ✓ Isolated (only this area's memories)                 │
│  ○ Include global memories                              │
│                                                          │
│  ACTIVE GRANTS (from Permission Vault)                  │
│  • github:read, github:pr:comment (expires 2026-04-01)  │
│  [Manage Grants]                                        │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Architecture

### Core Data Model

**Work Area**
```json
{
  "area_id": "uuid",
  "user_id": "string",
  "name": "string",
  "color": "hex",
  "icon": "string",
  "status": "active | archived",
  "created_at": "ISO8601",
  "is_default": false,
  "connector_scope": ["connector_id_1", "connector_id_2"],
  "global_memory_access": false,
  "permission_grants": ["grant_id_1"]
}
```

**Area Context (Session)**
```json
{
  "session_id": "string",
  "user_id": "string",
  "active_area_id": "string",
  "surface": "buddy | ide | web",
  "started_at": "ISO8601"
}
```

### Isolation Enforcement Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   Request Pipeline                        │
│                                                          │
│  Incoming Action/Query                                   │
│         ↓                                                │
│  [Area Context Resolver]  — reads active_area_id        │
│         ↓                                                │
│  [Connector Scope Filter] — only area's connectors visible│
│         ↓                                                │
│  [Memory Retrieval]       — only area's memories injected│
│         ↓                                                │
│  [Permission Gate]        — only area's grants checked   │
│         ↓                                                │
│  [Agent / LLM Execution]                                │
│         ↓                                                │
│  [Audit Log + Area Tag]   — all outputs tagged with area │
└──────────────────────────────────────────────────────────┘
```

### Storage

| Entity | Store | Key Pattern |
|---|---|---|
| Work area records | Cloudflare D1 | `work_areas` table, user_id index |
| Active area session state | Cloudflare Durable Objects | per-session, per-device |
| Connector-area mapping | Cloudflare D1 | `connector_area_scope` join table |
| Area-tagged memories | Cloudflare D1 + Vectorize | `area_id` filter on all memory queries |
| Cross-area activity feed | Cloudflare D1 | `activity_log` with area_id tag |

### Data Flows

**Area Switch:**
```
User selects new area → headyme.com UI → POST /api/session/area
→ Durable Object updates active_area_id for session
→ All subsequent requests include area_id in context
→ UI refreshes: connector list, conversation history, memory scope all update
```

**Agent Action with Area Scoping:**
```
Agent action request → headymcp.com MCP layer
→ Area Context Resolver: read session.active_area_id
→ Connector Scope Filter: intersection of requested connectors ∩ area's connector_scope
→ If any connector out of scope: reject with scope error
→ Memory retrieval: Vectorize query filtered by area_id
→ Proceed with scoped execution
```

---

## 8. Security and Privacy

| Concern | Mitigation |
|---|---|
| Cross-area data leakage in agent execution | Area ID enforced at MCP layer; agents cannot override |
| Session state tampering to switch area | Area context stored in Durable Object server-side; client cannot spoof |
| Global memories leaking sensitive cross-area data | Global flag requires explicit user action; never set automatically |
| Area archive bypass | Archived areas return read-only; no write operations allowed; enforced at API level |
| Device sync: stale area context after force-quit | Session state in Durable Object has TTL; reconstructed from persistent area config on next launch |

---

## 9. Dependencies

| Dependency | Owner | Risk |
|---|---|---|
| Memory Ledger (HEADY-FEAT-002) area tagging | Memory team | High — must be implemented together |
| Permission Graph (HEADY-FEAT-001) area grants | Permission team | Medium — needed for P1 area grants |
| Cloudflare Durable Objects for session state | Infrastructure | Low |
| Android Heady app UI changes (area switcher) | Mobile | High — significant UI work |
| headyme.com area switcher component | HeadyMe | Medium |
| MCP layer area context propagation | HeadySystems | High — core isolation enforcement |

---

## 10. Phased Rollout

### Phase 1 — Core Isolation (Weeks 1–4)
- Work area data model and D1 schema
- Area creation, naming, color/icon
- Area switcher UI (web + Android)
- Connector-area scoping
- Conversation history isolation per area

### Phase 2 — Memory and Agent Integration (Weeks 5–8)
- Memory Ledger area tagging and filtered retrieval
- MCP layer area context enforcement
- Agent action scoping to active area
- Audit log area tagging

### Phase 3 — Polish and Power Features (Weeks 9–14)
- Area templates
- Global memories and resources flag
- Cross-area activity feed
- Area archiving
- Permission Vault area grant integration
- Keyboard shortcuts (desktop)

### Phase 4 — Mobile Depth (Weeks 15+)
- Android widget for area quick-switch
- Android Work Profile integration (if Android API available)
- Auto-detect area from calendar context

---

## 11. Success Metrics

| Metric | Target (60 days post-launch) |
|---|---|
| % of active users with ≥ 2 work areas | ≥ 35% |
| Cross-area context bleed reports | 0 critical, < 5 minor (resolved in 24h) |
| Area switch completion rate (no errors) | ≥ 99% |
| User-reported context clarity improvement | ≥ 4.0/5 in post-launch survey |
| Agent actions rejected due to out-of-scope connector | Tracking only (baseline for v2 tuning) |

---

## 12. Open Questions

| Question | Owner | Blocking? |
|---|---|---|
| Should the Default work area be renameable? | Product | No — yes, allow rename |
| Maximum number of work areas per user in v1? | Engineering | No — recommend 10; raise on request |
| Should area switches be logged in the audit trail? | Product / Security | No — yes, include in audit log |
| How should automations scheduled from one area behave if that area is archived? | Product | Yes — pause automations on archive |
| Should cross-area activity feed be opt-in or opt-out? | Product / UX | No — opt-in in v1 |
