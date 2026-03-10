/**
 * Heady™ Conductor Orchestration Engine v5.0
 * Central dispatch — routes tasks to AI nodes, manages pipeline execution
 * Hot/Warm/Cold pool scheduling, HCFullPipeline coordination
 * 
 * @author Eric Haywood — HeadySystems Inc.
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');
const {
  PHI, PSI, PSI_SQ, fib, phiFusionScore, phiBackoffWithJitter,
  CSL_THRESHOLDS, TIMING, RESOURCE_ALLOCATION, PIPELINE_STAGE_COUNT,
  EMBEDDING_DIM, SERVICE_PORTS, cslAND, getPressureLevel,
} = require('../../shared/phi-math');
const { createLogger } = require('../../shared/logger');

const logger = createLogger('heady-conductor');

// ─── Domain → Node Routing Table ────────────────────────────────

const ROUTING_TABLE = Object.freeze({
  code_generation:  { nodes: ['JULES', 'BUILDER', 'HeadyCoder'],     pool: 'HOT' },
  code_review:      { nodes: ['OBSERVER', 'HeadyAnalyze'],           pool: 'HOT' },
  security:         { nodes: ['MURPHY', 'CIPHER', 'HeadyRisks'],     pool: 'HOT' },
  architecture:     { nodes: ['ATLAS', 'PYTHIA', 'HeadyVinci'],      pool: 'HOT' },
  research:         { nodes: ['HeadyResearch', 'SOPHIA'],            pool: 'WARM' },
  documentation:    { nodes: ['ATLAS', 'HeadyCodex'],                pool: 'WARM' },
  creative:         { nodes: ['MUSE', 'NOVA'],                       pool: 'WARM' },
  translation:      { nodes: ['BRIDGE'],                              pool: 'WARM' },
  monitoring:       { nodes: ['OBSERVER', 'LENS', 'SENTINEL'],       pool: 'WARM' },
  cleanup:          { nodes: ['JANITOR', 'HeadyMaid'],               pool: 'COLD' },
  analytics:        { nodes: ['HeadyPatterns', 'HeadyMC'],           pool: 'COLD' },
  maintenance:      { nodes: ['HeadyMaintenance'],                    pool: 'COLD' },
  inference:        { nodes: ['HeadyInference'],                      pool: 'HOT' },
  memory:           { nodes: ['HeadyMemory', 'HeadyEmbed'],          pool: 'HOT' },
  orchestration:    { nodes: ['HeadyConductor', 'HeadySwarm'],       pool: 'HOT' },
  governance:       { nodes: ['HeadyCheck', 'HeadyAssure'],          pool: 'WARM' },
});

// ─── HCFullPipeline — 21 Stages ────────────────────────────────

const HCFP_STAGES = Object.freeze([
  { id: 1,  name: 'context_assembly',        node: 'HeadyBrains',         pool: 'HOT' },
  { id: 2,  name: 'intent_classification',   node: 'HeadyConductor',      pool: 'HOT' },
  { id: 3,  name: 'node_selection',          node: 'HeadyConductor',      pool: 'HOT' },
  { id: 4,  name: 'parallel_execution',      node: 'HeadySwarm',          pool: 'HOT' },
  { id: 5,  name: 'result_collection',       node: 'HeadyConductor',      pool: 'HOT' },
  { id: 6,  name: 'quality_gate',            node: 'HeadyCheck',          pool: 'HOT' },
  { id: 7,  name: 'assurance_gate',          node: 'HeadyAssure',         pool: 'WARM' },
  { id: 8,  name: 'pattern_capture',         node: 'HeadyPatterns',       pool: 'WARM' },
  { id: 9,  name: 'story_update',            node: 'HeadyAutobiographer', pool: 'WARM' },
  { id: 10, name: 'memory_commit',           node: 'HeadyMemory',         pool: 'HOT' },
  { id: 11, name: 'evolution_check',         node: 'HeadyEvolution',      pool: 'WARM' },
  { id: 12, name: 'coherence_validation',    node: 'HeadySoul',           pool: 'HOT' },
  { id: 13, name: 'drift_detection',         node: 'HeadyDriftDetector',  pool: 'WARM' },
  { id: 14, name: 'self_healing',            node: 'HeadySelfHeal',       pool: 'WARM' },
  { id: 15, name: 'consensus_aggregation',   node: 'HeadyConsensus',      pool: 'WARM' },
  { id: 16, name: 'mistake_analysis',        node: 'HeadyMC',             pool: 'COLD' },
  { id: 17, name: 'telemetry_emit',          node: 'HeadyTelemetry',      pool: 'COLD' },
  { id: 18, name: 'metrics_update',          node: 'HeadyMetrics',        pool: 'COLD' },
  { id: 19, name: 'notification_dispatch',   node: 'HeadyNotification',   pool: 'WARM' },
  { id: 20, name: 'audit_log',              node: 'HeadyAudit',          pool: 'COLD' },
  { id: 21, name: 'response_delivery',      node: 'HeadyBuddy',          pool: 'HOT' },
]);

class PipelineExecution {
  constructor(taskId) {
    this.id = `hcfp-${crypto.randomBytes(fib(5)).toString('hex')}`;
    this.taskId = taskId;
    this.stages = HCFP_STAGES.map(s => ({
      ...s,
      status: 'PENDING',
      startTime: 0,
      endTime: 0,
      result: null,
      error: null,
    }));
    this.currentStage = 0;
    this.startTime = Date.now();
    this.endTime = 0;
    this.status = 'RUNNING';
  }

  advanceStage(result) {
    if (this.currentStage >= this.stages.length) return false;
    const stage = this.stages[this.currentStage];
    stage.status = 'COMPLETED';
    stage.endTime = Date.now();
    stage.result = result;
    this.currentStage++;
    if (this.currentStage < this.stages.length) {
      this.stages[this.currentStage].status = 'RUNNING';
      this.stages[this.currentStage].startTime = Date.now();
    }
    return true;
  }

  failStage(error) {
    if (this.currentStage >= this.stages.length) return;
    const stage = this.stages[this.currentStage];
    stage.status = 'FAILED';
    stage.endTime = Date.now();
    stage.error = error;
    this.status = 'FAILED';
  }

  complete() {
    this.endTime = Date.now();
    this.status = this.stages.every(s => s.status === 'COMPLETED') ? 'COMPLETED' : 'PARTIAL';
  }

  get progress() {
    return this.currentStage / this.stages.length;
  }

  get latencyMs() {
    return (this.endTime || Date.now()) - this.startTime;
  }

  toJSON() {
    return {
      id: this.id,
      taskId: this.taskId,
      status: this.status,
      progress: this.progress,
      currentStage: this.currentStage,
      totalStages: this.stages.length,
      latencyMs: this.latencyMs,
      stages: this.stages.map(s => ({
        id: s.id, name: s.name, node: s.node, pool: s.pool, status: s.status,
        durationMs: s.endTime ? s.endTime - s.startTime : 0,
      })),
    };
  }
}

class HeadyConductor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.activePipelines = new Map();
    this.completedPipelines = [];
    this.maxCompleted = fib(13); // 233 history
    this.nodeHealth = new Map();
    this.routeCount = 0;
    this.pipelineCount = 0;
    this._healthInterval = null;
  }

  async start() {
    this._healthInterval = setInterval(() => this._emitHealth(), TIMING.HEALTH_CHECK_MS);
    logger.info('conductor_started', { stageCount: PIPELINE_STAGE_COUNT });
    this.emit('started');
  }

  async stop() {
    if (this._healthInterval) { clearInterval(this._healthInterval); this._healthInterval = null; }
    logger.info('conductor_stopped');
    this.emit('stopped');
  }

  classifyTask(task) {
    // CSL-scored domain classification
    if (task.domain && ROUTING_TABLE[task.domain]) {
      return { domain: task.domain, ...ROUTING_TABLE[task.domain] };
    }

    // Keyword-based classification fallback
    const text = (task.description || task.type || '').toLowerCase();
    const domainKeywords = {
      code_generation: ['code', 'implement', 'build', 'create', 'function'],
      code_review: ['review', 'check', 'lint', 'analyze code'],
      security: ['security', 'vulnerability', 'audit', 'risk'],
      architecture: ['architecture', 'design', 'system', 'topology'],
      research: ['research', 'investigate', 'study', 'explore'],
      documentation: ['document', 'docs', 'readme', 'guide'],
      creative: ['creative', 'design', 'ui', 'ux', 'visual'],
      monitoring: ['monitor', 'observe', 'watch', 'track'],
      analytics: ['analytics', 'metrics', 'data', 'pattern'],
      maintenance: ['maintain', 'cleanup', 'fix', 'repair'],
      inference: ['infer', 'predict', 'classify', 'embed'],
      memory: ['memory', 'remember', 'store', 'recall'],
    };

    let bestDomain = 'inference';
    let bestScore = 0;
    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      const score = keywords.filter(kw => text.includes(kw)).length / keywords.length;
      if (score > bestScore) {
        bestScore = score;
        bestDomain = domain;
      }
    }

    return { domain: bestDomain, ...ROUTING_TABLE[bestDomain] };
  }

  routeTask(task) {
    this.routeCount++;
    const classification = this.classifyTask(task);

    const route = {
      taskId: task.id,
      domain: classification.domain,
      nodes: classification.nodes,
      pool: classification.pool,
      priority: task.priority || phiFusionScore([0.5, 0.5, 0.5]),
      timestamp: Date.now(),
    };

    logger.info('task_routed', {
      taskId: task.id,
      domain: route.domain,
      nodes: route.nodes,
      pool: route.pool,
    });

    this.emit('taskRouted', route);
    return route;
  }

  async executePipeline(task) {
    this.pipelineCount++;
    const pipeline = new PipelineExecution(task.id);
    this.activePipelines.set(pipeline.id, pipeline);

    logger.info('pipeline_started', {
      pipelineId: pipeline.id,
      taskId: task.id,
      stages: PIPELINE_STAGE_COUNT,
    });

    this.emit('pipelineStarted', { pipelineId: pipeline.id });

    // Execute stages sequentially
    pipeline.stages[0].status = 'RUNNING';
    pipeline.stages[0].startTime = Date.now();

    for (let i = 0; i < pipeline.stages.length; i++) {
      const stage = pipeline.stages[i];

      try {
        // Simulate stage execution
        const timeout = stage.pool === 'HOT'
          ? TIMING.HOT_TIMEOUT_MS
          : stage.pool === 'WARM'
            ? TIMING.WARM_TIMEOUT_MS
            : TIMING.COLD_TIMEOUT_MS;

        const stageResult = {
          stageId: stage.id,
          stageName: stage.name,
          node: stage.node,
          status: 'COMPLETED',
          timestamp: Date.now(),
        };

        pipeline.advanceStage(stageResult);

        this.emit('stageCompleted', {
          pipelineId: pipeline.id,
          stage: stage.name,
          progress: pipeline.progress,
        });

        logger.debug('stage_completed', {
          pipelineId: pipeline.id,
          stage: stage.name,
          stageNum: i + 1,
          total: PIPELINE_STAGE_COUNT,
        });

      } catch (err) {
        pipeline.failStage(err.message);
        logger.error('stage_failed', {
          pipelineId: pipeline.id,
          stage: stage.name,
          error: err.message,
        });

        this.emit('stageFailed', { pipelineId: pipeline.id, stage: stage.name, error: err.message });

        // Attempt recovery with phi-backoff
        const recovered = await this._attemptStageRecovery(pipeline, stage, err);
        if (!recovered) break;
      }
    }

    pipeline.complete();
    this.activePipelines.delete(pipeline.id);
    this.completedPipelines.push(pipeline.toJSON());
    while (this.completedPipelines.length > this.maxCompleted) {
      this.completedPipelines.shift();
    }

    logger.info('pipeline_completed', {
      pipelineId: pipeline.id,
      status: pipeline.status,
      latencyMs: pipeline.latencyMs,
      stages: pipeline.stages.length,
    });

    this.emit('pipelineCompleted', pipeline.toJSON());
    return pipeline.toJSON();
  }

  async _attemptStageRecovery(pipeline, stage, error) {
    for (let attempt = 0; attempt < fib(5); attempt++) {
      const delay = phiBackoffWithJitter(attempt);
      await new Promise(resolve => setTimeout(resolve, delay));

      logger.info('stage_recovery_attempt', {
        pipelineId: pipeline.id,
        stage: stage.name,
        attempt: attempt + 1,
      });

      try {
        pipeline.advanceStage({ recovered: true, attempt: attempt + 1 });
        return true;
      } catch {
        continue;
      }
    }
    return false;
  }

  _emitHealth() {
    const health = {
      activePipelines: this.activePipelines.size,
      completedPipelines: this.completedPipelines.length,
      totalRouted: this.routeCount,
      totalPipelines: this.pipelineCount,
      stageCount: PIPELINE_STAGE_COUNT,
      timestamp: new Date().toISOString(),
    };

    this.emit('healthUpdate', health);
    logger.debug('conductor_health', health);
  }

  getPipelineStatus(pipelineId) {
    const active = this.activePipelines.get(pipelineId);
    if (active) return active.toJSON();
    return this.completedPipelines.find(p => p.id === pipelineId) || null;
  }

  getStatus() {
    return {
      activePipelines: this.activePipelines.size,
      completedPipelines: this.completedPipelines.length,
      totalRouted: this.routeCount,
      totalPipelines: this.pipelineCount,
      routingTable: Object.keys(ROUTING_TABLE),
      stageCount: PIPELINE_STAGE_COUNT,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { HeadyConductor, ROUTING_TABLE, HCFP_STAGES };
