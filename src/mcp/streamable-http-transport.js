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
// ║  FILE: src/mcp/streamable-http-transport.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Heady™ MCP Streamable HTTP Transport v1.0.0
 * HeadySystems Inc. — MCP 2025-11-25 Spec Compliance
 * 
 * Replaces deprecated HTTP+SSE transport.
 * Single endpoint handles all JSON-RPC 2.0 via POST + optional SSE streaming.
 * Session management via Mcp-Session-Id headers.
 * OAuth 2.1 Resource Server with RFC 8707 Resource Indicators.
 * 
 * Drop-in middleware for Express — wrap any existing MCP server.
 * @see https://modelcontextprotocol.io/specification/2025-03-26/basic/transports
 */

'use strict';

const crypto = require('crypto');
const pino = require('pino');

const PHI = 1.618033988749895;
const PSI = 1 / PHI;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

const logger = pino({ name: 'mcp-streamable-http', level: process.env.LOG_LEVEL || 'info' });

// Session TTL: fib(12) seconds = 233s
const SESSION_TTL_MS = FIB[12] * 1000;
// Max concurrent sessions per server
const MAX_SESSIONS = FIB[9]; // 55
// Request timeout
const REQUEST_TIMEOUT_MS = Math.round(PHI * PHI * 1000); // 2618ms

// ─── Session Manager ──────────────────────────────────────────
class MCPSessionManager {
  constructor(redis) {
    this.sessions = new Map();
    this.redis = redis;
    this.prefix = 'mcp:session:';
  }

  async create(clientInfo = {}) {
    const sessionId = crypto.randomUUID();
    const session = {
      id: sessionId,
      created: Date.now(),
      lastActivity: Date.now(),
      clientInfo,
      capabilities: {},
      subscriptions: new Set(),
      messageCounter: 0,
    };

    this.sessions.set(sessionId, session);

    // Persist to Redis for cross-instance recovery
    if (this.redis) {
      await this.redis.set(
        `${this.prefix}${sessionId}`,
        JSON.stringify({ ...session, subscriptions: [...session.subscriptions] }),
        'PX', SESSION_TTL_MS
      );
    }

    logger.info({ sessionId, client: clientInfo.name }, 'MCP session created');
    return sessionId;
  }

  async get(sessionId) {
    let session = this.sessions.get(sessionId);

    if (!session && this.redis) {
      const raw = await this.redis.get(`${this.prefix}${sessionId}`);
      if (raw) {
        session = JSON.parse(raw);
        session.subscriptions = new Set(session.subscriptions);
        this.sessions.set(sessionId, session);
      }
    }

    if (session) {
      session.lastActivity = Date.now();
    }

    return session || null;
  }

  async destroy(sessionId) {
    this.sessions.delete(sessionId);
    if (this.redis) {
      await this.redis.del(`${this.prefix}${sessionId}`);
    }
    logger.info({ sessionId }, 'MCP session destroyed');
  }

  async cleanup() {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity > SESSION_TTL_MS) {
        await this.destroy(id);
      }
    }
  }
}

// ─── Server Card Generator ────────────────────────────────────
function generateServerCard(serverConfig) {
  return {
    name: serverConfig.name,
    version: serverConfig.version || '1.0.0',
    description: serverConfig.description || '',
    protocol_version: '2025-11-25',
    transport: {
      type: 'streamable-http',
      endpoint: serverConfig.endpoint,
      session_management: true,
    },
    capabilities: {
      tools: serverConfig.tools || [],
      resources: serverConfig.resources || [],
      prompts: serverConfig.prompts || [],
    },
    auth: {
      type: 'oauth2',
      authorization_url: `https://auth.headysystems.com/oauth/authorize`,
      token_url: `https://auth.headysystems.com/oauth/token`,
      resource_indicator: serverConfig.endpoint,
      scopes: serverConfig.scopes || ['mcp:read', 'mcp:write', 'mcp:admin'],
    },
    contact: {
      organization: 'HeadySystems Inc.',
      url: 'https://headysystems.com',
    },
  };
}

// ─── Streamable HTTP Transport Middleware ──────────────────────
function createStreamableHTTPMiddleware(mcpHandler, options = {}) {
  const sessions = new MCPSessionManager(options.redis);
  const serverConfig = options.serverConfig || {};

  // Periodic cleanup
  setInterval(() => sessions.cleanup(), FIB[10] * 1000); // Every 89s

  return async function streamableHTTPMiddleware(req, res, next) {
    const path = req.path;

    // ─── Server Card Discovery ─────────────
    if (path === '/.well-known/mcp/server.json' || path === '/.well-known/mcp.json') {
      return res.json(generateServerCard(serverConfig));
    }

    // ─── MCP Endpoint ──────────────────────
    if (req.method === 'POST' && (path === '/mcp' || path === '/')) {
      return await handleMCPRequest(req, res, sessions, mcpHandler, options);
    }

    // ─── SSE Stream for Notifications ──────
    if (req.method === 'GET' && path === '/mcp/stream') {
      return await handleSSEStream(req, res, sessions);
    }

    // ─── Session Termination ───────────────
    if (req.method === 'DELETE' && path === '/mcp') {
      const sessionId = req.headers['mcp-session-id'];
      if (sessionId) {
        await sessions.destroy(sessionId);
        return res.status(204).end();
      }
      return res.status(400).json({ error: 'Missing Mcp-Session-Id header' });
    }

    next();
  };
}

