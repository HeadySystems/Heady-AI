const { timingSafeEqual } = require('node:crypto');

// SEC: Timing-safe comparison — prevents timing attacks on auth tokens
const safeCompare = (a, b) => {
  if (!a || !b) return false;
  const ab = Buffer.from(String(a)), bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
};
/**
 * HeadyMCP Server — JSON-RPC 2.0 + SSE transport
 * 30+ native tools for chat, code, search, embed, deploy.
 */
import { toolRegistry } from './tool-registry.js';

export class MCPServer {
  #log;
  #bearerToken;

  constructor({ log }) {
    this.#log = log;
    this.#bearerToken = process.env.MCP_BEARER_TOKEN;
  }

  authenticate(token) {
    return safeCompare(token, this.#bearerToken);
  }

  async handleRPC(request) {
    const { method, params, id } = request;

    // Capability discovery
    if (method === 'tools/list') {
      return { jsonrpc: '2.0', id, result: toolRegistry.list() };
    }

    // Tool invocation
    if (method === 'tools/call') {
      const { name, arguments: args } = params;
      const tool = toolRegistry.get(name);
      if (!tool) return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown tool: ${name}` } };
      try {
        const result = await tool.execute(args);
        return { jsonrpc: '2.0', id, result };
      } catch (err) {
        return { jsonrpc: '2.0', id, error: { code: -32000, message: err.message } };
      }
    }

    return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown method: ${method}` } };
  }
}
