---
name: heady-identity-loom
description: Design and operate the Heady Identity Loom for user identity management, federated authentication, cross-org identity linking, and privacy-preserving identity verification across the Heady ecosystem. Use when building authentication flows, designing cross-org SSO, managing user profiles across HeadyMe/HeadySystems/HeadyConnection, implementing privacy-first identity verification, or planning identity governance. Integrates with heady-sentinel for auth policy enforcement, headyapi-core for API auth, and HeadyMemory for identity context.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Identity Loom

Use this skill when you need to **design, build, or operate the Identity Loom** — Heady's federated identity system for weaving together user identities across organizations, surfaces, and services while maintaining privacy boundaries and governance controls.

## When to Use This Skill

- Building authentication and authorization flows for Heady surfaces
- Designing cross-org SSO across HeadyMe, HeadySystems, and HeadyConnection
- Managing user profiles and identity linking across multiple services
- Implementing privacy-preserving identity verification
- Planning identity governance with audit trails and compliance
- Integrating third-party identity providers (OAuth, SAML, passkeys)

## Platform Context

The Identity Loom operates across Heady's identity infrastructure:

- **heady-sentinel** — enforces authentication policies, manages secrets, and guards access boundaries
- **headyapi-core** — API Gateway with auth middleware; every API call authenticated here
- **HeadyMemory** (`latent-core-dev`, pgvector) — stores identity context and preference profiles (never raw credentials)
- **heady-traces** — records every authentication event, identity link, and access grant for audit
- **heady-observer** — monitors authentication health, detects anomalies, alerts on suspicious patterns
- **heady-metrics** — tracks auth latency, success rates, MFA adoption, and session counts
- **headymcp-core** (31 MCP tools) — orchestrates identity operations
- **HeadyWeb** — identity management dashboard and account settings
- **heady-buddy-portal** — Buddy-specific identity and persona management
- **headyconnection-core** — community identity with nonprofit privacy requirements
- **Three GitHub Orgs** (HeadyMe, HeadySystems, HeadyConnection) — org-level identity scoping

## Instructions

### 1. Define the Identity Model

```yaml
identity:
  core:
    id: uuid (globally unique across all orgs)
    type: human | agent | service | system
    status: active | suspended | pending-verification | deactivated

  profile:
    display_name: user-chosen name
    email: verified email address
    avatar: profile image reference
    created_at: ISO-8601
    last_active: ISO-8601
    preferences: stored in HeadyMemory (never credentials)

  org_memberships:
    - org: HeadyMe
      role: owner | admin | member | viewer
      joined_at: ISO-8601
      permissions: [derived from role + custom grants]

    - org: HeadySystems
      role: admin | developer | viewer
      joined_at: ISO-8601

    - org: HeadyConnection
      role: admin | volunteer | donor | beneficiary
      joined_at: ISO-8601
      privacy: enhanced (nonprofit privacy requirements)

  authentication:
    primary: email + password | passkey | SSO
    mfa: totp | webauthn | sms (fallback only)
    sessions:
      max_concurrent: 10
      timeout: 24h (web), 30d (mobile with biometric)
      refresh: sliding window

  agent_identity:
    parent: human identity that owns the agent
    trust_level: sandbox | standard | elevated | system
    capabilities: [MCP tools this agent is authorized to use]
    habitat: habitat-id (from heady-agent-habitat)
    lifespan: session | persistent | permanent
```

### 2. Design Federated Authentication

Cross-surface SSO across the Heady fleet:

```yaml
federation:
  sso_protocol: OAuth 2.0 + OIDC (OpenID Connect)

  identity_provider:
    primary: Heady Identity Service (self-hosted)
    external: [Google, GitHub, Microsoft, Apple — via OIDC]
    enterprise: SAML 2.0 for enterprise customers

  auth_flows:
    web_login:
      surface: HeadyWeb, heady-buddy-portal, headysystems.com
      flow: Authorization Code with PKCE
      mfa: required for admin roles, optional for members
      session: HTTP-only secure cookie + refresh token

    mobile_login:
      surface: heady-mobile
      flow: Authorization Code with PKCE + biometric unlock
      session: secure keychain storage, biometric refresh
      offline: cached session token valid for 30 days

    desktop_login:
      surface: heady-desktop
      flow: Device Authorization (for headless) or browser redirect
      session: OS keychain storage

    ide_login:
      surface: heady-vscode, heady-jetbrains
      flow: Device Authorization flow
      session: IDE secure storage

    api_login:
      surface: headyapi-core
      flow: API key + optional OAuth bearer token
      rate_limiting: per API key, enforced by headyapi-core

    agent_auth:
      surface: headybot-core agents, template-swarm-bee agents
      flow: Service account token issued by parent identity
      scope: limited to agent's habitat permissions
      rotation: automatic key rotation every 24h

  cross_org:
    mechanism: single identity, multiple org memberships
    linking: user links orgs from HeadyWeb account settings
    privacy: HeadyConnection membership can be private (nonprofit protection)
    permissions: org-scoped — admin in HeadyMe does not imply admin in HeadyConnection
```

### 3. Build Identity Governance

