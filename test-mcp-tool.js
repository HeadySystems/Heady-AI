/*
 * Heady™ MCP Tool Mock — Option Projection
 */

const toolHandler = require('./src/mcp/tools/heady-project-task-options-tool');
const logger = require('./src/utils/logger');

async function test() {
    logger.info("🛠 Testing Heady™ MCP Tool: heady_project_task_options...");
    
    const args = {
        intent: "Initialize the cannabis kiosk blockchain bridge"
    };

    const result = await toolHandler.handler(args);
    
    logger.info("\n--- MCP TOOL RESPONSE ---");
    logger.info(result.text);
}

test().catch(console.error);
