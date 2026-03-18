---
name: heady-sovereign-key-ring
description: Design and operate the Heady Sovereign Key Ring for cryptographic key management, secret lifecycle governance, credential rotation, and zero-trust secret distribution across the Heady ecosystem. Use when designing key management architectures, implementing secret rotation policies, building credential vaults, planning certificate lifecycle management, or designing zero-trust secret distribution for agents and services. Integrates with heady-sentinel for secret storage and policy enforcement, headyapi-core for API key management, heady-traces for key audit trails, and heady-observer for key health monitoring.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Sovereign Key Ring

Use this skill when you need to **design, build, or operate the Sovereign Key Ring** — Heady's centralized cryptographic key management and secret governance system that ensures every key, token, certificate, and credential across the ecosystem is securely stored, rotated, audited, and distributed with zero-trust principles.

## When to Use This Skill

- Designing key management architectures for the Heady platform
- Implementing automatic secret rotation policies for all services
- Building credential vaults with least-privilege access
- Planning certificate lifecycle management (TLS, signing, webhook)
- Designing zero-trust secret distribution for agents and swarms
- Managing API key lifecycles for developers via API Agora
- Auditing key usage and detecting compromised credentials

## Platform Context

The Sovereign Key Ring governs secrets across Heady's infrastructure:

- **heady-sentinel** — the primary secret vault; stores, encrypts, and distributes all secrets; enforces access policies
- **headyapi-core** — API Gateway; manages developer API keys and OAuth tokens
- **heady-traces** — immutable audit trail for every key operation (create, read, rotate, revoke)
- **heady-observer** — monitors key health (expiry approaching, unusual access, rotation overdue)
- **heady-metrics** — tracks key usage patterns, rotation compliance, and access frequency
- **heady-logs** — aggregates key management operational logs
- **headymcp-core** (31 MCP tools) — tools authenticate via service keys from the Key Ring
- **headybot-core** — agent service accounts with scoped key access
- **template-swarm-bee** — swarm agents receive ephemeral keys scoped to their habitat
- **HeadyMemory** (`latent-core-dev`, pgvector) — NEVER stores secrets; stores key metadata and rotation schedules only
- **Promotion Pipeline** (Testing → Staging → Main) — separate key rings per environment; keys never cross environments
- **Three GitHub Orgs** — org-scoped key rings with cross-org federation for shared services

## Instructions

### 1. Define the Key Ring Model

```yaml
key_ring:
  id: uuid
  scope: platform | org | workspace | service | agent
  environment: testing | staging | production
  owner: identity-id (from Identity Loom)

  key_types:
    api_key:
      format: "hdy_{env}_{random}" (e.g., hdy_live_a1b2c3...)
      purpose: developer API authentication via headyapi-core
      lifecycle: created by developer, rotatable, revocable
      storage: heady-sentinel vault (hashed; plaintext shown once at creation)

    service_token:
      format: JWT (RS256 signed, 1h expiry)
      purpose: inter-service authentication between Heady services
      lifecycle: auto-issued, auto-rotated every hour
      storage: heady-sentinel issues on demand; never persisted

    agent_credential:
      format: scoped JWT (ES256 signed, habitat-bound)
      purpose: agent authentication within habitat boundaries
      lifecycle: issued at agent spawn, revoked at termination
      storage: ephemeral — lives only in agent runtime memory
      constraints: bound to habitat_id, limited MCP tool access

    encryption_key:
      format: AES-256-GCM (data at rest) | ChaCha20-Poly1305 (streaming)
      purpose: encrypt HeadyMemory data, heady-traces entries, user content
      lifecycle: annual rotation with re-encryption migration
      storage: heady-sentinel vault with HSM backing

    signing_key:
      format: RSA-4096 (JWT signing) | Ed25519 (webhook signing)
      purpose: sign tokens, webhooks, content provenance records
      lifecycle: semi-annual rotation with key overlap period
      storage: heady-sentinel vault with HSM backing

    tls_certificate:
      format: X.509 (ECDSA P-256)
      purpose: TLS termination for all Heady endpoints
      lifecycle: 90-day auto-renewal via ACME
      storage: heady-sentinel vault, distributed to edge

    webhook_secret:
      format: HMAC-SHA256 secret (32 bytes)
      purpose: sign outbound webhooks, verify inbound webhooks
      lifecycle: developer-rotatable from API Agora dashboard
      storage: heady-sentinel vault (hashed reference for verification)

    oauth_secret:
      format: client_secret for OAuth 2.0 flows
      purpose: OAuth application authentication
      lifecycle: rotatable by application owner
      storage: heady-sentinel vault
```

