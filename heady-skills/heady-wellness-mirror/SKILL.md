---
name: heady-wellness-mirror
description: Design and operate the Heady Wellness Mirror for personal health tracking, emotional wellness monitoring, and proactive wellbeing coaching. Use when building mood and energy tracking systems, designing stress detection and intervention workflows, creating wellness goal frameworks, implementing longitudinal health pattern analysis, planning privacy-first health data architectures, or designing CBT-aligned coaching interactions. Integrates with headybuddy-core for wellness coaching delivery, HeadyMemory for longitudinal health profiles, heady-observer for wellness alerts, heady-sentinel for health data privacy, heady-vinci for pattern analysis, and heady-patterns for trend detection.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Wellness Mirror

Use this skill when you need to **design, build, or operate the Wellness Mirror** — Heady's privacy-first personal wellness system that tracks emotional health, energy patterns, and wellbeing signals to provide proactive coaching and self-awareness tools.

## When to Use This Skill

- Building mood, energy, and stress tracking systems
- Designing wellness check-in flows and journaling interfaces
- Creating longitudinal health pattern analysis and visualization
- Implementing CBT-aligned coaching and mindfulness interventions
- Planning privacy-first health data architectures (HIPAA-aware)
- Designing proactive wellness alerts and early intervention triggers

## Platform Context

The Wellness Mirror operates across Heady's wellness infrastructure:

- **headybuddy-core** — AI Companion delivers wellness check-ins, coaching sessions, mindfulness exercises, and emotional support through chat and voice
- **HeadyMemory** (`latent-core-dev`, pgvector) — Stores longitudinal wellness profiles, mood histories, and intervention outcomes as 3D vector embeddings (encrypted, user-owned)
- **heady-observer** — Monitors wellness signals for concerning patterns (sustained low mood, disengagement, crisis indicators) and triggers alerts
- **heady-sentinel** — Enforces health data privacy policies, manages consent, gates access to wellness data with strictest-tier protection
- **heady-vinci** — Analyzes wellness patterns, correlates mood with activity, predicts risk periods
- **heady-patterns** — Detects longitudinal wellness trends: seasonal patterns, stress cycles, recovery trajectories
- **heady-metrics** — Tracks engagement with wellness features, intervention effectiveness, population-level anonymized trends
- **heady-traces** — Audit trail of all wellness data access (compliance requirement)
- **Voice Vessel** (heady-voice-vessel) — Voice-based wellness check-ins with emotional tone analysis
- **HeadyWeb** — Wellness dashboard for personal health visualization
- **heady-mobile** — On-device wellness tracking, push notification reminders

## Instructions

### 1. Define the Wellness Model

```yaml
wellness_mirror:
  data_types:
    mood:
      capture: user-reported (scale 1-5 + optional tags) or inferred (voice tone, interaction patterns)
      frequency: configurable (1-3x daily recommended)
      dimensions: [valence, arousal, dominance]  # PAD emotional model
      tags: [anxious, calm, energized, tired, frustrated, grateful, focused, scattered]

    energy:
      capture: user-reported (scale 1-5) + activity inference
      dimensions: [physical, mental, emotional, social]
      correlation: tracked against sleep, exercise, work patterns

    stress:
      capture: composite signal from mood, energy, interaction patterns
      indicators: [response_latency_change, vocabulary_shift, session_length_change, error_rate]
      levels: [low, moderate, elevated, high, crisis]

    sleep:
      capture: user-reported (duration, quality) or device-synced
      impact: correlated with next-day mood and energy

    activity:
      capture: user-reported or calendar-inferred
      categories: [work, exercise, social, creative, rest, learning]

  privacy_model:
    principle: user owns all wellness data; platform has zero-knowledge access
    encryption: AES-256 at rest, user-held decryption keys
    consent: explicit opt-in per data type, revocable at any time
    retention: user-configurable (default 1 year, max 5 years, delete on request)
    access_control: heady-sentinel enforces strictest-tier protection
    sharing: never shared with employers, insurers, or third parties
    anonymization: population-level insights use differential privacy (epsilon ≤ 1.0)
    audit: every access logged in heady-traces (compliance-grade)
    classification: health_data tier in heady-sentinel (highest protection level)
```

### 2. Build the Check-In System

```yaml
check_in:
  delivery:
    primary: headybuddy-core conversational check-in
    voice: Voice Vessel for hands-free mood capture
    quick: HeadyWeb/heady-mobile one-tap mood widget
    passive: optional inference from interaction patterns (with explicit consent)

  flow:
    morning:
      1. "How are you feeling this morning?" (mood capture)
      2. "How's your energy?" (energy capture)
      3. Optional: sleep quality reflection
      4. Set intention for the day
      5. Store in HeadyMemory wellness namespace

    midday:
      1. Brief mood check (one-tap or voice)
      2. Energy level update
      3. Stress signal check
      4. Optional: guided breathing if stress elevated

    evening:
      1. Day reflection: "What went well today?"
      2. Mood and energy summary
      3. Gratitude prompt (optional)
      4. Tomorrow preparation

  adaptive_timing:
    method: heady-patterns learns optimal check-in times per user
    adjustment: shift timing based on calendar, time zone, response patterns
    frequency: reduce if user shows check-in fatigue; increase if patterns concerning
    nudge: gentle reminder if check-in missed, never punitive
```

### 3. Design Pattern Analysis

