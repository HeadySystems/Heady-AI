---
name: heady-donor-resonance-engine
description: Design the Heady Donor Resonance Engine for intelligent donor engagement, cultivation, and stewardship in nonprofit fundraising. Use when building donor scoring models, designing personalized cultivation journeys, predicting giving propensity, automating stewardship, or planning donor communication strategies. Integrates with HeadyMemory for relationship history, heady-vinci for propensity prediction, and HeadyConnection for team-based relationship management.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Donor Resonance Engine

Use this skill when you need to **design, build, or operate the Donor Resonance Engine** — Heady's intelligent system for understanding donor motivations, predicting giving behavior, and orchestrating personalized engagement through the HeadyConnection nonprofit surfaces.

## When to Use This Skill

- Designing donor scoring and segmentation models
- Building personalized cultivation journeys from prospect to major donor
- Creating giving propensity predictions using heady-vinci
- Automating stewardship touchpoints via HeadyMCP orchestration
- Planning donor communication strategies with resonance matching
- Designing the donor relationship dashboard on HeadyWeb

## Platform Context

The Donor Resonance Engine integrates across:

- **HeadyMemory** (`latent-core-dev`, pgvector) — stores every donor interaction, preference, and relationship signal in 3D vector space for semantic recall
- **heady-vinci** — pattern recognition and propensity prediction from donor behavior data
- **HeadyConnection** (`headyconnection-core`) — collaborative donor management workspace for development teams
- **HeadyMCP** (`headymcp-core`, 31 tools) — orchestrates automated stewardship workflows
- **heady-observer** — monitors engagement signals and triggers alerts for at-risk donors
- **heady-sentinel** — watches for anomalous giving patterns (potential fraud or data errors)
- **HeadyBuddy** (`headybuddy-core`) — AI companion assists fundraisers with talking points and donor context before meetings

## Instructions

### 1. Define the Donor Resonance Model

```yaml
donor_profile:
  id: uuid
  name: display-name
  type: individual | foundation | corporation | daf

  giving_history:
    lifetime_giving: total amount
    first_gift_date: ISO-8601
    last_gift_date: ISO-8601
    gift_count: total number
    average_gift: mean size
    largest_gift: max single gift
    frequency: one-time | occasional | annual | monthly
    trend: increasing | stable | decreasing | lapsed
    channels: [online, event, mail, in-person]
    designated_programs: [funded programs]
    # All history stored in HeadyMemory for semantic recall

  resonance:
    primary_motivation: impact | community | legacy | faith | gratitude | peer
    emotional_triggers: [stories, data, urgency, vision, belonging]
    communication_pref: email | phone | mail | in-person | text
    engagement_level: passive | responsive | active | champion
    interests: [program areas, causes]
    connection_points: [board-member, event-attendee, volunteer, parent]
    # Resonance profile derived from HeadyMemory interaction patterns

  scores:
    affinity: 0.0-1.0
    capacity: 0.0-1.0
    propensity: 0.0-1.0    # predicted by heady-vinci
    rfm_composite: 0.0-1.0  # recency + frequency + monetary
    resonance_composite: weighted combination

  segments: [major-donor, monthly-giver, lapsed, prospect, event-donor, champion]
```

### 2. Build the Scoring Engine with Heady Tools

```
1. mcp_Heady_heady_memory(query="all interactions with [donor name]", limit=20)
2. mcp_Heady_heady_vinci(data="{interaction history}", action="recognize") → identify engagement patterns
3. mcp_Heady_heady_vinci(data="{patterns + giving history}", action="predict") → propensity score
4. mcp_Heady_heady_embed(text="[donor interest keywords]") → affinity vector
5. Compare affinity vector against org mission vector → affinity score
```

| Score | Signals | Heady Tool |
|-------|---------|-----------|
| **Affinity** | Event attendance, volunteer hours, email engagement, site visits | HeadyMemory semantic similarity |
| **Capacity** | Giving history, peer giving levels | heady-vinci pattern recognition |
| **Propensity** | Recency, engagement trend, seasonal pattern | heady-vinci predictive model |
| **RFM** | Last gift date, frequency, average amount | heady-metrics aggregation |

### 3. Design Cultivation Journeys

Orchestrated via HeadyMCP with heady-observer triggers:

**New Donor Journey:**
```
Day 0:   Gift → heady-observer fires → thank-you via preferred channel
Day 3:   heady_coder generates welcome packet with matching impact story
Day 14:  heady_memory recalls upcoming events → invitation sent
Day 30:  heady_memory pulls impact data → "here's what your gift did"
Day 60:  heady_vinci predicts engagement likelihood → engagement offer
Day 90:  heady_vinci propensity check → upgrade ask if score > 0.6
```

