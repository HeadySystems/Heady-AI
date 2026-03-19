/**
 * @fileoverview Enhanced Heady MCP Server — JSON-RPC 2.0 + SSE Transport
 * @description Full MCP server exposing all tools via JSON-RPC 2.0 with SSE streaming.
 * Integrates tool registry, service mesh, event bus, conductor, and lifecycle management.
 * @module heady-mcp-server-enhanced
 */

'use strict';

const { isAllowedOrigin } = require('../../../shared/cors-config');
const http = require('http');
const { URL } = require('url');
const {
  PHI, PSI, PHI_SQUARED, FIB, CSL, CSL_ERROR_CODES,
  SACRED_GEOMETRY, INTERVALS,
  phiBackoff, correlationId, structuredLog,
} = require('./phi-constants');
const { LiquidEventBus, getEventBus, CHANNEL_NAMES } = require('./liquid-event-bus');
const { ServiceMesh } = require('./service-mesh');
const { AsyncPipelineExecutor } = require('./async-pipeline-executor');
const { ConductorV2, TOOL_DISPATCH, WORKFLOW_DISPATCH } = require('./conductor-v2');
const { CoherenceValidator } = require('./coherence-validator');
const { GracefulLifecycle, BOOT_ORDER } = require('./graceful-lifecycle');

// ─── JSON-RPC 2.0 HELPERS ───────────────────────────────────────────────────

/**
 * @constant {Object} JSONRPC_ERRORS - Standard JSON-RPC 2.0 error codes
 */
const JSONRPC_ERRORS = {
  PARSE_ERROR:      { code: -32700, message: 'Parse error' },
  INVALID_REQUEST:  { code: -32600, message: 'Invalid Request' },
  METHOD_NOT_FOUND: { code: -32601, message: 'Method not found' },
  INVALID_PARAMS:   { code: -32602, message: 'Invalid params' },
  INTERNAL_ERROR:   { code: -32603, message: 'Internal error' },
  CSL_GATE_FAILED:  { code: -32001, message: 'CSL coherence gate failed' },
  TOOL_NOT_FOUND:   { code: -32002, message: 'Tool not found' },
  CIRCUIT_OPEN:     { code: -32003, message: 'Circuit breaker open' },
};

/**
 * Create a JSON-RPC 2.0 response
 * @param {*} id - Request ID
 * @param {*} result - Result data
 * @returns {Object}
 */
function jsonRpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}

/**
 * Create a JSON-RPC 2.0 error response
 * @param {*} id - Request ID
 * @param {Object} error - Error object with code and message
 * @param {*} [data] - Additional error data
 * @returns {Object}
 */
function jsonRpcError(id, error, data) {
  return { jsonrpc: '2.0', id, error: { code: error.code, message: error.message, data } };
}

// ─── TOOL REGISTRY ───────────────────────────────────────────────────────────

/**
 * @class ToolRegistry
 * @description Central registry of all available MCP tools with schemas
 */
class ToolRegistry {
  constructor() {
    /** @private {Map<string, Object>} */
    this._tools = new Map();
  }

  /**
   * Register a tool
   * @param {string} name - Tool name
   * @param {Object} schema - Tool schema (inputSchema, description)
   * @param {Function} handler - Async handler function
   */
  register(name, schema, handler) {
    this._tools.set(name, { name, schema, handler, registeredAt: Date.now() });
  }

  /**
   * Get a tool by name
   * @param {string} name
   * @returns {Object|null}
   */
  get(name) {
    return this._tools.get(name) || null;
  }

  /**
   * List all registered tools
   * @returns {Object[]}
   */
  list() {
    return Array.from(this._tools.values()).map(t => ({
      name: t.name,
      description: t.schema.description || '',
      inputSchema: t.schema.inputSchema || {},
    }));
  }

  /**
   * Check if a tool exists
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    return this._tools.has(name);
  }

  /** @returns {number} */
  get size() {
    return this._tools.size;
  }
}

// ─── HEADY MCP SERVER ENHANCED ───────────────────────────────────────────────

/**
 * @class HeadyMCPServerEnhanced
 * @description Enhanced MCP server with JSON-RPC 2.0, SSE streaming, full ecosystem integration
 */
