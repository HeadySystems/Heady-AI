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
// ║  FILE: services/heady-mcp-server/server.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
// ═══════════════════════════════════════════════════════════════════════════════
// Heady MCP Server v2.0.0
// Streamable HTTP Transport (2025-11-25 spec) + 384D Vector Tools + CSL
// Sacred Geometry Layer: Protocol
// ═══════════════════════════════════════════════════════════════════════════════

// Sentry instrumentation — MUST be first import
import './instrument.js';
import { Sentry } from './instrument.js';

import express from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { neon } from '@neondatabase/serverless';
import pino from 'pino';

// ─── Phi-Math Constants ──────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 0.6180339887498949;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];

// CSL Coherence Thresholds
const CSL = {
  CRITICAL: 0.927,  // PHI^(-1/8)
  HIGH: 0.882,      // PHI^(-1/5)
  MEDIUM: 0.809,    // PHI^(-1/3)
  LOW: 0.691,       // PHI^(-1/2)
  MINIMUM: 0.500,   // Baseline
};

const EMBEDDING_DIM = 384;
const HF_TIMEOUT_MS = Math.round(PHI * PHI * PHI * 1000); // 4236ms

// ─── Configuration ───────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 3003;
const NODE_ENV = process.env.NODE_ENV || 'development';
const DATABASE_URL = process.env.DATABASE_URL;

const HEADY_SERVICES = [
  { name: 'auth-session-server', port: 3400, domain: 'security', layer: 'Governance' },
  { name: 'heady-buddy-api', port: 3351, domain: 'companion', layer: 'Middle' },
  { name: 'heady-mcp-server', port: 3003, domain: 'protocol', layer: 'Protocol' },
  { name: 'heady-gateway', port: 3000, domain: 'gateway', layer: 'Outer' },
  { name: 'heady-widget-server', port: 3100, domain: 'interface', layer: 'Surface' },
];

// HuggingFace token rotation
const HF_TOKENS = [
  process.env.HF_TOKEN_1,
  process.env.HF_TOKEN_2,
  process.env.HF_TOKEN_3,
].filter(Boolean);
let hfTokenIndex = 0;

function getNextHFToken() {
  if (HF_TOKENS.length === 0) return null;
  const token = HF_TOKENS[hfTokenIndex % HF_TOKENS.length];
  hfTokenIndex++;
  return token;
}

// ─── Pino Logger with GCP Severity Formatter ─────────────────────────────────
const GCP_SEVERITY_MAP = {
  10: 'DEBUG',
  20: 'DEBUG',
  30: 'INFO',
  40: 'WARNING',
  50: 'ERROR',
  60: 'CRITICAL',
};

const log = pino({
  level: process.env.LOG_LEVEL || 'info',
  name: 'heady-mcp-server',
  base: { service: 'heady-mcp', version: '2.0.0', layer: 'Protocol' },
  formatters: {
    level(label, number) {
      return {
        severity: GCP_SEVERITY_MAP[number] || 'DEFAULT',
        level: label,
      };
    },
  },
  messageKey: 'message',
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
});

