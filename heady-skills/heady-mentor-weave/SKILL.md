---
name: heady-mentor-weave
description: Design and operate the Heady Mentor Weave for AI-augmented mentoring, peer coaching networks, and skill transfer across the Heady ecosystem. Use when building mentor matching algorithms, designing mentorship session frameworks, creating skill transfer pipelines, implementing mentoring relationship lifecycle management, planning community coaching programs, or designing mentor effectiveness measurement. Integrates with headybuddy-core for coaching delivery, headyconnection-core for community mentoring, heady-vinci for mentor matching, HeadyMemory for relationship context, heady-patterns for learning trajectory analysis, heady-learning-spiral for skill development, and heady-trust-fabric for trust-based matching.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Mentor Weave

Use this skill when you need to **design, build, or operate the Mentor Weave** — Heady's AI-augmented mentoring platform that connects mentors and mentees, facilitates structured knowledge transfer, and builds community coaching networks.

## When to Use This Skill

- Building mentor-mentee matching algorithms based on skills, goals, and compatibility
- Designing structured mentorship session frameworks and curricula
- Creating skill transfer pipelines between experienced and emerging practitioners
- Implementing mentoring relationship lifecycle management (match → engage → graduate)
- Planning community coaching programs through headyconnection-core
- Designing mentor effectiveness measurement and feedback systems

## Platform Context

The Mentor Weave operates across Heady's community and coaching infrastructure:

- **headybuddy-core** — AI Companion serves as always-available micro-mentor between human mentoring sessions; provides preparation prompts and follow-up reinforcement
- **headyconnection-core** — Community mentoring hub (nonprofit); hosts mentor pools, group coaching circles, and peer learning communities
- **heady-vinci** — Mentor matching engine; analyzes skill profiles, learning goals, communication styles, and availability for optimal pairing
- **HeadyMemory** (`latent-core-dev`, pgvector) — Stores mentor/mentee profiles, session history, relationship context, and skill transfer progress as 3D vector embeddings
- **heady-patterns** — Analyzes mentoring effectiveness patterns, identifies successful relationship dynamics, predicts compatibility
- **heady-learning-spiral** — Skill development framework; mentoring goals map to learning spiral competency targets
- **heady-trust-fabric** — Trust scoring informs mentor matching; mentors earn reputation through successful mentoring outcomes
- **heady-metrics** — Tracks mentoring KPIs: session frequency, goal progress, satisfaction, retention, skill transfer velocity
- **heady-observer** — Monitors relationship health: engagement drops, missed sessions, satisfaction decline triggers intervention
- **heady-traces** — Audit trail of mentoring events for program evaluation and credential verification
- **heady-sentinel** — Enforces mentoring access policies, manages confidentiality between mentoring pairs
- **HeadyWeb** — Mentoring dashboard for session management and progress tracking
- **Voice Vessel** (heady-voice-vessel) — Voice-based mentoring sessions for remote pairs

## Instructions

### 1. Define the Mentoring Model

