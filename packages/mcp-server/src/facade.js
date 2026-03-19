#!/usr/bin/env node
// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY SYSTEMS — MCP Server Facade                             ║
// ║  ∞ SACRED GEOMETRY ∞  Public interface · Cloud-backed          ║
// ║  Zero trade secrets — all tool calls proxy to Cloud Run        ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

/**
 * @heady-ai/mcp-server — Public Facade
 *
 * This is the PUBLIC npm package. It contains ZERO proprietary code.
 * All tool calls are proxied over HTTPS to the Heady Cloud Run backend
 * where the actual CSL engine, phi-math, vector memory, and swarm logic live.
 *
 * Architecture:
 *   npx @heady-ai/mcp-server  →  stdio MCP transport  →  HTTPS proxy  →  Cloud Run backend
 *
 * Environment:
 *   HEADY_API_KEY    — Bearer token for Cloud Run auth (required)
 *   HEADY_API_URL    — Backend URL (default: https://heady-mcp-backend-609590223909.us-east1.run.app)
 */

'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ─── Configuration ────────────────────────────────────────────────
const DEFAULT_API_URL = 'https://heady-mcp-backend-609590223909.us-east1.run.app';

function loadCredentials() {
  // Priority: env var → ~/.heady/credentials → ~/.heady/.api-key
  if (process.env.HEADY_API_KEY) return process.env.HEADY_API_KEY;

  const credPaths = [
    path.join(process.env.HOME || '/root', '.heady', 'credentials'),
    path.join(process.env.HOME || '/root', '.heady', '.api-key'),
  ];

  for (const p of credPaths) {
    try {
      const content = fs.readFileSync(p, 'utf8').trim();
      if (content) return content;
    } catch (e) { /* not found, try next */ }
  }

  return null;
}

const API_KEY = loadCredentials();
const API_URL = process.env.HEADY_API_URL || DEFAULT_API_URL;

// ─── Tool Registry (PUBLIC schemas only — no implementation code) ─
// These are the tool INTERFACES that get returned on tools/list.
// The actual logic runs server-side on Cloud Run.
const TOOL_SCHEMAS = [
  // ── Core MCP Tools ──────────────────────────────
  {
    name: 'heady_search',
    description: 'Search the Heady vector memory space for relevant context, code patterns, and knowledge',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language search query' },
        top_k: { type: 'number', description: 'Number of results (default: 5)' },
        namespace: { type: 'string', description: 'Memory namespace to search (default: all)' }
      },
      required: ['query']
    }
  },
  {
    name: 'heady_store',
    description: 'Store information in the Heady vector memory for future retrieval',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Unique key for this memory entry' },
        content: { type: 'string', description: 'Content to store' },
        metadata: { type: 'object', description: 'Optional metadata (tags, source, category)' },
        namespace: { type: 'string', description: 'Memory namespace (default: general)' }
      },
      required: ['key', 'content']
    }
  },
  {
    name: 'heady_health',
    description: 'Get health status of the Heady platform and all connected services',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'heady_pipeline_run',
    description: 'Execute a task through the HCFullPipeline with all 12 stages',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'Task description to process' },
        stages: { type: 'array', items: { type: 'string' }, description: 'Specific stages to run (default: all 12)' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'critical'], description: 'Task priority' }
      },
      required: ['task']
    }
  },
  {
    name: 'heady_analyze',
    description: 'Run deep analysis on code, architecture, or content using Heady intelligence',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'What to analyze (code snippet, file path, URL, or text)' },
        type: { type: 'string', enum: ['code', 'architecture', 'security', 'performance', 'content'], description: 'Analysis type' },
        depth: { type: 'string', enum: ['quick', 'standard', 'deep'], description: 'Analysis depth (default: standard)' }
      },
      required: ['target']
    }
  },
  {
    name: 'heady_bee_list',
    description: 'List available Heady Bees (autonomous workers) and their current status',
    inputSchema: {
      type: 'object',
      properties: {
        swarm: { type: 'string', description: 'Filter by swarm name' },
        status: { type: 'string', enum: ['active', 'idle', 'error', 'all'], description: 'Filter by status' }
      }
    }
  },

  // ── Intelligence Tools ──────────────────────────
  {
    name: 'heady_battle',
    description: 'Run a HeadyBattle — multi-model competition to find the best solution',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The challenge prompt for competing models' },
        models: { type: 'array', items: { type: 'string' }, description: 'Models to compete (default: all available)' },
        rounds: { type: 'number', description: 'Number of competition rounds (default: 3)' }
      },
      required: ['prompt']
    }
  },
  {
    name: 'heady_autocontext',
    description: 'Get auto-enriched context for the current workspace from the latent space scanner',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['file', 'directory', 'project', 'ecosystem'], description: 'Context scope' },
        path: { type: 'string', description: 'File or directory path (optional)' }
      }
    }
  },

  // ── Orchestration Tools ─────────────────────────
  {
    name: 'heady_swarm_dispatch',
    description: 'Dispatch a task to a specific Heady swarm for parallel processing',
    inputSchema: {
      type: 'object',
      properties: {
        swarm: { type: 'string', description: 'Swarm name (e.g., "build", "research", "creative")' },
        task: { type: 'string', description: 'Task description' },
        bees: { type: 'number', description: 'Number of bees to assign (default: auto)' }
      },
      required: ['swarm', 'task']
    }
  },

  // ── Governance Tools ────────────────────────────
  {
    name: 'heady_cost_report',
    description: 'Get cost breakdown for Heady platform usage',
    inputSchema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['day', 'week', 'month'], description: 'Reporting period' }
      }
    }
  },
  {
    name: 'heady_audit_log',
    description: 'Query the Heady audit log for security and compliance events',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Filter by action type' },
        limit: { type: 'number', description: 'Max results (default: 20)' }
      }
    }
  },

  // ── Ecosystem Tools ─────────────────────────────
  {
    name: 'heady_ecosystem_map',
    description: 'Get the complete Heady ecosystem map — all repos organized by layer',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'heady_ecosystem_dependencies',
    description: 'Get the inter-repo dependency graph for the Heady ecosystem',
    inputSchema: { type: 'object', properties: {} }
  }
];

