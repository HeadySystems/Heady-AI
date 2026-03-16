# Heady™ MCP Server + Tool Registry + Transport Layer Optimization

## Foundation
All changes are based on the HeadyMe repos and Heady project data. The actual source code for every referenced file is provided below.

## Objective
Optimize and unify the MCP (Model Context Protocol) server stack. Currently there are multiple MCP-related files with overlapping responsibilities. Consolidate into a clean architecture with CSL-gated tool execution, phi-scaled priority routing, and deterministic transport.

## Specific Deliverables — Build ALL Files

### 1. Unified MCP Server
- Consolidate `heady-mcp-server.js`, `mcp-server.js`, `mcp-router.js` into a single coherent server
- CSL confidence gate on every tool invocation — only execute when confidence > φ⁻¹
- Tool registry with capability-based discovery and phi-weighted scoring
- SSE transport with deterministic message ordering

### 2. Tool Registry Enhancement
- `mcp-tools.js` + `heady-mcp-tools.js` → unified tool registry
- Each tool: schema validation, CSL confidence requirement, execution priority
- Tool chaining: phi-scaled dependency resolution
- Auto-discovery of new tools via `connector-discovery.js`

### 3. Transport Layer
- `mcp-sse-transport.js` → deterministic SSE with sequence numbers
- `mcp-transport.js` → JSON-RPC 2.0 with CSL gate on each request
- Circuit breaker integration via `mcp-breaker.js`
- Auth middleware with CSL-validated tokens

### 4. Service Registry
- `mcp-service-registry.js` → CSL health scoring per service
- Auto-deregister when service health drops below φ⁻²
- Phi-weighted load balancing across services

### 5. Test Suite
- Tool registration and discovery
- CSL-gated tool execution
- SSE transport ordering
- Circuit breaker behavior
- Service registry health scoring

## Constraints
- All constants from φ = 1.6180339887
- JSON-RPC 2.0 protocol compliance
- Node.js: crypto, events, http modules
- Temperature=0, seed=42 for deterministic tool outputs

---

## SOURCE FILES — COMPLETE HEADY CODEBASE CONTEXT


### `src/mcp/heady-mcp-server.js`

```javascript
#!/usr/bin/env node
// Heady MCP Server — Entry Point
// Serves all 42 skills as MCP-compatible tools via stdio/SSE transport
// Generated: March 7, 2026

const { generateMCPManifest, getService, getAllServices } = require('./mcp-service-registry');

const PHI = 1.618033988749895;

/**
 * MCP Server Handler
 * Implements JSON-RPC 2.0 over stdio for MCP tool execution
 */
class HeadyMCPServer {
  constructor() {
    this.manifest = generateMCPManifest();
    this.requestId = 0;
    this.startTime = Date.now();
  }

  /**
   * Handle incoming MCP request
   */
  async handleRequest(request) {
    const { method, params, id } = request;

    switch (method) {
      case 'initialize':
        return this.handleInitialize(id);
      case 'tools/list':
        return this.handleToolsList(id);
      case 'tools/call':
        return this.handleToolCall(params, id);
      case 'ping':
        return this.jsonRpcResponse(id, { status: 'ok', uptime: Date.now() - this.startTime });
      default:
        return this.jsonRpcError(id, -32601, `Method not found: ${method}`);
    }
  }

  handleInitialize(id) {
    return this.jsonRpcResponse(id, {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: { listChanged: false },
      },
      serverInfo: {
        name: this.manifest.name,
        version: this.manifest.version,
        description: this.manifest.description,
        totalServices: this.manifest.total_services,
        categories: this.manifest.categories,
      },
    });
  }

  handleToolsList(id) {
    return this.jsonRpcResponse(id, {
      tools: this.manifest.tools,
    });
  }

  async handleToolCall(params, id) {
    const { name, arguments: args } = params;
    const service = getService(name);

    if (!service) {
      return this.jsonRpcError(id, -32602, `Unknown tool: ${name}`);
    }

    try {
      // Route to skill handler
      const result = await this.executeSkill(service, args);
      return this.jsonRpcResponse(id, {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      });
    } catch (error) {
      return this.jsonRpcError(id, -32000, error.message);
    }
  }

  /**
   * Execute a skill with the given arguments
   * Routes to the appropriate skill handler based on category
   */
  async executeSkill(service, args) {
    const skillPath = `../../.agents/skills/${service.tool.replace(/_/g, '-')}/SKILL.md`;

    return {
      tool: service.tool,
      status: 'executed',
      category: service.category,
      priority: service.priority,
      phiTier: Math.log(service.priority) / Math.log(PHI),
      input: args,
      timestamp: new Date().toISOString(),
      execution: {
        skillPath,
        latency: `${Math.round(Math.random() * 100 * PHI)}ms`,
      },
    };
  }

  jsonRpcResponse(id, result) {
    return { jsonrpc: '2.0', id, result };
  }

  jsonRpcError(id, code, message) {
    return { jsonrpc: '2.0', id, error: { code, message } };
  }
}

// ═══════════════════════════════════════════════════════════
// STDIO TRANSPORT
// ═══════════════════════════════════════════════════════════

if (require.main === module) {
  const server = new HeadyMCPServer();
  let buffer = '';

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', async (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const request = JSON.parse(line);
        const response = await server.handleRequest(request);
        process.stdout.write(JSON.stringify(response) + '\n');
      } catch (e) {
        const errorResponse = server.jsonRpcError(null, -32700, 'Parse error');
        process.stdout.write(JSON.stringify(errorResponse) + '\n');
      }
    }
  });

  process.stderr.write(`Heady MCP Server v${server.manifest.version} started — ${server.manifest.total_services} tools available\n`);
}

module.exports = { HeadyMCPServer };
```

---

### `src/mcp/heady-mcp-tools.js`

```javascript
/**
 * HeadyMCP Tools — Exported tool definitions for reuse across transports.
 * These match the 40+ tools defined in heady-mcp-server.js.
 */
'use strict';

const HEADY_TOOLS = [
  { name: 'heady_deep_scan', description: 'Deep project scanning: maps files, extracts structure, generates embeddings.', inputSchema: { type: 'object', properties: { directory: { type: 'string', description: 'Directory to scan' }, maxDepth: { type: 'integer', default: 10 } }, required: ['directory'] } },
  { name: 'heady_memory', description: 'Search HeadyMemory (3D vector space) for persistent facts.', inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'integer', default: 5 }, minScore: { type: 'number', default: 0.6 } }, required: ['query'] } },
  { name: 'heady_embed', description: 'Generate vector embeddings via Heady embedding service.', inputSchema: { type: 'object', properties: { text: { type: 'string' }, model: { type: 'string', default: 'nomic-embed-text' } }, required: ['text'] } },
  { name: 'heady_soul', description: 'HeadySoul — awareness layer: values arbiter, coherence guardian, mission alignment.', inputSchema: { type: 'object', properties: { content: { type: 'string' }, action: { type: 'string', enum: ['analyze', 'optimize', 'learn'], default: 'analyze' } }, required: ['content'] } },
  { name: 'heady_vinci', description: 'HeadyVinci — session planner: topology maintainer, multi-step reasoning.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['learn', 'predict', 'recognize', 'plan'], default: 'predict' }, data: { type: 'string' } }, required: ['data'] } },
  { name: 'heady_analyze', description: 'Unified Heady analysis — code, research, architecture, security, performance.', inputSchema: { type: 'object', properties: { content: { type: 'string' }, type: { type: 'string', enum: ['code', 'text', 'security', 'performance', 'architecture', 'general', 'deep-scan', 'research', 'academic', 'news'], default: 'general' }, language: { type: 'string' }, focus: { type: 'string' } }, required: ['content'] } },
  { name: 'heady_risks', description: 'Risk assessment, vulnerability scanning, mitigation plans.', inputSchema: { type: 'object', properties: { content: { type: 'string' }, action: { type: 'string', enum: ['assess', 'mitigate', 'scan'], default: 'assess' }, scope: { type: 'string', default: 'all' } }, required: ['content'] } },
  { name: 'heady_coder', description: 'Code generation and multi-assistant workflows via HeadyCoder.', inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, action: { type: 'string', enum: ['generate', 'orchestrate', 'scaffold'], default: 'generate' }, language: { type: 'string' }, framework: { type: 'string' } }, required: ['prompt'] } },
  { name: 'heady_deploy', description: 'Trigger deployment/service action via Heady Manager.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['deploy', 'restart', 'status', 'logs', 'scale'] }, service: { type: 'string' }, config: { type: 'object' } }, required: ['action'] } },
  { name: 'heady_health', description: 'Check health/status of all Heady services.', inputSchema: { type: 'object', properties: { service: { type: 'string', enum: ['all', 'brain', 'manager', 'hcfp', 'mcp'], default: 'all' } } } },
  { name: 'heady_auto_flow', description: 'Combined auto-flow: HeadyBattle + HeadyCoder + HeadyAnalyze + HeadyRisks + HeadyPatterns via HCFP.', inputSchema: { type: 'object', properties: { task: { type: 'string' }, code: { type: 'string' }, context: { type: 'string' } }, required: ['task'] } },
  { name: 'heady_battle', description: 'HeadyBattle Arena — AI node competition, evaluation, leaderboard.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['session', 'evaluate', 'arena', 'leaderboard', 'compare'] }, task: { type: 'string' }, code: { type: 'string' }, nodes: { type: 'array', items: { type: 'string' } } }, required: ['action'] } },
  { name: 'heady_hcfp_status', description: 'HCFP auto-success engine status and metrics.', inputSchema: { type: 'object', properties: { detail: { type: 'string', enum: ['status', 'metrics', 'health'], default: 'status' } } } },
  { name: 'heady_buddy', description: 'HeadyBuddy — multi-provider personal AI assistant.', inputSchema: { type: 'object', properties: { message: { type: 'string' }, action: { type: 'string', enum: ['chat', 'memory', 'skills', 'tasks', 'providers'], default: 'chat' }, provider: { type: 'string', default: 'auto' } }, required: ['message'] } },
  { name: 'heady_chat', description: 'Chat with Heady Brain.', inputSchema: { type: 'object', properties: { message: { type: 'string' }, system: { type: 'string' }, model: { type: 'string', default: 'heady-brain' }, temperature: { type: 'number', default: 0.7 }, max_tokens: { type: 'integer', default: 4096 } }, required: ['message'] } },
  { name: 'heady_complete', description: 'Code/text completion via Heady Brain.', inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, language: { type: 'string' }, max_tokens: { type: 'integer', default: 2048 } }, required: ['prompt'] } },
  { name: 'heady_search', description: 'Search Heady knowledge base and service catalog.', inputSchema: { type: 'object', properties: { query: { type: 'string' }, scope: { type: 'string', enum: ['all', 'registry', 'docs', 'services', 'knowledge'], default: 'all' }, limit: { type: 'integer', default: 10 } }, required: ['query'] } },
  { name: 'heady_refactor', description: 'Code refactoring suggestions from Heady Brain.', inputSchema: { type: 'object', properties: { code: { type: 'string' }, language: { type: 'string' }, goals: { type: 'array', items: { type: 'string' } } }, required: ['code'] } },
  { name: 'heady_patterns', description: 'Design pattern detection and deep code analysis.', inputSchema: { type: 'object', properties: { code: { type: 'string' }, action: { type: 'string', enum: ['analyze', 'library', 'suggest'], default: 'analyze' }, language: { type: 'string' } }, required: ['code'] } },
  { name: 'heady_claude', description: 'Advanced reasoning via Anthropic Claude.', inputSchema: { type: 'object', properties: { message: { type: 'string' }, action: { type: 'string', enum: ['chat', 'think', 'analyze'], default: 'chat' }, system: { type: 'string' }, thinkingBudget: { type: 'integer', default: 32768 } }, required: ['message'] } },
  { name: 'heady_openai', description: 'GPT integration with function calling.', inputSchema: { type: 'object', properties: { message: { type: 'string' }, action: { type: 'string', enum: ['chat', 'complete'], default: 'chat' }, model: { type: 'string', default: 'gpt-4o' } }, required: ['message'] } },
  { name: 'heady_gemini', description: 'Multimodal AI via Google Gemini.', inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, action: { type: 'string', enum: ['generate', 'analyze'], default: 'generate' } }, required: ['prompt'] } },
  { name: 'heady_groq', description: 'Ultra-fast inference via Groq.', inputSchema: { type: 'object', properties: { message: { type: 'string' }, action: { type: 'string', enum: ['chat', 'complete'], default: 'chat' } }, required: ['message'] } },
  { name: 'heady_ops', description: 'DevOps automation.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['deploy', 'infrastructure', 'monitor', 'scale'] }, service: { type: 'string' }, config: { type: 'object' } }, required: ['action'] } },
  { name: 'heady_edge_ai', description: 'Cloudflare edge AI — embeddings, chat, classification, vector search.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['embed', 'chat', 'classify', 'vectorize-insert', 'vectorize-query', 'queue'] }, text: { type: 'string' }, message: { type: 'string' }, model: { type: 'string' }, topK: { type: 'number' } }, required: ['action'] } },
  { name: 'heady_vector_store', description: 'Store a vector embedding in 3D GPU vector space.', inputSchema: { type: 'object', properties: { embedding: { type: 'array', items: { type: 'number' } }, metadata: { type: 'object' } }, required: ['embedding'] } },
  { name: 'heady_vector_search', description: 'Search the 3D GPU vector space for similar vectors.', inputSchema: { type: 'object', properties: { embedding: { type: 'array', items: { type: 'number' } }, topK: { type: 'integer', default: 5 } }, required: ['embedding'] } },
  { name: 'heady_vector_stats', description: 'Get 3D vector space statistics.', inputSchema: { type: 'object', properties: {} } },
  { name: 'heady_learn', description: 'Store a learning in 3D vector memory.', inputSchema: { type: 'object', properties: { content: { type: 'string' }, category: { type: 'string', enum: ['directive', 'preference', 'interaction', 'decision', 'identity', 'pattern'], default: 'interaction' }, metadata: { type: 'object' } }, required: ['content'] } },
  { name: 'heady_recall', description: 'Search 3D vector memory for relevant past interactions.', inputSchema: { type: 'object', properties: { query: { type: 'string' }, topK: { type: 'integer', default: 5 } }, required: ['query'] } },
  { name: 'heady_memory_stats', description: 'Get continuous learning stats.', inputSchema: { type: 'object', properties: {} } },
  { name: 'heady_telemetry', description: 'Get comprehensive telemetry stats.', inputSchema: { type: 'object', properties: {} } },
  { name: 'heady_template_stats', description: 'Get template auto-generation stats.', inputSchema: { type: 'object', properties: {} } },
  { name: 'heady_orchestrator', description: 'HeadyOrchestrator — system orchestration and communication.', inputSchema: { type: 'object', properties: { message: { type: 'string' }, action: { type: 'string', enum: ['send', 'status', 'align'], default: 'send' }, target: { type: 'string' } }, required: ['message'] } },
  { name: 'heady_notebooklm', description: 'Sync Heady Knowledge Vault to NotebookLM.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['sync', 'status', 'health'], default: 'sync' } } } },
  { name: 'heady_jules_task', description: 'Dispatch async background coding task.', inputSchema: { type: 'object', properties: { task: { type: 'string' }, repository: { type: 'string' }, priority: { type: 'string', enum: ['low', 'normal', 'high', 'critical'], default: 'normal' }, autoCommit: { type: 'boolean', default: false } }, required: ['task', 'repository'] } },
  { name: 'heady_huggingface_model', description: 'Search/interact with HuggingFace models.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['search', 'info', 'inference'] }, modelId: { type: 'string' }, query: { type: 'string' } }, required: ['action'] } },
  { name: 'heady_maid', description: 'System cleanup and scheduling.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['clean', 'schedule', 'status'], default: 'status' }, target: { type: 'string' } }, required: ['action'] } },
  { name: 'heady_maintenance', description: 'Health monitoring, backups, updates.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['status', 'backup', 'update', 'restore'], default: 'status' }, service: { type: 'string' } }, required: ['action'] } },
  { name: 'heady_lens', description: 'Visual analysis and image processing.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['analyze', 'process', 'detect'], default: 'analyze' }, image_url: { type: 'string' }, prompt: { type: 'string' } }, required: ['action'] } },
];

module.exports = { HEADY_TOOLS };
```

---

### `src/mcp/mcp-router.js`

```javascript
'use strict';

/**
 * MCP Gateway Router — CONN-002 + CSL Integration
 * Intelligent routing for MCP tool requests with multi-tenant support,
 * auto-discovery, capability-based matching, and Continuous Semantic Logic gates.
 *
 * CSL gates used:
 *   - multi_resonance  → Score candidate servers against intent vector
 *   - route_gate       → Select best server with soft activation
 *   - soft_gate        → Continuous latency/health scoring (replaces hard cutoffs)
 *   - risk_gate        → Evaluate server health risk (stale/latency proximity)
 *   - ternary_gate     → Classify server state: resonant / ephemeral / repel
 *   - orthogonal_gate  → Strip blacklisted capability influence from intent
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');
const CSL = require('../core/semantic-logic');

// ── Helpers: deterministic pseudo-embeddings for tool/capability names ─────
// In production these come from the vector-memory system (384D embeddings).
// Here we use a deterministic hash → Float32Array so routing is reproducible.
const _vecCache = new Map();

function _textToVec(text, dim = 64) {
    if (_vecCache.has(text)) return _vecCache.get(text);
    const v = new Float32Array(dim);
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
    }
    for (let i = 0; i < dim; i++) {
        hash = ((hash << 5) + hash + i) >>> 0;
        v[i] = ((hash % 2000) - 1000) / 1000;
    }
    const result = CSL.normalize(v);
    _vecCache.set(text, result);
    return result;
}

class MCPRouter extends EventEmitter {
    constructor(config = {}) {
        super();
        this.servers = new Map();       // serverId → { name, url, capabilities, latency, lastSeen, vector }
        this.tenants = new Map();       // tenantId → { serverId[], permissions }
        this.routeCache = new Map();    // toolName → serverId (LRU-style)
        this.blacklist = [];            // capability vectors to reject
        this.cslConfig = {
            resonanceThreshold: config.resonanceThreshold || 0.3,
            riskSensitivity: config.riskSensitivity || 0.8,
            staleTimeoutMs: config.staleTimeoutMs || 300000,
            latencyLimitMs: config.latencyLimitMs || 5000,
            ...config,
        };
        this.metrics = { routed: 0, cached: 0, discovered: 0, errors: 0, cslRouted: 0 };
    }

    /**
     * Register an MCP server with its capabilities.
     * Builds a composite semantic vector from tools + capabilities for CSL routing.
     */
    registerServer(serverId, info) {
        // Build composite vector: superposition of all tool/capability vectors
        const toolVecs = (info.tools || []).map(t => _textToVec(t));
        const capVecs = (info.capabilities || []).map(c => _textToVec(c));
        const allVecs = [...toolVecs, ...capVecs];
        const vector = allVecs.length > 0
            ? CSL.consensus_superposition(allVecs)
            : _textToVec(serverId);

        this.servers.set(serverId, {
            name: info.name || serverId,
            url: info.url,
            capabilities: info.capabilities || [],
            tools: info.tools || [],
            latency: info.latency || 0,
            lastSeen: Date.now(),
            healthy: true,
            vector,
        });
        this.metrics.discovered++;
        logger.logSystem(`  🔌 [MCPRouter] Registered server: ${serverId} (${(info.tools || []).length} tools, vec:${vector.length}D)`);
        this.emit('server:registered', { serverId, info });
    }

    /**
     * Route a tool request to the best server using CSL multi-resonance scoring.
     *
     * Flow:
     *   1. Check route cache (LRU)
     *   2. Build intent vector from toolName (optionally strip blacklist via orthogonal_gate)
     *   3. Collect healthy server candidates
     *   4. Apply tenant filtering
     *   5. Score candidates with CSL.route_gate (multi_resonance + soft_gate)
     *   6. Apply latency risk via risk_gate — penalize high-latency servers
     *   7. Return best candidate with full CSL scores
     */
    route(toolName, tenantId = 'default') {
        // 1. Check cache
        if (this.routeCache.has(toolName)) {
            const cached = this.routeCache.get(toolName);
            const server = this.servers.get(cached);
            if (server && server.healthy) {
                this.metrics.cached++;
                return { serverId: cached, server, cached: true };
            }
            this.routeCache.delete(toolName);
        }

        // 2. Build intent vector
        let intentVec = _textToVec(toolName);

        // Strip blacklisted capability influence
        if (this.blacklist.length > 0) {
            intentVec = CSL.batch_orthogonal(intentVec, this.blacklist);
        }

        // 3. Collect healthy candidates with their vectors
        const candidates = [];
        for (const [id, server] of this.servers) {
            if (!server.healthy) continue;
            candidates.push({ id: id, vector: server.vector, server });
        }

        if (candidates.length === 0) {
            this.metrics.errors++;
            return { serverId: null, error: `No server found for tool: ${toolName}` };
        }

        // 4. Tenant filtering
        const tenant = this.tenants.get(tenantId);
        let filtered = candidates;
        if (tenant && tenant.allowedServers) {
            const tenantFiltered = candidates.filter(c => tenant.allowedServers.includes(c.id));
            if (tenantFiltered.length > 0) filtered = tenantFiltered;
        }

        // 5. CSL route_gate — multi-resonance with soft activation
        const routeResult = CSL.route_gate(
            intentVec,
            filtered,
            this.cslConfig.resonanceThreshold
        );

        // 6. Apply latency risk scoring to all candidates
        const scoredCandidates = routeResult.scores.map(s => {
            const cand = filtered.find(c => c.id === s.id);
            const risk = CSL.risk_gate(
                cand.server.latency,
                this.cslConfig.latencyLimitMs,
                this.cslConfig.riskSensitivity
            );
            // Composite: semantic resonance penalized by latency risk
            const composite = s.score * (1 - risk.riskLevel * 0.5);
            return { ...s, risk, composite: +composite.toFixed(6) };
        }).sort((a, b) => b.composite - a.composite);

        // 7. Select best
        const best = scoredCandidates[0];
        if (!best) {
            this.metrics.errors++;
            return { serverId: null, error: `CSL found no viable server for: ${toolName}`, scores: scoredCandidates };
        }

        const bestServer = filtered.find(c => c.id === best.id);
        this.routeCache.set(toolName, best.id);
        if (this.routeCache.size > 500) {
            const firstKey = this.routeCache.keys().next().value;
            this.routeCache.delete(firstKey);
        }

        this.metrics.routed++;
        this.metrics.cslRouted++;
        return {
            serverId: best.id,
            server: bestServer.server,
            cached: false,
            csl: {
                resonanceScore: best.score,
                activation: best.activation,
                latencyRisk: best.risk.riskLevel,
                composite: best.composite,
                fallback: routeResult.fallback,
                candidatesScored: scoredCandidates.length,
            },
        };
    }

    /**
     * Add a capability to the blacklist.
     * Its vector will be stripped from intent via orthogonal_gate during routing.
     */
    blacklistCapability(capability) {
        this.blacklist.push(_textToVec(capability));
    }

    /**
     * Register a tenant with allowed servers and permissions.
     */
    registerTenant(tenantId, config) {
        this.tenants.set(tenantId, {
            allowedServers: config.allowedServers || null,
            permissions: config.permissions || ['read', 'execute'],
        });
    }

    /**
     * Auto-discover servers from a list of endpoints.
     */
    async discover(endpoints = []) {
        for (const ep of endpoints) {
            try {
                const serverId = `auto-${ep.replace(/[^a-z0-9]/gi, '-')}`;
                this.registerServer(serverId, { name: serverId, url: ep, capabilities: ['*'], tools: [] });
            } catch (err) {
                logger.warn(`  ⚠ [MCPRouter] Discovery failed for ${ep}: ${err.message}`);
            }
        }
        return { discovered: endpoints.length };
    }

    /**
     * Health check all servers using CSL risk_gate for continuous evaluation.
     * Returns ternary classification per server: +1 (healthy), 0 (degraded), -1 (down).
     */
    healthCheck() {
        const results = [];
        for (const [id, server] of this.servers) {
            const staleness = Date.now() - server.lastSeen;
            const staleRisk = CSL.risk_gate(
                staleness,
                this.cslConfig.staleTimeoutMs,
                this.cslConfig.riskSensitivity
            );
            const latencyRisk = CSL.risk_gate(
                server.latency,
                this.cslConfig.latencyLimitMs,
                this.cslConfig.riskSensitivity
            );

            // Combined health: average of inverse risks
            const healthScore = 1 - (staleRisk.riskLevel + latencyRisk.riskLevel) / 2;
            const ternary = CSL.ternary_gate(healthScore, 0.7, 0.3);

            if (ternary.state === -1) server.healthy = false;
            else if (ternary.state === +1) server.healthy = true;
            // state === 0 → ephemeral, keep current status

            results.push({
                id, name: server.name,
                healthy: server.healthy,
                csl: {
                    healthScore: +healthScore.toFixed(4),
                    state: ternary.state,
                    staleRisk: staleRisk.riskLevel,
                    latencyRisk: latencyRisk.riskLevel,
                },
                lastSeen: server.lastSeen,
            });
        }
        return results;
    }

    getStatus() {
        return {
            ok: true,
            serverCount: this.servers.size,
            tenantCount: this.tenants.size,
            cacheSize: this.routeCache.size,
            metrics: { ...this.metrics },
            cslStats: CSL.getStats(),
            servers: [...this.servers.entries()].map(([id, s]) => ({
                id, name: s.name, tools: s.tools.length, healthy: s.healthy,
            })),
        };
    }

    registerRoutes(app) {
        app.get('/api/mcp/router/status', (req, res) => res.json(this.getStatus()));
        app.get('/api/mcp/router/health', (req, res) => res.json({ ok: true, servers: this.healthCheck() }));
        app.post('/api/mcp/router/route', (req, res) => {
            const { tool, tenant } = req.body || {};
            if (!tool) return res.status(400).json({ error: 'tool required' });
            res.json(this.route(tool, tenant));
        });
        logger.logSystem('  🔌 [MCPRouter] Routes: /api/mcp/router/status, /health, /route (CSL-gated)');
    }
}

let _router = null;
function getMCPRouter(config) {
    if (!_router) _router = new MCPRouter(config);
    return _router;
}

module.exports = { MCPRouter, getMCPRouter, _textToVec };
```

---

### `src/mcp/mcp-server.js`

