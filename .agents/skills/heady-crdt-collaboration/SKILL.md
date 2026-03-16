---
name: heady-crdt-collaboration
description: Use when implementing real-time multiplayer editing, CRDT-based conflict resolution, live cursor presence, or AI+human collaborative sessions in the Heady™ ecosystem. Keywords include CRDT, Yjs, collaboration, multiplayer, real-time editing, awareness, merge conflict, shared editing.
metadata:
  author: HeadySystems
  version: '1.0'
  liquid_node: LiquidMesh
  absorption_source: "OpenClaw gap + Cursor/Windsurf competitive analysis"
---

# Heady™ CRDT Collaboration (LiquidMesh)

## When to Use This Skill

Use this skill when the user needs to:
- Enable multiplayer editing where multiple AI agents and humans edit simultaneously
- Resolve merge conflicts automatically with CRDT convergence
- Show live cursors and presence for all participants
- Implement agent-specific undo/redo without affecting other participants
- Set up collaborative planning sessions with typed roles

## Architecture

### CRDT Stack (Yjs)

| Component | Package | Role |
|---|---|---|
| Core CRDT engine | `yjs` (900K+ weekly) | Binary-encoded CRDTs with sub-ms merge |
| Editor bindings | `y-monaco`, `y-codemirror` | Monaco/CodeMirror collaborative editing |
| Awareness | `y-protocols/awareness` | Live cursors, selections, user presence |
| WebSocket provider | `y-websocket` | Primary real-time sync |
| P2P fallback | `y-webrtc` | Decentralized fallback when server offline |
| Offline persistence | `y-indexeddb` | Local persistence for offline work |
| Redis provider | `y-redis` | Upstash-backed cross-server sync |
| Cloudflare provider | `y-cloudflare` | Durable Objects for edge-native CRDT |

### Participant Model

```javascript
// Each participant (human or AI) gets unique identity
const awareness = ydoc.awareness;
awareness.setLocalState({
  user: {
    name: 'HeadyBee-042',
    type: 'agent',  // 'human' | 'agent'
    role: 'editor', // 'owner' | 'editor' | 'viewer' | 'agent'
    color: '#FFD700',
    cursor: { line: 42, col: 8 }
  }
});
```

### Agent-Specific UndoManager

```javascript
// Each AI agent gets dedicated undo stack
const agentUndo = new Y.UndoManager(ytext, {
  trackedOrigins: new Set(['agent-heady-bee-042'])
});
// Human can undo one agent's changes without affecting others
agentUndo.undo(); // Only reverts agent-042's edits
```

## Instructions

### Setting Up a Collaborative Session

1. Create a Yjs document with shared types (`Y.Text`, `Y.Map`, `Y.Array`).
2. Connect a provider (`y-websocket` primary, `y-webrtc` fallback).
3. Initialize Awareness with participant metadata.
4. Bind to editor (Monaco or CodeMirror) via editor-specific binding.
5. Create per-agent `Y.UndoManager` for each AI participant.
6. Set up observation handlers for remote changes.

### Semantic Merge Protocol

When multiple agents edit the same region:

1. Both edits apply to separate CRDT branches (operational transforms).
2. Yjs CRDT guarantees eventual consistency — no data loss.
3. CSL gate scores which edit better serves user intent.
4. Winner promoted as primary, alternative preserved as named branch.
5. User can review and cherry-pick from alternatives.

### Session Roles

| Role | Permissions |
|---|---|
| **Owner** | Full control, can revoke any participant |
| **Editor** | Read + write, subject to region locks |
| **Viewer** | Read-only, presence visible |
| **Agent** | Write within assigned scope, auto-undo capable |

### Security

- Firebase JWT authentication for WebSocket connections.
- Channel IDs isolate concurrent sessions.
- Region locks prevent conflicts on critical code sections.
- All edits logged to governance stream with participant ID + timestamp.

## Output Format

- Session Configuration
- Participant List with Roles
- Merge Resolution Report
- Conflict History
- Awareness State Snapshot
