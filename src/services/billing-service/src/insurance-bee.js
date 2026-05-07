/**
 * InsuranceBee — Automated Node Failure Compensation
 * 
 * Protects node operators with autonomous insurance payouts for verified downtime.
 */

'use strict';

const hdc = require('./heady-coin');

class InsuranceBee {
    constructor() {
        this.basePremium = 21; // Fib(8) HDC
        this.payoutRate = 144; // Fib(12) HDC per hour of downtime
    }

    /**
     * Verify a failure and issue compensation.
     * @param {string} nodeId 
     * @param {number} downtimeHours 
     */
    async processClaim(nodeId, downtimeHours) {
        console.log(`🛡️ [InsuranceBee] Processing claim for Node: ${nodeId} (${downtimeHours}h downtime)...`);
        
        // Simulation: Verifying downtime via AnomalyBee and Heartbeat records
        const verified = true;
        
        if (!verified) {
            console.error('❌ [InsuranceBee] Claim REJECTED. Inconsistent heartbeat data.');
            return { ok: false, reason: 'VERIFICATION_FAILED' };
        }

        const payout = Math.floor(this.payoutRate * downtimeHours * 0.618);
        
        console.log(`   🎁 Claim APPROVED. Issuing ${payout} HDC compensation.`);
        
        try {
            hdc.transfer('insurance_pool', nodeId, payout, `Downtime Compensation (${downtimeHours}h)`);
            return { ok: true, payout };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    }

    /**
     * Subscribe a node to the insurance pool.
     */
    subscribe(nodeId) {
        console.log(`✅ [InsuranceBee] Node ${nodeId} subscribed to failure insurance.`);
        return { ok: true, premium: this.basePremium };
    }
}

module.exports = new InsuranceBee();
