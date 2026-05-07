/**
 * CreditService — Heady™ Internal Credit Economy
 * 
 * Consolidates HDC as a global credit for all ecosystem interactions.
 * Implements "Burn" logic for high-value reasoning.
 */

'use strict';

const hdc = require('./heady-coin');

class CreditService {
    /**
     * Consume credits for a specific action.
     * @param {string} userId 
     * @param {string} action — 'inference', 'outreach', 'provision'
     */
    async consume(userId, action) {
        const actionCosts = {
            'inference': 1,      // 1 HDC
            'outreach': 13,      // Fib(7)
            'provision': 144,    // Fib(12)
            'restricted_llm': 21 // Fib(8)
        };

        const cost = actionCosts[action] || 1;
        console.log(`🔥 [Credits] User ${userId} consuming ${cost} HDC for ${action}...`);

        try {
            hdc.transfer(userId, 'heady_treasury', cost, `Action: ${action}`);
            return { ok: true, remaining: hdc.getBalance(userId) };
        } catch (err) {
            console.error(`❌ [Credits] Consumption failed: ${err.message}`);
            throw new Error('Insufficient HeadyCredits');
        }
    }

    /**
     * Get user balance and credit status.
     */
    getStatus(userId) {
        const balance = hdc.getBalance(userId);
        return {
            userId,
            balanceHDC: balance,
            balanceUSD: hdc.hdcToUsd(balance),
            isSolvent: balance > 0
        };
    }
}

module.exports = new CreditService();