// ─── CORS Origins ────────────────────────────────────────────────────────────
const HEADY_DOMAINS = [
  'headyme.com',
  'headysystems.com',
  'headyconnection.org',
  'headybuddy.org',
  'headymcp.com',
  'headyio.com',
  'headybot.com',
  'headyapi.com',
  'heady-ai.com',
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    for (const domain of HEADY_DOMAINS) {
      if (hostname === domain || hostname === `www.${domain}`) return true;
      if (hostname.endsWith(`.${domain}`)) return true;
    }
    if (NODE_ENV === 'development' && (hostname === 'localhost' || hostname === '127.0.0.1')) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ─── Neon Postgres ───────────────────────────────────────────────────────────
let sql = null;
let dbReady = false;

async function initDatabase() {
  if (!DATABASE_URL) {
    log.warn('DATABASE_URL not set — Postgres operations will be skipped');
    return;
  }
  try {
    sql = neon(DATABASE_URL);

    await sql`CREATE EXTENSION IF NOT EXISTS vector`;

    await sql`
      CREATE TABLE IF NOT EXISTS buddy_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id TEXT NOT NULL,
        device_id TEXT,
        role TEXT NOT NULL CHECK (role IN ('user', 'buddy', 'system')),
        text TEXT NOT NULL,
        node TEXT,
        origin TEXT,
        csl_score REAL DEFAULT 0.618,
        embedding vector(384),
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_buddy_msg_tenant ON buddy_messages (tenant_id, created_at DESC)`;

    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_buddy_msg_embedding
        ON buddy_messages USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
      `;
    } catch (err) {
      log.warn({ err: err.message }, 'HNSW index creation skipped');
    }

    dbReady = true;
    log.info('Neon Postgres initialized');
  } catch (err) {
    log.error({ err: err.message }, 'Neon Postgres init failed');
    dbReady = false;
  }
}

// ─── HuggingFace 384D Embedding Generation ───────────────────────────────────
async function generateEmbedding(text) {
  const token = getNextHFToken();
  if (!token) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HF_TIMEOUT_MS);

  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: text.slice(0, 512),
          options: { wait_for_model: true },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      log.warn({ status: response.status }, 'HuggingFace API error');
      return null;
    }

    const result = await response.json();
    if (Array.isArray(result) && result.length === EMBEDDING_DIM && typeof result[0] === 'number') {
      return result;
    }
    if (Array.isArray(result) && Array.isArray(result[0]) && result[0].length === EMBEDDING_DIM) {
      return result[0];
    }
    return null;
  } catch (err) {
    clearTimeout(timeout);
    log.warn({ err: err.message }, 'Embedding generation failed');
    return null;
  }
}

// ─── In-Memory Event Store for SSE Resumability ──────────────────────────────
class InMemoryEventStore {
  constructor() {
    this.events = new Map();
  }

  generateEventId(streamId) {
    return `${streamId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  getStreamIdFromEventId(eventId) {
    const parts = eventId.split('_');
    return parts.length > 0 ? parts[0] : '';
  }

  async storeEvent(streamId, message) {
    const eventId = this.generateEventId(streamId);
    this.events.set(eventId, { streamId, message });
    // Prune old events (keep last 1000)
    if (this.events.size > 1000) {
      const keys = [...this.events.keys()];
      for (let i = 0; i < keys.length - 1000; i++) {
        this.events.delete(keys[i]);
      }
    }
    return eventId;
  }

  async replayEventsAfter(lastEventId, { send }) {
    if (!lastEventId || !this.events.has(lastEventId)) return '';
    const streamId = this.getStreamIdFromEventId(lastEventId);
    if (!streamId) return '';

    let foundLast = false;
    const sorted = [...this.events.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    for (const [eventId, { streamId: sid, message }] of sorted) {
      if (sid !== streamId) continue;
      if (eventId === lastEventId) {
        foundLast = true;
        continue;
      }
      if (foundLast) {
        await send(eventId, message);
      }
    }
    return streamId;
  }
}

// ─── Create MCP Server with Heady Tools ──────────────────────────────────────
function createHeadyMcpServer() {
  const server = new McpServer(
    {
      name: 'heady-mcp-server',
      version: '2.0.0',
    },
    {
      capabilities: {
        logging: {},
        tools: {},
      },
    }
  );

  // ── Tool: search_memory ──────────────────────────────────────────────────
  server.registerTool(
    'search_memory',
    {
      description: 'Semantic search over 384D pgvector embeddings in the Heady vector memory store. Returns the most similar memories by cosine distance.',
      inputSchema: z.object({
        query: z.string().describe('Natural language search query'),
        user: z.string().optional().describe('Tenant/user ID to scope the search'),
        topK: z.number().optional().default(5).describe('Number of results to return (default 5)'),
      }),
      annotations: {
        title: 'Search Vector Memory',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      outputSchema: z.object({
        results: z.array(z.object({
          id: z.string(),
          text: z.string(),
          role: z.string(),
          similarity: z.number(),
          created_at: z.string(),
        })),
        count: z.number(),
        embeddingDim: z.number(),
      }),
    },
    async ({ query, user, topK }) => {
      const span = Sentry?.startSpan?.({ name: 'mcp.search_memory', op: 'db.query' });
      try {
        if (!dbReady || !sql) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'Database not available', results: [], count: 0 }) }],
          };
        }

        const embedding = await generateEmbedding(query);
        if (!embedding) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'Embedding generation unavailable', results: [], count: 0 }) }],
          };
        }

        const k = Math.min(topK || 5, FIB[10]); // max 55
        const embeddingStr = `[${embedding.join(',')}]`;

        let results;
        if (user) {
          results = await sql`
            SELECT id, role, text, csl_score, created_at,
                   1 - (embedding <=> ${embeddingStr}::vector) AS similarity
            FROM buddy_messages
            WHERE tenant_id = ${user} AND embedding IS NOT NULL
            ORDER BY embedding <=> ${embeddingStr}::vector
            LIMIT ${k}
          `;
        } else {
          results = await sql`
            SELECT id, role, text, csl_score, created_at,
                   1 - (embedding <=> ${embeddingStr}::vector) AS similarity
            FROM buddy_messages
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> ${embeddingStr}::vector
            LIMIT ${k}
          `;
        }

        const filtered = results.filter((r) => r.similarity > 0.2);
        const output = {
          results: filtered.map((r) => ({
            id: r.id,
            text: r.text,
            role: r.role,
            similarity: Math.round(r.similarity * 1000) / 1000,
            created_at: r.created_at,
          })),
          count: filtered.length,
          embeddingDim: EMBEDDING_DIM,
        };

        log.info({ query: query.slice(0, 50), user, results: filtered.length }, 'search_memory completed');

        return {
          content: [{ type: 'text', text: JSON.stringify(output) }],
          structuredContent: output,
        };
      } catch (err) {
        log.error({ err: err.message }, 'search_memory failed');
        Sentry?.captureException?.(err);
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.message, results: [], count: 0 }) }],
          isError: true,
        };
      } finally {
        span?.end?.();
      }
    }
  );

  // ── Tool: store_memory ─────────────────────────────────────────────────────
  server.registerTool(
    'store_memory',
    {
      description: 'Persist a new memory to the Heady 384D vector store. Generates an embedding via HuggingFace and stores in Neon Postgres with pgvector.',
      inputSchema: z.object({
        content: z.string().describe('Text content to store as a memory'),
        user: z.string().describe('Tenant/user ID who owns this memory'),
        role: z.enum(['user', 'buddy', 'system']).optional().default('system').describe('Message role'),
        node: z.string().optional().describe('Origin node identifier'),
        source: z.string().optional().describe('Source of the memory'),
      }),
      annotations: {
        title: 'Store Vector Memory',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      outputSchema: z.object({
        stored: z.boolean(),
        id: z.string().nullable(),
        hasEmbedding: z.boolean(),
      }),
    },
    async ({ content, user, role, node, source }) => {
      const span = Sentry?.startSpan?.({ name: 'mcp.store_memory', op: 'db.insert' });
      try {
        if (!dbReady || !sql) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ stored: false, id: null, hasEmbedding: false, error: 'Database not available' }) }],
          };
        }

        const embedding = await generateEmbedding(content);
        const embeddingStr = embedding ? `[${embedding.join(',')}]` : null;

        const result = await sql`
          INSERT INTO buddy_messages (tenant_id, role, text, node, origin, csl_score, embedding)
          VALUES (
            ${user},
            ${role || 'system'},
            ${content},
            ${node || null},
            ${source || 'mcp'},
            ${PSI},
            ${embeddingStr}::vector
          )
          RETURNING id
        `;

        const id = result[0]?.id || null;
        const output = { stored: !!id, id, hasEmbedding: !!embedding };

        log.info({ user, id, hasEmbedding: !!embedding }, 'store_memory completed');

        return {
          content: [{ type: 'text', text: JSON.stringify(output) }],
          structuredContent: output,
        };
      } catch (err) {
        log.error({ err: err.message }, 'store_memory failed');
        Sentry?.captureException?.(err);
        return {
          content: [{ type: 'text', text: JSON.stringify({ stored: false, id: null, hasEmbedding: false, error: err.message }) }],
          isError: true,
        };
      } finally {
        span?.end?.();
      }
    }
  );

  // ── Tool: chat ─────────────────────────────────────────────────────────────
  server.registerTool(
    'chat',
    {
      description: 'Send a message to the HeadyBuddy conversation engine. Routes to the internal buddy-api for LLM-powered responses with vector memory context.',
      inputSchema: z.object({
        message: z.string().describe('User message to send'),
        user: z.string().optional().describe('User ID for conversation context'),
        history: z.array(z.object({
          role: z.string(),
          content: z.string(),
        })).optional().describe('Conversation history'),
      }),
      annotations: {
        title: 'HeadyBuddy Chat',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      outputSchema: z.object({
        response: z.string(),
        node: z.string(),
        provider: z.string(),
      }),
    },
    async ({ message, user, history }) => {
      const span = Sentry?.startSpan?.({ name: 'mcp.chat', op: 'http.client' });
      try {
        const buddyUrl = process.env.BUDDY_API_URL || 'http://localhost:3351';
        const response = await fetch(`${buddyUrl}/api/brain/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            user: user || 'mcp-client',
            history: history || [],
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => 'unknown');
          throw new Error(`Buddy API returned ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const output = {
          response: data.response || data.text || '',
          node: data.node || 'PERSONA',
          provider: data.provider || 'unknown',
        };

        log.info({ user, provider: output.provider }, 'chat completed');

        return {
          content: [{ type: 'text', text: output.response }],
          structuredContent: output,
        };
      } catch (err) {
        log.error({ err: err.message }, 'chat failed');
        Sentry?.captureException?.(err);
        return {
          content: [{ type: 'text', text: `Chat error: ${err.message}. The HeadyBuddy API may be unreachable.` }],
          isError: true,
        };
      } finally {
        span?.end?.();
      }
    }
  );

  // ── Tool: list_services ────────────────────────────────────────────────────
  server.registerTool(
    'list_services',
    {
      description: 'Enumerate running Heady ecosystem services and their health status. Probes each service health endpoint.',
      inputSchema: z.object({
        checkHealth: z.boolean().optional().default(false).describe('Whether to probe each service health endpoint'),
      }),
      annotations: {
        title: 'List Heady Services',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      outputSchema: z.object({
        services: z.array(z.object({
          name: z.string(),
          port: z.number(),
          domain: z.string(),
          layer: z.string(),
          status: z.string(),
        })),
        count: z.number(),
      }),
    },
    async ({ checkHealth }) => {
      const span = Sentry?.startSpan?.({ name: 'mcp.list_services', op: 'http.client' });
      try {
        const services = await Promise.all(
          HEADY_SERVICES.map(async (svc) => {
            let status = 'registered';

            if (checkHealth) {
              try {
                const resp = await fetch(`http://localhost:${svc.port}/health`, {
                  signal: AbortSignal.timeout(3000),
                });
                status = resp.ok ? 'healthy' : 'degraded';
              } catch {
                status = 'unreachable';
              }
            }

            return { ...svc, status };
          })
        );

        const output = { services, count: services.length };

        return {
          content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
          structuredContent: output,
        };
      } catch (err) {
        log.error({ err: err.message }, 'list_services failed');
        return {
          content: [{ type: 'text', text: `Error listing services: ${err.message}` }],
          isError: true,
        };
      } finally {
        span?.end?.();
      }
    }
  );

  // ── Tool: get_coherence ────────────────────────────────────────────────────
  server.registerTool(
    'get_coherence',
    {
      description: 'Check the CSL (Continuous Semantic Logic) coherence score for a Heady ecosystem component. Returns phi-weighted scoring with threshold classification.',
      inputSchema: z.object({
        component: z.string().describe('Component name to check (e.g., "auth-session-server", "heady-buddy-api")'),
      }),
      annotations: {
        title: 'CSL Coherence Check',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      outputSchema: z.object({
        component: z.string(),
        coherenceScore: z.number(),
        classification: z.string(),
        thresholds: z.object({
          CRITICAL: z.number(),
          HIGH: z.number(),
          MEDIUM: z.number(),
          LOW: z.number(),
          MINIMUM: z.number(),
        }),
        phi: z.number(),
        psi: z.number(),
      }),
    },
    async ({ component }) => {
      const span = Sentry?.startSpan?.({ name: 'mcp.get_coherence', op: 'function' });
      try {
        // Try to probe the component's health endpoint for a real coherence score
        const service = HEADY_SERVICES.find((s) => s.name === component);
        let coherenceScore = PSI; // default

        if (service) {
          try {
            const resp = await fetch(`http://localhost:${service.port}/health`, {
              signal: AbortSignal.timeout(3000),
            });
            if (resp.ok) {
              const health = await resp.json();
              coherenceScore = health.coherenceScore || health.coherence_score || PSI;
            }
          } catch {
            // Use default
          }
        }

        // Compute dynamic coherence with phi-harmonic oscillation
        const uptime = process.uptime();
        const dynamic = coherenceScore + (Math.sin(uptime * PSI) * 0.05);
        const bounded = Math.max(0, Math.min(1, dynamic));

        let classification;
        if (bounded >= CSL.CRITICAL) classification = 'CRITICAL';
        else if (bounded >= CSL.HIGH) classification = 'HIGH';
        else if (bounded >= CSL.MEDIUM) classification = 'MEDIUM';
        else if (bounded >= CSL.LOW) classification = 'LOW';
        else if (bounded >= CSL.MINIMUM) classification = 'MINIMUM';
        else classification = 'BELOW_MINIMUM';

        const output = {
          component,
          coherenceScore: Math.round(bounded * 1000) / 1000,
          classification,
          thresholds: CSL,
          phi: PHI,
          psi: PSI,
        };

        log.info({ component, coherenceScore: output.coherenceScore, classification }, 'get_coherence completed');

        return {
          content: [{
            type: 'text',
            text: `Component "${component}" coherence: ${output.coherenceScore} (${classification})`
          }],
          structuredContent: output,
        };
      } catch (err) {
        log.error({ err: err.message }, 'get_coherence failed');
        return {
          content: [{ type: 'text', text: `Coherence check error: ${err.message}` }],
          isError: true,
        };
      } finally {
        span?.end?.();
      }
    }
  );

  return server;
}

// ─── Express App ─────────────────────────────────────────────────────────────
const app = express();

// Sentry request handler
if (Sentry?.setupExpressErrorHandler) {
  // v8 Sentry uses setupExpressErrorHandler at the end; requestHandler in v9 is automatic via integration
}

app.use(express.json());

// CORS
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id, Last-Event-Id, Mcp-Protocol-Version');
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id, Mcp-Protocol-Version');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// ─── Session Transport Management ────────────────────────────────────────────
const transports = {};

// ─── POST /mcp — Client Messages (Initialize + JSON-RPC) ────────────────────
app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];

  try {
    let transport;

    if (sessionId && transports[sessionId]) {
      // Reuse existing transport for established session
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request — create transport and server
      const eventStore = new InMemoryEventStore();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        eventStore,
        onsessioninitialized: (sid) => {
          log.info({ sessionId: sid }, 'MCP session initialized');
          transports[sid] = transport;
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          log.info({ sessionId: sid }, 'MCP session closed');
          delete transports[sid];
        }
      };

      // Create and connect a fresh MCP server instance
      const mcpServer = createHeadyMcpServer();
      await mcpServer.connect(transport);

      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      // No valid session, not an init request
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
      return;
    }

    // Handle request with existing transport
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    log.error({ err: err.message, sessionId }, 'POST /mcp error');
    Sentry?.captureException?.(err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

// ─── GET /mcp — SSE Stream for Server-Initiated Notifications ────────────────
app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];

  if (!sessionId || !transports[sessionId]) {
    res.status(400).json({ error: 'Invalid or missing Mcp-Session-Id' });
    return;
  }

  const lastEventId = req.headers['last-event-id'];
  if (lastEventId) {
    log.info({ sessionId, lastEventId }, 'Client reconnecting for SSE resumption');
  }

  try {
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  } catch (err) {
    log.error({ err: err.message, sessionId }, 'GET /mcp SSE error');
    Sentry?.captureException?.(err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'SSE stream error' });
    }
  }
});

