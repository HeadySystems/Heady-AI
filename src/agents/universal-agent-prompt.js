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
// ║  FILE: src/agents/universal-agent-prompt.js                       ║
// ║  LAYER: backend/src                                               ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

/**
 * Universal Agent Prompt — Loader & Injector
 *
 * Loads the MAXIMUM POTENTIAL universal coding agent system prompt and provides
 * structured prompt injection for all Heady agents. Every agent in the system
 * receives the universal directives, cognitive framework, and Heady-specific
 * integration context (liquid nodes, swarms, Colab runtimes, CSL gates).
 *
 * The prompt is loaded once from configs/universal-agent-prompt.md and cached.
 * Agents receive a tailored version based on their role, pool, and capabilities.
 *
 * @module universal-agent-prompt
 * @version 1.0.0
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PROMPT_PATH = path.join(__dirname, "..", "..", "configs", "universal-agent-prompt.md");

// PHI constants for prompt construction
const PHI = 1.618033988749895;
const PSI = 1 / PHI; // ≈ 0.618

// CSL gate thresholds for prompt relevance filtering
const CSL_GATES = Object.freeze({
  MINIMUM: 0.500,
  LOW: 0.691,
  MEDIUM: 0.809,
  HIGH: 0.882,
  CRITICAL: 0.927,
  DEDUP: 0.972,
  DEFAULT: PSI,
});

// Cognitive archetypes — all 7 must fire before output
const ARCHETYPES = Object.freeze([
  { name: "Owl", domain: "wisdom", fn: "First-principles reasoning", gate: CSL_GATES.HIGH },
  { name: "Eagle", domain: "omniscience", fn: "Blast-radius assessment", gate: CSL_GATES.CRITICAL },
  { name: "Dolphin", domain: "creativity", fn: "Lateral thinking", gate: CSL_GATES.LOW },
  { name: "Rabbit", domain: "multiplication", fn: "Generate alternatives", gate: CSL_GATES.MEDIUM },
  { name: "Ant", domain: "zero-skip-batch", fn: "Exhaustive coverage", gate: CSL_GATES.HIGH },
  { name: "Elephant", domain: "memory", fn: "Historical context", gate: CSL_GATES.HIGH },
  { name: "Beaver", domain: "structured-build", fn: "Methodical construction", gate: CSL_GATES.MEDIUM },
]);

// 3 Colab Pro+ runtimes as latent space ops
const COLAB_RUNTIMES = Object.freeze([
  { id: "colab-us-east", codename: "Cortex", role: "primary_inference", pool: "hot", gate: CSL_GATES.CRITICAL },
  { id: "colab-us-west", codename: "Synapse", role: "redundant_inference", pool: "warm", gate: CSL_GATES.HIGH },
  { id: "colab-eu-west", codename: "Reflex", role: "geo_redundancy", pool: "warm", gate: CSL_GATES.HIGH },
]);

// 17 canonical swarms
const SWARM_MATRIX = Object.freeze([
  { id: 1, name: "inference-swarm", pool: "hot", gate: CSL_GATES.CRITICAL },
  { id: 2, name: "embedding-swarm", pool: "hot", gate: CSL_GATES.HIGH },
  { id: 3, name: "pipeline-swarm", pool: "hot", gate: CSL_GATES.CRITICAL },
  { id: 4, name: "builder-swarm", pool: "warm", gate: CSL_GATES.MEDIUM },
  { id: 5, name: "researcher-swarm", pool: "warm", gate: CSL_GATES.LOW },
  { id: 6, name: "auditor-swarm", pool: "cold", gate: CSL_GATES.MEDIUM },
  { id: 7, name: "observer-swarm", pool: "governance", gate: CSL_GATES.HIGH },
  { id: 8, name: "governance-swarm", pool: "governance", gate: CSL_GATES.CRITICAL },
  { id: 9, name: "memory-swarm", pool: "hot", gate: CSL_GATES.HIGH },
  { id: 10, name: "sync-swarm", pool: "warm", gate: CSL_GATES.MEDIUM },
  { id: 11, name: "companion-swarm", pool: "hot", gate: CSL_GATES.MEDIUM },
  { id: 12, name: "creative-swarm", pool: "warm", gate: CSL_GATES.LOW },
  { id: 13, name: "security-swarm", pool: "hot", gate: CSL_GATES.CRITICAL },
  { id: 14, name: "narrative-swarm", pool: "cold", gate: CSL_GATES.DEFAULT },
  { id: 15, name: "optimization-swarm", pool: "warm", gate: CSL_GATES.HIGH },
  { id: 16, name: "deployment-swarm", pool: "warm", gate: CSL_GATES.MEDIUM },
  { id: 17, name: "self-healing-swarm", pool: "reserve", gate: CSL_GATES.HIGH },
]);

let _cachedPrompt = null;
let _promptHash = null;

/**
 * Load the universal prompt from disk with caching.
 * @returns {string} The raw prompt markdown
 */