class HeadyMCPServerEnhanced {
  /**
   * @param {Object} [config={}]
   * @param {number} [config.port] - Server port (default: FIB[7] * 100 + FIB[9] = 1334)
   * @param {string} [config.host] - Bind host
   * @param {boolean} [config.enableSSE] - Enable SSE streaming
   * @param {Object} [config.eventBusConfig] - Event bus configuration
   */
  constructor(config = {}) {
    /** @private */
    this._config = {
      port: config.port || FIB[7] * 100 + FIB[9],
      host: config.host || '0.0.0.0',
      enableSSE: config.enableSSE !== false,
    };

    /** @private - Core components */
    this._eventBus = new LiquidEventBus(config.eventBusConfig || {});
    this._serviceMesh = new ServiceMesh();
    this._pipelineExecutor = new AsyncPipelineExecutor();
    this._conductor = new ConductorV2({
      eventBus: this._eventBus,
      serviceMesh: this._serviceMesh,
      pipelineExecutor: this._pipelineExecutor,
    });
    this._coherenceValidator = new CoherenceValidator({
      serviceMesh: this._serviceMesh,
      eventBus: this._eventBus,
      conductor: this._conductor,
    });
    this._lifecycle = new GracefulLifecycle({
      eventBus: this._eventBus,
    });

    /** @private */
    this._toolRegistry = new ToolRegistry();
    this._server = null;
    this._corrId = correlationId('mcp');
    this._running = false;

    /** @private */
    this._stats = {
      requestsReceived: 0,
      requestsSucceeded: 0,
      requestsFailed: 0,
      toolExecutions: 0,
      sseConnections: 0,
    };

    // Register core services with lifecycle
    this._registerLifecycleServices();
    // Register built-in tools
    this._registerBuiltinTools();
  }

