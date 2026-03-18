---
name: heady-signal-exchange
description: Design and operate the Heady Signal Exchange for real-time event routing, inter-service messaging, webhook orchestration, and signal-driven automation across the Heady ecosystem. Use when building event-driven architectures, designing Pub/Sub topologies, implementing webhook pipelines, creating real-time notification routing, or planning signal-based automation triggers. Integrates with template-swarm-bee for Pub/Sub agents, heady-observer for signal monitoring, heady-maestro for coordination, headymcp-core for tool-triggered signals, and heady-metrics for throughput tracking.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Signal Exchange

Use this skill when you need to **design, build, or operate the Signal Exchange** — Heady's real-time event routing and messaging backbone that connects services, agents, surfaces, and external systems through structured signals, Pub/Sub topics, and webhook pipelines.

## When to Use This Skill

- Building event-driven architectures connecting Heady services
- Designing Pub/Sub topic topologies for agent swarms and service communication
- Implementing webhook pipelines for external system integration
- Creating real-time notification routing across surfaces
- Planning signal-based automation triggers and workflow orchestration
- Monitoring event flow health and throughput optimization

## Platform Context

The Signal Exchange connects Heady's entire service mesh:

- **template-swarm-bee** — Pub/Sub lifecycle template; agents subscribe to and publish on exchange topics
- **heady-maestro** — coordinator agent; routes signals to appropriate handlers
- **headymcp-core** (31 MCP tools) — tool invocations emit signals; signals can trigger tools
- **heady-observer** — monitors signal flow health, detects bottlenecks, alerts on failures
- **heady-metrics** — tracks signal throughput, latency, delivery success rates
- **heady-traces** — records every signal for audit and replay
- **heady-sentinel** — enforces signal access policies (who can publish/subscribe to what)
- **heady-logs** — aggregates signal processing logs
- **headybot-core** — bot agents communicate via exchange signals
- **headyapi-core** — external webhooks enter the exchange through the API Gateway
- **HeadyMemory** (`latent-core-dev`, pgvector) — stores signal schemas and routing rules
- **heady-slack** + **heady-discord** — signal-driven notifications to external channels
- **All Heady surfaces** (HeadyWeb, heady-mobile, heady-desktop, heady-chrome) — receive real-time signals via WebSocket

## Instructions

### 1. Define the Signal Model

```yaml
signal:
  id: uuid
  type: signal-type-name (namespaced, e.g., "memory.stored", "agent.task.completed")
  source: service or agent that emitted the signal
  timestamp: ISO-8601
  correlation_id: uuid (links related signals in a workflow)
  priority: low | normal | high | critical

  payload:
    schema: reference to registered schema
    data: structured event data (JSON)
    size_limit: 256KB per signal

  metadata:
    user_id: originating user (if applicable)
    workspace_id: workspace context
    trace_id: heady-traces correlation
    ttl: time-to-live in seconds (default 3600, max 86400)

  delivery:
    guarantee: at-least-once (default) | exactly-once (transactional)
    ordering: per-topic FIFO within partition
    retry: exponential backoff, max 5 retries
    dead_letter: undeliverable signals routed to dead-letter topic
```

### 2. Design the Topic Topology