### 2. Build the Secret Lifecycle

```yaml
secret_lifecycle:
  creation:
    1. Requester authenticates via Identity Loom
    2. heady-sentinel validates: requester authorized to create this key type
    3. Key generated with cryptographically secure random source
    4. Key stored encrypted in heady-sentinel vault
    5. heady-traces logs creation event (key_id, type, scope, requester — NOT the key value)
    6. Key value returned to requester (shown once for API keys)
    7. heady-observer begins monitoring key health

  rotation:
    automatic:
      - service_tokens: every 1 hour (seamless, no downtime)
      - agent_credentials: at agent restart or habitat change
      - tls_certificates: every 90 days via ACME
      - encryption_keys: annually with re-encryption migration window
      - signing_keys: semi-annually with 30-day key overlap

    manual:
      - api_keys: developer-initiated from API Agora dashboard
      - webhook_secrets: developer-initiated or admin-forced
      - oauth_secrets: application owner-initiated

    rotation_process:
      1. Generate new key
      2. Enter overlap period (both old and new keys valid)
      3. Distribute new key to consumers
      4. Verify all consumers using new key (heady-metrics)
      5. Revoke old key after overlap period
      6. heady-traces logs full rotation lifecycle

  revocation:
    immediate:
      trigger: compromise detected, policy violation, manual admin action
      process: key marked revoked in heady-sentinel, propagated globally within 60s
      consumers: receive auth failure on next use, must re-authenticate
      audit: heady-traces records revocation with reason and evidence

    graceful:
      trigger: scheduled rotation, key expiry
      process: overlap period → new key issued → old key deprecated → old key revoked
      consumers: transparently migrate during overlap period

  expiry:
    enforcement: heady-sentinel rejects expired keys
    warning: heady-observer alerts 30d, 7d, 1d before expiry
    auto_renewal: enabled for TLS certs and service tokens
    cleanup: expired keys purged from vault after 90-day retention
```

### 3. Design Zero-Trust Secret Distribution

```yaml
zero_trust_distribution:
  principles:
    - never_persist_in_code: secrets never appear in source code, configs, or environment files
    - least_privilege: each consumer gets only the secrets it needs
    - just_in_time: secrets fetched at runtime, not pre-distributed
    - environment_isolation: testing keys cannot access production; production keys cannot access testing
    - audit_everything: every secret access logged in heady-traces

  distribution_methods:
    service_to_service:
      method: runtime secret fetch from heady-sentinel vault
      auth: service identity (from Identity Loom) + mTLS
      caching: in-memory only, max 5 minutes, cleared on rotation signal
      fallback: if vault unreachable, use cached key until TTL; alert heady-observer

    agent_runtime:
      method: ephemeral credential injected at spawn time
      auth: parent service vouches for agent via signed request
      scope: credentials bound to habitat_id and agent capabilities
      lifetime: credentials expire when agent terminates
      revocation: immediate via heady-sentinel → Signal Exchange notification

    developer_api:
      method: API key created in developer portal, transmitted once over TLS
      storage: developer responsible for secure storage
      rotation: developer-initiated from dashboard; old key valid during overlap
      emergency: admin can force-revoke any API key instantly

    surface_sessions:
      method: OAuth tokens via Identity Loom auth flows
      storage: HTTP-only secure cookies (web), keychain (mobile/desktop)
      refresh: sliding window refresh tokens
      revocation: logout or admin force-revoke clears all sessions

  environment_separation:
    testing:
      key_ring: separate vault partition
      keys: prefixed "hdy_test_"
      access: cannot reach production services
      data: uses Heady-Testing org data only

    staging:
      key_ring: separate vault partition
      keys: prefixed "hdy_stg_"
      access: cannot reach production services
      data: uses Heady-Staging org data only

    production:
      key_ring: separate vault partition with HSM backing
      keys: prefixed "hdy_live_"
      access: production services only
      data: real production data
      additional_controls: dual-admin approval for master key operations
```

### 4. Implement Key Health Monitoring

