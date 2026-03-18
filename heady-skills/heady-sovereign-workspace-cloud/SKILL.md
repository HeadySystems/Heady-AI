---
name: heady-sovereign-workspace-cloud
description: Design the Heady Sovereign Workspace Cloud — user-owned cloud workspaces with full data sovereignty, portable state, and zero-trust isolation. Use when architecting personal cloud environments, designing data residency controls, building workspace provisioning, or planning encrypted sovereign storage for Heady users.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Sovereign Workspace Cloud

Use this skill when you need to **design, build, or operate the Sovereign Workspace Cloud** — Heady's personal cloud layer that gives every user an isolated, portable, fully sovereign workspace with strong data ownership guarantees.

## When to Use This Skill

- Architecting user-owned cloud workspace infrastructure
- Designing data sovereignty controls — residency, encryption, export
- Building workspace provisioning and lifecycle management
- Planning zero-trust isolation between user workspaces
- Designing portable workspace state that moves between providers
- Creating backup, snapshot, and disaster recovery systems

## Instructions

### 1. Define the Sovereign Workspace Model

Every user gets their own workspace:

```yaml
sovereign_workspace:
  id: uuid
  owner: user-id
  created_at: ISO-8601
  status: provisioning | active | suspended | archived

  infrastructure:
    compute:
      tier: free | pro | enterprise
      vcpus: 2 | 4 | 8
      memory_gb: 4 | 8 | 16
      gpu: none | shared | dedicated
    storage:
      capacity_gb: 10 | 50 | 200
      type: ssd
      encryption: aes-256-gcm
      encryption_key_owner: user    # user holds the key, not the platform
    network:
      egress: restricted | standard | unrestricted
      ingress: none | webhook-only | public-endpoint
      vpc_isolated: true

  sovereignty:
    data_residency: us | eu | ap | user-specified-region
    encryption_at_rest: true
    encryption_in_transit: true
    key_management: user-managed | platform-managed
    data_processing_agreement: signed | pending
    right_to_delete: guaranteed
    right_to_export: guaranteed
    audit_log: immutable, user-accessible

  contents:
    files: workspace file system
    memory: user's Memory Ledger and Sanctum
    skills: installed skills and modules
    personas: configured Buddy personas
    agents: agent configurations and history
    secrets: encrypted credential vault

  portability:
    export_format: encrypted-archive | git-bundle | container-image
    last_export: ISO-8601
    import_from: [supported source formats]
```

### 2. Design Zero-Trust Isolation

Every workspace is an island:

| Boundary | Enforcement |
|----------|------------|
| Compute | Separate containers or VMs per workspace; no shared processes |
| Storage | Encrypted volumes with per-user keys; no cross-workspace access |
| Network | VPC isolation; workspaces cannot see each other's traffic |
| Memory | Separate vector DB namespaces; no cross-user queries |
| Agents | Agents are scoped to their workspace; no cross-workspace execution |
| Secrets | Per-workspace credential vault; keys never leave the workspace |

**Trust model:**
```
User → trusts → Their workspace (full access)
User → trusts → Heady platform (limited: orchestration only)
Heady platform → CANNOT access → User's encrypted data without user's key
Workspace A → CANNOT access → Workspace B (zero trust)
```

### 3. Build Workspace Provisioning

Automated workspace lifecycle:

```
1. User signs up → provision workspace in selected region
2. Initialize: file system, memory stores, default skills, credential vault
3. First-run setup: import existing data, configure personas, set preferences
4. Active use: auto-scaling compute based on workload
5. Idle: scale down compute, maintain storage
6. Suspended: freeze compute, maintain storage (billing paused)
7. Archived: compress and cold-store everything (minimal cost)
8. Deleted: cryptographic erasure of all data
```

**Provisioning targets:**
| Stage | Target Time |
|-------|------------|
| New workspace | < 60 seconds |
| Resume from suspended | < 10 seconds |
| Resume from archived | < 5 minutes |
| Full export | < 15 minutes for 50GB |

### 4. Implement Data Sovereignty Controls

Users control where and how their data lives:

- **Residency** — user selects region; data never leaves that region
- **Encryption** — all data encrypted with user-managed keys
- **Access logs** — complete, immutable audit trail of every data access
- **Right to delete** — user can trigger cryptographic erasure at any time
- **Right to export** — full workspace export in portable format at any time
- **Processing agreements** — clear terms on what the platform can and cannot do with user data

### 5. Design Portable Workspace State

Workspaces can move between providers:

```yaml
workspace_export:
  format: heady-workspace-archive-v1
  contents:
    - files/           # complete file system
    - memory/          # Memory Ledger + Sanctum export
    - skills/          # installed skill packages
    - personas/        # persona configurations
    - agents/          # agent configs and history
    - secrets.enc      # encrypted credential vault
    - manifest.yaml    # workspace metadata and integrity proofs
  integrity:
    manifest_hash: SHA-256 of complete archive
    per_file_hashes: true
    signed_by: user's key
  import_targets:
    - another Heady instance
    - self-hosted Heady
    - compatible third-party platform
```

### 6. Plan Backup and Recovery

Protect against data loss:

| Backup Type | Frequency | Retention | Recovery Time |
|-------------|-----------|-----------|--------------|
| Incremental | Hourly | 7 days | < 5 minutes |
| Full snapshot | Daily | 30 days | < 15 minutes |
| Archival | Weekly | 1 year | < 1 hour |

- Backups are encrypted with user's key
- User can trigger manual backup at any time
- Point-in-time recovery to any hourly checkpoint
- Cross-region replication available for enterprise tier

### 7. Define Workspace Tiers

| Feature | Free | Pro | Enterprise |
|---------|------|-----|-----------|
| Compute | 2 vCPU, 4GB | 4 vCPU, 8GB | 8 vCPU, 16GB + GPU |
| Storage | 10 GB | 50 GB | 200 GB |
| Memory entries | 10,000 | 100,000 | Unlimited |
| Skills | 10 installed | Unlimited | Unlimited + custom |
| Backups | Daily, 7-day retention | Hourly, 30-day | Hourly, 1-year + cross-region |
| Data residency | Platform choice | User choice | Custom region |
| Key management | Platform-managed | User option | User-managed required |

## Output Format

When designing Sovereign Workspace features, produce:

1. **Workspace model schema**
2. **Isolation boundary definitions**
3. **Provisioning workflow** with timing targets
4. **Sovereignty controls** matrix
5. **Portability specification** — export/import formats
6. **Backup and recovery plan**
7. **Tier definitions** with feature matrix

## Tips

- **Sovereignty is the product** — users choose Heady because they own their data; never compromise this
- **User-managed keys mean the platform cannot decrypt** — this is a feature, not a limitation
- **Portability prevents lock-in** — easy export builds trust, which paradoxically increases retention
- **Cold storage is cheap** — err on the side of keeping data longer rather than deleting it
- **Provisioning speed is UX** — a 60-second workspace creation feels instant; 5 minutes feels broken
- **Encrypt everything, always** — there is no valid reason for unencrypted user data at rest or in transit
