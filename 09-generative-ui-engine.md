# Heady™ Generative UI Engine + CSL-Driven Interface Generation

## Foundation
All changes are based on the HeadyMe repos and Heady project data. The actual source code for every referenced file is provided below.

## Objective
Generative UI engine producing dynamic interfaces based on CSL confidence. Replace ternary show/hide with continuous visibility scoring. Golden ratio layouts.

## Specific Deliverables — Build ALL Files
### 1. Generative Engine — CSL-gated component generation, phi-scaled complexity tiers
### 2. UI Component Factory — React/HTML gen from CSL scores, phi spacing/sizing/animation
### 3. Adaptive Onboarding — progressive disclosure, domain mastery tracking, auto-advance at φ⁻¹
### 4. Deterministic UI — same context → same layout hash, phi A/B testing (61.8%/38.2%)
### 5. Test Suite — visibility scoring, layout consistency, onboarding, hash matching, phi proportions

## Constraints
- φ = 1.6180339887, React/HTML, deterministic hashing, golden ratio proportions

---

## SOURCE FILES — COMPLETE HEADY CODEBASE CONTEXT


### `services/heady-ui/generative-engine.js`

```javascript
/**
 * ═══════════════════════════════════════════════════════════════
 * UI-001: Generative UI Engine
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * ═══════════════════════════════════════════════════════════════
 *
 * AI-powered component generation from natural language descriptions.
 * Uses LLM to produce HTML/CSS/JS components on demand.
 */

'use strict';

class GenerativeUIEngine {
    constructor(options = {}) {
        this.componentCache = new Map();
        this.templates = new Map();
        this.generationHistory = [];
        this._registerTemplates();
    }

    /**
     * Generate a UI component from a natural language description
     */
    async generate(description, options = {}) {
        const cacheKey = this._hash(description);

        if (this.componentCache.has(cacheKey)) {
            return { ...this.componentCache.get(cacheKey), cached: true };
        }

        const componentType = this._classifyComponent(description);
        const template = this.templates.get(componentType);

        if (!template) {
            return { error: `Unknown component type: ${componentType}`, description };
        }

        const component = template.generate(description, options);
        component.id = `gen-${cacheKey.substring(0, 8)}`;
        component.type = componentType;
        component.timestamp = new Date().toISOString();

        this.componentCache.set(cacheKey, component);
        this.generationHistory.push({ description, type: componentType, id: component.id });

        return component;
    }

    /**
     * Classify what type of component is being requested
     */
    _classifyComponent(description) {
        const desc = description.toLowerCase();
        if (desc.includes('chart') || desc.includes('graph') || desc.includes('visualization')) return 'chart';
        if (desc.includes('form') || desc.includes('input') || desc.includes('submit')) return 'form';
        if (desc.includes('card') || desc.includes('panel') || desc.includes('tile')) return 'card';
        if (desc.includes('table') || desc.includes('list') || desc.includes('grid')) return 'table';
        if (desc.includes('nav') || desc.includes('menu') || desc.includes('sidebar')) return 'navigation';
        if (desc.includes('dashboard') || desc.includes('metrics') || desc.includes('status')) return 'dashboard';
        if (desc.includes('modal') || desc.includes('dialog') || desc.includes('popup')) return 'modal';
        if (desc.includes('button') || desc.includes('action') || desc.includes('cta')) return 'button';
        return 'generic';
    }

    _registerTemplates() {
        this.templates.set('card', {
            generate: (desc, opts) => ({
                html: `<div class="heady-card ${opts.theme || 'dark'}" id="${opts.id || 'card'}">
  <div class="heady-card-header">
    <h3>${this._extractTitle(desc)}</h3>
    <span class="heady-badge">AI Generated</span>
  </div>
  <div class="heady-card-body">
    <p>${desc}</p>
  </div>
  <div class="heady-card-footer">
    <button class="heady-btn heady-btn-primary">Action</button>
  </div>
