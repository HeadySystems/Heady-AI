/**
 * Heady™ Chaos Engine — Resilience Validator
 * Simulates adversarial infrastructure conditions.
 * 
 * © 2026 Heady™Systems Inc.
 */

const logger = require('./src/utils/logger'); // Assuming logger exists

class ChaosEngine {
    constructor(gateway, redisPool) {
        this.gateway = gateway;
        this.redisPool = redisPool;
    }

    /**
     * Scenario: API Brownout
     * Increases latency and failure rate for a specific provider.
     */
    async simulateBrownout(providerName, durationMs = 10000) {
        console.log(`🔥 [CHAOS] Starting Brownout on ${providerName} for ${durationMs}ms`);
        const originalComplete = this.gateway.PROVIDERS[providerName].complete;
        
        this.gateway.PROVIDERS[providerName].complete = async (messages, opts) => {
            // Add 2s latency
            await new Promise(r => setTimeout(r, 2000));
            // 50% failure rate
            if (Math.random() > 0.5) throw new Error('CHAOS_ERROR: Simulated API Timeout');
            return originalComplete.call(this.gateway.PROVIDERS[providerName], messages, opts);
        };

        setTimeout(() => {
            this.gateway.PROVIDERS[providerName].complete = originalComplete;
            console.log(`✅ [CHAOS] Brownout on ${providerName} restored.`);
        }, durationMs);
    }

    /**
     * Scenario: Redis Death
     * Simulates failure of the handoff pool.
     */
    async simulateRedisDeath(durationMs = 5000) {
        console.log(`🔥 [CHAOS] Starting Redis Death for ${durationMs}ms`);
        const originalHandoff = this.redisPool.agentHandoff;
        this.redisPool.agentHandoff = async () => { throw new Error('CHAOS_ERROR: Redis Connection Refused'); };

        setTimeout(() => {
            this.redisPool.agentHandoff = originalHandoff;
            console.log(`✅ [CHAOS] Redis restored.`);
        }, durationMs);
    }
}

module.exports = ChaosEngine;