```yaml
topics:
  system:
    - name: system.health
      publishers: [heady-observer]
      subscribers: [heady-metrics, admin dashboards]
      purpose: platform health heartbeats and status changes

    - name: system.deployment
      publishers: [Promotion Pipeline (Testing → Staging → Main)]
      subscribers: [heady-observer, heady-metrics, admin notifications]
      purpose: deployment events across all three orgs

    - name: system.security
      publishers: [heady-sentinel]
      subscribers: [heady-observer, admin alerts, heady-logs]
      purpose: security events, policy violations, threat detection
      access: restricted to system trust level

  memory:
    - name: memory.stored
      publishers: [HeadyMemory via any MCP tool call]
      subscribers: [heady-observer, heady-vinci (learning), dependent agents]
      purpose: new data written to HeadyMemory

    - name: memory.queried
      publishers: [HeadyMemory]
      subscribers: [heady-metrics (usage tracking)]
      purpose: semantic search executed

  agent:
    - name: agent.spawned
      publishers: [headybot-core, template-swarm-bee]
      subscribers: [heady-observer, heady-maestro, heady-metrics]
      purpose: new agent created in habitat

    - name: agent.task.assigned
      publishers: [heady-maestro]
      subscribers: [target agent]
      purpose: task delegation signal

    - name: agent.task.completed
      publishers: [any agent]
      subscribers: [heady-maestro, heady-metrics, heady-soul]
      purpose: task outcome reporting

    - name: agent.failed
      publishers: [any agent]
      subscribers: [heady-maestro, heady-observer, heady-traces]
      purpose: agent failure requiring intervention

  user:
    - name: user.action
      publishers: [all Heady surfaces]
      subscribers: [heady-metrics, heady-vinci (pattern learning)]
      purpose: user interaction events for analytics

    - name: user.notification
      publishers: [any service]
      subscribers: [notification router → active surface]
      purpose: deliver notifications to users across devices

  media:
    - name: media.generated
      publishers: [heady-imagine, heady-stories, heady-coder, Voice Vessel]
      subscribers: [heady-metrics, Media Conductor, Trust Fabric (provenance)]
      purpose: new media asset generated

  financial:
    - name: financial.transaction
      publishers: [Treasury Nexus billing events]
      subscribers: [heady-metrics, heady-traces, heady-observer (spend alerts)]
      purpose: billing and payment events
      access: restricted to financial services

  webhook:
    - name: webhook.inbound.{provider}
      publishers: [headyapi-core (transforms external webhooks)]
      subscribers: [registered handlers per provider]
      purpose: external system events entering the exchange
```

### 3. Build the Routing Engine

```yaml
routing:
  subscription_types:
    topic:
      description: subscribe to all signals on a topic
      example: subscribe("agent.task.completed") → receive all task completions

    pattern:
      description: subscribe to topics matching a glob pattern
      example: subscribe("agent.*") → receive all agent-related signals

    filtered:
      description: subscribe to a topic with payload filter
      example: subscribe("agent.task.completed", filter={agent_id: "specific-id"})

    fanout:
      description: signal delivered to ALL subscribers (broadcast)
      use_case: notifications, health updates, deployment events

    competing:
      description: signal delivered to ONE subscriber (load balanced)
      use_case: task assignment, work distribution among agent swarms

  routing_rules:
    static:
      - defined in routing configuration
      - heady-sentinel validates publisher/subscriber permissions
      - changes require promotion through Testing → Staging → Main

    dynamic:
      - heady-maestro creates runtime routes for swarm coordination
      - routes auto-expire when swarm covenant dissolves
      - heady-traces logs all dynamic route creation/deletion

    priority:
      - critical signals bypass normal queue (dedicated fast path)
      - high signals processed before normal/low in queue
      - heady-observer monitors priority queue depth

  delivery:
    push:
      target: agents and services with persistent connections
      transport: internal message bus
      latency_target: "< 100ms for normal, < 10ms for critical"

    websocket:
      target: Heady surfaces (HeadyWeb, mobile, desktop, chrome)
      transport: WebSocket connection per surface session
      reconnection: automatic with signal replay from last acknowledged

    webhook:
      target: external systems registered via API Agora
      transport: HTTPS POST with HMAC signature
      retry: exponential backoff, configurable per endpoint
      verification: heady-sentinel validates webhook signature
```

### 4. Implement Webhook Orchestration