```yaml
pattern_analysis:
  engines:
    heady_vinci:
      - mood_correlation: identify what activities, people, times correlate with mood states
      - stress_prediction: predict high-stress periods from calendar + historical patterns
      - intervention_effectiveness: measure which coaching techniques work best for this user
      - risk_detection: identify concerning multi-day patterns before crisis

    heady_patterns:
      - seasonal_trends: detect mood variations across seasons (SAD patterns)
      - weekly_cycles: identify day-of-week patterns (Monday dips, weekend recovery)
      - trigger_identification: discover specific events that reliably affect mood
      - recovery_trajectories: model how quickly user bounces back from low periods

  longitudinal:
    storage: HeadyMemory time-series wellness embeddings
    granularity: daily aggregates + event-level detail
    comparison: week-over-week, month-over-month trend analysis
    milestones: track improvement over extended periods (3-month, 6-month, 1-year views)

  alerts:
    engine: heady-observer
    triggers:
      sustained_low_mood: 3+ days below user's baseline → gentle check-in + coaching offer
      energy_crash: sudden drop in all energy dimensions → suggest rest, check workload
      stress_escalation: progressive increase over 5+ days → proactive intervention
      disengagement: check-in abandonment + reduced platform usage → outreach
      crisis_indicators: language patterns suggesting self-harm → immediate safety resources
    response:
      non_crisis: coaching adjustment, resource suggestions, community connection
      crisis: display crisis hotline numbers, suggest professional help, warm handoff guidance
      escalation: never automated; always provide human resources, never diagnose
```

### 4. Implement Coaching Interventions

```yaml
coaching:
  frameworks:
    cbt_aligned:
      description: cognitive behavioral techniques adapted for AI coaching
      techniques:
        thought_records: guided identification of automatic thoughts and cognitive distortions
        behavioral_activation: activity scheduling to improve mood through engagement
        cognitive_reframing: gentle perspective shifts on negative interpretations
        exposure_hierarchy: graduated approach to anxiety-provoking situations (with professional guidance)
      boundary: NOT therapy; always clarify distinction and recommend professionals for clinical needs

    mindfulness:
      techniques:
        breathing_exercises: guided breathing (box breathing, 4-7-8, coherent breathing)
        body_scan: progressive awareness exercise delivered via voice or text
        grounding: 5-4-3-2-1 sensory grounding for acute stress
        gratitude_practice: daily gratitude journaling with reflection
      delivery: headybuddy-core or Voice Vessel

    positive_psychology:
      techniques:
        strengths_identification: discover and leverage character strengths
        flow_state_tracking: identify activities that produce flow states
        savoring: guided attention to positive experiences
        meaning_making: connect daily activities to larger values and purpose

  personalization:
    method: heady-vinci selects techniques based on user profile, current state, and past effectiveness
    adaptation: intervention intensity scales with need (light touch when stable, more support when struggling)
    preference: user can favorite or dismiss specific techniques
    tracking: heady-metrics records intervention outcomes for effectiveness analysis
```

### 5. Design the Wellness Dashboard

HeadyWeb interface for personal wellness management:

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **Today's Check-In** | HeadyMemory | Current mood, energy, stress with one-tap entry |
| **Mood Timeline** | HeadyMemory | 7-day, 30-day, 90-day mood trend visualization |
| **Energy Map** | HeadyMemory | Physical/mental/emotional/social energy radar chart |
| **Pattern Insights** | heady-vinci | Discovered correlations and predictions |
| **Wellness Streak** | heady-metrics | Consecutive check-in days, engagement trends |
| **Coaching History** | heady-traces | Past interventions with effectiveness ratings |
| **Resources** | heady-docs | Curated wellness resources, crisis contacts |

### 6. Safety and Ethical Boundaries

```yaml
safety:
  scope_boundaries:
    is: personal wellness tracking, self-awareness, coaching, mindfulness
    is_not: medical diagnosis, therapy, psychiatric treatment, medication advice
    always: recommend professional help for clinical concerns
    never: diagnose conditions, prescribe treatments, replace licensed professionals

  crisis_protocol:
    detection: heady-observer monitors for crisis language patterns
    response:
      1. Acknowledge the user's feelings with empathy
      2. Provide crisis hotline numbers (988 Suicide & Crisis Lifeline, Crisis Text Line)
      3. Suggest contacting a trusted person or professional
      4. Offer to help find local mental health resources
      5. Log event in heady-traces (for safety, not surveillance)
    follow_up: gentle check-in next day (if user consents)

  data_ethics:
    no_manipulation: wellness data never used to influence purchasing or engagement
    no_scoring: wellness data never contributes to trust scores or access decisions
    no_employer_access: wellness data completely isolated from organizational features
    transparency: user can export all wellness data in standard format at any time
    deletion: complete data erasure on request within 24 hours
```

## Output Format

When designing Wellness Mirror features, produce:

1. **Wellness model** with data types, privacy architecture, and consent framework
2. **Check-in system** with delivery modes, flow design, and adaptive timing
3. **Pattern analysis** with correlation engines, longitudinal tracking, and alert triggers
4. **Coaching interventions** with CBT-aligned, mindfulness, and positive psychology techniques
5. **Dashboard** specification with personal wellness visualization
6. **Safety boundaries** with scope limits, crisis protocol, and data ethics

## Tips

- **Privacy is non-negotiable** — wellness data gets the highest protection tier in heady-sentinel; encrypt everything, log every access, never share
- **NOT therapy** — always maintain clear boundary between wellness coaching and clinical treatment; recommend professionals early and often
- **headybuddy-core is the gentle coach** — wellness interactions require warmth, patience, and non-judgment; the companion persona is critical
- **Patterns emerge over time** — longitudinal data in HeadyMemory is the real value; encourage consistent check-ins without creating obligation anxiety
- **Crisis safety is a hard requirement** — heady-observer must detect crisis signals and respond with human resources immediately; never leave a user in distress without direction
- **User agency always** — the user controls what's tracked, who sees it, and when it's deleted; wellness features are opt-in and configurable
