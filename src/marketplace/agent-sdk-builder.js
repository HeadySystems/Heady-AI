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
// ║  FILE: src/marketplace/agent-sdk-builder.js                     ║
// ║  LAYER: marketplace/sdk                                         ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

/**
 * Agent SDK Builder — packages argus-v2, hermes-v2, kronos-v2 as deployable
 * marketplace bundles with manifest generation, validation, and catalog.
 *
 * Each bundle includes:
 *   - Agent metadata (name, version, description, category, exports)
 *   - Manifest with required lifecycle hooks: init, execute, shutdown
 *   - Compatibility info and dependency declarations
 *   - Bundle hash for integrity verification
 *
 * The v2 agents expose start()/stop() natively; this builder wraps them
 * into the marketplace-standard init/execute/shutdown interface.
 */
'use strict';
const logger = require(require('path').resolve(__dirname, '..', 'utils', 'logger')) || console;

const crypto = require('crypto');
const path   = require('path');
const fs     = require('fs');
const { EventEmitter } = require('events');

// ─── Constants ──────────────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 0.618033988749895;

const AGENTS_DIR = path.resolve(__dirname, '..', 'agents');

const REQUIRED_BUNDLE_EXPORTS = ['init', 'execute', 'shutdown'];

const BUNDLE_SCHEMA_VERSION = '1.0.0';

// ─── Event Bus ──────────────────────────────────────────────────────────────
function getEventBus() {
  if (!global.eventBus) {
    global.eventBus = new EventEmitter();
    global.eventBus.setMaxListeners(100);
  }
  return global.eventBus;
}

function emit(event, payload) {
  try {
    getEventBus().emit(event, { ...payload, timestamp: Date.now() });
  } catch (_) { /* Swallow — SDK builder must not crash on listener failures */ }
}

// ─── Built-in Agent Definitions ─────────────────────────────────────────────

/**
 * Canonical registry of v2 agents that can be packaged for the marketplace.
 * Each entry describes how to load the agent, what it exports, and its
 * marketplace metadata.
 */
const BUILTIN_AGENTS = {
  'argus-v2': {
    file: 'argus-v2.js',
    className: 'ArgusV2Agent',
    name: 'ARGUS',
    version: '2.0.0',
    description: 'Panoptic AI Observability — OTel GenAI semantic conventions, cross-MCP trace propagation, wide events, phi-scaled alert thresholds.',
    category: 'observability',
    author: 'Heady Systems',
    pricing: { model: 'metered', priceUsd: 0.002 },
    tags: ['observability', 'telemetry', 'otel', 'drift-detection', 'tracing'],
    exports: ['ArgusV2Agent', 'OTEL_GENAI', 'DriftSignals', 'PHI_HEALTH'],
    capabilities: {
      auditLog: true,
      driftDetection: true,
      wideEvents: true,
      otelGenAI: true,
      phiHealth: true,
    },
  },
  'hermes-v2': {
    file: 'hermes-v2.js',
    className: 'HermesV2Agent',
    name: 'HERMES',
    version: '2.0.0',
    description: 'Agent Name Service + 81-Skill Registry — DNS-inspired agent resolution, Fibonacci-branching skill trees, phi-weighted trust scoring.',
    category: 'communication',
    author: 'Heady Systems',
    pricing: { model: 'metered', priceUsd: 0.001 },
    tags: ['agent-registry', 'skill-discovery', 'trust-scoring', 'a2a', 'dns'],
    exports: ['HermesV2Agent', 'computeTrustScore', 'CSL', 'TRUST_WEIGHTS'],
    capabilities: {
      agentNameService: true,
      skillRegistry: true,
      trustScoring: true,
      vectorSearch: true,
      oauthIntegration: true,
    },
  },
  'kronos-v2': {
    file: 'kronos-v2.js',
    className: 'KronosV2Agent',
    name: 'KRONOS',
    version: '2.0.0',
    description: 'Temporal Memory Indexer — bi-level temporal knowledge graph, time-aware retrieval, phi-decay edge weights, Fibonacci-indexed time buckets.',
    category: 'memory',
    author: 'Heady Systems',
    pricing: { model: 'metered', priceUsd: 0.0015 },
    tags: ['temporal', 'memory', 'knowledge-graph', 'time-aware', 'phi-decay'],
    exports: ['KronosV2Agent', 'TaskState'],
    capabilities: {
      temporalGraph: true,
      timeAwareRetrieval: true,
      phiDecay: true,
      taskLifecycle: true,
      edgeInvalidation: true,
    },
  },
};

// ─── Bundle Builder ─────────────────────────────────────────────────────────

/**
 * Load the source file for a built-in agent and compute its hash.
 * @param {string} filename - The agent source filename
 * @returns {{ source: string, hash: string, size: number }}
 */