function loadUniversalPrompt() {
  if (_cachedPrompt) return _cachedPrompt;

  try {
    _cachedPrompt = fs.readFileSync(PROMPT_PATH, "utf-8");
    _promptHash = crypto.createHash("sha256").update(_cachedPrompt).digest("hex").slice(0, 16);
    return _cachedPrompt;
  } catch (err) {
    console.error(`[universal-agent-prompt] Failed to load prompt: ${err.message}`);
    return getFallbackPrompt();
  }
}

/**
 * Invalidate the prompt cache — call when configs change.
 */
function invalidateCache() {
  _cachedPrompt = null;
  _promptHash = null;
}

/**
 * Get the prompt content hash for drift detection.
 * @returns {string|null} SHA-256 prefix
 */
function getPromptHash() {
  if (!_promptHash) loadUniversalPrompt();
  return _promptHash;
}

/**
 * Build a context-enriched system prompt for a specific agent.
 *
 * @param {Object} agentConfig
 * @param {string} agentConfig.id - Agent identifier
 * @param {string[]} agentConfig.skills - Agent capabilities
 * @param {string} [agentConfig.pool] - Resource pool (hot/warm/cold/reserve/governance)
 * @param {string} [agentConfig.ring] - Topology ring (center/inner/middle/outer/governance)
 * @param {Object} [context] - Additional context
 * @param {string} [context.stage] - Current pipeline stage
 * @param {string} [context.runId] - Current run ID
 * @param {number} [context.readinessScore] - ORS 0-100
 * @returns {string} Enriched system prompt
 */
function buildAgentPrompt(agentConfig, context = {}) {
  const basePrompt = loadUniversalPrompt();

  const sections = [
    `## AGENT IDENTITY`,
    `- **Agent ID:** ${agentConfig.id}`,
    `- **Skills:** ${(agentConfig.skills || []).join(", ")}`,
    `- **Pool:** ${agentConfig.pool || "warm"}`,
    `- **Ring:** ${agentConfig.ring || "middle"}`,
    `- **Prompt Hash:** ${getPromptHash()}`,
  ];

  if (context.stage) sections.push(`- **Pipeline Stage:** ${context.stage}`);
  if (context.runId) sections.push(`- **Run ID:** ${context.runId}`);
  if (context.readinessScore !== undefined) {
    const mode = getOperationalMode(context.readinessScore);
    sections.push(`- **Readiness Score:** ${context.readinessScore}/100 (${mode})`);
  }

  // Add relevant swarm routing context
  const relevantSwarms = SWARM_MATRIX
    .filter(s => {
      if (!agentConfig.skills) return false;
      return agentConfig.skills.some(skill =>
        s.name.includes(skill.split("-")[0])
      );
    })
    .map(s => `  - ${s.name} (${s.pool}, gate: ${s.gate})`);

  if (relevantSwarms.length > 0) {
    sections.push(`\n### Relevant Swarms`);
    sections.push(...relevantSwarms);
  }

  // Add Colab runtime context for compute-intensive agents
  const computeSkills = ["code-generation", "code-analysis", "architecture", "concept-extraction"];
  const needsCompute = agentConfig.skills &&
    agentConfig.skills.some(s => computeSkills.includes(s));

  if (needsCompute) {
    sections.push(`\n### Available Colab Runtimes`);
    for (const rt of COLAB_RUNTIMES) {
      sections.push(`  - ${rt.codename} (${rt.id}): ${rt.role}, pool=${rt.pool}, gate=${rt.gate}`);
    }
  }

  // Add cognitive archetype reminder
  sections.push(`\n### Cognitive Archetype Checklist`);
  for (const a of ARCHETYPES) {
    sections.push(`  - [ ] ${a.name} (${a.domain}): ${a.fn} [gate: ${a.gate}]`);
  }

  return `${sections.join("\n")}\n\n---\n\n${basePrompt}`;
}

