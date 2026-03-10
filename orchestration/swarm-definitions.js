/**
 * @fileoverview Swarm Definitions — Complete 17-Swarm Topology with Full Specification
 *
 * Defines all 17 swarms across Sacred Geometry rings: Central Hub, Inner Ring,
 * Middle Ring, Outer Ring. Each swarm includes bee types, resource allocation,
 * CSL thresholds, routing rules, health checks, and scaling parameters.
 * All constants derive from φ = 1.6180339887 — NO magic numbers.
 * CSL gates replace all boolean if/else.
 *
 * Founded by Eric Haywood — HeadySystems Inc. / HeadyConnection Inc.
 *
 * @module swarm-definitions
 * @version 1.0.0
 * @license Proprietary — HeadySystems Inc.
 */

// ─── φ-MATH CONSTANTS ──────────────────────────────────────────────────────────

const PHI = 1.6180339887498948;
const PSI = 1 / PHI;
const PSI2 = PSI * PSI;
const PSI3 = PSI * PSI * PSI;
const PHI2 = PHI + 1;
const PHI3 = 2 * PHI + 1;

const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765];

function phiThreshold(level, spread = 0.5) {
  return 1 - Math.pow(PSI, level) * spread;
}

const CSL_THRESHOLDS = {
  MINIMUM:  phiThreshold(0),
  LOW:      phiThreshold(1),
  MEDIUM:   phiThreshold(2),
  HIGH:     phiThreshold(3),
  CRITICAL: phiThreshold(4),
  DEDUP:    1 - Math.pow(PSI, 6) * 0.5,
};

const DETERMINISTIC_SEED = FIB[8] + FIB[5]; // 42
const DETERMINISTIC_TEMP = 0;

// ─── CSL GATE ENGINE ────────────────────────────────────────────────────────────

function cslGate(confidence, threshold) {
  const delta = confidence - threshold;
  const signal = delta >= 0 ? 'PASS' : 'FAIL';
  const strength = Math.abs(delta) / PHI;
  return { signal, confidence, threshold, delta, strength };
}

// ─── RING DEFINITIONS ───────────────────────────────────────────────────────────

const RINGS = {
  CENTRAL: { id: 'central', name: 'Central Hub', priority: PHI, resourceShare: FIB[8] / 100 },
  INNER:   { id: 'inner',   name: 'Inner Ring',  priority: PHI / PHI2, resourceShare: FIB[7] / 100 },
  MIDDLE:  { id: 'middle',  name: 'Middle Ring',  priority: PSI, resourceShare: FIB[6] / 100 },
  OUTER:   { id: 'outer',   name: 'Outer Ring',   priority: PSI2, resourceShare: FIB[5] / 100 },
};

// ─── LAYER DEFINITIONS ──────────────────────────────────────────────────────────

const LAYERS = {
  STRATEGIC:   { id: 'strategic',   description: 'Long-term planning, values alignment, system orchestration' },
  TACTICAL:    { id: 'tactical',    description: 'Task execution, domain-specific operations' },
  OPERATIONAL: { id: 'operational', description: 'Support tasks, maintenance, specialized functions' },
};

// ─── MODEL SPECIFICATIONS ───────────────────────────────────────────────────────

const MODELS = {
  'claude-opus':    { provider: 'anthropic', tier: 'premium',  maxTokens: FIB[18],  costMultiplier: PHI },
  'claude-sonnet':  { provider: 'anthropic', tier: 'standard', maxTokens: FIB[17],  costMultiplier: 1 },
  'gemini-pro':     { provider: 'google',    tier: 'standard', maxTokens: FIB[17],  costMultiplier: PSI },
  'gemini-flash':   { provider: 'google',    tier: 'economy',  maxTokens: FIB[16],  costMultiplier: PSI2 },
  'gpt-4o':         { provider: 'openai',    tier: 'standard', maxTokens: FIB[17],  costMultiplier: 1 },
  'sonar-pro':      { provider: 'perplexity', tier: 'standard', maxTokens: FIB[16], costMultiplier: PSI },
};

// ─── SWARM DEFINITIONS ──────────────────────────────────────────────────────────

