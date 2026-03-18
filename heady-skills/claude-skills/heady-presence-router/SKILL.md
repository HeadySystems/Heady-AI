---
name: heady-presence-router
description: Design the Heady Presence Router for awareness of user presence, attention, and availability across devices and surfaces. Use when building presence detection, attention-aware notification routing, do-not-disturb logic, or designing systems that adapt agent behavior based on whether and where the user is active.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Presence Router

Use this skill when you need to **design, build, or tune the Presence Router** — Heady's system for detecting user presence and attention across devices, and routing agent interactions to the right surface at the right time.

## When to Use This Skill

- Detecting where the user is active (device, surface, application)
- Routing notifications and agent outputs to the user's current attention point
- Implementing do-not-disturb and focus-mode awareness
- Adapting agent behavior based on user availability (active, idle, away, DND)
- Designing presence-aware interaction patterns (interrupt vs. queue vs. batch)
- Building multi-device presence synchronization

## Instructions

### 1. Define the Presence Model

Track user presence across all Heady surfaces:

```yaml
user_presence:
  user_id: uuid
  updated_at: ISO-8601
  overall_status: active | idle | away | dnd | offline

  devices:
    - device_id: uuid
      surface: android | desktop | web
      status: active | idle | locked | offline
      last_activity: ISO-8601
      active_app: which application is in foreground
      input_activity:
        keyboard: active | idle
        mouse: active | idle
        touch: active | idle
      network: connected | degraded | offline

  focus:
    mode: normal | focus | dnd | meeting | sleep
    until: ISO-8601 | null     # when the current mode expires
    allow_urgent: true | false # whether critical alerts can break through
    active_task: task-id | null

  preferences:
    primary_device: device-id  # preferred device for notifications
    quiet_hours:
      start: "22:00"
      end: "07:00"
      timezone: user-timezone
    notification_style: immediate | batched | digest
```

### 2. Design Presence Detection

How the system knows where the user is:

| Signal | Source | Indicates |
|--------|--------|-----------|
| Keystroke/click | Input monitor | Active attention on this surface |
| Window focus | OS/browser | Which app the user is looking at |
| Screen lock | OS | User stepped away |
| App open/close | Surface SDK | User entered or left a Heady surface |
| Heartbeat | Background ping | Device is on and connected |
| Calendar | Calendar integration | User is in a meeting |
| Time of day | Clock + preferences | Quiet hours, work hours |

**Status resolution logic:**
```
IF any device has input activity in last 2 minutes → active
ELSE IF any device has activity in last 15 minutes → idle
ELSE IF any device has heartbeat → away
ELSE → offline

IF calendar shows meeting → meeting (unless actively typing)
IF user set DND → dnd
IF quiet hours active → sleep (unless user is actively using a device)
```

### 3. Build Notification Routing

Route agent outputs to the right place:

```yaml
routing_rules:
  - condition: user is active on desktop
    route: deliver to desktop surface inline
    style: non-blocking notification

  - condition: user is active on mobile
    route: deliver to mobile as push notification
    style: compact summary with expand option

  - condition: user is idle (any device)
    route: queue for next active session
    style: badge count + notification list

  - condition: user is in DND
    route: queue silently
    style: no notification unless urgent flag + allow_urgent

  - condition: user is away
    route: queue with priority sorting
    style: digest when user returns

  - condition: user is offline
    route: store for delivery when any device comes online
    style: batch digest
```

### 4. Define Interaction Patterns

How agents adapt based on presence:

| Presence | Agent Behavior |
|----------|---------------|
| Active + focused on Heady | Full interaction — rich responses, inline suggestions |
| Active + focused elsewhere | Brief notification — one-liner with action button |
| Idle | Queue non-urgent; notify for urgent with sound |
| DND | Silent queue unless break-glass urgent |
| Away | Work autonomously; present results when user returns |
| Meeting | Mute all notifications; prepare digest for after meeting |

**Urgency classification:**
```
Critical: security alert, data loss risk, blocking error → always notify
High: task completed, approval needed → notify unless DND
Normal: progress update, suggestion → queue if not active
Low: analytics, tips, recommendations → digest only
```

### 5. Implement Multi-Device Sync

Keep presence consistent across devices:

- **Leader election** — the most recently active device is the "primary" for routing
- **Handoff detection** — when user picks up phone after using desktop, presence follows
- **Conflict resolution** — if multiple devices are active simultaneously, route to the one running Heady
- **Sync protocol** — lightweight heartbeat + event-driven updates (not polling)
- **Latency target** — presence changes propagate to all devices within 2 seconds

### 6. Design Focus Mode Integration

When the user enters focus mode:

```
1. User activates focus mode (manual or triggered by task)
2. Presence Router sets status to "focus"
3. All non-critical notifications are queued
4. Agents reduce proactive suggestions
5. UI minimizes non-essential panels
6. When focus ends: deliver queued items as a digest
```

Focus mode triggers:
- Manual activation ("Buddy, I need to focus")
- Pomodoro timer integration
- Deep work detection (sustained coding for 15+ minutes)
- Calendar-based (focus blocks on calendar)

## Output Format

When designing Presence Router features, produce:

1. **Presence model schema** with status definitions
2. **Detection signal matrix**
3. **Routing rules** with conditions and delivery styles
4. **Interaction pattern matrix**
5. **Multi-device sync protocol**
6. **Focus mode specification**

## Tips

- **Presence should feel invisible** — the user should never think about routing; it should just work
- **False negatives are better than false positives** — it's better to queue a notification than to buzz during a meeting
- **Idle != gone** — an idle user may still be thinking; don't treat idle as an excuse to batch everything
- **DND is sacred** — when the user says don't disturb, only true emergencies break through
- **Digest is underrated** — a well-crafted digest of what happened while the user was away is extremely valuable
- **Calibrate over time** — learn the user's patterns; some people check their phone in meetings, some don't