```javascript
/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */
'use strict';

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} = require('@modelcontextprotocol/sdk/types.js');

const ToolRegistry = require('./tool-registry');

// ─── Tool Definitions ────────────────────────────────────────────────────────

const TOOL_DEFINITIONS = [
  {
    name: 'heady_memory',
    description: 'Search vector memory store using semantic similarity. Returns ranked results with scores.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Semantic search query' },
        limit: { type: 'integer', description: 'Max results to return', default: 10, minimum: 1, maximum: 100 },
        minScore: { type: 'number', description: 'Minimum similarity score (0-1)', default: 0.7, minimum: 0, maximum: 1 },
      },
      required: ['query'],
    },
  },
  {
    name: 'heady_embed',
    description: 'Generate vector embeddings for text using the specified model.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to embed' },
        model: {
          type: 'string',
          description: 'Embedding model to use',
          enum: ['text-embedding-3-small', 'text-embedding-3-large', 'heady-embed-v1'],
          default: 'text-embedding-3-small',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'heady_soul',
    description: 'Soul intelligence engine: analyze content for patterns, optimize reasoning, or train on new data.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Content to process' },
        action: {
          type: 'string',
          enum: ['analyze', 'optimize', 'learn'],
          description: 'Action to perform',
          default: 'analyze',
        },
      },
      required: ['content', 'action'],
    },
  },
  {
    name: 'heady_vinci',
    description: 'Pattern recognition engine: learn patterns, make predictions, or recognize structures in data.',
    inputSchema: {
      type: 'object',
      properties: {
        data: { type: ['string', 'object', 'array'], description: 'Input data for processing' },
        action: {
          type: 'string',
          enum: ['learn', 'predict', 'recognize'],
          description: 'Pattern operation to perform',
        },
        context: { type: 'object', description: 'Additional context for pattern matching', default: {} },
      },
      required: ['data', 'action'],
    },
  },
  {
    name: 'heady_conductor_route',
    description: 'Route a task through the HeadyConductor orchestration layer to the optimal node.',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'Task description or prompt to route' },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high', 'critical'],
          description: 'Task execution priority',
          default: 'normal',
        },
      },
      required: ['task'],
    },
  },
  {
    name: 'heady_pipeline_run',
    description: 'Execute the HCFullPipeline with the given task. Supports full-auto mode for autonomous execution.',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'Task or goal to run through the full pipeline' },
        fullAuto: {
          type: 'boolean',
          description: 'Enable full-auto autonomous mode',
          default: false,
        },
      },
      required: ['task'],
    },
  },
  {
    name: 'heady_battle',
    description: 'Run an Arena Battle evaluation between candidate solutions. Returns ranked results with scores.',
    inputSchema: {
      type: 'object',
      properties: {
        candidates: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of candidate solutions to evaluate',
          minItems: 2,
        },
        criteria: {
          type: 'array',
          items: { type: 'string' },
          description: 'Evaluation criteria for the battle',
          default: ['accuracy', 'quality', 'efficiency'],
        },
      },
      required: ['candidates'],
    },
  },
  {
    name: 'heady_health',
    description: 'Check health status of a specific service or all services.',
    inputSchema: {
      type: 'object',
      properties: {
        service: {
          type: 'string',
          description: 'Service name to check. Omit for global health check.',
        },
      },
    },
  },
  {
    name: 'heady_status',
    description: 'Get comprehensive system status including all nodes, services, and metrics.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'heady_nodes',
    description: 'List all active nodes in the Heady network with their current status and capabilities.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'heady_monte_carlo',
    description: 'Run Monte Carlo simulation for decision-making under uncertainty.',
    inputSchema: {
      type: 'object',
      properties: {
        scenario: { type: 'string', description: 'Scenario description to simulate' },
        iterations: {
          type: 'integer',
          description: 'Number of simulation iterations',
          default: 1000,
          minimum: 100,
          maximum: 100000,
        },
      },
      required: ['scenario'],
    },
  },
  {
    name: 'heady_deploy',
    description: 'Deploy a service or configuration to the target environment.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'Deployment target',
          enum: ['local', 'cloud-me', 'cloud-sys', 'cloud-conn', 'hybrid'],
        },
        config: { type: 'object', description: 'Deployment configuration object' },
      },
      required: ['target'],
    },
  },
  {
    name: 'heady_code_generate',
    description: 'Generate production-ready code from a natural language prompt.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Description of the code to generate' },
        language: {
          type: 'string',
          description: 'Target programming language',
          enum: ['javascript', 'typescript', 'python', 'go', 'rust', 'java', 'sql', 'bash'],
          default: 'javascript',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'heady_code_review',
    description: 'Review code for bugs, security issues, performance, and style improvements.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Source code to review' },
        context: { type: 'string', description: 'Additional context about the code (purpose, requirements)' },
      },
      required: ['code'],
    },
  },
  {
    name: 'heady_research',
    description: 'Conduct deep research on a topic using all available knowledge sources.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Research query or topic' },
        depth: {
          type: 'string',
          enum: ['shallow', 'standard', 'deep', 'exhaustive'],
          description: 'Research depth level',
          default: 'standard',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'heady_creative',
    description: 'Generate creative content: stories, marketing copy, ideas, designs, or artistic content.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Creative prompt or brief' },
        style: {
          type: 'string',
          description: 'Creative style or tone',
          enum: ['professional', 'casual', 'poetic', 'technical', 'storytelling', 'persuasive'],
          default: 'professional',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'heady_analyze',
    description: 'Analyze data, text, or structured information and return insights.',
    inputSchema: {
      type: 'object',
      properties: {
        data: { type: ['string', 'object', 'array'], description: 'Data to analyze' },
        type: {
          type: 'string',
          enum: ['sentiment', 'statistical', 'semantic', 'temporal', 'comparative', 'anomaly'],
          description: 'Type of analysis to perform',
          default: 'semantic',
        },
      },
      required: ['data'],
    },
  },
  {
    name: 'heady_patterns',
    description: 'Detect patterns, trends, and structures in data using HeadyVinci pattern engine.',
    inputSchema: {
      type: 'object',
      properties: {
        data: { type: ['string', 'object', 'array'], description: 'Data for pattern detection' },
      },
      required: ['data'],
    },
  },
  {
    name: 'heady_governance_check',
    description: 'Validate an action or decision against governance policies, safety rules, and ethical guidelines.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Action or decision to validate' },
        context: { type: 'object', description: 'Context including user, scope, and environment', default: {} },
      },
      required: ['action'],
    },
  },
  {
    name: 'heady_budget_status',
    description: 'Get current budget usage, limits, and remaining allocations for all cost categories.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'heady_bee_spawn',
    description: 'Spawn a Bee agent worker for a specific domain or task.',
    inputSchema: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'Domain or capability for the bee agent',
          enum: ['research', 'coding', 'analysis', 'creative', 'monitoring', 'automation'],
        },
        config: { type: 'object', description: 'Bee configuration and initial task assignment', default: {} },
      },
      required: ['domain'],
    },
  },
  {
    name: 'heady_bee_status',
    description: 'Check the status and progress of a spawned Bee agent.',
    inputSchema: {
      type: 'object',
      properties: {
        beeId: { type: 'string', description: 'Unique bee agent identifier' },
      },
      required: ['beeId'],
    },
  },
  {
    name: 'heady_drift_check',
    description: 'Check semantic drift for a component — detects when behavior deviates from baseline.',
    inputSchema: {
      type: 'object',
      properties: {
        componentId: {
          type: 'string',
          description: 'Component identifier to check for semantic drift',
        },
      },
      required: ['componentId'],
    },
  },
  {
    name: 'heady_coherence',
    description: 'Compute overall system coherence score across all nodes and services.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'heady_readiness',
    description: 'Evaluate operational readiness: all nodes healthy, thresholds met, dependencies resolved.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'heady_story',
    description: 'Log an event to the HeadyAutobiographer for narrative tracking and historical record.',
    inputSchema: {
      type: 'object',
      properties: {
        event: {
          type: 'string',
          description: 'Event type',
          enum: ['action_taken', 'decision_made', 'error_encountered', 'healing_performed', 'milestone_reached', 'learning_captured'],
        },
        context: { type: 'object', description: 'Event context and metadata', default: {} },
      },
      required: ['event'],
    },
  },
  {
    name: 'heady_corrections',
    description: 'Analyze behavior patterns and apply subtle corrections or improvements.',
    inputSchema: {
      type: 'object',
      properties: {
        behavior: { type: 'string', description: 'Behavior or pattern to correct/improve' },
        context: { type: 'object', description: 'Context for the behavioral correction', default: {} },
      },
      required: ['behavior'],
    },
  },
  {
    name: 'heady_lens',
    description: 'Generate AR overlay explanation for a target object, concept, or data point.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Object, concept, or data point to explain' },
        query: { type: 'string', description: 'Specific question or aspect to focus the lens on' },
      },
      required: ['target', 'query'],
    },
  },
  {
    name: 'heady_secrets',
    description: 'Interface for secret management: get, set, rotate, or list secrets.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['get', 'set', 'rotate', 'list', 'delete'],
          description: 'Secret management action',
        },
        key: { type: 'string', description: 'Secret key identifier' },
      },
      required: ['action'],
    },
  },
  {
    name: 'heady_config',
    description: 'Get or set configuration values for the Heady platform.',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Configuration key (dot-notation supported, e.g. conductor.timeout)' },
        value: { description: 'Value to set. Omit to get current value.' },
      },
      required: ['key'],
    },
  },
  {
    name: 'heady_audit',
    description: 'Query the audit trail for system events, actions, and decisions.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query for audit records' },
        limit: { type: 'integer', description: 'Max records to return', default: 50, minimum: 1, maximum: 500 },
      },
      required: ['query'],
    },
  },
];

// ─── HeadyMCPServer ───────────────────────────────────────────────────────────

class HeadyMCPServer {
  /**
   * @param {object} opts
   * @param {object} opts.conductor  - HeadyConductor instance (or compatible interface)
   * @param {object} [opts.logger]   - Pino/Winston-compatible logger
   */
  constructor({ conductor, logger } = {}) {
    this._conductor = conductor || null;
    this._log = logger || this._buildDefaultLogger();

    this._registry = new ToolRegistry({ logger: this._log });
    this._server = new Server(
      { name: 'heady-mcp', version: '3.1.0' },
      { capabilities: { tools: {} } }
    );

    this._registerAllTools();
    this._attachHandlers();
  }

  // ── Private: logger ──────────────────────────────────────────────────────

  _buildDefaultLogger() {
    return {
      info:  (...a) => console.error('[MCP:INFO]',  ...a),
      warn:  (...a) => console.error('[MCP:WARN]',  ...a),
      error: (...a) => console.error('[MCP:ERROR]', ...a),
      debug: (...a) => process.env.LOG_LEVEL === 'debug' && console.error('[MCP:DEBUG]', ...a),
    };
  }

  // ── Private: registration ────────────────────────────────────────────────

  _registerAllTools() {
    for (const def of TOOL_DEFINITIONS) {
      this._registry.register(def);
    }
    this._log.info(`Registered ${this._registry.list().length} MCP tools`);
  }

  // ── Private: handlers ────────────────────────────────────────────────────

  _attachHandlers() {
    this._server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: this._registry.list() };
    });

    this._server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      this._log.debug('Tool call', { name, args });

      try {
        const result = await this._dispatch(name, args || {});
        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        this._log.error('Tool execution error', { name, error: err.message });
        if (err instanceof McpError) throw err;
        throw new McpError(
          ErrorCode.InternalError,
          `Tool '${name}' execution failed: ${err.message}`
        );
      }
    });
  }

  // ── Private: dispatch ────────────────────────────────────────────────────

  /**
   * Dispatch a tool call through the conductor or direct handlers.
   * @param {string} name
   * @param {object} args
   * @returns {Promise<object>}
   */
  async _dispatch(name, args) {
    // Validate args against schema first
    const validation = this._registry.validate(name, args);
    if (!validation.valid) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid arguments for '${name}': ${validation.errors.join(', ')}`
      );
    }

    // Route through conductor if available
    if (this._conductor && typeof this._conductor.handleMCPTool === 'function') {
      return await this._conductor.handleMCPTool(name, args);
    }

    // Fallback: built-in handlers
    return await this._handleDirect(name, args);
  }

  /**
   * Direct handler when no conductor is attached (standalone / test mode).
   */
  async _handleDirect(name, args) {
    const ts = new Date().toISOString();

    switch (name) {
      case 'heady_status':
        return {
          status: 'operational',
          version: '3.1.0',
          timestamp: ts,
          mode: 'standalone',
          nodes: { total: 0, active: 0 },
          message: 'MCP server running in standalone mode — conductor not attached',
        };

      case 'heady_health':
        return {
          service: args.service || 'all',
          status: 'healthy',
          timestamp: ts,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
        };

      case 'heady_nodes':
        return {
          nodes: [],
          total: 0,
          timestamp: ts,
          message: 'No nodes registered — conductor not attached',
        };

      case 'heady_budget_status':
        return {
          timestamp: ts,
          budget: { total: 0, used: 0, remaining: 0 },
          message: 'Budget tracking requires conductor',
        };

      case 'heady_coherence':
        return { score: 0, timestamp: ts, message: 'Coherence requires live node data' };

      case 'heady_readiness':
        return {
          ready: true,
          timestamp: ts,
          checks: { mcp_server: 'pass', conductor: 'not_attached', memory: 'not_attached' },
        };

      default:
        return {
          tool: name,
          args,
          timestamp: ts,
          status: 'queued',
          message: `Tool '${name}' requires conductor — queued for when conductor attaches`,
        };
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Attach a conductor instance after construction.
   * @param {object} conductor
   */
  setConductor(conductor) {
    this._conductor = conductor;
    this._log.info('Conductor attached to MCP server');
  }

  /**
   * Start listening on stdio transport.
   * @returns {Promise<void>}
   */
  async start() {
    const transport = new StdioServerTransport();
    await this._server.connect(transport);
    this._log.info('HeadyMCPServer started on stdio transport (v3.1.0)');
  }

  /**
   * Gracefully shut down the server.
   * @returns {Promise<void>}
   */
  async stop() {
    try {
      await this._server.close();
      this._log.info('HeadyMCPServer stopped');
    } catch (err) {
      this._log.error('Error stopping MCP server', { error: err.message });
    }
  }
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

if (require.main === module) {
  const server = new HeadyMCPServer();

  process.on('SIGINT',  async () => { await server.stop(); process.exit(0); });
  process.on('SIGTERM', async () => { await server.stop(); process.exit(0); });

  server.start().catch((err) => {
    console.error('[HeadyMCP] Fatal startup error:', err);
    process.exit(1);
  });
}

module.exports = HeadyMCPServer;
```

---

### `src/mcp/mcp-service-registry.js`

```javascript
// MCP Service Registry — All 42 Heady Skills as MCP-Compatible Services
// Generated: March 7, 2026
// Each skill maps to an MCP tool endpoint with typed parameters

const PHI = 1.618033988749895;

/**
 * Heady MCP Service Registry
 * Maps all 42 skills to MCP service definitions with:
 * - tool name (MCP-compatible snake_case)
 * - description
 * - parameter schema
 * - priority tier (phi-scaled)
 * - category
 */
const MCP_SERVICES = {
    // ═══════════════════════════════════════════════════════════
    // TIER 1 — CRITICAL INFRASTRUCTURE (φ^0 priority)
    // ═══════════════════════════════════════════════════════════

    heady_deep_scan: {
        tool: 'heady_deep_scan',
        description: 'Project-wide context mapping via HeadyDeepScan — maps entire workspace into 3D vector memory',
        category: 'intelligence',
        priority: Math.pow(PHI, 0),
        parameters: {
            directory: { type: 'string', required: true, description: 'Root directory to scan' },
            depth: { type: 'number', default: 10, description: 'Max scan depth' },
        },
    },

    heady_auto_flow: {
        tool: 'heady_auto_flow',
        description: 'Full auto-success pipeline — chains Battle, Coder, Analyze, Risks, Patterns',
        category: 'orchestration',
        priority: Math.pow(PHI, 0),
        parameters: {
            task: { type: 'string', required: true, description: 'Task description' },
            code: { type: 'string', description: 'Initial code to process' },
            context: { type: 'string', description: 'Additional context' },
        },
    },

    heady_agent_orchestration: {
        tool: 'heady_agent_orchestration',
        description: 'Latent OS agent decomposition — planner-executor-validator structure with swarm coordination',
        category: 'orchestration',
        priority: Math.pow(PHI, 0),
        parameters: {
            objective: { type: 'string', required: true, description: 'High-level objective to decompose' },
            max_agents: { type: 'number', default: 17, description: 'Maximum parallel agents' },
            strategy: { type: 'string', enum: ['parallel', 'sequential', 'hybrid'], default: 'hybrid' },
        },
    },

    heady_csl_engine: {
        tool: 'heady_csl_engine',
        description: 'Continuous Semantic Logic engine — fuzzy gates, resonance, superposition, entanglement',
        category: 'intelligence',
        priority: Math.pow(PHI, 0),
        parameters: {
            input: { type: 'string', required: true, description: 'Input to evaluate through CSL gates' },
            gates: { type: 'array', description: 'Specific gates to apply', items: { type: 'string' } },
            threshold: { type: 'number', description: 'Phi-scaled activation threshold' },
        },
    },

    heady_memory_ops: {
        tool: 'heady_memory_ops',
        description: 'Persistent 3D vector memory — search, store, embed, learn via HeadyMemory',
        category: 'memory',
        priority: Math.pow(PHI, 0),
        parameters: {
            action: { type: 'string', required: true, enum: ['search', 'store', 'embed', 'recall', 'forget'] },
            query: { type: 'string', description: 'Search query or content to store' },
            namespace: { type: 'string', default: 'default', description: 'Memory namespace' },
        },
    },

    // ═══════════════════════════════════════════════════════════
    // TIER 2 — CORE CAPABILITIES (φ^0.25 priority)
    // ═══════════════════════════════════════════════════════════

    heady_battle_arena: {
        tool: 'heady_battle_arena',
        description: 'Competitive AI evaluation — pit AI nodes against each other for best solution',
        category: 'intelligence',
        priority: Math.pow(PHI, 0.25),
        parameters: {
            challenge: { type: 'string', required: true, description: 'Challenge description' },
            contestants: { type: 'array', description: 'AI nodes to compete', items: { type: 'string' } },
            rounds: { type: 'number', default: 3 },
        },
    },

    heady_code_generation: {
        tool: 'heady_code_generation',
        description: 'Multi-model code generation, refactoring, and inline suggestions',
        category: 'development',
        priority: Math.pow(PHI, 0.25),
        parameters: {
            task: { type: 'string', required: true, description: 'Code generation task' },
            language: { type: 'string', default: 'javascript' },
            model: { type: 'string', description: 'Preferred model' },
        },
    },

    heady_security_audit: {
        tool: 'heady_security_audit',
        description: 'Comprehensive security auditing — vulnerability scanning, risk assessment, mitigation',
        category: 'security',
        priority: Math.pow(PHI, 0.25),
        parameters: {
            target: { type: 'string', required: true, description: 'File or directory to audit' },
            depth: { type: 'string', enum: ['quick', 'standard', 'deep'], default: 'standard' },
        },
    },

    heady_research: {
        tool: 'heady_research',
        description: 'Deep web research with citations via Perplexity Sonar Pro',
        category: 'intelligence',
        priority: Math.pow(PHI, 0.25),
        parameters: {
            query: { type: 'string', required: true, description: 'Research query' },
            depth: { type: 'string', enum: ['quick', 'deep', 'exhaustive'], default: 'deep' },
        },
    },

    heady_perplexity: {
        tool: 'heady_perplexity',
        description: 'Full Perplexity Enterprise Max — sonar search, deep research, reasoning, embeddings',
        category: 'intelligence',
        priority: Math.pow(PHI, 0.25),
        parameters: {
            query: { type: 'string', required: true },
            model: { type: 'string', enum: ['sonar', 'sonar-pro', 'sonar-deep-research', 'sonar-reasoning-pro'] },
        },
    },

    heady_gateway_routing: {
        tool: 'heady_gateway_routing',
        description: 'Multi-provider AI routing — choose models based on workload, optimize caching',
        category: 'infrastructure',
        priority: Math.pow(PHI, 0.25),
        parameters: {
            request: { type: 'object', required: true, description: 'AI request to route' },
            strategy: { type: 'string', enum: ['fastest', 'cheapest', 'best', 'round-robin'] },
        },
    },

    heady_liquid_gateway: {
        tool: 'heady_liquid_gateway',
        description: 'Dynamic liquid architecture for AI routing — provider racing, MCP transport, BYOK',
        category: 'infrastructure',
        priority: Math.pow(PHI, 0.25),
        parameters: {
            action: { type: 'string', required: true, enum: ['route', 'race', 'stream', 'health'] },
            payload: { type: 'object', description: 'Request payload' },
        },
    },

    heady_reliability_orchestrator: {
        tool: 'heady_reliability_orchestrator',
        description: 'Self-healing, health checks, drift detection, quarantine and respawn',
        category: 'infrastructure',
        priority: Math.pow(PHI, 0.25),
        parameters: {
            action: { type: 'string', required: true, enum: ['health', 'quarantine', 'respawn', 'drift-check'] },
            target: { type: 'string', description: 'Service or component to check' },
        },
    },

    // ═══════════════════════════════════════════════════════════
    // TIER 3 — EXTENDED CAPABILITIES (φ^0.5 priority)
    // ═══════════════════════════════════════════════════════════

    heady_agent_factory: {
        tool: 'heady_agent_factory',
        description: 'Decompose objectives into specialized sub-agents with clear responsibilities',
        category: 'orchestration',
        priority: Math.pow(PHI, 0.5),
        parameters: {
            objective: { type: 'string', required: true },
            constraints: { type: 'object', description: 'Resource and time constraints' },
        },
    },

    heady_task_decomposition: {
        tool: 'heady_task_decomposition',
        description: 'Break complex tasks into executable sub-tasks with dependency graphs',
        category: 'orchestration',
        priority: Math.pow(PHI, 0.5),
        parameters: {
            task: { type: 'string', required: true },
            max_depth: { type: 'number', default: 5 },
        },
    },

    heady_semantic_backpressure: {
        tool: 'heady_semantic_backpressure',
        description: 'Semantic flow control — prevent agent overload through backpressure signals',
        category: 'orchestration',
        priority: Math.pow(PHI, 0.5),
        parameters: {
            queue_depth: { type: 'number', description: 'Current queue depth' },
            action: { type: 'string', enum: ['check', 'throttle', 'release'] },
        },
    },

    heady_context_window_manager: {
        tool: 'heady_context_window_manager',
        description: 'Intelligent context window management — compress, prioritize, evict context',
        category: 'memory',
        priority: Math.pow(PHI, 0.5),
        parameters: {
            action: { type: 'string', required: true, enum: ['compress', 'summarize', 'evict', 'status'] },
            tokens: { type: 'number', description: 'Target token budget' },
        },
    },

    heady_embedding_router: {
        tool: 'heady_embedding_router',
        description: 'Route embedding requests to optimal model based on input type and requirements',
        category: 'intelligence',
        priority: Math.pow(PHI, 0.5),
        parameters: {
            text: { type: 'string', required: true },
            model: { type: 'string', description: 'Specific embedding model' },
            dimensions: { type: 'number', default: 1536 },
        },
    },

    heady_graph_rag_memory: {
        tool: 'heady_graph_rag_memory',
        description: 'Graph-based RAG with knowledge graph traversal and entity linking',
        category: 'memory',
        priority: Math.pow(PHI, 0.5),
        parameters: {
            query: { type: 'string', required: true },
            depth: { type: 'number', default: 3, description: 'Graph traversal depth' },
        },
    },

    heady_hybrid_vector_search: {
        tool: 'heady_hybrid_vector_search',
        description: 'Hybrid search combining dense vectors, sparse BM25, and graph traversal',
        category: 'memory',
        priority: Math.pow(PHI, 0.5),
        parameters: {
            query: { type: 'string', required: true },
            k: { type: 'number', default: 10, description: 'Number of results' },
            alpha: { type: 'number', default: 0.618, description: 'Dense/sparse blend (phi-scaled)' },
        },
    },

    heady_vsa_hyperdimensional: {
        tool: 'heady_vsa_hyperdimensional',
        description: 'Vector-symbolic architecture — bind, bundle, permute, similarity for state logic',
        category: 'intelligence',
        priority: Math.pow(PHI, 0.5),
        parameters: {
            operation: { type: 'string', required: true, enum: ['bind', 'bundle', 'permute', 'similarity', 'encode'] },
            vectors: { type: 'array', items: { type: 'string' } },
        },
    },

    heady_phi_math_foundation: {
        tool: 'heady_phi_math_foundation',
        description: 'Phi mathematics foundation — golden ratio scaling, Fibonacci sequences, sacred geometry',
        category: 'intelligence',
        priority: Math.pow(PHI, 0.5),
        parameters: {
            operation: { type: 'string', required: true, enum: ['scale', 'fibonacci', 'golden-spiral', 'threshold'] },
            value: { type: 'number', required: true },
            exponent: { type: 'number', default: 1 },
        },
    },

    heady_deployment: {
        tool: 'heady_deployment',
        description: 'Deploy, monitor, scale, and maintain services via HeadyDeploy and HeadyOps',
        category: 'infrastructure',
        priority: Math.pow(PHI, 0.5),
        parameters: {
            action: { type: 'string', required: true, enum: ['deploy', 'rollback', 'scale', 'health', 'logs'] },
            service: { type: 'string', required: true },
            environment: { type: 'string', default: 'production' },
        },
    },

    heady_edge_ai: {
        tool: 'heady_edge_ai',
        description: 'Ultra-low latency AI inference on Cloudflare edge — embeddings, chat, classification',
        category: 'infrastructure',
        priority: Math.pow(PHI, 0.5),
        parameters: {
            task: { type: 'string', required: true, enum: ['embed', 'chat', 'classify', 'vectorize'] },
            input: { type: 'string', required: true },
            region: { type: 'string', description: 'Edge region preference' },
        },
    },

    heady_self_healing_lifecycle: {
        tool: 'heady_self_healing_lifecycle',
        description: 'Detect failures, quarantine, attest, respawn, and prevent repeated breakdowns',
        category: 'infrastructure',
        priority: Math.pow(PHI, 0.5),
        parameters: {
            action: { type: 'string', required: true, enum: ['detect', 'quarantine', 'attest', 'respawn', 'status'] },
            component: { type: 'string', description: 'Target component' },
        },
    },

    heady_multi_model: {
        tool: 'heady_multi_model',
        description: 'Cross-provider AI routing — Claude, GPT-4o, Gemini, Groq through unified interface',
        category: 'intelligence',
        priority: Math.pow(PHI, 0.5),
        parameters: {
            prompt: { type: 'string', required: true },
            model: { type: 'string', description: 'Specific model or "best"' },
            provider: { type: 'string', enum: ['anthropic', 'openai', 'google', 'groq', 'auto'] },
        },
    },

    // ═══════════════════════════════════════════════════════════
    // TIER 4 — SPECIALIZED SERVICES (φ^1 priority)
    // ═══════════════════════════════════════════════════════════

    heady_auth_provider_federation: {
        tool: 'heady_auth_provider_federation',
        description: 'OAuth provider federation — auto-wired routes, frontend buttons, profile extraction',
        category: 'identity',
        priority: Math.pow(PHI, 1),
        parameters: {
            action: { type: 'string', required: true, enum: ['register', 'list', 'validate', 'generate'] },
            provider: { type: 'string', description: 'OAuth provider name' },
        },
    },

    heady_sovereign_identity_byok: {
        tool: 'heady_sovereign_identity_byok',
        description: 'User-controlled identity and bring-your-own-key model access',
        category: 'identity',
        priority: Math.pow(PHI, 1),
        parameters: {
            action: { type: 'string', required: true, enum: ['register-key', 'validate', 'rotate', 'revoke'] },
            key_type: { type: 'string', description: 'Type of key (api, oauth, signing)' },
        },
    },

    heady_companion_memory: {
        tool: 'heady_companion_memory',
        description: 'Persistent assistant with long-term memory, preference learning, anticipatory suggestions',
        category: 'memory',
        priority: Math.pow(PHI, 1),
        parameters: {
            action: { type: 'string', required: true, enum: ['learn', 'recall', 'suggest', 'preferences'] },
            context: { type: 'string', description: 'Current interaction context' },
        },
    },

    heady_memory_knowledge_os: {
        tool: 'heady_memory_knowledge_os',
        description: 'Latent OS memory + knowledge layer — persistent memory, repo-to-docs, briefing packs',
        category: 'memory',
        priority: Math.pow(PHI, 1),
        parameters: {
            action: { type: 'string', required: true, enum: ['ingest', 'brief', 'export', 'status'] },
            source: { type: 'string', description: 'Source path or URL' },
        },
    },

    heady_knowledge_ingestion: {
        tool: 'heady_knowledge_ingestion',
        description: 'Turn repos, notes, and materials into structured knowledge packs',
        category: 'memory',
        priority: Math.pow(PHI, 1),
        parameters: {
            source: { type: 'string', required: true, description: 'Source path or URL' },
            format: { type: 'string', enum: ['briefing', 'docs', 'knowledge-pack'], default: 'knowledge-pack' },
        },
    },

    heady_cross_device_sync: {
        tool: 'heady_cross_device_sync',
        description: 'Cross-device state sync, session handoff, shared context, presence tracking',
        category: 'infrastructure',
        priority: Math.pow(PHI, 1),
        parameters: {
            action: { type: 'string', required: true, enum: ['sync', 'handoff', 'presence', 'broadcast'] },
            device_id: { type: 'string', description: 'Target device' },
        },
    },

    heady_mcp_gateway_zero_trust: {
        tool: 'heady_mcp_gateway_zero_trust',
        description: 'MCP gateway with zero-trust security model and connection pooling',
        category: 'security',
        priority: Math.pow(PHI, 1),
        parameters: {
            action: { type: 'string', required: true, enum: ['validate', 'authorize', 'audit', 'block'] },
            request: { type: 'object', description: 'MCP request to validate' },
        },
    },

    heady_mcp_streaming_interface: {
        tool: 'heady_mcp_streaming_interface',
        description: 'MCP-compatible streaming interface — JSON-RPC, SSE transport, tool contracts',
        category: 'infrastructure',
        priority: Math.pow(PHI, 1),
        parameters: {
            action: { type: 'string', required: true, enum: ['stream', 'invoke', 'subscribe', 'health'] },
            method: { type: 'string', description: 'MCP method name' },
        },
    },

    heady_durable_agent_state: {
        tool: 'heady_durable_agent_state',
        description: 'Durable agent state management — persist, restore, checkpoint agent state',
        category: 'orchestration',
        priority: Math.pow(PHI, 1),
        parameters: {
            action: { type: 'string', required: true, enum: ['save', 'restore', 'checkpoint', 'list'] },
            agent_id: { type: 'string', description: 'Agent identifier' },
        },
    },

    heady_monetization_platform: {
        tool: 'heady_monetization_platform',
        description: 'Usage metering, feature gating, Stripe integration, revenue tracking',
        category: 'business',
        priority: Math.pow(PHI, 1),
        parameters: {
            action: { type: 'string', required: true, enum: ['meter', 'gate', 'billing', 'usage-report'] },
            customer_id: { type: 'string', description: 'Customer identifier' },
        },
    },

    heady_ide_control_plane: {
        tool: 'heady_ide_control_plane',
        description: 'IDE as control plane for latent OS — routing tools, models, memory through IDE',
        category: 'development',
        priority: Math.pow(PHI, 1),
        parameters: {
            action: { type: 'string', required: true, enum: ['route', 'configure', 'status', 'connect'] },
            target: { type: 'string', description: 'Target service or tool' },
        },
    },

    heady_ide_governed_codeflow: {
        tool: 'heady_ide_governed_codeflow',
        description: 'Governed code changes — validation, auto-correction, approval gates, rollback',
        category: 'development',
        priority: Math.pow(PHI, 1),
        parameters: {
            action: { type: 'string', required: true, enum: ['propose', 'validate', 'approve', 'rollback'] },
            diff: { type: 'string', description: 'Code diff to validate' },
        },
    },

    heady_domain_architecture: {
        tool: 'heady_domain_architecture',
        description: 'Domain routing, Cloudflare integration, OAuth callback normalization',
        category: 'infrastructure',
        priority: Math.pow(PHI, 1),
        parameters: {
            action: { type: 'string', required: true, enum: ['map', 'route', 'validate', 'audit'] },
            domain: { type: 'string', description: 'Domain to configure' },
        },
    },

    heady_drupal_headless: {
        tool: 'heady_drupal_headless',
        description: 'Headless Drupal operations — JSON:API, custom modules, endpoint verification',
        category: 'development',
        priority: Math.pow(PHI, 1),
        parameters: {
            action: { type: 'string', required: true, enum: ['query', 'create', 'update', 'verify'] },
            endpoint: { type: 'string', description: 'API endpoint' },
        },
    },

    heady_installable_package: {
        tool: 'heady_installable_package',
        description: 'Package, verify, and publish installable Heady surfaces',
        category: 'business',
        priority: Math.pow(PHI, 1),
        parameters: {
            action: { type: 'string', required: true, enum: ['package', 'verify', 'publish', 'list'] },
            target: { type: 'string', description: 'Package to build' },
        },
    },
};

// ═══════════════════════════════════════════════════════════
// SERVICE DISCOVERY & ROUTING
// ═══════════════════════════════════════════════════════════

/**
 * Get all services sorted by phi-priority (highest first)
 */
function getAllServices() {
    return Object.values(MCP_SERVICES).sort((a, b) => a.priority - b.priority);
}

/**
 * Get services by category
 */
function getServicesByCategory(category) {
    return Object.values(MCP_SERVICES)
        .filter(s => s.category === category)
        .sort((a, b) => a.priority - b.priority);
}

/**
 * Get service by tool name
 */
function getService(toolName) {
    return MCP_SERVICES[toolName] || null;
}

/**
 * Get all unique categories
 */
function getCategories() {
    return [...new Set(Object.values(MCP_SERVICES).map(s => s.category))].sort();
}

/**
 * Generate MCP manifest for all services
 */
function generateMCPManifest() {
    return {
        name: 'heady-mcp-server',
        version: '4.0.0',
        description: 'Heady™ Latent OS — 42 MCP Services for AI Orchestration',
        transport: ['stdio', 'sse'],
        tools: Object.entries(MCP_SERVICES).map(([key, svc]) => ({
            name: svc.tool,
            description: svc.description,
            inputSchema: {
                type: 'object',
                properties: svc.parameters,
                required: Object.entries(svc.parameters)
                    .filter(([, v]) => v.required)
                    .map(([k]) => k),
            },
        })),
        categories: getCategories(),
        total_services: Object.keys(MCP_SERVICES).length,
    };
}

module.exports = {
    MCP_SERVICES,
    getAllServices,
    getServicesByCategory,
    getService,
    getCategories,
    generateMCPManifest,
};
```

---

### `src/mcp/mcp-sse-transport.js`

```javascript
/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * HeadyMCP SSE Transport — HTTP/SSE bridge for remote MCP clients
 *
 * Provides:
 *   GET  /mcp/sse       — SSE stream (requires OAuth bearer token)
 *   POST /mcp/message   — JSON-RPC message endpoint
 *
 * Bridges incoming HTTP requests to the MCP SDK's tool/resource/prompt
 * handlers. This allows Claude Desktop (and any MCP client) to connect
 * remotely over HTTPS instead of requiring local stdio transport.
 */

const express = require('../core/heady-server');
const crypto = require('crypto');
const fetch = require('../core/heady-fetch');
const logger = require('../utils/logger');

// ── Tool/Resource/Prompt definitions (imported from the MCP server) ──
// We replicate the handler logic here since the stdio server can't be
// reused directly — it's bound to stdin/stdout.

class McpSseTransport {
    constructor(opts = {}) {
        this.oauthProvider = opts.oauthProvider;
        this.baseUrl = opts.baseUrl || process.env.HEADY_MANAGER_URL || 'http://localhost:3301';
        this.apiKey = opts.apiKey || process.env.HEADY_API_KEY || '';
        this.sessions = new Map();  // sessionId → { res, tier, clientId }
        this.router = express.Router();
        this._setupRoutes();
    }

    // ── Auth Middleware ───────────────────────────────────────────────
    _authenticate(req) {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
        const token = authHeader.slice(7);

        // Try OAuth token first, then raw API key
        if (this.oauthProvider) {
            const verified = this.oauthProvider.verifyAccessToken(token);
            if (verified) return verified;
        }

        // Fallback: accept raw Heady API key
        if (token === this.apiKey) {
            return { valid: true, tier: 'admin', scope: 'mcp:tools mcp:resources mcp:prompts', apiKey: token };
        }

        return null;
    }

    // ── Internal API call helper ─────────────────────────────────────
    async _headyPost(path, body, apiKey) {
        const res = await fetch(`${this.baseUrl}${path}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey || this.apiKey}`,
                'X-Heady-Source': 'heady-mcp-sse',
            },
            body: JSON.stringify(body),
        });
        return res.json();
    }

    async _headyGet(path, apiKey) {
        const res = await fetch(`${this.baseUrl}${path}`, {
            headers: {
                'Authorization': `Bearer ${apiKey || this.apiKey}`,
                'X-Heady-Source': 'heady-mcp-sse',
            },
        });
        return res.json();
    }

    // ── Tool Registry ────────────────────────────────────────────────
    _getTools() {
        // Return the same 30 tools defined in heady-mcp-server.js
        // Loaded dynamically to stay in sync
        try {
            // Tools are exported from the tool definitions
            return require('./heady-mcp-tools').HEADY_TOOLS;
        } catch {
            // Fallback: return a subset inline
            return [
                { name: 'heady_chat', description: 'Send a chat message to Heady Brain.', inputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] } },
                { name: 'heady_analyze', description: 'Analyze code or text using Heady Brain.', inputSchema: { type: 'object', properties: { content: { type: 'string' }, type: { type: 'string' } }, required: ['content'] } },
                { name: 'heady_deep_scan', description: 'Deep scan a project directory.', inputSchema: { type: 'object', properties: { directory: { type: 'string' } }, required: ['directory'] } },
                { name: 'heady_health', description: 'Check Heady service health.', inputSchema: { type: 'object', properties: { service: { type: 'string' } } } },
            ];
        }
    }

    // ── Tool Execution ───────────────────────────────────────────────
    async _executeTool(name, args, apiKey) {
        // Route tool calls to existing Heady REST API endpoints
        const TOOL_ROUTES = {
            heady_chat: { method: 'POST', path: '/api/brain/chat', mapArgs: (a) => ({ message: a.message, system: a.system, model: 'heady-brain', temperature: a.temperature ?? 0.7, max_tokens: a.max_tokens ?? 4096, source: 'heady-mcp-sse' }) },
            heady_deep_scan: { method: 'POST', path: '/api/edge/deep-scan', mapArgs: (a) => ({ directory: a.directory, include_vectors: true }) },
            heady_analyze: { method: 'POST', path: '/api/brain/analyze', mapArgs: (a) => ({ content: a.content, type: a.type || 'general', source: 'heady-mcp-sse' }) },
            heady_complete: { method: 'POST', path: '/api/brain/generate', mapArgs: (a) => ({ prompt: a.prompt, language: a.language, max_tokens: a.max_tokens ?? 2048, source: 'heady-mcp-sse' }) },
            heady_embed: { method: 'POST', path: '/api/brain/embed', mapArgs: (a) => ({ text: a.text, model: a.model || 'nomic-embed-text', source: 'heady-mcp-sse' }) },
            heady_health: { method: 'GET', path: '/api/health', mapArgs: () => ({}) },
            heady_deploy: { method: 'POST', path: '/api/deploy', mapArgs: (a) => ({ ...a, source: 'heady-mcp-sse' }) },
            heady_search: { method: 'POST', path: '/api/brain/search', mapArgs: (a) => ({ query: a.query, scope: a.scope || 'all', limit: a.limit || 10, source: 'heady-mcp-sse' }) },
            heady_refactor: { method: 'POST', path: '/api/brain/analyze', mapArgs: (a) => ({ content: a.code, type: 'code', focus: a.goals ? `Refactor for: ${a.goals.join(', ')}` : 'refactoring', task: 'refactor', source: 'heady-mcp-sse' }) },
            heady_memory: { method: 'POST', path: '/api/vector/search', mapArgs: (a) => ({ query: a.query, limit: a.limit || 5, source: 'heady-mcp-sse' }) },
            heady_auto_flow: { method: 'POST', path: '/api/hcfp/auto-flow', mapArgs: (a) => ({ task: a.task, code: a.code, context: a.context, source: 'heady-mcp-sse' }) },
            heady_jules_task: { method: 'POST', path: '/api/jules/task', mapArgs: (a) => ({ task: a.task, repository: a.repository, priority: a.priority || 'normal', source: 'heady-mcp-sse' }) },
            heady_perplexity_research: { method: 'POST', path: '/api/perplexity/research', mapArgs: (a) => ({ query: a.query, mode: a.mode || 'deep', maxSources: a.maxSources || 10, source: 'heady-mcp-sse' }) },
            heady_claude: { method: 'POST', path: '/api/headyjules/chat', mapArgs: (a) => ({ message: a.message, system: a.system, model: 'heady-headyjules-enforced', source: 'heady-mcp-sse' }) },
            heady_openai: { method: 'POST', path: '/api/headycompute/chat', mapArgs: (a) => ({ message: a.message, model: 'heady-headycompute-enforced', source: 'heady-mcp-sse' }) },
            heady_gemini: { method: 'POST', path: '/api/headypythia/generate', mapArgs: (a) => ({ prompt: a.prompt, model: a.model || 'headypythia-3.1-pro-preview', source: 'heady-mcp-sse' }) },
            heady_groq: { method: 'POST', path: '/api/groq/chat', mapArgs: (a) => ({ message: a.message, source: 'heady-mcp-sse' }) },
            heady_buddy: { method: 'POST', path: '/api/buddy/chat', mapArgs: (a) => ({ message: a.message, provider: a.provider || 'auto', source: 'heady-mcp-sse' }) },
            heady_edge_ai: { method: 'POST', path: '/api/edge/chat', mapArgs: (a) => ({ text: a.text, message: a.message, model: a.model, source: 'heady-mcp-sse' }) },
            heady_notebooklm: { method: 'POST', path: '/api/notebooklm/sync', mapArgs: () => ({ source: 'heady-mcp-sse' }) },
            heady_battle: { method: 'POST', path: '/api/battle/session', mapArgs: (a) => ({ action: a.action, task: a.task, content: a.code, source: 'heady-mcp-sse' }) },
            heady_patterns: { method: 'POST', path: '/api/patterns/analyze', mapArgs: (a) => ({ code: a.code, language: a.language, source: 'heady-mcp-sse' }) },
            heady_risks: { method: 'POST', path: '/api/risks/assess', mapArgs: (a) => ({ content: a.content, scope: a.scope || 'all', source: 'heady-mcp-sse' }) },
            heady_coder: { method: 'POST', path: '/api/coder/generate', mapArgs: (a) => ({ prompt: a.prompt, language: a.language, source: 'heady-mcp-sse' }) },
            heady_codex: { method: 'POST', path: '/api/codex/generate', mapArgs: (a) => ({ code: a.code, language: a.language, source: 'heady-mcp-sse' }) },
            heady_copilot: { method: 'POST', path: '/api/copilot/suggest', mapArgs: (a) => ({ code: a.code, language: a.language, source: 'heady-mcp-sse' }) },
            heady_ops: { method: 'POST', path: '/api/ops/deploy', mapArgs: (a) => ({ action: a.action, service: a.service, source: 'heady-mcp-sse' }) },
            heady_maid: { method: 'POST', path: '/api/maid/clean', mapArgs: (a) => ({ action: a.action, target: a.target, source: 'heady-mcp-sse' }) },
            heady_maintenance: { method: 'GET', path: '/api/maintenance/status', mapArgs: () => ({}) },
            heady_lens: { method: 'POST', path: '/api/lens/analyze', mapArgs: (a) => ({ action: a.action || 'analyze', image_url: a.image_url, prompt: a.prompt, source: 'heady-mcp-sse' }) },
            heady_vinci: { method: 'POST', path: '/api/vinci/predict', mapArgs: (a) => ({ data: a.data, context: a.context, source: 'heady-mcp-sse' }) },
            heady_soul: { method: 'POST', path: '/api/soul/analyze', mapArgs: (a) => ({ content: a.content, action: a.action || 'analyze', source: 'heady-mcp-sse' }) },
            heady_huggingface_model: { method: 'POST', path: '/api/headyhub/model', mapArgs: (a) => ({ action: a.action, modelId: a.modelId, query: a.query, source: 'heady-mcp-sse' }) },
            heady_hcfp_status: { method: 'GET', path: '/api/hcfp/status', mapArgs: () => ({}) },
            heady_orchestrator: { method: 'GET', path: '/api/orchestrator/status', mapArgs: () => ({}) },
        };

        const route = TOOL_ROUTES[name];
        if (!route) {
            return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
        }

        try {
            const mapped = route.mapArgs(args || {});
            const result = route.method === 'GET'
                ? await this._headyGet(route.path, apiKey)
                : await this._headyPost(route.path, mapped, apiKey);

            const text = result.response || result.content || result.text || result.completion || JSON.stringify(result, null, 2);
            return { content: [{ type: 'text', text }] };
        } catch (err) {
            return { content: [{ type: 'text', text: `Heady MCP Error: ${err.message}` }], isError: true };
        }
    }

    // ── JSON-RPC Handler ─────────────────────────────────────────────
    async _handleJsonRpc(message, auth) {
        const { method, id, params } = message;

        switch (method) {
            case 'initialize':
                return {
                    jsonrpc: '2.0', id,
                    result: {
                        protocolVersion: '2024-11-05',
                        capabilities: { tools: {}, resources: {}, prompts: {} },
                        serverInfo: { name: 'heady-mcp', version: '2.0.0' },
                    },
                };

            case 'tools/list':
                return { jsonrpc: '2.0', id, result: { tools: this._getTools() } };

            case 'tools/call': {
                const result = await this._executeTool(params.name, params.arguments, auth.apiKey);
                return { jsonrpc: '2.0', id, result };
            }

            case 'resources/list':
                return {
                    jsonrpc: '2.0', id,
                    result: {
                        resources: [
                            { uri: 'heady://services/catalog', name: 'Heady Service Catalog', mimeType: 'application/json' },
                            { uri: 'heady://services/health', name: 'Heady Health Status', mimeType: 'application/json' },
                        ],
                    },
                };

            case 'resources/read': {
                const { uri } = params;
                if (uri === 'heady://services/health') {
                    const health = await this._headyGet('/api/health', auth.apiKey).catch(e => ({ error: e.message }));
                    return { jsonrpc: '2.0', id, result: { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(health) }] } };
                }
                return { jsonrpc: '2.0', id, result: { contents: [{ uri, mimeType: 'application/json', text: '{}' }] } };
            }

            case 'prompts/list':
                return {
                    jsonrpc: '2.0', id,
                    result: {
                        prompts: [
                            { name: 'heady_code_review', description: 'Review code with Heady Brain' },
                            { name: 'heady_architect', description: 'Get architectural guidance' },
                            { name: 'heady_debug', description: 'Debug with Heady Brain' },
                        ],
                    },
                };

            case 'notifications/initialized':
                return null;  // No response needed for notifications

            case 'ping':
                return { jsonrpc: '2.0', id, result: {} };

            default:
                return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
        }
    }

    // ── Route Setup ──────────────────────────────────────────────────
    _setupRoutes() {
        // SSE Endpoint — long-lived connection
        this.router.get('/sse', (req, res) => {
            const auth = this._authenticate(req);
            if (!auth) {
                return res.status(401).json({ error: 'unauthorized', error_description: 'Valid OAuth token or API key required' });
            }

            const sessionId = crypto.randomBytes(16).toString('hex');

            // SSE headers
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
            });

            // Store session
            this.sessions.set(sessionId, { res, auth, connectedAt: Date.now() });

            // Send endpoint event (tells client where to POST messages)
            const messageUrl = `${this.oauthProvider?.issuer || this.baseUrl}/mcp/message?sessionId=${sessionId}`;
            res.write(`event: endpoint\ndata: ${messageUrl}\n\n`);

            // Keepalive every 30s
            const keepalive = setInterval(() => {
                try { res.write(': keepalive\n\n'); } catch { clearInterval(keepalive); }
            }, 30000);

            // Cleanup on disconnect
            req.on('close', () => {
                clearInterval(keepalive);
                this.sessions.delete(sessionId);
                logger.logNodeActivity('MCP-SSE', `Session ${sessionId.slice(0, 8)}... disconnected`);
            });

            logger.logNodeActivity('MCP-SSE', `Session ${sessionId.slice(0, 8)}... connected (tier: ${auth.tier})`);
        });

        // Message Endpoint — receives JSON-RPC from client
        this.router.post('/message', express.json(), async (req, res) => {
            const { sessionId } = req.query;
            const session = this.sessions.get(sessionId);

            if (!session) {
                // Also allow direct auth for stateless calls
                const auth = this._authenticate(req);
                if (!auth) {
                    return res.status(401).json({ error: 'unauthorized' });
                }
                // Stateless mode: handle request directly
                const response = await this._handleJsonRpc(req.body, auth);
                if (response) return res.json(response);
                return res.status(202).end();
            }

            const response = await this._handleJsonRpc(req.body, session.auth);

            // Send response via SSE
            if (response) {
                try {
                    session.res.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
                } catch {
                    // SSE connection dead — cleanup
                    this.sessions.delete(sessionId);
                }
            }

            res.status(202).end();
        });

        // Health check
        this.router.get('/health', (_req, res) => {
            res.json({
                ok: true,
                service: 'heady-mcp-sse',
                activeSessions: this.sessions.size,
                transport: 'sse',
                oauth: !!this.oauthProvider,
                ts: new Date().toISOString(),
            });
        });
    }

    getRouter() {
        return this.router;
    }
}

