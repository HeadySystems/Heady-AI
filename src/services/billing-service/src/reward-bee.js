/**
 * RewardBee — Open-Source Contribution Incentives
 * 
 * Automates HDC rewards for community code and task contributions.
 */

'use strict';

const hdc = require('./heady-coin');

class RewardBee {
    constructor() {
        this.baseReward = 89; // Fib(11)
    }

    /**
     * Issue a reward for a contribution.
     * @param {string} contributorId 
     * @param {string} type — 'code', 'bugfix', 'bee-module'
     * @param {number} impact — 0.0 to 1.0
     */
    async issueReward(contributorId, type, impact = 0.618) {
        const rewardAmount = Math.floor(this.baseReward * impact * 1.618);
        
        console.log(`🎁 [RewardBee] Issuing reward for ${type}: ${rewardAmount} HDC to ${contributorId}`);
        
        try {
            hdc.mint(contributorId, rewardAmount);
            hdc.transfer('heady_treasury', contributorId, 0, `Contribution Reward: ${type}`);
            return { ok: true, rewardAmount };
        } catch (err) {
            console.error(`❌ [RewardBee] Reward failure: ${err.message}`);
            return { ok: false, error: err.message };
        }
    }
}

module.exports = new RewardBee();
