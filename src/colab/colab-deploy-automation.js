'use strict';

const crypto = require('crypto');
const {
  PHI,
  PSI,
  PSI_SQ,
  fibonacci,
  phiBackoff,
  CSL_THRESHOLDS
} = require('../../shared/phi-math');
const {
  createLogger
} = require('../../shared/logger');
const logger = createLogger('colab-deploy');

// ─── Constants ──────────────────────────────────────────────────────────────
const RUNTIME_COUNT = 3;
const HEALTH_CHECK_INTERVAL = fibonacci(8) * 1000; // 21 seconds
const DEPLOY_TIMEOUT = fibonacci(13) * 1000; // 233 seconds
const RECONNECT_MAX_ATTEMPTS = fibonacci(6);
const ROLLING_DELAY = fibonacci(10) * 1000; // 55 seconds between deploys

// Runtime role assignments
const RUNTIME_ROLES = {
  PRIMARY: {
    id: 0,
    name: 'vector-ops',
    gpu: 'A100',
    priority: 'hot',
    resourceShare: 0.387
  },
  SECONDARY: {
    id: 1,
    name: 'llm-inference',
    gpu: 'A100',
    priority: 'warm',
    resourceShare: 0.239
  },
  TERTIARY: {
    id: 2,
    name: 'training',
    gpu: 'V100',
    priority: 'cold',
    resourceShare: 0.148
  }
};

// Runtime states
const RUNTIME_STATE = {
  IDLE: 'idle',
  DEPLOYING: 'deploying',
  RUNNING: 'running',
  DEGRADED: 'degraded',
  DISCONNECTED: 'disconnected',
  FAILED: 'failed'
};

/**
 * Runtime instance tracker
 */
class RuntimeInstance {
  constructor(role) {
    this.id = crypto.randomUUID();
    this.role = role;
    this.state = RUNTIME_STATE.IDLE;
    this.connectionId = null;
    this.deployedAt = null;
    this.lastHealthCheck = null;
    this.healthScore = 1.0;
    this.gpuUtilization = 0;
    this.memoryUtilization = 0;
    this.failureCount = 0;
    this.reconnectAttempts = 0;
    this.notebookId = null;
    this.metrics = {
      requestsServed: 0,
      avgLatencyMs: 0,
      uptime: 0
    };
  }
  updateHealth(health) {
    this.lastHealthCheck = Date.now();
    this.healthScore = health.score || this.healthScore;
    this.gpuUtilization = health.gpuUtilization || 0;
    this.memoryUtilization = health.memoryUtilization || 0;
    if (this.healthScore < CSL_THRESHOLDS.LOW) {
      this.state = RUNTIME_STATE.DEGRADED;
    } else if (this.state === RUNTIME_STATE.DEGRADED) {
      this.state = RUNTIME_STATE.RUNNING;
    }
  }
  toJSON() {
    return {
      id: this.id,
      role: this.role,
      state: this.state,
      connectionId: this.connectionId,
      deployedAt: this.deployedAt,
      lastHealthCheck: this.lastHealthCheck,
      healthScore: Math.round(this.healthScore * 1000) / 1000,
      gpuUtilization: Math.round(this.gpuUtilization * 1000) / 1000,
      memoryUtilization: Math.round(this.memoryUtilization * 1000) / 1000,
      failureCount: this.failureCount,
      notebookId: this.notebookId,
      metrics: this.metrics
    };
  }
}

/**
 * Deployment Plan — describes a rolling deployment
 */
class DeploymentPlan {
  constructor(runtimes, notebookTemplates) {
    this.id = crypto.randomUUID();
    this.createdAt = Date.now();
    this.runtimes = runtimes;
    this.notebookTemplates = notebookTemplates;
    this.steps = [];
    this.currentStep = 0;
    this.status = 'pending';
    this.errors = [];

    // Generate steps: deploy one runtime at a time (rolling)
    for (const [roleName, role] of Object.entries(RUNTIME_ROLES)) {
      this.steps.push({
        index: this.steps.length,
        action: 'deploy',
        runtime: roleName,
        role,
        status: 'pending',
        startedAt: null,
        completedAt: null,
        error: null
      });
    }
  }
  nextStep() {
    if (this.currentStep >= this.steps.length) return null;
    return this.steps[this.currentStep];
  }
  completeStep(success, error = null) {
    const step = this.steps[this.currentStep];
    if (!step) return;
    step.status = success ? 'completed' : 'failed';
    step.completedAt = Date.now();
    step.error = error;
    if (error) this.errors.push({
      step: this.currentStep,
      error
    });
    this.currentStep++;
  }
  isComplete() {
    return this.currentStep >= this.steps.length;
  }
  toJSON() {
    return {
      id: this.id,
      createdAt: this.createdAt,
      status: this.status,
      currentStep: this.currentStep,
      totalSteps: this.steps.length,
      steps: this.steps,
      errors: this.errors
    };
  }
}