module.exports = { McpSseTransport };
```

---

### `src/mcp/mcp-tools.js`

```javascript
'use strict';

/**
 * @fileoverview All 31 MCP tool definitions for the HeadyStack MCP server.
 * Each tool has a name, description, category, inputSchema, and handler.
 * @module mcp/mcp-tools
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// ─── Tool Handler Helpers ───────────────────────────────────────────────────

/**
 * Safely executes a handler and wraps errors.
 * @param {string} name
 * @param {Function} fn
 * @param {Object} params
 * @returns {Promise<Object>}
 */
async function safeExec(name, fn, params) {
  const start = Date.now();
  try {
    const result = await fn(params);
    return { success: true, tool: name, result, durationMs: Date.now() - start };
  } catch (err) {
    logger.error(`[mcp-tools] handler error for '${name}': ${err.message}`);
    return { success: false, tool: name, error: err.message, durationMs: Date.now() - start };
  }
}

/**
 * @type {Array<Object>}
 */
const TOOLS = [
  // ─── MEMORY ──────────────────────────────────────────────────────────────
  {
    name: 'heady_memory',
    description: 'Search or store data in the HeadyStack vector memory system.',
    category: 'memory',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['search', 'store', 'delete', 'list'], description: 'Operation to perform' },
        query: { type: 'string', description: 'Search query (for search action)' },
        content: { type: 'string', description: 'Content to store (for store action)' },
        id: { type: 'string', description: 'Entry ID (for delete action)' },
        limit: { type: 'integer', default: 10, description: 'Max results to return' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags for filtering' },
      },
      required: ['action'],
    },
    handler: async (params) => {
      const { action, query, content, id, limit = 10, tags = [] } = params;
      const memDir = path.join(process.cwd(), 'data', 'memory');

      if (action === 'store') {
        if (!content) throw new Error('content required for store action');
        fs.mkdirSync(memDir, { recursive: true });
        const entry = { id: `mem-${Date.now()}`, content, tags, createdAt: new Date().toISOString() };
        const file = path.join(memDir, 'store.json');
        let store = [];
        try { store = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* new store */ }
        store.push(entry);
        fs.writeFileSync(file, JSON.stringify(store, null, 2));
        return { stored: true, id: entry.id };
      }

      if (action === 'search') {
        if (!query) throw new Error('query required for search action');
        const file = path.join(memDir, 'store.json');
        let store = [];
        try { store = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* empty */ }
        const lower = query.toLowerCase();
        const results = store
          .filter((e) => e.content && e.content.toLowerCase().includes(lower))
          .slice(0, limit);
        return { query, results, total: results.length };
      }

      if (action === 'list') {
        const file = path.join(memDir, 'store.json');
        let store = [];
        try { store = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* empty */ }
        return { entries: store.slice(0, limit), total: store.length };
      }

      if (action === 'delete') {
        if (!id) throw new Error('id required for delete action');
        const file = path.join(memDir, 'store.json');
        let store = [];
        try { store = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* empty */ }
        const filtered = store.filter((e) => e.id !== id);
        fs.writeFileSync(file, JSON.stringify(filtered, null, 2));
        return { deleted: store.length - filtered.length };
      }

      throw new Error(`Unknown action: ${action}`);
    },
  },

  {
    name: 'heady_embed',
    description: 'Generate embeddings for text using the configured embedding model.',
    category: 'memory',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to embed' },
        texts: { type: 'array', items: { type: 'string' }, description: 'Multiple texts to embed' },
        model: { type: 'string', default: 'text-embedding-3-small', description: 'Embedding model' },
      },
    },
    handler: async (params) => {
      const { text, texts, model = 'text-embedding-3-small' } = params;
      const inputs = texts || (text ? [text] : []);
      if (inputs.length === 0) throw new Error('text or texts required');

      // Produce deterministic pseudo-embeddings (1536-dim) when no LLM API available
      const { createHash } = require('crypto');
      const embeddings = inputs.map((t) => {
        const hash = createHash('sha256').update(t).digest();
        const dim = 1536;
        const vec = Array.from({ length: dim }, (_, i) => {
          const byte = hash[i % hash.length];
          return (byte / 255) * 2 - 1;
        });
        const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
        return vec.map((v) => v / norm);
      });

      return {
        model,
        embeddings: embeddings.map((e, i) => ({ text: inputs[i], embedding: e, dimensions: e.length })),
        total: embeddings.length,
      };
    },
  },

  // ─── ANALYSIS ────────────────────────────────────────────────────────────
  {
    name: 'heady_soul',
    description: 'Intelligence/learning layer: analyze patterns, optimize strategies, learn from outcomes.',
    category: 'analysis',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['analyze', 'optimize', 'learn'], description: 'Soul operation' },
        data: { type: 'object', description: 'Data to analyze or learn from' },
        strategy: { type: 'string', description: 'Optimization strategy name' },
        outcomes: { type: 'array', description: 'Historical outcomes to learn from' },
      },
      required: ['action'],
    },
    handler: async (params) => {
      const { action, data, strategy, outcomes = [] } = params;

      if (action === 'analyze') {
        const keys = Object.keys(data || {});
        const numericKeys = keys.filter((k) => typeof data[k] === 'number');
        const summary = Object.fromEntries(numericKeys.map((k) => [k, data[k]]));
        return { action, analyzed: true, summary, insights: [`Analyzed ${keys.length} fields, ${numericKeys.length} numeric`] };
      }

      if (action === 'optimize') {
        return {
          action, strategy: strategy || 'default',
          recommendations: ['Increase cache TTL', 'Batch database writes', 'Enable compression'],
          estimatedImprovement: '15-30%',
        };
      }

      if (action === 'learn') {
        const successRate = outcomes.length > 0
          ? outcomes.filter((o) => o.success).length / outcomes.length
          : null;
        return {
          action, learned: outcomes.length,
          successRate: successRate !== null ? Math.round(successRate * 100) : null,
          patterns: outcomes.length > 5 ? ['batch-processing-effective', 'retry-improves-success'] : [],
        };
      }

      throw new Error(`Unknown action: ${action}`);
    },
  },

  {
    name: 'heady_vinci',
    description: 'Pattern recognition and prediction engine.',
    category: 'analysis',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['learn', 'predict', 'recognize'], description: 'Vinci operation' },
        patterns: { type: 'array', description: 'Patterns to learn from' },
        input: { type: 'object', description: 'Input to recognize or predict from' },
        timeSeriesData: { type: 'array', description: 'Time-series data for prediction' },
      },
      required: ['action'],
    },
    handler: async (params) => {
      const { action, patterns = [], input, timeSeriesData = [] } = params;

      if (action === 'learn') {
        return { action, patternsLearned: patterns.length, status: 'patterns stored in model' };
      }

      if (action === 'predict') {
        if (timeSeriesData.length < 2) return { action, prediction: null, reason: 'insufficient data' };
        const values = timeSeriesData.map((v) => typeof v === 'number' ? v : v.value || 0);
        const last = values[values.length - 1];
        const secondLast = values[values.length - 2];
        const delta = last - secondLast;
        return { action, prediction: last + delta, confidence: 0.65, method: 'linear-extrapolation' };
      }

      if (action === 'recognize') {
        if (!input) throw new Error('input required for recognize action');
        const inputStr = JSON.stringify(input).toLowerCase();
        const matched = patterns.filter((p) => {
          const ps = typeof p === 'string' ? p : JSON.stringify(p);
          return inputStr.includes(ps.toLowerCase().slice(0, 10));
        });
        return { action, recognized: matched.length > 0, matches: matched.slice(0, 5), confidence: matched.length > 0 ? 0.8 : 0.1 };
      }

      throw new Error(`Unknown action: ${action}`);
    },
  },

  {
    name: 'heady_deep_scan',
    description: 'Performs a deep workspace scan: file inventory, dependencies, secrets, code quality.',
    category: 'analysis',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Directory to scan', default: '.' },
        depth: { type: 'integer', description: 'Scan depth', default: 5 },
        includeHidden: { type: 'boolean', default: false },
        scanSecrets: { type: 'boolean', default: true },
      },
    },
    handler: async (params) => {
      const { target = process.cwd(), depth = 3, scanSecrets = true } = params;
      const resolvedTarget = path.resolve(target);
      const files = [];
      const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'coverage']);

      function scan(dir, currentDepth) {
        if (currentDepth > depth) return;
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const entry of entries) {
          if (SKIP.has(entry.name)) continue;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scan(full, currentDepth + 1);
          } else {
            const stat = fs.statSync(full);
            files.push({ path: full.replace(resolvedTarget + '/', ''), size: stat.size, ext: path.extname(entry.name) });
          }
        }
      }

      scan(resolvedTarget, 0);

      const extGroups = files.reduce((acc, f) => {
        acc[f.ext || 'no-ext'] = (acc[f.ext || 'no-ext'] || 0) + 1;
        return acc;
      }, {});

      const totalSize = files.reduce((s, f) => s + f.size, 0);

      return {
        target: resolvedTarget,
        totalFiles: files.length,
        totalSizeKB: Math.round(totalSize / 1024),
        extensionBreakdown: extGroups,
        files: files.slice(0, 100),
        scannedAt: new Date().toISOString(),
      };
    },
  },

  {
    name: 'heady_analyze',
    description: 'Analyzes architecture, code structure, or security posture of a project.',
    category: 'analysis',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['architecture', 'code', 'security', 'dependencies'], description: 'Analysis type' },
        target: { type: 'string', description: 'Target path or URL to analyze' },
        depth: { type: 'string', enum: ['shallow', 'deep'], default: 'shallow' },
      },
      required: ['type'],
    },
    handler: async (params) => {
      const { type, target = process.cwd(), depth = 'shallow' } = params;
      const resolvedTarget = path.resolve(target);

      if (type === 'architecture') {
        const hasDockerfile = fs.existsSync(path.join(resolvedTarget, 'Dockerfile'));
        const hasSrc = fs.existsSync(path.join(resolvedTarget, 'src'));
        const hasTests = fs.existsSync(path.join(resolvedTarget, 'test')) || fs.existsSync(path.join(resolvedTarget, '__tests__'));
        let pkg = {};
        try { pkg = JSON.parse(fs.readFileSync(path.join(resolvedTarget, 'package.json'), 'utf8')); } catch { /* ok */ }

        return {
          type, target: resolvedTarget,
          structure: { hasDockerfile, hasSrc, hasTests },
          stack: {
            runtime: `Node.js ${process.version}`,
            framework: pkg.dependencies?.express ? 'Express' : pkg.dependencies?.fastify ? 'Fastify' : 'unknown',
            dependencies: Object.keys(pkg.dependencies || {}).length,
            devDependencies: Object.keys(pkg.devDependencies || {}).length,
          },
        };
      }

      if (type === 'code') {
        let jsFiles = 0, totalLines = 0;
        function countLines(dir, d = 0) {
          if (d > 5) return;
          try {
            fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
              if (['node_modules', '.git'].includes(e.name)) return;
              if (e.isDirectory()) countLines(path.join(dir, e.name), d + 1);
              else if (e.name.endsWith('.js')) {
                jsFiles++;
                try { totalLines += fs.readFileSync(path.join(dir, e.name), 'utf8').split('\n').length; } catch { /* ok */ }
              }
            });
          } catch { /* ok */ }
        }
        countLines(resolvedTarget);
        return { type, target: resolvedTarget, jsFiles, totalLines, avgLinesPerFile: jsFiles > 0 ? Math.round(totalLines / jsFiles) : 0 };
      }

      return { type, target: resolvedTarget, depth, analyzed: true, timestamp: new Date().toISOString() };
    },
  },

  {
    name: 'heady_risks',
    description: 'Scans for risk patterns: outdated deps, exposed secrets, misconfigured services.',
    category: 'analysis',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['dependencies', 'secrets', 'config', 'all'], default: 'all' },
        target: { type: 'string', description: 'Project root to scan' },
        severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], default: 'low' },
      },
    },
    handler: async (params) => {
      const { scope = 'all', target = process.cwd(), severity = 'low' } = params;
      const risks = [];

      if (['config', 'all'].includes(scope)) {
        if (!process.env.NODE_ENV) risks.push({ id: 'CFG-001', severity: 'medium', issue: 'NODE_ENV not set', recommendation: 'Set NODE_ENV=production in production' });
        if (!process.env.PORT) risks.push({ id: 'CFG-002', severity: 'low', issue: 'PORT not set', recommendation: 'Explicitly set PORT env var' });
      }

      const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
      const minSev = severityOrder[severity] || 0;
      const filtered = risks.filter((r) => severityOrder[r.severity] >= minSev);

      return {
        scope,
        target: path.resolve(target),
        totalRisks: filtered.length,
        bySeverity: filtered.reduce((acc, r) => { acc[r.severity] = (acc[r.severity] || 0) + 1; return acc; }, {}),
        risks: filtered,
        scannedAt: new Date().toISOString(),
      };
    },
  },

  {
    name: 'heady_patterns',
    description: 'Detects architectural and code patterns in a project.',
    category: 'analysis',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Directory to analyze' },
        patternTypes: { type: 'array', items: { type: 'string' }, description: 'Pattern types to detect' },
      },
    },
    handler: async (params) => {
      const { target = process.cwd() } = params;
      const detected = [];

      // Detect common patterns from file structure
      const checks = [
        { path: 'src/controllers', pattern: 'MVC/Controller pattern' },
        { path: 'src/routes', pattern: 'Route-based architecture' },
        { path: 'src/models', pattern: 'Data model layer' },
        { path: 'src/services', pattern: 'Service layer pattern' },
        { path: 'src/middleware', pattern: 'Middleware pipeline' },
        { path: 'src/bees', pattern: 'Bee/Worker swarm pattern' },
        { path: 'src/mcp', pattern: 'MCP tool integration' },
      ];

      for (const { path: p, pattern } of checks) {
        if (fs.existsSync(path.join(target, p))) {
          detected.push({ pattern, path: p, confidence: 0.95 });
        }
      }

      return { target, detectedPatterns: detected.length, patterns: detected, analyzedAt: new Date().toISOString() };
    },
  },

  // ─── ORCHESTRATION ───────────────────────────────────────────────────────
  {
    name: 'heady_auto_flow',
    description: 'Runs an automated end-to-end pipeline: scan → analyze → deploy → verify.',
    category: 'orchestration',
    inputSchema: {
      type: 'object',
      properties: {
        pipeline: { type: 'array', items: { type: 'string' }, description: 'Ordered stages to run' },
        config: { type: 'object', description: 'Pipeline configuration' },
        dryRun: { type: 'boolean', default: false },
      },
    },
    handler: async (params) => {
      const { pipeline = ['scan', 'analyze', 'validate'], dryRun = false } = params;
      const stages = [];

      for (const stage of pipeline) {
        const start = Date.now();
        await new Promise((r) => setTimeout(r, 10)); // simulate work
        stages.push({ stage, status: dryRun ? 'dry-run' : 'completed', durationMs: Date.now() - start });
      }

      return { pipeline, stages, dryRun, completedAt: new Date().toISOString() };
    },
  },

  {
    name: 'heady_battle',
    description: 'Competitive evaluation: pit two strategies, configs, or models against each other.',
    category: 'orchestration',
    inputSchema: {
      type: 'object',
      properties: {
        challenger: { type: 'object', description: 'Challenger configuration', required: true },
        defender: { type: 'object', description: 'Defender configuration', required: true },
        metric: { type: 'string', description: 'Evaluation metric', default: 'throughput' },
        rounds: { type: 'integer', default: 5 },
      },
      required: ['challenger', 'defender'],
    },
    handler: async (params) => {
      const { challenger, defender, metric = 'throughput', rounds = 5 } = params;
      const results = [];
      let challengerWins = 0;
      let defenderWins = 0;

      for (let i = 0; i < rounds; i++) {
        const cScore = Math.random();
        const dScore = Math.random();
        const winner = cScore > dScore ? 'challenger' : 'defender';
        if (winner === 'challenger') challengerWins++; else defenderWins++;
        results.push({ round: i + 1, challengerScore: Math.round(cScore * 100), defenderScore: Math.round(dScore * 100), winner });
      }

      return {
        metric, rounds,
        winner: challengerWins > defenderWins ? 'challenger' : 'defender',
        challengerWins, defenderWins,
        rounds: results,
        challenger: challenger.name || 'challenger',
        defender: defender.name || 'defender',
      };
    },
  },

  {
    name: 'heady_conductor',
    description: 'Routes tasks to the appropriate domain bee or agent based on content and priority.',
    category: 'orchestration',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'Task description to route' },
        context: { type: 'object', description: 'Task context' },
        priority: { type: 'number', minimum: 0, maximum: 1, default: 0.5 },
      },
      required: ['task'],
    },
    handler: async (params) => {
      const { task, context: ctx = {}, priority = 0.5 } = params;
      const lower = task.toLowerCase();

      const routes = [
        { keywords: ['deploy', 'deployment', 'release'], domain: 'deployment', confidence: 0.9 },
        { keywords: ['health', 'status', 'check', 'ping'], domain: 'health', confidence: 0.9 },
        { keywords: ['security', 'secret', 'vuln', 'scan'], domain: 'security', confidence: 0.9 },
        { keywords: ['memory', 'vector', 'embed', 'search'], domain: 'memory', confidence: 0.85 },
        { keywords: ['doc', 'document', 'readme', 'api'], domain: 'documentation', confidence: 0.85 },
        { keywords: ['config', 'configuration', 'env'], domain: 'config', confidence: 0.85 },
        { keywords: ['metric', 'telemetry', 'monitor', 'collect'], domain: 'telemetry', confidence: 0.85 },
      ];

      const matched = routes.filter((r) => r.keywords.some((k) => lower.includes(k)));
      const best = matched.sort((a, b) => b.confidence - a.confidence)[0];

      return {
        task,
        routed: !!best,
        domain: best?.domain || 'orchestration',
        confidence: best?.confidence || 0.3,
        priority,
        alternatives: matched.slice(1).map((r) => ({ domain: r.domain, confidence: r.confidence })),
      };
    },
  },

  {
    name: 'heady_swarm',
    description: 'Coordinates a swarm of bees to execute a multi-domain task in parallel.',
    category: 'orchestration',
    inputSchema: {
      type: 'object',
      properties: {
        domains: { type: 'array', items: { type: 'string' }, description: 'Domains to include in swarm' },
        task: { type: 'string', description: 'Task for the swarm to execute' },
        parallel: { type: 'boolean', default: true, description: 'Execute domains in parallel' },
        context: { type: 'object', description: 'Shared context for all bees' },
      },
      required: ['domains'],
    },
    handler: async (params) => {
      const { domains, task, parallel = true, context: ctx = {} } = params;
      const start = Date.now();
      const results = domains.map((d) => ({
        domain: d,
        status: 'dispatched',
        workUnits: Math.floor(Math.random() * 3) + 1,
        timestamp: new Date().toISOString(),
      }));

      return {
        swarmId: `swarm-${Date.now()}`,
        task: task || 'multi-domain swarm',
        domains: domains.length,
        parallel,
        results,
        totalMs: Date.now() - start,
        dispatchedAt: new Date().toISOString(),
      };
    },
  },


  // ─── CODING ───────────────────────────────────────────────────────────────
  {
    name: 'heady_coder',
    description: 'Code generation: scaffolds functions, classes, tests, and full modules from descriptions.',
    category: 'deployment',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['function', 'class', 'test', 'module', 'snippet'], description: 'What to generate' },
        description: { type: 'string', description: 'Natural language description of the code to generate' },
        language: { type: 'string', default: 'javascript', description: 'Target language' },
        style: { type: 'string', default: 'commonjs', description: 'Module style (commonjs, esm, typescript)' },
      },
      required: ['type', 'description'],
    },
    handler: async (params) => {
      const { type, description, language = 'javascript', style = 'commonjs' } = params;

      const templates = {
        function: (desc) => [
          "'use strict';",
          '',
          '/**',
          ` * ${desc}`,
          ' * @param {Object} params',
          ' * @returns {Promise<Object>}',
          ' */',
          'async function generatedFunction(params = {}) {',
          `  // Generated from: ${desc}`,
          '  const result = {};',
          '  return result;',
          '}',
          '',
          'module.exports = { generatedFunction };',
        ].join('\n'),

        class: (desc) => [
          "'use strict';",
          '',
          '/**',
          ` * ${desc}`,
          ' */',
          'class GeneratedClass {',
          '  constructor(config = {}) {',
          '    this._config = config;',
          '    this._createdAt = new Date().toISOString();',
          '  }',
          '  async execute(params = {}) {',
          `    // Generated from: ${desc}`,
          '    return { success: true, params, createdAt: this._createdAt };',
          '  }',
          '}',
          '',
          'module.exports = { GeneratedClass };',
        ].join('\n'),

        test: (desc) => [
          "'use strict';",
          '',
          "const assert = require('assert');",
          '',
          `describe('Generated tests for: ${desc}', () => {`,
          "  it('should initialize correctly', () => {",
          '    assert.ok(true);',
          '  });',
          "  it('should handle happy path', async () => {",
          '    assert.strictEqual(typeof {}, "object");',
          '  });',
          '});',
        ].join('\n'),

        module: (desc) => [
          "'use strict';",
          '',
          `/** @fileoverview ${desc} */`,
          '',
          "const logger = require('../utils/logger');",
          '',
          'function init(config = {}) {',
          "  logger.info('[generated] module initialized');",
          '  return { config, ready: true, timestamp: new Date().toISOString() };',
          '}',
          '',
          'module.exports = { init };',
        ].join('\n'),

        snippet: (desc) => `// Snippet: ${desc}\nconst result = { description: '${desc}', generated: true, ts: new Date().toISOString() };`,
      };

      const generator = templates[type] || templates.snippet;
      const code = generator(description);

      return {
        type,
        description,
        language,
        style,
        code,
        lineCount: code.split('\n').length,
        generatedAt: new Date().toISOString(),
      };
    },
  },

  // ─── DEPLOYMENT ──────────────────────────────────────────────────────────
  {
    name: 'heady_deploy',
    description: 'Orchestrates deployment to configured targets (Cloud Run, GKE, Firebase, etc.).',
    category: 'deployment',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', enum: ['cloud-run', 'gke', 'firebase', 'docker', 'local'], description: 'Deploy target' },
        image: { type: 'string', description: 'Container image to deploy' },
        service: { type: 'string', description: 'Service name' },
        environment: { type: 'string', enum: ['development', 'staging', 'production'], default: 'development' },
        dryRun: { type: 'boolean', default: false },
      },
      required: ['target'],
    },
    handler: async (params) => {
      const { target, image, service, environment = 'development', dryRun = false } = params;

      const deployment = {
        id: `deploy-${Date.now()}`,
        target,
        image: image || 'not-specified',
        service: service || 'default',
        environment,
        dryRun,
        status: dryRun ? 'dry-run' : 'initiated',
        steps: [
          { step: 'pre-checks', status: 'completed' },
          { step: 'build', status: dryRun ? 'skipped' : 'queued' },
          { step: 'push', status: dryRun ? 'skipped' : 'queued' },
          { step: 'deploy', status: dryRun ? 'skipped' : 'queued' },
          { step: 'verify', status: dryRun ? 'skipped' : 'queued' },
        ],
        initiatedAt: new Date().toISOString(),
      };

      return deployment;
    },
  },

  // ─── SECURITY ────────────────────────────────────────────────────────────
  {
    name: 'heady_security',
    description: 'Performs security operations: secret scanning, vulnerability assessment, compliance checks.',
    category: 'security',
    inputSchema: {
      type: 'object',
      properties: {
        operation: { type: 'string', enum: ['scan-secrets', 'vuln-check', 'compliance', 'pentest-sim'], description: 'Operation type' },
        target: { type: 'string', description: 'Target directory or URL' },
        standards: { type: 'array', items: { type: 'string' }, description: 'Compliance standards to check' },
      },
      required: ['operation'],
    },
    handler: async (params) => {
      const { operation, target = process.cwd(), standards = ['OWASP-Top10'] } = params;

      if (operation === 'compliance') {
        const checks = standards.map((s) => ({
          standard: s,
          checked: true,
          passed: Math.random() > 0.2,
          findings: [],
        }));
        return { operation, standards, checks, timestamp: new Date().toISOString() };
      }

      return {
        operation,
        target: path.resolve(target),
        status: 'completed',
        findings: [],
        severity: { critical: 0, high: 0, medium: 0, low: 0 },
        timestamp: new Date().toISOString(),
      };
    },
  },

  {
    name: 'heady_governance',
    description: 'Runs governance checks: license compliance, code policies, artifact validation.',
    category: 'security',
    inputSchema: {
      type: 'object',
      properties: {
        checks: { type: 'array', items: { type: 'string' }, description: 'Checks to run', default: ['licenses', 'policies', 'artifacts'] },
        target: { type: 'string', description: 'Project root' },
        strict: { type: 'boolean', default: false },
      },
    },
    handler: async (params) => {
      const { checks = ['licenses', 'policies', 'artifacts'], target = process.cwd() } = params;
      const results = checks.map((check) => ({
        check,
        status: 'completed',
        passed: true,
        violations: 0,
      }));
      return { target, checks: results, allPassed: results.every((r) => r.passed), timestamp: new Date().toISOString() };
    },
  },

  // ─── HEALTH / OPS ────────────────────────────────────────────────────────
  {
    name: 'heady_health',
    description: 'Comprehensive system health check across all subsystems.',
    category: 'health',
    inputSchema: {
      type: 'object',
      properties: {
        subsystems: { type: 'array', items: { type: 'string' }, description: 'Subsystems to check' },
        detailed: { type: 'boolean', default: false },
      },
    },
    handler: async (params) => {
      const { detailed = false } = params;
      const mem = process.memoryUsage();
      const health = {
        status: 'healthy',
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform,
        memory: {
          heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
          rssMB: Math.round(mem.rss / 1024 / 1024),
        },
        os: detailed ? {
          hostname: os.hostname(),
          cpus: os.cpus().length,
          freeMem: Math.round(os.freemem() / 1024 / 1024),
          loadAvg: os.loadavg(),
        } : undefined,
        timestamp: new Date().toISOString(),
      };
      return health;
    },
  },

  {
    name: 'heady_check',
    description: 'Verification check: validates that a specific system component is working correctly.',
    category: 'health',
    inputSchema: {
      type: 'object',
      properties: {
        component: { type: 'string', description: 'Component to verify' },
        endpoint: { type: 'string', description: 'Endpoint URL to probe' },
        expectedStatus: { type: 'integer', default: 200 },
      },
      required: ['component'],
    },
    handler: async (params) => {
      const { component, endpoint, expectedStatus = 200 } = params;
      const result = { component, checked: true, pass: true, timestamp: new Date().toISOString() };

      if (endpoint) {
        const http = require('http');
        const https = require('https');
        result.endpoint = endpoint;
        const probe = await new Promise((resolve) => {
          const lib = endpoint.startsWith('https') ? https : http;
          const req = lib.get(endpoint, { timeout: 5000 }, (res) => {
            resolve({ status: res.statusCode, pass: res.statusCode === expectedStatus });
          });
          req.on('error', (e) => resolve({ status: 0, pass: false, error: e.message }));
          req.on('timeout', () => { req.destroy(); resolve({ status: 0, pass: false, error: 'timeout' }); });
        });
        Object.assign(result, probe);
      }

      return result;
    },
  },

  {
    name: 'heady_assure',
    description: 'Quality assurance: runs test suites, validates outputs, checks invariants.',
    category: 'health',
    inputSchema: {
      type: 'object',
      properties: {
        suite: { type: 'string', enum: ['unit', 'integration', 'e2e', 'all'], default: 'unit' },
        target: { type: 'string', description: 'Project path' },
        failFast: { type: 'boolean', default: false },
      },
    },
    handler: async (params) => {
      const { suite = 'unit', target = process.cwd() } = params;
      const { execFile } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(execFile);

      let pkg = {};
      try { pkg = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8')); } catch { /* ok */ }

      if (!pkg.scripts?.test) {
        return { suite, status: 'skipped', reason: 'no test script in package.json' };
      }

      try {
        const { stdout } = await execAsync('npm', ['test', '--', '--passWithNoTests'], { cwd: target, timeout: 60000 });
        return { suite, status: 'passed', output: stdout.slice(0, 500) };
      } catch (err) {
        return { suite, status: 'failed', error: err.message, output: (err.stdout || '').slice(0, 500) };
      }
    },
  },

  {
    name: 'heady_maintenance',
    description: 'Maintenance operations: cleanup, rotation, compaction, index rebuild.',
    category: 'ops',
    inputSchema: {
      type: 'object',
      properties: {
        tasks: { type: 'array', items: { type: 'string' }, description: 'Maintenance tasks to run' },
        dryRun: { type: 'boolean', default: false },
        target: { type: 'string', description: 'Target path' },
      },
    },
    handler: async (params) => {
      const { tasks = ['cleanup', 'rotate-logs'], dryRun = false } = params;
      const results = tasks.map((t) => ({ task: t, status: dryRun ? 'dry-run' : 'completed', durationMs: 0 }));
      return { tasks: results, dryRun, completedAt: new Date().toISOString() };
    },
  },

  // ─── CREATIVE ────────────────────────────────────────────────────────────
  {
    name: 'heady_buddy',
    description: 'Conversational companion: answers questions, provides guidance, engages naturally.',
    category: 'creative',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Message to the buddy' },
        persona: { type: 'string', default: 'helpful', description: 'Buddy persona' },
        history: { type: 'array', description: 'Conversation history' },
      },
      required: ['message'],
    },
    handler: async (params) => {
      const { message, persona = 'helpful', history = [] } = params;
      const greetings = ['Hello!', 'Hi there!', 'Hey!'];
      const responses = {
        helpful: `I'm here to help! You said: "${message}". Let me process that for you.`,
        technical: `Processing your query: "${message}". Running analysis...`,
        creative: `Ooh, interesting! "${message}" — let me spin up some ideas for you!`,
      };
      const reply = message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')
        ? greetings[Math.floor(Math.random() * greetings.length)] + ' ' + (responses[persona] || responses.helpful)
        : responses[persona] || responses.helpful;

      return { reply, persona, messageCount: history.length + 1, timestamp: new Date().toISOString() };
    },
  },

  {
    name: 'heady_research',
    description: 'Deep research: aggregates information from memory, context, and structured knowledge.',
    category: 'creative',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Research query' },
        depth: { type: 'string', enum: ['quick', 'standard', 'deep'], default: 'standard' },
        sources: { type: 'array', items: { type: 'string' }, description: 'Sources to search' },
      },
      required: ['query'],
    },
    handler: async (params) => {
      const { query, depth = 'standard', sources = ['memory', 'context'] } = params;
      return {
        query,
        depth,
        sources,
        findings: [
          { source: 'memory', relevance: 0.85, content: `Memory search for: ${query}` },
        ],
        summary: `Research completed for: "${query}". Searched ${sources.length} source(s).`,
        timestamp: new Date().toISOString(),
      };
    },
  },

  {
    name: 'heady_creative',
    description: 'Creative generation: text, templates, variations, scoring.',
    category: 'creative',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['text', 'template', 'variation', 'score'], description: 'Creative operation' },
        input: { type: 'string', description: 'Input text or template' },
        style: { type: 'string', description: 'Desired style or tone' },
        count: { type: 'integer', default: 3, description: 'Number of variations to generate' },
      },
      required: ['type', 'input'],
    },
    handler: async (params) => {
      const { type, input, style = 'neutral', count = 3 } = params;

      if (type === 'variation') {
        const variations = Array.from({ length: count }, (_, i) => `${input} [variation ${i + 1}, style: ${style}]`);
        return { type, input, style, count, variations };
      }

      if (type === 'score') {
        const words = input.split(/\s+/).length;
        const unique = new Set(input.toLowerCase().match(/\w+/g) || []).size;
        const score = Math.min(100, Math.round((unique / words) * 80 + (words > 10 ? 20 : words * 2)));
        return { type, input, score, wordCount: words, uniqueWords: unique };
      }

      return { type, input, style, output: `Generated ${type}: ${input}`, timestamp: new Date().toISOString() };
    },
  },

  // ─── PIPELINE ────────────────────────────────────────────────────────────
  {
    name: 'heady_pipeline',
    description: 'Pipeline management: create, execute, monitor, and report on processing pipelines.',
    category: 'pipeline',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'execute', 'status', 'list'], description: 'Pipeline action' },
        pipelineId: { type: 'string', description: 'Pipeline identifier' },
        stages: { type: 'array', description: 'Stage definitions for create' },
        input: { type: 'object', description: 'Input for execute' },
      },
      required: ['action'],
    },
    handler: async (params) => {
      const { action, pipelineId, stages = [], input = {} } = params;

      if (action === 'create') {
        const id = pipelineId || `pipeline-${Date.now()}`;
        return { action, id, stages: stages.length, created: true, timestamp: new Date().toISOString() };
      }

      if (action === 'execute') {
        if (!pipelineId) throw new Error('pipelineId required for execute');
        return { action, pipelineId, status: 'executed', input, output: input, durationMs: 0 };
      }

      if (action === 'status') {
        return { action, pipelineId, status: 'idle', runCount: 0, lastRunAt: null };
      }

      return { action, pipelines: [], count: 0 };
    },
  },

  // ─── TELEMETRY ───────────────────────────────────────────────────────────
  {
    name: 'heady_telemetry',
    description: 'Telemetry collection and reporting: metrics, events, histograms.',
    category: 'telemetry',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['collect', 'report', 'export', 'reset'], description: 'Telemetry action' },
        metric: { type: 'string', description: 'Metric name for collect' },
        value: { type: 'number', description: 'Metric value for collect' },
        format: { type: 'string', enum: ['json', 'prometheus'], default: 'json' },
      },
      required: ['action'],
    },
    handler: async (params) => {
      const { action, metric, value, format = 'json' } = params;

      if (action === 'collect') {
        if (!metric) throw new Error('metric required for collect');
        return { action, metric, value, recorded: true, timestamp: new Date().toISOString() };
      }

      if (action === 'report') {
        const memMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        if (format === 'prometheus') {
          return { action, format, output: `# HELP process_heap_used_mb Heap memory\nprocess_heap_used_mb ${memMB}` };
        }
        return { action, format, metrics: { 'process.heap_used_mb': memMB, 'process.uptime': process.uptime() }, timestamp: new Date().toISOString() };
      }

      return { action, status: 'completed', timestamp: new Date().toISOString() };
    },
  },

  // ─── CONFIG ──────────────────────────────────────────────────────────────
  {
    name: 'heady_config',
    description: 'Configuration management: read, write, validate, and watch config values.',
    category: 'config',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['get', 'set', 'validate', 'list', 'diff'], description: 'Config action' },
        key: { type: 'string', description: 'Config key' },
        value: { description: 'Config value to set' },
        file: { type: 'string', description: 'Config file path' },
      },
      required: ['action'],
    },
    handler: async (params) => {
      const { action, key, value, file = 'config.json' } = params;
      const filePath = path.resolve(file);

      if (action === 'get') {
        let config = {};
        try { config = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { /* empty */ }
        return { action, key, value: key ? config[key] : undefined, found: key ? key in config : false };
      }

      if (action === 'set') {
        let config = {};
        try { config = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { /* empty */ }
        config[key] = value;
        fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
        return { action, key, value, written: true };
      }

      if (action === 'list') {
        let config = {};
        try { config = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { /* empty */ }
        return { action, keys: Object.keys(config), count: Object.keys(config).length };
      }

      return { action, status: 'completed', timestamp: new Date().toISOString() };
    },
  },

  // ─── SYNC ────────────────────────────────────────────────────────────────
  {
    name: 'heady_sync',
    description: 'Synchronization: sync projections, replicate data, detect drift between sources.',
    category: 'sync',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['sync', 'diff', 'replay', 'status'], description: 'Sync action' },
        source: { type: 'string', description: 'Source identifier' },
        target: { type: 'string', description: 'Target identifier' },
        dryRun: { type: 'boolean', default: false },
      },
      required: ['action'],
    },
    handler: async (params) => {
      const { action, source, target, dryRun = false } = params;
      return {
        action, source, target, dryRun,
        status: dryRun ? 'dry-run' : 'synced',
        changes: dryRun ? 0 : Math.floor(Math.random() * 10),
        timestamp: new Date().toISOString(),
      };
    },
  },

  // ─── OPS ─────────────────────────────────────────────────────────────────
  {
    name: 'heady_ops',
    description: 'System operations: disk usage, log rotation, process management, cleanup.',
    category: 'ops',
    inputSchema: {
      type: 'object',
      properties: {
        operation: { type: 'string', enum: ['disk-usage', 'rotate-logs', 'cleanup', 'process-list', 'restart'], description: 'Operation' },
        target: { type: 'string', description: 'Target path or process name' },
        dryRun: { type: 'boolean', default: false },
      },
      required: ['operation'],
    },
    handler: async (params) => {
      const { operation, target = process.cwd(), dryRun = false } = params;

      if (operation === 'disk-usage') {
        const { execFile } = require('child_process');
        const { promisify } = require('util');
        try {
          const { stdout } = await promisify(execFile)('df', ['-h', target], { timeout: 5000 });
          return { operation, output: stdout, timestamp: new Date().toISOString() };
        } catch {
          return { operation, target, sizeMB: 'unavailable', timestamp: new Date().toISOString() };
        }
      }

      if (operation === 'process-list') {
        return { operation, pid: process.pid, uptime: process.uptime(), nodeVersion: process.version };
      }

      return { operation, target, dryRun, status: dryRun ? 'dry-run' : 'completed', timestamp: new Date().toISOString() };
    },
  },

  // ─── DOCS ────────────────────────────────────────────────────────────────
  {
    name: 'heady_docs',
    description: 'Documentation generation: extract JSDoc, generate API reference, validate README.',
    category: 'docs',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['generate', 'validate', 'extract', 'inventory'], description: 'Doc action' },
        source: { type: 'string', description: 'Source directory or file' },
        output: { type: 'string', description: 'Output path' },
        format: { type: 'string', enum: ['markdown', 'json', 'html'], default: 'markdown' },
      },
      required: ['action'],
    },
    handler: async (params) => {
      const { action, source = process.cwd(), output, format = 'markdown' } = params;
      const resolvedSource = path.resolve(source);

      if (action === 'inventory') {
        let jsFiles = 0;
        const walk = (dir, d = 0) => {
          if (d > 5) return;
          try { fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
            if (['node_modules', '.git'].includes(e.name)) return;
            if (e.isDirectory()) walk(path.join(dir, e.name), d + 1);
            else if (e.name.endsWith('.js')) jsFiles++;
          }); } catch { /* ok */ }
        };
        walk(resolvedSource);
        return { action, source: resolvedSource, jsFiles, format, timestamp: new Date().toISOString() };
      }

      return { action, source: resolvedSource, output, format, status: 'completed', timestamp: new Date().toISOString() };
    },
  },

  // ─── EDGE ────────────────────────────────────────────────────────────────
  {
    name: 'heady_edge',
    description: 'Edge operations: CDN management, geo-routing, edge cache invalidation.',
    category: 'edge',
    inputSchema: {
      type: 'object',
      properties: {
        operation: { type: 'string', enum: ['purge-cache', 'set-routing', 'get-status', 'warmup'], description: 'Edge operation' },
        urls: { type: 'array', items: { type: 'string' }, description: 'URLs for cache operations' },
        region: { type: 'string', description: 'Target region' },
        provider: { type: 'string', enum: ['cloudflare', 'fastly', 'cloudfront', 'custom'], default: 'custom' },
      },
      required: ['operation'],
    },
    handler: async (params) => {
      const { operation, urls = [], region, provider = 'custom' } = params;

      if (operation === 'purge-cache') {
        return { operation, provider, purged: urls.length, urls, status: 'purged', timestamp: new Date().toISOString() };
      }

      if (operation === 'get-status') {
        return { operation, provider, region, status: 'operational', latency: { p50: 12, p99: 45 }, timestamp: new Date().toISOString() };
      }

      return { operation, provider, region, status: 'completed', timestamp: new Date().toISOString() };
    },
  },

  // ─── BUDGET ──────────────────────────────────────────────────────────────
  {
    name: 'heady_budget',
    description: 'Budget tracking: token consumption, API costs, usage quotas, billing alerts.',
    category: 'budget',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['report', 'record', 'alert', 'reset'], description: 'Budget action' },
        provider: { type: 'string', description: 'Provider name (openai, anthropic, etc.)' },
        tokens: { type: 'integer', description: 'Token count to record' },
        costUSD: { type: 'number', description: 'Cost in USD to record' },
        limit: { type: 'number', description: 'Budget limit in USD' },
      },
      required: ['action'],
    },
    handler: async (params) => {
      const { action, provider = 'all', tokens = 0, costUSD = 0, limit } = params;
      const budgetFile = path.join(process.cwd(), 'data', 'budget.json');

      let budget = { providers: {}, totalTokens: 0, totalCostUSD: 0, lastUpdated: null };
      try {
        budget = JSON.parse(fs.readFileSync(budgetFile, 'utf8'));
      } catch { /* fresh budget */ }

      if (action === 'record') {
        if (!budget.providers[provider]) budget.providers[provider] = { tokens: 0, costUSD: 0 };
        budget.providers[provider].tokens += tokens;
        budget.providers[provider].costUSD += costUSD;
        budget.totalTokens += tokens;
        budget.totalCostUSD += costUSD;
        budget.lastUpdated = new Date().toISOString();
        fs.mkdirSync(path.dirname(budgetFile), { recursive: true });
        fs.writeFileSync(budgetFile, JSON.stringify(budget, null, 2));
        return { action, provider, tokens, costUSD, totals: { tokens: budget.totalTokens, costUSD: budget.totalCostUSD } };
      }

      if (action === 'report') {
        const overBudget = limit ? budget.totalCostUSD > limit : false;
        return { action, budget, limit, overBudget, pctUsed: limit ? Math.round((budget.totalCostUSD / limit) * 100) : null };
      }

      if (action === 'alert') {
        const alertThreshold = limit || 10;
        const exceeded = budget.totalCostUSD >= alertThreshold;
        return { action, exceeded, totalCostUSD: budget.totalCostUSD, limit: alertThreshold };
      }

      if (action === 'reset') {
        const fresh = { providers: {}, totalTokens: 0, totalCostUSD: 0, lastUpdated: new Date().toISOString() };
        fs.mkdirSync(path.dirname(budgetFile), { recursive: true });
        fs.writeFileSync(budgetFile, JSON.stringify(fresh, null, 2));
        return { action, reset: true };
      }

      return { action, status: 'unknown' };
    },
  },
];

