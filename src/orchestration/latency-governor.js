/**
 * Latency Governor — Tiered Service Quality
 * 
 * Injects artificial latency for lower-tier subscriptions to incentivize upgrades.
 * φ-scaled wait intervals.
 */

'use strict';

const { getPlan } = require('../services/billing-service/src/plans');

class LatencyGovernor {
    /**
     * Middleware to inject latency based on subscription plan.
     */
    async govern(req, res, next) {
        const planId = req.headers['x-heady-plan'] || 'free';
        const plan = getPlan(planId);
        
        let waitMs = 0;

        if (planId === 'free') {
            waitMs = 618; // 0.618s (φ-base)
        } else if (planId === 'builder') {
            waitMs = 233; // Fib(13)
        } else if (planId === 'premium' || planId === 'enterprise') {
            waitMs = 0; // Fast-path
        }

        if (waitMs > 0) {
            console.log(`⏳ [Latency] Gating request for ${planId}: +${waitMs}ms`);
            await new Promise(resolve => setTimeout(resolve, waitMs));
        }

        next();
    }
}

module.exports = new LatencyGovernor();