/**
 * ColabDeployAutomation — Main deployment manager
 */
class ColabDeployAutomation {
  constructor(config = {}) {
    this.runtimes = new Map();
    this.colabBridge = config.colabBridge || null; // ColabBridge instance
    this.deploymentHistory = [];
    this.currentDeployment = null;
    this._healthInterval = null;
    this._initialized = false;

    // Initialize runtime instances
    for (const [roleName, role] of Object.entries(RUNTIME_ROLES)) {
      this.runtimes.set(roleName, new RuntimeInstance(role));
    }
    logger.info({
      runtimeCount: RUNTIME_COUNT,
      roles: Object.keys(RUNTIME_ROLES),
      msg: 'ColabDeployAutomation initialized'
    });
  }

  /**
   * Initialize — connect to existing runtimes or start fresh
   */
  async initialize() {
    if (this._initialized) return;

    // Start health monitoring
    this._healthInterval = setInterval(() => this._healthCheckAll(), HEALTH_CHECK_INTERVAL);
    this._initialized = true;
    logger.info({
      msg: 'ColabDeployAutomation ready'
    });
  }

  /**
   * Deploy all runtimes using rolling strategy
   */
  async deployAll(options = {}) {
    const {
      force = false,
      notebookTemplates = {}
    } = options;

    // Check if deployment is already in progress
    if (this.currentDeployment && this.currentDeployment.status === 'in_progress') {
      return {
        error: 'Deployment already in progress',
        deploymentId: this.currentDeployment.id
      };
    }
    const plan = new DeploymentPlan(Array.from(this.runtimes.values()), notebookTemplates);
    this.currentDeployment = plan;
    plan.status = 'in_progress';
    logger.info({
      deploymentId: plan.id,
      steps: plan.steps.length,
      msg: 'Rolling deployment started'
    });

    // Execute rolling deployment
    while (!plan.isComplete()) {
      const step = plan.nextStep();
      step.status = 'in_progress';
      step.startedAt = Date.now();
      const runtime = this.runtimes.get(step.runtime);
      if (!runtime) {
        plan.completeStep(false, 'Runtime not found');
        continue;
      }
      try {
        await this._deployRuntime(runtime, step.role, notebookTemplates[step.runtime]);
        plan.completeStep(true);
        logger.info({
          deploymentId: plan.id,
          step: step.index,
          runtime: step.runtime,
          msg: 'Runtime deployed successfully'
        });

        // Wait between deploys (rolling)
        if (!plan.isComplete()) {
          await this._sleep(ROLLING_DELAY);
        }
      } catch (err) {
        plan.completeStep(false, err.message);
        logger.error({
          deploymentId: plan.id,
          step: step.index,
          runtime: step.runtime,
          err: err.message,
          msg: 'Runtime deployment failed'
        });

        // Continue with next runtime unless force-stop
        if (!force) continue;
        plan.status = 'failed';
        break;
      }
    }
    plan.status = plan.errors.length > 0 ? 'partial' : 'completed';
    this.deploymentHistory.push(plan);

    // Keep last fib(8) = 21 deployments
    if (this.deploymentHistory.length > fibonacci(8)) {
      this.deploymentHistory.shift();
    }
    logger.info({
      deploymentId: plan.id,
      status: plan.status,
      errors: plan.errors.length,
      msg: 'Rolling deployment complete'
    });
    return plan.toJSON();
  }

