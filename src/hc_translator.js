// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HeadyTranslator — Universal Protocol Translation Engine        ║
// ║  ∞ SACRED GEOMETRY ∞  Every signal flows through one gateway    ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

/**
 * HCTranslator — Universal protocol bridge for the Heady ecosystem.
 *
 * Translates between MCP (stdio), HTTP/REST, WebSocket, UDP, MIDI,
 * gRPC-lite, and raw TCP. Each protocol has one thin adapter that
 * converts to/from a canonical HeadyMessage envelope. The router
 * matches source → target and handles the bridge.
 *
 * Architecture:
 *   ┌──────┐    ┌────────────────────────┐    ┌──────┐
 *   │ MCP  │───▶│                        │───▶│ HTTP │
 *   │ HTTP │◀───│   HeadyTranslator      │◀───│ WS   │
 *   │ WS   │───▶│   (Canonical Router)   │───▶│ UDP  │
 *   │ UDP  │◀───│                        │◀───│ MIDI │
 *   │ MIDI │───▶│                        │───▶│ TCP  │
 *   └──────┘    └────────────────────────┘    └──────┘
 *
 * Canonical Envelope:
 *   {
 *     id:        unique message id
 *     source:    { protocol, endpoint, metadata }
 *     target:    { protocol, endpoint, metadata }
 *     operation: string (the action to perform)
 *     payload:   any (the data)
 *     headers:   map of transport-agnostic headers
 *     timestamp: ISO 8601
 *     ttl:       max hops / time-to-live
 *     trace:     array of protocol hops for debugging
 *   }
 *
 * Usage:
 *   const translator = require('./hc_translator');
 *
 *   // Register a custom adapter
 *   translator.registerAdapter('custom', { encode, decode, send });
 *
 *   // Translate a message
 *   const result = await translator.translate({
 *     source: { protocol: 'http', endpoint: '/api/deploy' },
 *     target: { protocol: 'mcp', endpoint: 'heady_deploy_run' },
 *     operation: 'deploy',
 *     payload: { branch: 'main' }
 *   });
 *
 *   // Route through the translator
 *   translator.route(incomingMessage);
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const dgram = require('dgram');
const { EventEmitter } = require('events');

const HEADY_ROOT = path.resolve(__dirname, '..');

// φ constants
const PHI = 1.618033988749895;
const MAX_HOPS = Math.round(PHI * 5);          // ~8 hops max
const TRANSLATE_TIMEOUT = Math.round(PHI * 3000); // ~4854ms

// ─── Latent Space Integration ────────────────────────────────────
let latent;
try {
  latent = require('./hc_latent_space');
} catch (e) {
  latent = { record: () => {}, search: () => ({ results: [] }) };
}

// ─── Canonical Message ───────────────────────────────────────────

function createMessage(opts = {}) {
  return {
    id: opts.id || `hm-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    source: opts.source || { protocol: 'internal', endpoint: 'translator' },
    target: opts.target || { protocol: 'internal', endpoint: 'translator' },
    operation: opts.operation || 'noop',
    payload: opts.payload !== undefined ? opts.payload : null,
    headers: opts.headers || {},
    timestamp: opts.timestamp || new Date().toISOString(),
    ttl: opts.ttl !== undefined ? opts.ttl : MAX_HOPS,
    trace: opts.trace || []
  };
}

function validateMessage(msg) {
  if (!msg || typeof msg !== 'object') return { valid: false, error: 'Message must be an object' };
  if (!msg.source || !msg.source.protocol) return { valid: false, error: 'Missing source.protocol' };
  if (!msg.target || !msg.target.protocol) return { valid: false, error: 'Missing target.protocol' };
  if (!msg.operation) return { valid: false, error: 'Missing operation' };
  if (msg.ttl !== undefined && msg.ttl <= 0) return { valid: false, error: 'TTL expired' };
  return { valid: true };
}

// ─── Protocol Adapters ───────────────────────────────────────────

/**
 * Each adapter implements:
 *   encode(heady_message) → protocol_specific_bytes/object
 *   decode(protocol_specific_input) → heady_message
 *   send(encoded, target_endpoint) → response
 */

