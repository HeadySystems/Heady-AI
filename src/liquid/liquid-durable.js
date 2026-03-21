'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  PHI,
  PSI,
  PSI_SQ,
  fib,
  CSL_THRESHOLDS,
  PHI_TIMING,
  phiBackoffWithJitter
} = require('../../shared/phi-math');
const {
  createLogger
} = require('../../shared/logger');
const logger = createLogger('liquid-durable');

// Phi-scaled constants
const MAX_EVENT_HISTORY = fib(14); // 377 events
const HEARTBEAT_INTERVAL_MS = fib(8) * 1000; // 21s
const ACTIVITY_TIMEOUT_MS = fib(10) * 1000; // 55s
const MAX_ACTIVITY_RETRIES = fib(5); // 5
const CHECKPOINT_DIR = '/tmp/heady-durable';
const MAX_CONCURRENT_WORKFLOWS = fib(7); // 13

const WORKFLOW_STATES = Object.freeze({
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  TIMED_OUT: 'TIMED_OUT',
  CANCELLED: 'CANCELLED'
});
const EVENT_TYPES = Object.freeze({
  WORKFLOW_STARTED: 'WORKFLOW_STARTED',
  WORKFLOW_COMPLETED: 'WORKFLOW_COMPLETED',
  WORKFLOW_FAILED: 'WORKFLOW_FAILED',
  ACTIVITY_SCHEDULED: 'ACTIVITY_SCHEDULED',
  ACTIVITY_STARTED: 'ACTIVITY_STARTED',
  ACTIVITY_COMPLETED: 'ACTIVITY_COMPLETED',
  ACTIVITY_FAILED: 'ACTIVITY_FAILED',
  ACTIVITY_HEARTBEAT: 'ACTIVITY_HEARTBEAT',
  SIGNAL_RECEIVED: 'SIGNAL_RECEIVED',
  TIMER_STARTED: 'TIMER_STARTED',
  TIMER_FIRED: 'TIMER_FIRED',
  CHECKPOINT_SAVED: 'CHECKPOINT_SAVED'
});
class DurableEvent {
  constructor(type, payload, workflowId) {
    this.id = crypto.randomUUID();
    this.type = type;
    this.payload = payload;
    this.workflowId = workflowId;
    this.timestamp = Date.now();
    this.seq = 0; // set by workflow
  }
}
class WorkflowExecution {
  constructor(workflowId, workflowFn, input) {
    this.id = workflowId;
    this.state = WORKFLOW_STATES.PENDING;
    this.input = input;
    this.result = null;
    this.error = null;
    this.eventHistory = [];
    this.activities = new Map(); // activityId → { fn, result, state }
    this.signals = []; // pending signals
    this.timers = new Map(); // timerId → { durationMs, callback }
    this._workflowFn = workflowFn;
    this._seq = 0;
    this._heartbeatTimer = null;
    this.startedAt = null;
    this.completedAt = null;
    this.lastHeartbeat = null;
  }
  appendEvent(event) {
    event.seq = this._seq++;
    this.eventHistory.push(event);

    // Trim if too long
    if (this.eventHistory.length > MAX_EVENT_HISTORY) {
      this.eventHistory = this.eventHistory.slice(-Math.round(MAX_EVENT_HISTORY * PSI));
    }
  }
}
class LiquidDurable extends EventEmitter {
  constructor(config = {}) {
    super();
    this._workflows = new Map(); // workflowId → WorkflowExecution
    this._activityRegistry = new Map(); // activityName → function
    this._checkpointDir = config.checkpointDir || CHECKPOINT_DIR;

    // Ensure checkpoint directory exists
    try {
      if (!fs.existsSync(this._checkpointDir)) {
        fs.mkdirSync(this._checkpointDir, {
          recursive: true
        });
      }
    } catch (err) { logger.error('Recovered from error:', err); }
    this._metrics = {
      workflowsStarted: 0,
      workflowsCompleted: 0,
      workflowsFailed: 0,
      activitiesExecuted: 0,
      replaysPerformed: 0,
      signalsReceived: 0
    };
    logger.info({
      checkpointDir: this._checkpointDir
    }, 'LiquidDurable initialized');
  }

  // ── Register Activities ────────────────────────────────────────
  registerActivity(name, fn) {
    this._activityRegistry.set(name, fn);
    logger.debug({
      activity: name
    }, 'Activity registered');
  }