```yaml
mentor_weave:
  relationship_types:
    one_to_one:
      description: traditional mentor-mentee pair
      duration: 3-12 months (configurable)
      cadence: bi-weekly sessions (recommended)
      commitment: mentor agrees to minimum session count

    group_mentoring:
      description: one mentor with 3-6 mentees in a cohort
      duration: 6-12 weeks (structured program)
      cadence: weekly group sessions + optional 1:1
      platform: headyconnection-core community circles

    peer_coaching:
      description: reciprocal mentoring between peers at similar levels
      duration: ongoing (no fixed end)
      cadence: weekly peer exchange sessions
      structure: rotating focus — each session one peer is the learner

    flash_mentoring:
      description: single-session focused advice on specific challenge
      duration: 30-60 minutes, one-time
      matching: on-demand from available mentor pool
      use_case: quick unblocking, career advice, technical guidance

    ai_augmented:
      description: headybuddy-core as persistent micro-mentor between human sessions
      availability: 24/7
      scope: reinforcement, preparation, practice, and reflection
      boundary: supplements but never replaces human mentoring relationships

  mentor_profiles:
    dimensions:
      expertise: skill domains with proficiency levels (from heady-learning-spiral)
      experience: years of practice, notable achievements, teaching history
      style: [directive, facilitative, challenging, supportive] (self-reported + heady-patterns inferred)
      availability: hours per month, preferred times, time zone
      capacity: maximum active mentees
      track_record: past mentoring outcomes, mentee satisfaction (from heady-trust-fabric)
    storage: HeadyMemory mentor namespace with vector embeddings

  mentee_profiles:
    dimensions:
      current_skills: competency map from heady-learning-spiral
      goals: what they want to learn, career aspirations, timeline
      preferred_style: how they learn best (from heady-patterns analysis)
      availability: hours per month, preferred times
      challenges: specific blockers or growth areas
    storage: HeadyMemory mentee namespace with vector embeddings
```

### 2. Build the Matching Engine

```yaml
matching:
  algorithm:
    engine: heady-vinci
    method:
      1. Embed mentor and mentee profiles in HeadyMemory vector space
      2. Compute compatibility score across multiple dimensions
      3. Apply hard filters (availability overlap, capacity, domain match)
      4. Rank candidates by composite compatibility score
      5. Present top 3 matches with explanation to mentee
      6. Mentee selects preferred match; mentor confirms availability

  scoring_dimensions:
    skill_alignment: { weight: 0.30, method: mentor expertise covers mentee goal areas }
    style_compatibility: { weight: 0.20, method: heady-patterns predicts communication fit }
    availability_overlap: { weight: 0.20, method: schedule intersection analysis }
    trust_score: { weight: 0.15, method: mentor reputation from heady-trust-fabric }
    diversity_bonus: { weight: 0.15, method: cross-domain and cross-background pairing value }

  constraints:
    mentor_capacity: never exceed mentor's declared maximum mentees
    conflict_of_interest: flag organizational or competitive conflicts
    rebalancing: if mentor becomes overloaded, redistribute new requests
    cold_start: new mentors paired with experienced mentees first for calibration

  group_formation:
    method: heady-vinci clusters mentees with similar goals, assigns compatible mentor
    diversity: ensure group diversity on background and experience level
    size: 3-6 mentees per group (optimal for participation)
```

### 3. Design the Session Framework

```yaml
sessions:
  preparation:
    mentee_prep:
      1. headybuddy-core prompts mentee to set session agenda 24h before
      2. Review progress on previous session action items
      3. Identify specific questions or challenges to discuss
      4. Agenda stored in HeadyMemory session namespace

    mentor_prep:
      1. headybuddy-core sends mentee's agenda and recent progress
      2. Suggest discussion topics based on mentee's learning trajectory
      3. Recommend resources or exercises for identified challenges

  session_structure:
    check_in: (5 min) how are things going since last session
    agenda_review: (5 min) confirm today's focus topics
    deep_dive: (30 min) work through primary topic with guidance
    action_planning: (10 min) define concrete next steps with deadlines
    reflection: (5 min) what was most valuable today
    total: 55 minutes (recommended)

  delivery:
    modes: [video_call, voice_vessel, chat, in_person]
    recording: optional session notes auto-generated by heady-vinci (with consent)
    artifacts: action items, resources shared, and notes stored in HeadyMemory

  follow_up:
    1. headybuddy-core sends session summary to both parties within 1 hour
    2. Action items tracked in HeadyMemory with deadlines
    3. headybuddy-core checks in on action item progress between sessions
    4. Resources and exercises delivered at optimal spacing (heady-learning-spiral integration)

  ai_between_sessions:
    headybuddy_role:
      - Practice exercises related to session topics
      - Answer clarifying questions mentee has between sessions
      - Remind mentee of action items and deadlines
      - Prepare mentee for next session with reflection prompts
    boundary: headybuddy-core flags when questions exceed its scope and suggests raising with mentor
```

