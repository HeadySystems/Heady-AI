/**
 * EdgeCacheBee — High-Frequency Asset Caching
 * 
 * Optimizes kiosk performance by caching high-frequency assets at the edge.
 */

'use strict';

class EdgeCacheBee {
    constructor() {
        this.cache = new Map();
        this.ttl = 3600; // 1 hour default
    }

    /**
     * Retrieve an asset from the edge cache.
     * @param {string} assetId 
     */
    async getAsset(assetId) {
        if (this.cache.has(assetId)) {
            console.log(`⚡ [EdgeCache] HIT: ${assetId}. Serving from local edge storage.`);
            return this.cache.get(assetId);
        }

        console.log(`🐢 [EdgeCache] MISS: ${assetId}. Fetching from primary repository...`);
        const asset = await this._fetchFromOrigin(assetId);
        this.cache.set(assetId, asset);
        return asset;
    }

    async _fetchFromOrigin(id) {
        // Simulation: Fetching from Cloud Storage or Repository
        return { id, data: '...', size: '1.6MB' };
    }

    /**
     * Invalidate a specific asset or the entire cache.
     */
    invalidate(id = null) {
        if (id) {
            this.cache.delete(id);
            console.log(`🧹 [EdgeCache] Invalidated asset: ${id}`);
        } else {
            this.cache.clear();
            console.log('🧹 [EdgeCache] FLUSHED ENTIRE EDGE CACHE.');
        }
    }
}

module.exports = new EdgeCacheBee();
