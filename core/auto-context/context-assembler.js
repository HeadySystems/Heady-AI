/**
 * Context Assembler — Auto-Context Module
 * Assembles context from multiple sources for AI agent decision-making.
 * 
 * @module core/auto-context/context-assembler
 * @version 1.0.0
 * @author HeadySystems™
 */

'use strict';

const PHI = 1.618033988749895;

class ContextAssembler {
    constructor(opts = {}) {
        this.maxContextSize = opts.maxContextSize || 8192;
        this.sources = new Map();
        this.cache = new Map();
        this.cacheTTL = Math.round(PHI * PHI * PHI * 1000); // ~4236ms
    }

    registerSource(name, fetchFn) {
        this.sources.set(name, fetchFn);
    }

    async assembleContext(query, options = {}) {
        const results = {};
        for (const [name, fetchFn] of this.sources) {
            try {
                results[name] = await fetchFn(query, options);
            } catch (err) {
                results[name] = { error: err.message };
            }
        }
        return {
            query,
            timestamp: Date.now(),
            sources: results,
            totalSources: this.sources.size,
        };
    }

    async analyzeContext(query) {
        const context = await this.assembleContext(query);
        return {
            ...context,
            relevanceScore: 0.85,
            coveragePercent: (Object.keys(context.sources).length / Math.max(this.sources.size, 1)) * 100,
        };
    }

    getContextCoverage() {
        return {
            registeredSources: this.sources.size,
            cachedEntries: this.cache.size,
        };
    }

    health() {
        return {
            service: 'context-assembler',
            version: '1.0.0',
            sources: this.sources.size,
            cacheSize: this.cache.size,
        };
    }
}

function analyzeContext(query) {
    const assembler = new ContextAssembler();
    return assembler.analyzeContext(query);
}

module.exports = { ContextAssembler, analyzeContext };
