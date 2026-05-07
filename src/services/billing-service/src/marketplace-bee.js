/**
 * MarketplaceBee — Community Module Registry
 * 
 * Manages the licensing and sale of community-contributed task modules.
 * Revenue Split: 70% Author / 30% Heady Treasury.
 */

'use strict';

const hdc = require('./heady-coin');

class MarketplaceBee {
    constructor() {
        this.modules = new Map();
        this.treasurySplit = 0.30;
        this.authorSplit = 0.70;
    }

    /**
     * Register a new community module.
     */
    registerModule(authorId, moduleName, priceHDC) {
        const moduleId = `mod-${moduleName.toLowerCase().replace(/\s+/g, '-')}`;
        this.modules.set(moduleId, {
            authorId,
            moduleName,
            priceHDC,
            salesCount: 0
        });
        console.log(`📦 [Marketplace] Registered module: ${moduleName} by ${authorId} ($${priceHDC} HDC)`);
        return moduleId;
    }

    /**
     * Purchase a module license.
     */
    async purchaseModule(userId, moduleId) {
        const mod = this.modules.get(moduleId);
        if (!mod) throw new Error('Module not found');

        const author = this._getAuthorTier(mod.authorId);
        const treasurySplit = author.feeRate;
        const authorSplit = 1 - treasurySplit;

        const authorShare = Math.floor(mod.priceHDC * authorSplit);
        const treasuryShare = mod.priceHDC - authorShare;

        console.log(`🛒 [Marketplace] User ${userId} purchasing ${mod.moduleName}`);
        console.log(`   └─ Split: ${(authorSplit * 100).toFixed(1)}% Author / ${(treasurySplit * 100).toFixed(1)}% Treasury`);
        
        try {
            // Transfer to author
            hdc.transfer(userId, mod.authorId, authorShare, `Sale: ${mod.moduleName}`);
            // Transfer to treasury
            hdc.transfer(userId, 'heady_treasury', treasuryShare, `Marketplace Fee: ${mod.moduleName}`);
            
            mod.salesCount++;
            return { ok: true, licenseId: `lic-${userId}-${moduleId}` };
        } catch (err) {
            console.error(`❌ [Marketplace] Purchase failed: ${err.message}`);
            throw err;
        }
    }

    /**
     * Calculate author tier based on sales volume.
     */
    _getAuthorTier(authorId) {
        // In production: Fetch total sales volume from ledger
        const salesVolume = 5000; // Mock volume
        
        if (salesVolume > 10000) return { tier: 'ELITE', feeRate: 0.1618 };
        if (salesVolume > 1000) return { tier: 'PROFESSIONAL', feeRate: 0.236 }; // Fib-scaled
        return { tier: 'STANDARD', feeRate: 0.30 };
    }

    /**
     * Get trending modules.
     */
    getTrending() {
        return Array.from(this.modules.values())
            .sort((a, b) => b.salesCount - a.salesCount)
            .slice(0, 5);
    }
}

module.exports = new MarketplaceBee();