/**
 * Returns all tool definitions.
 * @returns {Array<Object>}
 */
function getAllTools() {
  return TOOLS;
}

/**
 * Finds a tool by name.
 * @param {string} name
 * @returns {Object|undefined}
 */
function getTool(name) {
  return TOOLS.find((t) => t.name === name);
}

/**
 * Executes a tool by name with given parameters.
 * @param {string} name
 * @param {Object} params
 * @returns {Promise<Object>}
 */
async function executeTool(name, params = {}) {
  const tool = getTool(name);
  if (!tool) {
    throw new Error(`Tool '${name}' not found. Available: ${TOOLS.map((t) => t.name).join(', ')}`);
  }
  return safeExec(name, tool.handler, params);
}

/**
 * Returns tools grouped by category.
 * @returns {Object.<string, Array<Object>>}
 */
function getToolsByCategory() {
  return TOOLS.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push({ name: t.name, description: t.description });
    return acc;
  }, {});
}

module.exports = { TOOLS, getAllTools, getTool, executeTool, getToolsByCategory };
```

---

### `src/mcp/mcp-transport.js`

```javascript
'use strict';

/**
 * @fileoverview MCP transport layer — SSE + JSON-RPC 2.0 over HTTP.
 * Implements the MCP (Model Context Protocol) transport specification.
 * @module mcp/mcp-transport
 */

const { EventEmitter } = require('events');
const logger = require('../utils/logger');
const { getAllTools, executeTool } = require('./mcp-tools');

/**
 * @typedef {Object} JsonRpcRequest
 * @property {string} jsonrpc - Must be "2.0"
 * @property {string} method
 * @property {*} params
 * @property {string|number|null} id
 */

/**
 * @typedef {Object} JsonRpcResponse
 * @property {string} jsonrpc - "2.0"
 * @property {*} [result]
 * @property {Object} [error]
 * @property {string|number|null} id
 */

/**
 * @typedef {Object} SSEClient
 * @property {string} id
 * @property {Object} res - Express response object
 * @property {Date} connectedAt
 * @property {number} eventCount
 */

const JSONRPC_VERSION = '2.0';

const JSON_RPC_ERRORS = {
  PARSE_ERROR:      { code: -32700, message: 'Parse error' },
  INVALID_REQUEST:  { code: -32600, message: 'Invalid Request' },
  METHOD_NOT_FOUND: { code: -32601, message: 'Method not found' },
  INVALID_PARAMS:   { code: -32602, message: 'Invalid params' },
  INTERNAL_ERROR:   { code: -32603, message: 'Internal error' },
};

/**
 * MCP Transport — handles both SSE connections and JSON-RPC request dispatch.
 * Implements the MCP protocol methods: tools/list, tools/call, resources/list, prompts/list.
 */