// ── MCP Adapter (stdio JSON-RPC) ─────────────────────────────────
const mcpAdapter = {
  name: 'mcp',
  description: 'Model Context Protocol (stdio JSON-RPC 2.0)',

  encode(msg) {
    return {
      jsonrpc: '2.0',
      id: msg.id,
      method: msg.operation === 'response' ? undefined : 'tools/call',
      params: msg.operation === 'response' ? undefined : {
        name: msg.target.endpoint || msg.operation,
        arguments: msg.payload || {}
      },
      result: msg.operation === 'response' ? msg.payload : undefined
    };
  },

  decode(raw) {
    let parsed = raw;
    if (typeof raw === 'string') {
      try { parsed = JSON.parse(raw); } catch (e) {
        return createMessage({ operation: 'error', payload: { error: 'Invalid JSON', raw } });
      }
    }
    if (parsed.method === 'tools/call') {
      return createMessage({
        id: parsed.id,
        source: { protocol: 'mcp', endpoint: 'stdin' },
        target: { protocol: 'internal', endpoint: parsed.params?.name || 'unknown' },
        operation: parsed.params?.name || 'unknown',
        payload: parsed.params?.arguments || {}
      });
    }
    if (parsed.result !== undefined) {
      return createMessage({
        id: parsed.id,
        source: { protocol: 'mcp', endpoint: 'stdout' },
        target: { protocol: 'internal', endpoint: 'caller' },
        operation: 'response',
        payload: parsed.result
      });
    }
    return createMessage({ id: parsed.id, operation: 'unknown', payload: parsed });
  },

  async send(encoded, endpoint) {
    // MCP send writes to stdout (for Claude Desktop)
    const line = JSON.stringify(encoded);
    if (process.stdout.writable) {
      process.stdout.write(line + '\n');
    }
    return { sent: true, protocol: 'mcp', bytes: line.length };
  }
};

// ── HTTP Adapter ─────────────────────────────────────────────────
const httpAdapter = {
  name: 'http',
  description: 'HTTP/REST (JSON body)',

  encode(msg) {
    const method = msg.headers?.method || 'POST';
    const urlPath = msg.target.endpoint || '/';
    return {
      method,
      url: urlPath,
      headers: {
        'Content-Type': 'application/json',
        'X-Heady-Message-Id': msg.id,
        'X-Heady-Operation': msg.operation,
        ...msg.headers
      },
      body: JSON.stringify(msg.payload)
    };
  },

  decode(req) {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { /* keep string */ }
    }
    return createMessage({
      id: req.headers?.['x-heady-message-id'] || undefined,
      source: { protocol: 'http', endpoint: req.url || req.path || '/' },
      target: {
        protocol: req.headers?.['x-heady-target-protocol'] || 'internal',
        endpoint: req.headers?.['x-heady-target-endpoint'] || req.url || '/'
      },
      operation: req.headers?.['x-heady-operation'] || `${req.method} ${req.url}`,
      payload: body,
      headers: { method: req.method }
    });
  },

  async send(encoded, endpoint) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint || process.env.HEADY_MANAGER_URL || 'http://heady-manager:3300');
      const options = {
        hostname: url.hostname,
        port: url.port || 80,
        path: encoded.url || url.pathname,
        method: encoded.method || 'POST',
        headers: encoded.headers || { 'Content-Type': 'application/json' },
        timeout: TRANSLATE_TIMEOUT
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          let parsed = data;
          try { parsed = JSON.parse(data); } catch (e) { /* keep string */ }
          resolve({ status: res.statusCode, body: parsed, protocol: 'http' });
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => { req.destroy(); reject(new Error('HTTP timeout')); });
      if (encoded.body) req.write(encoded.body);
      req.end();
    });
  }
};

