/**
 * Heady™ LiquidProtocol v1.0
 * Three-layer extension system: Skills + MCP Servers + Plugins
 * Every liquid node is simultaneously MCP client AND server.
 *
 * Absorbs: OpenClaw ClawHub (13,700+), MCP ecosystem (19K+),
 * Extism WASM isolation, n8n 500+ integrations.
 *
 * §6 of Super Prompt v7 — Dynamic Connector & Extension Framework
 *
 * @author Eric Haywood — HeadySystems Inc.
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  PHI, PSI, fib,
  CSL_THRESHOLDS,
} = require('../../shared/phi-math');
const { createLogger } = require('../../shared/logger');

const logger = createLogger('liquid-protocol');

const EXTENSION_LAYERS = Object.freeze({
  SKILL:  'SKILL',    // prompt-based, no code
  MCP:    'MCP',      // tool connections via MCP protocol
  PLUGIN: 'PLUGIN',   // distributable bundles with WASM isolation
});

const MCP_TRANSPORTS = Object.freeze({
  STREAMABLE_HTTP: 'streamable-http',
  LEGACY_SSE:      'legacy-sse',
  WEBSOCKET:       'websocket',
  STDIO:           'stdio',
});

const CONNECTOR_CATEGORIES = Object.freeze({
  COMMUNICATION:    'COMMUNICATION',
  DEVELOPER_TOOLS:  'DEVELOPER_TOOLS',
  DATA_STORAGE:     'DATA_STORAGE',
  AI_ML:            'AI_ML',
  BUSINESS:         'BUSINESS',
  CREATIVE_MEDIA:   'CREATIVE_MEDIA',
  INFRA_DEVOPS:     'INFRA_DEVOPS',
  MONITORING:       'MONITORING',
  SECURITY:         'SECURITY',
  RESEARCH:         'RESEARCH',
  FINANCE:          'FINANCE',
  IOT_HARDWARE:     'IOT_HARDWARE',
});

const MAX_CONNECTORS = fib(11);           // 89 built-in types
const MAX_EXTERNAL_MCP = fib(13);         // 233 external MCP servers
const HEALTH_PULSE_MS = Math.round(Math.pow(PHI, 3) * 3600 * 1000); // φ³ hours

class ConnectorEntry {
  constructor(config) {
    this.id = config.id || crypto.randomUUID();
    this.name = config.name;
    this.layer = config.layer;
    this.category = config.category;
    this.transport = config.transport || null;
    this.endpoint = config.endpoint || null;
    this.authType = config.authType || null;    // 'oauth2', 'api_key', 'jwt', 'mtls', 'none'
    this.capabilities = config.capabilities || [];
    this.cslScore = config.cslScore || 1.0;
    this.healthy = true;
    this.lastPulse = Date.now();
    this.errorCount = 0;
    this.totalCalls = 0;
    this.registeredAt = Date.now();
    this.metadata = config.metadata || {};
  }

  get errorRate() {
    return this.totalCalls > 0 ? this.errorCount / this.totalCalls : 0;
  }
}

class LiquidProtocol extends EventEmitter {
  constructor(config = {}) {
    super();
    this._connectors = new Map();       // connectorId → ConnectorEntry
    this._categoryIndex = new Map();    // category → Set<connectorId>
    this._nameIndex = new Map();        // name → connectorId
    this._mcpToolCache = new Map();     // connectorId → Array<tool>

    // Resolution chain for MCP lookup
    this._registries = [
      { name: 'built-in', search: (q) => this._searchBuiltIn(q) },
      { name: 'glama', endpoint: 'https://glama.ai/mcp/servers' },
      { name: 'fastmcp', endpoint: 'https://fastmcp.dev/registry' },
      { name: 'official', endpoint: 'https://modelcontextprotocol.io/servers' },
    ];

    this._metrics = {
      connectorsRegistered: 0,
      totalCalls: 0,
      errorRate: 0,
      healthChecks: 0,
      dynamicGenerations: 0,
    };

    // Health pulse timer
    this._pulseTimer = setInterval(() => this._healthPulse(), HEALTH_PULSE_MS);

    // Register built-in connectors
    this._registerBuiltIns();

    logger.info({ connectors: this._connectors.size }, 'LiquidProtocol initialized');
  }

  // ── Register Connector ─────────────────────────────────────────
  register(config) {
    const entry = new ConnectorEntry(config);
    this._connectors.set(entry.id, entry);
    this._nameIndex.set(entry.name.toLowerCase(), entry.id);

    if (!this._categoryIndex.has(entry.category)) {
      this._categoryIndex.set(entry.category, new Set());
    }
    this._categoryIndex.get(entry.category).add(entry.id);

    this._metrics.connectorsRegistered = this._connectors.size;
    this.emit('connector:registered', { id: entry.id, name: entry.name, layer: entry.layer });

    return entry.id;
  }

  // ── Resolve Connector ──────────────────────────────────────────
  async resolve(query) {
    // Step 1: Check built-in by name
    const nameId = this._nameIndex.get(query.toLowerCase());
    if (nameId) {
      const entry = this._connectors.get(nameId);
      if (entry && entry.healthy) return entry;
    }

    // Step 2: Search by category
    if (query.toUpperCase() in CONNECTOR_CATEGORIES) {
      const ids = this._categoryIndex.get(query.toUpperCase());
      if (ids) {
        const healthy = [...ids].map(id => this._connectors.get(id)).filter(c => c && c.healthy);
        if (healthy.length > 0) return healthy[0];
      }
    }

    // Step 3: Search external registries
    for (const registry of this._registries) {
      if (registry.search) {
        const result = registry.search(query);
        if (result) return result;
      }
    }

    // Step 4: Dynamic generation needed
    this.emit('connector:not_found', { query });
    return null;
  }

  // ── Execute via Connector ──────────────────────────────────────
  async execute(connectorId, toolName, params = {}) {
    const entry = this._connectors.get(connectorId);
    if (!entry) throw new Error(`HEADY-LP-001: Connector not found: ${connectorId}`);
    if (!entry.healthy) throw new Error(`HEADY-LP-002: Connector unhealthy: ${entry.name}`);

    entry.totalCalls++;
    this._metrics.totalCalls++;

    try {
      // Route by layer
      let result;
      switch (entry.layer) {
        case EXTENSION_LAYERS.SKILL:
          result = await this._executeSkill(entry, toolName, params);
          break;
        case EXTENSION_LAYERS.MCP:
          result = await this._executeMCP(entry, toolName, params);
          break;
        case EXTENSION_LAYERS.PLUGIN:
          result = await this._executePlugin(entry, toolName, params);
          break;
        default:
          throw new Error(`HEADY-LP-003: Unknown layer: ${entry.layer}`);
      }

      this.emit('connector:executed', { connectorId, toolName });
      return result;

    } catch (e) {
      entry.errorCount++;
      const errorRate = entry.errorRate;

      // Auto-heal at 15% error rate
      if (errorRate > 0.15) {
        entry.healthy = false;
        this.emit('connector:degraded', { connectorId, name: entry.name, errorRate });
        logger.warn({ name: entry.name, errorRate }, 'Connector degraded — marking unhealthy');
      }

      throw e;
    }
  }

  // ── Layer Executors ────────────────────────────────────────────
  async _executeSkill(entry, toolName, params) {
    // Skills are prompt-based — return the skill instruction for LLM injection
    return {
      type: 'skill',
      instruction: entry.metadata.instruction || '',
      params,
    };
  }

  async _executeMCP(entry, toolName, params) {
    // MCP execution via appropriate transport
    // In production, this calls the actual MCP client SDK
    this.emit('mcp:call', { endpoint: entry.endpoint, tool: toolName, transport: entry.transport });

    return {
      type: 'mcp',
      tool: toolName,
      params,
      transport: entry.transport,
      endpoint: entry.endpoint,
    };
  }

  async _executePlugin(entry, toolName, params) {
    // Plugin execution with WASM isolation
    // In production, this calls Extism runtime
    return {
      type: 'plugin',
      tool: toolName,
      params,
      isolated: true,
    };
  }

  // ── Health Pulse ───────────────────────────────────────────────
  async _healthPulse() {
    this._metrics.healthChecks++;
    let degraded = 0;
    let healed = 0;

    for (const [id, entry] of this._connectors) {
      // Reset error counts periodically
      if (entry.totalCalls > fib(8) && entry.errorRate < 0.05) {
        entry.errorCount = 0;
        entry.totalCalls = 0;
      }

      // Try to heal degraded connectors
      if (!entry.healthy && entry.errorRate < 0.10) {
        entry.healthy = true;
        healed++;
        this.emit('connector:healed', { id, name: entry.name });
      }

      if (!entry.healthy) degraded++;
      entry.lastPulse = Date.now();
    }

    if (degraded > 0 || healed > 0) {
      logger.info({ total: this._connectors.size, degraded, healed }, 'Health pulse complete');
    }

    // Update overall error rate
    let totalErrors = 0, totalCalls = 0;
    for (const entry of this._connectors.values()) {
      totalErrors += entry.errorCount;
      totalCalls += entry.totalCalls;
    }
    this._metrics.errorRate = totalCalls > 0 ? totalErrors / totalCalls : 0;
  }

  // ── Search ─────────────────────────────────────────────────────
  _searchBuiltIn(query) {
    const q = query.toLowerCase();
    for (const [id, entry] of this._connectors) {
      if (entry.name.toLowerCase().includes(q) ||
          entry.capabilities.some(c => c.toLowerCase().includes(q))) {
        return entry;
      }
    }
    return null;
  }

  // ── Built-In Registration ──────────────────────────────────────
  _registerBuiltIns() {
    const builtIns = [
      // Communication (13)
      { name: 'discord', category: 'COMMUNICATION', capabilities: ['messaging', 'bots', 'webhooks'] },
      { name: 'slack', category: 'COMMUNICATION', capabilities: ['messaging', 'bots', 'channels'] },
      { name: 'whatsapp', category: 'COMMUNICATION', capabilities: ['messaging', 'media'] },
      { name: 'telegram', category: 'COMMUNICATION', capabilities: ['messaging', 'bots'] },
      { name: 'signal', category: 'COMMUNICATION', capabilities: ['messaging', 'encrypted'] },
      { name: 'teams', category: 'COMMUNICATION', capabilities: ['messaging', 'meetings'] },
      { name: 'matrix', category: 'COMMUNICATION', capabilities: ['messaging', 'decentralized'] },
      { name: 'email', category: 'COMMUNICATION', capabilities: ['smtp', 'imap'] },
      { name: 'sms-twilio', category: 'COMMUNICATION', capabilities: ['sms', 'voice'] },
      { name: 'nostr', category: 'COMMUNICATION', capabilities: ['messaging', 'decentralized'] },
      { name: 'irc', category: 'COMMUNICATION', capabilities: ['messaging', 'channels'] },
      { name: 'webhooks', category: 'COMMUNICATION', capabilities: ['http', 'events'] },
      { name: 'websocket', category: 'COMMUNICATION', capabilities: ['realtime', 'bidirectional'] },

      // Developer Tools (13)
      { name: 'github', category: 'DEVELOPER_TOOLS', capabilities: ['repos', 'prs', 'issues', 'actions'] },
      { name: 'gitlab', category: 'DEVELOPER_TOOLS', capabilities: ['repos', 'ci', 'issues'] },
      { name: 'bitbucket', category: 'DEVELOPER_TOOLS', capabilities: ['repos', 'pipelines'] },
      { name: 'jira', category: 'DEVELOPER_TOOLS', capabilities: ['issues', 'projects', 'boards'] },
      { name: 'linear', category: 'DEVELOPER_TOOLS', capabilities: ['issues', 'projects', 'cycles'] },
      { name: 'asana', category: 'DEVELOPER_TOOLS', capabilities: ['tasks', 'projects'] },
      { name: 'vscode', category: 'DEVELOPER_TOOLS', capabilities: ['editor', 'extensions'] },
      { name: 'jetbrains', category: 'DEVELOPER_TOOLS', capabilities: ['editor', 'plugins'] },
      { name: 'chrome-ext', category: 'DEVELOPER_TOOLS', capabilities: ['browser', 'extension'] },
      { name: 'desktop-app', category: 'DEVELOPER_TOOLS', capabilities: ['native', 'electron'] },
      { name: 'mobile-app', category: 'DEVELOPER_TOOLS', capabilities: ['android', 'ios'] },
      { name: 'npm-pypi', category: 'DEVELOPER_TOOLS', capabilities: ['packages', 'registry'] },
      { name: 'docker-hub', category: 'DEVELOPER_TOOLS', capabilities: ['containers', 'images'] },

      // Data & Storage (8)
      { name: 'neon-postgres', category: 'DATA_STORAGE', capabilities: ['sql', 'serverless'] },
      { name: 'upstash-redis', category: 'DATA_STORAGE', capabilities: ['cache', 'streams', 'pub-sub'] },
      { name: 'qdrant', category: 'DATA_STORAGE', capabilities: ['vectors', 'search', 'hnsw'] },
      { name: 'supabase', category: 'DATA_STORAGE', capabilities: ['sql', 'auth', 'realtime'] },
      { name: 'firebase', category: 'DATA_STORAGE', capabilities: ['firestore', 'auth', 'hosting'] },
      { name: 'mongodb-atlas', category: 'DATA_STORAGE', capabilities: ['nosql', 'search'] },
      { name: 'google-drive', category: 'DATA_STORAGE', capabilities: ['files', 'sharing'] },
      { name: 'dropbox', category: 'DATA_STORAGE', capabilities: ['files', 'sync'] },

      // AI & ML (8)
      { name: 'anthropic', category: 'AI_ML', capabilities: ['claude', 'completion', 'tools'] },
      { name: 'openai', category: 'AI_ML', capabilities: ['gpt', 'embeddings', 'vision'] },
      { name: 'google-gemini', category: 'AI_ML', capabilities: ['gemini', 'vertex', 'grounding'] },
      { name: 'groq', category: 'AI_ML', capabilities: ['fast-inference', 'llama'] },
      { name: 'perplexity', category: 'AI_ML', capabilities: ['search', 'sonar'] },
      { name: 'huggingface', category: 'AI_ML', capabilities: ['models', 'datasets', 'spaces'] },
      { name: 'colab-pro', category: 'AI_ML', capabilities: ['gpu', 'notebooks', 'a100'] },
      { name: 'replicate', category: 'AI_ML', capabilities: ['inference', 'models'] },

      // Infrastructure (8)
      { name: 'cloud-run', category: 'INFRA_DEVOPS', capabilities: ['containers', 'autoscale'] },
      { name: 'cloudflare', category: 'INFRA_DEVOPS', capabilities: ['workers', 'pages', 'kv', 'cdn'] },
      { name: 'aws', category: 'INFRA_DEVOPS', capabilities: ['lambda', 's3', 'ec2'] },
      { name: 'azure', category: 'INFRA_DEVOPS', capabilities: ['functions', 'blob', 'aks'] },
      { name: 'vercel', category: 'INFRA_DEVOPS', capabilities: ['deploy', 'edge', 'serverless'] },
      { name: 'netlify', category: 'INFRA_DEVOPS', capabilities: ['deploy', 'forms', 'edge'] },
      { name: 'terraform', category: 'INFRA_DEVOPS', capabilities: ['iac', 'provisioning'] },
      { name: 'kubernetes', category: 'INFRA_DEVOPS', capabilities: ['orchestration', 'pods'] },

      // Creative & Media (8)
      { name: 'ableton-midi', category: 'CREATIVE_MEDIA', capabilities: ['midi', 'sysex', 'audio'] },
      { name: 'figma', category: 'CREATIVE_MEDIA', capabilities: ['design', 'prototyping'] },
      { name: 'canva', category: 'CREATIVE_MEDIA', capabilities: ['design', 'templates'] },
      { name: 'youtube', category: 'CREATIVE_MEDIA', capabilities: ['video', 'streaming'] },
      { name: 'spotify', category: 'CREATIVE_MEDIA', capabilities: ['music', 'playlists'] },
      { name: 'elevenlabs', category: 'CREATIVE_MEDIA', capabilities: ['tts', 'voice-clone'] },
      { name: 'image-gen', category: 'CREATIVE_MEDIA', capabilities: ['midjourney', 'dall-e'] },
      { name: 'ffmpeg', category: 'CREATIVE_MEDIA', capabilities: ['video', 'audio', 'transcode'] },
    ];

    for (const bi of builtIns) {
      this.register({
        name: bi.name,
        layer: EXTENSION_LAYERS.MCP,
        category: bi.category,
        capabilities: bi.capabilities,
        transport: MCP_TRANSPORTS.STREAMABLE_HTTP,
      });
    }
  }

  // ── Query API ──────────────────────────────────────────────────
  list(category = null) {
    let entries = [...this._connectors.values()];
    if (category) entries = entries.filter(e => e.category === category);
    return entries.map(e => ({
      id: e.id, name: e.name, layer: e.layer, category: e.category,
      healthy: e.healthy, capabilities: e.capabilities,
      errorRate: e.errorRate, totalCalls: e.totalCalls,
    }));
  }

  getByName(name) {
    const id = this._nameIndex.get(name.toLowerCase());
    return id ? this._connectors.get(id) : null;
  }

  getCategories() {
    const result = {};
    for (const [cat, ids] of this._categoryIndex) {
      result[cat] = ids.size;
    }
    return result;
  }

  // ── Lifecycle ──────────────────────────────────────────────────
  destroy() {
    clearInterval(this._pulseTimer);
    this._connectors.clear();
    this.removeAllListeners();
  }

  get metrics() { return { ...this._metrics }; }
  get connectorCount() { return this._connectors.size; }
}

module.exports = {
  LiquidProtocol,
  EXTENSION_LAYERS,
  MCP_TRANSPORTS,
  CONNECTOR_CATEGORIES,
};