class MCPTransport extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, SSEClient>} */
    this._clients = new Map();
    this._clientSeq = 0;
    this._requestCount = 0;
    this._errorCount = 0;
    this._startedAt = new Date().toISOString();

    logger.info('[mcp-transport] MCPTransport initialized');
  }

  // ─── SSE Connection Management ─────────────────────────────────────────

  /**
   * Handles a new SSE connection request.
   * Sets up the SSE response and registers the client.
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @returns {string} The new client ID
   */
  handleSSE(req, res) {
    const clientId = `sse-${++this._clientSeq}-${Date.now()}`;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    const client = { id: clientId, res, connectedAt: new Date(), eventCount: 0 };
    this._clients.set(clientId, client);

    logger.info(`[mcp-transport] SSE client connected: ${clientId}`, { total: this._clients.size });

    // Send initial connection event
    this._sendRaw(client, 'connected', { clientId, serverTime: new Date().toISOString(), protocolVersion: '1.0' });

    // Heartbeat every 30s to keep connection alive
    const heartbeat = setInterval(() => {
      if (!this._clients.has(clientId)) {
        clearInterval(heartbeat);
        return;
      }
      this._sendRaw(client, 'ping', { ts: Date.now() });
    }, 30000);

    // Cleanup on disconnect
    const cleanup = () => {
      clearInterval(heartbeat);
      this._clients.delete(clientId);
      logger.info(`[mcp-transport] SSE client disconnected: ${clientId}`, { remaining: this._clients.size });
      this.emit('client:disconnect', clientId);
    };

    req.on('close', cleanup);
    req.on('abort', cleanup);
    req.on('error', cleanup);

    this.emit('client:connect', clientId);
    return clientId;
  }

  /**
   * Sends an SSE event to a specific client.
   * @param {string} clientId
   * @param {string} event - Event type name
   * @param {Object} data - JSON-serializable data
   * @returns {boolean} true if sent, false if client not found
   */
  sendEvent(clientId, event, data) {
    const client = this._clients.get(clientId);
    if (!client) return false;
    return this._sendRaw(client, event, data);
  }

  /**
   * Broadcasts an SSE event to all connected clients.
   * @param {string} event
   * @param {Object} data
   * @returns {number} Number of clients reached
   */
  broadcast(event, data) {
    let count = 0;
    for (const client of this._clients.values()) {
      if (this._sendRaw(client, event, data)) count++;
    }
    return count;
  }

  /**
   * @private
   * @param {SSEClient} client
   * @param {string} event
   * @param {Object} data
   * @returns {boolean}
   */
  _sendRaw(client, event, data) {
    try {
      const id = ++client.eventCount;
      const payload = `id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      client.res.write(payload);
      return true;
    } catch (err) {
      logger.debug(`[mcp-transport] failed to send to client ${client.id}: ${err.message}`);
      this._clients.delete(client.id);
      return false;
    }
  }

  // ─── JSON-RPC Dispatch ─────────────────────────────────────────────────

  /**
   * Handles a JSON-RPC 2.0 request. Dispatches to the appropriate MCP method.
   * Responds via res.json().
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  async handleJSONRPC(req, res) {
    this._requestCount++;
    const body = req.body;

    // Batch requests
    if (Array.isArray(body)) {
      const responses = await Promise.all(body.map((r) => this._dispatch(r)));
      return res.json(responses);
    }

    // Validate structure
    if (!body || typeof body !== 'object') {
      this._errorCount++;
      return res.status(400).json(this._errorResponse(null, JSON_RPC_ERRORS.PARSE_ERROR));
    }

    if (body.jsonrpc !== JSONRPC_VERSION) {
      this._errorCount++;
      return res.status(400).json(this._errorResponse(body.id || null, JSON_RPC_ERRORS.INVALID_REQUEST));
    }

    const response = await this._dispatch(body);

    // Notifications (no id) don't get a response body
    if (body.id === undefined && !response.error) {
      return res.status(204).end();
    }

    return res.json(response);
  }

  /**
   * Streams a JSON-RPC call result via SSE.
   * The client must already be connected via handleSSE.
   * @param {Object} req - Express request (expects query.clientId)
   * @param {Object} res - Express response
   */
  async handleStreamingRPC(req, res) {
    const { clientId } = req.query;

    if (!clientId || !this._clients.has(clientId)) {
      return res.status(400).json({ error: 'Invalid or missing clientId. Connect to /api/mcp/stream first.' });
    }

    const body = req.body;
    if (!body || body.jsonrpc !== JSONRPC_VERSION) {
      return res.status(400).json({ error: 'Invalid JSON-RPC request' });
    }

    res.json({ accepted: true, clientId, requestId: body.id });

    // Dispatch asynchronously and stream result via SSE
    const dispatch = async () => {
      try {
        const response = await this._dispatch(body);
        this.sendEvent(clientId, 'rpc:response', response);
      } catch (err) {
        this.sendEvent(clientId, 'rpc:error', { error: err.message, requestId: body.id });
      }
    };
    dispatch();
  }

  /**
   * @private
   * Dispatches a single JSON-RPC request to the correct handler.
   * @param {JsonRpcRequest} request
   * @returns {Promise<JsonRpcResponse>}
   */
  async _dispatch(request) {
    const { method, params, id } = request;

    if (!method || typeof method !== 'string') {
      return this._errorResponse(id || null, JSON_RPC_ERRORS.INVALID_REQUEST);
    }

    logger.debug(`[mcp-transport] dispatch: ${method}`, { id });

    try {
      switch (method) {
        case 'tools/list':
          return this._successResponse(id, await this._handleToolsList(params));

        case 'tools/call':
          return this._successResponse(id, await this._handleToolsCall(params));

        case 'resources/list':
          return this._successResponse(id, await this._handleResourcesList(params));

        case 'prompts/list':
          return this._successResponse(id, await this._handlePromptsList(params));

        case 'ping':
          return this._successResponse(id, { pong: true, ts: Date.now() });

        case 'initialize':
          return this._successResponse(id, this._handleInitialize(params));

        default:
          return this._errorResponse(id, {
            ...JSON_RPC_ERRORS.METHOD_NOT_FOUND,
            message: `Method '${method}' not found`,
          });
      }
    } catch (err) {
      this._errorCount++;
      logger.error(`[mcp-transport] dispatch error for '${method}': ${err.message}`);
      return this._errorResponse(id, { ...JSON_RPC_ERRORS.INTERNAL_ERROR, data: err.message });
    }
  }

  // ─── MCP Method Handlers ──────────────────────────────────────────────

  /**
   * tools/list — Returns all available tools.
   * @param {Object} [params]
   * @returns {Promise<{tools: Array}>}
   */
  async _handleToolsList(params = {}) {
    const tools = getAllTools();
    const { category, limit, cursor } = params;

    let filtered = tools;
    if (category) {
      filtered = filtered.filter((t) => t.category === category);
    }

    const start = cursor ? parseInt(cursor, 10) : 0;
    const pageSize = limit || filtered.length;
    const page = filtered.slice(start, start + pageSize);
    const nextCursor = start + pageSize < filtered.length ? String(start + pageSize) : null;

    return {
      tools: page.map((t) => ({
        name: t.name,
        description: t.description,
        category: t.category,
        inputSchema: t.inputSchema,
      })),
      nextCursor,
      total: filtered.length,
    };
  }

  /**
   * tools/call — Executes a named tool.
   * @param {Object} params
   * @param {string} params.name
   * @param {Object} [params.arguments]
   * @returns {Promise<Object>}
   */
  async _handleToolsCall(params = {}) {
    const { name, arguments: args = {} } = params;
    if (!name) throw Object.assign(new Error('params.name is required'), { rpcCode: -32602 });

    logger.info(`[mcp-transport] executing tool: ${name}`);
    const result = await executeTool(name, args);

    // Format as MCP content response
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
      isError: !result.success,
      _meta: { tool: name, durationMs: result.durationMs },
    };
  }

  /**
   * resources/list — Lists available resources (memory store entries, etc.).
   * @param {Object} [params]
   * @returns {Promise<{resources: Array}>}
   */
  async _handleResourcesList(params = {}) {
    const resources = [
      {
        uri: 'heady://memory/store',
        name: 'HeadyStack Memory Store',
        description: 'Vector memory store for semantic search',
        mimeType: 'application/json',
      },
      {
        uri: 'heady://config/current',
        name: 'Current Configuration',
        description: 'Active runtime configuration',
        mimeType: 'application/json',
      },
      {
        uri: 'heady://telemetry/snapshot',
        name: 'Telemetry Snapshot',
        description: 'Current system metrics',
        mimeType: 'application/json',
      },
    ];

    return { resources };
  }

  /**
   * prompts/list — Lists available prompt templates.
   * @param {Object} [params]
   * @returns {Promise<{prompts: Array}>}
   */
  async _handlePromptsList(params = {}) {
    const prompts = [
      {
        name: 'system-health-report',
        description: 'Generate a system health report',
        arguments: [{ name: 'detailed', description: 'Include detailed metrics', required: false }],
      },
      {
        name: 'security-audit',
        description: 'Run a security audit and summarize findings',
        arguments: [{ name: 'target', description: 'Target directory', required: false }],
      },
      {
        name: 'deployment-plan',
        description: 'Generate a deployment plan for a target environment',
        arguments: [
          { name: 'environment', description: 'Target environment', required: true },
          { name: 'service', description: 'Service name', required: false },
        ],
      },
    ];

    return { prompts };
  }

  /**
   * initialize — MCP protocol initialization handshake.
   * @param {Object} [params]
   * @returns {Object}
   */
  _handleInitialize(params = {}) {
    return {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: { listChanged: false },
        resources: { subscribe: false, listChanged: false },
        prompts: { listChanged: false },
        logging: {},
      },
      serverInfo: {
        name: 'HeadyStack MCP Server',
        version: '1.0.0',
      },
    };
  }

  // ─── Response Builders ─────────────────────────────────────────────────

  /**
   * Builds a JSON-RPC success response.
   * @param {string|number|null} id
   * @param {*} result
   * @returns {JsonRpcResponse}
   */
  _successResponse(id, result) {
    return { jsonrpc: JSONRPC_VERSION, id: id ?? null, result };
  }

  /**
   * Builds a JSON-RPC error response.
   * @param {string|number|null} id
   * @param {{code: number, message: string, data?: *}} error
   * @returns {JsonRpcResponse}
   */
  _errorResponse(id, error) {
    return { jsonrpc: JSONRPC_VERSION, id: id ?? null, error };
  }

  // ─── Transport Stats ───────────────────────────────────────────────────

  /**
   * Returns current transport statistics.
   * @returns {Object}
   */
  getStats() {
    return {
      connectedClients: this._clients.size,
      totalRequests: this._requestCount,
      totalErrors: this._errorCount,
      startedAt: this._startedAt,
      uptime: process.uptime(),
    };
  }
}

module.exports = { MCPTransport };
```

---

### `src/mcp/colab-mcp-bridge.js`

```javascript
#!/usr/bin/env node
/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Heady MCP Multi-Transport Bridge ═══
 *
 * Exposes all 30+ Heady MCP tools via EVERY available transport:
 *   1. stdio  — direct pipe (fastest, local IDE)
 *   2. SSE    — Server-Sent Events (MCP native remote, Antigravity compatible)
 *   3. HTTP   — REST/JSON-RPC (universal, any client)
 *   4. WebSocket — persistent full-duplex (lowest latency for persistent connections)
 *
 * Also wires the GPUVectorStore for 3D vector space operations in Colab.
 *
 * Usage:
 *   HEADY_MCP_TRANSPORT=stdio   node colab-mcp-bridge.js   # local
 *   HEADY_MCP_TRANSPORT=http    node colab-mcp-bridge.js   # all HTTP transports
 *   HEADY_MCP_TRANSPORT=all     node colab-mcp-bridge.js   # everything
 */

const http = require('http');
const crypto = require('crypto');
const path = require('path');

// ── Configuration ────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || process.env.HEADY_MCP_PORT || '8420');
const TRANSPORT = process.env.HEADY_MCP_TRANSPORT || 'all';
const HEADY_DIR = process.env.HEADY_DIR || path.join(__dirname, '..', '..');

// ── GPUVectorStore — 3D Vector Space ─────────────────────────────
const { GPUVectorStore, GPU_CONFIG, setupNgrokTunnel } = require('../colab-runtime');
const vectorStore = new GPUVectorStore(384);

// ── Template Auto-Generation Directive ───────────────────────────
// Every task checks for existing templates and generates new HeadyBees/HeadySwarms
const { withTemplateAutoGen, getTemplateStats } = require('./template-auto-gen');

// ── Continuous Learning — Every interaction → 3D vector space ────
const { ContinuousLearner } = require('./continuous-learner');
const learner = new ContinuousLearner(vectorStore);

// ── Comprehensive Telemetry — Full Audit Trail + Optimization ──
const { HeadyTelemetry } = require('./heady-telemetry');
const telemetry = new HeadyTelemetry(vectorStore, learner);

// Seed with known directives, preferences, and identity
(function seedKnowledge() {
    // Identity
    learner.learnIdentity('Owner: HeadyConnection Inc. — Trademark serial 99680540, filed March 3 2026');
    learner.learnIdentity('Domains: headyme.com, headysystems.com, headyconnection.org, headybuddy.org, headymcp.com, headyio.com, headybot.com, headyos.com, headyapi.com');
    learner.learnIdentity('Platforms: GitHub HeadyMe org, HuggingFace HeadyMe/HeadySystems/HeadyConnection, Google Cloud, Cloudflare');
    learner.learnIdentity('Perplexity Enterprise Pro seat active');

    // Standing directives
    learner.learnDirective('Always use deep-research mode when initiating tasks');
    learner.learnDirective('Never keep items pending — do all autonomously ASAP');
    learner.learnDirective('Build template HeadyBees and HeadySwarms always and whenever doing tasks');
    learner.learnDirective('Ask if there are useful templates and data that can be made available for injection');
    learner.learnDirective('Speed is paramount when dealing with Heady — be quick');
    learner.learnDirective('Gather ALL possible data — user, project, environment — log for comprehensive audit trail and optimization');

    // Preferences
    learner.learnPreference('Multi-transport MCP: stdio + SSE + HTTP + WebSocket simultaneously');
    learner.learnPreference('Full autonomy — no waiting for approval, execute everything');
    learner.learnPreference('3D GPU vector space for all memory operations');
    learner.learnPreference('Comprehensive data gathering during and between interactions for optimization');

    console.log(`  🧠 Seeded ${learner.interactionCount} knowledge vectors`);
    console.log(`  📊 Telemetry: audit trail + optimization engine active`);
})();

// ── Project History Ingestion — Full codebase context on boot ────
const { ProjectHistoryIngestor } = require('./project-history-ingestor');
const historyIngestor = new ProjectHistoryIngestor(learner);
historyIngestor.ingestAll().catch(e => console.error(`  ⚠ History ingest error: ${e.message}`));

// ── Tool Registry ────────────────────────────────────────────────
// Full 33-tool registry: 30 from heady-mcp-server.js + 3 vector space tools.
// Embedded inline because heady-mcp-server.js is ESM with no exports
// and its main() auto-connects stdio, which kills this process.

let HEADY_TOOLS = [];

function loadMCPTools() {
    HEADY_TOOLS = [
        // heady_deep_scan merged into heady_analyze (type: 'deep-scan')
        { name: 'heady_auto_flow', description: 'Combined auto-flow: HeadyBattle + HeadyCoder + HeadyAnalyze + HeadyRisks + HeadyPatterns via HCFP.', inputSchema: { type: 'object', properties: { task: { type: 'string' }, code: { type: 'string' }, context: { type: 'string' } }, required: ['task'] } },
        { name: 'heady_chat', description: 'Chat with Heady Brain. Routes 100% through Heady AI.', inputSchema: { type: 'object', properties: { message: { type: 'string' }, system: { type: 'string' }, model: { type: 'string', default: 'heady-brain' }, temperature: { type: 'number', default: 0.7 }, max_tokens: { type: 'integer', default: 4096 } }, required: ['message'] } },
        { name: 'heady_complete', description: 'Code/text completion via Heady Brain.', inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, language: { type: 'string' }, max_tokens: { type: 'integer', default: 2048 } }, required: ['prompt'] } },
        { name: 'heady_analyze', description: 'Unified Heady analysis — code, deep-scan, web research (Perplexity Sonar Pro), architecture, security, performance. All analysis flows through this tool.', inputSchema: { type: 'object', properties: { content: { type: 'string' }, type: { type: 'string', enum: ['code', 'text', 'security', 'performance', 'architecture', 'general', 'deep-scan', 'research', 'academic', 'news'], default: 'general' }, language: { type: 'string' }, focus: { type: 'string' }, directory: { type: 'string' }, timeframe: { type: 'string', default: 'all' }, maxSources: { type: 'integer', default: 10 }, context: { type: 'string' } }, required: ['content'] } },
        { name: 'heady_embed', description: 'Generate vector embeddings via Heady embedding service.', inputSchema: { type: 'object', properties: { text: { type: 'string' }, model: { type: 'string', default: 'nomic-embed-text' } }, required: ['text'] } },
        { name: 'heady_health', description: 'Check health/status of all Heady services.', inputSchema: { type: 'object', properties: { service: { type: 'string', enum: ['all', 'brain', 'manager', 'hcfp', 'mcp'], default: 'all' } } } },
        { name: 'heady_deploy', description: 'Trigger deployment/service action via Heady Manager.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['deploy', 'restart', 'status', 'logs', 'scale'] }, service: { type: 'string' }, config: { type: 'object' } }, required: ['action'] } },
        { name: 'heady_search', description: 'Search Heady knowledge base and service catalog.', inputSchema: { type: 'object', properties: { query: { type: 'string' }, scope: { type: 'string', enum: ['all', 'registry', 'docs', 'services', 'knowledge'], default: 'all' }, limit: { type: 'integer', default: 10 } }, required: ['query'] } },
        { name: 'heady_memory', description: 'Search HeadyMemory (3D vector space) for persistent user facts.', inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'integer', default: 5 }, minScore: { type: 'number', default: 0.6 } }, required: ['query'] } },
        { name: 'heady_refactor', description: 'Code refactoring suggestions from Heady Brain.', inputSchema: { type: 'object', properties: { code: { type: 'string' }, language: { type: 'string' }, goals: { type: 'array', items: { type: 'string' } } }, required: ['code'] } },
        { name: 'heady_jules_task', description: 'Dispatch async background coding task to HeadyJules agent.', inputSchema: { type: 'object', properties: { task: { type: 'string' }, repository: { type: 'string' }, priority: { type: 'string', enum: ['low', 'normal', 'high', 'critical'], default: 'normal' }, autoCommit: { type: 'boolean', default: false } }, required: ['task', 'repository'] } },
        // heady_perplexity_research merged into heady_analyze (type: 'research'|'academic'|'news')
        { name: 'heady_huggingface_model', description: 'Search/interact with HeadyHub models via HuggingFace.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['search', 'info', 'inference'] }, modelId: { type: 'string' }, query: { type: 'string' } }, required: ['action'] } },
        { name: 'heady_soul', description: 'HeadySoul — intelligence, consciousness, and learning layer.', inputSchema: { type: 'object', properties: { content: { type: 'string' }, action: { type: 'string', enum: ['analyze', 'optimize', 'learn'], default: 'analyze' } }, required: ['content'] } },
        { name: 'heady_hcfp_status', description: 'HCFP auto-success engine status and metrics.', inputSchema: { type: 'object', properties: { detail: { type: 'string', enum: ['status', 'metrics', 'health'], default: 'status' } } } },
        { name: 'heady_orchestrator', description: 'HeadyOrchestrator — trinity communication and wavelength alignment.', inputSchema: { type: 'object', properties: { message: { type: 'string' }, action: { type: 'string', enum: ['send', 'status', 'align'], default: 'send' }, target: { type: 'string' } }, required: ['message'] } },
        { name: 'heady_battle', description: 'HeadyBattle Arena — AI node competition, evaluation, leaderboard.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['session', 'evaluate', 'arena', 'leaderboard', 'compare'] }, task: { type: 'string' }, code: { type: 'string' }, nodes: { type: 'array', items: { type: 'string' } } }, required: ['action'] } },
        { name: 'heady_patterns', description: 'Design pattern detection and deep code analysis.', inputSchema: { type: 'object', properties: { code: { type: 'string' }, action: { type: 'string', enum: ['analyze', 'library', 'suggest'], default: 'analyze' }, language: { type: 'string' } }, required: ['code'] } },
        { name: 'heady_risks', description: 'Risk assessment, vulnerability scanning, mitigation plans.', inputSchema: { type: 'object', properties: { content: { type: 'string' }, action: { type: 'string', enum: ['assess', 'mitigate', 'scan'], default: 'assess' }, scope: { type: 'string', default: 'all' } }, required: ['content'] } },
        { name: 'heady_coder', description: 'Code generation and multi-assistant workflows via HeadyCoder.', inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, action: { type: 'string', enum: ['generate', 'orchestrate', 'scaffold'], default: 'generate' }, language: { type: 'string' }, framework: { type: 'string' } }, required: ['prompt'] } },
        { name: 'heady_claude', description: 'Advanced reasoning via HeadyJules (Opus 4.6 Thinking 1M).', inputSchema: { type: 'object', properties: { message: { type: 'string' }, action: { type: 'string', enum: ['chat', 'think', 'analyze'], default: 'chat' }, system: { type: 'string' }, thinkingBudget: { type: 'integer', default: 32768 } }, required: ['message'] } },
        { name: 'heady_openai', description: 'HeadyCompute (GPT integration with function calling).', inputSchema: { type: 'object', properties: { message: { type: 'string' }, action: { type: 'string', enum: ['chat', 'complete'], default: 'chat' }, model: { type: 'string', default: 'gpt-4o' } }, required: ['message'] } },
        { name: 'heady_gemini', description: 'Multimodal AI via HeadyPythia.', inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, action: { type: 'string', enum: ['generate', 'analyze'], default: 'generate' } }, required: ['prompt'] } },
        { name: 'heady_groq', description: 'Ultra-fast inference via HeadyFast.', inputSchema: { type: 'object', properties: { message: { type: 'string' }, action: { type: 'string', enum: ['chat', 'complete'], default: 'chat' } }, required: ['message'] } },
        { name: 'heady_codex', description: 'Code generation/transformation via HeadyBuilder (GPT-Codex).', inputSchema: { type: 'object', properties: { code: { type: 'string' }, action: { type: 'string', enum: ['generate', 'transform', 'document'], default: 'generate' }, language: { type: 'string' } }, required: ['code'] } },
        { name: 'heady_copilot', description: 'Inline code suggestions via HeadyCopilot.', inputSchema: { type: 'object', properties: { code: { type: 'string' }, action: { type: 'string', enum: ['suggest', 'complete'], default: 'suggest' }, language: { type: 'string' } }, required: ['code'] } },
        { name: 'heady_ops', description: 'DevOps automation via HeadyOps.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['deploy', 'infrastructure', 'monitor', 'scale'] }, service: { type: 'string' }, config: { type: 'object' } }, required: ['action'] } },
        { name: 'heady_maid', description: 'System cleanup and scheduling via HeadyMaid.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['clean', 'schedule', 'status'], default: 'status' }, target: { type: 'string' } }, required: ['action'] } },
        { name: 'heady_maintenance', description: 'Health monitoring, backups, updates via HeadyMaintenance.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['status', 'backup', 'update', 'restore'], default: 'status' }, service: { type: 'string' } }, required: ['action'] } },
        { name: 'heady_lens', description: 'Visual analysis, image processing via HeadyLens.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['analyze', 'process', 'detect'], default: 'analyze' }, image_url: { type: 'string' }, prompt: { type: 'string' } }, required: ['action'] } },
        { name: 'heady_vinci', description: 'Pattern recognition and prediction via HeadyVinci.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['learn', 'predict', 'recognize'], default: 'predict' }, data: { type: 'string' } }, required: ['data'] } },
        { name: 'heady_buddy', description: 'HeadyBuddy — multi-provider personal AI assistant.', inputSchema: { type: 'object', properties: { message: { type: 'string' }, action: { type: 'string', enum: ['chat', 'memory', 'skills', 'tasks', 'providers'], default: 'chat' }, provider: { type: 'string', default: 'auto' } }, required: ['message'] } },
        { name: 'heady_notebooklm', description: 'Sync Heady Knowledge Vault to NotebookLM (11 pages).', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['sync', 'status', 'health'], default: 'sync' } } } },
        { name: 'heady_edge_ai', description: 'Cloudflare edge AI — embeddings, chat, classification, vector search.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['embed', 'chat', 'classify', 'vectorize-insert', 'vectorize-query', 'queue'] }, text: { type: 'string' }, message: { type: 'string' }, model: { type: 'string' }, topK: { type: 'number' } }, required: ['action'] } },
        // ── 3D Vector Space tools (bridge-only) ──
        { name: 'heady_vector_store', description: 'Store a vector embedding with metadata in the 3D GPU vector space.', inputSchema: { type: 'object', properties: { embedding: { type: 'array', items: { type: 'number' }, description: '384-dim float array' }, metadata: { type: 'object', description: 'Metadata to attach' } }, required: ['embedding'] } },
        { name: 'heady_vector_search', description: 'Search the 3D GPU vector space for semantically similar vectors.', inputSchema: { type: 'object', properties: { embedding: { type: 'array', items: { type: 'number' }, description: '384-dim query vector' }, topK: { type: 'integer', default: 5 } }, required: ['embedding'] } },
        { name: 'heady_vector_stats', description: 'Get 3D vector space statistics (count, memory, GPU status).', inputSchema: { type: 'object', properties: {} } },
        { name: 'heady_template_stats', description: 'Get template auto-generation stats (cached templates, active bees, swarm history).', inputSchema: { type: 'object', properties: {} } },
        { name: 'heady_learn', description: 'Store a learning (interaction, directive, preference, decision, identity) in 3D vector memory.', inputSchema: { type: 'object', properties: { content: { type: 'string', description: 'What to learn' }, category: { type: 'string', enum: ['directive', 'preference', 'interaction', 'decision', 'identity', 'pattern'], default: 'interaction' }, metadata: { type: 'object' } }, required: ['content'] } },
        { name: 'heady_recall', description: 'Search 3D vector memory for relevant past interactions and learnings.', inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'What to recall' }, topK: { type: 'integer', default: 5 } }, required: ['query'] } },
        { name: 'heady_memory_stats', description: 'Get continuous learning stats (interactions, directives, categories, memory usage).', inputSchema: { type: 'object', properties: {} } },
        { name: 'heady_telemetry', description: 'Get comprehensive telemetry stats (audit trail, tool call analytics, optimizations, environment).', inputSchema: { type: 'object', properties: {} } },
    ];
    console.log(`  📋 ${HEADY_TOOLS.length} MCP tools loaded (35 Heady + 8 bridge)`);
}

// ── Tool Handler ─────────────────────────────────────────────────
async function callTool(name, args) {
    // Vector space tools (handled locally)
    switch (name) {
        case 'heady_vector_store': {
            const result = vectorStore.store(args.embedding, args.metadata || {});
            return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        }
        case 'heady_vector_search': {
            const results = vectorStore.search(args.embedding, args.topK || 5);
            return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
        }
        case 'heady_vector_stats': {
            return { content: [{ type: 'text', text: JSON.stringify(vectorStore.getStats(), null, 2) }] };
        }
        case 'heady_template_stats': {
            return { content: [{ type: 'text', text: JSON.stringify(getTemplateStats(), null, 2) }] };
        }
        case 'heady_learn': {
            const result = learner.learn(args.content, args.category || 'interaction', args.metadata || {});
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'heady_recall': {
            const results = learner.recall(args.query, args.topK || 5);
            return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
        }
        case 'heady_memory_stats': {
            return { content: [{ type: 'text', text: JSON.stringify(learner.getStats(), null, 2) }] };
        }
        case 'heady_telemetry': {
            return { content: [{ type: 'text', text: JSON.stringify(telemetry.getStats(), null, 2) }] };
        }
        case 'heady_deep_scan': {
            // Backward compat — redirect to heady_analyze type: 'deep-scan'
            args.content = args.directory || 'project';
            args.type = 'deep-scan';
            // Fall through to heady_analyze
        }
        case 'heady_perplexity_research': {
            // Backward compat — redirect to heady_analyze type: 'research'
            if (name === 'heady_perplexity_research') {
                args.content = args.query || args.content;
                args.type = args.mode || 'research';
            }
            // Fall through to heady_analyze
        }
        case 'heady_analyze': {
            const analyzeType = args.type || 'general';

            // ── Research: direct Perplexity Sonar API ──
            if (['research', 'deep', 'academic', 'news', 'quick'].includes(analyzeType)) {
                const PPLX_KEY = process.env.PERPLEXITY_API_KEY;
                if (!PPLX_KEY) {
                    return { content: [{ type: 'text', text: 'PERPLEXITY_API_KEY not set' }], isError: true };
                }
                const modeMap = { quick: 'sonar', research: 'sonar-deep-research', deep: 'sonar-deep-research', academic: 'sonar-deep-research', news: 'sonar' };
                const model = modeMap[analyzeType] || 'sonar-deep-research';
                try {
                    const res = await fetch('https://api.perplexity.ai/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${PPLX_KEY}` },
                        body: JSON.stringify({
                            model,
                            messages: [
                                { role: 'system', content: 'You are a deep research specialist. Provide thorough analysis with citations and evidence.' },
                                { role: 'user', content: args.content || args.query },
                            ],
                            max_tokens: model === 'sonar-deep-research' ? 16384 : 4096,
                            temperature: 0.3,
                        }),
                        signal: AbortSignal.timeout(90000),
                    });
                    const data = await res.json();
                    // Persist to vector memory
                    try {
                        learner.learn(`[Research:${analyzeType}] ${(args.content || '').substring(0, 200)}`, 'interaction', { type: 'research', mode: analyzeType });
                    } catch (e) { /* non-critical */ }
                    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
                } catch (err) {
                    return { content: [{ type: 'text', text: `Perplexity Error: ${err.message}` }], isError: true };
                }
            }

            // ── Deep-scan: proxy to edge ──
            if (analyzeType === 'deep-scan') {
                break; // Fall through to HTTP proxy below, routed via routes map
            }

            // ── Standard analysis: proxy to brain ──
            break; // Fall through to HTTP proxy below
        }
    }

    // Route to Heady Manager via HTTP
    const HEADY_MANAGER_URL = process.env.HEADY_MANAGER_URL || 'https://manager.headysystems.com';
    const HEADY_BRAIN_URL = process.env.HEADY_BRAIN_URL || HEADY_MANAGER_URL;
    const HEADY_API_KEY = process.env.HEADY_API_KEY || '';

    const headers = {
        'Content-Type': 'application/json',
        ...(HEADY_API_KEY ? { 'Authorization': `Bearer ${HEADY_API_KEY}` } : {}),
        'X-Heady-Source': 'heady-mcp-bridge',
    };

    // Route map: tool name → API path
    const routes = {
        heady_chat: '/api/brain/chat',
        heady_complete: '/api/brain/generate',
        heady_analyze: '/api/brain/analyze',
        heady_embed: '/api/brain/embed',
        heady_health: '/api/health',
        heady_deploy: '/api/deploy',
        heady_search: '/api/brain/search',
        heady_memory: '/api/brain/memory',
        heady_deep_scan: '/api/edge/deep-scan',
        heady_auto_flow: '/api/hcfp/auto-flow',
        heady_refactor: '/api/brain/analyze',
        heady_jules_task: '/api/jules/task',
        heady_perplexity_research: '/api/perplexity/research',
        heady_huggingface_model: '/api/headyhub/model',
        heady_soul: '/api/soul/analyze',
        heady_hcfp_status: '/api/hcfp/status',
        heady_orchestrator: '/api/orchestrator/send',
        heady_battle: '/api/battle/session',
        heady_patterns: '/api/patterns/analyze',
        heady_risks: '/api/risks/assess',
        heady_coder: '/api/coder/generate',
        heady_claude: '/api/headyjules/chat',
        heady_openai: '/api/headycompute/chat',
        heady_gemini: '/api/headypythia/generate',
        heady_groq: '/api/groq/chat',
        heady_codex: '/api/codex/generate',
        heady_copilot: '/api/copilot/suggest',
        heady_ops: '/api/ops/deploy',
        heady_maid: '/api/maid/clean',
        heady_maintenance: '/api/maintenance/status',
        heady_lens: '/api/lens/analyze',
        heady_vinci: '/api/vinci/predict',
        heady_buddy: '/api/buddy/chat',
        heady_notebooklm: '/api/notebooklm/sync',
        heady_edge_ai: '/api/edge/chat',
    };

    const apiPath = routes[name];
    if (!apiPath) {
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }

    const base = apiPath.startsWith('/api/brain') ? HEADY_BRAIN_URL : HEADY_MANAGER_URL;
    const isGet = ['heady_health', 'heady_hcfp_status', 'heady_maintenance'].includes(name);

    try {
        const res = await fetch(`${base}${apiPath}`, {
            method: isGet ? 'GET' : 'POST',
            headers,
            ...(isGet ? {} : { body: JSON.stringify({ ...args, source: 'heady-mcp-bridge' }) }),
            signal: AbortSignal.timeout(30000),
        });
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
        return { content: [{ type: 'text', text: `Heady API Error: ${err.message}` }], isError: true };
    }
}

// ══════════════════════════════════════════════════════════════════
// TRANSPORT 1: stdio (MCP native — fastest for local IDE)
// ══════════════════════════════════════════════════════════════════
function startStdioTransport() {
    let buffer = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', async (chunk) => {
        buffer += chunk;
        // JSON-RPC messages are newline-delimited
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line in buffer
        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const msg = JSON.parse(line);
                const response = await handleJsonRpc(msg);
                if (response) {
                    process.stdout.write(JSON.stringify(response) + '\n');
                }
            } catch (e) {
                process.stderr.write(`stdio parse error: ${e.message}\n`);
            }
        }
    });
    process.stderr.write('[Heady MCP] stdio transport active\n');
}

// ══════════════════════════════════════════════════════════════════
// TRANSPORT 2: SSE (MCP native remote — Antigravity compatible)
// ══════════════════════════════════════════════════════════════════
const sseClients = new Map();

function handleSSE(req, res) {
    const clientId = crypto.randomUUID();
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
    });

    // Send endpoint info
    res.write(`event: endpoint\ndata: /mcp/message?clientId=${clientId}\n\n`);

    sseClients.set(clientId, res);
    req.on('close', () => sseClients.delete(clientId));
}

async function handleSSEMessage(req, res) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const clientId = url.searchParams.get('clientId');
    const sseRes = sseClients.get(clientId);

    const body = await parseBody(req);
    const response = await handleJsonRpc(body);

    // Send response via SSE channel
    if (sseRes && response) {
        sseRes.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
    }

    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
}

// ══════════════════════════════════════════════════════════════════
// TRANSPORT 3: HTTP REST/JSON-RPC (universal)
// ══════════════════════════════════════════════════════════════════
// Endpoints:
//   POST /mcp/rpc           — JSON-RPC 2.0
//   GET  /mcp/tools         — list tools
//   POST /mcp/tools/call    — call a tool
//   GET  /health            — health check
//   POST /vector/store      — store vector
//   POST /vector/search     — search vectors
//   GET  /vector/stats      — vector stats

// ══════════════════════════════════════════════════════════════════
// TRANSPORT 4: WebSocket (persistent full-duplex)
// ══════════════════════════════════════════════════════════════════
const wsClients = new Set();

function handleWebSocketUpgrade(req, socket, head) {
    // Minimal WebSocket handshake (RFC 6455)
    const key = req.headers['sec-websocket-key'];
    const accept = crypto.createHash('sha1')
        .update(key + '258EAFA5-E914-47DA-95CA-5AB5DC11E860')
        .digest('base64');

    socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );

    wsClients.add(socket);
    let msgBuffer = Buffer.alloc(0);

    socket.on('data', async (data) => {
        // Decode WebSocket frame
        const decoded = decodeWSFrame(data);
        if (!decoded) return;

        try {
            const msg = JSON.parse(decoded);
            const response = await handleJsonRpc(msg);
            if (response) {
                const frame = encodeWSFrame(JSON.stringify(response));
                socket.write(frame);
            }
        } catch (e) {
            const errFrame = encodeWSFrame(JSON.stringify({
                jsonrpc: '2.0', error: { code: -32700, message: e.message }, id: null
            }));
            socket.write(errFrame);
        }
    });

    socket.on('close', () => wsClients.delete(socket));
    socket.on('error', () => wsClients.delete(socket));
}

// WebSocket frame encode/decode (minimal, text frames only)
function decodeWSFrame(buf) {
    if (buf.length < 2) return null;
    const secondByte = buf[1];
    const masked = (secondByte & 0x80) !== 0;
    let payloadLen = secondByte & 0x7f;
    let offset = 2;

    if (payloadLen === 126) {
        payloadLen = buf.readUInt16BE(2);
        offset = 4;
    } else if (payloadLen === 127) {
        payloadLen = Number(buf.readBigUInt64BE(2));
        offset = 10;
    }

    let maskKey;
    if (masked) {
        maskKey = buf.slice(offset, offset + 4);
        offset += 4;
    }

    const payload = buf.slice(offset, offset + payloadLen);
    if (masked) {
        for (let i = 0; i < payload.length; i++) {
            payload[i] ^= maskKey[i % 4];
        }
    }

    return payload.toString('utf8');
}

function encodeWSFrame(text) {
    const payload = Buffer.from(text, 'utf8');
    let header;
    if (payload.length < 126) {
        header = Buffer.alloc(2);
        header[0] = 0x81; // fin + text
        header[1] = payload.length;
    } else if (payload.length < 65536) {
        header = Buffer.alloc(4);
        header[0] = 0x81;
        header[1] = 126;
        header.writeUInt16BE(payload.length, 2);
    } else {
        header = Buffer.alloc(10);
        header[0] = 0x81;
        header[1] = 127;
        header.writeBigUInt64BE(BigInt(payload.length), 2);
    }
    return Buffer.concat([header, payload]);
}

// ══════════════════════════════════════════════════════════════════
// JSON-RPC 2.0 Handler (shared by all transports)
// ══════════════════════════════════════════════════════════════════
async function handleJsonRpc(msg) {
    if (!msg || !msg.method) return null;

    switch (msg.method) {
        case 'initialize':
            return {
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                    protocolVersion: '2024-11-05',
                    capabilities: { tools: {}, resources: {}, prompts: {} },
                    serverInfo: { name: 'heady-mcp', version: '2.0.0' },
                },
            };

        case 'tools/list':
            return {
                jsonrpc: '2.0',
                id: msg.id,
                result: { tools: HEADY_TOOLS },
            };

        case 'tools/call': {
            const { name, arguments: args } = msg.params;
            const result = await callTool(name, args || {});
            return {
                jsonrpc: '2.0',
                id: msg.id,
                result,
            };
        }

        case 'resources/list':
            return {
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                    resources: [
                        { uri: 'heady://vector/stats', name: '3D Vector Space Stats', mimeType: 'application/json' },
                        { uri: 'heady://services/catalog', name: 'Heady Service Catalog', mimeType: 'application/json' },
                    ],
                },
            };

        case 'resources/read': {
            const { uri } = msg.params;
            let text;
            if (uri === 'heady://vector/stats') {
                text = JSON.stringify(vectorStore.getStats(), null, 2);
            } else {
                text = JSON.stringify({ error: `Unknown resource: ${uri}` });
            }
            return {
                jsonrpc: '2.0',
                id: msg.id,
                result: { contents: [{ uri, mimeType: 'application/json', text }] },
            };
        }

        case 'ping':
            return { jsonrpc: '2.0', id: msg.id, result: {} };

        case 'notifications/initialized':
            return null; // no response needed

        default:
            return {
                jsonrpc: '2.0',
                id: msg.id,
                error: { code: -32601, message: `Method not found: ${msg.method}` },
            };
    }
}

// ── Helpers ───────────────────────────────────────────────────────
function parseBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
            try { resolve(JSON.parse(body)); } catch { resolve({}); }
        });
    });
}

function jsonRes(res, code, data) {
    res.writeHead(code, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end(JSON.stringify(data));
}

// ══════════════════════════════════════════════════════════════════
// HTTP Server (handles SSE, REST, and serves health)
// ══════════════════════════════════════════════════════════════════
function startHTTPServer() {
    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, `http://localhost:${PORT}`);

        // CORS preflight
        if (req.method === 'OPTIONS') {
            res.writeHead(204, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            });
            return res.end();
        }

        // ── SSE endpoint ──
        if (url.pathname === '/sse' && req.method === 'GET') {
            return handleSSE(req, res);
        }
        if (url.pathname === '/mcp/message' && req.method === 'POST') {
            return handleSSEMessage(req, res);
        }

        // ── JSON-RPC endpoint ──
        if (url.pathname === '/mcp/rpc' && req.method === 'POST') {
            const body = await parseBody(req);
            const response = await handleJsonRpc(body);
            return jsonRes(res, 200, response || { jsonrpc: '2.0', result: null });
        }

        // ── REST: List tools ──
        if (url.pathname === '/mcp/tools' && req.method === 'GET') {
            return jsonRes(res, 200, { tools: HEADY_TOOLS, count: HEADY_TOOLS.length });
        }

        // ── REST: Call tool ──
        if (url.pathname === '/mcp/tools/call' && req.method === 'POST') {
            const body = await parseBody(req);
            const result = await callTool(body.name, body.arguments || {});
            return jsonRes(res, 200, result);
        }

        // ── Vector Space REST endpoints ──
        if (url.pathname === '/vector/store' && req.method === 'POST') {
            const body = await parseBody(req);
            const result = vectorStore.store(body.embedding, body.metadata || {});
            return jsonRes(res, 200, result);
        }
        if (url.pathname === '/vector/search' && req.method === 'POST') {
            const body = await parseBody(req);
            const results = vectorStore.search(body.embedding, body.topK || 5);
            return jsonRes(res, 200, { results });
        }
        if (url.pathname === '/vector/stats' && req.method === 'GET') {
            return jsonRes(res, 200, vectorStore.getStats());
        }

        // ── Health ──
        if (url.pathname === '/health') {
            return jsonRes(res, 200, {
                status: 'healthy',
                service: 'heady-mcp-bridge',
                version: '2.0.0',
                transports: {
                    stdio: TRANSPORT === 'stdio' || TRANSPORT === 'all',
                    sse: true,
                    http: true,
                    websocket: true,
                },
                vectorSpace: vectorStore.getStats(),
                gpu: GPU_CONFIG,
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
            });
        }

        // ── 404 ──
        jsonRes(res, 404, {
            error: 'Not found', endpoints: [
                'GET  /health', 'GET  /sse', 'POST /mcp/rpc', 'GET  /mcp/tools',
                'POST /mcp/tools/call', 'POST /vector/store', 'POST /vector/search',
                'GET  /vector/stats', 'WS   ws://host:port (WebSocket)',
            ]
        });
    });

    // WebSocket upgrade
    server.on('upgrade', (req, socket, head) => {
        if (req.headers.upgrade?.toLowerCase() === 'websocket') {
            handleWebSocketUpgrade(req, socket, head);
        } else {
            socket.destroy();
        }
    });

    server.listen(PORT, async () => {
        console.log(`\n  🐝 Heady MCP Multi-Transport Bridge`);
        console.log(`  ════════════════════════════════════`);
        console.log(`  📡 HTTP REST : http://localhost:${PORT}/mcp/tools`);
        console.log(`  📡 JSON-RPC  : http://localhost:${PORT}/mcp/rpc`);
        console.log(`  📡 SSE       : http://localhost:${PORT}/sse`);
        console.log(`  📡 WebSocket : ws://localhost:${PORT}`);
        console.log(`  📡 Health    : http://localhost:${PORT}/health`);
        console.log(`  🧠 Vectors   : ${vectorStore.getStats().vectorCount} stored (${vectorStore.getStats().dimensions}D)`);
        console.log(`  ⚡ GPU       : ${GPU_CONFIG.useGPU ? 'enabled' : 'CPU mode'}`);

        // ngrok tunnel for Colab
        const ngrokUrl = await setupNgrokTunnel(PORT);
        if (ngrokUrl) {
            console.log(`  🌐 ngrok     : ${ngrokUrl}`);
            console.log(`  🌐 SSE       : ${ngrokUrl}/sse`);
        }

        console.log(`  ════════════════════════════════════\n`);
    });
}

// ══════════════════════════════════════════════════════════════════
// MAIN — Boot all requested transports
// ══════════════════════════════════════════════════════════════════
async function main() {
    loadMCPTools();

    if (TRANSPORT === 'stdio') {
        startStdioTransport();
    } else if (TRANSPORT === 'http' || TRANSPORT === 'sse' || TRANSPORT === 'ws') {
        startHTTPServer();
    } else {
        // 'all' — start both stdio and HTTP
        startStdioTransport();
        startHTTPServer();
    }
}

main().catch(err => {
    console.error(`[Heady MCP Bridge] Fatal: ${err.message}`);
    process.exit(1);
});

module.exports = { callTool, vectorStore, HEADY_TOOLS, handleJsonRpc };
```

---

### `src/mcp/gateway/mcp-gateway.js`

```javascript
/**
 * Heady MCP Zero-Trust Gateway
 * ============================
 * Central gateway that routes MCP tool calls through the full security pipeline:
 *   Rate Limiter → CSL Router → Connection Pool → Zero-Trust Sandbox →
 *   Upstream MCP Server → Output Scanner → Audit Logger → Response
 *
 * Phi-scaled parameters throughout. No magic numbers.
 *
 * @module src/gateway/mcp-gateway
 * @version 1.0.0
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

const { EventEmitter } = require('events');
const {
  PHI, PSI, fib, CSL_THRESHOLDS, phiBackoff, cosineSimilarity,
  cslGate, phiFusionWeights, phiAdaptiveInterval,
} = require('../../shared/phi-math');

const { SemanticRateLimiter } = require('../security/rate-limiter');
const { ZeroTrustSandbox }    = require('../security/zero-trust-sandbox');
const { AuditLogger }         = require('../security/audit-logger');
const { OutputScanner }       = require('../security/output-scanner');
const { InputValidator }      = require('../security/input-validator');
const { RBACManager }         = require('../security/rbac-manager');
const { ConnectionPoolManager } = require('./connection-pool');

// ── CSL-Gated Tool Router ───────────────────────────────────────────────────
class CSLToolRouter {
  constructor(serverRegistry) {
    this.servers = new Map();       // namespace → { endpoint, tools, embedding }
    this.toolEmbeddings = new Map(); // toolName → Float32Array (384D)
    this._initRegistry(serverRegistry);
  }

  _initRegistry(registry) {
    for (const [namespace, config] of Object.entries(registry)) {
      this.servers.set(namespace, {
        endpoint: config.endpoint,
        transport: config.transport || 'streamable-http',
        tools: new Set(config.tools || []),
        embedding: config.embedding || null, // 384D semantic embedding
        weight: config.weight || 1.0,
        healthy: true,
      });
    }
  }

  /**
   * Route a tool call using 3-tier cascade:
   * 1. Namespace prefix match (exact: `github.createPR` → github server)
   * 2. CSL cosine similarity (threshold: MEDIUM ≈ 0.809)
   * 3. Load-balanced fallback (phi-weighted round-robin)
   */
  route(toolName, toolEmbedding = null) {
    // Tier 1: Exact namespace prefix
    const prefix = toolName.split('.')[0];
    if (this.servers.has(prefix) && this.servers.get(prefix).healthy) {
      return { server: prefix, method: 'namespace-prefix', confidence: 1.0 };
    }

    // Tier 2: CSL cosine similarity routing
    if (toolEmbedding) {
      let bestServer = null;
      let bestScore = -1;

      for (const [namespace, config] of this.servers) {
        if (!config.healthy || !config.embedding) continue;
        const score = cosineSimilarity(toolEmbedding, config.embedding);
        const gatedScore = cslGate(1.0, score, CSL_THRESHOLDS.MEDIUM);
        if (gatedScore > bestScore) {
          bestScore = gatedScore;
          bestServer = namespace;
        }
      }

      if (bestServer && bestScore > CSL_THRESHOLDS.MEDIUM) {
        return { server: bestServer, method: 'csl-cosine', confidence: bestScore };
      }
    }

    // Tier 3: Phi-weighted round-robin fallback among healthy servers
    const healthy = [...this.servers.entries()].filter(([, c]) => c.healthy);
    if (healthy.length === 0) throw new Error('No healthy MCP servers available');

    const weights = phiFusionWeights(healthy.length);
    const rand = Math.random();
    let cumulative = 0;
    for (let i = 0; i < healthy.length; i++) {
      cumulative += weights[i];
      if (rand <= cumulative) {
        return { server: healthy[i][0], method: 'phi-roundrobin', confidence: weights[i] };
      }
    }
    return { server: healthy[0][0], method: 'phi-roundrobin', confidence: weights[0] };
  }

  markUnhealthy(namespace) {
    const srv = this.servers.get(namespace);
    if (srv) srv.healthy = false;
  }

  markHealthy(namespace) {
    const srv = this.servers.get(namespace);
    if (srv) srv.healthy = true;
  }
}

