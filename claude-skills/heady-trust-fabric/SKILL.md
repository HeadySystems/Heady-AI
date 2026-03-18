---
name: heady-trust-fabric
description: Design and operate the Heady Trust Fabric for end-to-end trust verification, reputation scoring, transparency reporting, and multi-party trust establishment across the Heady ecosystem. Use when building trust scores for agents and users, designing transparency reports, implementing provenance tracking for AI-generated content, creating trust-based access policies, or planning governance audit systems. Integrates with heady-sentinel for security enforcement, heady-traces for audit trails, heady-observer for trust monitoring, and heady-vinci for behavioral analysis.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Trust Fabric

Use this skill when you need to **design, build, or operate the Trust Fabric** — Heady's system for establishing, measuring, and maintaining trust across users, agents, services, and content throughout the ecosystem.

## When to Use This Skill

- Building trust and reputation scoring systems for users and agents
- Designing transparency reports for AI-generated content provenance
- Implementing trust-based access policies that adapt to behavioral signals
- Creating governance audit systems with immutable evidence trails
- Planning content provenance tracking and authenticity verification
- Designing multi-party trust establishment for marketplace interactions

## Platform Context

The Trust Fabric weaves across Heady's governance infrastructure:

- **heady-sentinel** — security enforcement, policy engine, secret management; the trust boundary enforcer
- **heady-traces** — immutable audit trail for every action; the evidence layer
- **heady-observer** — real-time monitoring and anomaly detection; the trust watchdog
- **heady-vinci** — behavioral analysis, pattern detection, and trust score modeling
- **heady-metrics** — tracks trust scores, violation counts, and reputation trends
- **heady-logs** — centralized log aggregation for forensic analysis
- **headymcp-core** (31 MCP tools) — trust checks embedded in tool invocation chain
- **HeadyMemory** (`latent-core-dev`, pgvector) — stores trust profiles and reputation history
- **headybot-core** — agent trust lifecycle management
- **HeadyConnection** (`headyconnection-core`) — community trust and reputation
- **heady-docs** — transparency report publishing
- **Promotion Pipeline** (Testing → Staging → Main) — trust gates at each promotion stage

## Instructions

### 1. Define the Trust Model

```yaml
trust_model:
  entity:
    id: uuid
    type: user | agent | service | content | marketplace-item
    trust_score: 0.0 to 1.0 (composite score)
    trust_level: untrusted | basic | verified | trusted | highly-trusted
    status: active | under-review | suspended | revoked

  dimensions:
    identity_verification:
      weight: 0.25
      factors: [email verified, MFA enabled, identity verified, org membership verified]
      score: 0.0-1.0 based on verification completeness

    behavioral_history:
      weight: 0.30
      factors: [action success rate, policy violations, anomaly frequency, account age]
      score: heady-vinci computes from heady-traces history
      decay: trust decays 5% per month of inactivity

    community_reputation:
      weight: 0.20
      factors: [peer reviews, marketplace ratings, community contributions, report count]
      source: HeadyConnection community interactions
      defense: Sybil-resistant (weighted by rater trust score)

    compliance:
      weight: 0.15
      factors: [terms acceptance, data handling compliance, API usage patterns]
      source: heady-sentinel compliance checks

    transparency:
      weight: 0.10
      factors: [content attribution, provenance tracking, disclosure compliance]
      source: heady-traces content provenance records

  composite_calculation:
    formula: weighted sum of dimensions
    thresholds:
      untrusted: 0.0 - 0.2
      basic: 0.2 - 0.4
      verified: 0.4 - 0.6
      trusted: 0.6 - 0.8
      highly_trusted: 0.8 - 1.0
    update_frequency: real-time for violations, hourly for normal recalculation
```

### 2. Build Trust-Based Access Policies

```yaml
trust_policies:
  access_mapping:
    untrusted:
      capabilities: [read-only public content, basic Buddy chat]
      restrictions: [no agents, no memory write, no marketplace, no API keys]
      review: manual review required for any elevation

    basic:
      capabilities: [standard Buddy, personal HeadyMemory, 1 agent]
      restrictions: [no marketplace selling, limited MCP tools, rate limited]
      elevation: automatic after 7 days + email verification

    verified:
      capabilities: [full Buddy, 5 agents, marketplace buying, full MCP tools]
      restrictions: [marketplace selling requires review, elevated trust for admin actions]
      elevation: identity verification + 30 days + clean history

    trusted:
      capabilities: [marketplace selling, team management, API key generation]
      restrictions: [enterprise features require highly-trusted]
      elevation: 90 days + community reputation > 0.6

    highly_trusted:
      capabilities: [all features, beta access, governance participation]
      restrictions: [none within plan limits]
      maintenance: requires sustained clean history; violations cause level drop

  adaptive_policies:
    real_time:
      - heady-sentinel evaluates trust score at every sensitive action
      - heady-observer detects anomalous behavior patterns
      - trust score adjusted immediately on violations
      - access automatically restricted if trust drops below action threshold

    progressive:
      - new users start at basic, earn trust through consistent behavior
      - trust elevation is gradual and transparent
      - user can see their trust score and factors in HeadyWeb dashboard
      - clear guidance on how to improve trust score
```

### 3. Implement Content Provenance Tracking

