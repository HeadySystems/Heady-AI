/**
 * Heady™ LiquidSOP v1.0
 * Structured Output Protocol — typed artifacts between agents
 * Absorbed from: MetaGPT (ICLR 2024, 85.9% HumanEval)
 *
 * Encodes real-world SOPs into agent prompts. Agents communicate through
 * structured typed outputs (PRDs, design docs, API specs, test plans)
 * rather than free-form text — dramatically reducing hallucination cascading.
 * Publish-subscribe message pool for coordination.
 *
 * @author Eric Haywood — HeadySystems Inc.
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');
const {
  PHI, PSI, fib,
  CSL_THRESHOLDS,
} = require('../../shared/phi-math');
const { createLogger } = require('../../shared/logger');

const logger = createLogger('liquid-sop');

// SOP role definitions (MetaGPT pattern)
const SOP_ROLES = Object.freeze({
  PM:               'PM',              // Product Manager — PRDs, user stories
  ARCHITECT:        'ARCHITECT',       // System design, API specs, data models
  PROJECT_MANAGER:  'PROJECT_MANAGER', // Task breakdown, dependency DAGs, timelines
  ENGINEER:         'ENGINEER',        // Implementation code, migrations
  QA:               'QA',              // Test plans, test cases, coverage reports
  REVIEWER:         'REVIEWER',        // Code review, security audit, compliance
  DEPLOYER:         'DEPLOYER',        // Deploy scripts, rollout plans, runbooks
});

// Artifact types with JSON schemas
const ARTIFACT_TYPES = Object.freeze({
  PRD:            'PRD',
  DESIGN_DOC:     'DESIGN_DOC',
  API_SPEC:       'API_SPEC',
  DATA_MODEL:     'DATA_MODEL',
  TASK_DAG:       'TASK_DAG',
  CODE_CHANGE:    'CODE_CHANGE',
  TEST_PLAN:      'TEST_PLAN',
  TEST_RESULTS:   'TEST_RESULTS',
  REVIEW_REPORT:  'REVIEW_REPORT',
  DEPLOY_PLAN:    'DEPLOY_PLAN',
  RUNBOOK:        'RUNBOOK',
  STATUS_REPORT:  'STATUS_REPORT',
});

const MAX_ARTIFACTS = fib(13);        // 233
const MAX_SUBSCRIBERS = fib(8);       // 21
const PIPELINE_TIMEOUT_MS = fib(10) * 1000; // 55s per stage

class SOPArtifact {
  constructor(type, content, metadata = {}) {
    this.id = crypto.randomUUID();
    this.type = type;
    this.content = content;           // structured JSON, not free-form text
    this.producerRole = metadata.role || null;
    this.producerId = metadata.agentId || null;
    this.version = metadata.version || 1;
    this.hash = crypto.createHash('sha256')
      .update(JSON.stringify(content)).digest('hex').slice(0, 16);
    this.timestamp = Date.now();
    this.validationErrors = [];
    this.status = 'PENDING';          // PENDING → VALIDATED → CONSUMED → SUPERSEDED
  }

  validate(schema) {
    // Schema validation — ensures structured, not free-form
    const errors = [];
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in this.content)) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }
    this.validationErrors = errors;
    this.status = errors.length === 0 ? 'VALIDATED' : 'INVALID';
    return errors.length === 0;
  }
}

class SOPMessagePool extends EventEmitter {
  constructor() {
    super();
    this._artifacts = new Map();        // artifactId → SOPArtifact
    this._subscriptions = new Map();    // artifactType → Set<callback>
    this._typeIndex = new Map();        // artifactType → Array<artifactId>
    this._roleIndex = new Map();        // role → Array<artifactId>
  }

  publish(artifact) {
    if (this._artifacts.size >= MAX_ARTIFACTS) {
      this._evictOldest();
    }

    this._artifacts.set(artifact.id, artifact);

    // Index by type
    if (!this._typeIndex.has(artifact.type)) this._typeIndex.set(artifact.type, []);
    this._typeIndex.get(artifact.type).push(artifact.id);

    // Index by role
    if (artifact.producerRole) {
      if (!this._roleIndex.has(artifact.producerRole)) this._roleIndex.set(artifact.producerRole, []);
      this._roleIndex.get(artifact.producerRole).push(artifact.id);
    }

    // Notify subscribers
    const subs = this._subscriptions.get(artifact.type);
    if (subs) {
      for (const cb of subs) {
        try { cb(artifact); } catch (e) {
          logger.error({ type: artifact.type, error: e.message }, 'Subscriber error');
        }
      }
    }

    this.emit('artifact:published', { id: artifact.id, type: artifact.type });
    return artifact;
  }

  subscribe(artifactType, callback) {
    if (!this._subscriptions.has(artifactType)) {
      this._subscriptions.set(artifactType, new Set());
    }
    const subs = this._subscriptions.get(artifactType);
    if (subs.size >= MAX_SUBSCRIBERS) {
      throw new Error('HEADY-SOP-001: Max subscribers per type reached');
    }
    subs.add(callback);
    return () => subs.delete(callback);
  }

  getLatest(artifactType) {
    const ids = this._typeIndex.get(artifactType);
    if (!ids || ids.length === 0) return null;
    return this._artifacts.get(ids[ids.length - 1]);
  }

  getByRole(role) {
    const ids = this._roleIndex.get(role) || [];
    return ids.map(id => this._artifacts.get(id)).filter(Boolean);
  }

  getAll(artifactType) {
    const ids = this._typeIndex.get(artifactType) || [];
    return ids.map(id => this._artifacts.get(id)).filter(Boolean);
  }

  _evictOldest() {
    const oldest = [...this._artifacts.entries()]
      .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    if (oldest) this._artifacts.delete(oldest[0]);
  }
}

// SOP Pipeline — orchestrates role-based artifact flow
class LiquidSOP extends EventEmitter {
  constructor(config = {}) {
    super();
    this._pool = new SOPMessagePool();
    this._roleHandlers = new Map();     // role → async handler function
    this._schemas = new Map();          // artifactType → validation schema
    this._pipelines = new Map();        // pipelineId → { stages, status }

    // Register default schemas
    this._registerDefaultSchemas();

    this._metrics = {
      pipelinesRun: 0,
      artifactsProduced: 0,
      validationFailures: 0,
      avgPipelineMs: 0,
      _pipelineTimeSum: 0,
    };

    logger.info('LiquidSOP initialized');
  }

  // ── Role Registration ──────────────────────────────────────────
  registerRole(role, handler) {
    this._roleHandlers.set(role, handler);
    logger.debug({ role }, 'SOP role registered');
  }

  registerSchema(artifactType, schema) {
    this._schemas.set(artifactType, schema);
  }

  // ── Run SOP Pipeline ──────────────────────────────────────────
  async runPipeline(request, stages = null) {
    const pipelineId = crypto.randomUUID();
    const start = Date.now();

    const defaultStages = [
      { role: SOP_ROLES.PM, produces: ARTIFACT_TYPES.PRD, consumes: [] },
      { role: SOP_ROLES.ARCHITECT, produces: ARTIFACT_TYPES.DESIGN_DOC, consumes: [ARTIFACT_TYPES.PRD] },
      { role: SOP_ROLES.PROJECT_MANAGER, produces: ARTIFACT_TYPES.TASK_DAG, consumes: [ARTIFACT_TYPES.PRD, ARTIFACT_TYPES.DESIGN_DOC] },
      { role: SOP_ROLES.ENGINEER, produces: ARTIFACT_TYPES.CODE_CHANGE, consumes: [ARTIFACT_TYPES.DESIGN_DOC, ARTIFACT_TYPES.TASK_DAG] },
      { role: SOP_ROLES.QA, produces: ARTIFACT_TYPES.TEST_RESULTS, consumes: [ARTIFACT_TYPES.CODE_CHANGE, ARTIFACT_TYPES.DESIGN_DOC] },
      { role: SOP_ROLES.REVIEWER, produces: ARTIFACT_TYPES.REVIEW_REPORT, consumes: [ARTIFACT_TYPES.CODE_CHANGE, ARTIFACT_TYPES.TEST_RESULTS] },
    ];

    const pipeline = stages || defaultStages;
    this._pipelines.set(pipelineId, { stages: pipeline, status: 'RUNNING' });
    this._metrics.pipelinesRun++;

    this.emit('pipeline:start', { pipelineId, stageCount: pipeline.length });

    for (const stage of pipeline) {
      const handler = this._roleHandlers.get(stage.role);
      if (!handler) {
        logger.warn({ role: stage.role }, 'No handler for role — skipping');
        continue;
      }

      // Gather consumed artifacts
      const inputs = {};
      for (const dep of stage.consumes) {
        inputs[dep] = this._pool.getLatest(dep);
      }

      try {
        const output = await Promise.race([
          handler(request, inputs, stage),
          new Promise((_, rej) => setTimeout(() => rej(new Error('Stage timeout')), PIPELINE_TIMEOUT_MS)),
        ]);

        const artifact = new SOPArtifact(stage.produces, output, {
          role: stage.role,
          agentId: `sop-${stage.role.toLowerCase()}`,
        });

        // Validate against schema
        const schema = this._schemas.get(stage.produces);
        if (schema && !artifact.validate(schema)) {
          this._metrics.validationFailures++;
          logger.warn({ type: stage.produces, errors: artifact.validationErrors }, 'Artifact validation failed');
        }

        this._pool.publish(artifact);
        this._metrics.artifactsProduced++;

        this.emit('stage:complete', { pipelineId, role: stage.role, artifactId: artifact.id });

      } catch (e) {
        logger.error({ pipelineId, role: stage.role, error: e.message }, 'Stage failed');
        this.emit('stage:failed', { pipelineId, role: stage.role, error: e.message });
      }
    }

    const elapsed = Date.now() - start;
    this._metrics._pipelineTimeSum += elapsed;
    this._metrics.avgPipelineMs = this._metrics._pipelineTimeSum / this._metrics.pipelinesRun;

    this._pipelines.get(pipelineId).status = 'COMPLETED';
    this.emit('pipeline:complete', { pipelineId, elapsed });

    return {
      pipelineId,
      artifacts: [...this._pool._artifacts.values()]
        .filter(a => a.timestamp >= start)
        .map(a => ({ id: a.id, type: a.type, status: a.status, role: a.producerRole })),
      elapsed,
    };
  }

  // ── Default Schemas ────────────────────────────────────────────
  _registerDefaultSchemas() {
    this._schemas.set(ARTIFACT_TYPES.PRD, {
      required: ['title', 'objectives', 'requirements'],
    });
    this._schemas.set(ARTIFACT_TYPES.DESIGN_DOC, {
      required: ['architecture', 'components', 'dataModel'],
    });
    this._schemas.set(ARTIFACT_TYPES.API_SPEC, {
      required: ['endpoints', 'authentication'],
    });
    this._schemas.set(ARTIFACT_TYPES.TASK_DAG, {
      required: ['tasks', 'dependencies'],
    });
    this._schemas.set(ARTIFACT_TYPES.CODE_CHANGE, {
      required: ['files', 'description'],
    });
    this._schemas.set(ARTIFACT_TYPES.TEST_PLAN, {
      required: ['testCases', 'coverage'],
    });
  }

  // ── Query ──────────────────────────────────────────────────────
  get pool() { return this._pool; }
  get metrics() { return { ...this._metrics }; }
}

module.exports = { LiquidSOP, SOPArtifact, SOPMessagePool, SOP_ROLES, ARTIFACT_TYPES };
