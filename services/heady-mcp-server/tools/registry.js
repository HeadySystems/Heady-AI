/**
 * tools/registry.js — Unified MCP tool registry
 * Merges ALL tools from both tool-registry.js (12 original) and
 * new-tools/mcp-tools-registry.js (20 expanded) into a single registry.
 *
 * Total: 32 tools — the complete HeadyMCP tool set.
 */
'use strict';

const { ToolRegistry, TOOL_CSL_GATES, TOOL_CATEGORIES } = require('./tool-registry');
const { HEADY_MCP_TOOLS } = require('../new-tools/mcp-tools-registry');

/**
 * Create and initialize a unified tool registry with ALL tools pre-registered.
 * Returns { tools: Array<ToolSchema>, handlers: Map<string, ToolDef> }
 */
function createToolRegistry() {
  const reg = new ToolRegistry();
  reg.registerAll(); // registers 12 original tools

  // Register the 20 expanded tools from mcp-tools-registry
  for (const tool of HEADY_MCP_TOOLS) {
    if (!reg.tools.has(tool.name)) {
      reg.register({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        handler: tool.handler,
        health: () => ({ status: 'healthy' }),
      });
    }
  }

  // Build the format expected by index.js
  const tools = [];
  const handlers = new Map();

  for (const [name, tool] of reg.tools) {
    tools.push({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    });
    handlers.set(name, {
      handler: tool.handler,
      phiTier: tool.csl_gate,
    });
  }

  return { tools, handlers };
}

module.exports = { createToolRegistry, ToolRegistry, TOOL_CSL_GATES, TOOL_CATEGORIES };
