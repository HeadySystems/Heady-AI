---
name: heady-device-twin-grid
description: Design and operate the Heady Device Twin Grid for creating digital twins of user devices, synchronizing state across the Heady surface fleet, and enabling context-aware computing. Use when building device state models, designing sync protocols, managing the device mesh across heady-mobile, heady-desktop, heady-chrome, heady-vscode, heady-jetbrains, and HeadyWeb, or planning hybrid local/cloud execution modes. Integrates with HeadyMemory for persistent device context and heady-observer for fleet health monitoring.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Device Twin Grid

Use this skill when you need to **design, build, or operate the Device Twin Grid** — Heady's system for maintaining digital twins of every user device, synchronizing state across the surface fleet, and enabling intelligent context routing based on device capabilities and user presence.

## When to Use This Skill

- Building digital twin models for each device in the Heady surface fleet
- Designing state synchronization protocols across mobile, desktop, browser, and IDE surfaces
- Creating context-aware routing that leverages device capabilities
- Planning hybrid local/cloud execution for latency-sensitive or offline scenarios
- Managing the device mesh topology and health monitoring
- Designing the fleet management dashboard on HeadyWeb

## Platform Context

The Device Twin Grid spans Heady's entire surface fleet:

- **heady-mobile** — iOS/Android native app (touch, camera, GPS, notifications, offline capability)
- **heady-desktop** — Mac/Windows/Linux native app (keyboard, screen context, file system, system tray)
- **heady-chrome** — Chrome extension (web context, tab awareness, page analysis)
- **heady-vscode** — VS Code extension (code context, editor state, terminal, debugging)
- **heady-jetbrains** — JetBrains IDE plugin (code context, project structure, build tools)
- **HeadyWeb** — browser-native dashboard (full Heady platform access, Module Federation micro-frontends)
- **HeadyMemory** (`latent-core-dev`, pgvector) — persistent device state and context storage
- **heady-observer** — monitors device fleet health and connectivity
- **heady-metrics** — tracks device usage, sync latency, and fleet performance
- **heady-sentinel** — enforces device authentication and data access policies
- **heady-vinci** — predicts user behavior patterns across devices for proactive context loading

## Instructions

### 1. Define the Device Twin Model

```yaml
device_twin:
  id: uuid
  owner: user-id
  name: user-assigned device name
  type: mobile | desktop | browser | ide | web
  platform: ios | android | macos | windows | linux | chrome | vscode | jetbrains | web
  surface: heady-mobile | heady-desktop | heady-chrome | heady-vscode | heady-jetbrains | heady-web
  status: online | idle | offline | syncing

  capabilities:
    input: [touch, keyboard, mouse, voice, camera, screen-share]
    output: [screen, audio, haptic, notifications]
    compute: { local_inference: true | false, gpu: true | false }
    storage: { local_mb: available, offline_cache: true | false }
    network: { type: wifi | cellular | ethernet, bandwidth: high | medium | low }
    context: [gps, screen-content, clipboard, file-system, code-editor, browser-tabs]

  state:
    last_seen: ISO-8601
    active_session: session-id | null
    current_context:
      app_foreground: application name
      active_task: task description
      location: general area (never precise GPS in twin)
      time_zone: IANA timezone
    battery: percentage (mobile/laptop only)
    sync_status: current | behind | conflict

  preferences:
    role: primary | secondary | occasional
    notification_priority: all | important | urgent-only | none
    sync_scope: full | selective | minimal
    offline_mode: enabled | disabled
    local_inference: enabled | disabled
```

### 2. Design the Sync Protocol

State synchronization across the device grid:

```yaml
sync_protocol:
  layers:
    - name: conversation_state
      description: Active conversation context and history
      storage: HeadyMemory
      sync: real-time (< 2s propagation)
      conflict_resolution: last-write-wins with device priority

    - name: user_preferences
      description: Settings, persona selection, notification preferences
      storage: HeadyMemory
      sync: eventual (< 30s propagation)
      conflict_resolution: merge with user confirmation on conflicts

    - name: task_context
      description: Active tasks, todo lists, work-in-progress
      storage: HeadyMemory
      sync: real-time (< 2s propagation)
      conflict_resolution: merge (tasks are additive)

    - name: device_context
      description: Device-local context (screen, location, editor state)
      storage: local + HeadyMemory summary
      sync: one-way upload (device → cloud), never pushed to other devices
      privacy: context stays scoped to originating device unless user shares

    - name: offline_cache
      description: Cached responses and local state for offline operation
      storage: local device storage
      sync: refresh on reconnect
      staleness: max 24h before requiring fresh sync

  transport:
    primary: WebSocket via HeadyMCP
    fallback: HTTP polling every 30s
    offline: queue changes locally, replay on reconnect
    compression: delta sync (only changed fields)

  conflict_handling:
    detection: version vectors per sync layer
    resolution:
      automatic: last-write-wins for simple values
      manual: user prompted via heady-observer notification for semantic conflicts
    audit: all conflicts logged in heady-traces
```

