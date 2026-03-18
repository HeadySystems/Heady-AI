---
name: heady-swarm-covenant
description: Design and operate the Heady Swarm Covenant for multi-agent swarm orchestration, topology management, and collective intelligence. Use when designing swarm topologies, building coordinator-specialist agent patterns, orchestrating task graphs with lifecycle hooks, or scaling autonomous agent teams. Integrates with headybot-core swarm intelligence, template-swarm-bee Pub/Sub lifecycle, heady-maestro for coordination, and heady-observer for swarm health monitoring.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Swarm Covenant

Use this skill when you need to **design, deploy, or manage multi-agent swarms** — collective agent teams that coordinate through the Swarm Covenant protocol to solve complex tasks via topology-aware orchestration, task graph execution, and lifecycle-managed agent populations.

## When to Use This Skill

- Designing swarm topologies (star, mesh, hierarchical, pipeline) for different task types
- Building coordinator-specialist agent patterns using headybot-core
- Creating task graphs with dependency resolution and lifecycle hooks
- Implementing swarm consensus protocols for collective decision-making
- Scaling agent populations dynamically based on workload
- Monitoring swarm health and performance via heady-observer

## Platform Context

The Swarm Covenant operates across Heady's agent infrastructure:

- **headybot-core** — autonomous bot framework with swarm intelligence, the runtime for all swarm agents
- **template-swarm-bee** — Pub/Sub lifecycle template for creating new swarm agents (subscribe to topics, process messages, publish results)
- **heady-maestro** — coordinator agent that manages swarm topology and task assignment
- **headymcp-core** (31 MCP tools) — orchestration layer each agent can invoke for capabilities
- **heady-observer** — monitors individual agent and collective swarm health
- **heady-metrics** — tracks throughput, latency, error rates, and swarm efficiency
- **heady-sentinel** — enforces agent permission boundaries and prevents unauthorized actions
- **heady-traces** — records every agent action for audit and replay
- **HeadyMemory** (`latent-core-dev`, pgvector) — shared memory layer for inter-agent knowledge transfer
- **heady-soul** — learning layer that improves swarm behavior from task outcomes

## Instructions

### 1. Define the Swarm Covenant Model

```yaml
swarm_covenant:
  id: uuid
  name: swarm-name
  purpose: task description or standing mission
  topology: star | mesh | hierarchical | pipeline | dynamic
  status: forming | active | degraded | dissolving | completed

  coordinator:
    agent_id: uuid
    type: heady-maestro | elected-leader | round-robin
    responsibilities: [task decomposition, assignment, aggregation, health monitoring]
    runtime: headybot-core

  agents:
    - id: uuid
      role: specialist-type
      template: template-swarm-bee
      capabilities: [MCP tools this agent can invoke]
      topics_subscribed: [Pub/Sub topics for input]
      topics_published: [Pub/Sub topics for output]
      status: idle | working | blocked | failed | terminated
      lifecycle:
        created_at: ISO-8601
        last_heartbeat: ISO-8601
        max_idle_seconds: 300
        auto_terminate: true | false

  task_graph:
    - task_id: uuid
      name: task-name
      assigned_to: agent-id | unassigned
      dependencies: [task-ids that must complete first]
      status: pending | in-progress | completed | failed | cancelled
      timeout_seconds: 600
      retry_policy: { max_retries: 3, backoff: exponential }
      cancellation: { propagate: true, cleanup_hook: cleanup-action }

  consensus:
    protocol: majority | unanimous | coordinator-decides | weighted-vote
    quorum: minimum agents required for decisions
    timeout_seconds: 30
```

### 2. Design Swarm Topologies

Select topology based on task characteristics:

| Topology | Best For | Coordinator Role | Communication Pattern |
|----------|---------|-----------------|----------------------|
| **Star** | Decomposable tasks with clear subtasks | Central coordinator assigns and aggregates | Agents → Coordinator → Agents |
| **Mesh** | Collaborative tasks requiring peer interaction | Lightweight — route messages, no central control | Agent ↔ Agent via Pub/Sub topics |
| **Hierarchical** | Complex tasks with nested decomposition | Multi-level coordinators (team leads + overall lead) | Tree-structured delegation |
| **Pipeline** | Sequential processing with stage expertise | Minimal — each stage passes to next | Linear: Agent₁ → Agent₂ → Agent₃ |
| **Dynamic** | Unpredictable tasks requiring runtime adaptation | heady-maestro monitors and restructures | Evolves based on heady-observer signals |

**Topology selection via MCP tools:**
```
1. mcp_Heady_heady_analyze(data="{task description}", criteria="decomposability, interdependence, sequentiality")
2. Select topology matching analysis
3. mcp_Heady_heady_coder(prompt="generate swarm covenant config for [topology] with [N] agents")
```

### 3. Build Agent Lifecycle Management

Based on template-swarm-bee Pub/Sub lifecycle:

