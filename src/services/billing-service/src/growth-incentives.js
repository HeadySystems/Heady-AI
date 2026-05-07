/**
 * GrowthIncentiveService — Dynamic Network Adoption Discounts
 * 
 * Incentivizes early node operators with φ-scaled discount curves.
 */

'use strict';

class GrowthIncentiveService {
    constructor() {
        this.baseDiscount = 0.618; // 61.8% max discount
        this.growthThreshold = 144; // Fib(12) nodes
    }

    /**
     * Calculate current growth discount based on active node count.
     * @param {number} activeNodeCount 
     */
    calculateDiscount(activeNodeCount) {
        if (activeNodeCount >= this.growthThreshold) return 0;
        
        // Linear decay of discount as we approach the threshold
        const decayFactor = 1 - (activeNodeCount / this.growthThreshold);
        const currentDiscount = this.baseDiscount * decayFactor;

        console.log(`📈 [Growth] Network size: ${activeNodeCount} nodes. Current Discount: ${(currentDiscount * 100).toFixed(1)}%`);
        
        return parseFloat(currentDiscount.toFixed(4));
    }

    /**
     * Apply discount to a plan price.
     */
    applyDiscount(price, activeNodeCount) {
        const discount = this.calculateDiscount(activeNodeCount);
        return price * (1 - discount);
    }
}

module.exports = new GrowthIncentiveService();
