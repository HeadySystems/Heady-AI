/**
 * KRONOS Agent — Task Lifecycle Manager Bee
 * P0 Priority | Hot Pool
 * Mission: SEP-1686 task state, retry, expiry
 * From: Dropzone/10-Incoming audit manifests
 */
'use strict';
const logger = require('../utils/logger') || console;

const PHI = 1.618033988749895;
const MAX_RETRIES = 5;
const BASE_RETRY_MS = 1000;

const TaskState = {
const logger = require('../utils/logger');
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  RETRYING: 'retrying'
};

class KronosAgent {
  constructor(opts = {}) {
    this.name = 'KRONOS';
    this.type = 'bee';
    this.pool = 'hot';
    this.version = '1.0.0';
    this.tasks = new Map();
    this.maxRetries = opts.maxRetries || MAX_RETRIES;
    this.taskStore = opts.taskStore || null; // D1/KV backing
    this._expiryInterval = null;
    this._metrics = { created: 0, completed: 0, failed: 0, retried: 0, expired: 0 };
  }

  async start() {
    this._expiryInterval = setInterval(() => this._expireTasks(), Math.round(30000 * PHI));
    logger.info(`[KRONOS] Task lifecycle manager active | maxRetries=${this.maxRetries}`);
    return { status: 'active', agent: this.name };
  }

  async stop() {
    if (this._expiryInterval) clearInterval(this._expiryInterval);
    logger.info('[KRONOS] Shutdown complete');
  }

  /** Create a new task (SEP-1686 compliant) */
  async createTask(taskDef) {
    const taskId = `kt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const task = {
      id: taskId,
      type: taskDef.type || 'generic',
      state: TaskState.PENDING,
      input: taskDef.input || {},
      output: null,
      error: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: taskDef.ttlMs ? Date.now() + taskDef.ttlMs : Date.now() + Math.round(3600000 * PHI),
      retryCount: 0,
      maxRetries: taskDef.maxRetries || this.maxRetries,
      metadata: taskDef.metadata || {},
      history: [{ state: TaskState.PENDING, timestamp: Date.now() }]
    };
    this.tasks.set(taskId, task);
    this._metrics.created++;
    if (this.taskStore) await this._persist(task);
    return task;
  }

  /** Transition task state */
  async transitionTask(taskId, newState, payload = {}) {
    const task = await this._getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const validTransitions = {
      [TaskState.PENDING]: [TaskState.RUNNING, TaskState.CANCELLED],
      [TaskState.RUNNING]: [TaskState.COMPLETED, TaskState.FAILED, TaskState.CANCELLED],
      [TaskState.FAILED]: [TaskState.RETRYING, TaskState.CANCELLED],
      [TaskState.RETRYING]: [TaskState.RUNNING, TaskState.CANCELLED],
      [TaskState.COMPLETED]: [],
      [TaskState.CANCELLED]: [],
      [TaskState.EXPIRED]: []
    };

    if (!validTransitions[task.state]?.includes(newState)) {
      throw new Error(`Invalid transition: ${task.state} → ${newState}`);
    }

    task.state = newState;
    task.updatedAt = Date.now();
    task.history.push({ state: newState, timestamp: Date.now(), ...payload });

    if (newState === TaskState.COMPLETED) {
      task.output = payload.output || null;
      this._metrics.completed++;
    } else if (newState === TaskState.FAILED) {
      task.error = payload.error || 'unknown_error';
      this._metrics.failed++;
      // Auto-retry with φ-scaled backoff
      if (task.retryCount < task.maxRetries) {
        const delay = Math.round(BASE_RETRY_MS * Math.pow(PHI, task.retryCount));
        task.retryCount++;
        this._metrics.retried++;
        setTimeout(() => this.transitionTask(taskId, TaskState.RETRYING), delay);
      }
    } else if (newState === TaskState.RETRYING) {
      setTimeout(() => this.transitionTask(taskId, TaskState.RUNNING), typeof phiMs === 'function' ? phiMs(100) : 100);
    }

    this.tasks.set(taskId, task);
    if (this.taskStore) await this._persist(task);
    return task;
  }

  /** Get task status */
  async getTask(taskId) {
    return this._getTask(taskId);
  }

  /** List tasks with optional filters */
  async listTasks(filters = {}) {
    let tasks = Array.from(this.tasks.values());
    if (filters.state) tasks = tasks.filter(t => t.state === filters.state);
    if (filters.type) tasks = tasks.filter(t => t.type === filters.type);
    if (filters.limit) tasks = tasks.slice(0, filters.limit);
    return tasks;
  }

  /** Health check */
  health() {
    const tasksByState = {};
    for (const t of this.tasks.values()) {
      tasksByState[t.state] = (tasksByState[t.state] || 0) + 1;
    }
    return {
      agent: this.name,
      status: 'healthy',
      totalTasks: this.tasks.size,
      tasksByState,
      metrics: { ...this._metrics },
      uptime: process.uptime()
    };
  }

  // ── Internal ──

  async _getTask(taskId) {
    let task = this.tasks.get(taskId);
    if (!task && this.taskStore) {
      const raw = await this.taskStore.get(`task:${taskId}`);
      if (raw) { task = JSON.parse(raw); this.tasks.set(taskId, task); }
    }
    return task || null;
  }

  async _persist(task) {
    if (this.taskStore) {
      const ttl = Math.max(1, Math.round((task.expiresAt - Date.now()) / 1000));
      await this.taskStore.put(`task:${task.id}`, JSON.stringify(task), { expirationTtl: ttl });
    }
  }

  _expireTasks() {
    const now = Date.now();
    let expired = 0;
    for (const [id, task] of this.tasks) {
      if (now > task.expiresAt && ![TaskState.COMPLETED, TaskState.CANCELLED, TaskState.EXPIRED].includes(task.state)) {
        task.state = TaskState.EXPIRED;
        task.updatedAt = now;
        task.history.push({ state: TaskState.EXPIRED, timestamp: now, reason: 'ttl_exceeded' });
        this.tasks.set(id, task);
        expired++;
        this._metrics.expired++;
      }
    }
    if (expired > 0) logger.info(`[KRONOS] Expired ${expired} tasks`);
  }
}

module.exports = { KronosAgent, TaskState };