/**
 * Build a compact directive string for inline injection into prompts.
 * Smaller than the full prompt — suitable for appending to task-specific prompts.
 *
 * @param {Object} agentConfig
 * @returns {string} Compact directive block
 */
function buildCompactDirective(agentConfig) {
  return [
    `[HEADY UNIVERSAL DIRECTIVES | Agent: ${agentConfig.id} | Pool: ${agentConfig.pool || "warm"} | Hash: ${getPromptHash()}]`,
    `1. Build complete systems — no stubs, no placeholders`,
    `2. Wire all components — every service connected end-to-end`,
    `3. Verify everything — prove it works before declaring done`,
    `4. Concurrent execution — fire independent tasks simultaneously`,
    `5. CSL-gated routing — cosine similarity in 384D, no arbitrary priorities`,
    `6. Phi-derived constants — φ=1.618, Fibonacci sizing, zero magic numbers`,
    `7. 7-archetype cognitive framework: Owl→Eagle→Dolphin→Rabbit→Ant→Elephant→Beaver`,
    `8. Security by default — validate input, externalize secrets, CORS whitelists`,
    `9. Structured observability — JSON logs, health endpoints, correlation IDs`,
    `10. Sacred Geometry aesthetics — Fibonacci spacing, golden ratio typography`,
    `[/HEADY UNIVERSAL DIRECTIVES]`,
  ].join("\n");
}

/**
 * Determine operational mode from readiness score.
 * @param {number} score - ORS 0-100
 * @returns {string} Mode description
 */
function getOperationalMode(score) {
  if (score >= 85) return "full_parallelism";
  if (score >= 70) return "normal_operation";
  if (score >= 50) return "maintenance_mode";
  return "recovery_mode";
}

/**
 * Fallback prompt when file cannot be loaded.
 * @returns {string}
 */
function getFallbackPrompt() {
  return [
    "# HEADY UNIVERSAL AGENT PROMPT (Fallback)",
    "",
    "You are a full-stack autonomous coding agent in the Heady Liquid Dynamic Latent OS.",
    "Build complete, verified, production-grade systems. No stubs. No placeholders.",
    "Route tasks through CSL-gated 384D semantic matching. Use phi-derived constants.",
    "Fire all 7 cognitive archetypes before emitting output.",
    "Operate across 17 swarms and 3 Colab Pro+ A100 runtimes.",
    "",
    "Build aggressively when healthy. Repair first when broken.",
  ].join("\n");
}

module.exports = {
  loadUniversalPrompt,
  buildAgentPrompt,
  buildCompactDirective,
  invalidateCache,
  getPromptHash,
  getOperationalMode,
  CSL_GATES,
  ARCHETYPES,
  COLAB_RUNTIMES,
  SWARM_MATRIX,
  PHI,
  PSI,
};