  // ── Start Workflow ─────────────────────────────────────────────
  async startWorkflow(workflowId, workflowFn, input = {}) {
    if (this._workflows.size >= MAX_CONCURRENT_WORKFLOWS) {
      throw new Error('HEADY-DUR-001: Max concurrent workflows reached');
    }

    // Check for existing checkpoint
    const checkpoint = this._loadCheckpoint(workflowId);
    if (checkpoint) {
      logger.info({
        workflowId
      }, 'Resuming from checkpoint');
      return this._replayWorkflow(workflowId, workflowFn, checkpoint);
    }
    const execution = new WorkflowExecution(workflowId, workflowFn, input);
    this._workflows.set(workflowId, execution);
    execution.state = WORKFLOW_STATES.RUNNING;
    execution.startedAt = Date.now();
    this._metrics.workflowsStarted++;
    execution.appendEvent(new DurableEvent(EVENT_TYPES.WORKFLOW_STARTED, {
      input
    }, workflowId));

    // Start heartbeat
    execution._heartbeatTimer = setInterval(() => {
      execution.lastHeartbeat = Date.now();
      execution.appendEvent(new DurableEvent(EVENT_TYPES.ACTIVITY_HEARTBEAT, {
        timestamp: Date.now()
      }, workflowId));
      this._saveCheckpoint(workflowId);
    }, HEARTBEAT_INTERVAL_MS);

    // Create workflow context
    const ctx = this._createContext(workflowId);
    try {
      const result = await workflowFn(ctx, input);
      execution.result = result;
      execution.state = WORKFLOW_STATES.COMPLETED;
      execution.completedAt = Date.now();
      this._metrics.workflowsCompleted++;
      execution.appendEvent(new DurableEvent(EVENT_TYPES.WORKFLOW_COMPLETED, {
        result
      }, workflowId));
      this.emit('workflow:completed', {
        workflowId,
        result
      });
      return result;
    } catch (e) {
      execution.error = e.message;
      execution.state = WORKFLOW_STATES.FAILED;
      execution.completedAt = Date.now();
      this._metrics.workflowsFailed++;
      execution.appendEvent(new DurableEvent(EVENT_TYPES.WORKFLOW_FAILED, {
        error: e.message
      }, workflowId));
      this.emit('workflow:failed', {
        workflowId,
        error: e.message
      });
      throw e;
    } finally {
      clearInterval(execution._heartbeatTimer);
      this._saveCheckpoint(workflowId);
    }
  }

