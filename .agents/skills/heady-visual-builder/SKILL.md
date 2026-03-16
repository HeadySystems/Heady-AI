---
name: heady-visual-builder
description: Use when implementing visual workflow construction, drag-and-drop DAG building, or no-code pipeline composition in the Heady™ ecosystem. Keywords include visual builder, canvas, DAG, drag-and-drop, workflow editor, no-code, pipeline composer, flow builder.
metadata:
  author: HeadySystems
  version: '1.0'
  liquid_node: LiquidCanvas
  absorption_source: "n8n visual flow builder — 500+ integrations"
---

# Heady™ Visual Builder (LiquidCanvas)

## When to Use This Skill

Use this skill when the user needs to:
- Build agent workflows visually without writing code
- Compose HCFullPipeline stages via drag-and-drop
- Export visual workflows as JSON pipeline definitions
- Add human-in-the-loop approval gates visually

## Architecture

### Node Types

| Category | Nodes |
|---|---|
| **Input** | Webhook Trigger, Schedule Trigger, File Watcher, Manual Trigger |
| **AI** | LLM Call, Embedding, Classification, Code Generation |
| **Code** | Run Script, Linter Gate, Test Runner, Build |
| **Data** | Database Query, API Call, File Read/Write, Cache |
| **Logic** | CSL Gate, Branch, Merge, Loop, Fan-Out/Fan-In |
| **Communication** | Slack, Discord, Email, Webhook |
| **Approval** | Human Review, Auto-Approve (CSL ≥ 0.618), Escalate |

### Canvas Data Model

```typescript
interface WorkflowCanvas {
  id: string;
  name: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport: { x: number; y: number; zoom: number };
}

interface CanvasNode {
  id: string;
  type: string;         // From node type registry
  position: { x: number; y: number };
  config: Record<string, unknown>;  // Node-specific settings
  inputs: Port[];
  outputs: Port[];
}

interface CanvasEdge {
  source: { nodeId: string; portId: string };
  target: { nodeId: string; portId: string };
  condition?: string;   // CSL expression for conditional routing
}
```

### Export Formats

| Format | Use Case |
|---|---|
| JSON Pipeline | HeadySwarm DAG execution |
| MCP Tool | Register workflow as callable MCP tool |
| YAML Template | Reusable swarm template |
| Mermaid Diagram | Documentation |

## Instructions

### Building a Visual Workflow

1. Open LiquidCanvas at `heady.build/canvas`.
2. Drag nodes from the palette onto the canvas.
3. Connect outputs to inputs by drawing edges.
4. Configure each node (click to open settings panel).
5. Add CSL gate conditions on edges for conditional routing.
6. Add approval nodes where human review is needed.
7. Test with sample input. Export as JSON pipeline.

## Output Format

- Workflow JSON Definition
- Visual Canvas Screenshot
- Execution Trace
- Node Configuration Report
