/**
 * Heady™ MCP Tool — Memory Operations
 * Provides persistent vector memory storage and retrieval
 */

'use strict';

const logger = require('../../utils/logger');

let memoryStore = null;

/**
 * Initialize VectorMemoryStore (singleton)
 */
async function getStore() {
    if (memoryStore) return memoryStore;
    
    try {
        // Dynamic import since vector-store is ESM
        const { VectorMemoryStore } = await import('../../core/vector-memory/vector-store.js');
        
        // Initialize in-memory (no pool provided)
        memoryStore = new VectorMemoryStore({
            dimension: 384 // all-MiniLM-L6-v2 default
        });
        
        logger.info('Heady™ Vector Memory Store initialized (In-Memory Mode)');
        return memoryStore;
    } catch (error) {
        logger.error('Failed to initialize Vector Memory Store', { error: error.message });
        throw error;
    }
}

/**
 * Tool Handler
 */
async function handler(args) {
    const { action, query, content, key, metadata = {}, namespace = 'default', limit = 10 } = args;
    const store = await getStore();
    
    try {
        switch (action) {
            case 'store':
                if (!content) throw new Error('Content is required for store action');
                // Note: In a full implementation, we'd embed the content here.
                // For this MCP tool, we assume the user might provide an embedding 
                // or we use a dummy one if not available for this demonstration.
                // In production, heady-manager would provide the embedding.
                const record = await store.store({
                    content,
                    metadata,
                    namespace
                });
                return {
                    success: true,
                    action: 'store',
                    id: record.id,
                    message: 'Memory stored successfully'
                };
                
            case 'search':
                if (!query) throw new Error('Query is required for search action');
                const results = await store.search(query, {
                    limit,
                    namespace
                });
                return {
                    success: true,
                    action: 'search',
                    results: results.map(r => ({
                        content: r.content,
                        score: r.score,
                        metadata: r.metadata,
                        id: r.id
                    }))
                };
                
            case 'delete':
                if (!key) throw new Error('Key is required for delete action');
                const deleted = await store.delete(key);
                return {
                    success: true,
                    action: 'delete',
                    key,
                    found: deleted
                };
                
            case 'recall':
                // List all entries in namespace
                const entries = [...store.records.values()]
                    .filter(r => r.namespace === namespace)
                    .map(r => ({ id: r.id, content: r.content, metadata: r.metadata }));
                return {
                    success: true,
                    action: 'recall',
                    count: entries.length,
                    entries
                };

            case 'forget':
                // Clear namespace
                let count = 0;
                for (const [id, r] of store.records.entries()) {
                    if (r.namespace === namespace) {
                        store.records.delete(id);
                        count++;
                    }
                }
                return {
                    success: true,
                    action: 'forget',
                    namespace,
                    clearedCount: count
                };

            default:
                throw new Error(`Unsupported action: ${action}`);
        }
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = { handler };
