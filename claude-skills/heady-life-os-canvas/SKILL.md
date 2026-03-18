---
name: heady-life-os-canvas
description: Design and operate the Heady Life OS Canvas for unified personal life management across goals, habits, finances, health, relationships, and productivity. Use when building personal dashboard systems, designing goal tracking and habit formation engines, creating life domain integration workflows, implementing personal knowledge management, planning cross-surface life context synchronization, or designing AI-assisted life planning. Integrates with headyos-core for OS orchestration, headyme-core for personal cloud, HeadyMemory for life context, heady-atlas for life mapping, headybuddy-core for coaching, and all Heady surfaces for ubiquitous access.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Life OS Canvas

Use this skill when you need to **design, build, or operate the Life OS Canvas** — Heady's unified personal operating system that connects all life domains into a coherent, AI-assisted management surface.

## When to Use This Skill

- Building unified personal dashboard systems across life domains
- Designing goal tracking, habit formation, and accountability engines
- Creating life domain integration (health, finance, career, relationships, learning)
- Implementing personal knowledge management and life context systems
- Planning cross-surface synchronization for ubiquitous life access
- Designing AI-assisted life planning, reviews, and decision support

## Platform Context

The Life OS Canvas orchestrates across Heady's entire surface area:

- **headyos-core** — Operating system orchestration layer; manages life domain routing, context switching, and cross-domain workflows
- **headyme-core** — Personal cloud hub; central identity, preferences, and personal data management
- **HeadyMemory** (`latent-core-dev`, pgvector) — Stores life context, goals, habits, journal entries, and personal knowledge as 3D vector embeddings for semantic retrieval
- **heady-atlas** — Life mapping: visualizes connections between goals, domains, and activities
- **headybuddy-core** — AI Companion for daily planning, accountability check-ins, and life coaching
- **heady-vinci** — Analyzes life patterns, predicts bottlenecks, recommends optimizations
- **heady-patterns** — Detects life rhythms, habit formation curves, and productivity cycles
- **heady-montecarlo** — Simulates goal outcomes under different strategies
- **heady-sentinel** — Enforces personal data privacy across all life domains
- **heady-traces** — Audit trail of life events for personal review and reflection
- **heady-metrics** — Tracks habit streaks, goal progress, domain balance scores
- **All surfaces**: HeadyWeb (primary dashboard), heady-mobile (on-the-go), heady-desktop (deep work), heady-chrome (browser context), heady-vscode/heady-jetbrains (development flow)
- **headyconnection-core** — Community accountability groups and shared goals (nonprofit)

## Instructions

### 1. Define the Life OS Model

```yaml
life_os_canvas:
  domains:
    health:
      sub_domains: [physical_fitness, nutrition, sleep, mental_wellness, medical]
      data_sources: [wellness_mirror, user_input, device_sync]
      integration: heady-wellness-mirror feeds health signals

    career:
      sub_domains: [current_role, skill_development, networking, job_search, side_projects]
      data_sources: [calendar, task_manager, learning_spiral, code_activity]
      integration: heady-learning-spiral feeds skill progress

    finance:
      sub_domains: [budget, savings, investments, debt, income_streams]
      data_sources: [user_input, connected_accounts_optional]
      integration: user-reported financial tracking (privacy-first, no bank connections required)

    relationships:
      sub_domains: [family, friends, professional, community, romantic]
      data_sources: [user_input, calendar_events, communication_patterns]
      integration: headyconnection-core community engagement

    learning:
      sub_domains: [formal_education, self_study, skills, certifications, reading]
      data_sources: [learning_spiral, user_input, reading_tracker]
      integration: heady-learning-spiral competency maps

    creativity:
      sub_domains: [projects, hobbies, writing, art, music]
      data_sources: [user_input, project_tracker]
      integration: heady-stories content creation

    productivity:
      sub_domains: [task_management, time_allocation, focus_sessions, energy_management]
      data_sources: [task_lists, calendar, wellness_mirror_energy]
      integration: all Heady surfaces contribute context

  canvas_model:
    structure: domains are interconnected nodes on a life map (heady-atlas)
    balance_score: 0.0-1.0 per domain, composite life balance score
    attention_budget: finite attention distributed across domains
    priority_engine: heady-vinci recommends domain focus based on goals + current state
```