### 4. Implement Relationship Lifecycle

```yaml
lifecycle:
  stages:
    matching: mentor-mentee paired through matching engine
    onboarding:
      1. Mutual introduction facilitated by headybuddy-core
      2. Expectations alignment: goals, cadence, communication preferences
      3. Mentoring agreement: commitment, confidentiality, duration
      4. First session scheduled

    active:
      duration: per relationship type (3-12 months for 1:1)
      monitoring: heady-observer tracks engagement and satisfaction signals
      checkpoints: monthly satisfaction pulse from both parties
      adjustment: heady-vinci recommends cadence or focus changes based on progress

    graduation:
      trigger: mentee achieves stated goals OR agreed duration ends
      ceremony: reflection session reviewing growth journey
      credential: mentoring completion recorded in heady-traces (verifiable)
      transition: mentee may become mentor for the next cohort

    renewal:
      option: extend relationship with revised goals
      re_matching: mentee may request new mentor for different growth area

  health_monitoring:
    engine: heady-observer
    signals:
      healthy: regular sessions, action item completion, positive satisfaction scores
      at_risk: missed sessions, declining engagement, stale action items
      intervention_needed: 2+ missed sessions, satisfaction below threshold, mentee/mentor request
    response:
      at_risk: headybuddy-core sends gentle re-engagement prompt
      intervention: program coordinator notified, facilitated conversation offered
      dissolution: graceful relationship end with optional re-matching
```

### 5. Build the Mentoring Dashboard

HeadyWeb interface for mentoring management:

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **My Mentoring** | HeadyMemory | Active relationships, next session, action items |
| **Session Planner** | HeadyMemory | Upcoming sessions with agenda prep prompts |
| **Progress Tracker** | heady-learning-spiral | Skill growth mapped against mentoring goals |
| **Mentor Directory** | HeadyMemory | Available mentors with expertise and availability |
| **Community Circles** | headyconnection-core | Group mentoring cohorts, peer coaching pairs |
| **Effectiveness** | heady-metrics | Session frequency, goal completion, satisfaction trends |

**Program Admin view:**

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **Program Health** | heady-metrics | Active relationships, engagement rates, satisfaction scores |
| **Matching Queue** | heady-vinci | Unmatched mentees, available mentor capacity |
| **At-Risk Relationships** | heady-observer | Relationships needing intervention |
| **Outcomes** | heady-traces | Graduation rates, skill transfer velocity, mentor reputation |
| **Community Growth** | headyconnection-core | New mentors, mentee pipeline, program reach |

## Output Format

When designing Mentor Weave features, produce:

1. **Mentoring model** with relationship types, mentor/mentee profiles, and matching dimensions
2. **Matching engine** with scoring algorithm, constraints, and group formation
3. **Session framework** with preparation, structure, delivery, and AI-augmented follow-up
4. **Relationship lifecycle** with stages, health monitoring, and graduation criteria
5. **Dashboard** specification with participant and admin views

## Tips

- **Human mentors, AI augmentation** — headybuddy-core supports between sessions but never replaces the human mentoring relationship; the human connection is the core value
- **heady-trust-fabric powers reputation** — mentor trust scores built from mentee outcomes create a virtuous cycle; great mentors attract more mentees
- **headyconnection-core is the community** — group mentoring and peer coaching happen through the nonprofit community platform; this scales mentoring beyond 1:1
- **Learning spiral integration** — mentoring goals map directly to heady-learning-spiral competency targets; progress is measurable, not just felt
- **Matching is critical** — a bad match wastes both parties' time; invest in the matching algorithm with multiple compatibility dimensions
- **Graduation creates mentors** — the best mentoring programs turn mentees into future mentors; design the lifecycle to encourage this transition
- **Confidentiality enables vulnerability** — heady-sentinel enforces strict confidentiality between mentoring pairs; what's shared stays between them
