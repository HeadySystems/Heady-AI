---
name: heady-learning-spiral
description: Design and operate the Heady Learning Spiral for adaptive education, skill development, and personalized coaching. Use when building learning path engines, designing spaced-repetition systems, creating competency assessment frameworks, implementing adaptive curriculum generators, planning coaching workflows for users or agents, or designing knowledge gap analysis. Integrates with headybuddy-core for coaching delivery, heady-vinci for learning pattern analysis, HeadyMemory for learner profiles, heady-patterns for skill progression modeling, heady-stories for educational content generation, and heady-soul for agent learning optimization.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Learning Spiral

Use this skill when you need to **design, build, or operate the Learning Spiral** — Heady's adaptive education and coaching system that personalizes learning paths for both human users and AI agents across the ecosystem.

## When to Use This Skill

- Building adaptive learning path engines for users or agents
- Designing spaced-repetition and mastery-based progression systems
- Creating competency assessment and certification frameworks
- Implementing coaching workflows that adapt to learner performance
- Planning knowledge gap analysis and remediation strategies
- Designing agent training curricula for heady-soul skill development

## Platform Context

The Learning Spiral operates across Heady's education infrastructure:

- **headybuddy-core** — AI Companion that delivers coaching sessions, tracks progress, and adapts teaching style to individual learners
- **heady-vinci** — Analyzes learning patterns, predicts struggle points, and recommends curriculum adjustments
- **HeadyMemory** (`latent-core-dev`, pgvector) — Stores learner profiles, competency maps, and learning history as 3D vector embeddings for semantic retrieval
- **heady-patterns** — Models skill progression curves, identifies learning style clusters, and detects plateau patterns
- **heady-stories** — Generates educational content: explanations, examples, analogies, practice exercises tailored to learner level
- **heady-soul** — Agent learning optimization: trains agents through structured curricula, measures skill acquisition
- **heady-metrics** — Tracks learning velocity, retention rates, completion rates, competency scores
- **heady-observer** — Monitors learning health: engagement drops, frustration signals, abandonment risk
- **heady-traces** — Audit trail of all learning events for compliance and credential verification
- **heady-sentinel** — Enforces learning access policies, gates credential issuance
- **headyconnection-core** — Community learning: peer tutoring, study groups, collaborative problem-solving (nonprofit)
- **HeadyWeb** — Learning dashboard surface for progress visualization
- **headymcp-core** (31 MCP tools) — Backend capabilities powering learning operations

## Instructions

### 1. Define the Learning Model

```yaml
learning_spiral:
  learner_types:
    - type: human_user
      profile_source: HeadyMemory learner namespace
      dimensions: [domain_knowledge, skill_proficiency, learning_velocity, engagement_level, preferred_modality]

    - type: ai_agent
      profile_source: heady-soul training records
      dimensions: [task_competency, tool_mastery, reasoning_depth, collaboration_skill, safety_compliance]

  spiral_structure:
    concept: learning revisits topics at increasing depth (spiral curriculum)
    levels:
      exposure: first encounter — build awareness and vocabulary
      practice: guided exercises — apply concepts with scaffolding
      mastery: independent application — solve novel problems
      integration: cross-domain synthesis — connect concepts across domains
      teaching: explain to others — deepest understanding validation

  competency_model:
    scoring: 0.0 to 1.0 per skill node
    granularity: skill trees with prerequisite edges (DAG)
    assessment: multi-modal (quiz, project, peer review, heady-vinci evaluation)
    storage: HeadyMemory competency namespace with vector embeddings
    freshness: competency scores decay without reinforcement (configurable half-life)
```

### 2. Build the Adaptive Curriculum Engine

```yaml
curriculum_engine:
  path_generation:
    input: learner profile + target competency + available time
    engine: heady-vinci
    method:
      1. Assess current competency map from HeadyMemory
      2. Identify gap between current and target competencies
      3. Topological sort of prerequisite skill DAG
      4. Select optimal learning sequence (minimize total time to target)
      5. Assign spiral level per topic based on prior exposure
      6. Generate content plan via heady-stories
      7. Store curriculum in HeadyMemory learning namespace

  adaptation:
    triggers:
      - assessment_result: adjust difficulty and pacing after each assessment
      - engagement_drop: heady-observer detects disengagement → simplify or change modality
      - plateau_detected: heady-patterns identifies stall → introduce new approach or peer learning
      - rapid_mastery: skip ahead in spiral, increase depth
      - frustration_signal: reduce difficulty, offer encouragement, suggest break

    strategies:
      scaffolding: provide hints, worked examples, partial solutions for struggling learners
      interleaving: mix topics to improve long-term retention
      spacing: increase intervals between reviews as mastery grows (Ebbinghaus-informed)
      elaboration: connect new material to learner's existing knowledge graph
      retrieval_practice: test recall before providing review material

  content_generation:
    engine: heady-stories
    formats:
      - explanation: clear prose tailored to learner level
      - example: concrete scenario from learner's domain
      - analogy: bridge from known concepts to new ones
      - exercise: practice problem with automated evaluation
      - project: multi-step challenge requiring concept integration
      - quiz: retrieval practice with immediate feedback
```

### 3. Design the Coaching Workflow

