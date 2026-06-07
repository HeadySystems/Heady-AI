#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ MCP Server v6.0.0 — Unified Canonical Entry Point     ║
// ║  Merges all 7 prior servers into one Gold Standard              ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝
'use strict';

const path = require('path');
const sdkRoot = path.join(__dirname, '..', 'node_modules', '@modelcontextprotocol', 'sdk', 'dist', 'cjs');
const { Server } = require(sdkRoot + '/server/index.js');
const { StdioServerTransport } = require(sdkRoot + '/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema,
        ListResourcesRequestSchema, ReadResourceRequestSchema,
        ListPromptsRequestSchema, GetPromptRequestSchema } = require(sdkRoot + '/types.js');

// ── φ-Math Constants ────────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

// ── Local Microservices (from mcp-servers/services/) ────────────────────────
const { McpFileSystem, McpDeploy, McpTranslator, McpCodeLock,
        McpLatent, McpGit, McpHealth, McpBrain } = require('./services');

// ── Upstream Tool Registry (from services/heady-mcp-server/src/) ────────────
let upstreamRegistry = null;
try {
  const { createToolRegistry } = require('../services/heady-mcp-server/src/tools/registry');
  upstreamRegistry = createToolRegistry();
} catch (err) {
  process.stderr.write(`[HeadyMCP] Upstream registry unavailable: ${err.message}\n`);
}

// ── Local Tool Schemas ──────────────────────────────────────────────────────
const LOCAL_TOOL_SCHEMAS = require('./tool-schemas');

// ── Merge tool lists ────────────────────────────────────────────────────────
function buildToolList() {
  const localNames = new Set(LOCAL_TOOL_SCHEMAS.map(t => t.name));
  const allTools = [...LOCAL_TOOL_SCHEMAS];

  if (upstreamRegistry) {
    for (const tool of upstreamRegistry.tools) {
      if (!localNames.has(tool.name)) {
        allTools.push(tool);
        localNames.add(tool.name);
      }
    }
  }
  return allTools;
}

const ALL_TOOLS = buildToolList();

class HeadyMCPServer {
  constructor() {
    this.server = new Server(
      { name: 'heady-mcp', version: '6.0.0' },
      { capabilities: { tools: {}, resources: {}, prompts: {} } }
    );

    this.fs         = new McpFileSystem();
    this.deploy     = new McpDeploy();
    this.translator = new McpTranslator();
    this.codelock   = new McpCodeLock();
    this.latent     = new McpLatent();
    this.git        = new McpGit();
    this.health     = new McpHealth();
    this.brain      = new McpBrain();
    this.startTime  = Date.now();

    this._setupHandlers();
    this.server.onerror = (error) => process.stderr.write(`[HeadyMCP Error] ${error}\n`);
    process.on('SIGINT', async () => { await this.server.close(); process.exit(0); });
  }

