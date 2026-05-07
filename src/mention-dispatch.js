/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Heady @Mention Dispatch Engine
 * ══════════════════════════════════════════════════════════
 *
 * Slack-style @mention routing for directing execution to specific
 * models, nodes, services, swarms, or targets within the Heady ecosystem.
 *
 * Syntax patterns:
 *   @HeadyBrains          → Route to a Sacred Geometry node
 *   @gemini               → Route to a specific AI provider
 *   @claude               → Route to Anthropic
 *   @gpt4                 → Route to OpenAI GPT-4
 *   @reasoning            → Route to a service group
 *   @swarm:ForagerBee     → Route to a specific bee swarm
 *   @auto-success         → Route to the Auto-Success Engine
 *   @cssd                 → Route to the Comprehensive System Diagnostic
 *   @all                  → Broadcast to all nodes
 *
 * The parser extracts @mentions from natural language, resolves them
 * to canonical Heady routing targets, and returns a dispatch plan
 * that the Conductor can execute.
 *
 * All timing and thresholds are φ-derived.
 */

'use strict';

// ─── φ constants ────────────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 1 / PHI;

// ═══════════════════════════════════════════════════════════════════════════
// TARGET REGISTRIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sacred Geometry nodes — the 20 canonical AI nodes.
 * Maps lowercase aliases to canonical node names.
 */
const NODE_ALIASES = {
  // Central
  headysoul:      'HeadySoul',
  soul:           'HeadySoul',

  // Inner
  headybrains:    'HeadyBrains',
  brains:         'HeadyBrains',
  brain:          'HeadyBrains',
  headyconductor: 'HeadyConductor',
  conductor:      'HeadyConductor',
  headyvinci:     'HeadyVinci',
  vinci:          'HeadyVinci',

  // Middle
  jules:          'JULES',
  builder:        'BUILDER',
  atlas:          'ATLAS',
  nova:           'NOVA',
  headylens:      'HeadyLens',
  lens:           'HeadyLens',
  storydriver:    'StoryDriver',
  story:          'StoryDriver',

  // Outer
  headyscientist: 'HeadyScientist',
  scientist:      'HeadyScientist',
  headymc:        'HeadyMC',
  mc:             'HeadyMC',
  montecarlo:     'HeadyMC',
  patternrecognition: 'PatternRecognition',
  patterns:       'PatternRecognition',
  selfcritique:   'SelfCritique',
  critique:       'SelfCritique',
  sasha:          'SASHA',
  imagination:    'Imagination',
  hcsupervisor:   'HCSupervisor',
  supervisor:     'HCSupervisor',
  hcbrain:        'HCBrain',

  // Governance
  headyqa:        'HeadyQA',
  qa:             'HeadyQA',
  headycheck:     'HeadyCheck',
  check:          'HeadyCheck',
  headyrisk:      'HeadyRisk',
  risk:           'HeadyRisk',
};

/**
 * AI model/provider aliases.
 * Maps user-friendly names to provider + model identifiers.
 */
