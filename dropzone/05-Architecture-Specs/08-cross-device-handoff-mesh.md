# Feature Spec: Cross-Device Handoff Mesh

**Feature ID:** HEADY-FEAT-008  
**Domain:** headyme.com / headysystems.com  
**Status:** Draft  
**Author:** Eric Haywood  
**Date:** 2026-03-17  
**Version:** 1.0

---

## 1. Problem Statement

Heady users move between devices throughout the day — starting a research task on desktop, picking it up on a mobile device, then returning to desktop to finalize. Today, these transitions are breaks in continuity. Each device starts a fresh session. Context, in-progress tasks, active work areas, and mid-conversation state are not preserved or transferred across devices.

This creates a jarring experience and limits Heady's utility as a true operating layer. Users who want seamless cross-device work must manually re-establish context on every device switch, or avoid switching devices at all. For a product positioning itself as a personal AI operating system, the absence of device continuity is a fundamental gap.

**Who experiences this:** All Heady users with ≥ 2 active devices (desktop + mobile); remote workers; anyone who has tried to pick up an in-progress AI task on a different device.

**Cost of not solving it:** Perceived fragmentation undermines Heady's "OS" positioning; high friction for multi-device users; users default to single-device use, reducing engagement; direct competitive gap versus Apple Handoff/Continuity and Google cross-device experience.

---

## 2. Goals

| Goal | Measurement | Target |
|---|---|---|
| In-progress tasks can be handed off to another device in ≤ 3 interactions | Handoff completion rate | ≥ 90% |
| Session context is fully restored on receiving device | % of handoffs where user reports full context restoration | ≥ 95% |
| Active work area syncs across devices in < 5 seconds | Cross-device area sync latency | < 5 seconds p95 |
| Handoff does not disrupt in-progress tasks on the sending device | % of handoffs where source session continues cleanly | ≥ 99% |
| Users report reduced context re-establishment time | Self-reported time to resume work after device switch | 70% reduction vs. manual re-setup |

---

## 3. Non-Goals

- **Not real-time screen mirroring.** Handoff transfers session context, not a live view of the sending device's display.
- **Not continuous sync of all UI state.** Scroll position, cursor location, and pixel-level UI state are not synchronized.
- **Not instant file sync.** Files referenced in a task are accessible via cloud connectors (Drive, GitHub) on both devices; Heady is not a file sync platform.
- **Not offline handoff.** The receiving device must have network connectivity to receive and reconstruct context.
- **Not multi-user session sharing.** Handoff is between the same user's devices; sharing with other users is out of scope.

---

## 4. User Stories

### Initiating Handoff

- **As a Heady desktop user**, I want to see a "Continue on phone" option when I have an active session, so that I can hand off my work to my mobile device with one action.
- **As a Heady mobile user**, I want to receive a notification when a handoff is available from my desktop, so that I can pick up the context before it disappears.
- **As a Heady user**, I want to choose what to hand off (active task, full session, or specific conversation), so that I control what context is transferred.

### Receiving Handoff

- **As a Heady mobile user**, I want to receive a handed-off session and immediately continue working with full context (conversation history, active task state, work area), so that the transition feels seamless.
- **As a Heady user**, I want the receiving device to prompt: "You have an incoming handoff from [Desktop]. Continue?" so that I can accept or defer without disruption.
- **As a Heady user**, I want to resume a handoff later (it is available for up to 1 hour), so that I do not have to switch immediately.

### Work Area and State Sync

- **As a Heady user**, I want my active work area to sync to all my logged-in devices automatically, so that every device always starts in the same context.
- **As a Heady user**, I want changes I make to the work area configuration on one device to appear on all other devices within 5 seconds, so that my setup is consistent everywhere.
- **As a Heady user**, I want to see which of my devices are currently active and which Heady surface each one is using, so that I have visibility into my device state.

---

## 5. Requirements

### P0 — Must Have

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| CDH-001 | Handoff package: serialized bundle of active session context (conversation history, task state, active work area, active skills, active grants) | Given a desktop session is active, When handoff is initiated, Then a handoff package is created within 3 seconds |
| CDH-002 | Handoff delivery: package delivered to all registered devices for the same user via push channel | Given a handoff is created, Then all registered devices receive a handoff notification within 10 seconds |
| CDH-003 | Handoff receive + restore: receiving device reconstructs session context from handoff package | Given user accepts handoff on mobile, Then conversation history, task state, and work area are restored within 5 seconds |
| CDH-004 | Handoff TTL: packages expire after 1 hour if not accepted | Given a handoff package is created at T, When T + 1 hour passes, Then the package is deleted and marked expired |
| CDH-005 | Work area active-state sync: changing active work area on any device pushes update to all registered devices within 5 seconds | Given user switches area on desktop, Then mobile switches to the same area within 5 seconds |
| CDH-006 | Device registry: user can see all registered devices and remove stale or unauthorized devices | Given user opens Device Settings, Then all devices are listed with name, last active, and current surface |

