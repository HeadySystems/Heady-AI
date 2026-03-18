---
name: heady-ritual-engine
description: Design the Heady Ritual Engine for user-defined recurring routines, automated check-in sequences, and habit-building workflows. Use when building daily standup automations, morning briefing generators, end-of-day review rituals, recurring health checks, or any time-triggered routine that Buddy executes on a schedule.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Ritual Engine

Use this skill when you need to **design, build, or manage the Ritual Engine** — Heady's system for defining, scheduling, and executing recurring routines that Buddy performs on behalf of the user.

## When to Use This Skill

- Designing ritual definitions — what happens, when, and in what order
- Building time-triggered automations (morning briefing, daily standup, weekly review)
- Creating habit-building workflows with progress tracking
- Implementing health checks and monitoring rituals
- Planning ritual templates for common routines
- Designing the ritual editor and scheduling interface

## Instructions

### 1. Define the Ritual Schema

A ritual is a recurring, structured routine:

```yaml
ritual:
  id: uuid
  name: display-name
  owner: user-id
  status: active | paused | draft

  schedule:
    type: cron | interval | event-triggered
    cron: "0 9 * * 1-5"          # weekdays at 9am
    interval: null                # or: every 4h, every 30m
    trigger: null                 # or: on-pr-merge, on-deploy, on-error
    timezone: user-timezone
    skip_if: [conditions to skip this occurrence]
      - user_status == "dnd"
      - user_status == "offline"

  steps:
    - name: step-name
      action: gather | analyze | generate | notify | interact | execute
      description: what this step does
      config:
        tool: heady tool or external action
        parameters: step-specific configuration
      timeout_ms: max time for this step
      on_failure: skip | retry | abort | notify-and-continue
      condition: optional condition to run this step

  delivery:
    surface: buddy | web | notification | email | silent
    format: chat | card | digest | report
    interaction: informational | requires-response | requires-approval

  tracking:
    streak: consecutive completions
    last_run: ISO-8601
    next_run: ISO-8601
    history: [past execution records]
    completion_rate: percentage of scheduled runs that completed
```

### 2. Build Ritual Templates

Pre-built rituals for common routines:

**Morning Briefing:**
```yaml
name: morning-briefing
schedule: "0 9 * * 1-5"
steps:
  - name: check-calendar
    action: gather
    config: { tool: calendar-connector, parameters: { range: today } }
  - name: check-tasks
    action: gather
    config: { tool: task-board, parameters: { status: in-progress } }
  - name: check-notifications
    action: gather
    config: { tool: notification-feed, parameters: { since: last-briefing } }
  - name: generate-briefing
    action: generate
    config: { template: morning-summary, inputs: [calendar, tasks, notifications] }
  - name: deliver
    action: notify
    config: { surface: buddy, format: card }
```

**End-of-Day Review:**
```yaml
name: end-of-day-review
schedule: "0 17 * * 1-5"
steps:
  - name: collect-accomplishments
    action: gather
    config: { tool: task-genome, parameters: { completed_today: true } }
  - name: check-open-items
    action: gather
    config: { tool: task-board, parameters: { status: in-progress } }
  - name: capture-learnings
    action: interact
    config: { prompt: "What did you learn today? Anything to remember?" }
  - name: generate-review
    action: generate
    config: { template: daily-review, inputs: [accomplishments, open-items, learnings] }
  - name: save-to-memory
    action: execute
    config: { tool: memory-ledger, parameters: { category: daily-review } }
```

**PR Health Check:**
```yaml
name: pr-health-check
schedule: "0 */4 * * 1-5"   # every 4 hours on weekdays
steps:
  - name: scan-open-prs
    action: gather
    config: { tool: github-connector, parameters: { state: open } }
  - name: identify-stale
    action: analyze
    config: { rule: "no activity in 48h", flag: stale }
  - name: identify-blocked
    action: analyze
    config: { rule: "failing checks or requested changes", flag: blocked }
  - name: notify-if-issues
    action: notify
    config: { surface: buddy, condition: "stale.count > 0 OR blocked.count > 0" }
```