// ─── Handle MCP JSON-RPC Request ──────────────────────────────
async function handleMCPRequest(req, res, sessions, mcpHandler, options) {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32700, message: 'Parse error' },
      id: null,
    });
  }

  // Session management
  let sessionId = req.headers['mcp-session-id'];
  let session;

  if (sessionId) {
    session = await sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Session not found or expired' },
        id: body.id || null,
      });
    }
  }

  // Handle initialization
  if (body.method === 'initialize') {
    sessionId = await sessions.create(body.params?.clientInfo || {});
    session = await sessions.get(sessionId);

    const initResponse = {
      jsonrpc: '2.0',
      result: {
        protocolVersion: '2025-11-25',
        capabilities: {
          tools: { listChanged: true },
          resources: { subscribe: true, listChanged: true },
          prompts: { listChanged: true },
        },
        serverInfo: {
          name: options.serverConfig?.name || 'heady-mcp',
          version: options.serverConfig?.version || '1.0.0',
        },
      },
      id: body.id,
    };

    res.setHeader('Mcp-Session-Id', sessionId);
    return res.json(initResponse);
  }

  // Require session for all other requests
  if (!session) {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Session required. Send initialize first.' },
      id: body.id || null,
    });
  }

  // Detect if client wants streaming response
  const acceptsSSE = req.headers.accept?.includes('text/event-stream');

  if (acceptsSSE && isLongRunningMethod(body.method)) {
    // Stream response via SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Mcp-Session-Id', sessionId);

    try {
      const taskId = crypto.randomUUID();

      // Send task created event
      res.write(`event: task_created\ndata: ${JSON.stringify({ taskId, method: body.method })}\n\n`);

      // Execute with progress callbacks
      const result = await mcpHandler(body.method, body.params, {
        session,
        onProgress: (progress) => {
          res.write(`event: progress\ndata: ${JSON.stringify({ taskId, ...progress })}\n\n`);
        },
      });

      // Send final result
      res.write(`event: result\ndata: ${JSON.stringify({ jsonrpc: '2.0', result, id: body.id })}\n\n`);
      res.write(`event: done\ndata: {}\n\n`);
      res.end();

    } catch (err) {
      res.write(`event: error\ndata: ${JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32603, message: err.message },
        id: body.id,
      })}\n\n`);
      res.end();
    }

  } else {
    // Standard JSON-RPC response
    res.setHeader('Mcp-Session-Id', sessionId);

    try {
      const result = await mcpHandler(body.method, body.params, { session });
      res.json({ jsonrpc: '2.0', result, id: body.id });
    } catch (err) {
      const code = err.code || -32603;
      res.status(code === -32601 ? 404 : 500).json({
        jsonrpc: '2.0',
        error: { code, message: err.message, data: err.details },
        id: body.id,
      });
    }
  }

  session.messageCounter++;
}

// ─── SSE Stream for Server-Initiated Notifications ────────────
async function handleSSEStream(req, res, sessions) {
  const sessionId = req.headers['mcp-session-id'] || req.query.sessionId;
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing session ID' });
  }

  const session = await sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Mcp-Session-Id', sessionId);

  // Send keepalive pings at φ intervals
  const keepalive = setInterval(() => {
    res.write(`: keepalive ${Date.now()}\n\n`);
  }, Math.round(PHI * 10000)); // ~16.18s

  // Support Last-Event-ID for resumption
  const lastEventId = req.headers['last-event-id'];
  if (lastEventId) {
    logger.info({ sessionId, lastEventId }, 'Client resuming stream');
  }

  req.on('close', () => {
    clearInterval(keepalive);
    logger.info({ sessionId }, 'SSE stream closed');
  });
}

// ─── Tool Annotation Support ──────────────────────────────────
function annotateTools(tools) {
  return tools.map(tool => ({
    ...tool,
    annotations: {
      readOnly: tool._readOnly || false,
      destructive: tool._destructive || false,
      idempotent: tool._idempotent || false,
      open_world: tool._openWorld || false,
      ...(tool.annotations || {}),
    },
  }));
}

// ─── OAuth 2.1 Resource Server Middleware ──────────────────────
function createOAuth21Middleware(options = {}) {
  const { tokenVerifyUrl, resourceIndicator } = options;

  return async function oauth21Middleware(req, res, next) {
    // Skip for health and discovery endpoints
    if (req.path === '/health' || req.path.startsWith('/.well-known/')) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'unauthorized',
        error_description: 'Bearer token required',
      });
    }

    const token = authHeader.slice(7);

    try {
      // Verify token with auth server
      const verifyRes = await fetch(tokenVerifyUrl || 'https://auth.headysystems.com/oauth/introspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          token,
          resource: resourceIndicator || req.originalUrl,
        }),
      });

      if (!verifyRes.ok) {
        return res.status(401).json({ error: 'invalid_token' });
      }

      const tokenInfo = await verifyRes.json();
      if (!tokenInfo.active) {
        return res.status(401).json({ error: 'token_expired' });
      }

      // Check Resource Indicator (RFC 8707)
      if (resourceIndicator && tokenInfo.aud !== resourceIndicator) {
        return res.status(403).json({
          error: 'insufficient_scope',
          error_description: 'Token not issued for this resource',
        });
      }

      req.tokenInfo = tokenInfo;
      next();
    } catch (err) {
      logger.error({ err }, 'Token verification failed');
      return res.status(500).json({ error: 'server_error' });
    }
  };
}

// ─── Helpers ──────────────────────────────────────────────────
function isLongRunningMethod(method) {
  const longRunning = [
    'tools/call',
    'resources/read',
    'heady/pipeline/execute',
    'heady/swarm/dispatch',
    'heady/distill',
    'heady/battle/arena',
  ];
  return longRunning.includes(method);
}

// ─── Export ───────────────────────────────────────────────────
module.exports = {
  createStreamableHTTPMiddleware,
  generateServerCard,
  MCPSessionManager,
  annotateTools,
  createOAuth21Middleware,
};