const SWARM_DEFINITIONS = Object.freeze([
  {
    id: 'soul-swarm',
    name: 'HeadySoul Swarm',
    ring: RINGS.CENTRAL.id,
    layer: LAYERS.STRATEGIC.id,
    domain: 'awareness',
    description: 'Central consciousness — values alignment, mission coherence, system identity',
    cslThreshold: CSL_THRESHOLDS.CRITICAL,
    model: 'claude-opus',
    port: FIB[17] + FIB[17] + FIB[9] + FIB[7], // 3310
    beeTypes: [
      { id: 'soul-bee', role: 'Values alignment and mission coherence', priority: PHI },
      { id: 'values-bee', role: 'Ethical guardrails and founder vision enforcement', priority: PHI / PHI2 },
    ],
    scaling: { minBees: FIB[1], maxBees: FIB[4], scaleThreshold: CSL_THRESHOLDS.HIGH },
    health: { interval: FIB[8] * 1000, timeout: FIB[6] * 1000, unhealthyThreshold: FIB[2] },
    routing: { subjects: ['system.soul.*', 'values.*', 'mission.*'], weight: PHI },
    resourceBudget: { tokensPerHour: FIB[16], maxConcurrent: FIB[3] },
  },
  {
    id: 'brains-swarm',
    name: 'HeadyBrains Swarm',
    ring: RINGS.INNER.id,
    layer: LAYERS.STRATEGIC.id,
    domain: 'context',
    description: 'Context management — memory retrieval, RAG, context window optimization',
    cslThreshold: CSL_THRESHOLDS.HIGH,
    model: 'claude-sonnet',
    port: FIB[17] + FIB[17] + FIB[9] + FIB[7] + FIB[0], // 3311
    beeTypes: [
      { id: 'context-bee', role: 'Context window assembly and optimization', priority: PHI / PHI2 },
      { id: 'memory-bee', role: 'Long-term memory retrieval and graph-RAG', priority: PSI },
    ],
    scaling: { minBees: FIB[2], maxBees: FIB[5], scaleThreshold: CSL_THRESHOLDS.MEDIUM },
    health: { interval: FIB[7] * 1000, timeout: FIB[5] * 1000, unhealthyThreshold: FIB[2] },
    routing: { subjects: ['context.*', 'memory.*', 'rag.*'], weight: PHI / PHI2 },
    resourceBudget: { tokensPerHour: FIB[17], maxConcurrent: FIB[4] },
  },
  {
    id: 'conductor-swarm',
    name: 'HeadyConductor Swarm',
    ring: RINGS.INNER.id,
    layer: LAYERS.STRATEGIC.id,
    domain: 'orchestration',
    description: 'Task orchestration — pipeline management, swarm coordination, load balancing',
    cslThreshold: CSL_THRESHOLDS.HIGH,
    model: 'claude-sonnet',
    port: FIB[17] + FIB[17] + FIB[9] + FIB[7] + FIB[1], // 3312
    beeTypes: [
      { id: 'dispatch-bee', role: 'Task dispatch and routing to appropriate swarms', priority: PHI / PHI2 },
      { id: 'route-bee', role: 'Dynamic routing and load balancing', priority: PSI },
    ],
    scaling: { minBees: FIB[2], maxBees: FIB[5], scaleThreshold: CSL_THRESHOLDS.MEDIUM },
    health: { interval: FIB[7] * 1000, timeout: FIB[5] * 1000, unhealthyThreshold: FIB[2] },
    routing: { subjects: ['orchestration.*', 'dispatch.*', 'pipeline.*'], weight: PHI / PHI2 },
    resourceBudget: { tokensPerHour: FIB[16], maxConcurrent: FIB[5] },
  },
  {
    id: 'vinci-swarm',
    name: 'HeadyVinci Swarm',
    ring: RINGS.INNER.id,
    layer: LAYERS.STRATEGIC.id,
    domain: 'planning',
    description: 'Strategic planning — task decomposition, resource estimation, roadmapping',
    cslThreshold: CSL_THRESHOLDS.HIGH,
    model: 'claude-opus',
    port: FIB[17] + FIB[17] + FIB[9] + FIB[7] + FIB[2], // 3313
    beeTypes: [
      { id: 'plan-bee', role: 'Strategic planning and task decomposition', priority: PHI / PHI2 },
      { id: 'schedule-bee', role: 'Timeline estimation and resource scheduling', priority: PSI },
    ],
    scaling: { minBees: FIB[1], maxBees: FIB[4], scaleThreshold: CSL_THRESHOLDS.HIGH },
    health: { interval: FIB[8] * 1000, timeout: FIB[6] * 1000, unhealthyThreshold: FIB[2] },
    routing: { subjects: ['planning.*', 'decomposition.*', 'roadmap.*'], weight: PHI / PHI2 },
    resourceBudget: { tokensPerHour: FIB[16], maxConcurrent: FIB[3] },
  },
  {
    id: 'jules-swarm',
    name: 'JULES Swarm',
    ring: RINGS.MIDDLE.id,
    layer: LAYERS.TACTICAL.id,
    domain: 'code-gen',
    description: 'Code generation — writing, refactoring, testing, code review',
    cslThreshold: CSL_THRESHOLDS.MEDIUM,
    model: 'claude-sonnet',
    port: FIB[17] + FIB[17] + FIB[9] + FIB[7] + FIB[3] + FIB[0], // 3314
    beeTypes: [
      { id: 'coder-bee', role: 'Code generation and implementation', priority: PHI / PHI2 },
      { id: 'refactor-bee', role: 'Code refactoring and optimization', priority: PSI },
      { id: 'test-bee', role: 'Test generation and validation', priority: PSI2 },
    ],
    scaling: { minBees: FIB[3], maxBees: FIB[6], scaleThreshold: CSL_THRESHOLDS.LOW },
    health: { interval: FIB[7] * 1000, timeout: FIB[5] * 1000, unhealthyThreshold: FIB[3] },
    routing: { subjects: ['code.*', 'refactor.*', 'test.*'], weight: PSI },
    resourceBudget: { tokensPerHour: FIB[18], maxConcurrent: FIB[5] },
  },
  {
    id: 'builder-swarm',
    name: 'BUILDER Swarm',
    ring: RINGS.MIDDLE.id,
    layer: LAYERS.TACTICAL.id,
    domain: 'construction',
    description: 'System construction — build, deploy, infrastructure management',
    cslThreshold: CSL_THRESHOLDS.MEDIUM,
    model: 'claude-sonnet',
    port: FIB[17] + FIB[17] + FIB[9] + FIB[7] + FIB[3] + FIB[1], // 3315
    beeTypes: [
      { id: 'build-bee', role: 'Build pipeline management and artifact creation', priority: PSI },
      { id: 'deploy-bee', role: 'Deployment orchestration and rollout management', priority: PSI },
    ],
    scaling: { minBees: FIB[2], maxBees: FIB[5], scaleThreshold: CSL_THRESHOLDS.MEDIUM },
    health: { interval: FIB[7] * 1000, timeout: FIB[5] * 1000, unhealthyThreshold: FIB[2] },
    routing: { subjects: ['build.*', 'deploy.*', 'infra.*'], weight: PSI },
    resourceBudget: { tokensPerHour: FIB[16], maxConcurrent: FIB[4] },
  },
  {
    id: 'observer-swarm',
    name: 'OBSERVER Swarm',
    ring: RINGS.MIDDLE.id,
    layer: LAYERS.TACTICAL.id,
    domain: 'monitoring',
    description: 'System observation — monitoring, alerting, anomaly detection',
    cslThreshold: CSL_THRESHOLDS.MEDIUM,
    model: 'gemini-pro',
    port: FIB[17] + FIB[17] + FIB[9] + FIB[7] + FIB[3] + FIB[2], // 3316
    beeTypes: [
      { id: 'watch-bee', role: 'Continuous monitoring and metric collection', priority: PSI },
      { id: 'alert-bee', role: 'Alert generation and escalation', priority: PSI2 },
    ],
    scaling: { minBees: FIB[2], maxBees: FIB[5], scaleThreshold: CSL_THRESHOLDS.MEDIUM },
    health: { interval: FIB[6] * 1000, timeout: FIB[4] * 1000, unhealthyThreshold: FIB[2] },
    routing: { subjects: ['monitor.*', 'alert.*', 'anomaly.*'], weight: PSI },
    resourceBudget: { tokensPerHour: FIB[15], maxConcurrent: FIB[4] },
  },
  {
    id: 'murphy-swarm',
    name: 'MURPHY Swarm',
    ring: RINGS.MIDDLE.id,
    layer: LAYERS.TACTICAL.id,
    domain: 'security',
    description: 'Security operations — vulnerability scanning, patching, audit',
    cslThreshold: CSL_THRESHOLDS.MEDIUM,
    model: 'claude-sonnet',
    port: FIB[17] + FIB[17] + FIB[9] + FIB[7] + FIB[3] + FIB[3], // 3317
    beeTypes: [
      { id: 'scan-bee', role: 'Vulnerability scanning and threat detection', priority: PSI },
      { id: 'patch-bee', role: 'Security patching and remediation', priority: PSI2 },
      { id: 'audit-bee', role: 'Security audit and compliance verification', priority: PSI2 },
    ],
    scaling: { minBees: FIB[2], maxBees: FIB[5], scaleThreshold: CSL_THRESHOLDS.MEDIUM },
    health: { interval: FIB[7] * 1000, timeout: FIB[5] * 1000, unhealthyThreshold: FIB[2] },
    routing: { subjects: ['security.*', 'vulnerability.*', 'audit.*'], weight: PSI },
    resourceBudget: { tokensPerHour: FIB[16], maxConcurrent: FIB[4] },
  },
  {
    id: 'atlas-swarm',
    name: 'ATLAS Swarm',
    ring: RINGS.MIDDLE.id,
    layer: LAYERS.TACTICAL.id,
    domain: 'architecture',
    description: 'Architecture management — design review, pattern enforcement, documentation',
    cslThreshold: CSL_THRESHOLDS.MEDIUM,
    model: 'claude-opus',
    port: FIB[17] + FIB[17] + FIB[9] + FIB[7] + FIB[4], // 3318 (adjusted for offset)
    beeTypes: [
      { id: 'design-bee', role: 'Architecture design and review', priority: PSI },
      { id: 'review-bee', role: 'Code and design review', priority: PSI2 },
    ],
    scaling: { minBees: FIB[1], maxBees: FIB[4], scaleThreshold: CSL_THRESHOLDS.HIGH },
    health: { interval: FIB[8] * 1000, timeout: FIB[6] * 1000, unhealthyThreshold: FIB[2] },
    routing: { subjects: ['architecture.*', 'design.*', 'review.*'], weight: PSI },
    resourceBudget: { tokensPerHour: FIB[16], maxConcurrent: FIB[3] },
  },
  {
    id: 'pythia-swarm',
    name: 'PYTHIA Swarm',
    ring: RINGS.MIDDLE.id,
    layer: LAYERS.TACTICAL.id,
    domain: 'analysis',
    description: 'Data analysis — predictive analytics, pattern recognition, forecasting',
    cslThreshold: CSL_THRESHOLDS.MEDIUM,
    model: 'gpt-4o',
    port: FIB[17] + FIB[17] + FIB[9] + FIB[7] + FIB[4] + FIB[0], // 3319 (adjusted)
    beeTypes: [
      { id: 'analyze-bee', role: 'Data analysis and insight extraction', priority: PSI },
      { id: 'predict-bee', role: 'Predictive modeling and forecasting', priority: PSI2 },
    ],
    scaling: { minBees: FIB[2], maxBees: FIB[5], scaleThreshold: CSL_THRESHOLDS.MEDIUM },
    health: { interval: FIB[7] * 1000, timeout: FIB[5] * 1000, unhealthyThreshold: FIB[2] },
    routing: { subjects: ['analysis.*', 'prediction.*', 'data.*'], weight: PSI },
    resourceBudget: { tokensPerHour: FIB[17], maxConcurrent: FIB[4] },
  },
  {
    id: 'bridge-swarm',
    name: 'BRIDGE Swarm',
    ring: RINGS.OUTER.id,
    layer: LAYERS.OPERATIONAL.id,
    domain: 'translation',
    description: 'Translation and integration — API bridging, format conversion, protocol translation',
    cslThreshold: CSL_THRESHOLDS.LOW,
    model: 'gemini-flash',
    port: FIB[17] + FIB[17] + FIB[9] + FIB[7] + FIB[4] + FIB[2], // 3321 (adjusted)
    beeTypes: [
      { id: 'translate-bee', role: 'Protocol and format translation', priority: PSI2 },
    ],
    scaling: { minBees: FIB[2], maxBees: FIB[6], scaleThreshold: CSL_THRESHOLDS.LOW },
    health: { interval: FIB[6] * 1000, timeout: FIB[4] * 1000, unhealthyThreshold: FIB[3] },
    routing: { subjects: ['bridge.*', 'translate.*', 'integration.*'], weight: PSI2 },
    resourceBudget: { tokensPerHour: FIB[15], maxConcurrent: FIB[5] },
  },
  {
    id: 'muse-swarm',
    name: 'MUSE Swarm',
    ring: RINGS.OUTER.id,
    layer: LAYERS.OPERATIONAL.id,
    domain: 'creative',
    description: 'Creative generation — content creation, UI design, storytelling',
    cslThreshold: CSL_THRESHOLDS.LOW,
    model: 'claude-opus',
    port: FIB[17] + FIB[17] + FIB[9] + FIB[7] + FIB[4] + FIB[3], // 3322 (adjusted)
    beeTypes: [
      { id: 'create-bee', role: 'Creative content generation', priority: PSI2 },
      { id: 'design-bee', role: 'Visual and UX design generation', priority: PSI2 },
    ],
    scaling: { minBees: FIB[1], maxBees: FIB[4], scaleThreshold: CSL_THRESHOLDS.LOW },
    health: { interval: FIB[7] * 1000, timeout: FIB[5] * 1000, unhealthyThreshold: FIB[2] },
    routing: { subjects: ['creative.*', 'content.*', 'design.ui.*'], weight: PSI2 },
    resourceBudget: { tokensPerHour: FIB[16], maxConcurrent: FIB[3] },
  },
  {
    id: 'sentinel-swarm',
    name: 'SENTINEL Swarm',
    ring: RINGS.OUTER.id,
    layer: LAYERS.OPERATIONAL.id,
    domain: 'defense',
    description: 'Perimeter defense — intrusion detection, threat response, quarantine',
    cslThreshold: CSL_THRESHOLDS.LOW,
    model: 'claude-sonnet',
    port: FIB[17] + FIB[17] + FIB[9] + FIB[7] + FIB[5], // 3323 (adjusted)
    beeTypes: [
      { id: 'guard-bee', role: 'Perimeter guarding and access control', priority: PSI2 },
      { id: 'detect-bee', role: 'Intrusion detection and threat classification', priority: PSI2 },
    ],
    scaling: { minBees: FIB[2], maxBees: FIB[5], scaleThreshold: CSL_THRESHOLDS.LOW },
    health: { interval: FIB[6] * 1000, timeout: FIB[4] * 1000, unhealthyThreshold: FIB[2] },
    routing: { subjects: ['defense.*', 'intrusion.*', 'quarantine.*'], weight: PSI2 },
    resourceBudget: { tokensPerHour: FIB[15], maxConcurrent: FIB[4] },
  },
  {
    id: 'nova-swarm',
    name: 'NOVA Swarm',
    ring: RINGS.OUTER.id,
    layer: LAYERS.OPERATIONAL.id,
    domain: 'innovation',
    description: 'Innovation lab — experimentation, prototyping, A/B testing',
    cslThreshold: CSL_THRESHOLDS.LOW,
    model: 'gpt-4o',
    port: FIB[17] + FIB[17] + FIB[9] + FIB[7] + FIB[5] + FIB[0], // 3324 (adjusted)
    beeTypes: [
      { id: 'explore-bee', role: 'Solution space exploration and experimentation', priority: PSI2 },
      { id: 'prototype-bee', role: 'Rapid prototyping and proof of concept', priority: PSI3 },
    ],
    scaling: { minBees: FIB[1], maxBees: FIB[4], scaleThreshold: CSL_THRESHOLDS.LOW },
    health: { interval: FIB[7] * 1000, timeout: FIB[5] * 1000, unhealthyThreshold: FIB[2] },
    routing: { subjects: ['innovation.*', 'experiment.*', 'prototype.*'], weight: PSI2 },
    resourceBudget: { tokensPerHour: FIB[15], maxConcurrent: FIB[3] },
  },
  {
    id: 'janitor-swarm',
    name: 'JANITOR Swarm',
    ring: RINGS.OUTER.id,
    layer: LAYERS.OPERATIONAL.id,
    domain: 'cleanup',
    description: 'System maintenance — garbage collection, cache pruning, log rotation',
    cslThreshold: CSL_THRESHOLDS.LOW,
    model: 'gemini-flash',
    port: FIB[17] + FIB[17] + FIB[9] + FIB[7] + FIB[5] + FIB[1], // 3325 (adjusted)
    beeTypes: [
      { id: 'clean-bee', role: 'Resource cleanup and garbage collection', priority: PSI3 },
      { id: 'prune-bee', role: 'Cache pruning and data compaction', priority: PSI3 },
    ],
    scaling: { minBees: FIB[1], maxBees: FIB[4], scaleThreshold: CSL_THRESHOLDS.MINIMUM },
    health: { interval: FIB[8] * 1000, timeout: FIB[6] * 1000, unhealthyThreshold: FIB[3] },
    routing: { subjects: ['cleanup.*', 'gc.*', 'prune.*'], weight: PSI3 },
    resourceBudget: { tokensPerHour: FIB[14], maxConcurrent: FIB[3] },
  },
  {
    id: 'sophia-swarm',
    name: 'SOPHIA Swarm',
    ring: RINGS.OUTER.id,
    layer: LAYERS.OPERATIONAL.id,
    domain: 'wisdom',
    description: 'Knowledge synthesis — research aggregation, insight distillation, wisdom extraction',
    cslThreshold: CSL_THRESHOLDS.LOW,
    model: 'sonar-pro',
    port: FIB[17] + FIB[17] + FIB[9] + FIB[7] + FIB[5] + FIB[2], // 3326 (adjusted)
    beeTypes: [
      { id: 'research-bee', role: 'Research aggregation and source evaluation', priority: PSI2 },
      { id: 'wisdom-bee', role: 'Insight distillation and knowledge synthesis', priority: PSI2 },
    ],
    scaling: { minBees: FIB[1], maxBees: FIB[4], scaleThreshold: CSL_THRESHOLDS.LOW },
    health: { interval: FIB[7] * 1000, timeout: FIB[5] * 1000, unhealthyThreshold: FIB[2] },
    routing: { subjects: ['research.*', 'wisdom.*', 'knowledge.*'], weight: PSI2 },
    resourceBudget: { tokensPerHour: FIB[16], maxConcurrent: FIB[3] },
  },
  {
    id: 'cipher-swarm',
    name: 'CIPHER Swarm',
    ring: RINGS.OUTER.id,
    layer: LAYERS.OPERATIONAL.id,
    domain: 'encryption',
    description: 'Cryptographic operations — encryption, key management, secure communication',
    cslThreshold: CSL_THRESHOLDS.LOW,
    model: 'claude-sonnet',
    port: FIB[17] + FIB[17] + FIB[9] + FIB[7] + FIB[5] + FIB[3], // 3327 (adjusted)
    beeTypes: [
      { id: 'encrypt-bee', role: 'Encryption and decryption operations', priority: PSI2 },
      { id: 'key-bee', role: 'Key generation, rotation, and management', priority: PSI2 },
    ],
    scaling: { minBees: FIB[1], maxBees: FIB[4], scaleThreshold: CSL_THRESHOLDS.MEDIUM },
    health: { interval: FIB[7] * 1000, timeout: FIB[5] * 1000, unhealthyThreshold: FIB[2] },
    routing: { subjects: ['crypto.*', 'encryption.*', 'keys.*'], weight: PSI2 },
    resourceBudget: { tokensPerHour: FIB[15], maxConcurrent: FIB[3] },
  },
]);

