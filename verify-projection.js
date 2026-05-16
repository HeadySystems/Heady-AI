/*
 * Heady™ Option Projection — Debug Verification
 */

const registry = require('./src/bees/registry');
const projectionBee = require('./src/bees/pre-task-projection-bee');

async function run() {
    console.log("DEBUG: Starting run()");
    try {
        console.log("🚀 Initializing Heady™ Bee Registry...");
        const count = registry.discover();
        console.log(`✅ Discovered ${count} bees/swarms.`);

        const intent = "Deploy the HeadyKiosk OS to us-central1 and run a security audit";
        console.log(`🔍 Projecting options for: "${intent}"`);
        
        console.log("DEBUG: Calling projectionBee.project()");
        const result = await projectionBee.project(intent);
        console.log("DEBUG: project() returned");
        
        console.log("\n--- PROJECTION RESULTS ---");
        console.log(`Intent: ${result.intent}`);
        console.log(`Best Match: ${result.recommendation?.id} (${result.recommendation?.type})`);
        console.log(`Score: ${result.recommendation?.composite?.toFixed(4) || 'N/A'}`);
        
        console.log("\nTop Options:");
        if (result.options.length === 0) {
            console.log("NO OPTIONS FOUND.");
        }
        result.options.slice(0, 5).forEach((opt, i) => {
            console.log(`${i+1}. [${opt.type.toUpperCase()}] ${opt.id.padEnd(25)} | Resonance: ${opt.resonance.toFixed(4)} | Composite: ${opt.composite.toFixed(4)}`);
        });
    } catch (err) {
        console.error("CRITICAL ERROR IN VERIFICATION:", err);
    }
}

console.log("DEBUG: Calling run()");
run().then(() => console.log("DEBUG: run() finished")).catch(err => console.error("FATAL:", err));