// ── WebSocket Adapter ────────────────────────────────────────────
const wsAdapter = {
  name: 'websocket',
  description: 'WebSocket (JSON frames)',
  _connections: new Map(),

  encode(msg) {
    return JSON.stringify({
      type: 'heady',
      id: msg.id,
      operation: msg.operation,
      payload: msg.payload,
      timestamp: msg.timestamp
    });
  },

  decode(raw) {
    let parsed = raw;
    if (typeof raw === 'string') {
      try { parsed = JSON.parse(raw); } catch (e) {
        return createMessage({ operation: 'error', payload: { error: 'Invalid JSON' } });
      }
    }
    return createMessage({
      id: parsed.id,
      source: { protocol: 'websocket', endpoint: parsed.origin || 'ws-client' },
      target: { protocol: parsed.targetProtocol || 'internal', endpoint: parsed.targetEndpoint || 'router' },
      operation: parsed.operation || 'message',
      payload: parsed.payload
    });
  },

  async send(encoded, endpoint) {
    // WebSocket send requires an active connection
    const conn = this._connections.get(endpoint);
    if (conn && conn.readyState === 1 /* OPEN */) {
      conn.send(encoded);
      return { sent: true, protocol: 'websocket', endpoint };
    }
    return { sent: false, error: 'No active WebSocket connection', endpoint };
  }
};

// ── UDP Adapter ──────────────────────────────────────────────────
const udpAdapter = {
  name: 'udp',
  description: 'UDP datagram (compact JSON or binary)',

  encode(msg) {
    // Compact format for UDP (minimize payload size)
    const compact = {
      i: msg.id.substring(0, 16),
      o: msg.operation,
      p: msg.payload,
      t: Date.now()
    };
    return Buffer.from(JSON.stringify(compact));
  },

  decode(buf, rinfo) {
    let parsed;
    try {
      parsed = JSON.parse(buf.toString());
    } catch (e) {
      // Binary payload — wrap raw bytes
      return createMessage({
        source: { protocol: 'udp', endpoint: rinfo ? `${rinfo.address}:${rinfo.port}` : 'unknown' },
        operation: 'binary',
        payload: { raw: buf.toString('base64'), size: buf.length }
      });
    }
    return createMessage({
      id: parsed.i || undefined,
      source: { protocol: 'udp', endpoint: rinfo ? `${rinfo.address}:${rinfo.port}` : 'unknown' },
      target: { protocol: parsed.tp || 'internal', endpoint: parsed.te || 'router' },
      operation: parsed.o || 'message',
      payload: parsed.p
    });
  },

  async send(encoded, endpoint) {
    return new Promise((resolve, reject) => {
      const [host, portStr] = (endpoint || process.env.HEADY_TRANSLATOR_HOST || 'heady-manager:4400').split(':');
      const port = parseInt(portStr) || 4400;
      const client = dgram.createSocket('udp4');
      client.send(encoded, 0, encoded.length, port, host, (err) => {
        client.close();
        if (err) reject(err);
        else resolve({ sent: true, protocol: 'udp', endpoint: `${host}:${port}`, bytes: encoded.length });
      });
    });
  }
};