```yaml
key_health:
  monitoring:
    heady_observer:
      - expiry_countdown: alert at 30d, 7d, 1d before any key expires
      - rotation_compliance: flag keys overdue for rotation
      - unusual_access: detect access from unexpected services or IPs
      - access_volume: spike detection (potential credential stuffing)
      - failed_auth_rate: per-key failure rate monitoring

    heady_metrics:
      - key_usage_count: per key, per hour (identify unused or overused keys)
      - rotation_age: time since last rotation per key type
      - auth_success_rate: per key type and consumer
      - vault_latency: secret fetch response time

  alerts:
    - condition: key expires within 7 days and no rotation scheduled
      severity: high
      action: notify key owner + admin via Signal Exchange

    - condition: failed auth attempts > 100/hour for single key
      severity: critical
      action: heady-sentinel auto-revokes key, notify owner, log incident

    - condition: key accessed from new IP/service not in allowlist
      severity: medium
      action: notify key owner, flag for review

    - condition: vault latency > 500ms sustained
      severity: high
      action: alert platform ops, activate cached fallback

  compliance_dashboard:
    rotation_status: percentage of keys within rotation policy
    expiry_timeline: upcoming expirations across all key types
    access_audit: recent key access events by consumer
    violation_log: policy violations and remediation status
```

### 5. Design Emergency Key Operations

```yaml
emergency_operations:
  key_compromise:
    detection:
      - heady-sentinel anomaly detection (unusual access patterns)
      - external report (developer reports leak)
      - automated scan (key found in public repository)
    response:
      1. Immediately revoke compromised key (heady-sentinel)
      2. Notify key owner via all channels (email, Signal Exchange, Buddy)
      3. Issue replacement key automatically
      4. Audit: identify all actions taken with compromised key (heady-traces)
      5. Assess blast radius: what data/services were accessible
      6. heady-observer escalates to security incident if high impact
    timeline: detection to revocation < 5 minutes (automated)

  vault_recovery:
    scenario: heady-sentinel vault unavailable
    response:
      1. Services fall back to cached credentials (limited TTL)
      2. heady-observer alerts platform ops immediately
      3. Failover to backup vault if available
      4. No new key operations until primary vault restored
      5. Post-recovery: full key rotation as precaution
    rpo: zero key loss (vault replicated)
    rto: < 15 minutes to backup vault failover

  master_key_rotation:
    trigger: annual schedule or emergency
    authorization: requires dual-admin approval
    process:
      1. Generate new master key in HSM
      2. Re-encrypt all vault entries with new master key
      3. Verify decryption with new master key
      4. Retire old master key
      5. Full audit trail in heady-traces
    downtime: zero (online re-encryption)
```

### 6. Build the Key Ring Dashboard

HeadyWeb interface for key management:

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **Key Inventory** | heady-sentinel | All keys by type, status, age, and environment |
| **Rotation Status** | heady-metrics | Per-type compliance with rotation policy |
| **Expiry Timeline** | heady-observer | Calendar view of upcoming expirations |
| **Access Log** | heady-traces | Recent key access events with consumer identity |
| **Health Alerts** | heady-observer | Active alerts for expiry, anomalies, violations |
| **Emergency Panel** | heady-sentinel | One-click revoke, emergency rotation, incident status |
| **Compliance Report** | heady-traces | Rotation compliance, access audit, policy violations |

## Output Format

When designing Sovereign Key Ring features, produce:

1. **Key Ring model** with key types, formats, and scope definitions
2. **Secret lifecycle** with creation, rotation, revocation, and expiry policies
3. **Zero-trust distribution** with per-consumer delivery methods and environment isolation
4. **Health monitoring** with heady-observer alerts and heady-metrics tracking
5. **Emergency operations** for compromise response and vault recovery
6. **Dashboard** specification with key inventory and compliance panels

## Tips

- **heady-sentinel is the only vault** — no other service stores raw secrets; everything else holds references or ephemeral copies
- **Secrets never persist in code** — not in environment variables, not in config files, not in HeadyMemory; runtime fetch from vault only
- **Environment isolation is absolute** — a testing key physically cannot access production; separate vault partitions enforce this
- **Rotation is automated or it doesn't happen** — manual rotation policies are aspirational; automatic rotation is real
- **Agent credentials are ephemeral** — issued at spawn, revoked at termination; long-lived agent keys are a security debt
- **heady-traces records every access** — key usage audit is the foundation for detecting compromise; gaps in the trail are gaps in security
