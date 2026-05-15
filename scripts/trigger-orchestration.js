import { handleHeadyConfigurator } from '../src/mcp/tools/heady-configurator-tool.js';

async function trigger() {
    console.log("🚀 Initializing Heady Auto-Success Engine (Configurator)...");
    try {
        const result = await handleHeadyConfigurator({
            action: 'auto_resolve_env'
        });
        console.log("✅ Auto-Success Engine Triggered Successfully:");
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("❌ Auto-Success Engine Trigger Failed:", error);
    }
}

trigger();