### P1 — Should Have

| ID | Requirement |
|---|---|
| CDH-007 | Selective handoff: user can choose to hand off (a) full session, (b) active task only, (c) conversation only |
| CDH-008 | Handoff history: list of recent handoffs (last 20) with accept/decline status and timestamp |
| CDH-009 | Cross-device clipboard: text/URL copied in Heady on one device is accessible from Heady on another device |
| CDH-010 | Source session continuation: after initiating handoff, source device can continue independently or enter "monitoring" mode |
| CDH-011 | Handoff from mobile to desktop: reverse direction works identically |
| CDH-012 | Notification customization: user can configure which devices receive handoff notifications |

### P2 — Future Consideration

| ID | Requirement |
|---|---|
| CDH-013 | Background context sync: pre-sync relevant context to registered devices before handoff is initiated (predictive pre-loading) |
| CDH-014 | Wearable device handoff (Wear OS, Apple Watch as relay) |
| CDH-015 | Smart device selection: Heady suggests optimal device based on task type and device capabilities |

---

## 6. User Experience

### Desktop Handoff Initiation

```
┌─────────────────────────────────────────────────────────┐
│  ACTIVE SESSION: Research Task (4:22 PM – 18 min)       │
│─────────────────────────────────────────────────────────│
│  [Continue on Another Device]                            │
│                                                          │
│  Hand off to:    ● Pixel 8 Pro   ○ iPad Pro            │
│  What to send:   ● Full session  ○ Task only  ○ Chat    │
│                                                          │
│  [Send Handoff]                          [Cancel]       │
└─────────────────────────────────────────────────────────┘
```

### Mobile Handoff Receive Notification

```
┌─────────────────────────────────────────────────────────┐
│  📲 HEADY HANDOFF AVAILABLE                             │
│  From: Desktop (MacBook Pro)                            │
│  Research Task — 18 min in progress                     │
│  Expires in: 58 minutes                                 │
│                                                          │
│  [Continue Now]        [Maybe Later]        [Dismiss]   │
└─────────────────────────────────────────────────────────┘
```

### Device Manager (headyme.com)

```
┌─────────────────────────────────────────────────────────┐
│  MY DEVICES                                             │
│─────────────────────────────────────────────────────────│
│  ● MacBook Pro (Desktop)     Heady Web  Active now      │
│    Last handoff: sent 4 min ago                [Remove] │
│                                                          │
│  ● Pixel 8 Pro (Mobile)      Heady App  Active 2hr ago │
│    Last handoff: received 4 min ago            [Remove] │
│                                                          │
│  ○ iPad Pro (Tablet)         Heady Web  Inactive        │
│    Last active: Mar 14                         [Remove] │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Architecture

### Core Components

```
┌──────────────────────────────────────────────────────────┐
│                  Cross-Device Handoff Mesh                │
│                                                          │
│  ┌─────────────┐     ┌──────────────────┐               │
│  │  Handoff    │────▶│  Handoff Store   │               │
│  │  Initiator  │     │  (Cloudflare KV, │               │
│  │  (Worker)   │     │   1hr TTL)       │               │
│  └─────────────┘     └──────────────────┘               │
│                              │                           │
│                    ┌─────────▼─────────┐                │
│                    │  Push Delivery    │                │
│                    │  (FCM for Android │                │
│                    │   Web Push for    │                │
│                    │   desktop)        │                │
│                    └─────────┬─────────┘                │
│                              │                          │
│                    ┌─────────▼─────────┐               │
│                    │  Receiving Device │               │
│                    │  (Handoff Restore │               │
│                    │   Worker)         │               │
│                    └───────────────────┘               │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Work Area Sync (Cloudflare Durable Objects)    │    │
│  │  One DO per user; all devices subscribe via WS  │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

### Handoff Package Schema

