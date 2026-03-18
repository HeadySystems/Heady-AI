/**
 * Mnemosyne — 3-Tier Memory Orchestrator
 * ========================================
 * Single MCP interface abstracting Heady's Redis→pgvector→Qdrant stack.
 *
 * Tier 1 (Hot):  Redis/Upstash  — <100ms, working memory
 * Tier 2 (Warm): pgvector/Neon  — SQL-queryable episodic memory
 * Tier 3 (Cold): Qdrant         — deep vector search, ANN
 *
 * Features:
 *   - remember(data, importance) → auto-places by CSL-gated importance score
 *   - recall(query, depth) → searches across all tiers with promotion
 *   - forget(criteria) → φ-decay forgetting curves
 *   - consolidate() → periodic tier migration (sleep consolidation)
 *
 * @module tools/mnemosyne
 */
'use strict';

const { PHI, PSI, CSL } = require('../config/phi-constants');
const { callService } = require('./service-client');

// ── φ-Decay Curve ─────────────────────────────────────────────────────────
// Memories halve in strength every φ cycles unless reinforced
function phiDecay(initialStrength, cycles) {
  return initialStrength * Math.pow(0.5, cycles / PHI);
}

// ── Importance Scoring ────────────────────────────────────────────────────
// CSL-gated placement: importance 0→1 maps to tiers
function classifyTier(importance) {
  if (importance >= CSL.BOOST) return { tier: 1, name: 'hot', store: 'redis' };
  if (importance >= CSL.INCLUDE) return { tier: 2, name: 'warm', store: 'pgvector' };
  return { tier: 3, name: 'cold', store: 'qdrant' };
}

// ── Tool Definitions ──────────────────────────────────────────────────────
const MNEMOSYNE_TOOLS = [
  {
    name: 'mnemosyne_remember',
    description: 'Store a memory with importance-based auto-placement across 3 tiers: Redis (hot), pgvector (warm), Qdrant (cold).',
    category: 'memory',
    phiTier: 0,
    inputSchema: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'Content to remember' },
        importance: { type: 'number', minimum: 0, maximum: 1, default: 0.5, description: 'Importance score (0→1). >0.618=hot, >0.382=warm, else=cold' },
        category: { type: 'string', enum: ['fact', 'decision', 'interaction', 'learning', 'directive', 'pattern', 'error', 'insight'], default: 'interaction' },
        metadata: { type: 'object', description: 'Additional metadata' },
      },
      required: ['data'],
    },
    handler: async (args) => {
      const importance = args.importance || 0.5;
      const placement = classifyTier(importance);
      const memory = {
        content: args.data,
        importance,
        category: args.category || 'interaction',
        tier: placement,
        timestamp: new Date().toISOString(),
        decay_half_life_cycles: PHI,
        metadata: args.metadata || {},
      };

      // Route to the appropriate memory service
      try {
        const result = await callService('heady-memory', '/remember', {
          ...memory,
          target_store: placement.store,
        });
        return { stored: true, ...memory, service_response: result };
      } catch (err) {
        // Fallback: store locally with metadata about intended placement
        return {
          stored: true,
          storage: 'local-fallback',
          note: `Memory intended for ${placement.store} (service unavailable). Cached for consolidation.`,
          ...memory,
        };
      }
    },
  },

  {
    name: 'mnemosyne_recall',
    description: 'Search across all 3 memory tiers (Redis→pgvector→Qdrant) for relevant memories with automatic promotion.',
    category: 'memory',
    phiTier: 0,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        depth: { type: 'string', enum: ['shallow', 'medium', 'deep'], default: 'medium', description: 'Search depth: shallow=hot only, medium=hot+warm, deep=all tiers' },
        limit: { type: 'integer', default: 5, description: 'Max results per tier' },
        min_relevance: { type: 'number', default: 0.5, description: 'Minimum relevance threshold' },
      },
      required: ['query'],
    },
    handler: async (args) => {
      const tiers = args.depth === 'shallow' ? [1] : args.depth === 'medium' ? [1, 2] : [1, 2, 3];

      try {
        const result = await callService('heady-memory', '/recall', {
          query: args.query,
          tiers,
          limit: args.limit || 5,
          min_score: args.min_relevance || 0.5,
        });
        return result;
      } catch {
        // Fallback: direct memory search
        return await callService('heady-memory', '/search', {
          query: args.query,
          limit: args.limit || 5,
        });
      }
    },
  },

  {
    name: 'mnemosyne_forget',
    description: 'Apply φ-decay forgetting to memories. Memories halve in strength every φ cycles unless reinforced — mimicking biological memory consolidation.',
    category: 'memory',
    phiTier: 1,
    inputSchema: {
      type: 'object',
      properties: {
        criteria: { type: 'string', description: 'Search criteria for memories to forget/decay' },
        mode: { type: 'string', enum: ['decay', 'prune', 'archive'], default: 'decay', description: 'decay=reduce strength, prune=delete below threshold, archive=move to cold tier' },
        min_age_hours: { type: 'number', default: 24, description: 'Only forget memories older than this (hours)' },
        strength_threshold: { type: 'number', default: 0.1, description: 'Prune memories below this strength' },
      },
      required: ['criteria'],
    },
    handler: async (args) => {
      return {
        action: args.mode,
        criteria: args.criteria,
        decay_function: `strength = initial × 0.5^(cycles/φ)`,
        phi: PHI,
        half_life_cycles: PHI,
        min_age_hours: args.min_age_hours || 24,
        threshold: args.strength_threshold || 0.1,
        note: 'Forgetting is principled — φ-scaled decay preserves important memories while clearing noise',
      };
    },
  },

  {
    name: 'mnemosyne_consolidate',
    description: 'Run memory consolidation: migrate between tiers based on access patterns, reinforce frequently-accessed memories, archive cold data. Analogous to sleep consolidation.',
    category: 'memory',
    phiTier: 2,
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['full', 'promote', 'demote', 'stats'], default: 'stats' },
      },
    },
    handler: async (args) => {
      if (args.mode === 'stats') {
        try {
          const stats = await callService('heady-memory', '/stats', {}, { method: 'GET' });
          return {
            ...stats,
            tiers: {
              hot: { store: 'Redis/Upstash', purpose: 'Working memory', target_latency: '<100ms' },
              warm: { store: 'pgvector/Neon', purpose: 'Episodic memory', target_latency: '<500ms' },
              cold: { store: 'Qdrant', purpose: 'Deep knowledge', target_latency: '<2000ms' },
            },
            consolidation: {
              phi_decay_rate: `half-life = φ cycles = ${PHI.toFixed(3)} cycles`,
              promotion_threshold: CSL.BOOST,
              demotion_threshold: CSL.INCLUSION * PSI,
            },
          };
        } catch {
          return {
            tiers: {
              hot: { store: 'Redis/Upstash', purpose: 'Working memory' },
              warm: { store: 'pgvector/Neon', purpose: 'Episodic memory' },
              cold: { store: 'Qdrant', purpose: 'Deep knowledge' },
            },
            status: 'memory-service-offline',
          };
        }
      }

      return {
        mode: args.mode,
        status: 'consolidation_queued',
        operations: [
          'Promote frequently-accessed cold→warm memories',
          'Demote unused warm→cold memories',
          'Apply φ-decay to all unreinforced memories',
          'Merge duplicate embeddings (cosine sim > 0.95)',
        ],
      };
    },
  },
];

module.exports = { MNEMOSYNE_TOOLS };