**Weekly Retrospective:**
```yaml
name: weekly-retro
schedule: "0 16 * * 5"   # Friday at 4pm
steps:
  - name: gather-week-summary
    action: gather
    config: { tool: task-genome, parameters: { completed_this_week: true } }
  - name: gather-insights
    action: gather
    config: { tool: insight-graph, parameters: { new_insights_this_week: true } }
  - name: generate-retro
    action: generate
    config: { template: weekly-retro }
  - name: interact
    action: interact
    config: { prompt: "Here's your week in review. What went well? What could improve?" }
  - name: save-retro
    action: execute
    config: { tool: memory-sanctum, parameters: { category: retrospective, ceremony: true } }
```

### 3. Design the Step Action Types

| Action | Description | Examples |
|--------|-------------|---------|
| `gather` | Collect data from a source | Read calendar, query tasks, fetch notifications |
| `analyze` | Process gathered data against rules | Find stale PRs, detect anomalies, score quality |
| `generate` | Produce output from a template + data | Create briefing, write summary, compose digest |
| `notify` | Deliver output to a surface | Push notification, chat message, email |
| `interact` | Ask the user a question and wait | "What did you learn today?" |
| `execute` | Perform an action in the system | Save to memory, create task, update status |

### 4. Implement Ritual Lifecycle

```
Draft → Active → [Paused] → Active → Retired
         ↓                    ↓
    Executing              Executing
         ↓                    ↓
  Completed / Failed    Completed / Failed
```

**Execution flow:**
```
1. Scheduler triggers ritual at scheduled time
2. Check skip conditions (DND, offline, etc.)
3. If skipped: log skip reason, schedule next occurrence
4. If running: execute steps in order
5. Each step: run action, capture output, check for failure
6. On step failure: follow on_failure policy (skip, retry, abort, notify)
7. On completion: log execution record, update streak, schedule next
8. Deliver results to configured surface
```

### 5. Build the Ritual Editor

User interface for creating and managing rituals:

| Section | Controls |
|---------|----------|
| **Schedule** | Cron builder, interval picker, event trigger selector |
| **Steps** | Drag-and-drop step ordering, step type selector, config forms |
| **Delivery** | Surface picker, format selector, interaction level |
| **Preview** | Dry-run the ritual to see what it would produce |
| **History** | Calendar view of past executions with status |
| **Streak** | Visual streak tracker with completion rate |

### 6. Design Habit Tracking

For rituals designed to build habits:

```yaml
habit_tracking:
  streak_current: consecutive successful completions
  streak_best: all-time longest streak
  completion_rate_7d: percent completed in last 7 days
  completion_rate_30d: percent completed in last 30 days
  skip_reasons: [aggregated reasons for skips]
  trend: improving | steady | declining
  nudge_policy:
    if_missed: remind after 1 hour
    if_streak_at_risk: notify before scheduled time
    if_declining: suggest schedule adjustment
```

## Output Format

When designing Ritual Engine features, produce:

1. **Ritual schema** with all configurable fields
2. **Template definitions** for target routines
3. **Step action type** specifications
4. **Lifecycle and execution flow**
5. **Editor interface** wireframes
6. **Habit tracking** metrics and nudge policies

## Tips

- **Rituals reduce cognitive load** — the whole point is that users don't have to remember to do these things
- **Skip conditions prevent annoyance** — a ritual that fires during DND or vacation erodes trust
- **Streaks motivate** — showing a streak counter makes users want to maintain it
- **Templates get people started** — most users won't build rituals from scratch; great templates are essential
- **Interaction steps are optional** — some rituals are fully autonomous; others benefit from a human touch
- **Start simple** — a morning briefing that works reliably is worth more than a complex workflow that breaks