const MODEL_ALIASES = {
  // Google
  gemini:            { provider: 'google', model: 'gemini-2.0-flash', tier: 'S' },
  'gemini-pro':      { provider: 'google', model: 'gemini-2.0-pro-exp-02-05', tier: 'S' },
  'gemini-flash':    { provider: 'google', model: 'gemini-2.0-flash', tier: 'M' },
  'flash-lite':      { provider: 'google', model: 'gemini-2.5-flash-lite', tier: 'L' },

  // OpenAI
  gpt4:              { provider: 'openai', model: 'gpt-5.4', tier: 'S' },
  gpt:               { provider: 'openai', model: 'gpt-5.4', tier: 'S' },
  'gpt-4o':          { provider: 'openai', model: 'gpt-4o', tier: 'M' },
  'gpt-mini':        { provider: 'openai', model: 'gpt-4o-mini', tier: 'L' },
  openai:            { provider: 'openai', model: 'gpt-5.4', tier: 'S' },

  // Anthropic
  claude:            { provider: 'anthropic', model: 'claude-sonnet-4-20250514', tier: 'S' },
  'claude-sonnet':   { provider: 'anthropic', model: 'claude-sonnet-4-20250514', tier: 'S' },
  'claude-haiku':    { provider: 'anthropic', model: 'claude-3-5-haiku-20241022', tier: 'L' },
  anthropic:         { provider: 'anthropic', model: 'claude-sonnet-4-20250514', tier: 'S' },

  // Groq (fast inference)
  groq:              { provider: 'groq', model: 'llama-3.3-70b-versatile', tier: 'M' },
  llama:             { provider: 'groq', model: 'llama-3.3-70b-versatile', tier: 'M' },
  'llama-fast':      { provider: 'groq', model: 'llama-3.1-8b-instant', tier: 'L' },

  // Perplexity (search-augmented)
  perplexity:        { provider: 'perplexity', model: 'sonar-pro', tier: 'S' },
  sonar:             { provider: 'perplexity', model: 'sonar-pro', tier: 'S' },
  'deep-research':   { provider: 'perplexity', model: 'sonar-deep-research', tier: 'S' },

  // Workers AI (edge)
  'workers-ai':      { provider: 'workers-ai', model: 'bge-m3', tier: 'L' },
  edge:              { provider: 'workers-ai', model: 'bge-m3', tier: 'L' },
};

/**
 * Service group aliases (from HeadyConductor ROUTING_TABLE).
 */
const SERVICE_ALIASES = {
  // Core service groups
  reasoning:     'reasoning',
  coding:        'coding',
  code:          'coding',
  intelligence:  'intelligence',
  intel:         'intelligence',
  embedding:     'embedding',
  embed:         'embedding',
  search:        'search',
  swarm:         'swarm',
  creative:      'creative',
  create:        'creative',
  battle:        'battle',
  arena:         'battle',
  vision:        'vision',
  sims:          'sims',
  simulate:      'sims',
  governance:    'governance',
  ops:           'ops',
  deploy:        'ops',
  health:        'ops',
  kiosk:         'kiosk',
  dispense:      'kiosk',
  verify:        'kiosk',

  // Provider groups
  'heady-reasoning':    'heady-reasoning',
  'heady-multimodal':   'heady-multimodal',
  'heady-enterprise':   'heady-enterprise',
  'heady-open-weights': 'heady-open-weights',
  'heady-cloud-vertex': 'heady-cloud-vertex',
  'heady-edge-local':   'heady-edge-local',
  'heady-edge-native':  'heady-edge-native',
};

/**
 * System/subsystem aliases for internal Heady components.
 */
const SYSTEM_ALIASES = {
  'auto-success':  { type: 'system', target: 'AutoSuccessEngine' },
  autosuccess:     { type: 'system', target: 'AutoSuccessEngine' },
  cssd:            { type: 'system', target: 'ComprehensiveSystemDiagnostic' },
  diagnostic:      { type: 'system', target: 'ComprehensiveSystemDiagnostic' },
  pipeline:        { type: 'system', target: 'HCFullPipeline' },
  hcfp:            { type: 'system', target: 'HCFullPipeline' },
  memory:          { type: 'system', target: 'VectorMemory' },
  vault:           { type: 'system', target: 'HeadyVault' },
  sentry:          { type: 'system', target: 'SentryErrorTracking' },
  linear:          { type: 'system', target: 'LinearProjectSync' },
  buddy:           { type: 'system', target: 'HeadyBuddy' },
  fipl:            { type: 'system', target: 'FrequencyInterferenceDetector' },
  kernel:          { type: 'system', target: 'HeadyKernel' },
  kiosk:           { type: 'system', target: 'HeadyKiosk' },
  'heady-kiosk':   { type: 'system', target: 'HeadyKiosk' },
  'id-verify':     { type: 'system', target: 'HeadyKiosk' },
  compliance:      { type: 'system', target: 'KioskComplianceEngine' },
  all:             { type: 'broadcast', target: '*' },
  everyone:        { type: 'broadcast', target: '*' },
};

