/**
 * AffiliateBee — Incentivized Ecosystem Distribution
 * 
 * Manages referrals and distributes HDC rewards for successful conversions.
 */

'use strict';

const hdc = require('./heady-coin');

class AffiliateBee {
    constructor() {
        this.rewardAmount = 144; // 144 HDC (Fib(12)) per referral
    }

    /**
     * Generate a referral link for a node operator.
     */
    generateReferralLink(nodeId) {
        return `https://heady.ai/onboard?ref=${nodeId}`;
    }

    /**
     * Process a successful conversion.
     */
    async processConversion(referrerId, newUserId) {
        console.log(`🐝 [Affiliate] Processing conversion: ${newUserId} referred by ${referrerId}`);
        
        try {
            hdc.mint(referrerId, this.rewardAmount);
            hdc.transfer('heady_treasury', referrerId, 0, `Referral Reward: ${newUserId}`); // Audit entry
            return { ok: true, reward: this.rewardAmount };
        } catch (err) {
            console.error(`❌ [Affiliate] Reward failure: ${err.message}`);
            return { ok: false, error: err.message };
        }
    }

    /**
     * Get affiliate stats.
     */
    getStats(nodeId) {
        const ledger = hdc._readLedger();
        const referrals = ledger.transactions.filter(tx => 
            tx.to === nodeId && tx.reason?.includes('Referral Reward')
        );

        return {
            totalReferrals: referrals.length,
            totalEarnedHDC: referrals.reduce((sum, tx) => sum + tx.amount, 0),
            potentialUSD: hdc.hdcToUsd(referrals.reduce((sum, tx) => sum + tx.amount, 0))
        };
    }
}

module.exports = new AffiliateBee();
