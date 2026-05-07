/**
 * Egress Governor — Restricted LLM Routing
 * 
 * Enforces security policies for outgoing requests to sensitive intelligence providers.
 */

'use strict';

class EgressGovernor {
    constructor() {
        this.allowList = [
            'api.openai.com',
            'api.anthropic.com',
            'api.google.com/vertexai',
            'heady.ai/internal'
        ];
    }

    /**
     * Intercept and filter outgoing requests.
     * @param {string} url 
     * @param {object} headers 
     */
    async filter(url, headers) {
        const domain = new URL(url).hostname;
        
        console.log(`🛡️ [EgressGovernor] Checking authorization for: ${domain}`);

        if (!this.allowList.includes(domain)) {
            console.error(`🚨 [EgressGovernor] BLOCKING unauthorized egress to: ${domain}`);
            throw new Error(`Sovereign Block: Unauthorized Egress to ${domain}`);
        }

        // Verify service token for internal routing
        if (domain === 'heady.ai/internal' && headers['x-heady-service-token'] !== process.env.INTERNAL_SERVICE_SECRET) {
             throw new Error('Unauthorized internal service call');
        }

        console.log(`✅ [EgressGovernor] Egress authorized.`);
        return true;
    }
}

module.exports = new EgressGovernor();
