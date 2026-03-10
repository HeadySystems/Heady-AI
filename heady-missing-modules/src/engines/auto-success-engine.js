/**
 * HeadyAutoSuccessEngine — Automated Success Pipeline
 *
 * Chains Battle Arena → Coder → Analyze → Risks → Patterns into a single
 * automated workflow that takes a task from request to verified delivery.
 *
 * Pipeline stages execute with data-dependency-aware scheduling —
 * independent stages run concurrently, dependent stages wait for input.
 *
 * Previously a 100% stub — this is the full implementation.
 *
 * © 2026 HeadySystems Inc. — Sacred Geometry v4.0
 * @module engines/auto-success-engine
 */

const { PHI, PSI, fib, CSL_THRESHOLDS, phiFusionWeights, phiBackoff, cosineSimilarity, cslGate } = require('../shared/phi-math');
const { createLogger } = require('../shared/logger');

const logger = createLogger('AutoSuccessEngine');

/**
 * Pipeline stage definitions.
 * Each stage has: id, name, dependencies, executor, timeout.
 */
const PIPELINE_STAGES = Object.freeze({
  CONTEXT:   { id: 'context',   name: 'Context Assembly',     dependencies: [],                    timeout: fib(8) * 1000 },  // 21s
  BATTLE:    { id: 'battle',    name: 'Battle Arena',          dependencies: ['context'],            timeout: fib(9) * 1000 },  // 34s
  CODE:      { id: 'code',      name: 'Code Generation',       dependencies: ['battle'],             timeout: fib(10) * 1000 }, // 55s
  ANALYZE:   { id: 'analyze',   name: 'Analysis',              dependencies: ['code'],               timeout: fib(9) * 1000 },  // 34s
  RISKS:     { id: 'risks',     name: 'Risk Assessment',       dependencies: ['code'],               timeout: fib(8) * 1000 },  // 21s (parallel with analyze)
  PATTERNS:  { id: 'patterns',  name: 'Pattern Capture',       dependencies: ['analyze', 'risks'],   timeout: fib(8) * 1000 },  // 21s
  QUALITY:   { id: 'quality',   name: 'Quality Gate',          dependencies: ['patterns'],           timeout: fib(8) * 1000 },  // 21s
  ASSURANCE: { id: 'assurance', name: 'Assurance Certification', dependencies: ['quality'],           timeout: fib(8) * 1000 },  // 21s
});

/** Stage status values */
const STATUS = Object.freeze({
  PENDING:  'pending',
  RUNNING:  'running',
  SUCCESS:  'success',
  FAILED:   'failed',
  SKIPPED:  'skipped',
  RETRYING: 'retrying',
});

class AutoSuccessEngine {
  /**
   * @param {Object} config
   * @param {Object} config.executors - Map of stage ID to executor functions
   *   Each executor: async (input, context) => { result, embedding }
   * @param {Function} config.embedFn - async (text) => number[]
   * @param {number} [config.maxRetries] - Max retries per stage (default: fib(4) = 3)
   */
  constructor(config) {
    this.executors = config.executors;
    this.embedFn = config.embedFn;
    this.maxRetries = config.maxRetries || fib(4);
    this.runs = [];
  }