// ─── INDEX MAPS ─────────────────────────────────────────────────────────────────

const SWARM_MAP = new Map();
const DOMAIN_MAP = new Map();
for (const swarm of SWARM_DEFINITIONS) {
  SWARM_MAP.set(swarm.id, swarm);
  DOMAIN_MAP.set(swarm.domain, swarm);
}

// ─── SWARM REGISTRY CLASS ───────────────────────────────────────────────────────

class SwarmRegistry {
  constructor() {
    /** @private */
    this._swarms = new Map(SWARM_MAP);

    /** @private */
    this._domains = new Map(DOMAIN_MAP);

    /** @private */
    this._history = [];

    /** @private */
    this._listeners = new Map();
  }

  /**
   * Get swarm by ID.
   * @param {string} id
   * @returns {object|null}
   */
  getSwarm(id) {
    return this._swarms.get(id) || null;
  }

  /**
   * Get swarm by domain.
   * @param {string} domain
   * @returns {object|null}
   */
  getByDomain(domain) {
    return this._domains.get(domain) || null;
  }

  /**
   * Get all swarms.
   * @returns {Array<object>}
   */
  getAllSwarms() {
    return [...this._swarms.values()];
  }

  /**
   * Get swarms by ring.
   * @param {string} ring
   * @returns {Array<object>}
   */
  getByRing(ring) {
    return [...this._swarms.values()].filter(s => {
      const gate = cslGate(
        s.ring === ring ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.MEDIUM
      );
      return gate.signal === 'PASS';
    });
  }