### 2. Build the Goal and Habit Engine

```yaml
goal_engine:
  goal_types:
    outcome_goals:
      description: specific measurable targets with deadlines
      examples: ["Run a marathon by December", "Save $10K emergency fund", "Ship side project v1"]
      tracking: milestone-based progress in HeadyMemory
      simulation: heady-montecarlo models probability of achievement given current trajectory

    system_goals:
      description: process-oriented habits and routines
      examples: ["Exercise 4x/week", "Read 30 min/day", "Weekly budget review"]
      tracking: streak-based with heady-metrics
      formation: heady-patterns models habit formation curve (average 66 days to automaticity)

    identity_goals:
      description: who the user wants to become
      examples: ["Become a confident public speaker", "Be a present parent"]
      tracking: qualitative self-assessment + heady-vinci behavioral pattern analysis
      connection: identity goals inform outcome and system goal selection

  goal_hierarchy:
    life_vision: 5-10 year aspirational direction
    annual_themes: yearly focus areas (1-3 themes)
    quarterly_objectives: measurable outcomes per quarter
    monthly_milestones: stepping stones toward quarterly objectives
    weekly_plans: concrete actions for the week
    daily_intentions: today's focus, generated by headybuddy-core each morning

  habit_tracking:
    mechanics:
      streak_counting: consecutive days/occurrences of habit
      completion_rate: percentage over rolling windows (7d, 30d, 90d)
      time_of_day: optimal time detection via heady-patterns
      cue_identification: what triggers successful habit execution
      friction_analysis: what prevents habit execution

    formation_support:
      habit_stacking: heady-vinci suggests attaching new habits to existing routines
      environment_design: recommendations for cue placement and friction reduction
      accountability: headybuddy-core check-ins + optional headyconnection-core partners
      reward_system: intrinsic motivation tracking, celebration of milestones
      recovery: missed days handled gracefully, "never miss twice" principle
```

### 3. Design the Daily Operating Rhythm

```yaml
daily_rhythm:
  morning_startup:
    trigger: user wakes (detected or scheduled)
    flow:
      1. headybuddy-core delivers personalized morning briefing
      2. Review: today's calendar, priorities, weather, relevant context
      3. Wellness check-in: mood and energy capture (wellness-mirror integration)
      4. Set daily intentions: 1-3 focus items from weekly plan
      5. Habit reminders: which system goals apply today
    surface: heady-mobile (voice via Voice Vessel) or HeadyWeb

  midday_check:
    trigger: natural break detected or scheduled
    flow:
      1. Progress check on daily intentions
      2. Energy level update
      3. Adjust afternoon priorities if needed
      4. Optional: guided breathing or micro-break suggestion
    surface: any active surface (adaptive)

  evening_review:
    trigger: end of work day (detected or scheduled)
    flow:
      1. Daily review: what was accomplished, what shifted
      2. Habit completion logging
      3. Gratitude and reflection prompt
      4. Preview tomorrow and adjust weekly plan
      5. Capture any open loops or ideas in HeadyMemory
    surface: HeadyWeb or heady-mobile

  weekly_review:
    trigger: Sunday evening or user-configured day
    flow:
      1. Review week: goals met, habits tracked, domains balanced
      2. heady-vinci generates weekly insight report
      3. Adjust coming week's plan based on patterns
      4. Set weekly focus items aligned with monthly milestones
      5. Optional: share progress with accountability partner (headyconnection-core)

  quarterly_review:
    trigger: end of quarter
    flow:
      1. Comprehensive review of quarterly objectives
      2. heady-montecarlo simulates trajectory toward annual themes
      3. Domain balance assessment across all life areas
      4. Goal adjustment: continue, pivot, or retire goals
      5. Set next quarter's objectives
```

