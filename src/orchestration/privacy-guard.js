/**
 * PrivacyGuard — Autonomous PII Detection in Prompts
 * 
 * Scans and sanitizes prompts before they are sent to external intelligence providers.
 */

'use strict';

class PrivacyGuard {
    constructor() {
        this.piiPatterns = {
            ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
            creditCard: /\b\d{4}-\d{4}-\d{4}-\d{4}\b/g,
            phone: /\b\d{3}-\d{3}-\d{4}\b/g
        };
    }

    /**
     * Sanitize a prompt string.
     * @param {string} prompt 
     */
    sanitize(prompt) {
        console.log('🛡️ [PrivacyGuard] Scanning prompt for sensitive data...');
        
        let sanitized = prompt;
        Object.keys(this.piiPatterns).forEach(type => {
            sanitized = sanitized.replace(this.piiPatterns[type], `[HIDDEN_${type.toUpperCase()}]`);
        });

        if (sanitized !== prompt) {
            console.warn('⚠️ [PrivacyGuard] Sensitive data REDACTED from prompt.');
        } else {
            console.log('✅ [PrivacyGuard] Prompt verified as clean.');
        }

        return sanitized;
    }
}

module.exports = new PrivacyGuard();