// ── MIDI Adapter ─────────────────────────────────────────────────
const midiAdapter = {
  name: 'midi',
  description: 'MIDI (SysEx for data, CC/Note for control)',

  // MIDI SysEx manufacturer ID for Heady: 0x7D (educational/dev use)
  SYSEX_HEADER: [0xF0, 0x7D, 0x48, 0x44], // F0 = SysEx start, 7D = dev, 48 44 = "HD"

  encode(msg) {
    // Map operations to MIDI messages
    if (msg.operation === 'control') {
      // Control Change: [0xB0 | channel, cc_number, value]
      const ch = (msg.payload?.channel || 0) & 0x0F;
      const cc = (msg.payload?.cc || 0) & 0x7F;
      const val = (msg.payload?.value || 0) & 0x7F;
      return Buffer.from([0xB0 | ch, cc, val]);
    }
    if (msg.operation === 'note') {
      // Note On: [0x90 | channel, note, velocity]
      const ch = (msg.payload?.channel || 0) & 0x0F;
      const note = (msg.payload?.note || 60) & 0x7F;
      const vel = (msg.payload?.velocity || 100) & 0x7F;
      return Buffer.from([0x90 | ch, note, vel]);
    }
    // Default: pack as SysEx JSON
    const jsonStr = JSON.stringify({
      o: msg.operation,
      p: msg.payload,
      i: msg.id.substring(0, 12)
    });
    // SysEx: encode ASCII as 7-bit safe bytes
    const dataBytes = Array.from(Buffer.from(jsonStr)).map(b => b & 0x7F);
    return Buffer.from([...this.SYSEX_HEADER, ...dataBytes, 0xF7]); // F7 = SysEx end
  },

  decode(buf) {
    if (!buf || buf.length === 0) {
      return createMessage({ operation: 'error', payload: { error: 'Empty MIDI buffer' } });
    }
    const status = buf[0] & 0xF0;
    const channel = buf[0] & 0x0F;

    // Note On / Note Off
    if (status === 0x90 || status === 0x80) {
      return createMessage({
        source: { protocol: 'midi', endpoint: `ch${channel}` },
        operation: status === 0x90 ? 'note_on' : 'note_off',
        payload: { channel, note: buf[1], velocity: buf[2] || 0 }
      });
    }
    // Control Change
    if (status === 0xB0) {
      return createMessage({
        source: { protocol: 'midi', endpoint: `ch${channel}` },
        operation: 'control_change',
        payload: { channel, cc: buf[1], value: buf[2] }
      });
    }
    // SysEx
    if (buf[0] === 0xF0) {
      const headerLen = this.SYSEX_HEADER.length;
      const isHeady = buf.length > headerLen &&
        buf[1] === 0x7D && buf[2] === 0x48 && buf[3] === 0x44;
      if (isHeady) {
        const dataEnd = buf.indexOf(0xF7, headerLen);
        const dataBytes = buf.slice(headerLen, dataEnd > 0 ? dataEnd : buf.length);
        const jsonStr = Buffer.from(dataBytes).toString('ascii');
        try {
          const parsed = JSON.parse(jsonStr);
          return createMessage({
            id: parsed.i,
            source: { protocol: 'midi', endpoint: 'sysex' },
            operation: parsed.o || 'sysex_data',
            payload: parsed.p
          });
        } catch (e) { /* fall through */ }
      }
      return createMessage({
        source: { protocol: 'midi', endpoint: 'sysex' },
        operation: 'sysex_raw',
        payload: { raw: Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join(' ') }
      });
    }

    // Unknown MIDI
    return createMessage({
      source: { protocol: 'midi', endpoint: `status_${status.toString(16)}` },
      operation: 'midi_raw',
      payload: { bytes: Array.from(buf) }
    });
  },

  async send(encoded, endpoint) {
    // MIDI send requires a MIDI output port (node-midi or Web MIDI)
    // Stub: log and return for now; real impl plugs into node-midi
    latent.record('midi', `MIDI send to ${endpoint}`, {
      bytes: encoded.length,
      firstByte: encoded[0]?.toString(16)
    });
    return { sent: false, protocol: 'midi', note: 'MIDI output requires node-midi binding', bytes: encoded.length };
  }
};

// ── TCP Adapter (raw) ────────────────────────────────────────────
const tcpAdapter = {
  name: 'tcp',
  description: 'Raw TCP (newline-delimited JSON)',

  encode(msg) {
    return Buffer.from(JSON.stringify({
      id: msg.id, op: msg.operation, payload: msg.payload, ts: msg.timestamp
    }) + '\n');
  },

  decode(buf) {
    const line = buf.toString().trim();
    try {
      const parsed = JSON.parse(line);
      return createMessage({
        id: parsed.id,
        source: { protocol: 'tcp', endpoint: 'socket' },
        operation: parsed.op || 'message',
        payload: parsed.payload
      });
    } catch (e) {
      return createMessage({
        source: { protocol: 'tcp', endpoint: 'socket' },
        operation: 'raw',
        payload: { data: line }
      });
    }
  },

  async send(encoded, endpoint) {
    return new Promise((resolve, reject) => {
      const net = require('net');
      const [host, portStr] = (endpoint || process.env.HEADY_TRANSLATOR_WS || 'heady-manager:4500').split(':');
      const port = parseInt(portStr) || 4500;
      const client = new net.Socket();
      client.connect(port, host, () => {
        client.write(encoded);
        client.end();
        resolve({ sent: true, protocol: 'tcp', endpoint: `${host}:${port}`, bytes: encoded.length });
      });
      client.on('error', reject);
      client.setTimeout(TRANSLATE_TIMEOUT, () => { client.destroy(); reject(new Error('TCP timeout')); });
    });
  }
};

// ─── Translator Engine ───────────────────────────────────────────

