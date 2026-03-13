// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: src/services/heady-memory-service.js                      ║
// ║  LAYER: backend/src                                              ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

/**
 * HeadyMemoryService — Integration layer for HeadyMemory + HeadyAutoContext
 *
 * Instantiates the 3-tier vector memory system and 5-pass enrichment pipeline,
 * wires them together, and exposes Express routes for the manager server.
 */

const express = require('express');
const { HeadyMemory } = require('../../packages/heady-memory');
const { HeadyAutoContext, createAutoContextRoutes, CONFIDENCE } = require('../../packages/heady-autocontext');

// φ-constants
const PHI = 1.618034;
const PSI = 0.618034;

class HeadyMemoryService {
  constructor(options = {}) {
    this.memory = new HeadyMemory(options.memoryOptions || {});
    this.autoContext = new HeadyAutoContext({
      memory: this.memory,
      embeddingFn: options.embeddingFn || null,
      knowledgeQueryFn: options.knowledgeQueryFn || null,
    });

    // Start consolidation cycle (φ-interval)
    this.memory.startConsolidation();

    // Forward enrichment events to the global event bus
    this.autoContext.on('enrichment:complete', (data) => {
      if (global.eventBus) {
        global.eventBus.emit('memory:enrichment', data);
      }
    });
  }

  /**
   * Create Express router with all memory + autocontext endpoints.
   */
  createRoutes() {
    const router = express.Router();

    // Mount AutoContext routes under /context/*
    router.use('/', createAutoContextRoutes(this.autoContext));

    // ─── Memory-specific routes ─────────────────────────────────

    router.get('/memory/stats', (req, res) => {
      res.json(this.memory.stats());
    });

    router.post('/memory/store', (req, res) => {
      try {
        const { tier, data } = req.body;
        if (!tier || !data) {
          return res.status(400).json({ error: 'tier and data are required' });
        }
        this.memory.store(tier, data);
        res.json({ stored: true, tier });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    router.post('/memory/search', async (req, res) => {
      try {
        const { vector, topK } = req.body;
        if (!vector) {
          return res.status(400).json({ error: 'vector is required' });
        }
        const embedding = new Float32Array(vector);
        const results = this.memory.search(embedding, topK || 5);
        res.json({ results });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    router.post('/memory/consolidate', (req, res) => {
      try {
        const result = this.memory.consolidate();
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    router.get('/memory/health', (req, res) => {
      const stats = this.memory.stats();
      res.json({
        status: 'ok',
        service: 'heady-memory',
        tiers: {
          t0: { size: stats.t0.size, cap: stats.t0.cap },
          t1: { size: stats.t1.size },
          t2: { size: stats.t2.size },
        },
        consolidationActive: true,
      });
    });

    return router;
  }

  /**
   * Get health status for subsystem reporting.
   */
  getHealthStatus() {
    const stats = this.memory.stats();
    return {
      service: 'heady-memory-autocontext',
      status: 'ok',
      memory: {
        t0Size: stats.t0.size,
        t1Size: stats.t1.size,
        t2Size: stats.t2.size,
      },
      autoContext: this.autoContext.getStats(),
    };
  }

  /**
   * Enrich input through the full 5-pass pipeline.
   */
  async enrich(input, context) {
    return this.autoContext.enrich(input, context);
  }

  /**
   * Fast enrichment (passes 1+2 only).
   */
  async enrichFast(input, context) {
    return this.autoContext.enrichFast(input, context);
  }

  /**
   * Direct memory store.
   */
  store(tier, data) {
    return this.memory.store(tier, data);
  }

  /**
   * Direct memory search.
   */
  search(vector, topK) {
    return this.memory.search(vector, topK);
  }
}

// Singleton instance
let instance = null;

function getMemoryService(options) {
  if (!instance) {
    instance = new HeadyMemoryService(options);
  }
  return instance;
}

module.exports = { HeadyMemoryService, getMemoryService };
