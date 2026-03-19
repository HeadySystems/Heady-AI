/**
 * Heady MCP Services — Index
 * Auto-loader for all decomposed MCP service modules
 */

const McpFileSystem = require('./mcp-fs');
const McpDeploy     = require('./mcp-deploy');
const McpTranslator = require('./mcp-translator');
const McpCodeLock   = require('./mcp-codelock');
const McpLatent     = require('./mcp-latent');
const McpGit        = require('./mcp-git');
const McpHealth     = require('./mcp-health');
const McpBrain      = require('./mcp-brain');

module.exports = {
  McpFileSystem,
  McpDeploy,
  McpTranslator,
  McpCodeLock,
  McpLatent,
  McpGit,
  McpHealth,
  McpBrain
};