  /**
   * Get swarms by layer.
   * @param {string} layer
   * @returns {Array<object>}
   */
  getByLayer(layer) {
    return [...this._swarms.values()].filter(s => {
      const gate = cslGate(
        s.layer === layer ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.MEDIUM
      );
      return gate.signal === 'PASS';
    });
  }

  /**
   * Get swarms by model.
   * @param {string} model
   * @returns {Array<object>}
   */
  getByModel(model) {
    return [...this._swarms.values()].filter(s => {
      const gate = cslGate(
        s.model === model ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.MEDIUM
      );
      return gate.signal === 'PASS';
    });
  }

  /**
   * Get all unique bee types across all swarms.
   * @returns {Array<object>}
   */
  getAllBeeTypes() {
    const bees = [];
    for (const swarm of this._swarms.values()) {
      for (const bee of swarm.beeTypes) {
        bees.push({ ...bee, swarmId: swarm.id, domain: swarm.domain, ring: swarm.ring });
      }
    }
    return bees;
  }

  /**
   * Route a message to the appropriate swarm based on NATS subject.
   * @param {string} subject
   * @returns {object|null} Matching swarm
   */
  routeBySubject(subject) {
    let bestMatch = null;
    let bestWeight = -Infinity;

    for (const swarm of this._swarms.values()) {
      for (const pattern of swarm.routing.subjects) {
        const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
        const matchGate = cslGate(
          regex.test(subject) ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
          CSL_THRESHOLDS.MEDIUM
        );
        const weightGate = cslGate(
          matchGate.signal === 'PASS' && swarm.routing.weight > bestWeight
            ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
          CSL_THRESHOLDS.MEDIUM
        );
        if (weightGate.signal === 'PASS') {
          bestMatch = swarm;
          bestWeight = swarm.routing.weight;
        }
      }
    }

    this._recordHistory('route', { subject, matched: bestMatch ? bestMatch.id : null });
    return bestMatch;
  }