// ─── DELETE /mcp — Session Teardown ──────────────────────────────────────────
app.delete('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];

  if (!sessionId || !transports[sessionId]) {
    res.status(400).json({ error: 'Invalid or missing Mcp-Session-Id' });
    return;
  }

  log.info({ sessionId }, 'Session termination requested');

  try {
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  } catch (err) {
    log.error({ err: err.message, sessionId }, 'DELETE /mcp error');
    Sentry?.captureException?.(err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Session termination error' });
    }
  }
});

// ─── GET /health — Health Endpoint with Coherence Scoring ────────────────────
app.get('/health', (_req, res) => {
  const uptime = process.uptime();
  const coherenceScore = PSI + (Math.sin(uptime * PSI) * 0.1);
  const bounded = Math.max(0, Math.min(1, coherenceScore));

  let classification;
  if (bounded >= CSL.CRITICAL) classification = 'CRITICAL';
  else if (bounded >= CSL.HIGH) classification = 'HIGH';
  else if (bounded >= CSL.MEDIUM) classification = 'MEDIUM';
  else if (bounded >= CSL.LOW) classification = 'LOW';
  else if (bounded >= CSL.MINIMUM) classification = 'MINIMUM';
  else classification = 'BELOW_MINIMUM';

  res.json({
    status: 'healthy',
    service: 'heady-mcp-server',
    version: '2.0.0',
    transport: 'streamable-http-2025-11-25',
    layer: 'Protocol',
    uptime: Math.round(uptime),
    coherenceScore: Math.round(bounded * 1000) / 1000,
    classification,
    phi: PHI,
    psi: PSI,
    cslThresholds: CSL,
    activeSessions: Object.keys(transports).length,
    dependencies: {
      postgres: dbReady ? 'connected' : 'degraded',
      huggingface: HF_TOKENS.length > 0 ? `configured (${HF_TOKENS.length} tokens)` : 'not_configured',
      sentry: !!process.env.SENTRY_DSN ? 'configured' : 'not_configured',
    },
    tools: ['search_memory', 'store_memory', 'chat', 'list_services', 'get_coherence'],
    embeddingDim: EMBEDDING_DIM,
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    service: 'heady-mcp-server',
    hint: 'MCP endpoint is at /mcp, health at /health',
  });
});