```yaml
coaching:
  delivery: headybuddy-core (chat, voice via Voice Vessel, or visual via HeadyWeb)

  session_structure:
    warm_up: review previous session outcomes, reinforce retention
    teach: introduce new concept at appropriate spiral level
    practice: guided exercise with real-time feedback
    assess: check understanding through retrieval practice
    plan: set goals for next session, schedule review

  coaching_styles:
    socratic: ask probing questions, guide learner to discover answers
    directive: provide clear instruction for procedural knowledge
    collaborative: work through problems together, think aloud
    supportive: emphasize encouragement, normalize struggle, celebrate progress
    challenging: push boundaries for advanced learners, introduce edge cases

  style_selection:
    method: heady-vinci analyzes learner profile and session context
    factors: [learner_preference, topic_type, current_confidence, recent_performance]
    override: learner can explicitly request a style

  memory_integration:
    session_notes: stored in HeadyMemory per learner
    progress_markers: competency updates after each session
    relationship_context: coaching rapport tracked across sessions
    insight_patterns: heady-patterns identifies recurring struggles for curriculum adjustment
```

### 4. Implement Spaced Repetition System

```yaml
spaced_repetition:
  algorithm: SM-2 variant adapted for multi-modal content
  schedule:
    new_item: review at 1d, 3d, 7d, 14d, 30d, 90d
    correct_recall: interval multiplied by ease factor (default 2.5)
    incorrect_recall: interval reset to 1d, ease factor reduced by 0.2 (minimum 1.3)
    partial_recall: interval halved, ease factor reduced by 0.1

  integration:
    storage: HeadyMemory review schedule namespace
    delivery: headybuddy-core sends review prompts at scheduled times
    format: varies by content type (flashcard, mini-quiz, application exercise)
    tracking: heady-metrics records retention curves per learner per topic

  optimization:
    load_balancing: distribute reviews evenly across days to prevent overload
    priority: high-prerequisite skills reviewed first
    freshness: heady-vinci predicts which items are at risk of forgetting
```

### 5. Build Assessment and Credentialing

```yaml
assessment:
  types:
    formative: continuous low-stakes checks during learning (auto-evaluated)
    summative: milestone assessments at spiral level transitions
    portfolio: collection of projects demonstrating competency breadth
    peer_review: headyconnection-core community members evaluate work

  evaluation:
    automated: heady-vinci scores against rubrics, provides detailed feedback
    comparative: heady-battle ranks responses against exemplar answers
    critique: heady-critique provides structured improvement suggestions

  credentialing:
    issuance: heady-sentinel validates competency thresholds before granting credentials
    storage: HeadyMemory credential namespace + heady-traces immutable record
    verification: cryptographic proof of competency (verifiable by third parties)
    expiration: credentials require periodic revalidation (configurable per domain)

  agent_assessment:
    method: heady-soul evaluates agent skill acquisition through task performance
    metrics: [task_success_rate, tool_usage_efficiency, safety_compliance, collaboration_quality]
    certification: agents earn capability badges gating access to advanced tools
```

### 6. Build the Learning Dashboard

HeadyWeb interface for learning management:

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **My Learning Path** | HeadyMemory | Current curriculum, progress, next steps |
| **Competency Map** | HeadyMemory | Skill tree with mastery levels, visual heat map |
| **Review Schedule** | HeadyMemory | Upcoming spaced repetition reviews |
| **Session History** | heady-traces | Past coaching sessions with outcomes |
| **Achievements** | heady-traces | Earned credentials and badges |
| **Learning Velocity** | heady-metrics | Speed of skill acquisition over time |
| **Community Learning** | headyconnection-core | Peer tutoring matches, study groups |

**Instructor/Admin view:**

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **Cohort Progress** | heady-metrics | Class-level competency distribution and trends |
| **Engagement Health** | heady-observer | At-risk learners, engagement anomalies |
| **Content Effectiveness** | heady-vinci | Which content items have highest learning impact |
| **Curriculum Editor** | HeadyMemory | Manage skill trees, prerequisites, and content |

## Output Format

When designing Learning Spiral features, produce:

1. **Learning model** with learner types, spiral structure, and competency scoring
2. **Curriculum engine** with adaptive path generation and content strategies
3. **Coaching workflow** with session structure, style selection, and memory integration
4. **Spaced repetition** with scheduling algorithm and optimization
5. **Assessment** with evaluation types, credentialing, and agent assessment
6. **Dashboard** specification with learner and instructor views

## Tips

- **Spiral, not linear** — learners revisit topics at increasing depth; design curricula that circle back with new complexity
- **headybuddy-core is the coach** — all learner-facing interaction flows through the AI companion; leverage its persona and rapport
- **HeadyMemory is the learner's brain** — store competency maps, learning history, and review schedules as vector embeddings for semantic retrieval
- **heady-vinci predicts, heady-patterns detects** — vinci forecasts struggle points proactively; patterns identifies them retroactively from data
- **Agent learning mirrors human learning** — heady-soul uses the same spiral structure to train agents, creating consistency across the platform
- **Community amplifies learning** — headyconnection-core enables peer tutoring and collaborative problem-solving; social learning is a force multiplier
- **Credentials are trust signals** — learning achievements feed into the Trust Fabric (heady-trust-fabric); verified competency increases trust scores