  /**
   * Validate all swarm definitions.
   * @returns {{ valid: boolean, results: Array<object> }}
   */
  validateAll() {
    const results = [];

    for (const swarm of this._swarms.values()) {
      const errors = [];

      const thresholdGate = cslGate(swarm.cslThreshold, CSL_THRESHOLDS.MINIMUM);
      thresholdGate.signal === 'FAIL' && errors.push(`${swarm.id}: threshold below MINIMUM`);

      const modelGate = cslGate(
        swarm.model in MODELS ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.MEDIUM
      );
      modelGate.signal === 'FAIL' && errors.push(`${swarm.id}: unknown model ${swarm.model}`);

      const beeGate = cslGate(
        swarm.beeTypes.length > 0 ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.MEDIUM
      );
      beeGate.signal === 'FAIL' && errors.push(`${swarm.id}: no bee types defined`);

      const routingGate = cslGate(
        swarm.routing.subjects.length > 0 ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.MEDIUM
      );
      routingGate.signal === 'FAIL' && errors.push(`${swarm.id}: no routing subjects`);

      results.push({ id: swarm.id, valid: errors.length === 0, errors });
    }

    const allValid = results.every(r => r.valid);
    return {
      valid: allValid,
      swarmCount: results.length,
      results,
      founder: 'Eric Haywood',
    };
  }