// ─── HTTPS Proxy ──────────────────────────────────────────────────
function proxyToBackend(toolName, args) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(`${API_URL}/mcp/tools/call`);
    const mod = parsed.protocol === 'https:' ? https : http;

    const body = JSON.stringify({ tool: toolName, arguments: args });

    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'HeadyMCP-Facade/5.0.0',
        'X-Heady-Transport': 'mcp-stdio',
        ...(API_KEY ? { 'Authorization': `Bearer ${API_KEY}` } : {})
      }
    };

    const req = mod.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode === 401) {
            resolve({ error: 'Authentication required. Set HEADY_API_KEY or create ~/.heady/credentials' });
          } else if (res.statusCode === 403) {
            resolve({ error: 'Access denied. Your API key does not have permission for this tool.' });
          } else if (res.statusCode >= 400) {
            resolve({ error: `Backend error ${res.statusCode}: ${parsed.message || data.substring(0, 200)}` });
          } else {
            resolve(parsed.result || parsed);
          }
        } catch (e) {
          resolve({ error: `Invalid response from backend: ${data.substring(0, 200)}` });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        error: `Cannot reach Heady backend at ${API_URL}: ${err.message}`,
        hint: 'Ensure HEADY_API_URL is set correctly or check network connectivity'
      });
    });

    req.setTimeout(30000, () => {
      req.destroy();
      resolve({ error: 'Request to Heady backend timed out (30s)' });
    });

    req.write(body);
    req.end();
  });
}

// ─── MCP JSON-RPC Handler ─────────────────────────────────────────
async function handleRequest(request) {
  const { method, id, params } = request;

  // Initialize
  if (method === 'initialize') {
    return {
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'heady-mcp-server',
          version: '5.0.0'
        }
      }
    };
  }

  // List tools — return public schemas only (no IP)
  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0', id,
      result: { tools: TOOL_SCHEMAS }
    };
  }

  // Call tool — proxy to Cloud Run backend
  if (method === 'tools/call') {
    const { name, arguments: args } = params || {};

    if (!TOOL_SCHEMAS.find(t => t.name === name)) {
      return {
        jsonrpc: '2.0', id,
        error: { code: -32601, message: `Unknown tool: ${name}` }
      };
    }

    try {
      const result = await proxyToBackend(name, args || {});
      return {
        jsonrpc: '2.0', id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        }
      };
    } catch (err) {
      return {
        jsonrpc: '2.0', id,
        error: { code: -32603, message: err.message }
      };
    }
  }

  // Notifications (no response needed)
  if (method === 'notifications/initialized') {
    return null; // no response for notifications
  }

  // Unknown method
  return {
    jsonrpc: '2.0', id,
    error: { code: -32601, message: `Method not supported: ${method}` }
  };
}

// ─── stdio Transport ──────────────────────────────────────────────
function startStdioTransport() {
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  let buffer = '';

  process.stdin.on('data', (chunk) => {
    buffer += chunk.toString();

    // Process complete JSON-RPC messages (Content-Length header protocol)
    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;

      const header = buffer.substring(0, headerEnd);
      const contentLengthMatch = header.match(/Content-Length:\s*(\d+)/i);
      if (!contentLengthMatch) {
        // Try raw JSON (no header)
        try {
          const lines = buffer.split('\n').filter(l => l.trim());
          for (const line of lines) {
            const request = JSON.parse(line);
            handleRequest(request).then(response => {
              if (response) sendResponse(response);
            });
          }
          buffer = '';
        } catch (e) { /* incomplete, wait for more data */ }
        break;
      }

      const contentLength = parseInt(contentLengthMatch[1], 10);
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + contentLength;

      if (buffer.length < bodyEnd) break; // incomplete body

      const body = buffer.substring(bodyStart, bodyEnd);
      buffer = buffer.substring(bodyEnd);

      try {
        const request = JSON.parse(body);
        handleRequest(request).then(response => {
          if (response) sendResponse(response);
        });
      } catch (e) {
        sendResponse({
          jsonrpc: '2.0', id: null,
          error: { code: -32700, message: 'Parse error' }
        });
      }
    }
  });

  // Also handle line-delimited JSON (some MCP clients use this)
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('Content-Length')) return;

    try {
      const request = JSON.parse(trimmed);
      handleRequest(request).then(response => {
        if (response) sendResponse(response);
      });
    } catch (e) { /* not valid JSON, ignore */ }
  });
}

function sendResponse(response) {
  const body = JSON.stringify(response);
  const header = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`;
  process.stdout.write(header + body);
}

// ─── Entry Point ──────────────────────────────────────────────────
if (require.main === module) {
  // Log to stderr (stdout is for MCP transport)
  process.stderr.write(`[heady-mcp] Facade v5.0.0 → ${API_URL}\n`);
  process.stderr.write(`[heady-mcp] Auth: ${API_KEY ? '✅ API key loaded' : '⚠️  No HEADY_API_KEY (set env or ~/.heady/credentials)'}\n`);
  process.stderr.write(`[heady-mcp] Tools: ${TOOL_SCHEMAS.length} public schemas\n`);
  startStdioTransport();
}

module.exports = { handleRequest, TOOL_SCHEMAS, proxyToBackend };
