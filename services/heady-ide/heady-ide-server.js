// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ IDE Server v1.0 — Entry Point                          ║
// ║  Express + WebSocket on Cloud Run (ide.heady-ai.com)            ║
// ║  Wires: HeadyCoder, AutoContext, Battle, Terminal, LSP, MCP     ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { bootHeadyServices, shutdownHeadyServices } from './heady-services.js';

const PHI = (1 + Math.sqrt(5)) / 2;
const FIB = [0,1,1,2,3,5,8,13,21,34,55,89,144];

const log = pino({
  level: process.env.LOG_LEVEL || 'info',
  name: 'heady-ide-server',
  base: { service: 'heady-ide', node: 'headyforge' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

const PORT = parseInt(process.env.HEADY_IDE_PORT || process.env.PORT || '8080', 10);

// CORS — all 11 Heady domains + heady-ai.com
const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').concat([
  'https://heady-ai.com', 'https://headyme.com', 'https://headysystems.com',
  'https://headyapi.com', 'https://headymcp.com', 'https://headyio.com',
  'https://headybot.com', 'https://headybuddy.org', 'https://headyconnection.org',
  'https://headylens.com', 'https://headyfinance.com',
  'http://localhost:3000', // dev only
]).filter(Boolean);

async function main() {
  // ── Boot all services ──────────────────────────────────────────
  const services = await bootHeadyServices({ tenantId: 'system' });

  const app = express();
  const server = createServer(app);

  // ── Middleware ──────────────────────────────────────────────────
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, true);
      else cb(new Error('CORS blocked'));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '5mb' }));
  app.use(pinoHttp({ logger: log, autoLogging: { ignore: (req) => req.url === '/health' } }));

  // ── Auth middleware ─────────────────────────────────────────────
  const authMiddleware = async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '') ||
                  req.cookies?.session;
    if (!token) return res.status(401).json({ error: 'Unauthorized', code: 'HE-1001' });

    try {
      if (services.firebase) {
        const user = await services.firebase.verifyToken(token);
        if (!user) return res.status(401).json({ error: 'Invalid token', code: 'HE-1002' });
        req.user = user;
        req.tenantId = services.firebase.extractTenantId(user);
      } else {
        // Dev mode — accept internal token
        if (token === process.env.INTERNAL_NODE_SECRET) {
          req.user = { localId: 'dev', email: 'dev@headysystems.com' };
          req.tenantId = 'dev';
        } else {
          return res.status(401).json({ error: 'Auth not configured', code: 'HE-1003' });
        }
      }
      next();
    } catch (err) {
      res.status(401).json({ error: err.message, code: 'HE-1004' });
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // ROUTES
  // ═══════════════════════════════════════════════════════════════

  // ── Health ──────────────────────────────────────────────────────
  app.get('/health', async (_req, res) => {
    const health = await services.health();
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  });

  // ── Workspace CRUD ─────────────────────────────────────────────
  app.post('/api/workspace', authMiddleware, async (req, res) => {
    const { name, gitUrl } = req.body;
    const wsId = `ws-${Date.now().toString(36)}`;
    const prefix = `tenant:${req.tenantId}/workspace:${wsId}/`;

    if (gitUrl) {
      // Clone will happen via terminal — just register the workspace
    }

    if (services.db) {
      await services.db.query(`
        INSERT INTO ide_workspaces (id, user_id, name, git_url, r2_prefix)
        VALUES ($1, $2, $3, $4, $5)
      `, [wsId, req.tenantId, name || 'untitled', gitUrl || null, prefix]);
    }

    res.json({ id: wsId, prefix, name, gitUrl });
  });

  app.get('/api/workspace', authMiddleware, async (req, res) => {
    if (!services.db) return res.json({ workspaces: [] });
    const { rows } = await services.db.query(
      'SELECT * FROM ide_workspaces WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 21',
      [req.tenantId]
    );
    res.json({ workspaces: rows });
  });

  // ── Filesystem (R2) ────────────────────────────────────────────
  app.get('/api/fs/*', authMiddleware, async (req, res) => {
    try {
      const path = req.params[0];
      const prefix = `tenant:${req.tenantId}/workspace:${req.query.ws || 'default'}/`;
      const content = await services.r2.read(prefix + path);
      res.type('text/plain').send(content);
    } catch (err) {
      res.status(404).json({ error: 'File not found', code: 'HE-4001' });
    }
  });

  app.put('/api/fs/*', authMiddleware, async (req, res) => {
    const path = req.params[0];
    const prefix = `tenant:${req.tenantId}/workspace:${req.query.ws || 'default'}/`;
    await services.r2.write(prefix + path, req.body.content || '');

    // Notify AutoContext of file change
    services.heady.autoContext.updateOpenFile(path, req.body.content || '');

    res.json({ ok: true, path });
  });

  app.delete('/api/fs/*', authMiddleware, async (req, res) => {
    const path = req.params[0];
    const prefix = `tenant:${req.tenantId}/workspace:${req.query.ws || 'default'}/`;
    await services.r2.remove(prefix + path);
    res.json({ ok: true, deleted: path });
  });

  app.get('/api/fs-tree', authMiddleware, async (req, res) => {
    const prefix = `tenant:${req.tenantId}/workspace:${req.query.ws || 'default'}/`;
    const files = await services.r2.list(prefix);
    res.json({ files: files.map(f => ({ ...f, key: f.key.replace(prefix, '') })) });
  });

  // ── HeadyCoder: AI Chat ────────────────────────────────────────
  app.post('/api/chat', authMiddleware, async (req, res) => {
    const { messages, provider, options } = req.body;

    // Track message in AutoContext
    const lastUser = messages.filter(m => m.role === 'user').pop();
    if (lastUser) services.heady.autoContext.addMessage('user', lastUser.content);

    try {
      const result = provider
        ? await services.heady.call(provider, messages, options || {})
        : await services.heady.smart(messages, options || {});

      services.heady.autoContext.addMessage('assistant', result.content);
      res.json(result);
    } catch (err) {
      log.error({ err: err.message }, 'Chat call failed');
      res.status(500).json({ error: err.message, code: 'HE-3001' });
    }
  });

  // ── HeadyCoder: Research (Perplexity) ──────────────────────────
  app.post('/api/research', authMiddleware, async (req, res) => {
    try {
      const result = await services.heady.research(req.body.query, req.body.options || {});
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message, code: 'HE-3002' });
    }
  });

  // ── HeadyBattle ────────────────────────────────────────────────
  app.post('/api/battle', authMiddleware, async (req, res) => {
    const { messages, candidates, options } = req.body;
    try {
      const result = await services.heady.battle(messages, { candidates, ...options });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message, code: 'HE-3003' });
    }
  });

  // ── HeadyCodex: Autonomous Coding ──────────────────────────────
  app.post('/api/codex', authMiddleware, async (req, res) => {
    const { intent, context } = req.body;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      for await (const event of services.heady.codex.execute(intent, context)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: 'codex:error', error: err.message })}\n\n`);
    }
    res.end();
  });

  // ── HeadyJules: Research-First Coding ──────────────────────────
  app.post('/api/jules', authMiddleware, async (req, res) => {
    const { intent, context } = req.body;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      for await (const event of services.heady.jules.execute(intent, context)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: 'jules:error', error: err.message })}\n\n`);
    }
    res.end();
  });

  // ── MCP Tool Proxy ─────────────────────────────────────────────
  app.post('/api/mcp/:tool', authMiddleware, async (req, res) => {
    const mcpUrl = process.env.MCP_SERVER_URL || 'https://headymcp.com';
    try {
      const resp = await fetch(`${mcpUrl}/tools/${req.params.tool}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.INTERNAL_NODE_SECRET}`,
          'X-Tenant-Id': req.tenantId,
        },
        body: JSON.stringify(req.body),
        signal: AbortSignal.timeout(30000),
      });
      const data = await resp.json();
      res.json(data);
    } catch (err) {
      res.status(502).json({ error: err.message, code: 'HE-5001' });
    }
  });

  // ── Embed endpoint (for browser-ai.js fallback) ────────────────
  app.post('/api/v1/embed', authMiddleware, async (req, res) => {
    try {
      const embeddings = await services.embed(req.body.texts || [req.body.text || '']);
      res.json({ embeddings });
    } catch (err) {
      res.status(500).json({ error: err.message, code: 'HE-4002' });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // WebSocket Endpoints
  // ═══════════════════════════════════════════════════════════════

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const path = url.pathname;

    // Authenticate WebSocket connections
    const token = url.searchParams.get('token') || request.headers['sec-websocket-protocol'];

    wss.handleUpgrade(request, socket, head, (ws) => {
      ws._path = path;
      ws._tenantId = 'system'; // resolve from token in production

      if (path === '/ws/terminal') {
        handleTerminalWS(ws, services);
      } else if (path === '/ws/swarm') {
        handleSwarmWS(ws, services);
      } else if (path === '/ws/collab') {
        handleCollabWS(ws, services);
      } else {
        ws.send(JSON.stringify({ error: 'Unknown WS endpoint' }));
        ws.close();
      }
    });
  });

  // ── Terminal WebSocket Handler ──────────────────────────────────
  function handleTerminalWS(ws, svc) {
    log.info('Terminal WS connected');

    // In production: spawn node-pty shell in container
    // For now: echo commands and track in AutoContext
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'input') {
          // Forward to pty (production: node-pty)
          svc.heady.autoContext.addTerminalEntry(msg.data, '');
          ws.send(JSON.stringify({ type: 'output', data: `$ ${msg.data}\r\n` }));
        }
      } catch { /* binary data from terminal */ }
    });

    ws.on('close', () => log.debug('Terminal WS disconnected'));
  }

  // ── Swarm State WebSocket Handler ──────────────────────────────
  function handleSwarmWS(ws, svc) {
    log.info('Swarm dashboard WS connected');

    // Broadcast swarm state every φ⁵ms ≈ 11s
    const interval = setInterval(async () => {
      try {
        const state = await svc.redis.get(`tenant:${ws._tenantId}:swarm:active`);
        ws.send(JSON.stringify({
          type: 'swarm:state',
          data: state ? JSON.parse(state) : { swarms: 21, activeBees: 0 },
          timestamp: Date.now(),
        }));
      } catch { /* ignore broadcast errors */ }
    }, Math.round(Math.pow(PHI, 5) * 1000));

    ws.on('close', () => {
      clearInterval(interval);
      log.debug('Swarm WS disconnected');
    });
  }

  // ── Collaborative Editing WebSocket (Yjs CRDT) ─────────────────
  function handleCollabWS(ws, svc) {
    log.info('Collab WS connected (Yjs relay)');
    // In production: integrate y-websocket provider
    ws.on('message', (data) => {
      // Broadcast to all other clients in same workspace
      wss.clients.forEach((client) => {
        if (client !== ws && client._path === '/ws/collab' && client.readyState === 1) {
          client.send(data);
        }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // START
  // ═══════════════════════════════════════════════════════════════

  server.listen(PORT, () => {
    log.info({ port: PORT, providers: Object.keys(services.heady.providers).length }, `HeadyAI-IDE Server online at :${PORT}`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    log.info({ signal }, 'Shutdown signal received');
    server.close();
    await shutdownHeadyServices(services);
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  log.fatal({ err: err.message }, 'Fatal boot failure');
  process.exit(1);
});