// ═══════════════════════════════════════════════════════════════════════════
// @MENTION PARSER
// ═══════════════════════════════════════════════════════════════════════════

// Matches @word, @word-word, @word:word patterns
const MENTION_REGEX = /@([a-zA-Z][a-zA-Z0-9_-]*(?::[a-zA-Z0-9_-]+)?)/g;

/**
 * Parse a message string and extract all @mentions.
 *
 * @param {string} message — The raw user input
 * @returns {{ mentions: MentionTarget[], cleanMessage: string, hasMentions: boolean }}
 */
function parseMentions(message) {
  if (!message || typeof message !== 'string') {
    return { mentions: [], cleanMessage: message || '', hasMentions: false };
  }

  const mentions = [];
  const seen = new Set();
  let match;

  // Reset regex lastIndex
  MENTION_REGEX.lastIndex = 0;

  while ((match = MENTION_REGEX.exec(message)) !== null) {
    const raw = match[1];
    const key = raw.toLowerCase();

    // Avoid duplicates
    if (seen.has(key)) continue;
    seen.add(key);

    const resolved = resolveMention(raw);
    if (resolved) {
      mentions.push(resolved);
    }
  }

  // Strip @mentions from the message to get the clean task text
  const cleanMessage = message.replace(MENTION_REGEX, '').replace(/\s{2,}/g, ' ').trim();

  return {
    mentions,
    cleanMessage,
    hasMentions: mentions.length > 0,
  };
}

/**
 * Resolve a single @mention token to a typed target.
 *
 * @param {string} raw — The mention text (without the @ prefix)
 * @returns {MentionTarget|null}
 *
 * @typedef {Object} MentionTarget
 * @property {string} type — 'node' | 'model' | 'service' | 'system' | 'swarm' | 'broadcast'
 * @property {string} raw — Original mention text
 * @property {string} canonical — Canonical target name
 * @property {object} [meta] — Additional metadata (provider, model, tier, etc.)
 */