  /**
   * Deploy a single runtime
   */
  async _deployRuntime(runtime, role, notebookTemplate = null) {
    runtime.state = RUNTIME_STATE.DEPLOYING;

    // Generate notebook content if not provided
    const notebook = notebookTemplate || this._generateNotebook(role);
    if (this.colabBridge) {
      // Use ColabBridge to deploy
      const result = await Promise.race([this.colabBridge.deployNotebook({
        notebook,
        gpu: role.gpu,
        runtimeType: 'pro_plus'
      }), this._timeout(DEPLOY_TIMEOUT)]);
      runtime.connectionId = result.connectionId;
      runtime.notebookId = result.notebookId;
    }
    runtime.state = RUNTIME_STATE.RUNNING;
    runtime.deployedAt = Date.now();
    runtime.failureCount = 0;
    runtime.reconnectAttempts = 0;
    runtime.healthScore = 1.0;
  }

  /**
   * Reconnect a disconnected runtime with phi-backoff
   */
  async reconnectRuntime(roleName) {
    const runtime = this.runtimes.get(roleName);
    if (!runtime) throw new Error(`Unknown runtime: ${roleName}`);
    runtime.state = RUNTIME_STATE.DISCONNECTED;
    for (let attempt = 0; attempt < RECONNECT_MAX_ATTEMPTS; attempt++) {
      runtime.reconnectAttempts++;
      try {
        logger.info({
          runtime: roleName,
          attempt: attempt + 1,
          maxAttempts: RECONNECT_MAX_ATTEMPTS,
          msg: 'Attempting runtime reconnect'
        });
        if (this.colabBridge && runtime.connectionId) {
          await this.colabBridge.reconnect(runtime.connectionId);
        }
        runtime.state = RUNTIME_STATE.RUNNING;
        runtime.reconnectAttempts = 0;
        logger.info({
          runtime: roleName,
          msg: 'Runtime reconnected'
        });
        return {
          success: true,
          attempts: attempt + 1
        };
      } catch (err) {
        const delay = phiBackoff(attempt);
        logger.warn({
          runtime: roleName,
          attempt: attempt + 1,
          delay,
          err: err.message,
          msg: 'Reconnect failed, backing off'
        });
        await this._sleep(delay);
      }
    }
    runtime.state = RUNTIME_STATE.FAILED;
    runtime.failureCount++;
    logger.error({
      runtime: roleName,
      attempts: RECONNECT_MAX_ATTEMPTS,
      msg: 'Runtime reconnect failed — marked as FAILED'
    });
    return {
      success: false,
      attempts: RECONNECT_MAX_ATTEMPTS
    };
  }

  /**
   * Health check all runtimes
   */
  async _healthCheckAll() {
    for (const [roleName, runtime] of this.runtimes) {
      if (runtime.state === RUNTIME_STATE.IDLE || runtime.state === RUNTIME_STATE.FAILED) continue;
      try {
        let health;
        if (this.colabBridge && runtime.connectionId) {
          health = await this.colabBridge.checkHealth(runtime.connectionId);
        } else {
          // Simulated health for testing
          health = {
            score: runtime.healthScore,
            gpuUtilization: runtime.gpuUtilization,
            memoryUtilization: runtime.memoryUtilization
          };
        }
        runtime.updateHealth(health);

        // Auto-reconnect if health drops below threshold
        if (runtime.healthScore < CSL_THRESHOLDS.MINIMUM && runtime.state !== RUNTIME_STATE.DISCONNECTED) {
          logger.warn({
            runtime: roleName,
            healthScore: runtime.healthScore,
            msg: 'Runtime health critical — triggering reconnect'
          });
          this.reconnectRuntime(roleName).catch(err => {
            logger.error({
              runtime: roleName,
              err: err.message,
              msg: 'Auto-reconnect failed'
            });
          });
        }
      } catch (err) {
        logger.warn({
          runtime: roleName,
          err: err.message,
          msg: 'Health check failed'
        });
        runtime.state = RUNTIME_STATE.DISCONNECTED;
      }
    }
  }