class HeadyTranslator extends EventEmitter {
  constructor() {
    super();
    this._adapters = new Map();
    this._routes = [];        // { match, transform, target }
    this._middleware = [];     // pre/post translation hooks
    this._stats = { translated: 0, errors: 0, byProtocol: {} };
    this._running = false;

    // Register built-in adapters
    this.registerAdapter('mcp', mcpAdapter);
    this.registerAdapter('http', httpAdapter);
    this.registerAdapter('websocket', wsAdapter);
    this.registerAdapter('ws', wsAdapter);   // alias
    this.registerAdapter('udp', udpAdapter);
    this.registerAdapter('midi', midiAdapter);
    this.registerAdapter('tcp', tcpAdapter);
  }

  // ── Adapter Management ───────────────────────────────────────
  registerAdapter(protocol, adapter) {
    if (!adapter.encode || !adapter.decode) {
      throw new Error(`Adapter for '${protocol}' must implement encode() and decode()`);
    }
    this._adapters.set(protocol.toLowerCase(), adapter);
    latent.record('translator', `Registered adapter: ${protocol}`, {
      protocol, hasEncode: true, hasDecode: true, hasSend: !!adapter.send
    });
    return this;
  }

  getAdapter(protocol) {
    return this._adapters.get(protocol.toLowerCase());
  }

  listAdapters() {
    const adapters = {};
    for (const [name, adapter] of this._adapters) {
      adapters[name] = {
        description: adapter.description || name,
        hasSend: typeof adapter.send === 'function'
      };
    }
    return adapters;
  }

  // ── Route Registration ───────────────────────────────────────
  addRoute(match, transform, target) {
    this._routes.push({ match, transform, target });
    return this;
  }

  // ── Middleware ────────────────────────────────────────────────
  use(fn) {
    this._middleware.push(fn);
    return this;
  }

  // ── Core Translation ─────────────────────────────────────────
  async translate(msg) {
    const message = msg.id ? msg : createMessage(msg);
    const validation = validateMessage(message);
    if (!validation.valid) {
      this._stats.errors++;
      return { success: false, error: validation.error, message };
    }

    const sourceProto = message.source.protocol.toLowerCase();
    const targetProto = message.target.protocol.toLowerCase();

    // Record hop
    message.trace.push({
      protocol: sourceProto,
      endpoint: message.source.endpoint,
      timestamp: new Date().toISOString()
    });
    message.ttl--;

    // Run middleware (pre-translate)
    for (const mw of this._middleware) {
      try {
        const result = await mw(message, 'pre');
        if (result === false) {
          return { success: false, error: 'Blocked by middleware', message };
        }
      } catch (e) { /* middleware errors are non-fatal */ }
    }

    // Get target adapter
    const targetAdapter = this.getAdapter(targetProto);
    if (!targetAdapter) {
      this._stats.errors++;
      return {
        success: false,
        error: `No adapter for target protocol: ${targetProto}`,
        availableAdapters: Array.from(this._adapters.keys()),
        message
      };
    }

    // Check route-level transforms
    for (const route of this._routes) {
      if (route.match(message)) {
        if (route.transform) {
          Object.assign(message, route.transform(message));
        }
        if (route.target) {
          message.target = { ...message.target, ...route.target };
        }
        break;
      }
    }

    // Encode for target protocol
    let encoded;
    try {
      encoded = targetAdapter.encode(message);
    } catch (e) {
      this._stats.errors++;
      return { success: false, error: `Encode failed: ${e.message}`, message };
    }

    // Update stats
    this._stats.translated++;
    const key = `${sourceProto}→${targetProto}`;
    this._stats.byProtocol[key] = (this._stats.byProtocol[key] || 0) + 1;

    // Record in latent space
    latent.record('translator', `${sourceProto} → ${targetProto}: ${message.operation}`, {
      sourceProtocol: sourceProto,
      targetProtocol: targetProto,
      operation: message.operation,
      messageId: message.id
    });

    // Run middleware (post-translate)
    for (const mw of this._middleware) {
      try { await mw(message, 'post'); } catch (e) { /* non-fatal */ }
    }

    this.emit('translated', { message, encoded, from: sourceProto, to: targetProto });

    return {
      success: true,
      encoded,
      message,
      translation: { from: sourceProto, to: targetProto },
      stats: { totalTranslated: this._stats.translated }
    };
  }