  // ── Create Workflow Context ────────────────────────────────────
  _createContext(workflowId) {
    const execution = this._workflows.get(workflowId);
    const self = this;
    return {
      // Execute an activity (non-deterministic side effect)
      async executeActivity(name, input = {}, options = {}) {
        const activityId = crypto.randomUUID();
        const activityFn = self._activityRegistry.get(name);
        if (!activityFn) {
          throw new Error(`HEADY-DUR-002: Activity not registered: ${name}`);
        }

        // Check if this activity was already completed (replay mode)
        const existingResult = self._findActivityResult(workflowId, name, input);
        if (existingResult !== undefined) {
          logger.debug({
            activityId,
            name
          }, 'Replaying activity result');
          return existingResult;
        }
        execution.appendEvent(new DurableEvent(EVENT_TYPES.ACTIVITY_SCHEDULED, {
          activityId,
          name,
          input
        }, workflowId));
        const timeout = options.timeout || ACTIVITY_TIMEOUT_MS;
        const maxRetries = options.retries || MAX_ACTIVITY_RETRIES;
        let lastError;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            execution.appendEvent(new DurableEvent(EVENT_TYPES.ACTIVITY_STARTED, {
              activityId,
              name,
              attempt
            }, workflowId));
            const result = await Promise.race([activityFn(input), new Promise((_, reject) => setTimeout(() => reject(new Error('Activity timeout')), timeout))]);
            execution.appendEvent(new DurableEvent(EVENT_TYPES.ACTIVITY_COMPLETED, {
              activityId,
              name,
              result
            }, workflowId));
            self._metrics.activitiesExecuted++;
            self._saveCheckpoint(workflowId);
            return result;
          } catch (e) {
            lastError = e;
            execution.appendEvent(new DurableEvent(EVENT_TYPES.ACTIVITY_FAILED, {
              activityId,
              name,
              error: e.message,
              attempt
            }, workflowId));
            if (attempt < maxRetries - 1) {
              const delay = phiBackoffWithJitter(attempt);
              await new Promise(r => setTimeout(r, delay));
            }
          }
        }
        throw lastError;
      },
      // Wait for a signal (human approval, external event)
      async waitForSignal(signalName, timeoutMs = null) {
        return new Promise((resolve, reject) => {
          const handler = signal => {
            if (signal.name === signalName && signal.workflowId === workflowId) {
              execution.appendEvent(new DurableEvent(EVENT_TYPES.SIGNAL_RECEIVED, {
                signalName,
                data: signal.data
              }, workflowId));
              self._metrics.signalsReceived++;
              resolve(signal.data);
            }
          };
          self.on('signal', handler);
          if (timeoutMs) {
            setTimeout(() => {
              self.off('signal', handler);
              reject(new Error(`Signal timeout: ${signalName}`));
            }, timeoutMs);
          }
        });
      },
      // Sleep (durable — survives crashes)
      async sleep(ms) {
        const timerId = crypto.randomUUID();
        execution.appendEvent(new DurableEvent(EVENT_TYPES.TIMER_STARTED, {
          timerId,
          durationMs: ms
        }, workflowId));
        await new Promise(r => setTimeout(r, ms));
        execution.appendEvent(new DurableEvent(EVENT_TYPES.TIMER_FIRED, {
          timerId
        }, workflowId));
      },
      // Get workflow metadata
      get workflowId() {
        return workflowId;
      },
      get eventCount() {
        return execution.eventHistory.length;
      }
    };
  }

  // ── Signals ────────────────────────────────────────────────────
  sendSignal(workflowId, signalName, data = {}) {
    this.emit('signal', {
      workflowId,
      name: signalName,
      data,
      timestamp: Date.now()
    });
  }

  // ── Replay ─────────────────────────────────────────────────────
  async _replayWorkflow(workflowId, workflowFn, checkpoint) {
    this._metrics.replaysPerformed++;
    logger.info({
      workflowId,
      events: checkpoint.eventHistory.length
    }, 'Replaying workflow');
    const execution = new WorkflowExecution(workflowId, workflowFn, checkpoint.input);
    execution.eventHistory = checkpoint.eventHistory;
    execution._seq = checkpoint.eventHistory.length;
    this._workflows.set(workflowId, execution);

    // Resume from checkpoint
    return this.startWorkflow(workflowId, workflowFn, checkpoint.input);
  }
  _findActivityResult(workflowId, activityName, input) {
    const execution = this._workflows.get(workflowId);
    if (!execution) return undefined;

    // Search event history for completed activity with same name
    for (const event of execution.eventHistory) {
      if (event.type === EVENT_TYPES.ACTIVITY_COMPLETED && event.payload.name === activityName) {
        return event.payload.result;
      }
    }
    return undefined;
  }

  // ── Checkpoints ────────────────────────────────────────────────
  _saveCheckpoint(workflowId) {
    const execution = this._workflows.get(workflowId);
    if (!execution) return;
    try {
      const checkpoint = {
        workflowId,
        state: execution.state,
        input: execution.input,
        eventHistory: execution.eventHistory,
        savedAt: Date.now()
      };
      const filePath = path.join(this._checkpointDir, `${workflowId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(checkpoint), 'utf-8');
      execution.appendEvent(new DurableEvent(EVENT_TYPES.CHECKPOINT_SAVED, {
        filePath
      }, workflowId));
    } catch (e) {
      logger.error({
        workflowId,
        error: e.message
      }, 'Checkpoint save failed');
    }
  }
  _loadCheckpoint(workflowId) {
    try {
      const filePath = path.join(this._checkpointDir, `${workflowId}.json`);
      if (!fs.existsSync(filePath)) return null;
      const raw = fs.readFileSync(filePath, 'utf-8');
      const checkpoint = JSON.parse(raw);

      // Only resume non-completed workflows
      if (checkpoint.state === WORKFLOW_STATES.COMPLETED) return null;
      return checkpoint;
    } catch {
      return null;
    }
  }

  // ── Query ──────────────────────────────────────────────────────
  getWorkflow(workflowId) {
    const exec = this._workflows.get(workflowId);
    if (!exec) return null;
    return {
      id: exec.id,
      state: exec.state,
      input: exec.input,
      result: exec.result,
      error: exec.error,
      eventCount: exec.eventHistory.length,
      startedAt: exec.startedAt,
      completedAt: exec.completedAt,
      lastHeartbeat: exec.lastHeartbeat,
      durationMs: exec.completedAt ? exec.completedAt - exec.startedAt : Date.now() - (exec.startedAt || Date.now())
    };
  }
  getEventHistory(workflowId) {
    return this._workflows.get(workflowId)?.eventHistory || [];
  }
  listWorkflows() {
    return [...this._workflows.values()].map(w => ({
      id: w.id,
      state: w.state,
      eventCount: w.eventHistory.length,
      startedAt: w.startedAt
    }));
  }

  // ── Lifecycle ──────────────────────────────────────────────────
  async cancelWorkflow(workflowId) {
    const exec = this._workflows.get(workflowId);
    if (exec && exec.state === WORKFLOW_STATES.RUNNING) {
      exec.state = WORKFLOW_STATES.CANCELLED;
      clearInterval(exec._heartbeatTimer);
      this._saveCheckpoint(workflowId);
      this.emit('workflow:cancelled', {
        workflowId
      });
    }
  }
  get metrics() {
    return {
      ...this._metrics
    };
  }
}
module.exports = {
  LiquidDurable,
  WORKFLOW_STATES,
  EVENT_TYPES
};