  /**
   * Generate a deployment notebook for a role
   */
  _generateNotebook(role) {
    const cells = [];

    // Setup cell
    cells.push({
      type: 'code',
      source: ['# Heady Runtime Setup — Auto-generated', `# Role: ${role.name}`, `# GPU: ${role.gpu}`, `# Resource Share: ${role.resourceShare}`, `# Priority Pool: ${role.priority}`, '', 'import os, json, time', 'import torch', 'import numpy as np', '', `RUNTIME_ROLE = "${role.name}"`, `RUNTIME_PRIORITY = "${role.priority}"`, `RESOURCE_SHARE = ${role.resourceShare}`, `EMBEDDING_DIM = 384`, `HNSW_M = ${fibonacci(8)}`, `PHI = ${PHI}`, `PSI = ${PSI}`, '', '# Verify GPU', 'device = torch.device("cuda" if torch.cuda.is_available() else "cpu")', 'print(json.dumps({"device": str(device), "cuda_available": torch.cuda.is_available(),', '  "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "none"}))'].join('\n')
    });

    // Role-specific cells
    if (role.name === 'vector-ops') {
      cells.push({
        type: 'code',
        source: ['# Vector Space Operations', 'from sentence_transformers import SentenceTransformer', '', 'model = SentenceTransformer("BAAI/bge-base-en-v1.5", device=device)', 'print(json.dumps({"model": "bge-base-en-v1.5", "dim": 384, "status": "loaded"}))'].join('\n')
      });
    } else if (role.name === 'llm-inference') {
      cells.push({
        type: 'code',
        source: ['# LLM Inference Setup', 'from transformers import AutoModelForCausalLM, AutoTokenizer', '', '# Model will be loaded on-demand based on task requirements', 'print(json.dumps({"role": "llm-inference", "status": "ready"}))'].join('\n')
      });
    } else if (role.name === 'training') {
      cells.push({
        type: 'code',
        source: ['# Training & Fine-tuning Setup', 'from transformers import Trainer, TrainingArguments', '', 'print(json.dumps({"role": "training", "status": "ready"}))'].join('\n')
      });
    }

    // Health endpoint cell
    cells.push({
      type: 'code',
      source: ['# Health Reporting', 'import psutil', '', 'def get_health():', '    gpu_util = 0', '    gpu_mem = 0', '    if torch.cuda.is_available():', '        gpu_mem = torch.cuda.memory_allocated() / torch.cuda.get_device_properties(0).total_mem', '    return {', '        "status": "healthy",', `        "role": RUNTIME_ROLE,`, '        "gpu_utilization": gpu_util,', '        "memory_utilization": gpu_mem,', '        "cpu_percent": psutil.cpu_percent(),', '        "ram_percent": psutil.virtual_memory().percent / 100,', '        "score": 1.0 - max(gpu_mem, psutil.virtual_memory().percent / 100) * 0.382', '    }', '', 'print(json.dumps(get_health()))'].join('\n')
    });
    return {
      cells,
      role: role.name
    };
  }

  // ─── Utility ──────────────────────────────────────────────────────────

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  _timeout(ms) {
    return new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms));
  }

  // ─── Status & Health ──────────────────────────────────────────────────

  status() {
    const runtimeStatus = {};
    for (const [name, runtime] of this.runtimes) {
      runtimeStatus[name] = runtime.toJSON();
    }
    return {
      service: 'colab-deploy-automation',
      initialized: this._initialized,
      runtimes: runtimeStatus,
      currentDeployment: this.currentDeployment?.toJSON() || null,
      deploymentHistory: this.deploymentHistory.length,
      overallHealth: this._overallHealth()
    };
  }
  _overallHealth() {
    const runtimes = Array.from(this.runtimes.values());
    const running = runtimes.filter(r => r.state === RUNTIME_STATE.RUNNING).length;
    const total = runtimes.length;
    const avgHealth = runtimes.reduce((s, r) => s + r.healthScore, 0) / total;
    return {
      status: running === total ? 'healthy' : running > 0 ? 'degraded' : 'down',
      runningRuntimes: running,
      totalRuntimes: total,
      averageHealth: Math.round(avgHealth * 1000) / 1000
    };
  }
  async shutdown() {
    if (this._healthInterval) clearInterval(this._healthInterval);
    logger.info({
      msg: 'ColabDeployAutomation shut down'
    });
  }
}
module.exports = {
  ColabDeployAutomation,
  RuntimeInstance,
  DeploymentPlan,
  RUNTIME_ROLES,
  RUNTIME_STATE
};