```yaml
content_provenance:
  purpose: track origin, modifications, and authenticity of AI-generated content

  provenance_record:
    content_id: uuid
    type: text | code | image | audio | avatar
    origin:
      generator: which Heady service created it (heady-coder, heady-imagine, headybuddy-core)
      model: which AI model was used
      prompt: hash of the input prompt (not full prompt, for privacy)
      timestamp: ISO-8601
      user_id: who requested the generation

    chain:
      - action: generated
        by: heady-coder
        at: timestamp
        hash: content hash at this point

      - action: edited
        by: user-id
        at: timestamp
        hash: updated content hash
        diff_summary: what changed

      - action: reviewed
        by: heady-critique
        at: timestamp
        quality_score: 0.0-1.0

    verification:
      method: SHA-256 hash chain
      storage: heady-traces (immutable)
      lookup: anyone with content_id can verify provenance

  disclosure:
    ai_generated: all AI-generated content tagged with provenance metadata
    mixed: content with both human and AI contributions tagged appropriately
    human_only: no provenance tag (absence = human-created)
    display: surfaces show provenance indicator when viewing AI content
```

### 4. Design the Governance Audit System

```yaml
governance_audit:
  audit_trail:
    source: heady-traces (immutable append-only log)
    coverage: every action that affects trust, permissions, content, or financial state
    retention: 7 years for compliance
    access: admin + compliance team via HeadyWeb audit dashboard

  audit_events:
    trust:
      - trust_score_change: { entity, old_score, new_score, reason, evidence }
      - trust_violation: { entity, violation_type, severity, action_taken }
      - trust_elevation: { entity, old_level, new_level, criteria_met }

    access:
      - permission_grant: { grantor, grantee, permission, scope, expiry }
      - permission_revoke: { revoker, revokee, permission, reason }
      - access_denied: { entity, resource, reason, trust_score_at_time }

    content:
      - content_generated: { generator, type, provenance_id }
      - content_flagged: { flagger, content_id, reason }
      - content_removed: { remover, content_id, reason, appeal_window }

    financial:
      - billing_event: { user, amount, type, plan }
      - marketplace_transaction: { buyer, seller, item, amount, commission }

  reporting:
    automated:
      frequency: monthly transparency report
      content: aggregate trust metrics, violation counts, governance actions
      publication: heady-docs transparency page (public)

    on_demand:
      trigger: compliance request, legal hold, security incident
      scope: configurable by date range, entity, event type
      export: structured JSON + human-readable PDF
      authorization: heady-sentinel validates requester permissions

  governance_board:
    composition: platform admins + community representatives (via HeadyConnection)
    authority: policy changes, appeal decisions, trust threshold adjustments
    transparency: all board decisions recorded in heady-traces
```

### 5. Build Multi-Party Trust Establishment

```yaml
multi_party_trust:
  marketplace:
    buyer_seller:
      challenge: buyer trusts seller's skill/plugin quality and safety
      mechanisms:
        - seller trust score visible on listing
        - heady-critique automated quality review
        - heady-sentinel security scan
        - community reviews weighted by reviewer trust score
        - escrow period: 7-day refund window
      dispute_resolution: governance board arbitration

  agent_delegation:
    user_agent:
      challenge: user trusts agent to act within boundaries
      mechanisms:
        - agent trust score based on behavioral history
        - habitat permission boundaries (from Agent Habitat)
        - real-time monitoring via heady-observer
        - action audit trail in heady-traces
        - user can revoke agent trust instantly

  cross_org:
    org_org:
      challenge: HeadyMe, HeadySystems, HeadyConnection trust each other's identity claims
      mechanisms:
        - shared Identity Loom (common identity, org-scoped permissions)
        - cross-org audit trail in heady-traces
        - promotion pipeline validates at each org mirror
```

### 6. Design the Trust Dashboard

HeadyWeb interface for trust management:

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **My Trust Score** | HeadyMemory + heady-metrics | Current score, dimension breakdown, improvement tips |
| **Trust History** | heady-traces | Score changes over time with triggering events |
| **Provenance Viewer** | heady-traces | Content provenance chain for any content item |
| **Governance Log** | heady-traces | Recent governance actions, policy changes |
| **Platform Trust Health** | heady-metrics | Aggregate trust distribution, violation trends |
| **Transparency Report** | heady-docs | Latest published transparency report |

## Output Format

When designing Trust Fabric features, produce:

1. **Trust model** with dimensions, scoring, and level thresholds
2. **Access policies** mapping trust levels to capabilities
3. **Content provenance** with generation tracking and verification
4. **Governance audit** with event types, reporting, and board structure
5. **Multi-party trust** for marketplace, agent delegation, and cross-org scenarios
6. **Dashboard** specification with trust score and governance panels

## Tips

- **Trust is earned gradually, lost instantly** — elevation takes weeks; a single severe violation can drop trust to zero
- **heady-traces is the evidence layer** — every trust decision must have a traceable evidence chain
- **Transparency builds trust** — public trust scores, published provenance, and governance reports show the system works
- **Community reputation resists gaming** — weight reviews by reviewer trust score to prevent Sybil attacks
- **Content provenance is non-optional** — AI-generated content must always be identifiable; this is increasingly a regulatory requirement
- **Trust policies are adaptive** — static rules are brittle; combine heady-vinci behavioral analysis with heady-sentinel policy enforcement