**Lapsed Donor Re-engagement:**
```
Month 0:  heady-observer detects lapse (18+ months) → alerts development team
Week 1:   mcp_Heady_heady_memory(query="relationship history") → context for personal outreach
Week 1:   HeadyBuddy prepares talking points for fundraiser's call
Week 3:   heady_coder generates personalized impact update on their historical interests
Week 6:   Low-barrier re-engagement offer (survey, tour, event)
Week 10:  Gentle re-ask calibrated by heady-vinci propensity score
```

**Major Donor Stewardship:**
```
Ongoing:  HeadyBuddy pre-briefs fundraiser before every contact
Ongoing:  heady-observer monitors engagement signals, alerts on decay
Quarterly: heady_coder generates custom impact report on their funded programs
Annual:   Invitation to strategic advisory role
As-needed: heady-vinci identifies new giving opportunity matching their interests
```

### 4. Build Resonance-Matched Communication

Use HeadyMemory to personalize every touchpoint:

```
1. mcp_Heady_heady_memory(query="[donor] motivation and preferences")
2. Select message frame matching primary_motivation:
   - impact → "Your gift changed 47 lives"
   - community → "You're part of something bigger"
   - legacy → "Creating lasting change"
3. mcp_Heady_heady_coder(prompt="compose [message type] for [donor] using [resonance frame]")
4. Route via preferred channel
5. Log touchpoint in HeadyMemory with heady_soul(action="learn")
```

| Motivation | Message Frame | Content Type |
|-----------|--------------|-------------|
| Impact | "Your gift changed 47 lives" | Data + outcomes from Impact Ledger |
| Community | "You're part of something bigger" | Group stories, peer lists |
| Legacy | "Creating lasting change" | Long-term vision, naming opportunities |
| Gratitude | "Giving back" | Personal stories, testimony |

### 5. Automate Stewardship via HeadyMCP

```yaml
stewardship_automations:
  - trigger: gift_received (heady-observer)
    mcp_chain:
      - heady_memory: log gift, update RFM
      - heady_vinci: recalculate propensity
      - heady_coder: generate thank-you matching resonance profile
      - heady_soul: learn from gift context

  - trigger: lapse_risk (heady-vinci propensity < 0.3)
    mcp_chain:
      - heady_memory: pull full relationship history
      - alert: development team via HeadyConnection
      - heady_coder: draft re-engagement message

  - trigger: giving_upgrade (gift > 2x average)
    mcp_chain:
      - heady_sentinel: verify not anomalous
      - alert: ED via HeadyBuddy
      - heady_coder: draft elevated thank-you
      - heady_memory: update segment classification

  - trigger: anniversary_of_first_gift (heady-observer)
    mcp_chain:
      - heady_metrics: pull cumulative impact
      - heady_coder: generate anniversary message with lifetime impact summary
```

### 6. Design the Donor Dashboard on HeadyWeb

| Panel | Data Source | Role |
|-------|-----------|------|
| **Portfolio** | HeadyMemory (assigned donors with scores) | Fundraiser |
| **Pipeline** | HeadyConnection (prospects by stage) | Development director |
| **Alerts** | heady-observer (lapse risks, overdue touches) | All development staff |
| **Giving Trends** | heady-metrics (revenue by segment, channel, period) | Leadership |
| **Engagement Feed** | heady-traces (recent interactions across channels) | Fundraiser |
| **Predictions** | heady-vinci (propensity forecasts, upgrade candidates) | Development director |

## Output Format

When designing Donor Resonance features, produce:

1. **Donor profile schema** with HeadyMemory integration
2. **Scoring models** with heady-vinci prediction pipeline
3. **Cultivation journey** maps with MCP tool chains at each step
4. **Resonance communication** framework
5. **Stewardship automations** with heady-observer triggers
6. **Dashboard** design with data sources per panel

## Tips

- **HeadyMemory is your CRM** — every interaction, preference, and outcome stored for semantic recall
- **heady-vinci predicts, humans connect** — use propensity scores to prioritize, not to replace personal relationships
- **HeadyBuddy pre-briefs fundraisers** — before every donor meeting, Buddy pulls context and suggests talking points
- **heady-observer prevents drops** — engagement decay is detectable weeks before a donor fully lapses
- **Auditability builds board confidence** — heady-traces provides a complete record of stewardship activities
- **Resonance beats demographics** — why someone gives matters more than their age or zip code
