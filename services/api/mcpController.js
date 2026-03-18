// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: services/api/controllers/mcpController.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';
import yaml from 'yaml';

const require = createRequire(import.meta.url);
const logger = require('../../../src/shared/logger')('MCPController');

export const getMCPTools = async (req, res) => {
  try {
    const mcpConfigPath = path.join(process.cwd(), 'distribution', 'mcp', 'configs', 'default-mcp.yaml');
    const file = readFileSync(mcpConfigPath, 'utf8');
    const config = yaml.parse(file);

    const tools = Object.entries(config.servers).map(([key, tool]) => ({
      id: key,
      name: tool.name,
      description: tool.description,
      enabled: tool.enabled,
      requiredPlan: tool.requiredPlan || 'free',
      capabilities: tool.capabilities || []
    }));

    res.status(200).json(tools);
  } catch (error) {
    logger.error(`Failed to load MCP tools: ${error.message}`);
    res.status(500).json({ error: 'Failed to load MCP tools' });
  }
};