### 4. Implement Cross-Surface Synchronization

```yaml
synchronization:
  context_model:
    principle: life context follows the user across every Heady surface
    storage: HeadyMemory life-os namespace
    sync: real-time via headyos-core event bus

  surface_adaptation:
    heady_mobile:
      focus: quick capture, habit check-offs, on-the-go planning
      features: widgets for habit streaks, today's priorities, quick journal

    heady_web:
      focus: full dashboard, deep planning, review sessions
      features: life domain map, goal trees, analytics, weekly review interface

    heady_desktop:
      focus: productivity integration, focus sessions, deep work tracking
      features: focus timer, task context from life goals, minimal interruptions

    heady_chrome:
      focus: browser context integration, reading tracker, research capture
      features: save articles to learning goals, time tracking, distraction alerts

    heady_vscode_jetbrains:
      focus: developer productivity, career skill tracking
      features: coding time in career domain, learning progress, focus metrics

    voice_vessel:
      focus: hands-free life management
      features: voice journal, verbal habit check-in, morning briefing read-aloud

  offline_support:
    strategy: local-first with sync on reconnect
    storage: essential life context cached on each surface
    conflict_resolution: last-write-wins for simple data, merge for complex structures
```

### 5. Build the Life Dashboard

HeadyWeb primary interface for life management:

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **Today** | HeadyMemory | Daily intentions, calendar, habit check-offs, mood |
| **Life Balance Radar** | heady-metrics | Domain scores as radar chart, trend arrows |
| **Goal Tree** | HeadyMemory | Hierarchical view: vision → themes → objectives → milestones |
| **Habit Board** | heady-metrics | Active habits with streaks, completion rates, trends |
| **Weekly Plan** | HeadyMemory | This week's focus items, progress tracker |
| **Insights** | heady-vinci | Pattern discoveries, recommendations, predictions |
| **Journal** | HeadyMemory | Recent entries, reflection prompts, gratitude log |
| **Atlas View** | heady-atlas | Visual map of life domains, connections, attention flow |

### 6. Privacy and Autonomy

```yaml
privacy:
  principles:
    user_sovereignty: all life data owned by user, exportable, deletable
    minimal_collection: only collect what the user explicitly provides or consents to
    no_surveillance: passive inference requires explicit opt-in per signal type
    domain_isolation: financial data never mixed with health data in processing
    encryption: all life data AES-256 encrypted, user-held keys

  autonomy:
    ai_suggestions: always suggestions, never mandates
    override: user can dismiss any AI recommendation without consequence
    customization: every feature, check-in, and reminder is configurable or disableable
    data_portability: export entire life OS data in standard formats (JSON, CSV, iCal)
```

## Output Format

When designing Life OS Canvas features, produce:

1. **Life OS model** with domains, canvas structure, and balance scoring
2. **Goal and habit engine** with goal types, hierarchy, and formation support
3. **Daily operating rhythm** with morning/midday/evening/weekly/quarterly flows
4. **Cross-surface sync** with per-surface adaptation and offline support
5. **Dashboard** specification with life management panels
6. **Privacy architecture** with sovereignty, isolation, and portability

## Tips

- **headyos-core orchestrates, headyme-core stores** — the OS layer routes between domains; the personal cloud holds the identity and data
- **Life balance is personal** — domain weights differ per user; never impose a universal balance model
- **headybuddy-core is the daily companion** — morning briefings, check-ins, and reviews all flow through the AI companion for relationship continuity
- **heady-atlas makes invisible connections visible** — the life map shows how career goals connect to learning, how wellness affects productivity
- **Habits compound, goals complete** — system goals (habits) drive long-term transformation; outcome goals provide direction; design for both
- **Every surface serves a purpose** — mobile for capture, web for planning, desktop for focus, voice for hands-free; adapt the experience to the context
- **Privacy enables vulnerability** — users will only track deeply personal life data if they trust the privacy model completely; earn that trust
