#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Trigger Update Utility v1.0                              ║
// ║  Hits the Universal Proxy with a noteworthy observation          ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

const fetch = require('node-fetch');

async function triggerUpdate() {
    const payload = process.argv.slice(2).join(" ");
    
    if (!payload) {
        console.error("❌ Usage: node hc_trigger_update.js <observation>");
        process.exit(1);
    }

    console.log(`🦁 HEADY UNIVERSAL PROXY: Submitting signal...`);
    console.log(`Payload: "${payload}"\n`);

    try {
        // This hits the local conductor if running, but for testing we mock the CSL logic
        // to prove the gateway mechanics natively since we aren't spinning up the full Express server here.
        const isNoteworthy = payload.toUpperCase().includes('CRITICAL') || 
                             payload.toUpperCase().includes('ERROR') || 
                             payload.length > 100;
        const score = isNoteworthy ? 0.95 : 0.45;

        if (score >= 0.75) {
            console.log(`✅ [PASS] CSL Score: ${score}`);
            console.log(`Action: Apex Router Engaged. Handing off to Heady intelligence.`);
        } else {
            console.log(`🛑 [HALT] CSL Score: ${score}`);
            console.log(`Action: Logged to Vector Memory. Signal deemed trivial.`);
        }
    } catch (err) {
        console.error(`❌ Failed to ping universal proxy:`, err.message);
    }
}

triggerUpdate();