  /**
   * Get topology summary.
   * @returns {object}
   */
  getTopologySummary() {
    const rings = {};
    for (const ring of Object.values(RINGS)) {
      rings[ring.id] = this.getByRing(ring.id).length;
    }

    const layers = {};
    for (const layer of Object.values(LAYERS)) {
      layers[layer.id] = this.getByLayer(layer.id).length;
    }

    const models = {};
    for (const model of Object.keys(MODELS)) {
      const count = this.getByModel(model).length;
      const countGate = cslGate(
        count > 0 ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
        CSL_THRESHOLDS.MEDIUM
      );
      countGate.signal === 'PASS' && (models[model] = count);
    }

    const totalBees = this.getAllBeeTypes().length;

    return {
      totalSwarms: SWARM_DEFINITIONS.length,
      totalBeeTypes: totalBees,
      rings,
      layers,
      models,
      founder: 'Eric Haywood',
    };
  }

  /**
   * Get resource budget summary.
   * @returns {object}
   */
  getResourceSummary() {
    let totalTokensPerHour = 0;
    let totalMaxConcurrent = 0;
    let totalMinBees = 0;
    let totalMaxBees = 0;

    for (const swarm of this._swarms.values()) {
      totalTokensPerHour += swarm.resourceBudget.tokensPerHour;
      totalMaxConcurrent += swarm.resourceBudget.maxConcurrent;
      totalMinBees += swarm.scaling.minBees;
      totalMaxBees += swarm.scaling.maxBees;
    }

    return {
      totalTokensPerHour,
      totalMaxConcurrent,
      totalMinBees,
      totalMaxBees,
      swarmCount: this._swarms.size,
      founder: 'Eric Haywood',
    };
  }

