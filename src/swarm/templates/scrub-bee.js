/**
 * ScrubBee — Automated Log PII Removal
 * 
 * Protects user privacy by scrubbing identifiable information from system logs.
 */

'use strict';

class ScrubBee {
    constructor() {
        this.patterns = {
            email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
            stripeKey: /sk_live_[a-zA-Z0-9]{24,}/g,
            bearerToken: /Bearer\s+[a-zA-Z0-9._-]{20,}/g
        };
    }

    /**
     * Scrub PII from a log string.
     * @param {string} logLine 
     */
    scrub(logLine) {
        let scrubbed = logLine;
        
        Object.keys(this.patterns).forEach(type => {
            scrubbed = scrubbed.replace(this.patterns[type], `[REDACTED_${type.toUpperCase()}]`);
        });

        return scrubbed;
    }

    /**
     * Process a batch of logs.
     */
    processBatch(logs) {
        console.log(`🧹 [ScrubBee] Scrubbing ${logs.length} log lines...`);
        return logs.map(line => this.scrub(line));
    }
}

module.exports = new ScrubBee();
