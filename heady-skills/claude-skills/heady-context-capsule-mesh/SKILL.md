---
name: heady-context-capsule-mesh
description: Design the Heady Context Capsule Mesh — a network of encapsulated context bundles that can be shared, linked, and routed between agents, tasks, and devices. Use when building portable context packaging, inter-agent context sharing, context versioning, or mesh networking between distributed Heady sessions.
metadata:
  author: eric-haywood
  version: '1.0'
---

# Heady Context Capsule Mesh

Use this skill when you need to **design, build, or operate the Context Capsule Mesh** — Heady's network for packaging, linking, sharing, and routing encapsulated context bundles across agents, tasks, and devices.

## When to Use This Skill

- Designing context capsule schemas — what goes inside a capsule
- Building capsule routing — how capsules flow between agents and tasks
- Implementing capsule versioning — tracking how context evolves over time
- Creating mesh networking for distributed Heady sessions
- Planning capsule compression and dehydration for efficient transfer
- Defining capsule access controls and expiry

## Instructions

### 1. Define the Context Capsule Schema

A capsule is a self-contained, portable context bundle:

```yaml
context_capsule:
  id: uuid
  version: int              # incremented on each update
  created_at: ISO-8601
  updated_at: ISO-8601
  creator: agent-id | user-id

  contents:
    summary: one-paragraph natural language summary
    task_context:
      task_id: uuid
      goal: what is being accomplished
      progress: percentage or status description
      decisions_made: [key decisions with reasoning]
    knowledge:
      facts: [relevant facts gathered during work]
      references: [file paths, URLs, memory IDs]
      code_snippets: [relevant code with file:line annotations]
    conversation:
      key_exchanges: [important Q&A pairs]
      instructions: [user directives still in effect]
    environment:
      workspace: path or identifier
      active_files: [files currently relevant]
      tool_state: [tool configurations in use]

  metadata:
    size_bytes: capsule payload size
    content_hash: SHA-256
    compression: none | gzip | delta
    ttl: ISO-8601 | null    # when this capsule expires
    priority: low | normal | high | critical

  links:
    parent: capsule-id | null      # capsule this was derived from
    children: [capsule-ids]        # capsules derived from this
    related: [capsule-ids]         # semantically related capsules
    task_chain: [capsule-ids]      # capsules in the same task lineage

  access:
    owner: user-id
    readable_by: [agent-ids, user-ids]
    shareable: true | false
    encrypted: true | false
```

### 2. Design Capsule Operations

Core operations on capsules:

| Operation | Description | When to Use |
|-----------|-------------|-------------|
| **Create** | Package current context into a new capsule | Starting a task, checkpointing progress |
| **Hydrate** | Load a capsule's contents into active context | Resuming a task, accepting a handoff |
| **Update** | Create a new version of an existing capsule | Progress checkpoint, context refinement |
| **Fork** | Create a branch capsule from an existing one | Exploring alternative approaches |
| **Merge** | Combine two capsules into one | Reuniting forked work streams |
| **Compress** | Reduce capsule size by summarizing older content | Preparing for transfer or archival |
| **Link** | Connect capsules in a mesh relationship | Building context graphs |
| **Share** | Grant another agent or device access | Inter-agent collaboration |

### 3. Build the Mesh Network

Capsules form a directed graph — the mesh:

```
                    ┌─────────┐
                    │ Root    │
                    │ Capsule │
                    └────┬────┘
                   ┌─────┴─────┐
              ┌────┴───┐  ┌────┴───┐
              │ Task A │  │ Task B │
              │ v1     │  │ v1     │
              └────┬───┘  └────┬───┘
              ┌────┴───┐  ┌────┴───┐
              │ Task A │  │ Task B │
              │ v2     │  │ v2     │
              └────┬───┘  └────────┘
         ┌─────────┼─────────┐
    ┌────┴───┐┌────┴───┐┌────┴───┐
    │ Fork 1 ││ Fork 2 ││Handoff │
    │ explore││ explore ││ to     │
    └────────┘└────────┘│ Device │
                        └────────┘
```

**Mesh operations:**
- **Traverse** — walk the capsule graph to understand work history
- **Search** — find capsules by content, task, agent, or time range
- **Prune** — remove expired or abandoned branches
- **Visualize** — render the mesh as a navigable graph

### 4. Implement Capsule Routing

Rules for how capsules flow between agents:

```yaml
routing_rules:
  - trigger: agent_spawn
    action: create capsule from parent context, attach to child agent
  - trigger: agent_complete
    action: update parent capsule with child results
  - trigger: device_handoff
    action: compress capsule, transfer to target device, hydrate
  - trigger: task_switch
    action: dehydrate current capsule, hydrate target task capsule
  - trigger: collaboration_request
    action: fork capsule, share fork with collaborator
```

### 5. Design Capsule Versioning

Track how context evolves:

- **Semantic versioning** — major (new task), minor (significant progress), patch (small update)
- **Delta storage** — store only the diff between versions, not full snapshots
- **Rollback** — restore any previous version of a capsule
- **Diff view** — compare two versions to see what changed

### 6. Plan Compression and Dehydration

For efficient transfer and storage:

| Strategy | When to Use | Tradeoff |
|----------|-------------|----------|
| **Summary compression** | Before cross-device transfer | Loses detail, keeps essence |
| **Delta encoding** | Between versions of same capsule | Efficient but requires base version |
| **Reference dehydration** | Replace large content with pointers | Fast transfer, slow hydration |
| **Priority filtering** | Drop low-priority content | Smaller capsule, possible information loss |

### 7. Define Access and Expiry

- Capsules inherit the creator's permission scope by default
- Sharing requires explicit grant with scope limitation
- Expired capsules are archived (not deleted) — the mesh structure is preserved
- Encrypted capsules require the owner's key to hydrate

## Output Format

When designing Capsule Mesh features, produce:

1. **Capsule schema** with all fields
2. **Operation definitions** with triggers and behaviors
3. **Mesh topology** diagram
4. **Routing rules**
5. **Versioning strategy**
6. **Compression/dehydration specifications**

## Tips

- **Capsules are the unit of context** — think of them as portable working memory snapshots
- **The mesh is the history** — the graph of capsule relationships tells the full story of work evolution
- **Compress aggressively for transfer** — detailed context is only needed locally; summaries travel well
- **Version everything** — you never know when you'll need to roll back to an earlier context state
- **Links create meaning** — a capsule in isolation is useful; a capsule connected to its lineage is powerful