### 3. Build Context-Aware Routing

Route requests to the optimal device based on context:

```yaml
context_routing:
  signals:
    - user_presence: which device is currently active (heady-observer presence tracking)
    - device_capability: can this device fulfill the request (capability matching)
    - task_affinity: which device has relevant context loaded (HeadyMemory overlap)
    - network_quality: device connectivity strength (heady-metrics)
    - battery_level: avoid routing heavy tasks to low-battery devices

  routing_rules:
    notification:
      route_to: most recently active device
      fallback: all devices with notification capability
      quiet_hours: respect per-device notification preferences

    task_execution:
      code_tasks: prefer heady-vscode or heady-jetbrains (code context available)
      web_research: prefer heady-chrome (browser context available)
      communication: prefer heady-mobile or heady-desktop (full I/O)
      dashboard: prefer heady-web (full platform access)

    context_handoff:
      trigger: user switches active device (detected by heady-observer)
      action: load relevant context from HeadyMemory to new device
      optimization: heady-vinci predicts likely next device, pre-loads context

  prediction:
    model: heady-vinci analyzes device usage patterns
    signals: time of day, day of week, calendar events, recent device switches
    action: proactively sync context to predicted next device
    accuracy_tracking: heady-metrics measures prediction hit rate
```

### 4. Implement Hybrid Local/Cloud Execution

Balance between local processing and cloud capabilities:

```yaml
execution_modes:
  cloud_first:
    description: Default mode — process via HeadyMCP cloud infrastructure
    when: device online, task requires MCP tools or HeadyMemory access
    latency: network-dependent (typically < 1s)

  local_first:
    description: Process locally when possible, fall back to cloud
    when: latency-sensitive tasks (voice, real-time suggestions)
    capabilities: basic inference, cached responses, simple tool calls
    devices: heady-desktop and heady-mobile with local_inference enabled

  offline:
    description: Fully local processing with cached context
    when: no network connectivity
    capabilities: cached persona, local inference, queued actions
    limitations: no HeadyMemory access, no MCP tools, stale context
    reconnect: replay queued actions, refresh cache, sync state

  edge_hybrid:
    description: Split processing between device and nearest edge
    when: moderate connectivity, complex tasks
    split: device handles I/O and simple processing; edge handles inference
    coordination: heady-maestro manages split execution

  mode_selection:
    automatic: heady-observer monitors connectivity + heady-vinci predicts optimal mode
    manual: user can force mode via device settings
    transition: seamless — user should not notice mode switches
```

### 5. Design Fleet Health Monitoring

Monitor the entire device grid via heady-observer:

```yaml
fleet_monitoring:
  per_device:
    - heartbeat: every 30s when active, every 5m when idle
    - sync_latency: time to propagate state changes
    - local_storage: cache utilization and staleness
    - connectivity: network type and quality
    - battery: level and charging status (where applicable)

  fleet_wide:
    - device_count: total devices per user, active vs idle vs offline
    - sync_health: percentage of devices at current state
    - context_coverage: which devices have relevant context loaded
    - handoff_success: percentage of successful cross-device handoffs
    - prediction_accuracy: heady-vinci device prediction hit rate

  alerts:
    - condition: device offline > 24h → heady-observer notifies user
    - condition: sync conflict unresolved > 1h → escalate to user
    - condition: sync_latency > 10s sustained → investigate connectivity
    - condition: offline cache > 24h stale → warn user of stale data
    - condition: fleet reduced to single device → adjust routing, disable handoff
```

### 6. Build the Fleet Dashboard on HeadyWeb

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **Device Grid** | heady-observer | Visual map of all devices with status indicators |
| **Sync Status** | heady-metrics | Real-time sync state per layer per device |
| **Context Map** | HeadyMemory | What context is loaded on which device |
| **Usage Patterns** | heady-vinci | Device usage timeline and predicted transitions |
| **Health Metrics** | heady-metrics | Sync latency, handoff success, connectivity quality |
| **Privacy Controls** | heady-sentinel | Per-device data sharing and context scope settings |

## Output Format

When designing Device Twin Grid features, produce:

1. **Twin model** with capabilities, state, and sync configuration per device
2. **Sync protocol** with layers, transport, and conflict resolution
3. **Context routing** rules with capability matching and prediction
4. **Execution mode** design for cloud, local, offline, and hybrid scenarios
5. **Fleet monitoring** with heady-observer health checks and alerts
6. **Dashboard** wireframes with heady-metrics data sources

## Tips

- **The twin is a model, not a mirror** — store capabilities and summary context, not raw device data
- **Privacy is per-device** — screen content and location context stays on the device unless user explicitly shares
- **heady-vinci predicts, heady-observer reacts** — prediction pre-loads context; observer detects actual state changes
- **Offline is a first-class mode** — design every feature to degrade gracefully without network
- **Sync conflicts are rare but critical** — invest in clear conflict UI; silent data loss destroys trust
- **Battery awareness prevents frustration** — never route compute-heavy tasks to a dying phone