```yaml
governance:
  lifecycle:
    creation:
      - email verification required
      - heady-sentinel checks against blocklists
      - heady-traces logs creation event
      - optional: invite-only for HeadyConnection

    verification:
      levels: [email-verified, phone-verified, identity-verified, org-verified]
      progressive: start at email-verified, unlock features at higher levels
      verification_data: never stored in HeadyMemory; held in heady-sentinel vault

    suspension:
      triggers: [policy violation, fraud detection, admin action, inactivity > 365d]
      process: heady-sentinel freezes all sessions, heady-observer notifies
      appeal: via heady-buddy-portal support flow

    deletion:
      process: GDPR-compliant right to erasure
      scope: identity + all HeadyMemory data + heady-traces anonymization
      timeline: 30 days (grace period for undo) then permanent deletion
      audit: deletion event logged (anonymized) in heady-traces

  access_control:
    model: RBAC (role-based) + ABAC (attribute-based) hybrid
    roles: predefined per org (admin, member, viewer, etc.)
    attributes: [org, trust_level, verification_level, plan_tier]
    policies: defined in heady-sentinel, evaluated per request
    caching: permission decisions cached for 5 minutes

  audit:
    events: [login, logout, mfa_change, role_change, org_join, org_leave, identity_link, password_change]
    storage: heady-traces (immutable audit log)
    retention: 7 years for compliance
    access: admin-only via HeadyWeb audit dashboard
```

### 4. Implement Privacy-First Identity

Aligned with HF research on privacy-first patterns:

```yaml
privacy:
  principles:
    - minimal_collection: only collect identity data needed for function
    - purpose_limitation: data used only for stated purpose
    - user_control: users can view, export, and delete all identity data
    - encryption_at_rest: all identity data encrypted in heady-sentinel vault
    - encryption_in_transit: TLS 1.3 minimum for all identity flows

  data_classification:
    public: display_name, avatar (user-controlled)
    private: email, phone, org memberships (visible to user + org admins)
    sensitive: credentials, MFA secrets, verification documents (heady-sentinel vault only)
    prohibited: government IDs (never stored, only verified and discarded)

  cross_surface:
    rule: identity context shared across surfaces; raw auth data never leaves heady-sentinel
    implementation: surfaces receive identity tokens with claims, not raw data
    session_isolation: each surface gets independent session; compromise of one does not compromise others

  agent_privacy:
    rule: agents inherit privacy constraints from parent identity
    data_access: agents can read identity context but never credentials
    cross_agent: agents cannot access other users' identity data
```

### 5. Design Identity Linking and Resolution

```yaml
identity_resolution:
  linking:
    same_user_across_orgs:
      mechanism: user initiates link from HeadyWeb
      verification: must authenticate with both org credentials
      result: single identity_id maps to multiple org memberships
      unlinking: user can unlink at any time; org data stays in that org

    external_providers:
      mechanism: OAuth link from account settings
      providers: [GitHub, Google, Microsoft, Apple]
      result: external provider ID mapped to Heady identity
      fallback: always maintain email+password as recovery method

    device_linking:
      mechanism: QR code or push notification from known device
      result: new device added to identity's trusted device list
      limit: max 20 trusted devices per identity

  resolution:
    given: email | external_provider_id | API key | agent_token
    process:
      1. heady-sentinel resolves credential to identity_id
      2. headyapi-core loads org memberships and permissions
      3. Request context enriched with identity claims
      4. heady-traces logs resolution event
    caching: resolved identity cached for request duration
```

### 6. Build the Identity Dashboard

HeadyWeb interface for identity management:

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **Profile** | Identity Service | Display name, avatar, email, verification level |
| **Org Memberships** | Identity Service | Active orgs, roles, join dates |
| **Security** | heady-sentinel | MFA status, active sessions, trusted devices, API keys |
| **Linked Accounts** | Identity Service | External provider connections |
| **Agent Identities** | headybot-core | Owned agents with trust levels and capabilities |
| **Activity Log** | heady-traces | Recent auth events, access grants, security alerts |
| **Privacy Controls** | heady-sentinel | Data export, deletion request, sharing preferences |

## Output Format

When designing Identity Loom features, produce:

1. **Identity model** with profile, org memberships, and auth configuration
2. **Federation design** with SSO flows per surface and cross-org linking
3. **Governance policies** for lifecycle, access control, and audit
4. **Privacy architecture** with data classification and surface isolation
5. **Identity resolution** for linking and credential mapping
6. **Dashboard** specification with security and activity panels

## Tips

- **heady-sentinel is the vault** — all credentials, secrets, and sensitive identity data live in sentinel; no other service stores raw auth data
- **Identity spans orgs, permissions are org-scoped** — one identity, many memberships; never assume permissions transfer across orgs
- **Agent identities derive from humans** — every agent traces back to a human owner; orphan agents are a security risk
- **Privacy is structural, not policy** — design systems so private data physically cannot leak, not just rules that say it shouldn't
- **heady-traces is the audit backbone** — every auth event must be logged; compliance depends on complete audit trails
- **Passkeys over passwords** — prefer WebAuthn/passkeys for new implementations; passwords are a legacy fallback