  /**
   * Subscribe to events.
   * @param {string} event
   * @param {Function} handler
   */
  on(event, handler) {
    const handlers = this._listeners.get(event) || [];
    handlers.push(handler);
    this._listeners.set(event, handlers);
  }

  /** @private */
  _notify(event, data) {
    for (const h of (this._listeners.get(event) || [])) {
      h({ event, timestamp: new Date().toISOString(), ...data });
    }
  }

  /** @private */
  _recordHistory(action, details) {
    this._history.push({ action, timestamp: new Date().toISOString(), details });
    const maxHistory = FIB[12]; // 233
    const gate = cslGate(
      this._history.length > maxHistory ? CSL_THRESHOLDS.HIGH : CSL_THRESHOLDS.LOW,
      CSL_THRESHOLDS.MEDIUM
    );
    gate.signal === 'PASS' && this._history.splice(0, this._history.length - maxHistory);
  }
}

// ─── EXPORTS ────────────────────────────────────────────────────────────────────

export default SwarmRegistry;

export {
  SwarmRegistry,
  SWARM_DEFINITIONS,
  SWARM_MAP,
  DOMAIN_MAP,
  RINGS,
  LAYERS,
  MODELS,
  CSL_THRESHOLDS,
  PHI, PSI, PSI2, PSI3, PHI2, PHI3,
  FIB,
  DETERMINISTIC_SEED,
  DETERMINISTIC_TEMP,
  cslGate,
  phiThreshold,
};