function loadAgentSource(filename) {
  const filePath = path.join(AGENTS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Agent source not found: ${filePath}`);
  }

  const source = fs.readFileSync(filePath, 'utf8');
  const hash = crypto.createHash('sha256').update(source).digest('hex');
  const stats = fs.statSync(filePath);

  return {
    source,
    hash,
    size: stats.size,
    path: filePath,
    lastModified: stats.mtime.toISOString(),
  };
}

/**
 * Create a marketplace-standard lifecycle wrapper around a v2 agent.
 * Maps start() -> init(), agent methods -> execute(), stop() -> shutdown().
 *
 * @param {string} agentName - Key in BUILTIN_AGENTS
 * @returns {{ init: Function, execute: Function, shutdown: Function }}
 */
function createLifecycleWrapper(agentName) {
  const def = BUILTIN_AGENTS[agentName];
  if (!def) throw new Error(`Unknown agent: ${agentName}`);

  const agentModule = require(path.join(AGENTS_DIR, def.file));
  const AgentClass = agentModule[def.className];

  if (!AgentClass) {
    throw new Error(`Agent class ${def.className} not found in ${def.file}`);
  }

  let instance = null;

  return {
    /**
     * Initialize the agent instance with optional configuration.
     * @param {Object} opts - Agent-specific options
     * @returns {Promise<Object>} Startup result
     */
    async init(opts = {}) {
      if (instance) {
        return { status: 'already_initialized', agent: def.name, version: def.version };
      }
      instance = new AgentClass(opts);
      if (typeof instance.start === 'function') {
        const result = await instance.start();
        return { status: 'initialized', agent: def.name, version: def.version, ...result };
      }
      return { status: 'initialized', agent: def.name, version: def.version };
    },

    /**
     * Execute an operation on the agent.
     * @param {string} method - Method name to call on the agent
     * @param {Array} args - Arguments to pass
     * @returns {Promise<*>} Method result
     */
    async execute(method, ...args) {
      if (!instance) {
        throw new Error(`Agent ${def.name} not initialized — call init() first`);
      }
      if (typeof instance[method] !== 'function') {
        throw new Error(`Agent ${def.name} has no method: ${method}`);
      }
      return instance[method](...args);
    },

    /**
     * Gracefully shut down the agent.
     * @returns {Promise<Object>} Shutdown result
     */
    async shutdown() {
      if (!instance) {
        return { status: 'not_running', agent: def.name };
      }
      if (typeof instance.stop === 'function') {
        await instance.stop();
      }
      instance = null;
      return { status: 'shutdown', agent: def.name, version: def.version };
    },
  };
}

/**
 * Build a deployable marketplace bundle for a named agent.
 *
 * @param {string} agentName - Key in BUILTIN_AGENTS (e.g. 'argus-v2')
 * @returns {{ manifest: Object, wrapper: Object, metadata: Object }}
 */
function buildAgentBundle(agentName) {
  const def = BUILTIN_AGENTS[agentName];
  if (!def) {
    const available = Object.keys(BUILTIN_AGENTS).join(', ');
    throw new Error(`Unknown agent "${agentName}". Available: ${available}`);
  }

  // Load and hash the source
  const sourceInfo = loadAgentSource(def.file);

  // Create lifecycle wrapper
  const wrapper = createLifecycleWrapper(agentName);

  // Build the manifest
  const manifest = {
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    agentId: agentName,
    name: def.name,
    version: def.version,
    description: def.description,
    author: def.author,
    category: def.category,
    pricing: def.pricing,
    tags: def.tags,
    capabilities: def.capabilities,
    exports: def.exports,
    lifecycle: {
      init: 'async init(opts) -> { status, agent, version }',
      execute: 'async execute(method, ...args) -> result',
      shutdown: 'async shutdown() -> { status, agent, version }',
    },
    source: {
      file: def.file,
      hash: sourceInfo.hash,
      size: sourceInfo.size,
      lastModified: sourceInfo.lastModified,
    },
    compatibility: {
      nodeVersion: '>=18.0.0',
      platform: 'heady-marketplace',
      sdkVersion: BUNDLE_SCHEMA_VERSION,
    },
    builtAt: new Date().toISOString(),
    bundleHash: crypto.createHash('sha256')
      .update(`${agentName}:${def.version}:${sourceInfo.hash}:${Date.now()}`)
      .digest('hex'),
  };

  const metadata = {
    agentName,
    displayName: def.name,
    version: def.version,
    category: def.category,
    bundleHash: manifest.bundleHash,
    sourceHash: sourceInfo.hash,
    sourceSize: sourceInfo.size,
    builtAt: manifest.builtAt,
  };

  emit('marketplace:bundle_built', {
    agentName,
    version: def.version,
    bundleHash: manifest.bundleHash,
    sourceHash: sourceInfo.hash,
  });

  return { manifest, wrapper, metadata };
}

// ─── Bundle Validation ──────────────────────────────────────────────────────

/**
 * Validate that an agent bundle has the required marketplace exports.
 *
 * Checks:
 *   1. Bundle has a wrapper object
 *   2. Wrapper exposes init, execute, shutdown as functions
 *   3. Manifest has required fields
 *   4. Source hash is present and non-empty
 *
 * @param {{ manifest: Object, wrapper: Object, metadata: Object }} bundle
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateAgentBundle(bundle) {
  const errors = [];
  const warnings = [];

  // Check bundle structure
  if (!bundle || typeof bundle !== 'object') {
    return { valid: false, errors: ['Bundle must be a non-null object'], warnings };
  }

  if (!bundle.wrapper || typeof bundle.wrapper !== 'object') {
    errors.push('Bundle must have a wrapper object');
  } else {
    // Verify required lifecycle exports
    for (const fn of REQUIRED_BUNDLE_EXPORTS) {
      if (typeof bundle.wrapper[fn] !== 'function') {
        errors.push(`Missing required export: ${fn} (must be a function)`);
      }
    }
  }

  if (!bundle.manifest || typeof bundle.manifest !== 'object') {
    errors.push('Bundle must have a manifest object');
  } else {
    const m = bundle.manifest;

    // Required manifest fields
    const requiredFields = ['schemaVersion', 'agentId', 'name', 'version', 'description', 'author', 'category'];
    for (const field of requiredFields) {
      if (!m[field] || (typeof m[field] === 'string' && m[field].trim().length === 0)) {
        errors.push(`Manifest missing required field: ${field}`);
      }
    }

    // Version must be semver
    if (m.version && !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(m.version)) {
      errors.push('Manifest version must be valid semver');
    }

    // Source hash
    if (!m.source || !m.source.hash) {
      errors.push('Manifest must include source.hash for integrity verification');
    }

    // Pricing
    if (!m.pricing || typeof m.pricing !== 'object') {
      warnings.push('No pricing information — defaults to free');
    }

    // Capabilities
    if (!m.capabilities || Object.keys(m.capabilities).length === 0) {
      warnings.push('No capabilities declared — agent may not be discoverable');
    }

    // Schema version compatibility
    if (m.schemaVersion !== BUNDLE_SCHEMA_VERSION) {
      warnings.push(`Schema version ${m.schemaVersion} differs from current ${BUNDLE_SCHEMA_VERSION}`);
    }
  }

  if (!bundle.metadata || typeof bundle.metadata !== 'object') {
    warnings.push('Bundle has no metadata — some marketplace features may be limited');
  }

  const valid = errors.length === 0;

  emit('marketplace:bundle_validated', {
    agentName: bundle.manifest?.agentId || 'unknown',
    valid,
    errorCount: errors.length,
    warningCount: warnings.length,
  });

  return { valid, errors, warnings };
}

// ─── Agent Catalog ──────────────────────────────────────────────────────────

/**
 * Return the full catalog of built-in agents available for marketplace packaging.
 *
 * @returns {Array<Object>} Array of agent catalog entries
 */
function getAgentCatalog() {
  const catalog = [];

  for (const [agentKey, def] of Object.entries(BUILTIN_AGENTS)) {
    let sourceAvailable = false;
    let sourceHash = null;
    let sourceSize = 0;

    try {
      const info = loadAgentSource(def.file);
      sourceAvailable = true;
      sourceHash = info.hash;
      sourceSize = info.size;
    } catch (_) { /* Source not available — still list in catalog but mark unavailable */ }

    catalog.push({
      agentKey,
      name: def.name,
      version: def.version,
      description: def.description,
      category: def.category,
      author: def.author,
      pricing: def.pricing,
      tags: def.tags,
      capabilities: def.capabilities,
      exports: def.exports,
      sourceAvailable,
      sourceHash,
      sourceSize,
    });
  }

  emit('marketplace:catalog_queried', {
    agentCount: catalog.length,
    available: catalog.filter(a => a.sourceAvailable).length,
  });

  return catalog;
}

/**
 * Build all available agent bundles at once.
 *
 * @returns {{ bundles: Object, errors: Object, summary: Object }}
 */
function buildAllBundles() {
  const bundles = {};
  const errors = {};
  let successCount = 0;
  let failCount = 0;

  for (const agentKey of Object.keys(BUILTIN_AGENTS)) {
    try {
      const bundle = buildAgentBundle(agentKey);
      const validation = validateAgentBundle(bundle);

      if (validation.valid) {
        bundles[agentKey] = bundle;
        successCount++;
      } else {
        errors[agentKey] = validation.errors;
        failCount++;
      }
    } catch (err) {
      errors[agentKey] = [err.message];
      failCount++;
    }
  }

  const summary = {
    total: Object.keys(BUILTIN_AGENTS).length,
    success: successCount,
    failed: failCount,
    builtAt: new Date().toISOString(),
  };

  emit('marketplace:all_bundles_built', summary);

  return { bundles, errors, summary };
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  buildAgentBundle,
  validateAgentBundle,
  getAgentCatalog,
  buildAllBundles,
  createLifecycleWrapper,
  // Constants for external consumers
  BUILTIN_AGENTS,
  BUNDLE_SCHEMA_VERSION,
  REQUIRED_BUNDLE_EXPORTS,
};
