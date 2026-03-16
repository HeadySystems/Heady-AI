---
name: heady-repo-map
description: Use when building repository context maps, ranking code symbols by importance, or generating concise codebase summaries for AI agents in the Heady™ ecosystem. Keywords include repo map, PageRank, tree-sitter, code graph, symbol ranking, codebase context, dependency graph, code navigation.
metadata:
  author: HeadySystems
  version: '1.0'
  liquid_node: LiquidGraphRank
  absorption_source: "Aider PageRank-based repository maps"
---

# Heady™ Repository Map (LiquidGraphRank)

## When to Use This Skill

Use this skill when the user needs to:
- Generate intelligent codebase context for AI agents
- Rank code symbols by architectural importance
- Build dependency graphs from import/require analysis
- Optimize which files/functions to include in LLM context
- Navigate large codebases efficiently

## Architecture

### Indexing Pipeline

```
Source Files → tree-sitter AST → Symbol Extraction → NetworkX Graph → PageRank → Ranked Map
     │              │                    │                  │              │
     └─ 78 repos    └─ per-language      └─ functions,      └─ edges =     └─ top-N symbols
                       parsers              classes,           imports,        per context
                                            modules            calls          budget
```

### Symbol Extraction (tree-sitter)

| Language | Parser | Extracted Symbols |
|---|---|---|
| TypeScript/JS | `tree-sitter-typescript` | functions, classes, interfaces, exports |
| Python | `tree-sitter-python` | functions, classes, decorators, imports |
| Kotlin | `tree-sitter-kotlin` | functions, classes, objects, companions |
| Go | `tree-sitter-go` | functions, types, interfaces, methods |

### PageRank Configuration

```python
# Build directed graph from code relationships
G = nx.MultiDiGraph()

# Nodes = symbols (functions, classes, modules)
G.add_node('auth/session.ts:createSession', type='function', lines=45)

# Edges = relationships (imports, calls, extends)
G.add_edge('api/router.ts', 'auth/session.ts:createSession', type='import')

# PageRank with φ-scaled personalization
personalization = {}
for node in recently_mentioned:
    personalization[node] = 10.0  # 10× boost for recently-mentioned
    
ranked = nx.pagerank(G, alpha=0.85, personalization=personalization)
```

### Repo Map Output Format

```
Repository Map (top 50 symbols by PageRank):

src/core/conductor.ts
│ class LatentConductor
│   ├── initialize()      [rank: 0.089]
│   ├── route()            [rank: 0.072]
│   └── healthCheck()      [rank: 0.041]
│
src/auth/session.ts
│ function createSession() [rank: 0.065]
│ function validateToken()  [rank: 0.058]
```

## Instructions

### Generating a Repo Map

1. Parse all source files with language-appropriate tree-sitter grammar.
2. Extract symbols: names, types, line ranges, docstrings.
3. Extract relationships: imports, calls, inheritance, composition.
4. Build NetworkX MultiDiGraph with symbols as nodes, relationships as edges.
5. Run PageRank with α=0.85 and personalization for recently-mentioned symbols.
6. Select top-N symbols fitting within the context token budget.
7. Format as hierarchical map showing file → symbol → rank.

### Incremental Updates

- On file save: re-parse changed file only (tree-sitter is fast: <10ms per file).
- Update graph edges for changed file.
- Re-compute PageRank (sparse update, not full recompute).
- φ-scheduled full rebuild every fib(8) = 21 hours.

### Context Budget Optimization

| Context Size | Strategy |
|---|---|
| <4K tokens | Top 20 symbols with signatures only |
| 4K-16K | Top 50 symbols with docstrings |
| 16K-64K | Top 100 symbols with partial bodies |
| 64K+ | Full file contents for top-ranked files |

## Output Format

- Repository Map (hierarchical symbol listing)
- Dependency Graph (DOT/Mermaid)
- PageRank Scores Table
- Context Token Budget Report
- Symbol Relationship Matrix