function resolveMention(raw) {
  const key = raw.toLowerCase().replace(/[-_]/g, '');
  const keyWithDashes = raw.toLowerCase();

  // 1. Check swarm prefix (@swarm:BeeType)
  if (keyWithDashes.startsWith('swarm:')) {
    const swarmType = raw.split(':')[1];
    return {
      type: 'swarm',
      raw,
      canonical: swarmType,
      meta: { swarmType, dispatch: 'bee_spawn' },
    };
  }

  // 2. Check Sacred Geometry nodes
  if (NODE_ALIASES[key]) {
    return {
      type: 'node',
      raw,
      canonical: NODE_ALIASES[key],
      meta: { topology: 'sacred-geometry' },
    };
  }

  // 3. Check AI models/providers
  if (MODEL_ALIASES[keyWithDashes]) {
    const model = MODEL_ALIASES[keyWithDashes];
    return {
      type: 'model',
      raw,
      canonical: `${model.provider}/${model.model}`,
      meta: { ...model },
    };
  }

  // 4. Check service groups
  if (SERVICE_ALIASES[keyWithDashes]) {
    return {
      type: 'service',
      raw,
      canonical: SERVICE_ALIASES[keyWithDashes],
      meta: { dispatch: 'conductor_route' },
    };
  }

  // 5. Check system targets
  if (SYSTEM_ALIASES[keyWithDashes]) {
    const sys = SYSTEM_ALIASES[keyWithDashes];
    return {
      type: sys.type,
      raw,
      canonical: sys.target,
      meta: { dispatch: sys.type === 'broadcast' ? 'fan_out' : 'direct' },
    };
  }

  // 6. Fuzzy match: check if any alias starts with the key (prefix matching)
  const allAliases = {
    ...Object.fromEntries(Object.entries(NODE_ALIASES).map(([k, v]) => [k, { type: 'node', canonical: v }])),
    ...Object.fromEntries(Object.entries(MODEL_ALIASES).map(([k, v]) => [k, { type: 'model', canonical: `${v.provider}/${v.model}`, meta: v }])),
    ...Object.fromEntries(Object.entries(SERVICE_ALIASES).map(([k, v]) => [k, { type: 'service', canonical: v }])),
    ...Object.fromEntries(Object.entries(SYSTEM_ALIASES).map(([k, v]) => [k, { type: v.type, canonical: v.target }])),
  };

  // Find best prefix match
  const candidates = Object.entries(allAliases)
    .filter(([alias]) => alias.startsWith(key))
    .sort((a, b) => a[0].length - b[0].length);

  if (candidates.length === 1) {
    const [, target] = candidates[0];
    return { ...target, raw, meta: target.meta || {} };
  }

  // Unknown mention — return null (not routable)
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DISPATCH PLAN BUILDER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a dispatch plan from parsed @mentions.
 * The plan tells the Conductor exactly how to execute the task.
 *
 * @param {MentionTarget[]} mentions
 * @param {string} cleanMessage — The task text without @mentions
 * @returns {DispatchPlan}
 *
 * @typedef {Object} DispatchPlan
 * @property {string} strategy — 'direct' | 'fan_out' | 'cascade' | 'model_override' | 'default'
 * @property {object[]} targets — Ordered execution targets
 * @property {string} message — The clean task text
 * @property {object|null} modelOverride — If a model was explicitly targeted
 * @property {boolean} isBroadcast — True if @all was used
 */
function buildDispatchPlan(mentions, cleanMessage) {
  if (!mentions || mentions.length === 0) {
    return {
      strategy: 'default',
      targets: [],
      message: cleanMessage,
      modelOverride: null,
      isBroadcast: false,
    };
  }

  // Check for broadcast
  const isBroadcast = mentions.some(m => m.type === 'broadcast');
  if (isBroadcast) {
    return {
      strategy: 'fan_out',
      targets: Object.values(NODE_ALIASES)
        .filter((v, i, a) => a.indexOf(v) === i) // unique
        .map(node => ({ type: 'node', canonical: node })),
      message: cleanMessage,
      modelOverride: null,
      isBroadcast: true,
    };
  }

  // Extract model overrides
  const modelMentions = mentions.filter(m => m.type === 'model');
  const modelOverride = modelMentions.length > 0 ? modelMentions[0].meta : null;

  // Build target list (preserving order)
  const targets = mentions
    .filter(m => m.type !== 'model') // Models are overrides, not targets
    .map(m => ({
      type: m.type,
      canonical: m.canonical,
      meta: m.meta,
    }));

  // Determine strategy
  let strategy;
  if (targets.length === 0 && modelOverride) {
    strategy = 'model_override';
  } else if (targets.length === 1) {
    strategy = 'direct';
  } else if (targets.length > 1) {
    strategy = 'cascade';
  } else {
    strategy = 'default';
  }

  return {
    strategy,
    targets,
    message: cleanMessage,
    modelOverride,
    isBroadcast: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN DISPATCH FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse, resolve, and build a dispatch plan from a user message.
 * This is the primary entry point — equivalent to Slack's @mention handler.
 *
 * @param {string} message — Raw user input containing @mentions
 * @returns {DispatchPlan}
 *
 * @example
 *   dispatch("@gemini analyze the performance of this codebase")
 *   // → { strategy: 'model_override', modelOverride: { provider: 'google', model: 'gemini-2.0-flash' }, ... }
 *
 *   dispatch("@HeadyBrains @HeadyVinci decompose this task")
 *   // → { strategy: 'cascade', targets: [{node: 'HeadyBrains'}, {node: 'HeadyVinci'}], ... }
 *
 *   dispatch("@all status report")
 *   // → { strategy: 'fan_out', isBroadcast: true, targets: [all 20 nodes], ... }
 *
 *   dispatch("@claude @reasoning deep analysis of system health")
 *   // → { strategy: 'direct', modelOverride: {anthropic/claude-sonnet}, targets: [{service: 'reasoning'}] }
 */
function dispatch(message) {
  const { mentions, cleanMessage, hasMentions } = parseMentions(message);
  const plan = buildDispatchPlan(mentions, cleanMessage);

  return {
    ...plan,
    mentions,
    hasMentions,
    originalMessage: message,
    parsedAt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// REGISTRY INTROSPECTION (for autocomplete / help)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get all available @mention targets, grouped by type.
 * Useful for autocomplete and help dialogs.
 */
function getAvailableTargets() {
  const nodes = [...new Set(Object.values(NODE_ALIASES))];
  const models = Object.entries(MODEL_ALIASES).map(([alias, m]) => ({
    alias: `@${alias}`,
    provider: m.provider,
    model: m.model,
    tier: m.tier,
  }));
  const services = [...new Set(Object.values(SERVICE_ALIASES))].map(s => ({
    alias: `@${s}`,
    group: s,
  }));
  const systems = Object.entries(SYSTEM_ALIASES).map(([alias, s]) => ({
    alias: `@${alias}`,
    target: s.target,
    type: s.type,
  }));

  return {
    nodes: nodes.map(n => ({ alias: `@${n}`, canonical: n })),
    models,
    services,
    systems,
    totalTargets: nodes.length + models.length + services.length + systems.length,
  };
}

/**
 * Autocomplete suggestions for a partial @mention.
 * @param {string} partial — e.g., "gem" (without @)
 * @returns {string[]} — Matching aliases sorted by relevance
 */
function autocomplete(partial) {
  if (!partial) return [];
  const key = partial.toLowerCase();

  const allAliases = [
    ...Object.keys(NODE_ALIASES),
    ...Object.keys(MODEL_ALIASES),
    ...Object.keys(SERVICE_ALIASES),
    ...Object.keys(SYSTEM_ALIASES),
  ];

  // Deduplicate and sort: exact prefix first, then contains
  const prefixMatches = allAliases.filter(a => a.startsWith(key));
  const containsMatches = allAliases.filter(a => a.includes(key) && !a.startsWith(key));

  return [...new Set([...prefixMatches, ...containsMatches])].slice(0, 13); // fib(7)
}

// ═══════════════════════════════════════════════════════════════════════════
// STANDALONE TEST
// ═══════════════════════════════════════════════════════════════════════════

if (require.main === module) {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  HEADY — @Mention Dispatch Engine                      ║');
  console.log('║  Slack-style routing for the Heady ecosystem           ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  const testCases = [
    '@gemini analyze the performance of this codebase',
    '@HeadyBrains @HeadyVinci decompose this task into subtasks',
    '@claude @reasoning do a deep analysis of system health',
    '@all status report',
    '@cssd run a full diagnostic',
    '@swarm:ForagerBee search for optimization opportunities',
    '@auto-success check the last cycle results',
    '@perplexity research the latest Node.js security patches',
    'no mentions here — just a regular message',
  ];

  for (const tc of testCases) {
    console.log(`  INPUT:  "${tc}"`);
    const result = dispatch(tc);
    console.log(`  PLAN:   strategy=${result.strategy}, targets=${result.targets.length}, model=${result.modelOverride ? result.modelOverride.provider + '/' + result.modelOverride.model : 'default'}`);
    if (result.mentions.length > 0) {
      for (const m of result.mentions) {
        console.log(`          → @${m.raw} → [${m.type}] ${m.canonical}`);
      }
    }
    console.log('');
  }

  const targets = getAvailableTargets();
  console.log(`  Total available targets: ${targets.totalTargets}`);
  console.log(`    Nodes:    ${targets.nodes.length}`);
  console.log(`    Models:   ${targets.models.length}`);
  console.log(`    Services: ${targets.services.length}`);
  console.log(`    Systems:  ${targets.systems.length}`);
  console.log('');

  // Autocomplete demo
  console.log('  Autocomplete "gem":', autocomplete('gem'));
  console.log('  Autocomplete "head":', autocomplete('head'));
  console.log('  Autocomplete "cla":', autocomplete('cla'));
}

module.exports = {
  dispatch,
  parseMentions,
  resolveMention,
  buildDispatchPlan,
  getAvailableTargets,
  autocomplete,
  NODE_ALIASES,
  MODEL_ALIASES,
  SERVICE_ALIASES,
  SYSTEM_ALIASES,
};