// ─── Error Handler ───────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  log.error({ err: err.message, stack: err.stack, path: req.path }, 'Unhandled error');
  Sentry?.captureException?.(err);
  res.status(500).json({
    error: 'Internal Server Error',
    service: 'heady-mcp-server',
  });
});

// Sentry error handler (must be after all routes, before custom error handler — Express 5 compatible)
if (Sentry?.setupExpressErrorHandler) {
  Sentry.setupExpressErrorHandler(app);
}

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
let isShuttingDown = false;
let server = null;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log.info({ signal }, 'Graceful shutdown initiated');

  // Cloud Run gives 10s for graceful shutdown
  const shutdownTimeout = setTimeout(() => {
    log.warn('Shutdown timeout reached — forcing exit');
    process.exit(1);
  }, 10000);

  // Close all active MCP transports
  const sessionIds = Object.keys(transports);
  log.info({ sessionCount: sessionIds.length }, 'Closing active MCP sessions');

  await Promise.allSettled(
    sessionIds.map(async (sid) => {
      try {
        await transports[sid].close();
        delete transports[sid];
      } catch (err) {
        log.error({ err: err.message, sessionId: sid }, 'Error closing transport');
      }
    })
  );

  // Close HTTP server
  if (server) {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  }

  // Flush Sentry
  if (Sentry?.flush) {
    await Sentry.flush(2000).catch(() => {});
  }

  clearTimeout(shutdownTimeout);
  log.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ─── Startup ─────────────────────────────────────────────────────────────────
async function start() {
  log.info({ port: PORT, env: NODE_ENV, phi: PHI, psi: PSI }, 'Starting Heady MCP Server');

  await initDatabase();

  server = app.listen(PORT, '0.0.0.0', () => {
    log.info(
      {
        port: PORT,
        transport: 'streamable-http-2025-11-25',
        postgres: dbReady,
        hfTokens: HF_TOKENS.length,
        sentry: !!process.env.SENTRY_DSN,
        tools: ['search_memory', 'store_memory', 'chat', 'list_services', 'get_coherence'],
      },
      `Heady MCP Server listening on port ${PORT}`
    );
  });
}

start().catch((err) => {
  log.fatal({ err: err.message }, 'Fatal startup error');
  Sentry?.captureException?.(err);
  process.exit(1);
});
