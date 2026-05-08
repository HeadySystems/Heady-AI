#!/usr/bin/env node
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
// ║  FILE: mcp-servers/heady-mcp-server.js                          ║
// ║  LAYER: orchestrator — thin composition of 8 microservices      ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Heady MCP Server — Orchestrator
 * Thin composition layer that delegates to 8 focused service modules.
 * Uses @modelcontextprotocol/sdk with stdio transport.
 *
 * Services:  mcp-fs, mcp-deploy, mcp-translator, mcp-codelock,
 *            mcp-latent, mcp-git, mcp-health, mcp-brain
 */

const sdkRoot = require('path').join(__dirname, '..', 'node_modules', '@modelcontextprotocol', 'sdk', 'dist', 'cjs');
const { Server } = require(sdkRoot + '/server/index.js');
const { StdioServerTransport } = require(sdkRoot + '/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require(sdkRoot + '/types.js');
const axios = require('axios'); // For notifications

// ── Microservice imports ─────────────────────────────────────
const { McpFileSystem, McpDeploy, McpTranslator, McpCodeLock,
        McpLatent, McpGit, McpHealth, McpBrain } = require('./services');

// ── Tool schema definitions (pure data, no logic) ────────────
const TOOL_SCHEMAS = require('./tool-schemas');

class HeadyMCPServer {
  constructor() {
    this.server = new Server(
      { name: 'heady-mcp', version: '2.0.0' },
      { capabilities: { tools: {} } }
    );

    // Compose microservices
    this.fs        = new McpFileSystem();
    this.deploy    = new McpDeploy();
    this.translator = new McpTranslator();
    this.codelock  = new McpCodeLock();
    this.latent    = new McpLatent();
    this.git       = new McpGit();
    this.health    = new McpHealth();
    this.brain     = new McpBrain();

    this._setupHandlers();

    this.server.onerror = (error) => {
      console.error('[HeadyMCP Error]', error);
      this._notifyError('MCP_SERVER_ERROR', error.message).catch(() => {});
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async _notifyError(type, message) {
    try {
      const { SERVICE_PORTS } = require('../shared/phi-math');
      const port = SERVICE_PORTS.HEADY_NOTIFICATION || 3394;
      await axios.post(`http://localhost:${port}/notify`, {
        userId: 'system',
        channel: 'sse',
        title: `🚨 MCP ${type}`,
        message: message,
        priority: 1
      });
    } catch (e) {
      // Notification service might not be up
    }
  }

  _setupHandlers() {
    // List tools — pure schema, no logic
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOL_SCHEMAS
    }));

    // Dispatch — thin routing table
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        const result = await this._dispatch(name, args);
        return result;
      } catch (error) {
        await this._notifyError('TOOL_EXECUTION_ERROR', `Tool "${name}" failed: ${error.message}`);
        return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
      }
    });
  }

  async _dispatch(name, args) {
    // ── Brain / Status ────────────────────────────────
    if (name === 'heady_status')           return this.brain.getStatus();
    if (name === 'heady_list_services')    return this.brain.listServices();
    if (name === 'heady_pipeline_status')  return this.brain.pipelineStatus();
    if (name === 'heady_brain_status')     return this.brain.brainStatus();
    if (name === 'heady_brain_think')      return this.brain.brainThink(args.question, args?.context);
    if (name === 'heady_patterns_list')    return this.brain.patternsList();
    if (name === 'heady_patterns_evaluate') return this.brain.patternsEvaluate(args.patternId);
    if (name === 'heady_registry_list')    return this.brain.registryList(args?.category);
    if (name === 'heady_registry_lookup')  return this.brain.registryLookup(args.name);

    // ── File System ───────────────────────────────────
    if (name === 'heady_read_config')      return this.fs.readConfig(args.filename);
    if (name === 'heady_list_configs')     return this.fs.listConfigs();
    if (name === 'heady_project_tree')     return this.fs.projectTree(args?.subdir);
    if (name === 'heady_read_file')        return this.fs.readFile(args.filepath, args?.maxLines || 200);
    if (name === 'heady_search')           return this.fs.searchFiles(args.pattern, args?.fileTypes);
    if (name === 'heady_write_file')       return this.fs.writeFile(args.filepath, args.content, args?.changeId);

    // ── Deploy ────────────────────────────────────────
    if (name === 'heady_deploy_status')    return this.deploy.deployStatus();
    if (name === 'heady_deploy_run')       return this.deploy.deployRun(args?.message, args?.force);
    if (name === 'heady_deploy_start')     return this.deploy.deployStart();
    if (name === 'heady_deploy_stop')      return this.deploy.deployStop();

    // ── Translator ────────────────────────────────────
    if (name === 'heady_translator_status')    return this.translator.status();
    if (name === 'heady_translator_translate') return this.translator.translate(args);
    if (name === 'heady_translator_adapters')  return this.translator.adapters();
    if (name === 'heady_translator_decode')    return this.translator.decode(args.protocol, args.data);
    if (name === 'heady_translator_bridge')    return this.translator.bridge(args.action, args?.port);

    // ── CodeLock ──────────────────────────────────────
    if (name === 'heady_codelock_status')   return this.codelock.status();
    if (name === 'heady_codelock_lock')     return this.codelock.lock(args?.reason);
    if (name === 'heady_codelock_unlock')   return this.codelock.unlock(args?.reason);
    if (name === 'heady_codelock_request')  return this.codelock.request(args.id, args.files, args.description);
    if (name === 'heady_codelock_approve')  return this.codelock.approve(args.changeId);
    if (name === 'heady_codelock_deny')     return this.codelock.deny(args.changeId, args?.reason);
    if (name === 'heady_codelock_snapshot') return this.codelock.snapshot();
    if (name === 'heady_codelock_detect')   return this.codelock.detect();
    if (name === 'heady_codelock_audit')    return this.codelock.audit(args?.limit);
    if (name === 'heady_codelock_users')    return this.codelock.users(args.action, args.username);

    // ── Latent Space ──────────────────────────────────
    if (name === 'heady_latent_record')     return this.latent.record(args.category, args.text, args?.meta);
    if (name === 'heady_latent_search')     return this.latent.search(args.query, args?.topK, args?.category);
    if (name === 'heady_latent_status')     return this.latent.status();
    if (name === 'heady_latent_log')        return this.latent.log(args?.category, args?.limit);

    // ── Git & Conflicts ──────────────────────────────
    if (name === 'heady_git_log')           return this.git.gitLog(args?.limit);
    if (name === 'heady_git_diff')          return this.git.gitDiff(args?.target, args?.filepath);
    if (name === 'heady_git_status')        return this.git.gitStatus();
    if (name === 'heady_conflicts_scan')    return this.git.conflictsScan();
    if (name === 'heady_conflicts_show')    return this.git.conflictsShow(args.filepath);
    if (name === 'heady_conflicts_resolve') return this.git.conflictsResolve(args.filepath, args.strategy);

    // ── Health & Audit ────────────────────────────────
    if (name === 'heady_health_ping')       return this.health.healthPing(args?.timeout);
    if (name === 'heady_env_audit')         return this.health.envAudit();
    if (name === 'heady_deps_scan')         return this.health.depsScan();
    if (name === 'heady_config_validate')   return this.health.configValidate();
    if (name === 'heady_secrets_scan')      return this.health.secretsScan();
    if (name === 'heady_code_stats')        return this.health.codeStats();
    if (name === 'heady_cloudrun_status')   return this.health.cloudrunStatus();
    if (name === 'heady_docs_freshness')    return this.health.docsFreshness();
    if (name === 'heady_quickfix')          return this.health.quickFix(args.fix, args?.dryRun !== false);
    if (name === 'heady_cost_report')       return this.health.costReport();

    // ── MCP Management ────────────────────────────────
    if (name === 'heady_mcp_config')       return this._handleMcpConfig(args);
    if (name === 'heady_mcp_diagnostic')   return this._handleMcpDiagnostic(args);

    throw new Error(`Unknown tool: ${name}`);
  }

  async _handleMcpConfig(args) {
    const configPath = path.join(__dirname, '..', '.mcp.json');
    let config = { mcpServers: {} };
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {}

    if (args.action === 'list') {
      return { content: [{ type: 'text', text: JSON.stringify(config.mcpServers, null, 2) }] };
    }

    if (args.action === 'add') {
      if (!args.serverId || !args.config) throw new Error('Missing serverId or config');
      config.mcpServers[args.serverId] = args.config;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      return { content: [{ type: 'text', text: `Successfully added MCP server: ${args.serverId}` }] };
    }

    if (args.action === 'remove') {
      if (!args.serverId) throw new Error('Missing serverId');
      delete config.mcpServers[args.serverId];
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      return { content: [{ type: 'text', text: `Successfully removed MCP server: ${args.serverId}` }] };
    }
  }

  async _handleMcpDiagnostic(args) {
    const { execSync } = require('child_process');
    const diagPath = path.join(__dirname, '..', 'utils', 'mcp-diagnostic.js');
    try {
      const output = execSync(`node ${diagPath}`, {
        env: { ...process.env, MCP_GATEWAY_URL: args.targetUrl || process.env.MCP_GATEWAY_URL }
      }).toString();
      return { content: [{ type: 'text', text: output }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Diagnostic failed: ${error.message}\n\nOutput:\n${error.stdout?.toString()}` }], isError: true };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Heady MCP Server v2.0 running on stdio (8 microservices)');
  }
}

const server = new HeadyMCPServer();
server.run().catch(console.error);
