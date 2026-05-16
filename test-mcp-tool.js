/*
 * Heady™ MCP Tool Mock — Option Projection
 */

const toolHandler = require('./src/mcp/tools/heady-project-task-options-tool');

async function test() {
    console.log("🛠 Testing Heady™ MCP Tool: heady_project_task_options...");
    
    const args = {
        intent: "Initialize the cannabis kiosk blockchain bridge"
    };

    const result = await toolHandler.handler(args);
    
    console.log("\n--- MCP TOOL RESPONSE ---");
    console.log(result.text);
}

test().catch(console.error);
