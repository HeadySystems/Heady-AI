const { z } = require('zod');
const { getLog } = require('../../../src/kernel');
const { importanceScore, shouldDiscard, compressEpisodic } = require('./memory-operations');

const StoreSchema = z.object({
  id: z.string().uuid().optional(),
  content: z.string(),
  metadata: z.record(z.any()).optional().default({}),
  importance: z.number().min(0).max(1).default(0.5)
});

const RetrieveSchema = z.object({
  query: z.string().optional(),
  limit: z.number().int().positive().default(10)
});

const UpdateSchema = z.object({
  id: z.string(),
  content: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  importance: z.number().min(0).max(1).optional()
});

const SummarizeSchema = z.object({
  targetLength: z.number().int().positive().default(1000)
});

const DiscardSchema = z.object({
  systemPressure: z.number().min(0).max(1).default(0.5)
});

class MemoryManager {
  constructor(vectorMemoryInstance) {
    this.memory = vectorMemoryInstance;
    this.logger = getLog('memory-manager');
    this.stats = {
      hits: 0,
      misses: 0,
      discarded: 0,
      totalBytesCompressed: 0,
      totalBytesAfterCompression: 0
    };
  }

  static async initialize(vectorMemoryInstance) {
    return new MemoryManager(vectorMemoryInstance);
  }

  async store(params) {
    const validated = StoreSchema.parse(params);
    const id = validated.id || crypto.randomUUID();
    
    // Store in underlying vector memory (assumes VectorMemory API)
    // We pass content as text to be embedded
    let entry;
    if (this.memory.storeText) {
      entry = await this.memory.storeText(id, validated.content, validated.metadata, validated.importance);
    } else {
      // Fallback if no storeText available directly
      entry = {
        id,
        content: validated.content,
        metadata: validated.metadata,
        importance: validated.importance,
        createdAt: Date.now()
      };
      // For a real implementation, we would embed it here and call memory.store()
    }

    this.logger.info('AgeMem stored entry', { id, importance: validated.importance });
    return entry;
  }

  async retrieve(params) {
    const validated = RetrieveSchema.parse(params);
    
    let results = [];
    if (validated.query && this.memory.searchText) {
      results = await this.memory.searchText(validated.query, validated.limit);
      if (results && results.length > 0) {
        this.stats.hits++;
      } else {
        this.stats.misses++;
      }
    } else {
      // Just fallback retrieving all or top entries from the vault if no search
      this.stats.misses++;
    }

    this.logger.info('AgeMem retrieved entries', {
      query: validated.query,
      count: results ? results.length : 0,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses || 1)
    });

    return results;
  }

  async update(params) {
    const validated = UpdateSchema.parse(params);
    const existing = this.memory.get ? this.memory.get(validated.id) : null;
    
    if (!existing) {
      throw new Error(`Memory entry not found: ${validated.id}`);
    }

    // Since VectorMemory might be immutable per ID, we re-store or update metadata
    // In our simplified VectorMemory, we can just replace it
    const newContent = validated.content !== undefined ? validated.content : (existing.metadata.text || '');
    const newMetadata = validated.metadata !== undefined ? { ...existing.metadata, ...validated.metadata } : existing.metadata;
    const newImportance = validated.importance !== undefined ? validated.importance : existing.importance;

    const entry = await this.store({
      id: validated.id,
      content: newContent,
      metadata: newMetadata,
      importance: newImportance
    });

    this.logger.info('AgeMem updated entry', { id: validated.id });
    return entry;
  }

  async summarize(params) {
    const validated = SummarizeSchema.parse(params);
    
    // Fetch all or recent memory entries to summarize
    // In reality, this might query episodic entries
    const allEntries = this.memory.ids ? this.memory.ids().map(id => this.memory.get(id)) : [];
    
    const preCompressionBytes = JSON.stringify(allEntries).length;
    const summary = compressEpisodic(allEntries, validated.targetLength);
    const postCompressionBytes = summary.length;

    this.stats.totalBytesCompressed += preCompressionBytes;
    this.stats.totalBytesAfterCompression += postCompressionBytes;

    this.logger.info('AgeMem summarized episodic buffer', {
      preBytes: preCompressionBytes,
      postBytes: postCompressionBytes,
      compressionRatio: preCompressionBytes > 0 ? (postCompressionBytes / preCompressionBytes).toFixed(4) : 0
    });

    return summary;
  }

  async discard(params) {
    const validated = DiscardSchema.parse(params);
    
    const allIds = this.memory.ids ? this.memory.ids() : [];
    let discardedCount = 0;

    for (const id of allIds) {
      const entry = this.memory.get(id);
      if (entry && shouldDiscard(entry, validated.systemPressure)) {
        if (this.memory.delete) {
          this.memory.delete(id);
          discardedCount++;
          this.stats.discarded++;
        }
      }
    }

    this.logger.info('AgeMem discard pass completed', {
      systemPressure: validated.systemPressure,
      discardedCount,
      totalDiscarded: this.stats.discarded
    });

    return { discardedCount };
  }
}

module.exports = { MemoryManager };