```
Agent Lifecycle:
  SPAWN → INITIALIZE → SUBSCRIBE → IDLE → WORKING → [IDLE | BLOCKED | FAILED] → TERMINATE
                                      ↑                    |
                                      └────────────────────┘
                                         (recovery loop)
```

**Lifecycle hooks (aligned with HF supervisor agent patterns):**

```yaml
lifecycle_hooks:
  on_spawn:
    - load capabilities from headymcp-core
    - register with heady-observer for health monitoring
    - subscribe to assigned Pub/Sub topics
    - announce availability to coordinator

  on_task_assigned:
    - validate task against agent capabilities
    - acquire resources (HeadyMemory context, tool access)
    - set timeout via heady-observer
    - begin execution with heady-traces logging

  on_task_complete:
    - publish results to output topic
    - update task_graph status
    - feed outcome to heady_soul(action="learn")
    - return to IDLE state

  on_failure:
    - log failure context to heady-traces
    - notify coordinator via Pub/Sub
    - attempt recovery if retry_policy allows
    - escalate to heady-observer if retries exhausted

  on_cancellation:
    - stop current work immediately
    - clean up acquired resources
    - propagate cancellation to dependent tasks if configured
    - log cancellation in heady-traces

  on_terminate:
    - unsubscribe from all topics
    - deregister from heady-observer
    - persist learned patterns via heady_soul
    - release all resources
```

### 4. Implement Task Graph Execution

Coordinator decomposes work into a directed acyclic graph:

```
1. mcp_Heady_heady_analyze(data="{task}", criteria="decomposition into subtasks")
2. Build dependency graph with topological ordering
3. Assign ready tasks (no pending dependencies) to available agents
4. As tasks complete, unlock dependent tasks
5. Aggregate results when all leaf tasks complete
```

**Task assignment strategy:**
```yaml
assignment_strategies:
  capability_match:
    description: Assign to agent whose capabilities best match task requirements
    scoring: semantic similarity between task.requirements and agent.capabilities via HeadyEmbed

  load_balanced:
    description: Assign to least-busy capable agent
    scoring: agent.current_tasks < agent.max_concurrent

  locality:
    description: Assign to agent with relevant context already loaded
    scoring: HeadyMemory overlap between agent context and task data

  affinity:
    description: Assign related tasks to same agent to reduce context switching
    scoring: task dependency proximity in task graph
```

### 5. Design Swarm Observability

Powered by heady-observer and heady-metrics:

```yaml
swarm_observability:
  agent_level:
    - heartbeat_interval: 10s via heady-observer
    - task_completion_rate: heady-metrics per agent
    - error_rate: heady-metrics per agent
    - resource_usage: memory, MCP tool calls

  swarm_level:
    - throughput: tasks completed per minute
    - efficiency: completed_tasks / total_agent_seconds
    - utilization: working_time / total_time per agent
    - bottleneck_detection: heady-vinci identifies slow paths in task graph
    - coordination_overhead: time spent on coordination vs execution

  alerts:
    - condition: agent heartbeat missed for 30s → heady-observer fires
      action: mark agent degraded, reassign tasks
    - condition: swarm throughput < 50% of baseline
      action: heady-maestro evaluates topology change
    - condition: task retry count > max_retries
      action: escalate to human, pause dependent tasks
    - condition: swarm efficiency < 30%
      action: heady-vinci analyzes, recommends restructuring
```

### 6. Scale the Swarm Dynamically

```yaml
scaling:
  scale_up:
    trigger: task_queue_depth > (active_agents * 2) for 60s
    action: spawn new agents from template-swarm-bee
    limit: max_agents defined in covenant
    cooldown: 120s between scale events

  scale_down:
    trigger: agent_idle_time > max_idle_seconds
    action: gracefully terminate idle agents
    preserve: minimum agent count per role

  rebalance:
    trigger: heady-vinci detects uneven load distribution
    action: heady-maestro reassigns topics and migrates tasks
    method: drain agent → reassign → resume on new agent
```

## Output Format

When designing Swarm Covenant features, produce:

1. **Covenant model** with topology, agent roster, and task graph
2. **Topology selection** rationale based on task characteristics
3. **Lifecycle hooks** for agent spawn, work, failure, and termination
4. **Task graph** with dependency resolution and assignment strategy
5. **Observability** configuration with heady-observer and heady-metrics
6. **Scaling rules** for dynamic agent population management

## Tips

- **template-swarm-bee is your factory** — every new agent starts from this Pub/Sub lifecycle template
- **Topology matches task shape** — pipeline for sequential, star for decomposable, mesh for collaborative; wrong topology kills efficiency
- **Lifecycle hooks prevent orphans** — always implement on_cancellation and on_terminate to clean up resources
- **heady-maestro coordinates, agents execute** — keep coordination logic in the coordinator, not scattered across agents
- **heady-soul learns from swarms** — feed collective outcomes back so future swarms start smarter
- **Cancellation must propagate** — a cancelled parent task must cascade to all dependent children or you get zombie work
