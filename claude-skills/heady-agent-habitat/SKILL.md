---
name: heady-agent-habitat
description: Design and operate the Heady Agent Habitat for isolated agent runtime environments with security boundaries, resource management, and lifecycle governance. Use when creating sandboxed agent execution contexts, managing agent permissions, designing resource quotas, or building secure multi-tenant agent hosting. Integrates with headybot-core for agent orchestration, template-swarm-bee for agent templates, heady-sentinel for security enforcement, and heady-observer for habitat monitoring.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Agent Habitat

Use this skill when you need to **design, provision, or manage isolated runtime environments for agents** — secure, resource-governed execution contexts that ensure agents operate within defined boundaries while maintaining access to the capabilities they need.

## When to Use This Skill

- Creating sandboxed execution environments for autonomous agents
- Designing permission models for agent access to MCP tools and data
- Building resource quotas and limits for agent compute, memory, and API usage
- Implementing multi-tenant agent hosting with isolation guarantees
- Setting up lifecycle governance (spawn approval, monitoring, termination policies)
- Designing habitat templates for different agent roles and trust levels

## Platform Context

The Agent Habitat operates within Heady's agent infrastructure:

- **headybot-core** — autonomous bot framework; agents execute within habitats
- **template-swarm-bee** — Pub/Sub agent template; habitats host swarm bees
- **heady-sentinel** — enforces security boundaries, permission policies, and secret access
- **heady-observer** — monitors habitat health, resource usage, and agent behavior
- **heady-metrics** — tracks resource consumption, execution time, and cost per habitat
- **heady-traces** — records every action taken within a habitat for audit
- **headymcp-core** (31 MCP tools) — capabilities available to agents based on habitat permissions
- **HeadyMemory** (`latent-core-dev`, pgvector) — shared memory layer with access scoped per habitat
- **heady-logs** — centralized log aggregation from all habitats
- **Sacred Geometry Architecture** — habitats map to rings: agents in middle ring, data access scoped to inner ring, UI agents in outer ring

## Instructions

### 1. Define the Habitat Model

```yaml
habitat:
  id: uuid
  name: habitat-name
  owner: user-id | swarm-covenant-id | system
  trust_level: sandbox | standard | elevated | system
  status: provisioning | active | suspended | terminating | terminated

  agent:
    id: uuid
    template: template-swarm-bee | custom
    role: agent-role-description
    runtime: headybot-core

  permissions:
    mcp_tools:
      allowed: [list of MCP tool names this agent can invoke]
      denied: [explicitly blocked tools]
      rate_limits:
        - tool: heady_coder
          max_calls_per_minute: 10
        - tool: heady_memory
          max_calls_per_minute: 30

    memory_access:
      scope: own | shared-readonly | shared-readwrite | global-readonly
      namespaces: [memory namespaces this habitat can access]
      write_namespaces: [namespaces this habitat can write to]

    network:
      outbound: none | allowlist | unrestricted
      allowed_hosts: [specific hosts if allowlist]
      pub_sub_topics:
        subscribe: [topics this agent can read]
        publish: [topics this agent can write]

    secrets:
      access: [secret names from heady-sentinel vault]
      rotation_policy: auto | manual

  resources:
    compute:
      max_cpu_seconds: 3600
      max_concurrent_tasks: 5
      priority: low | normal | high | critical
    memory:
      max_mb: 512
      vector_store_quota_mb: 100
    storage:
      max_mb: 1024
      ephemeral: true | false
    api:
      max_external_calls_per_hour: 100
      max_tokens_per_hour: 50000

  lifecycle:
    max_duration_seconds: 86400
    idle_timeout_seconds: 300
    auto_terminate_on_task_complete: true
    requires_approval: false  # true for elevated/system trust
    created_at: ISO-8601
    expires_at: ISO-8601
```

### 2. Design Trust Levels

Map trust levels to permission boundaries enforced by heady-sentinel:

| Trust Level | MCP Tools | Memory Access | Network | Use Case |
|------------|-----------|---------------|---------|----------|
| **Sandbox** | Read-only tools only (`heady_memory` read, `heady_analyze`) | Own namespace only | None | Untested agents, new templates |
| **Standard** | Core tools (`heady_coder`, `heady_memory`, `heady_embed`) | Shared read, own write | Allowlist | Production swarm bees |
| **Elevated** | All tools except admin (`heady_sentinel`, `heady_production`) | Shared read-write | Allowlist | Coordinator agents, heady-maestro |
| **System** | All 31 MCP tools | Global | Unrestricted | System agents (heady-observer, heady-sentinel) |

**Trust elevation workflow:**
```
1. Agent requests elevated trust via Pub/Sub message to coordinator
2. heady-sentinel evaluates: agent history, task requirements, current behavior score
3. If approved: habitat permissions updated, heady-traces logs elevation
4. If denied: agent continues at current level, denial reason logged
5. Elevation auto-expires after task completion or timeout
```

### 3. Build Habitat Templates

Pre-configured habitat profiles for common agent roles:

