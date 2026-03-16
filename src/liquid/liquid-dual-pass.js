/**
 * Heady™ LiquidDualPass v1.0
 * Architect/Editor model separation for optimal code generation
 * Absorbed from: Aider's Architect/Editor pattern (85% benchmark)
 *
 * Reasoning model proposes changes (Architect pass),
 * formatting model applies them precisely (Editor pass).
 * Phi-scaled token budget allocation: 38.2% planning, 61.8% execution.
 *
 * @author Eric Haywood — HeadySystems Inc.
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');
const {
  PHI, PSI, PSI_SQ, fib,
  CSL_THRESHOLDS,
} = require('../../shared/phi-math');
const { createLogger } = require('../../shared/logger');

const logger = createLogger('liquid-dual-pass');

// Phi-scaled budget allocation
const ARCHITECT_BUDGET_RATIO = PSI_SQ;    // 38.2% for planning
const EDITOR_BUDGET_RATIO = PSI;          // 61.8% for execution
const MAX_RETRIES = fib(4);               // 3 retries
const PASS_TIMEOUT_MS = fib(8) * 1000;    // 21s per pass

const PASS_STATES = Object.freeze({
  IDLE:         'IDLE',
  ARCHITECTING: 'ARCHITECTING',
  EDITING:      'EDITING',
  VALIDATING:   'VALIDATING',
  COMPLETE:     'COMPLETE',
  FAILED:       'FAILED',
});

// Model tier classification
const MODEL_TIERS = Object.freeze({
  REASONING: 'REASONING',   // Claude, o1, Gemini Pro — deep thinking
  FORMATTING: 'FORMATTING', // GPT-4o, Claude Haiku — fast formatting
  LOCAL:      'LOCAL',       // Ollama, local models — zero cost
});

class DualPassResult {
  constructor() {
    this.architectPlan = null;
    this.editorOutput = null;
    this.architectModel = null;
    this.editorModel = null;
    this.architectTokens = 0;
    this.editorTokens = 0;
    this.totalLatencyMs = 0;
    this.retries = 0;
    this.validationPassed = false;
  }

  toJSON() {
    return {
      architectModel: this.architectModel,
      editorModel: this.editorModel,
      architectTokens: this.architectTokens,
      editorTokens: this.editorTokens,
      totalLatencyMs: this.totalLatencyMs,
      retries: this.retries,
      validationPassed: this.validationPassed,
    };
  }
}

class LiquidDualPass extends EventEmitter {
  constructor(config = {}) {
    super();

    // Model routing configuration
    this._models = {
      architect: config.architectModel || {
        tier: MODEL_TIERS.REASONING,
        provider: 'claude',
        model: 'claude-opus-4-6',
        temperature: 0,
        topP: 1,
      },
      editor: config.editorModel || {
        tier: MODEL_TIERS.FORMATTING,
        provider: 'claude',
        model: 'claude-haiku-4-5-20251001',
        temperature: 0,
        topP: 1,
      },
    };

    // Callback for actual model invocation (injected by gateway)
    this._invoke = config.invokeModel || null;

    // Validation callback
    this._validate = config.validator || (() => ({ valid: true }));

    this.state = PASS_STATES.IDLE;

    this._metrics = {
      totalRuns: 0,
      architectPassTime: 0,
      editorPassTime: 0,
      validationFailures: 0,
      costSaved: 0, // estimated vs single-model
    };

    logger.info({
      architect: this._models.architect.model,
      editor: this._models.editor.model,
    }, 'LiquidDualPass initialized');
  }

  // ── Execute Dual Pass ──────────────────────────────────────────
  async execute(task, context = {}) {
    const result = new DualPassResult();
    const totalBudget = context.tokenBudget || fib(13) * 100; // ~23,300 tokens
    const start = Date.now();

    this._metrics.totalRuns++;
    result.architectModel = this._models.architect.model;
    result.editorModel = this._models.editor.model;

    // ── Pass 1: Architect (reasoning model) ──────────────────────
    this.state = PASS_STATES.ARCHITECTING;
    this.emit('pass:architect:start', { task });

    const architectBudget = Math.round(totalBudget * ARCHITECT_BUDGET_RATIO);
    const architectStart = Date.now();

    try {
      const architectPrompt = this._buildArchitectPrompt(task, context);
      const architectResponse = await this._invokeModel(
        this._models.architect,
        architectPrompt,
        architectBudget
      );

      result.architectPlan = architectResponse.content;
      result.architectTokens = architectResponse.tokensUsed || 0;
      this._metrics.architectPassTime += Date.now() - architectStart;

      this.emit('pass:architect:complete', {
        plan: result.architectPlan,
        tokens: result.architectTokens,
      });
    } catch (e) {
      this.state = PASS_STATES.FAILED;
      logger.error({ error: e.message }, 'Architect pass failed');
      this.emit('pass:architect:error', e);
      throw e;
    }

    // ── Pass 2: Editor (formatting model) ────────────────────────
    this.state = PASS_STATES.EDITING;
    this.emit('pass:editor:start', { plan: result.architectPlan });

    const editorBudget = Math.round(totalBudget * EDITOR_BUDGET_RATIO);
    const editorStart = Date.now();

    let attempts = 0;
    while (attempts < MAX_RETRIES) {
      try {
        const editorPrompt = this._buildEditorPrompt(result.architectPlan, task, context);
        const editorResponse = await this._invokeModel(
          this._models.editor,
          editorPrompt,
          editorBudget
        );

        result.editorOutput = editorResponse.content;
        result.editorTokens += editorResponse.tokensUsed || 0;
        this._metrics.editorPassTime += Date.now() - editorStart;

        // ── Validation ─────────────────────────────────────────────
        this.state = PASS_STATES.VALIDATING;
        const validation = await this._validate(result.editorOutput, task);

        if (validation.valid) {
          result.validationPassed = true;
          break;
        }

        logger.warn({ attempt: attempts + 1, reason: validation.reason }, 'Validation failed, retrying editor pass');
        this._metrics.validationFailures++;
        result.retries++;
        attempts++;

        // Feed validation error back to editor
        context._validationError = validation.reason;
      } catch (e) {
        attempts++;
        if (attempts >= MAX_RETRIES) {
          this.state = PASS_STATES.FAILED;
          logger.error({ error: e.message }, 'Editor pass failed after retries');
          throw e;
        }
      }
    }

    result.totalLatencyMs = Date.now() - start;
    this.state = PASS_STATES.COMPLETE;
    this.emit('dualpass:complete', result.toJSON());

    return result;
  }

  // ── Prompt Builders ────────────────────────────────────────────
  _buildArchitectPrompt(task, context) {
    return {
      system: `You are the Architect. Analyze the task and produce a precise change plan.
Output ONLY the plan — describe what to change, where, and why.
Do NOT write actual code. The Editor will implement your plan.
Be specific about file paths, function names, and line ranges.`,
      messages: [
        ...(context.history || []),
        {
          role: 'user',
          content: `Task: ${task.description || task}

${context.repoMap ? `Repository Map:\n${context.repoMap}` : ''}
${context.relevantFiles ? `Relevant Files:\n${context.relevantFiles.map(f => `- ${f}`).join('\n')}` : ''}

Produce a detailed change plan.`,
        },
      ],
    };
  }

  _buildEditorPrompt(plan, task, context) {
    return {
      system: `You are the Editor. Given an Architect's change plan, produce the exact code changes.
Output changes in search/replace format:
<<<SEARCH
old code
===
new code
>>>REPLACE

Be precise. Match the exact existing code for search blocks.${
  context._validationError
    ? `\n\nPrevious attempt had a validation error: ${context._validationError}\nFix the error in this attempt.`
    : ''
}`,
      messages: [
        {
          role: 'user',
          content: `Architect's Plan:\n${plan}\n\nOriginal Task: ${task.description || task}\n\nImplement the plan as exact code changes.`,
        },
      ],
    };
  }

  // ── Model Invocation ───────────────────────────────────────────
  async _invokeModel(modelConfig, prompt, tokenBudget) {
    if (this._invoke) {
      return this._invoke(modelConfig, prompt, tokenBudget);
    }

    // Stub response when no gateway connected
    logger.warn('No model invoker configured — returning stub');
    return {
      content: `[Stub: ${modelConfig.tier} pass would execute here with ${modelConfig.model}]`,
      tokensUsed: 0,
    };
  }

  // ── Configuration ──────────────────────────────────────────────
  setArchitectModel(modelConfig) {
    this._models.architect = { ...this._models.architect, ...modelConfig };
    logger.info({ model: this._models.architect.model }, 'Architect model updated');
  }

  setEditorModel(modelConfig) {
    this._models.editor = { ...this._models.editor, ...modelConfig };
    logger.info({ model: this._models.editor.model }, 'Editor model updated');
  }

  setValidator(fn) { this._validate = fn; }
  setInvoker(fn) { this._invoke = fn; }

  get metrics() { return { ...this._metrics }; }
}

module.exports = { LiquidDualPass, MODEL_TIERS, PASS_STATES };