```json
{
  "handoff_id": "uuid",
  "user_id": "string",
  "source_device_id": "string",
  "source_surface": "buddy | ide | web",
  "created_at": "ISO8601",
  "expires_at": "ISO8601",
  "status": "pending | accepted | declined | expired",
  "scope": "full_session | task_only | chat_only",
  "payload": {
    "active_area_id": "string",
    "conversation_history": [{ "role": "user|assistant", "content": "string" }],
    "active_task": {
      "task_id": "string",
      "name": "string",
      "current_step": 4,
      "total_steps": 7,
      "status": "running | paused"
    },
    "active_skills": ["skill_id_1"],
    "active_grants": ["grant_id_1"]
  },
  "payload_size_bytes": 0,
  "payload_hash": "sha256:string"
}
```

### Work Area Sync Protocol

```
User switches area on Device A → POST /api/session/area (area_id=X)
→ Session Worker: update active_area_id in Durable Object
→ DO broadcasts "area_changed" event to all subscribed device WebSocket connections
→ Device B receives event → switches active area in local session state
→ Device B UI reflects new area within 5 seconds
```

### Storage

| Entity | Store | TTL |
|---|---|---|
| Handoff packages | Cloudflare KV | 1 hour |
| Device registry | Cloudflare D1 (per user) | No expiry; user-managed |
| Work area sync state | Cloudflare Durable Object | Long-lived (per user) |
| FCM/Web Push tokens | Cloudflare D1 (per device) | Updated on login |

---

## 8. Security and Privacy

| Concern | Mitigation |
|---|---|
| Handoff intercepted by another user | Packages stored in KV keyed by handoff_id; delivery is push-to-registered-devices only; recipient must be same user_id |
| Handoff package contains sensitive conversation | Packages encrypted with user-derived key before writing to KV; decrypted only on authenticated receiving device |
| Stale device remaining in registry after device loss | User can remove devices from Device Manager; auto-remove after 90 days inactivity |
| Push notification content leakage (visible on lock screen) | Notification payload contains no conversation content; only "Handoff available from [Device]" |
| Unauthorized work area sync | Area sync events routed through user-scoped Durable Object; only authenticated sessions for that user receive events |

---

## 9. Dependencies

| Dependency | Owner | Risk |
|---|---|---|
| Android Heady app FCM integration | Mobile | High — push delivery requires native app |
| Web Push on headyme.com | HeadyMe | Medium — VAPID key setup required |
| Cloudflare Durable Objects for area sync | Infrastructure | Medium — WebSocket-based sync requires DO |
| Session state serialization (for handoff package) | Engineering | High — must define canonical session serialization |
| Work-Area Orchestrator (HEADY-FEAT-003) | Work area team | High — area sync is part of handoff |
| Mission Control task state (HEADY-FEAT-005) | Mission Control team | Medium — task state in handoff package |

---

## 10. Phased Rollout

### Phase 1 — Device Registry and Area Sync (Weeks 1–4)
- Device registry (D1) and Device Manager UI
- FCM + Web Push token registration
- Work area active-state sync via Durable Objects
- Cross-device area change propagation

### Phase 2 — Full Handoff (Weeks 5–9)
- Handoff package schema and serialization
- Handoff Initiator Worker (create, store, push)
- Receiving device handoff notification
- Handoff Restore Worker (reconstruct session context)
- Handoff TTL and expiry

### Phase 3 — Polish (Weeks 10–14)
- Selective handoff (full / task / chat)
- Handoff history
- Source session continuation / monitoring mode
- Reverse direction (mobile to desktop)
- Notification customization

### Phase 4 — Intelligence (Weeks 15+)
- Cross-device clipboard
- Predictive pre-loading (background context sync)
- Smart device suggestion based on task type

---

## 11. Success Metrics

| Metric | Target (60 days post-launch) |
|---|---|
| % of users with ≥ 2 registered devices who use handoff | ≥ 35% |
| Handoff completion rate (initiated → accepted → restored) | ≥ 90% |
| Session context restoration success rate | ≥ 95% |
| Work area sync latency (p95) | < 5 seconds |
| User-reported continuity improvement | +70% vs. manual re-setup baseline |

---

## 12. Open Questions

| Question | Owner | Blocking? |
|---|---|---|
| What is the maximum handoff payload size (conversation history can be large)? | Engineering | Yes — must set limit; recommend 500KB compressed |
| Should conversation history be truncated in the handoff package (last N turns)? | Product / Engineering | Yes — last 20 turns default; full history in v2 |
| How should handoffs work when the receiving device does not have the same skills installed? | Product | No — install missing skills on receive; flag to user |
| Does cross-device clipboard require explicit user permission under platform privacy rules (Android/Web)? | Legal / Mobile | Yes — must confirm platform requirements |
