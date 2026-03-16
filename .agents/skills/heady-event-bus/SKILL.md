---
name: heady-event-bus
description: Use when implementing typed action/observation pub/sub messaging, event-driven agent communication, or structured inter-service messaging in the Heady™ ecosystem. Keywords include event bus, pub/sub, NATS, actions, observations, event stream, message routing, typed events.
metadata:
  author: HeadySystems
  version: '1.0'
  liquid_node: LiquidEventBus
  absorption_source: "OpenHands typed event-stream architecture"
---

# Heady™ Event Bus (LiquidEventBus)

## When to Use This Skill

Use this skill when the user needs to:
- Implement typed action/observation messaging between agents
- Set up event-driven workflows with guaranteed delivery
- Route events between services with topic-based filtering
- Build audit trails from event streams
- Coordinate multi-agent task execution

## Architecture

### Event Types

| Category | Actions (Commands) | Observations (Results) |
|---|---|---|
| **Code** | `CmdRunAction`, `FileWriteAction`, `FileReadAction` | `CmdOutputObservation`, `FileContentObservation` |
| **Browser** | `BrowseInteractiveAction`, `BrowseURLAction` | `BrowserOutputObservation` |
| **Agent** | `AgentDelegateAction`, `AgentFinishAction` | `AgentStateObservation` |
| **System** | `MessageAction`, `ChangeAgentStateAction` | `AgentStateChangedObservation`, `ErrorObservation` |

### NATS JetStream Configuration

```javascript
// Stream definition for typed events
const streamConfig = {
  name: 'HEADY_EVENTS',
  subjects: [
    'heady.action.*',       // All actions
    'heady.observation.*',  // All observations
    'heady.system.*'        // System events
  ],
  retention: 'limits',
  max_age: 89 * 60 * 1e9,  // fib(11) minutes in nanoseconds
  storage: 'file',
  num_replicas: 1
};

// Consumer for specific action types
const consumerConfig = {
  durable_name: 'bee-worker-pool',
  filter_subject: 'heady.action.cmd_run',
  ack_policy: 'explicit',
  max_deliver: 3,
  ack_wait: 21 * 1e9  // fib(8) seconds
};
```

### Event Schema

```typescript
interface HeadyEvent<T = unknown> {
  id: string;               // ULID for ordering
  type: string;              // e.g., 'CmdRunAction'
  source: string;            // e.g., 'bee-042'
  timestamp: string;         // ISO 8601
  trace_id: string;          // Distributed tracing
  parent_id?: string;        // For event chains
  data: T;                   // Typed payload
  metadata: {
    csl_confidence: number;  // [0, 1]
    governance_hash: string; // SHA-256 of event for audit
  };
}
```

## Instructions

### Publishing Events

1. Construct typed event with all required fields.
2. Validate against schema (TypeBox/Zod).
3. Compute governance hash for audit trail.
4. Publish to appropriate NATS subject.
5. Await acknowledgment from JetStream.

### Subscribing to Events

1. Create durable consumer with filter subject.
2. Process events in order (ULID guarantees).
3. Acknowledge after successful processing.
4. Dead-letter after max_deliver attempts.
5. Emit corresponding Observation for every Action processed.

### Event Sourcing Pattern

- Every agent state change is an event.
- Current state reconstructable by replaying events.
- Snapshots at Fibonacci intervals (every 89 events) for fast recovery.
- Event log is the single source of truth.

## Output Format

- Event Stream Status
- Consumer Group Health
- Dead Letter Queue Report
- Event Flow Diagram
- Throughput Metrics
