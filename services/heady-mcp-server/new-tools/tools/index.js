/**
 * Heady MCP Tools — Auto-Loader Index
 * Loads all tool modules from domain-grouped files and provides the registry.
 */

const { PHI, PSI, FIB, CSL, VECTOR_DIM } = require('./helpers');

// Domain-grouped tool modules
const routingTools    = require('./routing-tools');
const analyticsTools  = require('./analytics-tools');
const operationsTools = require('./operations-tools');
const securityTools   = require('./security-tools');

const HEADY_MCP_TOOLS = [
  ...routingTools,
  ...analyticsTools,
  ...operationsTools,
  ...securityTools
];

function registerTools(server) {
  for (const tool of HEADY_MCP_TOOLS) {
    server.setRequestHandler({ method: 'tools/call' }, async (request) => {
      if (request.params.name === tool.name) {
        const result = await tool.handler(request.params.arguments || {});
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }
    });
  }

  server.setRequestHandler({ method: 'tools/list' }, async () => ({
    tools: HEADY_MCP_TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
  }));
}

module.exports = { HEADY_MCP_TOOLS, registerTools, PHI, PSI, FIB, CSL, VECTOR_DIM };
