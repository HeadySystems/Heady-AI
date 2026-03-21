const logger = console;
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
// ║  FILE: src/hc_distiller.js                                      ║
// ║  LAYER: distiller/orchestrator                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

/**
 * HeadyDistiller — Main Orchestrator
 *
 * Four-layer architecture:
 * 1. Orchestration: Durable execution with event sourcing
 * 2. Trace Collection: JSONL append-only logs from event emitters
 * 3. Distillation: GEPA/MIPROv2/TextGrad prompt optimization
 * 4. Routing: Semantic routing over vector space
 *
 * Wires TraceRecorder, ReplayClient, TrajectoryFilter,
 * SkillSynthesizer, and PromptOptimizer into a unified pipeline.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { EventEmitter } = require('events');

const TraceRecorder = require('./hc_trace_recorder');
const ReplayClient = require('./hc_replay_client');
const TrajectoryFilter = require('./hc_trajectory_filter');
const SkillSynthesizer = require('./hc_skill_synthesizer');
const PromptOptimizer = require('./hc_prompt_optimizer');
const logger = require('./utils/logger');

const CONFIG_PATH = path.join(__dirname, '..', 'configs', 'distiller-config.yaml');

class HeadyDistiller extends EventEmitter {
  constructor(options = {}) {
    super();

    // Load config
    this.config = this._loadConfig(options);

    // Initialize sub-systems
    this.traceRecorder = new TraceRecorder({
      traceDir: path.join(__dirname, '..', this.config.trace_dir || 'logs/traces'),
      maxEntriesPerTrace: this.config.max_trace_entries || 50000,
    });

    this.replayClient = new ReplayClient({
      traceDir: path.join(__dirname, '..', this.config.trace_dir || 'logs/traces'),
    });

    this.trajectoryFilter = new TrajectoryFilter({
      minSuccessRate: this.config.filtering?.min_success_rate ?? 0.8,
      confidenceWindow: this.config.filtering?.confidence_window || [0.1, 0.9],
      tipExtraction: this.config.filtering?.tip_extraction !== false,
    });

    this.skillSynthesizer = new SkillSynthesizer({
      outputDir: path.join(__dirname, '..', this.config.synthesis?.output_dir || '.claude/skills/distilled'),
    });

    this.promptOptimizer = new PromptOptimizer({
      method: this.config.optimization?.method || 'gepa',
      maxIterations: this.config.optimization?.max_iterations || 150,
      reflectionModel: this.config.optimization?.reflection_model || null,
    });

    this.initialized = false;
  }

  // ─── LIFECYCLE ────────────────────────────────────────────────────────────

  /**
   * Initialize the distiller and load existing skills from disk.
   */
  initialize() {
    this.skillSynthesizer.loadFromDisk();
    this.initialized = true;
    this.emit('distiller:initialized', this.getStatus());
    return this;
  }

  /**
   * Hook into a SkillExecutor to auto-record traces.
   */
  hookSkillExecutor(executor) {
    this.traceRecorder.hookSkillExecutor(executor);
    return this;
  }

  /**
   * Hook into an HCFullPipeline to auto-record traces.
   */
  hookPipeline(pipeline) {
    this.traceRecorder.hookPipeline(pipeline);
    return this;
  }

  // ─── DISTILLATION PIPELINE ────────────────────────────────────────────────

  /**
   * Full distillation pipeline:
   * 1. Load trace summaries
   * 2. Filter by success + confidence + tips
   * 3. Synthesize SKILL.md from filtered traces
   * 4. Optionally optimize prompts
   *
   * @param {Object} options
   * @param {string} options.skillName - Name for the distilled skill
   * @param {string} options.description - Description
   * @param {string} options.category - Skill category
   * @param {Function} options.metricFn - Custom metric function for optimization
   * @param {boolean} options.optimizePrompts - Run prompt optimization
   * @returns {Object} Distillation result
   */
  async distill(options = {}) {
    const skillName = options.skillName || `distilled-${Date.now()}`;

    this.emit('distill:start', { skillName });

    // Step 1: Get all trace summaries
    const traceList = this.traceRecorder.listTraces({
      limit: this.config.max_traces || 10000,
      source: options.source || null,
    });

    const summaries = traceList.map(t => {
      try { return this.replayClient.summarize(t.traceId); }
      catch (e) { return null; }
    }).filter(Boolean);

    this.emit('distill:traces_loaded', { count: summaries.length });

    // Step 2: Filter
    const traceLoader = (traceId) => this.replayClient.loadTrace(traceId);
    const filterResult = this.trajectoryFilter.filter(summaries, traceLoader);

    this.emit('distill:filtered', {
      input: filterResult.input,
      output: filterResult.afterConfidenceFilter,
      tipsExtracted: filterResult.tipsExtracted,
    });

    if (filterResult.filtered.length === 0) {
      return {
        success: false,
        reason: 'No traces survived filtering',
        filterResult,
      };
    }

    // Step 3: Synthesize SKILL.md
    const tips = this.trajectoryFilter.getAllTips();
    const synthesisResult = this.skillSynthesizer.synthesize(
      skillName,
      filterResult.filtered,
      traceLoader,
      {
        description: options.description,
        category: options.category || 'distilled',
        tips: tips.slice(0, 10),
      },
    );

    this.emit('distill:synthesized', {
      skillId: synthesisResult.skillId,
      skillPath: synthesisResult.skillPath,
    });

    // Step 4: Prompt optimization (optional)
    let optimizationResult = null;
    if (options.optimizePrompts) {
      const basePrompt = options.basePrompt || '';
      optimizationResult = await this.promptOptimizer.optimize(
        basePrompt,
        filterResult.filtered,
        options.metricFn || null,
      );

      this.emit('distill:optimized', {
        bestScore: optimizationResult.bestScore,
        iterations: optimizationResult.iterations,
      });
    }

    const result = {
      success: true,
      skillName,
      skillId: synthesisResult.skillId,
      skillPath: synthesisResult.skillPath,
      filterResult: {
        input: filterResult.input,
        afterSuccessFilter: filterResult.afterSuccessFilter,
        afterConfidenceFilter: filterResult.afterConfidenceFilter,
        tipsExtracted: filterResult.tipsExtracted,
      },
      patterns: synthesisResult.patterns,
      optimization: optimizationResult,
      tips: tips.slice(0, 10),
    };

    this.emit('distill:complete', result);
    return result;
  }

  // ─── REPLAY ───────────────────────────────────────────────────────────────

  /**
   * Replay a specific trace deterministically.
   */
  async replay(traceId) {
    const entries = this.replayClient.loadTrace(traceId);
    const stubMap = this.replayClient.buildStubMap(entries);
    const stubbedClient = this.replayClient.createStubbedLLMClient(stubMap);

    return {
      traceId,
      entries: entries.length,
      stubMap: stubMap.size,
      stubbedClient,
      timeline: this.replayClient.extractTimeline(traceId),
      summary: this.replayClient.summarize(traceId),
    };
  }

  /**
   * Verify a trace's integrity.
   */
  async verify(traceId) {
    return this.replayClient.verify(traceId);
  }

  // ─── STATUS & STATS ──────────────────────────────────────────────────────

  /**
   * Get comprehensive distiller status.
   */
  getStatus() {
    return {
      initialized: this.initialized,
      config: {
        method: this.config.optimization?.method || 'gepa',
        traceDir: this.config.trace_dir,
        maxTraces: this.config.max_traces,
      },
      traces: this.traceRecorder.getStats(),
      filter: this.trajectoryFilter.getStats(),
      synthesizer: {
        skillCount: this.skillSynthesizer.listSkills().length,
        skills: this.skillSynthesizer.listSkills().map(s => s.name),
      },
      optimizer: this.promptOptimizer.getStats(),
    };
  }

  // ─── INTERNALS ────────────────────────────────────────────────────────────

  _loadConfig(options) {
    // Merge file config with options
    let fileConfig = {};
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
        const parsed = yaml.load(raw);
        fileConfig = parsed?.distiller || parsed || {};
      }
    } catch (e) { /* config file is optional */ }

    return {
      ...fileConfig,
      ...options,
    };
  }

  /**
   * Cleanup resources.
   */
  destroy() {
    this.traceRecorder.destroy();
  }
}

module.exports = HeadyDistiller;
