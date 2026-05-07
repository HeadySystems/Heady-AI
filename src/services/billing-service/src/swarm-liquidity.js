/**
 * Heady™ Swarm Liquidity Pool
 * 
 * Autonomously trades compute credits between nodes using HeadyCoin (HDC).
 * Rebalances liquidity based on swarm demand and resource availability.
 */

'use strict';

const hdc = require('./heady-coin');

class SwarmLiquidityPool {
    constructor() {
        this.baseRatePerComputeUnit = 10; // 10 HDC per unit
    }

    /**
     * Settle work performed by a node.
     * @param {string} nodeId — The node that performed the work
     * @param {string} consumerId — The entity that consumed the compute
     * @param {number} computeUnits — Units of work (CPU/GPU hours)
     */
    async settleWork(nodeId, consumerId, computeUnits) {
        const totalHdc = computeUnits * this.baseRatePerComputeUnit;
        
        console.log(`⚖️ [Liquidity] Settling ${computeUnits} units: ${consumerId} -> ${nodeId} (${totalHdc} HDC)`);
        
        try {
            hdc.transfer(consumerId, nodeId, totalHdc, `Compute Settlement: ${computeUnits} units`);
            return { ok: true, amount: totalHdc };
        } catch (err) {
            console.warn(`⚠️ [Liquidity] Settlement failed: ${err.message}. Minting emergency liquidity...`);
            // In a sovereign system, we can mint credit to ensure continuity
            hdc.mint(consumerId, totalHdc);
            hdc.transfer(consumerId, nodeId, totalHdc, 'Emergency Compute Settlement');
            return { ok: true, amount: totalHdc, emergency: true };
        }
    }

    /**
     * Get pool health metrics.
     */
    getPoolMetrics() {
        const ledger = hdc._readLedger();
        return {
            totalLiquidityHDC: ledger.totalSupply,
            totalLiquidityUSD: hdc.hdcToUsd(ledger.totalSupply),
            activeWallets: Object.keys(ledger.wallets).length,
            transactionCount: ledger.transactions.length
        };
    }
}

module.exports = new SwarmLiquidityPool();
