import { ResonanceSchemaGenerator } from '../src/core/orchestrator/schema-generator.js';
import { ResonanceOrchestrator } from '../src/core/orchestrator/resonance-orchestrator.js';

async function run() {
    console.log("=== Heady Resonance Orchestrator: Layer 5 Magic ===");
    
    const generator = new ResonanceSchemaGenerator();
    const orchestrator = new ResonanceOrchestrator();

    const userInput = "Analyze this image and then generate the react code for it.";
    console.log(`\nUser Input: "${userInput}"`);

    // 1. Generate Schema (Layer 5)
    const schema = await generator.generateFromNaturalLanguage(userInput);
    console.log("\n--- Generated Schema ---");
    console.log(JSON.stringify(schema, null, 2));

    // 2. Execute Schema (Layer 1 & 2 via ModelRouter Layer 3/4)
    console.log("\n--- Executing Schema ---");
    // We simulate the output of input_ingestion to match the vision condition so it routes correctly
    const initialContext = "Trigger when image data is present.";
    
    try {
        const result = await orchestrator.execute(schema, initialContext);
        console.log("\nExecution Trace:");
        console.log(JSON.stringify(result.trace, null, 2));
    } catch (e) {
        console.error("Execution failed:", e);
    }
}

run();
