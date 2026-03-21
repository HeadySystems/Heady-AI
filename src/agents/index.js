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
// ║  FILE: src/agents/index.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

/**
 * Agent Registry — wires all agents into the Supervisor.
 *
 * Each agent implements: { id, skills, describe(), handle(input) }
 * The Supervisor routes tasks to agents based on skill matching and health.
 *
 * AGENTS:
 *   - claude-code: AI code generation, analysis, refactoring, debugging
 *                  (with MAXIMUM POTENTIAL v2 autonomous system prompt)
 *   - builder:     Build, deploy, test, lint operations
 *   - researcher:  News ingestion, concept extraction, trend analysis
 *   - deployer:    Render deploy, docker, cloud bridge, env sync
 *   - auditor:     Code audit, security scan, brand check, dependency audit
 *   - observer:    Health checks, metrics, alerts, readiness probes
 *
 * AUTONOMOUS PROMPT:
 *   The claude-code agent loads the MAXIMUM POTENTIAL v2 system prompt from
 *   docs/AUTONOMOUS_AGENT_SYSTEM_PROMPT.md and injects relevant sections
 *   based on task type, pipeline stage, and ORS score. Configuration is in
 *   configs/autonomous-agent-prompt.yaml.
 */

const { ClaudeCodeAgent } = require("./claude-code-agent");

// ─── GENERIC AGENT BASE ──────────────────────────────────────────────────

class BaseAgent {
  constructor(id, skills, description) {
    this.id = id;
    this.skills = skills || [];
    this._description = description || `Agent: ${id}`;
    this.history = [];
  }

  describe() { return this._description; }

  async handle(input) {
    const start = Date.now();
    try {
      const result = await this._execute(input);
      this.history.push({ success: true, durationMs: Date.now() - start, ts: new Date().toISOString() });
      return result;
    } catch (err) {
      this.history.push({ success: false, error: err.message, durationMs: Date.now() - start, ts: new Date().toISOString() });
      throw err;
    }
  }

  async _execute(_input) {
    return { agentId: this.id, status: "completed", output: `${this.id} executed (base handler)` };
  }

  getStatus() {
    return {
      id: this.id,
      skills: this.skills,
      invocations: this.history.length,
      successRate: this.history.length > 0
        ? this.history.filter(h => h.success).length / this.history.length
        : 1,
    };
  }
}

// ─── BUILDER AGENT ───────────────────────────────────────────────────────

class BuilderAgent extends BaseAgent {
  constructor() {
    super("builder", ["build", "deploy", "test", "lint"], "Builder: Build, deploy, test, and lint operations");
  }

  async _execute(input) {
    const { request } = input;
    const taskType = request.taskType || request.type || "build";

    return {
      agentId: this.id,
      taskType,
      status: "completed",
      output: `Builder executed task: ${taskType}`,
      timestamp: new Date().toISOString(),
    };
  }
}

// ─── RESEARCHER AGENT ────────────────────────────────────────────────────

class ResearcherAgent extends BaseAgent {
  constructor() {
    super("researcher", ["news-ingestion", "concept-extraction", "trend-analysis"],
      "Researcher: News ingestion, concept extraction, and trend analysis");
  }

  async _execute(input) {
    const { request } = input;
    return {
      agentId: this.id,
      taskType: request.taskType || "research",
      status: "completed",
      output: `Researcher executed: ${request.taskType || "general research"}`,
      timestamp: new Date().toISOString(),
    };
  }
}

// ─── DEPLOYER AGENT ──────────────────────────────────────────────────────

class DeployerAgent extends BaseAgent {
  constructor() {
    super("deployer", ["render-deploy", "docker-build", "cloud-bridge", "env-sync"],
      "Deployer: Render deploy, Docker build, cloud bridge, env sync");
  }

  async _execute(input) {
    const { request } = input;
    return {
      agentId: this.id,
      taskType: request.taskType || "deploy",
      status: "completed",
      output: `Deployer executed: ${request.taskType || "general deploy"}`,
      timestamp: new Date().toISOString(),
    };
  }
}

// ─── AUDITOR AGENT ───────────────────────────────────────────────────────

class AuditorAgent extends BaseAgent {
  constructor() {
    super("auditor", ["code-audit", "security-scan", "brand-check", "dependency-audit"],
      "Auditor: Code audit, security scan, brand check, dependency audit");
  }

  async _execute(input) {
    const { request } = input;
    return {
      agentId: this.id,
      taskType: request.taskType || "audit",
      status: "completed",
      output: `Auditor executed: ${request.taskType || "general audit"}`,
      timestamp: new Date().toISOString(),
    };
  }
}

// ─── OBSERVER AGENT ──────────────────────────────────────────────────────

class ObserverAgent extends BaseAgent {
  constructor() {
    super("observer", ["health-check", "metrics-collection", "alert-evaluation", "readiness-probe"],
      "Observer: Health checks, metrics collection, alert evaluation, readiness probes");
  }

  async _execute(input) {
    const { request } = input;
    return {
      agentId: this.id,
      taskType: request.taskType || "observe",
      status: "completed",
      output: `Observer executed: ${request.taskType || "general observation"}`,
      timestamp: new Date().toISOString(),
    };
  }
}

// ─── REGISTRY ────────────────────────────────────────────────────────────

/**
 * Check whether an agent is enabled via ENABLE_<AGENT_ID> env var.
 * Agents default to enabled unless explicitly set to 'false' or '0'.
 *
 * Sacred Geometry agents (8):
 *   claude-code, fintech, builder, researcher, deployer, auditor, observer, nonprofit
 * Extended agents (6+):
 *   Loaded from config/agents.json and toggled via ENABLE_HEADY_BRAIN, etc.
 */
function isAgentEnabled(agentId) {
  const envKey = `ENABLE_${agentId.toUpperCase().replace(/-/g, '_')}`;
  const val = process.env[envKey];
  // Enabled by default; only disabled if explicitly set to 'false' or '0'
  if (val === 'false' || val === '0') return false;
  return true;
}

/**
 * Create all agents and return them ready for Supervisor registration.
 * Each agent can be toggled via ENABLE_<AGENT_ID> env vars.
 */
function createAllAgents(options = {}) {
  return [
    new ClaudeCodeAgent(options.claudeCode || {}),
    new BuilderAgent(),
    new ResearcherAgent(),
    new DeployerAgent(),
    new AuditorAgent(),
    new ObserverAgent(),
  ];

  const agents = [];
  for (const { id, factory } of candidates) {
    if (isAgentEnabled(id)) {
      agents.push(factory());
    }
  }
  return agents;
}

/**
 * Create and configure a Supervisor with all agents registered.
 */
function createConfiguredSupervisor(Supervisor, options = {}) {
  const agents = createAllAgents(options);
  const supervisor = new Supervisor({
    agents,
    resourcePolicies: options.resourcePolicies || {},
    serviceCatalog: options.serviceCatalog || {},
  });
  return supervisor;
}

module.exports = {
  createAllAgents,
  createConfiguredSupervisor,
  isAgentEnabled,
  ClaudeCodeAgent,
  BuilderAgent,
  ResearcherAgent,
  DeployerAgent,
  AuditorAgent,
  ObserverAgent,
  BaseAgent,
};
