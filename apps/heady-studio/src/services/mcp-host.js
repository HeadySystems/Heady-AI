// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Studio — MCP Host engine                                  ║
// ║  Spec-compliant MCP host built on the official SDK. Connects to     ║
// ║  any Streamable-HTTP MCP server — Heady's via headymcp.com/mcp and   ║
// ║  external ones via their /mcp endpoint — and discovers + invokes     ║
// ║  their tools, resources, and prompts. This is the "functionality-    ║
// ║  guaranteed" protocol core; the UI is just a renderer over it.       ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/**
 * Manages a fleet of MCP server connections. Extends EventTarget so the UI can
 * react to connect/disconnect/error without polling.
 *
 * @param {() => Promise<string>} getToken resolves a fresh Firebase ID token
 *        used as the Bearer on every transport request (fail-closed upstream).
 */
export class HeadyMcpHost extends EventTarget {
  constructor(getToken) {
    super();
    this.getToken = getToken;
    /** @type {Map<string, {client: Client, transport: StreamableHTTPClientTransport, url: string, tools: any[], resources: any[]}>} */
    this.connections = new Map();
  }

  _emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }

  /** Connect (or reconnect) a server by id + Streamable-HTTP URL. */
  async connect(serverId, url) {
    if (this.connections.has(serverId)) await this.disconnect(serverId);
    const token = await this.getToken();
    const transport = new StreamableHTTPClientTransport(new URL(url), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    });
    const client = new Client({ name: 'heady-studio', version: '1.0.0' }, { capabilities: {} });
    try {
      await client.connect(transport);
      const caps = client.getServerCapabilities() ?? {};
      const tools = caps.tools ? (await client.listTools()).tools ?? [] : [];
      const resources = caps.resources ? (await client.listResources()).resources ?? [] : [];
      const entry = { client, transport, url, tools, resources };
      this.connections.set(serverId, entry);
      this._emit('connected', { serverId, url, toolCount: tools.length, resourceCount: resources.length });
      return entry;
    } catch (err) {
      try { await transport.close(); } catch { /* already closed */ }
      this._emit('error', { serverId, url, message: String(err?.message ?? err) });
      throw err;
    }
  }

  /** Connect Heady's own multiplexed gateway. */
  connectHeady(mcpEndpoint) { return this.connect('heady', mcpEndpoint); }

  async disconnect(serverId) {
    const c = this.connections.get(serverId);
    if (!c) return;
    try { await c.client.close(); } catch { /* noop */ }
    this.connections.delete(serverId);
    this._emit('disconnected', { serverId });
  }

  isConnected(serverId) { return this.connections.has(serverId); }

  /** Flat list of every tool across connected servers, tagged with its origin. */
  allTools() {
    const out = [];
    for (const [serverId, c] of this.connections) {
      for (const t of c.tools) out.push({ serverId, name: t.name, description: t.description, inputSchema: t.inputSchema });
    }
    return out;
  }

  /** Invoke a tool on a specific server. Tokens are refreshed per transport. */
  async callTool(serverId, name, args = {}) {
    const c = this.connections.get(serverId);
    if (!c) throw new Error(`server '${serverId}' not connected`);
    const result = await c.client.callTool({ name, arguments: args });
    this._emit('tool:result', { serverId, name, isError: Boolean(result.isError) });
    return result;
  }

  /** Read a resource (e.g. heady://studio/manifest) from a server. */
  async readResource(serverId, uri) {
    const c = this.connections.get(serverId);
    if (!c) throw new Error(`server '${serverId}' not connected`);
    return c.client.readResource({ uri });
  }

  async disconnectAll() {
    await Promise.all([...this.connections.keys()].map((id) => this.disconnect(id)));
  }
}