  /**
   * Execute the full auto-success pipeline.
   * @param {Object} task
   * @param {string} task.id - Task identifier
   * @param {string} task.description - Task description
   * @param {Object} [task.context] - Additional context
   * @returns {Promise<Object>} Pipeline result
   */
  async execute(task) {
    const runId = `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const startTime = Date.now();

    logger.info({ runId, taskId: task.id, description: task.description.slice(0, 100) }, 'Pipeline started');

    // Initialize stage state
    const stageState = {};
    for (const [key, stage] of Object.entries(PIPELINE_STAGES)) {
      stageState[stage.id] = {
        ...stage,
        status: STATUS.PENDING,
        result: null,
        embedding: null,
        startTime: null,
        endTime: null,
        retries: 0,
        error: null,
      };
    }

    const pipelineContext = {
      runId,
      task,
      stageResults: {},
      stageEmbeddings: {},
    };

    // Execute stages respecting dependency DAG
    try {
      await this._executeDag(stageState, pipelineContext);
    } catch (err) {
      logger.error({ runId, error: err.message }, 'Pipeline failed');
    }

    const endTime = Date.now();

    // Compute overall quality score from stage embeddings
    const qualityScore = this._computeQualityScore(stageState);

    const runResult = {
      runId,
      taskId: task.id,
      status: this._overallStatus(stageState),
      stages: Object.values(stageState).map(s => ({
        id: s.id,
        name: s.name,
        status: s.status,
        durationMs: s.endTime && s.startTime ? s.endTime - s.startTime : null,
        retries: s.retries,
        error: s.error,
      })),
      qualityScore,
      totalDurationMs: endTime - startTime,
      timestamp: new Date().toISOString(),
    };

    this.runs.push(runResult);
    if (this.runs.length > fib(10)) this.runs = this.runs.slice(-fib(9));

    logger.info({
      runId,
      status: runResult.status,
      qualityScore: qualityScore.toFixed(4),
      durationMs: runResult.totalDurationMs,
    }, 'Pipeline complete');

    return runResult;
  }

  /**
   * Execute stages in DAG order — parallel where dependencies allow.
   * @param {Object} stageState
   * @param {Object} pipelineContext
   * @returns {Promise<void>}
   */
  async _executeDag(stageState, pipelineContext) {
    const completed = new Set();
    const stages = Object.values(stageState);

    while (completed.size < stages.length) {
      // Find stages whose dependencies are all completed
      const ready = stages.filter(s =>
        s.status === STATUS.PENDING &&
        s.dependencies.every(dep => completed.has(dep))
      );

      if (ready.length === 0) {
        // Check if anything is still running
        const running = stages.filter(s => s.status === STATUS.RUNNING || s.status === STATUS.RETRYING);
        if (running.length === 0) {
          // Deadlock or all remaining stages have failed dependencies
          for (const s of stages) {
            if (s.status === STATUS.PENDING) {
              s.status = STATUS.SKIPPED;
              completed.add(s.id);
            }
          }
          break;
        }
        // Wait a tick for running stages to complete
        await new Promise(r => setTimeout(r, 100));
        continue;
      }

      // Execute all ready stages concurrently
      await Promise.allSettled(
        ready.map(async (stage) => {
          await this._executeStage(stage, stageState, pipelineContext);
          completed.add(stage.id);
        })
      );
    }
  }

  /**
   * Execute a single stage with retry logic.
   * @param {Object} stage
   * @param {Object} stageState
   * @param {Object} pipelineContext
   */
  async _executeStage(stage, stageState, pipelineContext) {
    const executor = this.executors[stage.id];
    if (!executor) {
      logger.warn({ stage: stage.id }, 'No executor registered — skipping');
      stage.status = STATUS.SKIPPED;
      return;
    }

    stage.status = STATUS.RUNNING;
    stage.startTime = Date.now();

    // Gather inputs from dependency stages
    const input = {};
    for (const depId of stage.dependencies) {
      input[depId] = pipelineContext.stageResults[depId];
    }

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          stage.status = STATUS.RETRYING;
          stage.retries = attempt;
          const delay = phiBackoff(attempt - 1, 500);
          logger.info({ stage: stage.id, attempt, delay }, 'Retrying stage');
          await new Promise(r => setTimeout(r, delay));
        }

        // Execute with timeout
        const result = await Promise.race([
          executor(input, pipelineContext),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Stage ${stage.id} timed out after ${stage.timeout}ms`)), stage.timeout)
          ),
        ]);

        // Store results
        stage.result = result.result;
        stage.embedding = result.embedding || null;
        stage.status = STATUS.SUCCESS;
        stage.endTime = Date.now();

        pipelineContext.stageResults[stage.id] = result.result;
        if (result.embedding) {
          pipelineContext.stageEmbeddings[stage.id] = result.embedding;
        }

        logger.info({
          stage: stage.id,
          durationMs: stage.endTime - stage.startTime,
          attempt,
        }, 'Stage completed');

        return;
      } catch (err) {
        stage.error = err.message;
        logger.error({ stage: stage.id, attempt, error: err.message }, 'Stage execution failed');
      }
    }

    // All retries exhausted
    stage.status = STATUS.FAILED;
    stage.endTime = Date.now();
  }

  /**
   * Compute overall quality score from stage embeddings.
   * Uses phi-weighted fusion of stage coherence scores.
   * @param {Object} stageState
   * @returns {number}
   */
  _computeQualityScore(stageState) {
    const stages = Object.values(stageState);
    const successful = stages.filter(s => s.status === STATUS.SUCCESS);
    if (successful.length === 0) return 0;

    // Base score: percentage of stages that succeeded
    const completionRate = successful.length / stages.length;

    // Coherence bonus: if embeddings available, measure inter-stage alignment
    const withEmbeddings = successful.filter(s => s.embedding);
    let coherenceBonus = 0;

    if (withEmbeddings.length >= 2) {
      let totalSim = 0;
      let count = 0;
      for (let i = 0; i < withEmbeddings.length; i++) {
        for (let j = i + 1; j < withEmbeddings.length; j++) {
          totalSim += cosineSimilarity(withEmbeddings[i].embedding, withEmbeddings[j].embedding);
          count++;
        }
      }
      coherenceBonus = count > 0 ? (totalSim / count) * PSI * PSI : 0; // ≈ 0.382 × avg_similarity
    }

    // Phi-weighted: completion 0.618, coherence 0.382
    const weights = phiFusionWeights(2);
    return completionRate * weights[0] + (completionRate + coherenceBonus) * weights[1];
  }

  /**
   * Determine overall pipeline status.
   * @param {Object} stageState
   * @returns {string}
   */
  _overallStatus(stageState) {
    const stages = Object.values(stageState);
    const failed = stages.filter(s => s.status === STATUS.FAILED);
    if (failed.length > 0) return 'failed';

    const skipped = stages.filter(s => s.status === STATUS.SKIPPED);
    if (skipped.length > 0) return 'partial';

    return 'success';
  }

  /**
   * Get pipeline run history.
   * @returns {Object[]}
   */
  history() {
    return this.runs;
  }

  /** Health check */
  health() {
    const recent = this.runs.slice(-fib(5));
    const successRate = recent.length > 0
      ? recent.filter(r => r.status === 'success').length / recent.length
      : null;

    return {
      service: 'AutoSuccessEngine',
      status: 'up',
      totalRuns: this.runs.length,
      recentSuccessRate: successRate !== null ? parseFloat(successRate.toFixed(3)) : null,
      stages: Object.keys(PIPELINE_STAGES),
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { AutoSuccessEngine, PIPELINE_STAGES, STATUS };