  _setupHandlers() {
    // ── tools/list ──────────────────────────────────────────────────────
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: ALL_TOOLS
    }));

    // ── tools/call ──────────────────────────────────────────────────────
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        return await this._dispatch(name, args);
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
      }
    });

    // ── resources/list ──────────────────────────────────────────────────
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        { uri: 'heady://system/status', name: 'System Status', mimeType: 'application/json',
          description: 'Current health and status of all Heady services' },
        { uri: 'heady://system/services', name: 'Service Registry', mimeType: 'application/json',
          description: 'All registered microservices and endpoints' },
        { uri: 'heady://docs/phi-constants', name: 'φ Constants', mimeType: 'application/json',
          description: 'All phi-scaled constants used across the system' },
      ]
    }));

    // ── resources/read ──────────────────────────────────────────────────
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      if (uri === 'heady://system/status') {
        return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify({
          status: 'operational', version: '6.0.0', uptime_ms: Date.now() - this.startTime,
          tools_registered: ALL_TOOLS.length, phi: PHI,
          local_services: 8, upstream_tools: upstreamRegistry ? upstreamRegistry.tools.length : 0,
        }, null, 2) }] };
      }
      if (uri === 'heady://docs/phi-constants') {
        return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify({
          PHI, PSI, FIB: FIB.slice(0, 13),
        }, null, 2) }] };
      }
      throw new Error(`Unknown resource: ${uri}`);
    });

    // ── prompts/list ────────────────────────────────────────────────────
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: [
        { name: 'heady-system-prompt', description: 'Inject Heady system context',
          arguments: [{ name: 'focus', description: 'Focus: code, research, ops, general', required: false }] },
      ]
    }));

    // ── prompts/get ─────────────────────────────────────────────────────
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      if (name === 'heady-system-prompt') {
        return { description: 'Heady system context', messages: [{ role: 'user', content: {
          type: 'text',
          text: `You are connected to Heady™ v6.0 — a sovereign AI OS with ${ALL_TOOLS.length} MCP tools. Focus: ${args?.focus || 'general'}. Use heady_health_ping for status, heady_search for discovery, heady_memory for vector memory. φ=${PHI}`
        }}] };
      }
      throw new Error(`Unknown prompt: ${name}`);
    });
  }

  async _dispatch(name, args) {
    // ── Local microservice dispatch (8 modules, real implementations) ──
    // Brain / Status
    if (name === 'heady_status')           return this.brain.getStatus();
    if (name === 'heady_list_services')    return this.brain.listServices();
    if (name === 'heady_pipeline_status')  return this.brain.pipelineStatus();
    if (name === 'heady_brain_status')     return this.brain.brainStatus();
    if (name === 'heady_brain_think')      return this.brain.brainThink(args.question, args?.context);
    if (name === 'heady_patterns_list')    return this.brain.patternsList();
    if (name === 'heady_patterns_evaluate') return this.brain.patternsEvaluate(args.patternId);
    if (name === 'heady_registry_list')    return this.brain.registryList(args?.category);
    if (name === 'heady_registry_lookup')  return this.brain.registryLookup(args.name);
    // File System
    if (name === 'heady_read_config')      return this.fs.readConfig(args.filename);
    if (name === 'heady_list_configs')     return this.fs.listConfigs();
    if (name === 'heady_project_tree')     return this.fs.projectTree(args?.subdir);
    if (name === 'heady_read_file')        return this.fs.readFile(args.filepath, args?.maxLines || 200);
    if (name === 'heady_search')           return this.fs.searchFiles(args.pattern, args?.fileTypes);
    if (name === 'heady_write_file')       return this.fs.writeFile(args.filepath, args.content, args?.changeId);
    // Deploy
    if (name === 'heady_deploy_status')    return this.deploy.deployStatus();
    if (name === 'heady_deploy_run')       return this.deploy.deployRun(args?.message, args?.force);
    if (name === 'heady_deploy_start')     return this.deploy.deployStart();
    if (name === 'heady_deploy_stop')      return this.deploy.deployStop();
    // Translator
    if (name === 'heady_translator_status')    return this.translator.status();
    if (name === 'heady_translator_translate') return this.translator.translate(args);
    if (name === 'heady_translator_adapters')  return this.translator.adapters();
    if (name === 'heady_translator_decode')    return this.translator.decode(args.protocol, args.data);
    if (name === 'heady_translator_bridge')    return this.translator.bridge(args.action, args?.port);
    // CodeLock
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
    // Latent Space
    if (name === 'heady_latent_record')     return this.latent.record(args.category, args.text, args?.meta);
    if (name === 'heady_latent_search')     return this.latent.search(args.query, args?.topK, args?.category);
    if (name === 'heady_latent_status')     return this.latent.status();
    if (name === 'heady_latent_log')        return this.latent.log(args?.category, args?.limit);
    // Git & Conflicts
    if (name === 'heady_git_log')           return this.git.gitLog(args?.limit);
    if (name === 'heady_git_diff')          return this.git.gitDiff(args?.target, args?.filepath);
    if (name === 'heady_git_status')        return this.git.gitStatus();
    if (name === 'heady_conflicts_scan')    return this.git.conflictsScan();
    if (name === 'heady_conflicts_show')    return this.git.conflictsShow(args.filepath);
    if (name === 'heady_conflicts_resolve') return this.git.conflictsResolve(args.filepath, args.strategy);
    // Health & Audit
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

    // ── Upstream service dispatch (110+ tools via HTTP to microservices) ──
    if (upstreamRegistry && upstreamRegistry.handlers.has(name)) {
      const tool = upstreamRegistry.handlers.get(name);
      const result = await tool.handler(args || {});
      return {
        content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }],
        _meta: { phiTier: tool.phiTier, source: 'upstream' }
      };
    }

    throw new Error(`Unknown tool: ${name}. ${ALL_TOOLS.length} tools available — use tools/list.`);
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    process.stderr.write(`Heady MCP Server v6.0 running on stdio (${ALL_TOOLS.length} tools = 8 local + ${upstreamRegistry ? upstreamRegistry.tools.length : 0} upstream)\n`);
  }
}

const server = new HeadyMCPServer();
server.run().catch((err) => { process.stderr.write(`Fatal: ${err.message}\n`); process.exit(1); });