// ── MCP Gateway ─────────────────────────────────────────────────────────────
class MCPGateway extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      serverRegistry: config.serverRegistry || {},
      jwtSecret: config.jwtSecret || process.env.HEADY_JWT_SECRET,
      auditLogPath: config.auditLogPath || './logs/mcp-audit.jsonl',
      maxConcurrent: config.maxConcurrent || fib(7),  // 13
      executionTimeoutMs: config.executionTimeoutMs || fib(7) * 1000, // 13s default
      ...config,
    };

    // Initialize all security layers
    this.router     = new CSLToolRouter(this.config.serverRegistry);
    this.pool       = new ConnectionPoolManager(this.config.serverRegistry);
    this.rateLimiter = new SemanticRateLimiter(config.rateLimiter || {});
    this.sandbox    = new ZeroTrustSandbox(config.sandbox || {});
    this.auditor    = new AuditLogger({ logPath: this.config.auditLogPath });
    this.scanner    = new OutputScanner(config.scanner || {});
    this.validator  = new InputValidator(config.validator || {});
    this.rbac       = new RBACManager(config.rbac || {});

    this._activeCalls = 0;
    this._metrics = {
      totalCalls: 0,
      blockedByRateLimit: 0,
      blockedByValidation: 0,
      blockedByRBAC: 0,
      sandboxViolations: 0,
      redactedOutputs: 0,
      avgLatencyMs: 0,
    };
  }

  /**
   * Execute an MCP tool call through the full security pipeline.
   * @param {Object} request - { tool, arguments, user, session, jwt }
   * @returns {Object} - { result, metadata }
   */
  async execute(request) {
    const startTime = Date.now();
    const { tool, arguments: args, user, session, jwt } = request;

    // ── Step 1: RBAC Check ──────────────────────────────────────────────
    const rbacResult = this.rbac.checkAccess(jwt, tool);
    if (!rbacResult.allowed) {
      this._metrics.blockedByRBAC++;
      await this.auditor.log({
        tool, user, action: 'RBAC_DENIED',
        reason: rbacResult.reason,
        duration_ms: Date.now() - startTime,
      });
      throw new SecurityError('ACCESS_DENIED', `RBAC denied: ${rbacResult.reason}`);
    }

    // ── Step 2: Rate Limiting ───────────────────────────────────────────
    const rateResult = await this.rateLimiter.check({
      tool, user, session,
      inputEmbedding: request.inputEmbedding || null,
    });
    if (!rateResult.allowed) {
      this._metrics.blockedByRateLimit++;
      await this.auditor.log({
        tool, user, action: 'RATE_LIMITED',
        reason: rateResult.reason,
        duration_ms: Date.now() - startTime,
      });
      return {
        result: null,
        metadata: {
          rateLimited: true,
          retryAfterMs: rateResult.retryAfterMs,
          headers: rateResult.headers,
        },
      };
    }

    // Semantic dedup — return cached if near-identical call
    if (rateResult.cachedResult) {
      await this.auditor.log({
        tool, user, action: 'DEDUP_HIT',
        duration_ms: Date.now() - startTime,
      });
      return { result: rateResult.cachedResult, metadata: { deduplicated: true } };
    }

    // ── Step 3: Input Validation ────────────────────────────────────────
    const validationResult = this.validator.validate(tool, args);
    if (!validationResult.safe) {
      this._metrics.blockedByValidation++;
      await this.auditor.log({
        tool, user, action: 'INPUT_REJECTED',
        threats: validationResult.threats,
        duration_ms: Date.now() - startTime,
      });
      throw new SecurityError('INPUT_REJECTED', validationResult.threats.join('; '));
    }

    // ── Step 4: CSL Route ───────────────────────────────────────────────
    const route = this.router.route(tool, request.toolEmbedding || null);

    // ── Step 5: Connection Pool → Sandbox → Execute ─────────────────────
    let rawResult;
    try {
      const connection = await this.pool.acquire(route.server);
      try {
        this._activeCalls++;
        rawResult = await this.sandbox.execute({
          tool,
          arguments: validationResult.sanitized,
          connection,
          user,
          jwt,
          timeoutMs: this.config.executionTimeoutMs,
          capabilities: rbacResult.capabilities,
        });
      } finally {
        this._activeCalls--;
        await this.pool.release(route.server, connection);
      }
    } catch (execError) {
      if (execError.type === 'SANDBOX_VIOLATION') {
        this._metrics.sandboxViolations++;
      }
      await this.auditor.log({
        tool, user, action: 'EXEC_FAILED',
        error: execError.message,
        route: route.server,
        duration_ms: Date.now() - startTime,
      });
      throw execError;
    }

    // ── Step 6: Output Scanning ─────────────────────────────────────────
    const scannedResult = this.scanner.scan(rawResult);
    if (scannedResult.redacted) {
      this._metrics.redactedOutputs++;
    }

    // ── Step 7: Audit Log ───────────────────────────────────────────────
    const duration = Date.now() - startTime;
    this._metrics.totalCalls++;
    this._metrics.avgLatencyMs =
      (this._metrics.avgLatencyMs * (this._metrics.totalCalls - 1) + duration)
      / this._metrics.totalCalls;

    await this.auditor.log({
      tool,
      user,
      action: 'EXECUTED',
      route: route.server,
      routeMethod: route.method,
      confidence: route.confidence,
      inputHash: this.auditor.hashInput(args),
      outputHash: this.auditor.hashOutput(scannedResult.output),
      redacted: scannedResult.redacted,
      duration_ms: duration,
    });

    // Cache for semantic dedup
    if (request.inputEmbedding) {
      await this.rateLimiter.cacheResult(request.inputEmbedding, scannedResult.output);
    }

    return {
      result: scannedResult.output,
      metadata: {
        route: route.server,
        routeMethod: route.method,
        confidence: route.confidence,
        duration_ms: duration,
        redacted: scannedResult.redacted,
        rateHeaders: rateResult.headers,
      },
    };
  }

  /**
   * Health check — meta.health tool per MCP gateway spec.
   */
  async health() {
    const serverHealth = {};
    for (const [ns, config] of this.router.servers) {
      serverHealth[ns] = {
        healthy: config.healthy,
        transport: config.transport,
        poolSize: this.pool.getPoolSize(ns),
      };
    }
    return {
      status: 'ok',
      activeCalls: this._activeCalls,
      metrics: { ...this._metrics },
      servers: serverHealth,
      auditChainValid: await this.auditor.verifyChain(),
    };
  }

  /**
   * Graceful shutdown — LIFO cleanup.
   */
  async shutdown() {
    this.emit('shutting-down');
    await this.auditor.flush();
    await this.pool.drainAll();
    this.emit('shutdown-complete');
  }
}

// ── Custom Error Types ──────────────────────────────────────────────────────
class SecurityError extends Error {
  constructor(type, message) {
    super(message);
    this.type = type;
    this.name = 'SecurityError';
  }
}

module.exports = { MCPGateway, CSLToolRouter, SecurityError };
```

---

### `src/mcp/security-index.js`

```javascript
/**
 * Heady MCP Security — Unified Entry Point
 * ==========================================
 * Import all security modules from a single entry.
 *
 * Usage:
 *   const { MCPGateway, RBACManager, AuditLogger } = require('@heady/mcp-security');
 *
 * @module @heady/mcp-security
 * @version 1.0.0
 */

'use strict';

// ── Foundation ──────────────────────────────────────────────────────────────
const phiMath = require('../shared/phi-math');

// ── Gateway ─────────────────────────────────────────────────────────────────
const { MCPGateway, CSLToolRouter, SecurityError } = require('./gateway/mcp-gateway');
const { ConnectionPoolManager, TransportAdapter } = require('./gateway/connection-pool');

// ── Security Modules ────────────────────────────────────────────────────────
const { ZeroTrustSandbox, ResourceTracker, SandboxViolation, CAPABILITIES, TOOL_PROFILES, DEFAULT_RESOURCE_LIMITS } = require('./security/zero-trust-sandbox');
const { SemanticRateLimiter, TokenBucket, SlidingWindowCounter, SemanticDedupCache, PriorityQueue } = require('./security/rate-limiter');
const { AuditLogger, SOC2_CRITERIA } = require('./security/audit-logger');
const { OutputScanner, PATTERNS: SCAN_PATTERNS } = require('./security/output-scanner');
const { RBACManager, ROLES, TOOL_OVERRIDES, JWT_ADAPTERS } = require('./security/rbac-manager');
const { InputValidator, THREAT_PATTERNS, BLOCKED_CIDRS } = require('./security/input-validator');
const { SecretRotationManager, InMemorySecretBackend, GCPSecretBackend, SECRET_TYPES, ROTATION_INTERVALS } = require('./security/secret-rotation');

module.exports = {
  // Foundation
  ...phiMath,

  // Gateway
  MCPGateway,
  CSLToolRouter,
  SecurityError,
  ConnectionPoolManager,
  TransportAdapter,

  // Security Modules
  ZeroTrustSandbox,
  ResourceTracker,
  SandboxViolation,
  CAPABILITIES,
  TOOL_PROFILES,
  DEFAULT_RESOURCE_LIMITS,

  SemanticRateLimiter,
  TokenBucket,
  SlidingWindowCounter,
  SemanticDedupCache,
  PriorityQueue,

  AuditLogger,
  SOC2_CRITERIA,

  OutputScanner,
  SCAN_PATTERNS,

  RBACManager,
  ROLES,
  TOOL_OVERRIDES,
  JWT_ADAPTERS,

  InputValidator,
  THREAT_PATTERNS,
  BLOCKED_CIDRS,

  SecretRotationManager,
  InMemorySecretBackend,
  GCPSecretBackend,
  SECRET_TYPES,
  ROTATION_INTERVALS,
};
```

---

### `src/mcp/continuous-learner.js`

```javascript
/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 *
 * Continuous Learning Module — Real-Time Interaction → 3D Vector Space
 *
 * Every interaction, preference, directive, decision, and behavioral
 * pattern is captured, embedded, and stored in the 3D GPU vector space.
 * This creates a living, searchable memory that improves over time.
 *
 * Categories:
 *   - directive:   Standing orders ("always use deep-research mode")
 *   - preference:  Style/workflow preferences ("never keep items pending")
 *   - interaction: Every tool call, question, feedback
 *   - decision:    Architecture/design choices
 *   - identity:    Personal/business info (HeadyConnection Inc., domains, etc.)
 *   - pattern:     Detected behavioral patterns
 */

const crypto = require('crypto');

class ContinuousLearner {
    constructor(vectorStore) {
        this.vectorStore = vectorStore;
        this.dimensions = 384;
        this.interactionCount = 0;
        this.directives = new Map();
        this.learnedPatterns = [];
        this._sessionStart = Date.now();
    }

    /**
     * Convert text to a deterministic embedding vector.
     * Uses SHA-512 hash → normalized float32 array.
     */
    _embed(text) {
        const hash = crypto.createHash('sha512').update(text).digest();
        const embedding = new Float32Array(this.dimensions);
        for (let i = 0; i < this.dimensions; i++) {
            embedding[i] = (hash[i % hash.length] / 255.0) * 2 - 1;
        }
        const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
        for (let i = 0; i < this.dimensions; i++) embedding[i] /= norm;
        return Array.from(embedding);
    }

    /**
     * Learn from any interaction — stores in vector space.
     */
    learn(content, category = 'interaction', metadata = {}) {
        this.interactionCount++;
        const embedding = this._embed(content);
        const fullMeta = {
            type: 'learning',
            category,
            content: content.substring(0, 500),
            timestamp: new Date().toISOString(),
            sessionUptime: Date.now() - this._sessionStart,
            interactionIndex: this.interactionCount,
            ...metadata,
        };

        const result = this.vectorStore.store(embedding, fullMeta);
        return { stored: true, category, index: result.index, vectorCount: result.vectorCount };
    }

    /**
     * Record a standing directive.
     */
    learnDirective(directive, source = 'user') {
        const id = `dir-${this.directives.size + 1}`;
        this.directives.set(id, {
            content: directive,
            source,
            learnedAt: new Date().toISOString(),
        });
        return this.learn(directive, 'directive', { directiveId: id, source });
    }

    /**
     * Record a preference.
     */
    learnPreference(preference) {
        return this.learn(preference, 'preference');
    }

    /**
     * Record a tool call interaction.
     */
    learnToolCall(toolName, args, resultSummary) {
        const content = `Tool: ${toolName} | Args: ${JSON.stringify(args).substring(0, 200)} | Result: ${resultSummary}`;
        return this.learn(content, 'interaction', { toolName });
    }

    /**
     * Record an identity fact.
     */
    learnIdentity(fact) {
        return this.learn(fact, 'identity');
    }

    /**
     * Record a decision/design choice.
     */
    learnDecision(decision) {
        return this.learn(decision, 'decision');
    }

    /**
     * Search memory for relevant context.
     */
    recall(query, topK = 5) {
        const embedding = this._embed(query);
        return this.vectorStore.search(embedding, topK);
    }

    /**
     * Get learning statistics.
     */
    getStats() {
        const vectorStats = this.vectorStore.getStats();
        const categories = {};
        // Count by category from vector metadata
        for (const vec of this.vectorStore.vectors || []) {
            const cat = vec?.metadata?.category || 'unknown';
            categories[cat] = (categories[cat] || 0) + 1;
        }

        return {
            totalInteractions: this.interactionCount,
            totalVectors: vectorStats.vectorCount,
            memoryMB: vectorStats.memoryMB,
            gpu: vectorStats.gpu,
            activeDirectives: this.directives.size,
            directives: Object.fromEntries(this.directives),
            categories,
            sessionUptime: `${((Date.now() - this._sessionStart) / 1000).toFixed(0)}s`,
        };
    }
}

module.exports = { ContinuousLearner };
```

---

### `src/mcp/connector-discovery.js`

```javascript
'use strict';

/**
 * Connector Auto-Discovery Protocol — CONN-003
 * Discovers MCP servers, API endpoints, and services
 * on the network via well-known paths and registry polling.
 */

const logger = require('../utils/logger');

const WELL_KNOWN_PATHS = ['/sse', '/.well-known/mcp', '/mcp/discover', '/health'];

class ConnectorDiscovery {
    constructor(opts = {}) {
        this.registry = new Map();
        this.scanInterval = opts.scanIntervalMs || 60000;
        this.endpoints = opts.endpoints || [];
        this._timer = null;
    }

    /**
     * Probe an endpoint for MCP capabilities.
     */
    async probe(endpoint) {
        const result = { endpoint, alive: false, capabilities: [], ts: Date.now() };
        try {
            const http = endpoint.startsWith('https') ? require('https') : require('http');
            for (const path of WELL_KNOWN_PATHS) {
                const url = `${endpoint}${path}`;
                const alive = await new Promise((resolve) => {
                    const req = http.get(url, { timeout: 5000 }, (res) => {
                        resolve(res.statusCode >= 200 && res.statusCode < 400);
                    });
                    req.on('error', () => resolve(false));
                    req.on('timeout', () => { req.destroy(); resolve(false); });
                });
                if (alive) {
                    result.alive = true;
                    result.capabilities.push(path);
                }
            }
        } catch (err) {
            result.error = err.message;
        }

        this.registry.set(endpoint, result);
        return result;
    }

    /**
     * Scan all configured endpoints.
     */
    async scan() {
        const results = [];
        for (const ep of this.endpoints) {
            const r = await this.probe(ep);
            results.push(r);
        }
        logger.logSystem(`  🔍 [Discovery] Scanned ${results.length} endpoints, ${results.filter(r => r.alive).length} alive`);
        return results;
    }

    /**
     * Start periodic scanning.
     */
    start() {
        if (this._timer) return;
        this._timer = setInterval(() => this.scan(), this.scanInterval);
        if (this._timer.unref) this._timer.unref();
        this.scan(); // immediate first scan
        return this;
    }

    stop() {
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
    }

    getStatus() {
        return {
            ok: true,
            endpointCount: this.endpoints.length,
            scanned: this.registry.size,
            alive: [...this.registry.values()].filter(r => r.alive).length,
            endpoints: [...this.registry.values()],
        };
    }
}

let _discovery = null;
function getDiscovery(opts) {
    if (!_discovery) _discovery = new ConnectorDiscovery(opts);
    return _discovery;
}

module.exports = { ConnectorDiscovery, getDiscovery };
```

---

### `src/middleware/mcp-auth.js`

```javascript
/**
 * T6: MCP Gateway Auth — SSO-integrated authentication for MCP servers
 * @module src/middleware/mcp-auth
 */
'use strict';

const crypto = require('crypto');
const { CircuitBreaker, TokenBucketRateLimiter } = require('../lib/circuit-breaker');

const MCP_RATE_LIMIT = parseInt(process.env.MCP_RATE_LIMIT || '100', 10);

class MCPGatewayAuth {
    constructor(opts = {}) {
        this.rateLimiter = new TokenBucketRateLimiter({ rate: MCP_RATE_LIMIT, burst: 20 });
        this.breaker = new CircuitBreaker({ failureThreshold: 5, recoveryTimeout: 30000 });
        this.allowedScopes = opts.scopes || ['tools.read', 'tools.execute', 'resources.read'];
        this._sessions = new Map();
    }

    // Validate MCP-specific JWT with scope checks
    async authenticate(req) {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return { authenticated: false, error: 'Missing authorization' };

        try {
            const [, payload] = token.split('.');
            const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());

            // Validate issued-for this MCP server
            if (decoded.aud && decoded.aud !== process.env.MCP_SERVER_ID) {
                return { authenticated: false, error: 'Token not issued for this MCP server' };
            }

            // Validate expiry
            if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
                return { authenticated: false, error: 'Token expired' };
            }

            // Validate scopes
            const tokenScopes = decoded.scope?.split(' ') || [];
            const hasScope = this.allowedScopes.some(s => tokenScopes.includes(s));
            if (!hasScope && tokenScopes.length > 0) {
                return { authenticated: false, error: 'Insufficient scopes' };
            }

            return {
                authenticated: true,
                user: { id: decoded.sub, email: decoded.email, scopes: tokenScopes, tenantId: decoded.org },
            };
        } catch (err) {
            return { authenticated: false, error: 'Invalid token' };
        }
    }

    // Session management with __Host- cookie prefix per MCP spec
    createSession(userId) {
        const sessionId = crypto.randomUUID();
        this._sessions.set(sessionId, {
            userId, createdAt: Date.now(),
            expiresAt: Date.now() + 600000, // 10 min
        });
        return sessionId;
    }

    validateSession(sessionId) {
        const session = this._sessions.get(sessionId);
        if (!session || session.expiresAt < Date.now()) {
            this._sessions.delete(sessionId);
            return null;
        }
        return session;
    }

    // Express middleware
    middleware() {
        return async (req, res, next) => {
            // Rate limit
            const rateResult = this.rateLimiter.consume(req.ip);
            if (!rateResult.allowed) {
                res.set('Retry-After', String(rateResult.retryAfter));
                return res.status(429).json({ error: 'MCP rate limit exceeded' });
            }

            // Authenticate
            const authResult = await this.authenticate(req);
            if (!authResult.authenticated) {
                return res.status(401).json({ error: authResult.error });
            }

            req.mcpUser = authResult.user;
            req.tenantId = authResult.user.tenantId;
            next();
        };
    }

    getMetrics() {
        return {
            activeSessions: this._sessions.size,
            circuitBreaker: this.breaker.getState(),
        };
    }
}

module.exports = MCPGatewayAuth;
```

---

### `src/resilience/circuit-breakers/mcp-breaker.js`

```javascript
/**
 * mcp-breaker.js
 * Circuit-breaker wrapper for MCP SDK tool calls (@modelcontextprotocol/sdk).
 *
 * Features
 * --------
 * - Per-tool circuit breakers (31 tools, each with its own breaker instance)
 * - Tool call timeout enforcement (default 10 s, configurable per tool)
 * - Fallback implementations for critical tools (marked as CRITICAL)
 * - Tool availability dashboard
 * - Global MCP SDK breaker (parent) + per-tool children
 * - Event emission on state changes
 *
 * @module enterprise-hardening/circuit-breaker/mcp-breaker
 */
'use strict';

const { EventEmitter } = require('events');
const { registry, EnhancedCircuitBreaker, PHI } = require('./external-api-breakers');
const { STATES } = require('../../circuit-breaker');

// ---------------------------------------------------------------------------
// Tool registry (31 MCP tools for headymcp-core)
// ---------------------------------------------------------------------------
/**
 * Each entry:
 *   name         — tool identifier
 *   timeoutMs    — per-tool timeout override (falls back to DEFAULT_TOOL_TIMEOUT_MS)
 *   critical     — whether a fallback implementation exists
 *   fallback     — async function that handles the call when breaker is OPEN
 *   description  — short description for dashboard
 */
const DEFAULT_TOOL_TIMEOUT_MS = 10_000;

const TOOL_REGISTRY = [
  // Core system tools
  { name: 'heady.ping',              timeoutMs: 2_000,  critical: true,  description: 'Liveness check' },
  { name: 'heady.echo',              timeoutMs: 2_000,  critical: true,  description: 'Echo input' },
  { name: 'heady.status',            timeoutMs: 5_000,  critical: true,  description: 'System status' },
  { name: 'heady.config.get',        timeoutMs: 5_000,  critical: false, description: 'Get configuration value' },
  { name: 'heady.config.set',        timeoutMs: 5_000,  critical: false, description: 'Set configuration value' },

  // Agent tools
  { name: 'heady.agent.spawn',       timeoutMs: 15_000, critical: false, description: 'Spawn a new agent' },
  { name: 'heady.agent.stop',        timeoutMs: 5_000,  critical: false, description: 'Stop a running agent' },
  { name: 'heady.agent.list',        timeoutMs: 5_000,  critical: true,  description: 'List active agents' },
  { name: 'heady.agent.send',        timeoutMs: 10_000, critical: false, description: 'Send message to agent' },
  { name: 'heady.agent.receive',     timeoutMs: 10_000, critical: false, description: 'Receive message from agent' },

  // Memory tools
  { name: 'heady.memory.store',      timeoutMs: 5_000,  critical: false, description: 'Store to memory' },
  { name: 'heady.memory.retrieve',   timeoutMs: 5_000,  critical: true,  description: 'Retrieve from memory' },
  { name: 'heady.memory.search',     timeoutMs: 10_000, critical: false, description: 'Semantic memory search' },
  { name: 'heady.memory.delete',     timeoutMs: 5_000,  critical: false, description: 'Delete memory entry' },
  { name: 'heady.memory.list',       timeoutMs: 5_000,  critical: false, description: 'List memory entries' },

  // LLM / model tools
  { name: 'heady.llm.generate',      timeoutMs: 30_000, critical: true,  description: 'LLM text generation' },
  { name: 'heady.llm.embed',         timeoutMs: 15_000, critical: false, description: 'Generate embeddings' },
  { name: 'heady.llm.stream',        timeoutMs: 30_000, critical: false, description: 'Streaming generation' },

  // File / storage tools
  { name: 'heady.file.read',         timeoutMs: 10_000, critical: true,  description: 'Read file' },
  { name: 'heady.file.write',        timeoutMs: 10_000, critical: false, description: 'Write file' },
  { name: 'heady.file.list',         timeoutMs: 5_000,  critical: true,  description: 'List files' },
  { name: 'heady.file.delete',       timeoutMs: 5_000,  critical: false, description: 'Delete file' },

  // Web / search tools
  { name: 'heady.web.fetch',         timeoutMs: 15_000, critical: false, description: 'Fetch URL' },
  { name: 'heady.web.search',        timeoutMs: 15_000, critical: false, description: 'Web search' },
  { name: 'heady.web.screenshot',    timeoutMs: 30_000, critical: false, description: 'Screenshot URL' },

  // Code tools
  { name: 'heady.code.run',          timeoutMs: 30_000, critical: false, description: 'Execute code' },
  { name: 'heady.code.lint',         timeoutMs: 10_000, critical: false, description: 'Lint code' },

  // Data tools
  { name: 'heady.data.query',        timeoutMs: 30_000, critical: false, description: 'Database query' },
  { name: 'heady.data.transform',    timeoutMs: 15_000, critical: false, description: 'Transform data' },

  // Workflow tools
  { name: 'heady.workflow.trigger',  timeoutMs: 10_000, critical: false, description: 'Trigger workflow' },
  { name: 'heady.workflow.status',   timeoutMs: 5_000,  critical: true,  description: 'Check workflow status' },
];

// ---------------------------------------------------------------------------
// Fallback implementations for CRITICAL tools
// ---------------------------------------------------------------------------
const CRITICAL_FALLBACKS = {
  'heady.ping': async (_params) => ({ pong: true, fallback: true, timestamp: Date.now() }),

  'heady.echo': async (params) => ({ echo: params?.input || '', fallback: true }),

  'heady.status': async (_params) => ({
    status: 'degraded',
    fallback: true,
    message: 'MCP SDK breaker OPEN — running in degraded mode',
    timestamp: new Date().toISOString(),
  }),

  'heady.agent.list': async (_params) => ({
    agents: [],
    fallback: true,
    message: 'Agent list unavailable while MCP circuit is open',
  }),

  'heady.memory.retrieve': async (params) => ({
    result: null,
    fallback: true,
    message: `Memory unavailable for key: ${params?.key || 'unknown'}`,
  }),

  'heady.llm.generate': async (params) => ({
    content: 'Service temporarily unavailable. Please retry shortly.',
    model: 'fallback',
    fallback: true,
    prompt: params?.prompt || '',
  }),

  'heady.file.read': async (params) => ({
    content: null,
    fallback: true,
    error: `File read unavailable for: ${params?.path || 'unknown'}`,
  }),

  'heady.file.list': async (params) => ({
    files: [],
    fallback: true,
    message: `File listing unavailable for: ${params?.dir || '/'}`,
  }),

  'heady.workflow.status': async (params) => ({
    status: 'unknown',
    fallback: true,
    workflowId: params?.workflowId || 'unknown',
  }),
};

// ---------------------------------------------------------------------------
// Timeout helper
// ---------------------------------------------------------------------------
function withTimeout(promise, ms, toolName) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`MCP tool timeout: ${toolName} (${ms}ms)`)),
      ms
    );
    promise.then(v => { clearTimeout(t); resolve(v); },
                 e => { clearTimeout(t); reject(e); });
  });
}

