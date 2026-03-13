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
// ║  FILE: src/agents/claude-code-agent.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

/**
 * Claude Code Agent
 *
 * Integrates Claude Code (Anthropic CLI) as a Supervisor agent in HCFullPipeline.
 * Registered with the Supervisor for code-generation, analysis, refactoring,
 * architecture, and debugging tasks.
 *
 * ROUTING: Direct (no proxy) via @heady/networking internal client.
 *
 * USAGE:
 *   - Supervisor routes code-related tasks to this agent.
 *   - Agent spawns `claude` CLI process with structured prompts.
 *   - Returns structured results for aggregation.
 *
 * REQUIREMENTS:
 *   - `claude` CLI installed and authenticated (ANTHROPIC_API_KEY in env)
 *   - Or fallback to Anthropic HTTP API via @heady/networking
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const yaml = require("js-yaml");

const AGENT_ID = "claude-code";
const AGENT_SKILLS = [
  "code-generation",
  "code-analysis",
  "refactoring",
  "architecture",
  "debugging",
  "concept-extraction",
  "documentation",
];

const PROJECT_ROOT = path.join(__dirname, "..", "..");
const DEFAULT_TIMEOUT_MS = 120000;

const PROMPT_CONFIG_PATH = path.join(PROJECT_ROOT, "configs", "autonomous-agent-prompt.yaml");
const PROMPT_SOURCE_PATH = path.join(PROJECT_ROOT, "docs", "AUTONOMOUS_AGENT_SYSTEM_PROMPT.md");

/**
 * Load and parse the autonomous agent prompt configuration.
 * Returns null if config is unavailable (graceful degradation).
 */
function loadPromptConfig() {
  try {
    const raw = fs.readFileSync(PROMPT_CONFIG_PATH, "utf-8");
    return yaml.load(raw);
  } catch (err) {
    return null;
  }
}

/**
 * Load the full system prompt markdown, split into indexed sections.
 * Sections are delimited by "## <roman-numeral>." headings.
 */
