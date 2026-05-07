/**
 * RevenueShareService — Decentralized Payout Automation
 * 
 * Calculates and distributes earnings to node operators.
 * Splits: 38.2% (Operator) / 61.8% (Treasury & Swarm Liquidity)
 */

'use strict';

const hdc = require('./heady-coin');
const sovereignPayments = require('./sovereign-payments');

class RevenueShareService {
    constructor() {
        this.operatorSplit = 0.382; // 1 - 0.618
        this.treasurySplit = 0.618;
    }

    /**
     * Process a payout for a node's earnings.
     * @param {string} nodeId 
     * @param {number} totalEarningsHDC 
     */
    async processPayout(nodeId, totalEarningsHDC) {
        const operatorAmount = Math.floor(totalEarningsHDC * this.operatorSplit);
        const treasuryAmount = totalEarningsHDC - operatorAmount;

        console.log(`💰 [RevenueShare] Processing payout for ${nodeId}: ${totalEarningsHDC} HDC`);
        console.log(`   └─ Operator (38.2%): ${operatorAmount} HDC`);
        console.log(`   └─ Treasury (61.8%): ${treasuryAmount} HDC`);

        try {
            // Transfer to operator
            hdc.transfer('heady_treasury', nodeId, operatorAmount, 'Monthly Revenue Share');
            
            // Log for sovereign crypto payout option
            const usdValue = hdc.hdcToUsd(operatorAmount);
            if (usdValue > 100) {
                console.log(`🚀 [RevenueShare] Node ${nodeId} eligible for USDC payout: $${usdValue}`);
            }

            return {
                ok: true,
                nodeId,
                operatorAmount,
                treasuryAmount,
                usdEquivalent: usdValue
            };
        } catch (err) {
            console.error(`❌ [RevenueShare] Payout failed: ${err.message}`);
            return { ok: false, error: err.message };
        }
    }
}

module.exports = new RevenueShareService();
