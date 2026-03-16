---
name: heady-merkle-index
description: Use when implementing incremental codebase indexing, file change detection, or efficient re-embedding pipelines in the Heady™ ecosystem. Keywords include Merkle tree, incremental indexing, file hashing, change detection, embedding pipeline, re-index, sync.
metadata:
  author: HeadySystems
  version: '1.0'
  liquid_node: LiquidIndex
  absorption_source: "Cursor Merkle tree incremental indexing"
---

# Heady™ Merkle Index (LiquidIndex)

## When to Use This Skill

Use this skill when the user needs to:
- Index a large codebase efficiently (only changed files)
- Detect file changes without full re-scan
- Maintain persistent embedding index across sessions
- Synchronize codebase state between distributed workers
- Optimize re-embedding cost for iterative development

## Architecture

### Merkle Tree Structure

```
Root Hash: sha256(child1 + child2 + ...)
├── src/ [hash: a1b2c3...]
│   ├── core/ [hash: d4e5f6...]
│   │   ├── conductor.ts [hash: 789abc...]  ← file content hash
│   │   └── router.ts [hash: def012...]
│   └── api/ [hash: 345678...]
│       └── server.ts [hash: 9abcde...]
└── packages/ [hash: f01234...]
    └── ...
```

### Change Detection

```javascript
async function detectChanges(currentTree, previousTree) {
  if (currentTree.hash === previousTree.hash) return []; // No changes
  
  const changes = [];
  for (const [name, node] of currentTree.children) {
    const prev = previousTree.children.get(name);
    if (!prev) {
      changes.push({ type: 'added', path: node.path });
    } else if (node.hash !== prev.hash) {
      if (node.isFile) {
        changes.push({ type: 'modified', path: node.path });
      } else {
        changes.push(...detectChanges(node, prev)); // Recurse directories
      }
    }
  }
  for (const [name] of previousTree.children) {
    if (!currentTree.children.has(name)) {
      changes.push({ type: 'deleted', path: previousTree.children.get(name).path });
    }
  }
  return changes;
}
```

### Embedding Pipeline

| Stage | Tool | Purpose |
|---|---|---|
| 1. Hash | SHA-256 | Build/update Merkle tree |
| 2. Diff | Tree comparison | Identify changed files |
| 3. Chunk | tree-sitter | Split changed files at function/class boundaries |
| 4. Embed | voyage-code-2 + text-embedding-3-small | Dual embedding (code + NL summary) |
| 5. Store | Qdrant + pgvector | Upsert vectors, delete old chunks |
| 6. Persist | JSON snapshot | Save Merkle tree state for next comparison |

## Instructions

### Initial Full Index

1. Walk entire workspace, compute SHA-256 for every file.
2. Build Merkle tree bottom-up (files → directories → root).
3. Chunk all files using tree-sitter at function/class boundaries.
4. Generate dual embeddings (code + NL description).
5. Store in Qdrant with file path, line range, and hash metadata.
6. Persist Merkle tree snapshot to disk.

### Incremental Re-Index (on file change)

1. Compute new hash for changed file(s).
2. Update Merkle tree (propagate hash changes upward).
3. Compare with previous snapshot → identify changed files.
4. Re-chunk and re-embed ONLY changed files.
5. Upsert new vectors, delete stale vectors.
6. Save updated Merkle tree snapshot.

### Scheduling

| Event | Action |
|---|---|
| File save (IDE) | Immediate incremental re-index |
| Git commit | Batch re-index of committed files |
| φ-scheduled (21 hours) | Full verification re-index |
| New repo clone | Full initial index |

## Output Format

- Index Health Report
- Changed Files List
- Embedding Statistics
- Merkle Tree Visualization
- Index Coverage Map