function loadPromptSections() {
  try {
    const raw = fs.readFileSync(PROMPT_SOURCE_PATH, "utf-8");
    const sections = {};
    let currentKey = null;
    let currentLines = [];

    for (const line of raw.split("\n")) {
      const sectionMatch = line.match(/^## ([IVXLC]+)\.\s/);
      if (sectionMatch) {
        if (currentKey) {
          sections[currentKey] = currentLines.join("\n").trim();
        }
        currentKey = sectionMatch[1];
        currentLines = [line];
      } else if (currentKey) {
        currentLines.push(line);
      }
    }
    if (currentKey) {
      sections[currentKey] = currentLines.join("\n").trim();
    }
    return sections;
  } catch (err) {
    return null;
  }
}

class ClaudeCodeAgent {
  constructor(options = {}) {
    this.id = AGENT_ID;
    this.skills = AGENT_SKILLS;
    this.projectRoot = options.projectRoot || PROJECT_ROOT;
    this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    this.claudeBin = options.claudeBin || "claude";
    this.model = options.model || "sonnet";
    this.history = [];
    this.totalTokens = 0;
    this.totalCost = 0;

    // Load autonomous agent prompt system
    this.promptConfig = loadPromptConfig();
    this.promptSections = loadPromptSections();
    this.promptEnabled = !!(this.promptConfig && this.promptSections);
  }

  describe() {
    return `Claude Code Agent: AI-powered code generation, analysis, refactoring, architecture review, and debugging via Claude CLI. Skills: ${this.skills.join(", ")}`;
  }

  /**
   * Handle a task routed by the Supervisor.
   *
   * @param {Object} input
   * @param {Object} input.request - The SupervisorRequest
   * @param {Object} input.metadata - Plan metadata
   * @returns {Object} Structured result
   */
  async handle(input) {
    const { request, metadata } = input;
    const taskType = request.taskType || request.type || "general";
    const startTime = Date.now();

    try {
      const prompt = this._buildPrompt(request, metadata);
      const result = await this._executeClaudeCode(prompt, request);

      const entry = {
        taskType,
        requestId: request.id,
        success: true,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
      this.history.push(entry);

      return {
        agentId: this.id,
        taskType,
        status: "completed",
        output: result.output,
        files: result.files || [],
        suggestions: result.suggestions || [],
        durationMs: entry.durationMs,
      };
    } catch (error) {
      const entry = {
        taskType,
        requestId: request.id,
        success: false,
        error: error.message,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
      this.history.push(entry);

      return {
        agentId: this.id,
        taskType,
        status: "failed",
        error: error.message,
        durationMs: entry.durationMs,
      };
    }
  }

  /**
   * Get the system prompt context for a given task type and pipeline stage.
   * Uses the activation rules and section mapping from autonomous-agent-prompt.yaml.
   *
   * @param {string} taskType - The task type being executed
   * @param {string} stage - The current pipeline stage
   * @param {number} [ors] - Operational Readiness Score (0-100)
   * @returns {string} System prompt context to prepend, or empty string
   */
  _getSystemPromptContext(taskType, stage, ors) {
    if (!this.promptEnabled) return "";

    const config = this.promptConfig;
    const activation = config.activation || {};

    // Check if this task type should never receive prompt injection
    if ((activation.neverInject || []).includes(taskType)) return "";

    // Determine injection mode based on ORS
    let mode = config.injection?.defaultMode || "sections";
    if (typeof ors === "number") {
      if (ors > 85) mode = "full";
      else if (ors >= 70) mode = "sections";
      else mode = "summary";
    }

    // Summary mode: return the condensed version
    if (mode === "summary") {
      const summary = config.injection?.summary || "";
      return summary ? `[SYSTEM PROMPT — MAXIMUM POTENTIAL v2 (Summary)]\n${summary}\n` : "";
    }

    // Full mode: return all sections concatenated
    if (mode === "full") {
      const allSections = Object.values(this.promptSections);
      return `[SYSTEM PROMPT — MAXIMUM POTENTIAL v2]\n${allSections.join("\n\n")}\n`;
    }

    // Sections mode: determine which sections to inject
    let sectionKeys = [];

    // Always-inject task types get the pipeline-aligned sections
    if ((activation.alwaysInject || []).includes(taskType)) {
      const pipelineAlignment = config.pipelineAlignment || {};
      const stageConfig = pipelineAlignment[stage] || pipelineAlignment["execute-major-phase"] || {};
      sectionKeys = stageConfig.sections || [];
    }

    // Section-mapped task types get their specific sections
    const sectionMapping = activation.sectionMapping || {};
    if (sectionMapping[taskType]) {
      const mapped = sectionMapping[taskType];
      for (const key of mapped) {
        if (!sectionKeys.includes(key)) sectionKeys.push(key);
      }
    }

    if (sectionKeys.length === 0) return "";

    // Build the injected prompt from selected sections
    const injected = sectionKeys
      .map((key) => this.promptSections[key])
      .filter(Boolean)
      .join("\n\n");

    return injected
      ? `[SYSTEM PROMPT — MAXIMUM POTENTIAL v2 (Sections: ${sectionKeys.join(", ")})]\n${injected}\n`
      : "";
  }

  /**
   * Build a structured prompt for Claude Code based on task type.
   */
  _buildPrompt(request, metadata) {
    const stage = metadata?.stage || metadata?.requestType || "execute-major-phase";
    const ors = metadata?.ors ?? request.ors;

    // Inject autonomous agent system prompt context
    const systemPrompt = this._getSystemPromptContext(
      request.taskType || "general",
      stage,
      typeof ors === "number" ? ors : undefined
    );

    const context = [
      `Project: HeadyMonorepo (HCFullPipeline)`,
      `Stage: ${metadata?.requestType || "unknown"}`,
      `Run ID: ${request.runId || request.id || "N/A"}`,
    ];

    // Prepend system prompt if available
    if (systemPrompt) {
      context.unshift(systemPrompt);
    }

    switch (request.taskType) {
      case "code-generation":
        return [
          ...context,
          `Task: Generate code`,
          `Target: ${request.target || "unspecified"}`,
          `Requirements: ${request.requirements || request.description || "See request"}`,
          `Constraints: Follow HEADY_BRAND header convention. Use CommonJS require. Write production-quality code.`,
          ``,
          request.prompt || request.description || "",
        ].join("\n");

      case "code-analysis":
        return [
          ...context,
          `Task: Analyze code quality, performance, and architecture`,
          `Files: ${(request.files || []).join(", ") || "project-wide"}`,
          `Focus: ${request.focus || "general quality, security, performance"}`,
          `Output: Structured findings with severity, location, and recommendations`,
          ``,
          request.prompt || "",
        ].join("\n");

      case "refactoring":
        return [
          ...context,
          `Task: Refactor code`,
          `Target: ${request.target || "unspecified"}`,
          `Goal: ${request.goal || "improve clarity, reduce complexity, maintain behavior"}`,
          `Constraints: No functional changes unless explicitly requested. Preserve tests.`,
          ``,
          request.prompt || "",
        ].join("\n");

      case "architecture":
        return [
          ...context,
          `Task: Architecture review/design`,
          `Scope: ${request.scope || "full system"}`,
          `Question: ${request.question || request.description || ""}`,
          `Configs available: configs/hcfullpipeline.yaml, configs/service-catalog.yaml, configs/system-components.yaml`,
          ``,
          request.prompt || "",
        ].join("\n");

      case "debugging":
        return [
          ...context,
          `Task: Debug issue`,
          `Error: ${request.error || "unspecified"}`,
          `Logs: ${request.logs || "see hc_pipeline.log"}`,
          `Steps to reproduce: ${request.steps || "unknown"}`,
          ``,
          request.prompt || "",
        ].join("\n");

      case "concept-extraction":
        return [
          ...context,
          `Task: Extract concepts and patterns from provided content`,
          `Source: ${request.source || "provided text"}`,
          `Output: Structured concepts with name, category, description, applicability`,
          `Reference: configs/concepts-index.yaml for existing concepts`,
          ``,
          request.content || request.prompt || "",
        ].join("\n");

      default:
        return [
          ...context,
          `Task: ${request.taskType || "general"}`,
          `Description: ${request.description || request.prompt || ""}`,
          ``,
          request.prompt || request.description || "",
        ].join("\n");
    }
  }

  /**
   * Execute Claude Code CLI with the given prompt.
   * Falls back to a simulated response if CLI is not available.
   */
  async _executeClaudeCode(prompt, request) {
    // Try CLI first
    if (await this._isClaudeCliAvailable()) {
      return this._runClaudeCli(prompt, request);
    }

    // Fallback: return structured acknowledgment
    return this._fallbackExecution(prompt, request);
  }

  /**
   * Check if `claude` CLI is available on PATH.
   */
  async _isClaudeCliAvailable() {
    return new Promise((resolve) => {
      const proc = spawn(this.claudeBin, ["--version"], {
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 5000,
        shell: true,
      });
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });
  }

  /**
   * Run Claude CLI in non-interactive mode with a prompt.
   */
  _runClaudeCli(prompt, request) {
    return new Promise((resolve, reject) => {
      const args = [
        "--print",           // Non-interactive, print output
        "--model", this.model,
        "--output-format", "json",
      ];

      // Add allowlisted tools if task needs file operations
      if (request.taskType === "code-generation" || request.taskType === "refactoring") {
        args.push("--allowedTools", "Edit,Write,Read");
      }

      const proc = spawn(this.claudeBin, args, {
        cwd: this.projectRoot,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
        shell: true,
      });

      let stdout = "";
      let stderr = "";

      const timeout = setTimeout(() => {
        proc.kill("SIGTERM");
        reject(new Error(`Claude Code timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      proc.stdout.on("data", (data) => { stdout += data.toString(); });
      proc.stderr.on("data", (data) => { stderr += data.toString(); });

      // Send prompt via stdin
      proc.stdin.write(prompt);
      proc.stdin.end();

      proc.on("close", (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(new Error(`Claude Code exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          const parsed = JSON.parse(stdout);
          resolve({
            output: parsed.result || parsed.content || stdout,
            files: parsed.files_modified || [],
            suggestions: parsed.suggestions || [],
            tokensUsed: parsed.usage?.total_tokens || 0,
            cost: parsed.cost || 0,
          });
        } catch {
          // If not JSON, return raw output
          resolve({
            output: stdout.trim(),
            files: [],
            suggestions: [],
          });
        }
      });

      proc.on("error", (err) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to start Claude Code: ${err.message}`));
      });
    });
  }

  /**
   * Fallback when CLI is not available — returns structured task acknowledgment.
   * The Supervisor can still use this to track what needs to be done.
   */
  _fallbackExecution(prompt, request) {
    return Promise.resolve({
      output: [
        `[Claude Code Agent — Fallback Mode]`,
        `CLI not available. Task queued for manual execution.`,
        ``,
        `Task Type: ${request.taskType || "general"}`,
        `Target: ${request.target || "N/A"}`,
        `Description: ${request.description || request.prompt || "N/A"}`,
        ``,
        `To execute manually, run:`,
        `  claude --print --model ${this.model} "${prompt.slice(0, 200)}..."`,
        ``,
        `Or install Claude Code: npm install -g @anthropic-ai/claude-code`,
      ].join("\n"),
      files: [],
      suggestions: [
        "Install Claude Code CLI: npm install -g @anthropic-ai/claude-code",
        "Set ANTHROPIC_API_KEY in environment",
        "Re-run pipeline to execute with full Claude Code integration",
      ],
      fallback: true,
    });
  }

  /**
   * Get agent status for monitoring.
   */
  getStatus() {
    return {
      id: this.id,
      skills: this.skills,
      model: this.model,
      autonomousPrompt: {
        enabled: this.promptEnabled,
        version: this.promptConfig?.version || null,
        name: this.promptConfig?.name || null,
        sectionsLoaded: this.promptSections ? Object.keys(this.promptSections).length : 0,
      },
      history: this.history.slice(-10),
      totalInvocations: this.history.length,
      successRate: this.history.length > 0
        ? this.history.filter((h) => h.success).length / this.history.length
        : 1,
    };
  }
}

module.exports = { ClaudeCodeAgent, AGENT_ID, AGENT_SKILLS };