  /**
   * Start the MCP server
   * @returns {Promise<void>}
   */
  async start() {
    if (this._running) return;

    // Boot ecosystem via lifecycle manager
    await this._lifecycle.boot();

    // Create HTTP server
    this._server = http.createServer((req, res) => this._handleRequest(req, res));

    await new Promise((resolve, reject) => {
      this._server.listen(this._config.port, this._config.host, () => {
        this._running = true;
        this._log('info', `MCP server listening on ${this._config.host}:${this._config.port}`);
        resolve();
      });
      this._server.on('error', reject);
    });

    // Setup graceful shutdown signals
    const shutdown = async () => {
      await this.stop();
      process.exit(0);
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  }

  /**
   * Stop the MCP server
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this._running) return;
    this._running = false;

    // Close HTTP server
    if (this._server) {
      await new Promise(resolve => this._server.close(resolve));
    }

    // Shutdown ecosystem in LIFO order
    await this._lifecycle.shutdown();
    this._log('info', 'MCP server stopped');
  }

  /**
   * Register a tool with the MCP server
   * @param {string} name - Tool name
   * @param {Object} schema - Tool schema
   * @param {Function} handler - Async handler
   */
  registerTool(name, schema, handler) {
    this._toolRegistry.register(name, schema, handler);
    this._conductor.registerToolHandler(name, handler);
  }

  /**
   * Handle incoming HTTP request
   * @private
   */
  async _handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', isAllowedOrigin(req.headers.origin) ? req.headers.origin : 'null');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Heady-Correlation-Id');
    res.setHeader('X-Heady-Phi', String(PHI));

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Route by path
    switch (url.pathname) {
      case '/health':
        return this._handleHealth(req, res);
      case '/sse':
        return this._handleSSE(req, res, url);
      case '/rpc':
      case '/jsonrpc':
        return this._handleJsonRpc(req, res);
      case '/tools':
        return this._handleToolList(req, res);
      case '/tools/call':
        return this._handleJsonRpc(req, res);
      case '/coherence':
        return this._handleCoherence(req, res);
      default:
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found', phi: PHI }));
    }
  }

  /**
   * Handle /health endpoint
   * @private
   */
  _handleHealth(req, res) {
    const health = this.health();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health));
  }

  /**
   * Handle /tools listing
   * @private
   */
  _handleToolList(req, res) {
    const tools = this._toolRegistry.list();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ tools, count: tools.length, phi: PHI }));
  }

  /**
   * Handle /coherence endpoint
   * @private
   */
  async _handleCoherence(req, res) {
    try {
      const report = await this._coherenceValidator.scan();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(report));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(jsonRpcError(null, JSONRPC_ERRORS.INTERNAL_ERROR, err.message)));
    }
  }

  /**
   * Handle SSE streaming endpoint
   * @private
   */
  _handleSSE(req, res, url) {
    if (!this._config.enableSSE) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'SSE not enabled' }));
      return;
    }

    const channels = url.searchParams.get('channels');
    const channelList = channels
      ? channels.split(',').filter(ch => CHANNEL_NAMES.includes(ch))
      : CHANNEL_NAMES;

    const subId = correlationId('sse');
    this._eventBus.registerSSE(subId, res, channelList);
    this._stats.sseConnections++;

    req.on('close', () => {
      this._eventBus.unregisterSSE(subId);
      this._stats.sseConnections--;
    });
  }

  /**
   * Handle JSON-RPC 2.0 requests
   * @private
   */
  async _handleJsonRpc(req, res) {
    this._stats.requestsReceived++;
    let body = '';

    try {
      body = await new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks).toString()));
        req.on('error', reject);
      });
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(jsonRpcError(null, JSONRPC_ERRORS.PARSE_ERROR)));
      this._stats.requestsFailed++;
      return;
    }

    let request;
    try {
      request = JSON.parse(body);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(jsonRpcError(null, JSONRPC_ERRORS.PARSE_ERROR)));
      this._stats.requestsFailed++;
      return;
    }

    // Handle batch requests
    if (Array.isArray(request)) {
      const results = await Promise.all(
        request.map(r => this._processJsonRpcRequest(r))
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(results));
      return;
    }

    const result = await this._processJsonRpcRequest(request);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }

  /**
   * Process a single JSON-RPC request
   * @private
   */
  async _processJsonRpcRequest(request) {
    const { id, method, params } = request;
    const corrId = correlationId('rpc');

    if (!method) {
      this._stats.requestsFailed++;
      return jsonRpcError(id, JSONRPC_ERRORS.INVALID_REQUEST);
    }

    try {
      let result;

      switch (method) {
        // ── MCP Protocol Methods ──
        case 'initialize':
          result = this._handleInitialize(params);
          break;
        case 'tools/list':
          result = { tools: this._toolRegistry.list() };
          break;
        case 'tools/call':
          result = await this._handleToolCall(params, corrId);
          break;

        // ── Ecosystem Methods ──
        case 'workflow/start':
          result = await this._conductor.startWorkflow(params.name, params);
          break;
        case 'workflow/list':
          result = { workflows: Object.keys(WORKFLOW_DISPATCH) };
          break;
        case 'route/intent':
          result = this._conductor.routeByIntent(params.intent, params);
          break;
        case 'health/scan':
          result = await this._coherenceValidator.scan();
          break;
        case 'health/status':
          result = this.health();
          break;
        case 'mesh/services':
          result = { services: this._serviceMesh.getServices() };
          break;
        case 'mesh/route':
          result = this._serviceMesh.route(params.capability, params.minCSL);
          break;
        case 'event/publish':
          result = this._eventBus.publish(params.channel, params.type, params.payload, {
            correlationId: corrId,
            source: params.source || 'rpc-client',
          });
          break;

        default:
          this._stats.requestsFailed++;
          return jsonRpcError(id, JSONRPC_ERRORS.METHOD_NOT_FOUND, { method });
      }

      this._stats.requestsSucceeded++;
      return jsonRpcResult(id, result);
    } catch (err) {
      this._stats.requestsFailed++;
      this._log('error', `RPC error on method '${method}': ${err.message}`);
      return jsonRpcError(id, JSONRPC_ERRORS.INTERNAL_ERROR, {
        message: err.message,
        correlationId: corrId,
      });
    }
  }

  /**
   * Handle MCP initialize method
   * @private
   */
  _handleInitialize(params) {
    return {
      protocolVersion: '2024-11-05',
      serverInfo: {
        name: 'heady-mcp-server-enhanced',
        version: '2.0.0',
      },
      capabilities: {
        tools: { listChanged: true },
        streaming: this._config.enableSSE,
      },
      phi: PHI,
    };
  }

  /**
   * Handle tools/call method
   * @private
   */
  async _handleToolCall(params, corrId) {
    if (!params || !params.name) {
      throw new Error(JSONRPC_ERRORS.INVALID_PARAMS.message);
    }

    const toolName = params.name;
    const toolArgs = params.arguments || {};

    // Check tool registry first
    const tool = this._toolRegistry.get(toolName);
    if (tool && tool.handler) {
      this._stats.toolExecutions++;

      // Publish tool execution start event
      this._eventBus.publish('tool', 'tool.call.start', {
        tool: toolName,
        correlationId: corrId,
      }, { correlationId: corrId, source: 'MCPServer' });

      const result = await tool.handler(toolArgs, { correlationId: corrId });

      this._eventBus.publish('tool', 'tool.call.complete', {
        tool: toolName,
        correlationId: corrId,
      }, { correlationId: corrId, source: 'MCPServer' });

      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }

    // Fallback to conductor dispatch
    const dispatchResult = await this._conductor.dispatchTool(toolName, toolArgs, {
      correlationId: corrId,
    });
    this._stats.toolExecutions++;
    return { content: [{ type: 'text', text: JSON.stringify(dispatchResult) }] };
  }

  /**
   * Register core services with lifecycle manager
   * @private
   */
  _registerLifecycleServices() {
    // Center ring — Event Bus (foundation)
    this._lifecycle.register({
      id: 'EventBus',
      ring: 'CENTER',
      priority: 0,
      start: () => this._eventBus.start(),
      stop: () => this._eventBus.stop(),
      health: () => this._eventBus.health(),
    });

    // Inner ring — Service Mesh + Conductor
    this._lifecycle.register({
      id: 'ServiceMesh',
      ring: 'INNER_RING',
      priority: 0,
      start: () => this._serviceMesh.start(),
      stop: () => this._serviceMesh.stop(),
      health: () => this._serviceMesh.health(),
    });

    this._lifecycle.register({
      id: 'ConductorV2',
      ring: 'INNER_RING',
      priority: 1,
      start: () => this._conductor.start(),
      stop: () => this._conductor.stop(),
      health: () => this._conductor.health(),
    });

    // Middle ring — Pipeline Executor
    this._lifecycle.register({
      id: 'PipelineExecutor',
      ring: 'MIDDLE_RING',
      priority: 0,
      start: async () => {},
      stop: async () => {},
      health: () => this._pipelineExecutor.health(),
    });

    // Governance — Coherence Validator
    this._lifecycle.register({
      id: 'CoherenceValidator',
      ring: 'GOVERNANCE',
      priority: 0,
      start: () => this._coherenceValidator.start(),
      stop: () => this._coherenceValidator.stop(),
      health: () => this._coherenceValidator.health(),
    });
  }

  /**
   * Register built-in tools from TOOL_DISPATCH
   * @private
   */
  _registerBuiltinTools() {
    for (const [toolName, dispatch] of Object.entries(TOOL_DISPATCH)) {
      this._toolRegistry.register(toolName, {
        description: `Heady tool: ${toolName} (handler: ${dispatch.handler}, minCSL: ${dispatch.minCSL})`,
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'object', description: 'Tool-specific input parameters' },
          },
        },
      }, null); // No local handler — dispatched via conductor
    }
  }

  /**
   * Log helper
   * @private
   */
  _log(level, message, meta = {}) {
    const entry = structuredLog(level, 'HeadyMCPServer', message, meta, this._corrId);
    if (this._eventBus && this._running) {
      this._eventBus.publish('system', `mcp.server.${level}`, entry, {
        correlationId: this._corrId,
        source: 'HeadyMCPServer',
      });
    }
  }

  /**
   * Get health status
   * @returns {Object}
   */
  health() {
    const components = {
      eventBus: this._eventBus.health(),
      serviceMesh: this._serviceMesh.health(),
      conductor: this._conductor.health(),
      pipelineExecutor: this._pipelineExecutor.health(),
      coherenceValidator: this._coherenceValidator.health(),
      lifecycle: this._lifecycle.health(),
    };

    // Weighted coherence from all components
    const scores = Object.values(components).map(c => c.coherence || 0);
    const avgCoherence = scores.length > 0
      ? scores.reduce((s, c) => s + c, 0) / scores.length
      : 0;

    return {
      status: this._running && avgCoherence >= CSL.MEDIUM ? 'healthy' : 'degraded',
      coherence: parseFloat(avgCoherence.toFixed(FIB[4])),
      running: this._running,
      port: this._config.port,
      tools: this._toolRegistry.size,
      components,
      stats: { ...this._stats },
      phi: PHI,
    };
  }
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

module.exports = {
  HeadyMCPServerEnhanced,
  ToolRegistry,
  JSONRPC_ERRORS,
  jsonRpcResult,
  jsonRpcError,
};
