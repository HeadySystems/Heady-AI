---
name: heady-semantic-cache
description: Use when implementing LLM response caching, reducing API costs via semantic similarity matching, or optimizing repeated query patterns in the Heady™ ecosystem. Keywords include semantic cache, cosine similarity, LLM cache, token savings, cost reduction, response cache, deduplication.
metadata:
  author: HeadySystems
  version: '1.0'
  liquid_node: LiquidCache
  absorption_source: "LiteLLM/Bifrost — 95% cost reduction via semantic caching"
---

# Heady™ Semantic Cache (LiquidCache)

## When to Use This Skill

Use this skill when the user needs to:
- Reduce LLM API costs by caching semantically similar queries
- Speed up responses for repeated or similar questions
- Implement cost-aware model routing
- Build analytics on cache hit rates and token savings

## Architecture

### Cache Flow

```
User Query → Embed Query → Search Cache (cosine ≥ 0.95)
                               │
               ┌───────────────┴───────────────┐
            HIT (≥0.95)                     MISS (<0.95)
               │                               │
          Return Cached                   Call LLM API
          Response                             │
               │                          Cache Response
               └───────────┬──────────────────┘
                      Return to User
```

### Redis Cache Schema

```javascript
// Cache entry structure
{
  key: 'semantic:${sha256(embedding)}',
  value: {
    query: 'original query text',
    embedding: Float32Array,        // Query embedding vector
    response: 'cached LLM response',
    model: 'claude-sonnet-4-20250514',
    tokens_used: 1847,
    created_at: ISO8601,
    hit_count: 0,
    cost_saved_cents: 0
  },
  ttl: 89 * 60  // fib(11) minutes
}
```

### Similarity Thresholds

| Threshold | Action | Use Case |
|---|---|---|
| ≥ 0.99 | Exact match | Identical queries (different sessions) |
| ≥ 0.95 | Semantic match | Paraphrased queries |
| 0.90-0.95 | Partial match | Return cached + augment with delta |
| < 0.90 | Cache miss | Full LLM call |

## Instructions

### Implementing Semantic Cache

1. Embed incoming query using `text-embedding-3-small` (fast, cheap).
2. Search Redis for vectors with cosine similarity ≥ 0.95.
3. If hit: return cached response, increment hit_count, log cost savings.
4. If miss: call LLM, cache response with embedding, set φ-scaled TTL.
5. Track metrics: hit rate, total tokens saved, cost savings.

### Cache Invalidation

- TTL-based: fib(11) = 89 minutes default.
- Code-change triggered: invalidate caches referencing changed files.
- Manual: `heady cache clear --scope=<pattern>`.
- Per-model: different TTLs for different model tiers.

### Cost Tracking

```
Monthly Projection at 100M tokens:
  Without cache: $150K-$180K
  With 60% hit rate: $60K-$72K
  Savings: $90K-$108K/month (95% for repeated patterns)
```

## Output Format

- Cache Hit Rate Dashboard
- Token Savings Report
- Cost Comparison (cached vs uncached)
- Cache Entry Browser
- Invalidation Log