```yaml
habitat_templates:
  swarm_bee:
    base: template-swarm-bee
    trust_level: standard
    sacred_geometry_ring: middle
    resources: { max_cpu_seconds: 1800, max_mb: 256, max_concurrent_tasks: 3 }
    permissions:
      mcp_tools: [heady_memory, heady_coder, heady_analyze, heady_embed]
      memory_access: { scope: shared-readonly, write_namespaces: [own] }
      network: { outbound: none }

  research_agent:
    base: template-swarm-bee
    trust_level: standard
    sacred_geometry_ring: middle
    resources: { max_cpu_seconds: 3600, max_mb: 512, max_concurrent_tasks: 1 }
    permissions:
      mcp_tools: [heady_memory, heady_research, heady_analyze, heady_vinci, heady_embed]
      memory_access: { scope: shared-readonly, write_namespaces: [own, research] }
      network: { outbound: allowlist, allowed_hosts: [approved research sources] }

  coordinator:
    base: headybot-core
    trust_level: elevated
    sacred_geometry_ring: middle
    resources: { max_cpu_seconds: 86400, max_mb: 1024, max_concurrent_tasks: 20 }
    permissions:
      mcp_tools: [all except heady_sentinel_admin, heady_production_admin]
      memory_access: { scope: shared-readwrite }
      network: { outbound: allowlist }

  ui_agent:
    base: template-heady-ui
    trust_level: standard
    sacred_geometry_ring: outer
    resources: { max_cpu_seconds: 900, max_mb: 256, max_concurrent_tasks: 2 }
    permissions:
      mcp_tools: [heady_memory, heady_coder, heady_embed]
      memory_access: { scope: own }
      network: { outbound: none }
```

### 4. Implement Lifecycle Governance

```yaml
lifecycle_governance:
  spawn:
    - requester submits habitat request with template + purpose
    - heady-sentinel validates: requester authorized, template exists, resources available
    - if trust_level >= elevated: require human approval via HeadyConnection
    - provision habitat with resource quotas
    - agent spawns within habitat, heady-observer begins monitoring
    - log creation in heady-traces

  monitoring:
    - heady-observer checks agent heartbeat every 10s
    - heady-metrics tracks resource consumption against quotas
    - heady-sentinel continuously evaluates behavior against permission policy
    - heady-logs aggregates all habitat output

  suspension:
    triggers:
      - resource quota exceeded (heady-metrics threshold)
      - permission violation detected (heady-sentinel alert)
      - anomalous behavior pattern (heady-vinci analysis)
    action:
      - pause agent execution
      - preserve state for review
      - notify habitat owner and coordinator
      - log suspension in heady-traces

  termination:
    normal:
      - task completes → agent signals done → graceful shutdown
      - persist learned patterns via heady_soul
      - release all resources
      - archive habitat logs to heady-logs
    forced:
      - timeout or suspension → forced termination
      - dump state for debugging
      - release resources immediately
      - incident logged in heady-traces
```

### 5. Design Multi-Tenant Isolation

For environments hosting agents from different swarms or users:

```yaml
isolation:
  namespace:
    description: Each habitat gets a unique namespace prefix for all resources
    memory: "habitat:{id}:" prefix on all HeadyMemory operations
    topics: "habitat:{id}:" prefix on Pub/Sub topics
    logs: tagged with habitat_id in heady-logs

  resource_isolation:
    compute: CPU time quotas enforced per habitat
    memory: HeadyMemory vector store quota per namespace
    network: separate allowlists per habitat

  data_isolation:
    rule: agents cannot access memory outside their namespace without explicit grant
    cross_habitat: requires shared-readwrite permission on both sides
    audit: every cross-habitat access logged in heady-traces

  failure_isolation:
    rule: agent failure in one habitat cannot affect other habitats
    implementation: separate error handling, independent health checks
    blast_radius: limited to single habitat by design
```

### 6. Build the Habitat Dashboard

Monitor all active habitats on HeadyWeb:

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **Active Habitats** | heady-observer | All running habitats with status, agent count, trust level |
| **Resource Usage** | heady-metrics | CPU, memory, API usage vs quotas per habitat |
| **Permission Events** | heady-sentinel | Access grants, denials, and violations |
| **Agent Activity** | heady-traces | Recent actions per habitat with timeline |
| **Health Map** | heady-observer | Visual grid of habitat health status (green/yellow/red) |
| **Cost Tracking** | heady-metrics | Resource cost per habitat, trend over time |

## Output Format

When designing Agent Habitat features, produce:

1. **Habitat model** with permissions, resources, and lifecycle configuration
2. **Trust level** matrix mapping roles to capabilities
3. **Habitat templates** for common agent roles with Sacred Geometry ring placement
4. **Lifecycle governance** with spawn, monitoring, suspension, and termination policies
5. **Isolation design** for multi-tenant environments
6. **Dashboard** specification with heady-observer and heady-metrics data sources

## Tips

- **Least privilege by default** — start agents in sandbox, elevate only when needed and with audit trail
- **template-swarm-bee for most agents** — use the standard template; custom habitats only when Pub/Sub lifecycle doesn't fit
- **heady-sentinel is the enforcer** — permission checks happen at the habitat boundary, not inside the agent
- **Resource quotas prevent runaway agents** — always set max_cpu_seconds and max_mb; unbounded agents are dangerous agents
- **Isolation is non-negotiable** — one agent's failure or compromise must never affect other habitats
- **heady-traces captures everything** — every spawn, action, elevation, and termination feeds the audit trail
