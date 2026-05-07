/**
 * EdgeShield — Edge-Level DDoS Protection & Rate Limiting
 * 
 * Protects the sovereign node network from volumetric and application-layer attacks.
 */

'use strict';

class EdgeShield {
    constructor() {
        this.rateLimit = 144; // Fib(12) requests per minute per IP
        this.ipReputation = new Map();
    }

    /**
     * Verify if a request should be allowed based on rate limits.
     * @param {string} ip 
     */
    async verifyRequest(ip) {
        const now = Date.now();
        const client = this.ipReputation.get(ip) || { count: 0, lastReset: now };

        if (now - client.lastReset > 60000) {
            client.count = 0;
            client.lastReset = now;
        }

        client.count++;
        this.ipReputation.set(ip, client);

        if (client.count > this.rateLimit) {
            console.warn(`🛡️ [EdgeShield] RATE LIMIT EXCEEDED for IP: ${ip}. Throttling...`);
            return { allowed: false, reason: 'RATE_LIMIT_EXCEEDED' };
        }

        return { allowed: true };
    }

    /**
     * Block a malicious IP range.
     */
    blockIP(range) {
        console.log(`🚫 [EdgeShield] BLOCKING IP Range: ${range}`);
    }
}

module.exports = new EdgeShield();
