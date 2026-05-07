/**
 * RenewalBee — Automated Subscription Retention
 * 
 * Monitors subscription status and triggers retention incentives for expiring users.
 */

'use strict';

const hdc = require('./heady-coin');

class RenewalBee {
    constructor() {
        this.retentionThresholdDays = 3; // Trigger 3 days before expiry
        this.bonusCreditAmount = 34;    // Fib(9) bonus for renewal
    }

    /**
     * Check for expiring subscriptions and trigger retention.
     * @param {Array} subscriptions 
     */
    async processExpiring(subscriptions) {
        const now = Date.now();
        const results = [];

        for (const sub of subscriptions) {
            const timeLeft = sub.expiryDate - now;
            const daysLeft = timeLeft / (24 * 60 * 60 * 1000);

            if (daysLeft > 0 && daysLeft <= this.retentionThresholdDays) {
                console.log(`🐝 [RenewalBee] User ${sub.userId} subscription expiring in ${daysLeft.toFixed(1)} days.`);
                const incentive = this._issueRetentionIncentive(sub.userId);
                results.push({ userId: sub.userId, status: 'incentivized', ...incentive });
            }
        }

        return results;
    }

    _issueRetentionIncentive(userId) {
        console.log(`🎁 [RenewalBee] Issuing ${this.bonusCreditAmount} HDC retention bonus to ${userId}`);
        hdc.mint(userId, this.bonusCreditAmount);
        return { bonusHDC: this.bonusCreditAmount };
    }
}

module.exports = new RenewalBee();