```yaml
webhooks:
  inbound:
    entry: headyapi-core receives external webhook POST
    validation:
      1. Verify source signature (provider-specific)
      2. heady-sentinel checks allowlist
      3. Parse and validate payload against registered schema
    transformation:
      1. Convert provider-specific format to Heady signal format
      2. Assign topic: webhook.inbound.{provider}
      3. Enrich with correlation metadata
    routing: publish to exchange for registered subscribers

  outbound:
    trigger: any signal matching outbound webhook subscription
    delivery:
      1. Transform signal payload to webhook format
      2. Sign with HMAC-SHA256 (X-Heady-Signature header)
      3. POST to registered endpoint URL
      4. heady-traces logs delivery attempt
    retry:
      strategy: exponential backoff (1s, 2s, 4s, 8s, 16s)
      max_attempts: 5
      dead_letter: after max attempts, route to dead-letter for manual review
    monitoring:
      heady-observer: tracks delivery success rate per endpoint
      heady-metrics: measures webhook latency and failure rates
      alerting: notify developer if endpoint failure rate > 10%

  management:
    registration: developers register endpoints via API Agora developer portal
    testing: sandbox webhook tester sends sample signals
    debugging: heady-traces shows full webhook delivery chain
    rotation: webhook secrets rotatable from developer dashboard
```

### 5. Design Signal-Driven Automation

```yaml
automation:
  trigger_rules:
    definition:
      name: rule-name
      trigger: signal topic + optional filter
      condition: expression evaluated on signal payload
      action: what to do when condition is true
      cooldown: minimum time between trigger firings

    examples:
      - name: "auto-scale-agents"
        trigger: agent.task.assigned
        condition: "queue_depth > active_agents * 3"
        action: "spawn new agent from template-swarm-bee"
        cooldown: 120s

      - name: "spend-alert"
        trigger: financial.transaction
        condition: "daily_spend > budget * 0.8"
        action: "publish to user.notification with budget warning"
        cooldown: 3600s

      - name: "quality-gate"
        trigger: media.generated
        condition: "quality_score < 0.7"
        action: "regenerate with adjusted parameters"
        cooldown: 0s (immediate)

      - name: "deployment-notification"
        trigger: system.deployment
        condition: "environment == 'production'"
        action: "notify via heady-slack + heady-discord"
        cooldown: 0s

  workflow_chains:
    description: signals trigger actions that emit new signals, forming chains
    example:
      1. agent.task.completed → heady-soul learns → memory.stored
      2. memory.stored → heady-vinci pattern detection → agent.task.assigned (new insight task)
      3. agent.task.completed → user.notification (results ready)
    guardrails:
      - max chain depth: 10 (prevents infinite loops)
      - heady-observer monitors chain depth and latency
      - circular detection: heady-sentinel blocks same signal re-entering chain
```

### 6. Build the Signal Exchange Dashboard

HeadyWeb interface for signal management:

| Panel | Data Source | Shows |
|-------|-----------|-------|
| **Signal Flow** | heady-metrics | Real-time signal volume per topic, throughput graph |
| **Topic Map** | routing config | Visual topology of topics, publishers, subscribers |
| **Delivery Health** | heady-observer | Success rates, latency percentiles, dead-letter count |
| **Webhook Status** | heady-metrics | Per-endpoint delivery rate, failure trends |
| **Automation Rules** | HeadyMemory | Active trigger rules with firing history |
| **Signal Inspector** | heady-traces | Search and inspect individual signals with full context |
| **Alerts** | heady-observer | Bottleneck warnings, delivery failures, queue depth alerts |

## Output Format

When designing Signal Exchange features, produce:

1. **Signal model** with type hierarchy, payload schema, and delivery guarantees
2. **Topic topology** with publisher/subscriber mapping and access controls
3. **Routing engine** with subscription types, filtering, and priority handling
4. **Webhook orchestration** for inbound/outbound external integration
5. **Automation rules** with trigger conditions and workflow chains
6. **Dashboard** specification with signal flow and health monitoring

## Tips

- **template-swarm-bee agents are native exchange citizens** — their Pub/Sub lifecycle maps directly to signal topics
- **At-least-once is the safe default** — exactly-once is expensive; design consumers to be idempotent
- **Critical signals get a fast lane** — security and health signals bypass normal queuing
- **Chain depth limits prevent storms** — without max depth, one signal can cascade into thousands
- **heady-traces records everything** — every signal is traceable; this feeds both debugging and Trust Fabric provenance
- **Webhook signatures are mandatory** — never deliver an unsigned webhook; never accept an unverified inbound webhook