  // ── Send (translate + deliver) ───────────────────────────────
  async send(msg) {
    const result = await this.translate(msg);
    if (!result.success) return result;

    const targetProto = result.translation.to;
    const adapter = this.getAdapter(targetProto);
    if (!adapter.send) {
      return { ...result, delivered: false, error: `No send() on ${targetProto} adapter` };
    }

    try {
      const endpoint = result.message.target.endpoint;
      const sendResult = await adapter.send(result.encoded, endpoint);
      return { ...result, delivered: true, sendResult };
    } catch (e) {
      this._stats.errors++;
      return { ...result, delivered: false, error: e.message };
    }
  }

  // ── Decode incoming from any protocol ────────────────────────
  decode(protocol, raw, meta) {
    const adapter = this.getAdapter(protocol);
    if (!adapter) {
      return createMessage({
        operation: 'error',
        payload: { error: `No adapter for: ${protocol}` }
      });
    }
    return adapter.decode(raw, meta);
  }

  // ── Route (decode → translate → send) ────────────────────────
  async route(protocol, raw, meta) {
    const message = this.decode(protocol, raw, meta);
    if (message.operation === 'error') return { success: false, error: message.payload, message };

    if (message.target.protocol === 'internal' || !message.target.protocol) {
      // Internal routing — emit event for local handlers
      this.emit('message', message);
      return { success: true, routed: 'internal', message };
    }

    return this.send(message);
  }

  // ── HTTP Bridge Server ───────────────────────────────────────
  createHttpBridge(port = 3301) {
    const server = http.createServer(async (req, res) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          req.body = body;
          const targetProtocol = req.headers['x-heady-target-protocol'] || 'internal';
          const msg = httpAdapter.decode(req);
          msg.target.protocol = targetProtocol;

          let result;
          if (targetProtocol === 'internal') {
            this.emit('message', msg);
            result = { success: true, routed: 'internal', messageId: msg.id };
          } else {
            result = await this.send(msg);
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    });

    server.listen(port, () => {
      this._running = true;
      latent.record('translator', `HTTP bridge started on port ${port}`, { port });
    });

    this._httpServer = server;
    return server;
  }

  // ── UDP Listener ─────────────────────────────────────────────
  createUdpListener(port = 4400) {
    const server = dgram.createSocket('udp4');
    server.on('message', async (buf, rinfo) => {
      const result = await this.route('udp', buf, rinfo);
      if (result.success) {
        this.emit('udp-message', result);
      }
    });
    server.bind(port, () => {
      latent.record('translator', `UDP listener started on port ${port}`, { port });
    });
    this._udpServer = server;
    return server;
  }

  // ── Status ───────────────────────────────────────────────────
  getStatus() {
    return {
      running: this._running,
      adapters: this.listAdapters(),
      routes: this._routes.length,
      middleware: this._middleware.length,
      stats: { ...this._stats },
      config: {
        maxHops: MAX_HOPS,
        timeout: TRANSLATE_TIMEOUT,
        phi: PHI
      }
    };
  }

  // ── Shutdown ─────────────────────────────────────────────────
  shutdown() {
    this._running = false;
    if (this._httpServer) this._httpServer.close();
    if (this._udpServer) this._udpServer.close();
    latent.record('translator', 'Translator shutdown', this._stats);
    this.emit('shutdown');
  }
}

// ─── Singleton ───────────────────────────────────────────────────
const translator = new HeadyTranslator();

// ─── Convenience Exports ─────────────────────────────────────────
module.exports = {
  translator,
  HeadyTranslator,
  createMessage,
  validateMessage,
  // Individual adapters for direct use
  adapters: { mcp: mcpAdapter, http: httpAdapter, websocket: wsAdapter, udp: udpAdapter, midi: midiAdapter, tcp: tcpAdapter },
  // Quick access methods
  translate: (msg) => translator.translate(msg),
  send: (msg) => translator.send(msg),
  decode: (proto, raw, meta) => translator.decode(proto, raw, meta),
  route: (proto, raw, meta) => translator.route(proto, raw, meta),
  registerAdapter: (name, adapter) => translator.registerAdapter(name, adapter),
  getStatus: () => translator.getStatus()
};