// ---------------------------------------------------------------------------
// MCPToolBreaker — manages per-tool breakers
// ---------------------------------------------------------------------------
class MCPToolBreaker extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {object}   [opts.mcpClient]       @modelcontextprotocol/sdk Client instance
   * @param {number}   [opts.defaultTimeoutMs]
   * @param {boolean}  [opts.useFallbacks]    Default: true
   */
  constructor(opts = {}) {
    super();
    this._client         = opts.mcpClient      || null;
    this._defaultTimeout = opts.defaultTimeoutMs || DEFAULT_TOOL_TIMEOUT_MS;
    this._useFallbacks   = opts.useFallbacks !== false;

    // Global MCP SDK breaker (parent)
    this._globalBreaker = registry.get('mcp-sdk');
    this._globalBreaker.on('stateChange', e => this.emit('stateChange', { ...e, scope: 'global' }));

    // Per-tool breakers — Map<toolName, EnhancedCircuitBreaker>
    this._toolBreakers = new Map();
    this._toolConfigs  = new Map();
    this._toolMetrics  = new Map();

    // Register all 31 tools
    for (const tool of TOOL_REGISTRY) {
      this._registerTool(tool);
    }
  }

  // -------------------------------------------------------------------------
  // Tool registration
  // -------------------------------------------------------------------------
  _registerTool(toolDef) {
    const { name, timeoutMs, critical, description, fallback } = toolDef;

    const breaker = new EnhancedCircuitBreaker(`mcp:${name}`, {
      failureThreshold: 5,
      recoveryTimeout:  30_000,
      halfOpenMaxCalls: 3,
      timeoutMs: timeoutMs || this._defaultTimeout,
    });

    breaker.on('stateChange', e => {
      this.emit('toolStateChange', { ...e, tool: name });
    });

    this._toolBreakers.set(name, breaker);
    this._toolConfigs.set(name, {
      timeoutMs: timeoutMs || this._defaultTimeout,
      critical: !!critical,
      description: description || name,
      fallback: fallback || CRITICAL_FALLBACKS[name] || null,
    });
    this._toolMetrics.set(name, { calls: 0, failures: 0, fallbackCalls: 0, lastError: null });
  }

  /**
   * Dynamically register an additional tool not in the default 31.
   * @param {object} toolDef
   */
  registerTool(toolDef) {
    if (this._toolBreakers.has(toolDef.name)) return; // already registered
    this._registerTool(toolDef);
  }

  setClient(client) { this._client = client; }

  // -------------------------------------------------------------------------
  // Core call() — main entry point
  // -------------------------------------------------------------------------
  /**
   * Call an MCP tool with full circuit-breaker protection.
   *
   * @param {string} toolName   MCP tool name (e.g. 'heady.memory.retrieve')
   * @param {object} [params]   Tool parameters
   * @returns {Promise<any>}
   */
  async call(toolName, params = {}) {
    const metrics = this._toolMetrics.get(toolName);
    const config  = this._toolConfigs.get(toolName);
    const breaker = this._toolBreakers.get(toolName);

    if (!breaker) {
      // Unknown tool — register it dynamically and proceed
      this.registerTool({ name: toolName });
      return this.call(toolName, params);
    }

    metrics.calls++;

    // If global MCP breaker is OPEN, check for fallback
    if (this._globalBreaker.state === STATES.OPEN) {
      return this._handleFallback(toolName, params, config, metrics, new Error('Global MCP circuit is OPEN'));
    }

    // If per-tool breaker is OPEN, check for fallback
    if (breaker.state === STATES.OPEN) {
      return this._handleFallback(toolName, params, config, metrics, new Error(`Tool circuit ${toolName} is OPEN`));
    }

    const timeoutMs = config?.timeoutMs || this._defaultTimeout;

    try {
      const result = await breaker.execute(() =>
        this._globalBreaker.execute(() => {
          if (!this._client) throw new Error('MCPToolBreaker: MCP client not initialised');
          return withTimeout(
            this._client.callTool({ name: toolName, arguments: params }),
            timeoutMs,
            toolName
          );
        })
      );

      return result;
    } catch (err) {
      metrics.failures++;
      metrics.lastError = err.message;
      return this._handleFallback(toolName, params, config, metrics, err);
    }
  }

  // -------------------------------------------------------------------------
  // Fallback handling
  // -------------------------------------------------------------------------
  async _handleFallback(toolName, params, config, metrics, originalErr) {
    if (!this._useFallbacks) throw originalErr;

    const fallbackFn = config?.fallback || CRITICAL_FALLBACKS[toolName];

    if (!fallbackFn) {
      this.emit('toolFailed', { tool: toolName, error: originalErr.message, fallback: false });
      throw originalErr;
    }

    try {
      metrics.fallbackCalls++;
      const result = await fallbackFn(params);
      this.emit('toolFallback', { tool: toolName, reason: originalErr.message });
      return result;
    } catch (fallbackErr) {
      this.emit('toolFailed', { tool: toolName, error: fallbackErr.message, fallback: true });
      throw new Error(`${toolName} and its fallback both failed: ${fallbackErr.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // Batch call (parallel, with individual error handling)
  // -------------------------------------------------------------------------
  /**
   * Call multiple tools in parallel.
   * Returns an array of { toolName, result?, error? } objects.
   *
   * @param {Array<{name: string, params?: object}>} calls
   */
  async callBatch(calls) {
    return Promise.all(
      calls.map(async ({ name, params }) => {
        try {
          const result = await this.call(name, params);
          return { toolName: name, result };
        } catch (err) {
          return { toolName: name, error: err.message };
        }
      })
    );
  }

  // -------------------------------------------------------------------------
  // Tool availability dashboard
  // -------------------------------------------------------------------------
  /**
   * Returns availability status for all registered tools.
   */
  dashboard() {
    const tools = {};
    for (const [name, breaker] of this._toolBreakers.entries()) {
      const config  = this._toolConfigs.get(name);
      const metrics = this._toolMetrics.get(name);
      tools[name] = {
        state:         breaker.state,
        available:     breaker.state !== STATES.OPEN,
        critical:      config.critical,
        hasFallback:   !!(config.fallback || CRITICAL_FALLBACKS[name]),
        description:   config.description,
        timeoutMs:     config.timeoutMs,
        calls:         metrics.calls,
        failures:      metrics.failures,
        fallbackCalls: metrics.fallbackCalls,
        lastError:     metrics.lastError,
        p99LatencyMs:  breaker.p99LatencyMs,
      };
    }

    const toolList = Object.values(tools);
    return {
      timestamp: new Date().toISOString(),
      global: this._globalBreaker.snapshot(),
      summary: {
        total:          toolList.length,
        available:      toolList.filter(t => t.available).length,
        open:           toolList.filter(t => !t.available).length,
        critical:       toolList.filter(t => t.critical).length,
        withFallback:   toolList.filter(t => t.hasFallback).length,
      },
      tools,
    };
  }

  // -------------------------------------------------------------------------
  // Reset helpers
  // -------------------------------------------------------------------------
  resetTool(toolName) {
    const b = this._toolBreakers.get(toolName);
    if (!b) throw new Error(`Unknown tool: ${toolName}`);
    b.reset();
    const m = this._toolMetrics.get(toolName);
    m.calls = 0; m.failures = 0; m.fallbackCalls = 0; m.lastError = null;
  }

  resetAll() {
    this._globalBreaker.reset();
    for (const [name] of this._toolBreakers) this.resetTool(name);
  }

  // -------------------------------------------------------------------------
  // Express route handler factories
  // -------------------------------------------------------------------------
  dashboardHandler() {
    return (_req, res) => res.json(this.dashboard());
  }

  resetToolHandler() {
    return (req, res) => {
      const { tool } = req.params;
      try {
        this.resetTool(tool);
        res.json({ tool, reset: true });
      } catch (err) {
        res.status(404).json({ error: err.message });
      }
    };
  }

  registerRoutes(app) {
    app.get('/api/mcp/breakers',           this.dashboardHandler());
    app.post('/api/mcp/breakers/:tool/reset', this.resetToolHandler());
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------
const mcpBreaker = new MCPToolBreaker();

module.exports = {
  mcpBreaker,
  MCPToolBreaker,
  TOOL_REGISTRY,
  CRITICAL_FALLBACKS,
  DEFAULT_TOOL_TIMEOUT_MS,
};
```

---

### `src/bees/mcp-bee.js`

```javascript
/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 * MCP Bee — Covers heady-mcp-server.js (1183 lines)
 * MCP tool registration, protocol handling, tool execution
 */
const domain = 'mcp';
const description = 'MCP server: tool registration, protocol handling, tool execution';
const priority = 0.9;

function getWork(ctx = {}) {
    return [
        async () => {
            try {
                const mod = require('../mcp/heady-mcp-server');
                return { bee: domain, action: 'mcp-server', loaded: true };
            } catch { return { bee: domain, action: 'mcp-server', loaded: false }; }
        },
    ];
}

module.exports = { domain, description, priority, getWork };
```

---

### `src/bridge/midi-to-mcp-bridge.js`

```javascript
/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
// RTP: MIDI-to-MCP Protocol Bridge - HS-series Hardware Gesture Control

'use strict';

const crypto = require('crypto');

const PHI = 1.6180339887;

// ─── MIDI Constants ────────────────────────────────────────────────────────────

const MIDI_STATUS = {
  NOTE_OFF:        0x80,
  NOTE_ON:         0x90,
  POLY_PRESSURE:   0xA0,
  CONTROL_CHANGE:  0xB0,
  PROGRAM_CHANGE:  0xC0,
  CHANNEL_PRESSURE:0xD0,
  PITCH_BEND:      0xE0,
  SYSEX_START:     0xF0,
  SYSEX_END:       0xF7,
  TIMING_CLOCK:    0xF8,
  ACTIVE_SENSING:  0xFE,
  SYSTEM_RESET:    0xFF,
};

const MIDI2_MESSAGE_TYPE = {
  UTILITY:          0x0,
  SYSTEM:           0x1,
  MIDI1_CHANNEL:    0x2,
  SYSEX7:           0x3,
  MIDI2_CHANNEL:    0x4,
  SYSEX8:           0x5,
};

const DEFAULT_CC_MAP = {
  7:  { tool: 'set_volume',      param: 'level',       scale: [0, 1] },
  10: { tool: 'set_pan',         param: 'position',    scale: [-1, 1] },
  11: { tool: 'set_expression',  param: 'value',       scale: [0, 1] },
  74: { tool: 'adjust_temperature', param: 'temperature', scale: [0, 2] },
  75: { tool: 'adjust_top_p',    param: 'top_p',       scale: [0, 1] },
  76: { tool: 'adjust_max_tokens', param: 'max_tokens', scale: [64, 4096] },
};

const DEFAULT_NOTE_MAP = {
  60: { tool: 'trigger_deploy',    params: {} },        // C4
  62: { tool: 'trigger_test',      params: {} },        // D4
  64: { tool: 'trigger_rollback',  params: {} },        // E4
  65: { tool: 'pause_agent',       params: {} },        // F4
  67: { tool: 'resume_agent',      params: {} },        // G4
  69: { tool: 'snapshot_state',    params: {} },        // A4
  71: { tool: 'clear_memory',      params: {} },        // B4
  72: { tool: 'trigger_health_check', params: {} },     // C5
};

// ─── MidiParser ───────────────────────────────────────────────────────────────

class MidiParser {
  /**
   * Parse raw MIDI 1.0 byte buffer into structured events.
   * @param {Buffer|Uint8Array} bytes
   * @returns {Array<Object>} parsed MIDI events
   */
  static parse(bytes) {
    if (!bytes || bytes.length === 0) return [];
    const events = [];
    let i = 0;
    let runningStatus = 0;

    while (i < bytes.length) {
      const byte = bytes[i];

      // Skip real-time messages inline
      if (byte === MIDI_STATUS.TIMING_CLOCK ||
          byte === MIDI_STATUS.ACTIVE_SENSING) {
        i++;
        continue;
      }

      // SysEx
      if (byte === MIDI_STATUS.SYSEX_START) {
        const sysexEnd = Array.from(bytes).indexOf(MIDI_STATUS.SYSEX_END, i + 1);
        if (sysexEnd === -1) break;
        const data = Buffer.from(bytes.slice(i + 1, sysexEnd));
        events.push({ type: 'sysex', manufacturerId: data[0], data });
        i = sysexEnd + 1;
        runningStatus = 0;
        continue;
      }

      // Status byte?
      if (byte & 0x80) {
        runningStatus = byte;
        i++;
      }

      const status  = runningStatus & 0xF0;
      const channel = runningStatus & 0x0F;

      switch (status) {
        case MIDI_STATUS.NOTE_OFF: {
          const note     = bytes[i]   || 0;
          const velocity = bytes[i+1] || 0;
          events.push({ type: 'note_off', channel, note, velocity });
          i += 2;
          break;
        }
        case MIDI_STATUS.NOTE_ON: {
          const note     = bytes[i]   || 0;
          const velocity = bytes[i+1] || 0;
          // Note On with velocity 0 = Note Off
          const type = velocity === 0 ? 'note_off' : 'note_on';
          events.push({ type, channel, note, velocity });
          i += 2;
          break;
        }
        case MIDI_STATUS.POLY_PRESSURE: {
          events.push({ type: 'poly_pressure', channel, note: bytes[i], pressure: bytes[i+1] });
          i += 2;
          break;
        }
        case MIDI_STATUS.CONTROL_CHANGE: {
          events.push({ type: 'control_change', channel, controller: bytes[i], value: bytes[i+1] });
          i += 2;
          break;
        }
        case MIDI_STATUS.PROGRAM_CHANGE: {
          events.push({ type: 'program_change', channel, program: bytes[i] });
          i += 1;
          break;
        }
        case MIDI_STATUS.CHANNEL_PRESSURE: {
          events.push({ type: 'channel_pressure', channel, pressure: bytes[i] });
          i += 1;
          break;
        }
        case MIDI_STATUS.PITCH_BEND: {
          const lsb   = bytes[i]   || 0;
          const msb   = bytes[i+1] || 0;
          const bend  = ((msb << 7) | lsb) - 8192;
          events.push({ type: 'pitch_bend', channel, bend, normalized: bend / 8192 });
          i += 2;
          break;
        }
        default:
          i++;
          break;
      }
    }
    return events;
  }

  /**
   * Parse MIDI 2.0 Universal MIDI Packet (32-bit words).
   * @param {Uint32Array|Array<number>} words
   * @returns {Array<Object>} parsed UMP events
   */
  static parseUMP(words) {
    if (!words || words.length === 0) return [];
    const events = [];

    for (let i = 0; i < words.length; ) {
      const w0       = words[i];
      const msgType  = (w0 >>> 28) & 0xF;
      const group    = (w0 >>> 24) & 0xF;

      switch (msgType) {
        case MIDI2_MESSAGE_TYPE.UTILITY:
          events.push({ type: 'utility', group, data: w0 & 0x00FFFFFF });
          i += 1;
          break;

        case MIDI2_MESSAGE_TYPE.MIDI1_CHANNEL: {
          const status  = (w0 >>> 16) & 0xFF;
          const byte1   = (w0 >>>  8) & 0xFF;
          const byte2   =  w0         & 0xFF;
          const channel = status & 0x0F;
          const opcode  = status & 0xF0;
          events.push({ type: 'midi1_channel', group, opcode, channel, byte1, byte2 });
          i += 1;
          break;
        }

        case MIDI2_MESSAGE_TYPE.MIDI2_CHANNEL: {
          if (i + 1 >= words.length) { i++; break; }
          const w1      = words[i+1];
          const status  = (w0 >>> 16) & 0xFF;
          const channel = status & 0x0F;
          const opcode  = status & 0xF0;
          const index   = (w0 >>>  8) & 0xFF;
          const value32 = w1; // 32-bit value
          events.push({ type: 'midi2_channel', group, opcode, channel, index, value32,
                        normalizedValue: value32 / 0xFFFFFFFF });
          i += 2;
          break;
        }

        case MIDI2_MESSAGE_TYPE.SYSEX7: {
          const numWords = (w0 >>> 24) & 0x3;
          const dataWords = Array.from(words).slice(i, i + numWords + 1);
          events.push({ type: 'sysex7', group, words: dataWords });
          i += numWords + 1;
          break;
        }

        default:
          i++;
          break;
      }
    }
    return events;
  }

  /**
   * Encode a MIDI Note On message to bytes.
   */
  static encodeNoteOn(channel, note, velocity) {
    return Buffer.from([
      (MIDI_STATUS.NOTE_ON | (channel & 0x0F)),
      note & 0x7F,
      velocity & 0x7F,
    ]);
  }

  /**
   * Encode a MIDI Control Change message to bytes.
   */
  static encodeCC(channel, controller, value) {
    return Buffer.from([
      (MIDI_STATUS.CONTROL_CHANGE | (channel & 0x0F)),
      controller & 0x7F,
      value & 0x7F,
    ]);
  }
}

// ─── GestureRecognizer ────────────────────────────────────────────────────────

class GestureRecognizer {
  constructor(opts = {}) {
    this._windowMs   = opts.windowMs   || 500;
    this._padThresh  = opts.padThresh  || 64;
    this._knobDelta  = opts.knobDelta  || 3;
    this._history    = [];
    this._maxHistory = opts.maxHistory || 64;
  }

  /**
   * Feed a parsed MIDI event; returns detected gesture or null.
   */
  recognize(event) {
    const ts = Date.now();
    this._history.push({ ts, event });
    if (this._history.length > this._maxHistory) this._history.shift();

    switch (event.type) {
      case 'note_on':
        return this._detectPadHit(event, ts);
      case 'control_change':
        return this._detectKnobOrFader(event, ts);
      case 'pitch_bend':
        return { gesture: 'pitch_wheel', channel: event.channel,
                 direction: event.normalized > 0 ? 'up' : 'down',
                 magnitude: Math.abs(event.normalized) };
      case 'program_change':
        return { gesture: 'preset_select', channel: event.channel, preset: event.program };
      default:
        return null;
    }
  }

  _detectPadHit(event, ts) {
    const velocity = event.velocity;
    const intensity = velocity >= this._padThresh ? 'hard' : 'soft';

    // Detect double-tap within window
    const recent = this._history.filter(h =>
      h.event.type === 'note_on' &&
      h.event.note === event.note &&
      (ts - h.ts) < this._windowMs &&
      h.ts !== ts
    );

    return {
      gesture:   recent.length >= 1 ? 'double_tap' : 'pad_hit',
      note:      event.note,
      channel:   event.channel,
      velocity,
      intensity,
    };
  }

  _detectKnobOrFader(event, ts) {
    // Knobs typically use relative CC or high-res CC7/11; faders are absolute
    const isFader = [7, 11, 91, 93, 95].includes(event.controller);
    const gesture = isFader ? 'fader_slide' : 'knob_turn';
    const direction = event.value > 64 ? 'increase' : (event.value < 63 ? 'decrease' : 'center');

    return {
      gesture,
      controller: event.controller,
      channel:    event.channel,
      value:      event.value,
      direction,
      normalized: event.value / 127,
    };
  }

  clearHistory() {
    this._history = [];
  }
}

// ─── MidiToMcpTranslator ──────────────────────────────────────────────────────

class MidiToMcpTranslator {
  constructor(opts = {}) {
    this._ccMap      = Object.assign({}, DEFAULT_CC_MAP, opts.ccMap || {});
    this._noteMap    = Object.assign({}, DEFAULT_NOTE_MAP, opts.noteMap || {});
    this._profiles   = opts.profiles  || {};
    this._activeProfile = opts.defaultProfile || null;
    this._requestId  = 0;
  }

  /**
   * Load a named mapping profile.
   */
  loadProfile(name) {
    if (!this._profiles[name]) throw new Error(`Profile not found: ${name}`);
    const p = this._profiles[name];
    if (p.ccMap)   this._ccMap   = Object.assign({}, DEFAULT_CC_MAP, p.ccMap);
    if (p.noteMap) this._noteMap = Object.assign({}, DEFAULT_NOTE_MAP, p.noteMap);
    this._activeProfile = name;
  }

  /**
   * Register a custom mapping profile.
   */
  registerProfile(name, profile) {
    this._profiles[name] = profile;
  }

  /**
   * Translate a parsed MIDI event to an MCP tool call descriptor.
   * Returns null if no mapping exists.
   */
  translate(midiEvent) {
    switch (midiEvent.type) {
      case 'control_change':
        return this._ccToMcp(midiEvent);
      case 'note_on':
        return this._noteToMcp(midiEvent);
      case 'program_change':
        return this._programToMcp(midiEvent);
      case 'pitch_bend':
        return this._pitchBendToMcp(midiEvent);
      default:
        return null;
    }
  }

  _ccToMcp(event) {
    const mapping = this._ccMap[event.controller];
    if (!mapping) return null;
    const [lo, hi] = mapping.scale;
    const paramValue = lo + (event.value / 127) * (hi - lo);
    return {
      tool:   mapping.tool,
      params: { [mapping.param]: +paramValue.toFixed(4) },
      meta:   { source: 'midi_cc', controller: event.controller, channel: event.channel },
    };
  }

  _noteToMcp(event) {
    const mapping = this._noteMap[event.note];
    if (!mapping) return null;
    return {
      tool:   mapping.tool,
      params: Object.assign({}, mapping.params, { velocity: event.velocity }),
      meta:   { source: 'midi_note', note: event.note, channel: event.channel },
    };
  }

  _programToMcp(event) {
    return {
      tool:   'select_program',
      params: { program: event.program, channel: event.channel },
      meta:   { source: 'midi_program_change' },
    };
  }

  _pitchBendToMcp(event) {
    return {
      tool:   'set_pitch_bend',
      params: { bend: event.bend, normalized: event.normalized },
      meta:   { source: 'midi_pitch_bend', channel: event.channel },
    };
  }

  nextRequestId() {
    return `midi-mcp-${++this._requestId}-${Date.now()}`;
  }
}

// ─── McpDispatcher ────────────────────────────────────────────────────────────

class McpDispatcher {
  constructor(opts = {}) {
    this._endpoint    = opts.endpoint    || 'http://localhost:3000/mcp';
    this._timeout     = opts.timeout     || 5000;
    this._headers     = opts.headers     || { 'Content-Type': 'application/json' };
    this._requestId   = 0;
    this._queue       = [];
    this._processing  = false;
    this._maxQueueSize = opts.maxQueueSize || 256;
    this._callbacks   = {};
    this._batchSize   = opts.batchSize   || 1;
    this._batchDelayMs = opts.batchDelayMs || 8; // ~120fps
  }

  /**
   * Build a JSON-RPC 2.0 MCP call object.
   */
  buildRpcCall(toolCall) {
    const id = `rpc-${++this._requestId}-${Date.now()}`;
    return {
      jsonrpc: '2.0',
      id,
      method:  'tools/call',
      params:  {
        name:      toolCall.tool,
        arguments: toolCall.params || {},
        _meta:     toolCall.meta   || {},
      },
    };
  }

  /**
   * Dispatch a tool call immediately (returns Promise).
   */
  async dispatch(toolCall) {
    const rpc = this.buildRpcCall(toolCall);
    return this._send(rpc);
  }

  /**
   * Enqueue a tool call for batched dispatch.
   */
  enqueue(toolCall) {
    if (this._queue.length >= this._maxQueueSize) {
      this._queue.shift(); // drop oldest
    }
    this._queue.push(toolCall);
    if (!this._processing) {
      this._scheduleFlush();
    }
  }

  _scheduleFlush() {
    this._processing = true;
    setTimeout(() => this._flush(), this._batchDelayMs);
  }

  async _flush() {
    while (this._queue.length > 0) {
      const batch = this._queue.splice(0, this._batchSize);
      for (const tc of batch) {
        const rpc = this.buildRpcCall(tc);
        this._send(rpc).catch(err => {
          // Non-fatal: log and continue
          process.nextTick(() => { throw err; });
        });
      }
    }
    this._processing = false;
  }

  async _send(rpc) {
    // In Node.js environments, use http/https modules
    const url     = new URL(this._endpoint);
    const isHttps = url.protocol === 'https:';
    const mod     = isHttps ? require('https') : require('http');

    return new Promise((resolve, reject) => {
      const body = JSON.stringify(rpc);
      const opts = {
        hostname: url.hostname,
        port:     url.port || (isHttps ? 443 : 80),
        path:     url.pathname + url.search,
        method:   'POST',
        headers:  Object.assign({ 'Content-Length': Buffer.byteLength(body) }, this._headers),
      };

      const req = mod.request(opts, res => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Invalid JSON response: ${data.slice(0, 100)}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(this._timeout, () => {
        req.destroy();
        reject(new Error(`McpDispatcher timeout after ${this._timeout}ms`));
      });
      req.write(body);
      req.end();
    });
  }

  /**
   * Register a response callback for a given request ID.
   */
  onResponse(id, cb) {
    this._callbacks[id] = cb;
  }

  getQueueDepth() { return this._queue.length; }
}

// ─── RtpMidiSocket (Network MIDI) ─────────────────────────────────────────────

class RtpMidiSocket {
  /**
   * Network MIDI via RTP-MIDI / AppleMIDI over UDP.
   * Implements a minimal RTP header decoder and session management.
   */
  constructor(opts = {}) {
    this._port       = opts.port    || 5004;
    this._host       = opts.host    || '0.0.0.0';
    this._ssrc       = opts.ssrc    || crypto.randomBytes(4).readUInt32BE(0);
    this._socket     = null;
    this._sessions   = new Map();   // ssrc → session
    this._listeners  = [];
  }

  /**
   * Decode an RTP-MIDI packet buffer.
   * RTP Header (12 bytes): V(2)|P(1)|X(1)|CC(4)|M(1)|PT(7)|Seq(16)|TS(32)|SSRC(32)
   */
  static decodeRtpPacket(buf) {
    if (!buf || buf.length < 12) return null;
    const version = (buf[0] >>> 6) & 0x3;
    if (version !== 2) return null;

    const payloadType = buf[1] & 0x7F;
    const sequence    = (buf[2] << 8) | buf[3];
    const timestamp   = buf.readUInt32BE(4);
    const ssrc        = buf.readUInt32BE(8);

    // MIDI command section starts at byte 12
    const midiSection = buf.slice(12);
    const hasLongHeader = (midiSection[0] & 0x80) !== 0;
    const midiLen = hasLongHeader
      ? ((midiSection[0] & 0x0F) << 8) | midiSection[1]
      :   midiSection[0] & 0x0F;
    const midiOffset = hasLongHeader ? 2 : 1;
    const midiBytes  = midiSection.slice(midiOffset, midiOffset + midiLen);

    return { version, payloadType, sequence, timestamp, ssrc, midiBytes };
  }

  /**
   * Encode MIDI bytes into an RTP-MIDI packet.
   */
  encodeRtpPacket(midiBytes, sequenceNum, timestamp) {
    const header = Buffer.alloc(12);
    header[0] = 0x80;          // V=2, P=0, X=0, CC=0
    header[1] = 0x61;          // M=0, PT=97 (RTP-MIDI)
    header.writeUInt16BE(sequenceNum & 0xFFFF, 2);
    header.writeUInt32BE(timestamp >>> 0, 4);
    header.writeUInt32BE(this._ssrc, 8);

    const midiSection = Buffer.alloc(1 + midiBytes.length);
    midiSection[0] = midiBytes.length & 0x0F; // short header, B=0, Z=0, J=0
    midiBytes.copy(midiSection, 1);

    return Buffer.concat([header, midiSection]);
  }

  /**
   * Start listening for incoming RTP-MIDI packets.
   * @param {Function} onEvent - callback(parsedEvents[])
   */
  listen(onEvent) {
    const dgram = require('dgram');
    this._socket = dgram.createSocket('udp4');

    this._socket.on('message', (msg, rinfo) => {
      const packet = RtpMidiSocket.decodeRtpPacket(msg);
      if (!packet) return;

      const session = this._sessions.get(packet.ssrc) || { ssrc: packet.ssrc, seq: -1 };
      session.seq = packet.sequence;
      this._sessions.set(packet.ssrc, session);

      if (packet.midiBytes.length > 0) {
        const events = MidiParser.parse(packet.midiBytes);
        if (events.length > 0) onEvent(events, rinfo);
      }
    });

    this._socket.bind(this._port, this._host);
    return this;
  }

  close() {
    if (this._socket) { this._socket.close(); this._socket = null; }
  }

  getSessions() { return Array.from(this._sessions.values()); }
}

// ─── MidiMcpBridge (Top-level orchestrator) ───────────────────────────────────

class MidiMcpBridge {
  constructor(opts = {}) {
    this._parser     = MidiParser;
    this._translator = new MidiToMcpTranslator(opts.translatorOpts || {});
    this._gesture    = new GestureRecognizer(opts.gestureOpts || {});
    this._dispatcher = new McpDispatcher(opts.dispatcherOpts || {});
    this._rtp        = opts.enableRtp ? new RtpMidiSocket(opts.rtpOpts || {}) : null;
    this._useUmp     = opts.useUmp || false;
    this._listeners  = { event: [], gesture: [], dispatch: [] };
    this._stats      = { parsed: 0, translated: 0, dispatched: 0, errors: 0 };
  }

  /**
   * Process raw MIDI bytes from any source.
   */
  processMidiBytes(bytes) {
    try {
      const events = this._useUmp
        ? MidiParser.parseUMP(new Uint32Array(bytes.buffer))
        : MidiParser.parse(bytes);

      this._stats.parsed += events.length;
      this._emit('event', events);

      for (const event of events) {
        const gesture = this._gesture.recognize(event);
        if (gesture) this._emit('gesture', gesture);

        const toolCall = this._translator.translate(event);
        if (toolCall) {
          this._dispatcher.enqueue(toolCall);
          this._stats.translated++;
          this._stats.dispatched++;
          this._emit('dispatch', toolCall);
        }
      }
      return events;
    } catch (err) {
      this._stats.errors++;
      throw err;
    }
  }

  /**
   * Start network MIDI listener (RTP-MIDI).
   */
  startRtp() {
    if (!this._rtp) throw new Error('RTP-MIDI not enabled. Pass enableRtp:true in opts.');
    this._rtp.listen((events, rinfo) => {
      this._emit('event', events);
      for (const event of events) {
        const toolCall = this._translator.translate(event);
        if (toolCall) {
          this._dispatcher.enqueue(toolCall);
          this._emit('dispatch', toolCall);
        }
      }
    });
    return this;
  }

  on(event, fn) {
    if (this._listeners[event]) this._listeners[event].push(fn);
    return this;
  }

  off(event, fn) {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter(f => f !== fn);
    }
    return this;
  }

  _emit(event, data) {
    if (this._listeners[event]) {
      for (const fn of this._listeners[event]) fn(data);
    }
  }

  loadProfile(name) {
    this._translator.loadProfile(name);
    return this;
  }

  registerProfile(name, profile) {
    this._translator.registerProfile(name, profile);
    return this;
  }

  getStats() { return Object.assign({}, this._stats); }

  stop() {
    if (this._rtp) this._rtp.close();
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  PHI,
  MIDI_STATUS,
  MIDI2_MESSAGE_TYPE,
  DEFAULT_CC_MAP,
  DEFAULT_NOTE_MAP,
  MidiParser,
  GestureRecognizer,
  MidiToMcpTranslator,
  McpDispatcher,
  RtpMidiSocket,
  MidiMcpBridge,
};
```

---

### `src/core/csl-engine/csl-engine.js`

```javascript
/**
 * @fileoverview CSL Engine — Continuous Semantic Logic
 *
 * Heady Latent OS — Section 5: CSL & Geometric AI
 *
 * Core innovation: vector geometry as logical gates operating in 384-dimensional
 * (or 1536-dimensional) embedding space. All logic is geometric: alignment,
 * superposition, orthogonal projection, and cosine activation.
 *
 * Mathematical Foundation:
 *   - Domain: unit vectors in ℝᴰ, D ∈ {384, 1536}
 *   - Truth value: τ(a, b) = cos(θ) = (a·b) / (‖a‖·‖b‖) ∈ [-1, +1]
 *   - +1 = fully aligned (TRUE), 0 = orthogonal (UNKNOWN), -1 = antipodal (FALSE)
 *
 * References:
 *   - Birkhoff & von Neumann (1936): "The Logic of Quantum Mechanics"
 *   - Widdows (2003): "Orthogonal Negation in Vector Spaces" — ACL 2003
 *   - Grand et al. (2022): "Semantic projection" — Nature Human Behaviour
 *   - Fagin, Riegel, Gray (2024): "Foundations of reasoning with uncertainty" — PNAS
 *
 * @module csl-engine
 * @version 1.0.0
 * @patent Heady Connection — 60+ provisional patents on CSL techniques
 */

import { PHI, PSI, PHI_TEMPERATURE, CSL_THRESHOLDS, phiThreshold, EPSILON as PHI_EPSILON, adaptiveTemperature } from '../../shared/phi-math.js';

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default vector dimension for standard embedding models (e.g., all-MiniLM-L6-v2) */
const DEFAULT_DIM = 384;

/** Extended dimension for high-fidelity models (e.g., text-embedding-3-large) */
const LARGE_DIM = 1536;

/** Numerical epsilon: prevents division-by-zero and detects near-zero vectors.
 * Sourced from shared/phi-math.js PHI_EPSILON (same 1e-10 value, unified constant). */
const EPSILON = PHI_EPSILON; // from shared/phi-math.js

/** Threshold below which a vector is considered near-zero (degenerate) */
const ZERO_NORM_THRESHOLD = 1e-8;

/** Default gate threshold τ for GATE operation.
 * CSL_THRESHOLDS.MINIMUM ≈ 0.500 — noise floor for geometric truth activation. */
const DEFAULT_GATE_THRESHOLD = CSL_THRESHOLDS.MINIMUM; // ≈ 0.500 (CSL noise floor)

/** Default temperature τ for soft gating / softmax operations.
 * PHI_TEMPERATURE = PSI^3 ≈ 0.236 — phi-harmonic softness. */
const DEFAULT_TEMPERATURE = PHI_TEMPERATURE; // PSI^3 ≈ 0.236

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Compute the L2 norm (Euclidean length) of a vector.
 *
 * Formula: ‖a‖ = √(Σᵢ aᵢ²)
 *
 * @param {Float32Array|Float64Array|number[]} a - Input vector
 * @returns {number} L2 norm ≥ 0
 */
function norm(a) {
  let sum = 0.0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * a[i];
  }
  return Math.sqrt(sum);
}

/**
 * Normalize a vector to unit length (project onto unit hypersphere Sᴰ⁻¹).
 *
 * Formula: â = a / ‖a‖
 *
 * Returns the zero vector if ‖a‖ < ZERO_NORM_THRESHOLD (degenerate case).
 *
 * @param {Float32Array|Float64Array|number[]} a - Input vector
 * @returns {Float64Array} Unit vector, or zero vector if degenerate
 */
function normalize(a) {
  const n = norm(a);
  const result = new Float64Array(a.length);
  if (n < ZERO_NORM_THRESHOLD) {
    return result; // zero vector — caller should handle
  }
  const invN = 1.0 / n;
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] * invN;
  }
  return result;
}

/**
 * Compute the dot product of two equal-length vectors.
 *
 * Formula: a·b = Σᵢ aᵢ·bᵢ
 *
 * @param {Float32Array|Float64Array|number[]} a
 * @param {Float32Array|Float64Array|number[]} b
 * @returns {number} Scalar dot product
 * @throws {Error} If vectors have different lengths
 */
function dot(a, b) {
  if (a.length !== b.length) {
    throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let sum = 0.0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Clamp a value to the interval [min, max].
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Add two vectors element-wise and return a new Float64Array.
 *
 * @param {Float32Array|Float64Array|number[]} a
 * @param {Float32Array|Float64Array|number[]} b
 * @returns {Float64Array}
 */
function vectorAdd(a, b) {
  const result = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] + b[i];
  }
  return result;
}

/**
 * Subtract vector b from a element-wise.
 *
 * @param {Float32Array|Float64Array|number[]} a
 * @param {Float32Array|Float64Array|number[]} b
 * @returns {Float64Array}
 */
function vectorSub(a, b) {
  const result = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] - b[i];
  }
  return result;
}

/**
 * Scale a vector by a scalar.
 *
 * @param {Float32Array|Float64Array|number[]} a
 * @param {number} scalar
 * @returns {Float64Array}
 */
function vectorScale(a, scalar) {
  const result = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] * scalar;
  }
  return result;
}

// ─── CSLEngine Class ──────────────────────────────────────────────────────────

/**
 * CSLEngine — Continuous Semantic Logic Engine
 *
 * Implements all CSL logical gates as pure geometric operations on high-dimensional
 * vectors. All operations work on raw (unnormalized) input vectors and handle
 * normalization internally unless otherwise noted.
 *
 * All gate methods:
 *   1. Accept Float32Array, Float64Array, or number[] inputs
 *   2. Return Float64Array for gate outputs (or number for scalar outputs)
 *   3. Include full numerical stability handling
 *   4. Support batch operation via the batch* prefix methods
 *
 * @class
 * @example
 * const engine = new CSLEngine({ dim: 384 });
 * const score = engine.AND(vectorA, vectorB);     // cosine similarity ∈ [-1,1]
 * const union = engine.OR(vectorA, vectorB);       // normalized superposition
 * const negated = engine.NOT(vectorA, vectorB);    // semantic negation
 */
class CSLEngine {
  /** Golden ratio constant — accessible on class for downstream phi-arithmetic */
  static PHI = PHI;
  /** Golden ratio conjugate (1/Φ = Φ-1) — accessible on class */
  static PSI = PSI;

  /**
   * @param {Object} [options]
   * @param {number} [options.dim=384] - Vector dimension
   * @param {number} [options.epsilon=1e-10] - Numerical stability epsilon
   * @param {number} [options.gateThreshold=0.0] - Default threshold τ for GATE
   * @param {number} [options.temperature=1.0] - Default temperature for soft gates
   * @param {boolean} [options.normalizeInputs=true] - Auto-normalize inputs
   */
  constructor(options = {}) {
    this.dim = options.dim || DEFAULT_DIM;
    this.epsilon = options.epsilon || EPSILON;
    this.gateThreshold = options.gateThreshold !== undefined
      ? options.gateThreshold
      : DEFAULT_GATE_THRESHOLD;
    this.temperature = options.temperature || DEFAULT_TEMPERATURE;
    this.normalizeInputs = options.normalizeInputs !== false;

    // Runtime statistics for monitoring
    this._stats = {
      operationCount: 0,
      degenerateVectors: 0,
      gateActivations: 0,
    };
  }

  // ─── Core Gate Operations ──────────────────────────────────────────────────

  /**
   * CSL AND — Measures semantic alignment between two concept vectors.
   *
   * Mathematical formula:
   *   AND(a, b) = cos(θ_{a,b}) = (a·b) / (‖a‖·‖b‖)
   *
   * Interpretation:
   *   - Result ∈ [-1, +1]
   *   - +1: concepts are fully aligned ("both true in the same direction")
   *   - 0:  concepts are orthogonal ("independent / no relationship")
   *   - -1: concepts are antipodal ("contradictory / one negates the other")
   *
   * Logical analogy: "a AND b is true" ↔ cos(a, b) close to +1.
   * This is the soft AND: high only when both concepts are co-aligned.
   *
   * Properties:
   *   - Commutative: AND(a,b) = AND(b,a)
   *   - Bounded: result ∈ [-1, +1]
   *   - Scale invariant: AND(λa, b) = AND(a, b) for λ > 0
   *
   * Reference: Birkhoff & von Neumann (1936), quantum logic inner product.
   *
   * @param {Float32Array|Float64Array|number[]} a - First concept vector
   * @param {Float32Array|Float64Array|number[]} b - Second concept vector
   * @returns {number} Cosine similarity ∈ [-1, +1]
   */
  AND(a, b) {
    this._stats.operationCount++;
    const normA = norm(a);
    const normB = norm(b);

    if (normA < this.epsilon || normB < this.epsilon) {
      this._stats.degenerateVectors++;
      return 0.0; // degenerate: zero vectors are orthogonal to everything
    }

    const dotProduct = dot(a, b);
    return clamp(dotProduct / (normA * normB), -1.0, 1.0);
  }

  /**
   * CSL OR — Computes semantic superposition (soft union) of two concepts.
   *
   * Mathematical formula:
   *   OR(a, b) = normalize(a + b)
   *
   * The sum a + b creates a vector similar to both a and b — capturing the
   * "union" of semantic content. Normalization returns the result to the unit
   * sphere for subsequent operations.
   *
   * Interpretation:
   *   - The result vector points "between" a and b on the hypersphere
   *   - Its cosine similarity to both a and b is positive
   *   - For orthogonal a, b: result is at 45° to both (equal similarity)
   *   - For identical a = b: result is identical to a (idempotent in direction)
   *
   * Logical analogy: "a OR b" is the direction that captures either concept.
   *
   * Properties:
   *   - Commutative: OR(a,b) = OR(b,a)
   *   - Returns unit vector on Sᴰ⁻¹
   *   - Degenerate when a ≈ -b (antiparallel): returns zero vector
   *
   * Reference: HDC bundling operation; Boolean IR vector addition.
   *
   * @param {Float32Array|Float64Array|number[]} a - First concept vector
   * @param {Float32Array|Float64Array|number[]} b - Second concept vector
   * @returns {Float64Array} Normalized superposition vector (unit length)
   */
  OR(a, b) {
    this._stats.operationCount++;
    const sum = vectorAdd(a, b);
    const n = norm(sum);

    if (n < this.epsilon) {
      this._stats.degenerateVectors++;
      // a ≈ -b: concepts cancel. Return zero vector to signal cancellation.
      return new Float64Array(a.length);
    }

    return vectorScale(sum, 1.0 / n);
  }

  /**
   * CSL NOT — Semantic negation via orthogonal projection.
   *
   * Mathematical formula:
   *   NOT(a, b) = a - proj_b(a) = a - (a·b / ‖b‖²) · b
   *
   * For unit vectors ‖b‖ = 1:
   *   NOT(a, b) = a - (a·b) · b
   *
   * The result is the component of a that is orthogonal to b — removing
   * the semantic content of b from a.
   *
   * Interpretation:
   *   - "NOT(a, b)" means "a, but not the part that overlaps with b"
   *   - Example: NOT(cat_vector, persian_vector) → cat vector minus Persian traits
   *   - The result has zero cosine similarity with b (by construction)
   *   - Residual magnitude: ‖NOT(a,b)‖ = ‖a‖·sin(θ_{a,b})
   *
   * Idempotency:
   *   NOT(NOT(a,b), b) ≈ NOT(a,b) because the result is already in b⊥.
   *   More precisely: the projection of NOT(a,b) onto b is ≈ 0, so subtracting
   *   proj_b again leaves it unchanged. (Full proof in csl-mathematical-proofs.md)
   *
   * Similarity after negation (for normalized a, b):
   *   a · NOT(a, b) = 1 - (a·b)²
   *
   * Reference: Widdows (2003), ACL 2003, "Orthogonal Negation in Vector Spaces"
   *
   * @param {Float32Array|Float64Array|number[]} a - Query/source vector
   * @param {Float32Array|Float64Array|number[]} b - Concept to negate/remove
   * @param {boolean} [returnNormalized=true] - Whether to normalize the result
   * @returns {Float64Array} Vector with b's semantic content removed
   */
  NOT(a, b, returnNormalized = true) {
    this._stats.operationCount++;
    const normBSq = dot(b, b); // ‖b‖²

    if (normBSq < this.epsilon) {
      // b is near-zero: nothing to project out, return a (optionally normalized)
      return returnNormalized ? normalize(a) : new Float64Array(a);
    }

    // Projection coefficient: (a·b) / ‖b‖²
    const projCoeff = dot(a, b) / normBSq;

    // Remove projection: a - projCoeff·b
    const result = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = a[i] - projCoeff * b[i];
    }

    if (returnNormalized) {
      return normalize(result);
    }
    return result;
  }

  /**
   * CSL IMPLY — Geometric material implication via projection.
   *
   * Mathematical formula:
   *   IMPLY(a, b) = proj_b(a) = (a·b / ‖b‖²) · b
   *
   * For unit vectors:
   *   IMPLY(a, b) = (a·b) · b    [scalar times unit vector]
   *
   * The projection of a onto b captures "how much of a is contained in b" —
   * the geometric analog of material implication: degree to which a implies b.
   *
   * Interpretation:
   *   - Large projection → a strongly implies b (concepts highly co-directional)
   *   - Zero projection → a and b are independent (no implication)
   *   - Negative projection → a implies NOT b (antiparallel)
   *
   * Scalar implication strength: IMPLY_scalar(a,b) = a·b / ‖b‖ = cos(θ)·‖a‖
   *
   * Reference: Grand et al. (2022) semantic projection; Birkhoff-von Neumann.
   *
   * @param {Float32Array|Float64Array|number[]} a - Antecedent vector (hypothesis)
   * @param {Float32Array|Float64Array|number[]} b - Consequent vector (conclusion)
   * @returns {Float64Array} Projection of a onto span(b)
   */
  IMPLY(a, b) {
    this._stats.operationCount++;
    const normBSq = dot(b, b); // ‖b‖²

    if (normBSq < this.epsilon) {
      return new Float64Array(a.length); // zero consequent: no implication
    }

    const projCoeff = dot(a, b) / normBSq;
    return vectorScale(b, projCoeff);
  }

  /**
   * Scalar implication strength — returns the signed magnitude of implication.
   *
   * Formula: IMPLY_strength(a, b) = (a·b) / (‖a‖·‖b‖) = cos(θ_{a,b})
   *
   * Equivalent to AND(a, b) — the cosine similarity *is* the implication strength.
   *
   * @param {Float32Array|Float64Array|number[]} a - Antecedent
   * @param {Float32Array|Float64Array|number[]} b - Consequent
   * @returns {number} Implication strength ∈ [-1, +1]
   */
  IMPLY_scalar(a, b) {
    return this.AND(a, b);
  }

  /**
   * CSL XOR — Exclusive semantic content (symmetric difference).
   *
   * Mathematical formula:
   *   XOR(a, b) = normalize(a + b) - proj_mutual(a, b)
   *
   * More precisely, for unit vectors:
   *   XOR(a, b) = normalize( (a - proj_b(a)) + (b - proj_a(b)) )
   *             = normalize( a_⊥b + b_⊥a )
   *
   * Where a_⊥b is the component of a orthogonal to b (exclusive to a),
   * and b_⊥a is the component of b orthogonal to a (exclusive to b).
   *
   * Interpretation:
   *   - XOR captures what is unique to each concept (symmetric difference)
   *   - When a ≈ b: both exclusive components → 0, XOR → zero vector
   *   - When a ⊥ b: exclusive components = full vectors, XOR ≈ normalize(a + b)
   *   - "a XOR b" = concepts that appear in one but not both
   *
   * Properties:
   *   - Commutative: XOR(a,b) = XOR(b,a)
   *   - Anti-idempotent: XOR(a,a) → zero vector
   *
   * @param {Float32Array|Float64Array|number[]} a - First concept vector
   * @param {Float32Array|Float64Array|number[]} b - Second concept vector
   * @returns {Float64Array} Normalized exclusive semantic content
   */
  XOR(a, b) {
    this._stats.operationCount++;

    // a_⊥b: component of a orthogonal to b (NOT(a, b) unnormalized)
    const normBSq = dot(b, b);
    const normASq = dot(a, a);

    if (normASq < this.epsilon || normBSq < this.epsilon) {
      this._stats.degenerateVectors++;
      return new Float64Array(a.length);
    }

    const projAonB = dot(a, b) / normBSq;
    const projBonA = dot(a, b) / normASq; // Note: dot(b,a) = dot(a,b)

    // a_⊥b = a - proj_b(a)
    // b_⊥a = b - proj_a(b)
    const exclusive = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) {
      const a_excl = a[i] - projAonB * b[i];
      const b_excl = b[i] - projBonA * a[i];
      exclusive[i] = a_excl + b_excl;
    }

    const n = norm(exclusive);
    if (n < this.epsilon) {
      return new Float64Array(a.length); // a ≈ b: no exclusive content
    }

    return vectorScale(exclusive, 1.0 / n);
  }

  /**
   * CSL CONSENSUS — Weighted mean of agent/concept vectors (agreement).
   *
   * Mathematical formula:
   *   CONSENSUS({aᵢ}, {wᵢ}) = normalize( Σᵢ wᵢ · aᵢ )
   *
   * Uniform weights (default):
   *   CONSENSUS({aᵢ}) = normalize( (1/n) Σᵢ aᵢ )
   *
   * Interpretation:
   *   - Result is the centroid direction on the unit hypersphere
   *   - ‖Σ wᵢaᵢ‖ before normalization measures consensus strength:
   *     → ≈ 1: strong agreement (vectors nearly aligned)
   *     → ≈ 0: strong disagreement (vectors cancel out)
   *   - Consensus Quality metric: R = ‖(1/n)Σaᵢ‖ ∈ [0,1]
   *
   * Properties:
   *   - Commutative: order of vectors doesn't matter
   *   - Weights must be non-negative (negative weights invert contribution)
   *   - Returns zero vector when agents completely disagree
   *
   * Reference: HDC bundling operation; Roundtable Policy (arXiv 2509.16839)
   *
   * @param {Array<Float32Array|Float64Array|number[]>} vectors - Agent opinion vectors
   * @param {number[]} [weights] - Optional weights (uniform if omitted)
   * @returns {{ consensus: Float64Array, strength: number }}
   *   consensus: normalized consensus vector
   *   strength: R ∈ [0,1] measuring agreement level
   */
  CONSENSUS(vectors, weights = null) {
    this._stats.operationCount++;

    if (!vectors || vectors.length === 0) {
      throw new Error('CONSENSUS requires at least one vector');
    }

    const dim = vectors[0].length;
    const n = vectors.length;

    // Validate weights
    let w = weights;
    if (!w) {
      w = new Array(n).fill(1.0 / n);
    } else {
      if (w.length !== n) {
        throw new Error(`Weights length ${w.length} != vectors length ${n}`);
      }
      // Normalize weights to sum to 1
      const wSum = w.reduce((s, x) => s + x, 0);
      if (wSum < this.epsilon) {
        throw new Error('Weights must have positive sum');
      }
      w = w.map(x => x / wSum);
    }

    // Weighted sum
    const sum = new Float64Array(dim);
    for (let j = 0; j < n; j++) {
      const vec = vectors[j];
      const wj = w[j];
      for (let i = 0; i < dim; i++) {
        sum[i] += wj * vec[i];
      }
    }

    // Measure consensus strength before normalizing
    const strength = norm(sum);

    if (strength < this.epsilon) {
      this._stats.degenerateVectors++;
      return {
        consensus: new Float64Array(dim),
        strength: 0.0,
      };
    }

    const consensus = vectorScale(sum, 1.0 / strength);
    return { consensus, strength: clamp(strength, 0, 1) };
  }

  /**
   * CSL GATE — Threshold activation function using cosine similarity.
   *
   * Mathematical formula:
   *   GATE(input, gate_vector, τ) = θ( cos(input, gate_vector) - τ )
   *
   * Where θ is the Heaviside step function (hard gate) or sigmoid (soft gate):
   *   Hard:  GATE = 1  if cos(input, gate_vector) ≥ τ, else 0
   *   Soft:  GATE = σ( (cos(input, gate_vector) - τ) / temperature )
   *
   * The gate_vector defines a semantic "topic direction" in embedding space.
   * Inputs aligned with this direction (above threshold τ) pass the gate.
   *
   * Properties:
   *   - Bounded output: hard ∈ {0,1}, soft ∈ (0,1)
   *   - Scale invariant: GATE(λ·input, gate_vector, τ) = GATE(input, gate_vector, τ)
   *   - Differentiable (soft gate only)
   *   - Valid activation function: monotone, bounded, Lipschitz-continuous (soft)
   *
   * Proof that soft GATE is a valid activation function:
   *   (See csl-mathematical-proofs.md §4: CSL GATE Activation Properties)
   *
   * @param {Float32Array|Float64Array|number[]} input - Input vector to gate
   * @param {Float32Array|Float64Array|number[]} gateVector - Gate direction vector
   * @param {number} [threshold=0.0] - Threshold τ ∈ [-1, +1]
   * @param {'hard'|'soft'} [mode='hard'] - Hard (step) or soft (sigmoid) gate
   * @param {number} [temperature=1.0] - Temperature for soft gate sharpness
   * @returns {{ activation: number, cosScore: number }}
   *   activation: gate output ∈ {0,1} (hard) or (0,1) (soft)
   *   cosScore: raw cosine similarity before thresholding
   */
  GATE(input, gateVector, threshold = null, mode = 'hard', temperature = null) {
    this._stats.operationCount++;

    const tau = threshold !== null ? threshold : this.gateThreshold;
    const temp = temperature !== null ? temperature : this.temperature;

    const cosScore = this.AND(input, gateVector);
    const shifted = cosScore - tau;

    let activation;
    if (mode === 'hard') {
      activation = shifted >= 0 ? 1 : 0;
    } else {
      // Soft (sigmoid) gate: σ(x) = 1 / (1 + e^{-x/temp})
      activation = 1.0 / (1.0 + Math.exp(-shifted / temp));
    }

    if (activation > 0) this._stats.gateActivations++;

    return { activation, cosScore };
  }

  /**
   * CSL NAND — NOT AND: semantic incompatibility gate.
   *
   * Formula: NAND(a, b) = 1 - max(0, AND(a, b))
   *          Maps high alignment → low output; low alignment → high output.
   *
   * @param {Float32Array|Float64Array|number[]} a
   * @param {Float32Array|Float64Array|number[]} b
   * @returns {number} NAND score ∈ [0, 1]
   */
  NAND(a, b) {
    const andScore = this.AND(a, b);
    return 1.0 - Math.max(0, andScore);
  }

  /**
   * CSL NOR — NOT OR: semantic exclusion gate.
   *
   * Returns normalized vector pointing away from the OR superposition.
   * Semantically: the concept that is distinct from both a and b.
   *
   * Formula: NOR(a,b) = normalize( -(a + b) )
   *                   = negate( OR(a, b) )
   *
   * @param {Float32Array|Float64Array|number[]} a
   * @param {Float32Array|Float64Array|number[]} b
   * @returns {Float64Array} Antipodal to OR(a,b)
   */
  NOR(a, b) {
    this._stats.operationCount++;
    const orVec = this.OR(a, b);
    return vectorScale(orVec, -1.0);
  }

  // ─── Projection Utilities ──────────────────────────────────────────────────

  /**
   * Project vector a onto the subspace spanned by a set of basis vectors.
   *
   * Uses Gram-Schmidt orthogonalization for numerical stability.
   *
   * Formula: proj_B(a) = Σᵢ (a·eᵢ) eᵢ
   * where {eᵢ} is an orthonormal basis for span(B), computed via Gram-Schmidt.
   *
   * @param {Float32Array|Float64Array|number[]} a - Vector to project
   * @param {Array<Float32Array|Float64Array|number[]>} basisVectors - Spanning set
   * @returns {Float64Array} Projection of a onto span(basisVectors)
   */
  projectOntoSubspace(a, basisVectors) {
    if (!basisVectors || basisVectors.length === 0) {
      return new Float64Array(a.length);
    }

    const dim = a.length;
    // Gram-Schmidt orthogonalization of basisVectors
    const orthoBasis = [];

    for (let j = 0; j < basisVectors.length; j++) {
      let vec = new Float64Array(basisVectors[j]);

      // Remove components along existing orthobasis
      for (const e of orthoBasis) {
        const coeff = dot(vec, e);
        for (let i = 0; i < dim; i++) {
          vec[i] -= coeff * e[i];
        }
      }

      const n = norm(vec);
      if (n > this.epsilon) {
        const unitVec = vectorScale(vec, 1.0 / n);
        orthoBasis.push(unitVec);
      }
    }

    // Project a onto orthobasis
    const projection = new Float64Array(dim);
    for (const e of orthoBasis) {
      const coeff = dot(a, e);
      for (let i = 0; i < dim; i++) {
        projection[i] += coeff * e[i];
      }
    }

    return projection;
  }

  /**
   * NOT against a subspace (multiple semantic concepts removed simultaneously).
   *
   * Formula: NOT(a, B) = a - proj_B(a)
   *
   * Removes all semantic content in span{b₁,...,bₙ} from a.
   *
   * @param {Float32Array|Float64Array|number[]} a - Source vector
   * @param {Array<Float32Array|Float64Array|number[]>} bVectors - Concepts to remove
   * @param {boolean} [returnNormalized=true]
   * @returns {Float64Array}
   */
  NOT_subspace(a, bVectors, returnNormalized = true) {
    this._stats.operationCount++;
    const projection = this.projectOntoSubspace(a, bVectors);
    const result = vectorSub(a, projection);
    return returnNormalized ? normalize(result) : result;
  }

  // ─── Batch Operations ──────────────────────────────────────────────────────

  /**
   * Batch AND — Compute cosine similarity of one vector against many.
   *
   * GPU-friendly: equivalent to a matrix-vector multiplication.
   * M[j] = a · B[j] / (‖a‖ · ‖B[j]‖) for each row B[j] in the matrix.
   *
   * @param {Float32Array|Float64Array|number[]} a - Query vector (1 × dim)
   * @param {Array<Float32Array|Float64Array|number[]>} bVectors - Corpus vectors (n × dim)
   * @returns {Float64Array} Similarity scores (n,) ∈ [-1,+1]
   */
  batchAND(a, bVectors) {
    const normA = norm(a);
    if (normA < this.epsilon) {
      return new Float64Array(bVectors.length);
    }

    const result = new Float64Array(bVectors.length);
    for (let j = 0; j < bVectors.length; j++) {
      const normB = norm(bVectors[j]);
      if (normB < this.epsilon) {
        result[j] = 0.0;
        continue;
      }
      result[j] = clamp(dot(a, bVectors[j]) / (normA * normB), -1.0, 1.0);
    }
    return result;
  }

  /**
   * Batch NOT — Remove concept b from an array of source vectors.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} aVectors - Source vectors
   * @param {Float32Array|Float64Array|number[]} b - Concept to negate
   * @param {boolean} [returnNormalized=true]
   * @returns {Array<Float64Array>} Array of negated vectors
   */
  batchNOT(aVectors, b, returnNormalized = true) {
    return aVectors.map(a => this.NOT(a, b, returnNormalized));
  }

  /**
   * Batch GATE — Apply semantic gate to an array of input vectors.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} inputs - Input vectors
   * @param {Float32Array|Float64Array|number[]} gateVector - Gate direction
   * @param {number} [threshold=0.0] - Threshold τ
   * @param {'hard'|'soft'} [mode='hard']
   * @returns {Array<{ activation: number, cosScore: number }>}
   */
  batchGATE(inputs, gateVector, threshold = null, mode = 'hard') {
    return inputs.map(inp => this.GATE(inp, gateVector, threshold, mode));
  }

  /**
   * Batch IMPLY — Compute projection of each input onto the consequent.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} aVectors
   * @param {Float32Array|Float64Array|number[]} b - Consequent
   * @returns {Array<Float64Array>} Projections
   */
  batchIMPLY(aVectors, b) {
    return aVectors.map(a => this.IMPLY(a, b));
  }

  // ─── Advanced Logical Compositions ────────────────────────────────────────

  /**
   * CSL CONDITIONAL — Soft conditional probability: P(b|a) via geometric Bayes.
   *
   * Formula: P(b|a) ≈ AND(a,b) / AND(a,a) = cos(a,b) / 1 = cos(a,b)
   *          [for normalized vectors, this reduces to AND]
   *
   * For asymmetric conditional, use the projection magnitude:
   *   P(b|a) ≈ ‖proj_b(a)‖ / ‖a‖ = |cos(a,b)|
   *
   * @param {Float32Array|Float64Array|number[]} a - Antecedent
   * @param {Float32Array|Float64Array|number[]} b - Consequent
   * @returns {number} Conditional alignment ∈ [0, 1]
   */
  CONDITIONAL(a, b) {
    return Math.abs(this.AND(a, b));
  }

  /**
   * CSL ANALOGY — Completes an analogy: "a is to b as c is to ?"
   *
   * Formula: d = normalize( b - a + c )
   *   [vector arithmetic analogy, as in word2vec: king - man + woman ≈ queen]
   *
   * @param {Float32Array|Float64Array|number[]} a - Source concept
   * @param {Float32Array|Float64Array|number[]} b - Target concept
   * @param {Float32Array|Float64Array|number[]} c - Query concept
   * @returns {Float64Array} Analogy completion vector
   */
  ANALOGY(a, b, c) {
    this._stats.operationCount++;
    // d = normalize(b - a + c)
    const diff = vectorSub(b, a);
    const result = vectorAdd(diff, c);
    return normalize(result);
  }

  /**
   * Compute pairwise AND (cosine similarity matrix) for a set of vectors.
   *
   * Returns a symmetric matrix M where M[i][j] = cos(vectors[i], vectors[j]).
   * GPU-friendly: equivalent to normalized matrix multiplication V @ Vᵀ.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} vectors
   * @returns {Float64Array[]} n×n cosine similarity matrix (row-major)
   */
  pairwiseAND(vectors) {
    const n = vectors.length;
    const norms = vectors.map(v => norm(v));

    // Pre-allocate n×n matrix as array of Float64Arrays
    const matrix = Array.from({ length: n }, () => new Float64Array(n));

    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1.0; // self-similarity
      for (let j = i + 1; j < n; j++) {
        const d = dot(vectors[i], vectors[j]);
        const normIJ = norms[i] * norms[j];
        const sim = normIJ < this.epsilon ? 0.0 : clamp(d / normIJ, -1.0, 1.0);
        matrix[i][j] = sim;
        matrix[j][i] = sim; // symmetric
      }
    }

    return matrix;
  }

  // ─── Statistics and Introspection ─────────────────────────────────────────

  /**
   * Retrieve runtime operation statistics.
   *
   * @returns {{ operationCount: number, degenerateVectors: number, gateActivations: number }}
   */
  getStats() {
    return { ...this._stats };
  }

  /**
   * Reset runtime statistics.
   */
  resetStats() {
    this._stats = { operationCount: 0, degenerateVectors: 0, gateActivations: 0 };
  }

  // ─── Phi-Harmonic Gate Extensions ───────────────────────────────────────────────

  /**
   * Phi-harmonic GATE — uses phiThreshold(level) from phi-math.js as threshold.
   *
   * phiThreshold(level) = 1 - PSI^level * 0.5:
   *   level=1 ≈ 0.691 (CSL LOW)
   *   level=2 ≈ 0.809 (CSL MEDIUM)
   *   level=3 ≈ 0.882 (CSL HIGH)
   *
   * Provides a geometrically scaled activation threshold aligned with
   * the sacred geometry resource allocation tiers.
   *
   * @param {Float32Array|Float64Array|number[]} input - Input vector
   * @param {Float32Array|Float64Array|number[]} gateVector - Gate direction vector
   * @param {number} [level=2] - Phi threshold level (1–4)
   * @param {'hard'|'soft'} [mode='hard'] - Gate mode
   * @returns {{ activation: number, cosScore: number, threshold: number }}
   */
  phiGATE(input, gateVector, level = 2, mode = 'hard') {
    const threshold = phiThreshold(level); // e.g. level=2 ≈ 0.809 (MEDIUM)
    const result = this.GATE(input, gateVector, threshold, mode);
    return { ...result, threshold };
  }

  /**
   * Adaptive GATE — uses adaptiveTemperature(entropy, maxEntropy) for dynamic softness.
   *
   * Temperature = PSI^(1 + 2*(1 - H/Hmax)) from phi-math.js.
   * At max entropy (uniform distribution): temperature ≈ PSI (softest).
   * At zero entropy (deterministic):       temperature ≈ PSI^3 (sharpest = PHI_TEMPERATURE).
   *
   * @param {Float32Array|Float64Array|number[]} input - Input vector
   * @param {Float32Array|Float64Array|number[]} gateVector - Gate direction vector
   * @param {number} entropy - Current routing entropy H (nats)
   * @param {number} maxEntropy - Maximum possible entropy Hmax = log(numExperts)
   * @returns {{ activation: number, cosScore: number, temperature: number }}
   */
  adaptiveGATE(input, gateVector, entropy, maxEntropy) {
    const temperature = adaptiveTemperature(entropy, maxEntropy);
    const result = this.GATE(input, gateVector, null, 'soft', temperature);
    return { ...result, temperature };
  }

  /**
   * Validate that a vector has the expected dimension and no NaN/Inf values.
   *
   * @param {Float32Array|Float64Array|number[]} vector
   * @param {number} [expectedDim] - Expected dimension (defaults to this.dim)
   * @returns {{ valid: boolean, issues: string[] }}
   */
  validateVector(vector, expectedDim = null) {
    const issues = [];
    const dim = expectedDim || this.dim;

    if (!vector || vector.length === 0) {
      issues.push('Vector is empty or null');
    } else {
      if (vector.length !== dim) {
        issues.push(`Dimension mismatch: got ${vector.length}, expected ${dim}`);
      }

      let hasNaN = false;
      let hasInf = false;
      for (let i = 0; i < vector.length; i++) {
        if (Number.isNaN(vector[i])) hasNaN = true;
        if (!Number.isFinite(vector[i])) hasInf = true;
      }
      if (hasNaN) issues.push('Vector contains NaN values');
      if (hasInf) issues.push('Vector contains Inf values');

      const n = norm(vector);
      if (n < ZERO_NORM_THRESHOLD) {
        issues.push('Vector is near-zero (degenerate)');
      }
    }

    return { valid: issues.length === 0, issues };
  }
}

// ─── Module Exports ────────────────────────────────────────────────────────────

module.exports = {
  CSLEngine,
  // Export utility functions for external use
  norm,
  normalize,
  dot,
  clamp,
  vectorAdd,
  vectorSub,
  vectorScale,
  // Export constants
  DEFAULT_DIM,
  LARGE_DIM,
  EPSILON,
  ZERO_NORM_THRESHOLD,
};
```

---

### `src/shared/sacred-geometry.js`

```javascript
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Heady™ Sacred Geometry — shared/sacred-geometry.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Orchestration topology, node placement rings, coherence scoring,
 * Fibonacci resource allocation, and UI aesthetic constants.
 *
 * Every node, agent, and UI element follows geometric principles derived from φ.
 *
 * © HeadySystems Inc. — Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

'use strict';

const { PHI, PSI, CSL_THRESHOLDS, fib, phiFusionWeights, poolAllocation } = require('./phi-math');
const { cslAND, normalize, add } = require('./csl-engine');

// ─── Node Topology ───────────────────────────────────────────────────────────

/**
 * Geometric ring topology for the 20 AI nodes.
 * Central → Inner → Middle → Outer → Governance
 */
const NODE_RINGS = Object.freeze({
  CENTRAL: {
    radius: 0,
    nodes: ['HeadySoul'],
    role: 'Awareness and values layer — origin point',
  },
  INNER: {
    radius: 1,
    nodes: ['HeadyBrains', 'HeadyConductor', 'HeadyVinci'],
    role: 'Processing core — orchestration, reasoning, planning',
  },
  MIDDLE: {
    radius: PHI,
    nodes: ['JULES', 'BUILDER', 'ATLAS', 'NOVA', 'HeadyLens', 'StoryDriver'],
    role: 'Execution layer — coding, building, monitoring, documentation',
  },
  OUTER: {
    radius: PHI * PHI,
    nodes: ['HeadyScientist', 'HeadyMC', 'PatternRecognition', 'SelfCritique',
            'SASHA', 'Imagination', 'HCSupervisor', 'HCBrain'],
    role: 'Specialized capabilities — research, simulation, creativity, supervision',
  },
  GOVERNANCE: {
    radius: PHI * PHI * PHI,
    nodes: ['HeadyQA', 'HeadyCheck', 'HeadyRisk'],
    role: 'Quality, assurance, risk — governance shell',
  },
});

/**
 * All 20 node names in canonical order (center-out).
 */
const ALL_NODES = Object.freeze(
  Object.values(NODE_RINGS).flatMap(ring => ring.nodes)
);

/**
 * Lookup which ring a node belongs to.
 * @param {string} nodeName
 * @returns {string|null} Ring name or null
 */
function nodeRing(nodeName) {
  for (const [ringName, ring] of Object.entries(NODE_RINGS)) {
    if (ring.nodes.includes(nodeName)) return ringName;
  }
  return null;
}

/**
 * Geometric distance between two nodes based on ring positions.
 * Nodes in the same ring have distance = ring angular separation.
 * Nodes in different rings have distance = ring radius difference.
 * @param {string} nodeA
 * @param {string} nodeB
 * @returns {number}
 */
function nodeDistance(nodeA, nodeB) {
  const ringA = nodeRing(nodeA);
  const ringB = nodeRing(nodeB);
  if (!ringA || !ringB) return Infinity;

  const rA = NODE_RINGS[ringA];
  const rB = NODE_RINGS[ringB];

  if (ringA === ringB) {
    // Same ring: angular distance based on position index
    const idxA = rA.nodes.indexOf(nodeA);
    const idxB = rA.nodes.indexOf(nodeB);
    const angularDist = Math.abs(idxA - idxB) / rA.nodes.length;
    return rA.radius * angularDist * 2 * Math.PI / rA.nodes.length;
  }

  // Different rings: radius difference + minimal angular correction
  return Math.abs(rA.radius - rB.radius);
}

// ─── Coherence Scoring ───────────────────────────────────────────────────────

const COHERENCE_THRESHOLDS = Object.freeze({
  HEALTHY:   CSL_THRESHOLDS.HIGH,     // ≈ 0.882 — normal operating range
  WARNING:   CSL_THRESHOLDS.MEDIUM,   // ≈ 0.809 — slight drift
  DEGRADED:  CSL_THRESHOLDS.LOW,      // ≈ 0.691 — significant drift
  CRITICAL:  CSL_THRESHOLDS.MINIMUM,  // ≈ 0.500 — system integrity at risk
});

/**
 * Compute coherence between two node state embeddings.
 * @param {Float64Array|number[]} stateA
 * @param {Float64Array|number[]} stateB
 * @returns {{ score: number, status: string }}
 */
function coherenceScore(stateA, stateB) {
  const score = cslAND(stateA, stateB);
  let status;
  if (score >= COHERENCE_THRESHOLDS.HEALTHY)   status = 'HEALTHY';
  else if (score >= COHERENCE_THRESHOLDS.WARNING)   status = 'WARNING';
  else if (score >= COHERENCE_THRESHOLDS.DEGRADED)  status = 'DEGRADED';
  else status = 'CRITICAL';
  return { score, status };
}

/**
 * Compute system-wide coherence by averaging all pairwise node scores.
 * @param {Map<string, Float64Array|number[]>} nodeStates - Map of node name → state vector
 * @returns {{ overall: number, status: string, drifted: string[] }}
 */
function systemCoherence(nodeStates) {
  const nodes = Array.from(nodeStates.keys());
  const drifted = [];
  let totalScore = 0;
  let pairCount = 0;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const { score, status } = coherenceScore(
        nodeStates.get(nodes[i]),
        nodeStates.get(nodes[j])
      );
      totalScore += score;
      pairCount++;
      if (status === 'CRITICAL' || status === 'DEGRADED') {
        drifted.push(`${nodes[i]}<->${nodes[j]} (${score.toFixed(3)} ${status})`);
      }
    }
  }

  const overall = pairCount > 0 ? totalScore / pairCount : 0;
  let status;
  if (overall >= COHERENCE_THRESHOLDS.HEALTHY)  status = 'HEALTHY';
  else if (overall >= COHERENCE_THRESHOLDS.WARNING)  status = 'WARNING';
  else if (overall >= COHERENCE_THRESHOLDS.DEGRADED) status = 'DEGRADED';
  else status = 'CRITICAL';

  return { overall, status, drifted };
}

// ─── Pool Scheduling ─────────────────────────────────────────────────────────

/**
 * Hot/Warm/Cold pool definitions with Fibonacci resource ratios.
 */
const POOL_CONFIG = Object.freeze({
  HOT: {
    name: 'hot',
    purpose: 'User-facing, latency-critical tasks',
    resourcePct: fib(9),   // 34%
    maxConcurrency: fib(8), // 21
    timeoutMs: 5000,
    priority: 0,
  },
  WARM: {
    name: 'warm',
    purpose: 'Background processing, non-urgent tasks',
    resourcePct: fib(8),   // 21%
    maxConcurrency: fib(7), // 13
    timeoutMs: 30000,
    priority: 1,
  },
  COLD: {
    name: 'cold',
    purpose: 'Ingestion, analytics, batch processing',
    resourcePct: fib(7),   // 13%
    maxConcurrency: fib(6), // 8
    timeoutMs: 120000,
    priority: 2,
  },
  RESERVE: {
    name: 'reserve',
    purpose: 'Burst capacity for overload conditions',
    resourcePct: fib(6),   // 8%
    maxConcurrency: fib(5), // 5
    timeoutMs: 60000,
    priority: 3,
  },
  GOVERNANCE: {
    name: 'governance',
    purpose: 'Health checks, auditing, compliance',
    resourcePct: fib(5),   // 5%
    maxConcurrency: fib(4), // 3
    timeoutMs: 10000,
    priority: 4,
  },
});

/**
 * Assign a task to the appropriate pool based on priority and type.
 * @param {object} task
 * @param {string} task.type - 'user-facing' | 'background' | 'batch' | 'burst' | 'governance'
 * @param {number} [task.urgency=0.5] - 0–1 urgency score
 * @returns {string} Pool name
 */
function assignPool(task) {
  const urgency = task.urgency || 0.5;
  switch (task.type) {
    case 'user-facing': return 'HOT';
    case 'governance':  return 'GOVERNANCE';
    case 'burst':       return 'RESERVE';
    case 'batch':       return 'COLD';
    case 'background':
      return urgency >= CSL_THRESHOLDS.MEDIUM ? 'WARM' : 'COLD';
    default:
      return urgency >= CSL_THRESHOLDS.HIGH ? 'HOT' : 'WARM';
  }
}

// ─── UI Aesthetic Constants ──────────────────────────────────────────────────

const UI = Object.freeze({
  // Typography scale: φ-based
  TYPE_SCALE: {
    xs:    Math.round(16 / PHI / PHI),  // ≈ 6
    sm:    Math.round(16 / PHI),        // ≈ 10
    base:  16,
    lg:    Math.round(16 * PHI),        // ≈ 26
    xl:    Math.round(16 * PHI * PHI),  // ≈ 42
    '2xl': Math.round(16 * PHI * PHI * PHI), // ≈ 68
  },

  // Fibonacci spacing (px)
  SPACING: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89],

  // Layout ratios
  LAYOUT: {
    primaryWidth:   `${(PSI * 100).toFixed(2)}%`,      // ≈ 61.80%
    secondaryWidth: `${((1 - PSI) * 100).toFixed(2)}%`, // ≈ 38.20%
    goldenSection:  PSI,
  },

  // Color harmony: golden angle ≈ 137.508° for complementary hues
  GOLDEN_ANGLE: 360 / (PHI * PHI), // ≈ 137.508°

  // Brand colors
  COLORS: {
    primary:    '#6C63FF', // Heady Purple
    secondary:  '#FF6584', // Accent Pink
    success:    '#00C9A7', // Sacred Green
    warning:    '#FFB800', // Gold
    danger:     '#FF4757', // Alert Red
    background: '#0F0E17', // Deep Space
    surface:    '#1A1928', // Card Surface
    text:       '#FFFFFE', // Pure White
    muted:      '#94A1B2', // Muted
  },

  // Animation timing (phi-based easing)
  TIMING: {
    instant:  fib(4) * 10,  // 30ms
    fast:     fib(5) * 10,  // 50ms
    normal:   fib(7) * 10,  // 130ms
    slow:     fib(8) * 10,  // 210ms
    glacial:  fib(9) * 10,  // 340ms
  },
});

// ─── Bee Worker Limits ───────────────────────────────────────────────────────

const BEE_LIMITS = Object.freeze({
  maxConcurrentBees:  fib(8),  // 21
  maxQueueDepth:      fib(13), // 233
  beeTimeoutMs:       fib(9) * 1000, // 34 seconds
  maxRetries:         fib(5),  // 5
  healthCheckIntervalMs: fib(7) * 1000, // 13 seconds
  registryCapacity:   fib(10), // 55 registered bee types
});

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Topology
  NODE_RINGS, ALL_NODES, nodeRing, nodeDistance,

  // Coherence
  COHERENCE_THRESHOLDS, coherenceScore, systemCoherence,

  // Pool scheduling
  POOL_CONFIG, assignPool, poolAllocation,

  // UI aesthetics
  UI,

  // Bee limits
  BEE_LIMITS,
};
```

---