</div>`,
                css: `.heady-card { background: var(--heady-surface, #1a1a2e); border-radius: 12px; padding: 24px; border: 1px solid rgba(255,255,255,0.1); transition: transform 0.2s; }
.heady-card:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
.heady-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.heady-card-header h3 { color: var(--heady-text, #e0e0e0); margin: 0; }
.heady-badge { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 4px 12px; border-radius: 20px; font-size: 12px; color: white; }
.heady-card-body { color: var(--heady-text-secondary, #a0a0a0); line-height: 1.6; }
.heady-card-footer { margin-top: 16px; display: flex; gap: 8px; }
.heady-btn { padding: 8px 20px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; transition: all 0.2s; }
.heady-btn-primary { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; }
.heady-btn-primary:hover { transform: scale(1.05); }`,
                js: '',
            }),
        });

        this.templates.set('dashboard', {
            generate: (desc, opts) => ({
                html: `<div class="heady-dashboard" id="${opts.id || 'dashboard'}">
  <div class="heady-dashboard-header">
    <h2>Dashboard</h2>
    <span class="heady-live-indicator">● Live</span>
  </div>
  <div class="heady-metrics-grid">
    <div class="heady-metric-card">
      <span class="heady-metric-label">Active Agents</span>
      <span class="heady-metric-value" id="metric-agents">20</span>
    </div>
    <div class="heady-metric-card">
      <span class="heady-metric-label">Tasks/min</span>
      <span class="heady-metric-value" id="metric-tasks">135</span>
    </div>
    <div class="heady-metric-card">
      <span class="heady-metric-label">Uptime</span>
      <span class="heady-metric-value" id="metric-uptime">99.9%</span>
    </div>
    <div class="heady-metric-card">
      <span class="heady-metric-label">Memory</span>
      <span class="heady-metric-value" id="metric-memory">64%</span>
    </div>
  </div>
</div>`,
                css: `.heady-dashboard { background: var(--heady-bg, #0f0f23); padding: 32px; border-radius: 16px; }
.heady-dashboard-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.heady-dashboard-header h2 { color: white; margin: 0; }
.heady-live-indicator { color: #22c55e; font-size: 14px; animation: pulse 2s infinite; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
.heady-metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
.heady-metric-card { background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.08); }
.heady-metric-label { display: block; color: #94a3b8; font-size: 13px; margin-bottom: 8px; }
.heady-metric-value { display: block; font-size: 32px; font-weight: 700; color: white; background: linear-gradient(135deg, #6366f1, #22d3ee); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }`,
                js: '',
            }),
        });

        this.templates.set('form', {
            generate: (desc, opts) => ({
                html: `<form class="heady-form" id="${opts.id || 'form'}">
  <div class="heady-form-group">
    <label>Input</label>
    <input type="text" placeholder="Enter value..." class="heady-input" />
  </div>
  <button type="submit" class="heady-btn heady-btn-primary">Submit</button>
</form>`,
                css: `.heady-form { max-width: 480px; } .heady-form-group { margin-bottom: 16px; }
.heady-form-group label { display: block; color: #e0e0e0; margin-bottom: 6px; font-size: 14px; }
.heady-input { width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); color: white; font-size: 14px; outline: none; transition: border 0.2s; }
.heady-input:focus { border-color: #6366f1; }`,
                js: '',
            }),
        });

        ['table', 'navigation', 'modal', 'button', 'chart', 'generic'].forEach(type => {
            if (!this.templates.has(type)) {
                this.templates.set(type, {
                    generate: (desc, opts) => ({
                        html: `<div class="heady-${type}" id="${opts.id || type}"><p>${desc}</p></div>`,
                        css: `.heady-${type} { padding: 16px; border-radius: 8px; background: #1a1a2e; color: #e0e0e0; }`,
                        js: '',
                    }),
                });
            }
        });
    }

    _extractTitle(desc) {
        const words = desc.split(/\s+/).slice(0, 4);
        return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    _hash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
        }
        return Math.abs(hash).toString(36);
    }
}

if (require.main === module) {
    const engine = new GenerativeUIEngine();

    console.log('═══ Generative UI Engine ═══\n');

    Promise.all([
        engine.generate('agent status dashboard with live metrics'),
        engine.generate('create a card showing system health'),
        engine.generate('user login form with email and password'),
    ]).then(results => {
        results.forEach(r => {
            console.log(`${r.type}: ${r.id} (${r.html.length} chars HTML, ${r.css.length} chars CSS)`);
        });
        console.log(`\nCache: ${engine.componentCache.size} components`);
        console.log('✅ Generative UI Engine operational');
    });
}

module.exports = { GenerativeUIEngine };
```
---

### `src/hcfp/task-dispatcher.js`

```javascript
/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * ═══ HCFP Task Dispatcher ═══
 *
 * Classifies tasks by type and routes to the optimal sub-agent.
 * Uses service_group field from task-manifest-schema + keyword analysis.
 *
 * Sub-Agent Topology:
 *   HeadyIO         → I/O-bound tasks (file, stream, network)
 *   HeadyBot         → Automation scripting, ephemeral workers
 *   HeadyMCP         → Machine-to-machine context protocols
 *   HeadyConnection  → Persistent connections, long-lived sessions
 *   Core Platform    → Default brain orchestration
 *
 * Pipeline Tasks: buddy-dist-001, buddy-dist-003
 */

const path = require('path');
const fs = require('fs');
const { midiBus, CHANNELS } = require("../engines/midi-event-bus");
const logger = require("../utils/logger");

// ═══ Pipeline Source ═══
const PIPELINE_FILE = path.join(__dirname, '..', 'auto-flow-200-tasks.json');

// ═══ Sub-Agent Registry (Cloud-Only Endpoints) ═══
const SUB_AGENTS = {
    "heady-io": {
        name: "HeadyIO",
        endpoint: process.env.HEADY_IO_URL || "https://heady-io.headyme.com/api",
        capabilities: ["file", "stream", "network", "upload", "download", "parse"],
        keywords: ["file", "read", "write", "stream", "upload", "download", "parse", "csv", "json", "xml", "buffer", "fs"],
    },
    "heady-bot": {
        name: "HeadyBot",
        endpoint: process.env.HEADY_BOT_URL || "https://heady-bot.headyme.com/api",
        capabilities: ["automate", "script", "cron", "worker", "spawn", "parallel"],
        keywords: ["automate", "script", "cron", "schedule", "parallel", "worker", "spawn", "run", "execute", "deploy", "build"],
    },
    "heady-mcp": {
        name: "HeadyMCP",
        endpoint: process.env.HEADY_MCP_URL || "https://heady-mcp.headyme.com/api",
        capabilities: ["protocol", "m2m", "context", "bridge", "translate"],
        keywords: ["protocol", "machine", "m2m", "bridge", "translate", "context", "mcp", "middleware", "adapter"],
    },
    "heady-connection": {
        name: "HeadyConnection",
        endpoint: process.env.HEADY_CONNECTION_URL || "https://heady-connection.headyme.com/api",
        capabilities: ["persistent", "session", "websocket", "sse", "keepalive"],
        keywords: ["persistent", "session", "websocket", "sse", "keepalive", "long-running", "subscribe", "watch", "monitor"],
    },
    "heady-cloudrun": {
        name: "Cloud Run Failover",
        endpoint: process.env.HEADY_CLOUDRUN_URL || "https://heady-edge-gateway-609590223909.us-central1.run.app",
        capabilities: ["chat", "analyze", "code", "reasoning", "buddy"],
        keywords: ["failover", "cloudrun", "gcloud", "liquid", "backup"],
    },
    "heady-battle": {
        name: "HeadyBattle",
        endpoint: process.env.HEADY_BATTLE_URL || "https://heady-battle.headyme.com/api",
        capabilities: ["battle", "race", "compare", "tournament", "evaluate", "contest"],
        keywords: ["battle", "race", "compare", "tournament", "evaluate", "contest", "arena", "compete", "versus", "benchmark", "leaderboard"],
    },
    "heady-sims": {
        name: "HeadySims",
        endpoint: process.env.HEADY_SIMS_URL || "https://heady-sims.headyme.com/api",
        capabilities: ["simulate", "predict", "model", "optimize", "forecast"],
        keywords: ["simulate", "sim", "predict", "forecast", "model", "optimize", "resource", "estimate", "preflight", "pre-flight"],
    },
    "core": {
        name: "Core Platform",
        endpoint: process.env.HEADY_BRAIN_URL || "https://127.0.0.1:3301/api/brain/chat",
        capabilities: ["chat", "analyze", "code", "reasoning", "think", "generate"],
        keywords: [], // Default — catches everything else
    },
};

/**
 * Classify a task and determine the optimal sub-agent.
 *
 * @param {object} task - Task from manifest (has name, action, service_group, inputs)
 * @returns {{ agent: string, endpoint: string, reason: string }}
 */
function classify(task) {
    // Priority 1: Explicit service_group mapping
    if (task.service_group && task.service_group !== "brain") {
        const agentKey = Object.keys(SUB_AGENTS).find(key =>
            key === task.service_group ||
            SUB_AGENTS[key].name.toLowerCase() === task.service_group.toLowerCase()
        );
        if (agentKey) {
            const agent = SUB_AGENTS[agentKey];
            midiBus.agentSpawned(agent.name, CHANNELS.DISPATCHER);
            return {
                agent: agentKey,
                name: agent.name,
                endpoint: agent.endpoint,
                reason: `Explicit service_group: "${task.service_group}" → ${agent.name}`,
            };
        }
    }

    // Priority 2: Keyword matching against task name + action + inputs
    const searchText = [
        task.name || "",
        task.action || "",
        JSON.stringify(task.inputs || {}),
    ].join(" ").toLowerCase();

    let bestMatch = null;
    let bestScore = 0;

    for (const [key, agent] of Object.entries(SUB_AGENTS)) {
        if (key === "core") continue; // Skip default
        const matches = agent.keywords.filter(kw => searchText.includes(kw));
        if (matches.length > bestScore) {
            bestScore = matches.length;
            bestMatch = { key, agent, matches };
        }
    }

    if (bestMatch && bestScore >= 1) {
        midiBus.agentSpawned(bestMatch.agent.name, CHANNELS.DISPATCHER);
        return {
            agent: bestMatch.key,
            name: bestMatch.agent.name,
            endpoint: bestMatch.agent.endpoint,
            reason: `Keyword match (${bestScore} hits: ${bestMatch.matches.join(", ")}) → ${bestMatch.agent.name}`,
        };
    }

    // Fallback: Core Platform
    const core = SUB_AGENTS["core"];
    return {
        agent: "core",
        name: core.name,
        endpoint: core.endpoint,
        reason: `Default routing → Core Platform (no sub-agent keywords matched)`,
    };
}

/**
 * Classify multiple tasks and return a dispatch plan.
 *
 * @param {Array} tasks - Array of task objects
 * @returns {Array} Array of { task, dispatch } objects
 */
function createDispatchPlan(tasks) {
    return tasks.map(task => ({
        task_name: task.name,
        task_id: task.id,
        dispatch: classify(task),
    }));
}

/**
 * Get agent registry summary.
 */
function getAgentRegistry() {
    return Object.entries(SUB_AGENTS).map(([key, agent]) => ({
        key,
        name: agent.name,
        endpoint: agent.endpoint,
        capabilities: agent.capabilities,
        keyword_count: agent.keywords.length,
    }));
}

/**
 * Load the auto-flow pipeline from disk and return tasks sorted by priority.
 * @param {object} opts - { pool: 'hot'|'warm'|'cold'|'all', minWeight: 1-5, limit: number }
 * @returns {Array} Sorted task array
 */
function loadPipeline(opts = {}) {
    const pool = opts.pool || 'hot';
    const minWeight = opts.minWeight || 4;
    const limit = opts.limit || 50;

    try {
        const raw = fs.readFileSync(PIPELINE_FILE, 'utf8');
        let tasks = JSON.parse(raw);

        // Filter by pool
        if (pool !== 'all') {
            tasks = tasks.filter(t => t.pool === pool);
        }

        // Filter by minimum weight
        tasks = tasks.filter(t => (t.w || 0) >= minWeight);

        // Sort: weight desc, then by id for stability
        tasks.sort((a, b) => (b.w || 0) - (a.w || 0) || (a.id || '').localeCompare(b.id || ''));

        return tasks.slice(0, limit);
    } catch (err) {
        logger.error(`[TaskDispatcher] Pipeline load error: ${err.message}`);
        return [];
    }
}

/**
 * Create a prioritized dispatch plan from the auto-flow pipeline.
 * @param {object} opts - { pool, minWeight, limit }
 * @returns {Array} Array of { task, dispatch } objects
 */
function createPipelinePlan(opts = {}) {
    const tasks = loadPipeline(opts);
    return createDispatchPlan(tasks);
}

module.exports = { classify, createDispatchPlan, createPipelinePlan, loadPipeline, getAgentRegistry, SUB_AGENTS };
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

### `src/prompts/deterministic-prompt-executor.js`

```javascript
/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Deterministic Prompt Executor
 *
 * Wraps PromptManager with deterministic execution guarantees:
 *   - Fixed LLM params (temperature: 0, top_p: 1, deterministic seed)
 *   - Input hashing (SHA-256) for cache keys
 *   - Output validation via CSL cosine similarity
 *   - Replay guarantee: same inputHash → same cached output
 *   - Full execution audit log
 *
 * PHI = 1.6180339887
 *
 * @module deterministic-prompt-executor
 */

'use strict';

const crypto = require('crypto');
const CSLConfidenceGate = require('./csl-confidence-gate');

// Lazy-load PromptManager (template literals evaluate at require time)
let _PromptManager = null;
function getPromptManager() {
    if (!_PromptManager) {
        try {
            _PromptManager = require('./deterministic-prompt-manager').PromptManager;
        } catch (err) {
            // Fallback: minimal stub for environments where templates can't load
            _PromptManager = class StubPromptManager {
                interpolate(id, vars) {
                    return `[PROMPT:${id}] ` + Object.entries(vars).map(([k, v]) => `${k}=${v}`).join(', ');
                }
                getPrompt(id) { return { id, variables: [], template: '', tags: [] }; }
                listPrompts() { return []; }
                composePrompts(ids, vars) { return { composed: ids.join('\n'), sections: [], ids }; }
            };
        }
    }
    return _PromptManager;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PHI = 1.6180339887;
const PSI = 1 / PHI;                    // ≈ 0.618
const PSI_SQ = PSI * PSI;                  // ≈ 0.382

/** Replay threshold — cached output returned if CSL score exceeds this */
const REPLAY_THRESHOLD = PSI;              // φ⁻¹ ≈ 0.618

/** Maximum audit log entries before rotation */
const MAX_AUDIT_LOG = Math.round(PHI ** 8); // ≈ 47

/** Deterministic LLM parameters — enforced on every call */
const DETERMINISTIC_LLM_PARAMS = Object.freeze({
    temperature: 0,
    top_p: 1,
    seed: 42,
    max_tokens: 4096,
    presence_penalty: 0,
    frequency_penalty: 0,
});

// ─── DeterministicPromptExecutor ──────────────────────────────────────────────

class DeterministicPromptExecutor {
    /**
     * @param {Object} [options]
     * @param {PromptManager} [options.promptManager] — existing PromptManager instance
     * @param {CSLConfidenceGate} [options.confidenceGate] — existing gate instance
     * @param {number} [options.replayThreshold] — cosine threshold for cache replay
     * @param {Object} [options.llmParams] — override deterministic LLM params
     */
    constructor(options = {}) {
        const PM = getPromptManager();
        this.promptManager = options.promptManager || new PM();
        this.confidenceGate = options.confidenceGate || new CSLConfidenceGate();
        this.replayThreshold = options.replayThreshold || REPLAY_THRESHOLD;
        this.llmParams = { ...DETERMINISTIC_LLM_PARAMS, ...(options.llmParams || {}) };

        /** @type {Map<string, { output: string, cslScore: number, timestamp: number }>} */
        this._cache = new Map();

        /** @type {Array<Object>} */
        this._auditLog = [];

        /** Runtime stats */
        this._stats = {
            totalExecutions: 0,
            cacheHits: 0,
            cacheMisses: 0,
            halts: 0,
            cautious: 0,
            driftAlerts: 0,
            reconfigures: 0,
        };

        /** Event listeners */
        this._listeners = new Map();
    }

    // ─── Core Execution ─────────────────────────────────────────────────────────

    /**
     * Execute a prompt deterministically.
     *
     * Pipeline:
     *   1. Interpolate template with variables
     *   2. Compute inputHash (SHA-256 of promptId + sorted vars)
     *   3. Check cache — return cached output if CSL score > replayThreshold
     *   4. Run CSL pre-flight confidence check
     *   5. If HALT → stop execution, emit reconfigure event
     *   6. If EXECUTE/CAUTIOUS → interpolate + return
     *   7. Log to audit trail
     *
     * @param {string} promptId — prompt identifier (e.g. 'code-001')
     * @param {Object} vars — variable map for interpolation
     * @param {Object} [opts]
     * @param {boolean} [opts.bypassCache=false] — skip cache lookup
     * @param {boolean} [opts.strict=true] — enforce variable completeness
     * @returns {{ output: string, confidence: number, inputHash: string,
     *             cslScore: number, halted: boolean, decision: string,
     *             llmParams: Object, cached: boolean }}
     */
    execute(promptId, vars = {}, opts = {}) {
        const { bypassCache = false, strict = true } = opts;
        this._stats.totalExecutions++;

        // Step 1: Compute deterministic input hash
        const inputHash = this._computeHash(promptId, vars);

        // Step 2: Check cache (unless bypassed)
        if (!bypassCache && this._cache.has(inputHash)) {
            const cached = this._cache.get(inputHash);
            this._stats.cacheHits++;

            const result = {
                output: cached.output,
                confidence: 1.0, // cached = known-good
                inputHash,
                cslScore: cached.cslScore,
                halted: false,
                decision: 'CACHED',
                llmParams: this.llmParams,
                cached: true,
            };

            this._log('cache_hit', promptId, inputHash, result);
            return result;
        }

        this._stats.cacheMisses++;

        // Step 3: Interpolate the prompt deterministically
        let interpolated;
        try {
            interpolated = this.promptManager.interpolate(promptId, vars, { strict });
        } catch (err) {
            const haltResult = {
                output: null,
                confidence: 0,
                inputHash,
                cslScore: 0,
                halted: true,
                decision: 'HALT',
                reason: `Interpolation error: ${err.message}`,
                llmParams: this.llmParams,
                cached: false,
            };
            this._stats.halts++;
            this._log('interpolation_error', promptId, inputHash, haltResult);
            this._emit('halt', { promptId, inputHash, reason: haltResult.reason });
            this._emit('system:reconfigure', this.confidenceGate.reconfigure({
                promptId, inputHash, confidence: 0, reason: haltResult.reason,
            }));
            return haltResult;
        }

        // Step 4: CSL pre-flight confidence check
        const preCheck = this.confidenceGate.preFlightCheck(promptId, vars, interpolated);

        if (preCheck.decision === 'HALT') {
            this._stats.halts++;
            const haltResult = {
                output: null,
                confidence: preCheck.confidence,
                inputHash,
                cslScore: preCheck.confidence,
                halted: true,
                decision: 'HALT',
                reason: preCheck.reason,
                llmParams: this.llmParams,
                cached: false,
            };
            this._log('halt', promptId, inputHash, haltResult);
            this._emit('halt', { promptId, inputHash, confidence: preCheck.confidence, reason: preCheck.reason });
            this._emit('system:reconfigure', this.confidenceGate.reconfigure({
                promptId, inputHash, confidence: preCheck.confidence, reason: preCheck.reason,
            }));
            return haltResult;
        }

        if (preCheck.decision === 'CAUTIOUS') {
            this._stats.cautious++;
        }

        // Step 5: At template level, the output IS deterministic (same template + same vars = same string)
        const output = interpolated;
        const outputHash = this._hashString(output);

        // Step 6: Compute CSL score (self-consistency = 1.0 for deterministic template output)
        const cslScore = 1.0; // Template interpolation is perfectly deterministic

        // Step 7: Cache the result
        this._cache.set(inputHash, { output, cslScore, outputHash, timestamp: Date.now() });

        // Step 8: Track drift
        const driftResult = this.confidenceGate.trackDrift(outputHash);
        if (driftResult.drifting) {
            this._stats.driftAlerts++;
            this._emit('drift', { promptId, inputHash, driftScore: driftResult.driftScore });
        }

        const result = {
            output,
            confidence: preCheck.confidence,
            inputHash,
            cslScore,
            halted: false,
            decision: preCheck.decision,
            llmParams: this.llmParams,
            cached: false,
        };

        this._log('execute', promptId, inputHash, result);
        return result;
    }

    // ─── Replay ─────────────────────────────────────────────────────────────────

    /**
     * Replay a cached output by its input hash.
     * Returns null if not found or if CSL score below replay threshold.
     *
     * @param {string} inputHash
     * @returns {{ output: string, cslScore: number, timestamp: number } | null}
     */
    replay(inputHash) {
        const cached = this._cache.get(inputHash);
        if (!cached) return null;
        if (cached.cslScore < this.replayThreshold) return null;
        return { output: cached.output, cslScore: cached.cslScore, timestamp: cached.timestamp };
    }

    // ─── Audit ──────────────────────────────────────────────────────────────────

    /**
     * Get execution audit log.
     * @param {number} [limit=20]
     * @returns {Array<Object>}
     */
    getAuditLog(limit = 20) {
        return this._auditLog.slice(-limit);
    }

    /**
     * Get determinism report — stats on cache performance, halts, drift alerts.
     * @returns {Object}
     */
    getDeterminismReport() {
        const cacheSize = this._cache.size;
        const hitRate = this._stats.totalExecutions > 0
            ? (this._stats.cacheHits / this._stats.totalExecutions * 100).toFixed(1)
            : '0.0';

        return {
            totalExecutions: this._stats.totalExecutions,
            cacheHits: this._stats.cacheHits,
            cacheMisses: this._stats.cacheMisses,
            cacheHitRate: `${hitRate}%`,
            cacheSize,
            halts: this._stats.halts,
            cautious: this._stats.cautious,
            driftAlerts: this._stats.driftAlerts,
            reconfigures: this._stats.reconfigures,
            replayThreshold: this.replayThreshold,
            llmParams: this.llmParams,
            phi: PHI,
        };
    }

    // ─── Events ─────────────────────────────────────────────────────────────────

    /**
     * Register event listener.
     * @param {string} event — 'halt' | 'drift' | 'system:reconfigure'
     * @param {Function} callback
     */
    on(event, callback) {
        if (!this._listeners.has(event)) this._listeners.set(event, []);
        this._listeners.get(event).push(callback);
    }

    // ─── Internal ───────────────────────────────────────────────────────────────

    /**
     * Compute SHA-256 hash of (promptId + sorted variables).
     * Deterministic: same inputs always produce the same hash.
     */
    _computeHash(promptId, vars) {
        const sortedKeys = Object.keys(vars).sort();
        const canonical = promptId + ':' + sortedKeys.map(k => `${k}=${vars[k]}`).join('|');
        return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
    }

    /**
     * Hash a string with SHA-256 (truncated to 16 chars).
     */
    _hashString(str) {
        return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
    }

    /**
     * Append to audit log with rotation.
     */
    _log(action, promptId, inputHash, result) {
        this._auditLog.push({
            action,
            promptId,
            inputHash,
            decision: result.decision,
            confidence: result.confidence,
            cslScore: result.cslScore,
            halted: result.halted,
            cached: result.cached,
            timestamp: Date.now(),
        });
        if (this._auditLog.length > MAX_AUDIT_LOG) {
            this._auditLog = this._auditLog.slice(-MAX_AUDIT_LOG);
        }
    }

    /**
     * Emit event to registered listeners.
     */
    _emit(event, data) {
        const listeners = this._listeners.get(event) || [];
        for (const cb of listeners) {
            try { cb(data); } catch (_) { /* fire-and-forget */ }
        }
    }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    DeterministicPromptExecutor,
    DETERMINISTIC_LLM_PARAMS,
    REPLAY_THRESHOLD,
    PHI,
    PSI,
    PSI_SQ,
};
```
---

### `src/prompts/csl-confidence-gate.js`

```javascript
/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * CSL Confidence Gate — Error Prediction & Halt/Reconfigure System
 *
 * Uses Continuous Semantic Logic to predict errors BEFORE they occur
 * and halt operations when confidence drops below phi-scaled thresholds.
 *
 * Confidence Tiers (phi-scaled):
 *   > φ⁻¹ ≈ 0.618  →  EXECUTE   (high confidence, deterministic)
 *   0.382 – 0.618   →  CAUTIOUS  (adaptive temperature, log warning)
 *   < φ⁻² ≈ 0.382  →  HALT      (predicted error, stop + reconfigure)
 *
 * Error Prediction:
 *   Tracks rolling cosine similarity between consecutive output hashes.
 *   When drift exceeds 1 - φ⁻¹ ≈ 0.382, predicts impending error.
 *
 * Reconfiguration:
 *   When halted, returns a reconfiguration action plan:
 *     - Swap to a different model
 *     - Adjust temperature/parameters
 *     - Retry with different prompt composition
 *     - Escalate to human review
 *
 * @module csl-confidence-gate
 */

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const PHI = 1.6180339887;
const PSI = 1 / PHI;             // ≈ 0.618
const PSI_SQ = PSI * PSI;           // ≈ 0.382

/** Confidence tiers — phi-derived thresholds */
const TIERS = Object.freeze({
    EXECUTE: PSI,                    // > 0.618  → proceed with full confidence
    CAUTIOUS: PSI_SQ,                 // 0.382–0.618 → proceed with caution
    HALT: 0,                      // < 0.382  → halt execution
});

/** Drift threshold — (1 - φ⁻¹) ≈ 0.382 */
const DRIFT_THRESHOLD = 1 - PSI;    // ≈ 0.382

/** Rolling window size for drift detection */
const DRIFT_WINDOW = Math.round(PHI ** 5); // ≈ 11

/** Domain reference vectors — phi-scaled pseudo-embeddings per domain.
 *  In production these would be real embeddings; here we use deterministic
 *  seeds for each domain to create reproducible reference vectors. */
const DOMAIN_SEEDS = Object.freeze({
    code: 0x636F6465,
    deploy: 0x64706C79,
    research: 0x72736368,
    security: 0x73656375,
    memory: 0x6D656D6F,
    orchestration: 0x6F726368,
    creative: 0x63726561,
    trading: 0x74726164,
});

// ─── CSLConfidenceGate ────────────────────────────────────────────────────────

class CSLConfidenceGate {
    /**
     * @param {Object} [options]
     * @param {number} [options.executeThreshold]  — override EXECUTE tier
     * @param {number} [options.cautiousThreshold] — override CAUTIOUS tier
     * @param {number} [options.driftThreshold]    — override drift detection
     * @param {number} [options.driftWindow]       — rolling window size
     */
    constructor(options = {}) {
        this.executeThreshold = options.executeThreshold || TIERS.EXECUTE;
        this.cautiousThreshold = options.cautiousThreshold || TIERS.CAUTIOUS;
        this.driftThreshold = options.driftThreshold || DRIFT_THRESHOLD;
        this.driftWindow = options.driftWindow || DRIFT_WINDOW;

        /** @type {string[]} Rolling window of output hashes for drift detection */
        this._outputHistory = [];

        /** Runtime stats */
        this._stats = {
            checks: 0,
            executes: 0,
            cautious: 0,
            halts: 0,
            drifts: 0,
            reconfigures: 0,
        };
    }

    // ─── Pre-Flight Check ───────────────────────────────────────────────────────

    /**
     * Pre-flight confidence check before prompt execution.
     *
     * Determines whether to EXECUTE, proceed with CAUTION, or HALT
     * based on phi-scaled confidence tiers.
     *
     * Confidence is computed from:
     *   1. Variable completeness (all required vars present?)
     *   2. Domain alignment (prompt domain is valid?)
     *   3. Input coherence (variables are non-empty, non-degenerate?)
     *   4. History stability (no recent drift alerts?)
     *
     * @param {string} promptId — prompt identifier
     * @param {Object} vars — variable map
     * @param {string} interpolated — the interpolated prompt string
     * @returns {{ decision: 'EXECUTE'|'CAUTIOUS'|'HALT', confidence: number, reason: string }}
     */
    preFlightCheck(promptId, vars, interpolated) {
        this._stats.checks++;

        // Factor 1: Variable completeness (are all vars non-null/non-empty?)
        const varEntries = Object.entries(vars);
        const totalVars = varEntries.length;
        const filledVars = varEntries.filter(([_, v]) => v !== null && v !== undefined && String(v).trim() !== '').length;
        const completeness = totalVars > 0 ? filledVars / totalVars : 0; // no vars = no confidence

        // Factor 2: Domain alignment (valid prompt ID format?)
        const domainMatch = promptId && promptId.includes('-') ? 1.0 : 0.3;
        const domain = promptId ? promptId.split('-')[0] : '';
        const knownDomain = domain in DOMAIN_SEEDS ? 1.0 : (domain === '' ? 0 : 0.3);

        // Factor 3: Input coherence (interpolated prompt is non-trivial?)
        const length = interpolated ? interpolated.length : 0;
        const coherence = length > 50 ? 1.0 : length > 10 ? 0.7 : 0.2;

        // Factor 4: History stability (no recent drift?)
        const recentDrifts = this._countRecentDrifts();
        const stability = recentDrifts === 0 ? 1.0 : recentDrifts < 3 ? 0.6 : 0.2;

        // Composite confidence — phi-weighted harmonic mean
        const weights = [PHI, 1.0, PSI, PSI_SQ]; // weight completeness highest
        const scores = [completeness, knownDomain * domainMatch, coherence, stability];
        const weightSum = weights.reduce((a, b) => a + b, 0);
        const confidence = scores.reduce((sum, s, i) => sum + s * weights[i], 0) / weightSum;

        // Classify
        let decision, reason;
        if (confidence >= this.executeThreshold) {
            decision = 'EXECUTE';
            reason = `High confidence (${confidence.toFixed(3)} ≥ φ⁻¹=${this.executeThreshold.toFixed(3)})`;
            this._stats.executes++;
        } else if (confidence >= this.cautiousThreshold) {
            decision = 'CAUTIOUS';
            reason = `Moderate confidence (${confidence.toFixed(3)} ∈ [${this.cautiousThreshold.toFixed(3)}, ${this.executeThreshold.toFixed(3)}))`;
            this._stats.cautious++;
        } else {
            decision = 'HALT';
            reason = `Low confidence (${confidence.toFixed(3)} < φ⁻²=${this.cautiousThreshold.toFixed(3)}) — predicted error`;
            this._stats.halts++;
        }

        return { decision, confidence, reason, factors: { completeness, domainMatch, knownDomain, coherence, stability } };
    }

    // ─── Drift Detection ────────────────────────────────────────────────────────

    /**
     * Track output drift — detects when outputs are diverging from
     * deterministic expectations.
     *
     * Compares the current output hash against the rolling window.
     * If the proportion of unique hashes exceeds the drift threshold,
     * a drift alert is raised (error predicted).
     *
     * @param {string} outputHash — hash of the current output
     * @returns {{ drifting: boolean, driftScore: number, prediction: string }}
     */
    trackDrift(outputHash) {
        this._outputHistory.push(outputHash);

        // Maintain rolling window
        if (this._outputHistory.length > this.driftWindow) {
            this._outputHistory = this._outputHistory.slice(-this.driftWindow);
        }

        // Need at least 3 outputs to detect drift
        if (this._outputHistory.length < 3) {
            return { drifting: false, driftScore: 0, prediction: 'insufficient_data' };
        }

        // Drift score = proportion of unique hashes in window
        // For deterministic ops: all hashes should match → driftScore = 0
        // For drifting ops: hashes diverge → driftScore approaches 1
        const uniqueHashes = new Set(this._outputHistory).size;
        const driftScore = (uniqueHashes - 1) / (this._outputHistory.length - 1);

        const drifting = driftScore > this.driftThreshold;
        if (drifting) this._stats.drifts++;

        let prediction;
        if (driftScore === 0) {
            prediction = 'perfectly_deterministic';
        } else if (driftScore < PSI_SQ) {
            prediction = 'stable_with_minor_variation';
        } else if (driftScore < PSI) {
            prediction = 'drift_detected_error_likely';
        } else {
            prediction = 'severe_drift_error_imminent';
        }

        return { drifting, driftScore, prediction, windowSize: this._outputHistory.length, uniqueOutputs: uniqueHashes };
    }

    // ─── Reconfiguration ────────────────────────────────────────────────────────

    /**
     * Generate a reconfiguration plan when operations are halted.
     *
     * Returns an action plan based on the halting diagnostics:
     *   - If confidence was low due to completeness → suggest missing variables
     *   - If drift was detected → suggest model swap or temperature adjustment
     *   - If domain unknown → suggest prompt composition change
     *
     * @param {Object} diagnostics — from the halt event
     * @returns {{ action: string, newConfig: Object, steps: string[] }}
     */
    reconfigure(diagnostics) {
        this._stats.reconfigures++;

        const steps = [];
        const newConfig = {};

        const confidence = diagnostics.confidence || 0;
        const reason = diagnostics.reason || '';

        if (confidence < 0.2) {
            // Critical — escalate to human
            steps.push('ESCALATE: Confidence critically low, require human review');
            newConfig.escalate = true;
            newConfig.action = 'escalate';
        } else if (reason.includes('completeness') || reason.includes('Interpolation')) {
            // Missing variables — suggest filling them
            steps.push('FILL_VARIABLES: Complete all required prompt variables');
            steps.push('RETRY: Re-execute with completed variables');
            newConfig.action = 'fill_and_retry';
            newConfig.retryWithDefaults = true;
        } else if (reason.includes('drift') || reason.includes('diverging')) {
            // Drift — adjust model params
            steps.push('SWAP_MODEL: Switch to a model with lower variance');
            steps.push('LOCK_SEED: Enforce seed=42 on all subsequent calls');
            steps.push('REDUCE_TEMPERATURE: Force temperature=0');
            newConfig.action = 'stabilize';
            newConfig.llmOverrides = { temperature: 0, seed: 42, top_p: 1 };
        } else {
            // General halt — retry with different prompt composition
            steps.push('RECOMPOSE: Try alternative prompt composition from same domain');
            steps.push('RETRY: Execute with recomposed prompt');
            newConfig.action = 'recompose_and_retry';
        }

        return {
            action: newConfig.action || 'unknown',
            newConfig,
            steps,
            timestamp: Date.now(),
            diagnostics,
        };
    }

    // ─── Stats ──────────────────────────────────────────────────────────────────

    /**
     * Get gate statistics.
     * @returns {Object}
     */
    getStats() {
        return {
            ...this._stats,
            thresholds: {
                execute: this.executeThreshold,
                cautious: this.cautiousThreshold,
                drift: this.driftThreshold,
            },
            driftWindowSize: this._outputHistory.length,
            phi: PHI,
        };
    }

    // ─── Internal ───────────────────────────────────────────────────────────────

    /**
     * Count recent drift alerts (simple: count unique hashes in last N outputs).
     */
    _countRecentDrifts() {
        if (this._outputHistory.length < 3) return 0;
        const recent = this._outputHistory.slice(-5);
        return new Set(recent).size - 1; // 0 = no drift, 1+ = drifting
    }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = CSLConfidenceGate;
module.exports.CSLConfidenceGate = CSLConfidenceGate;
module.exports.TIERS = TIERS;
module.exports.DRIFT_THRESHOLD = DRIFT_THRESHOLD;
module.exports.PHI = PHI;
module.exports.PSI = PSI;
module.exports.PSI_SQ = PSI_SQ;
```
---
