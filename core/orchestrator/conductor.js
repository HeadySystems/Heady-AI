/**
 * Heady™ Conductor — Unified Task Router & Agent Coordinator
 * ═══════════════════════════════════════════════════════════
 *
 * Consolidates:
 *   1. src/hc_orchestrator.js          → Workflow execution engine
 *   2. src/agents/agent-orchestrator.js → Agent lifecycle & dispatch
 *   3. src/orchestration/heady-conductor.js → Task routing (bee coordinator)
 *
 * Architecture:
 *   Conductor owns agent lifecycle + task routing + workflow execution.
 *   Agents register with capabilities and get circuit breakers.
 *   Tasks route to agents via category/domain matching or explicit targeting.
 *   Workflows decompose into task graphs with dependency resolution.
 *
 * @module core/orchestrator/conductor
 */
'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');
const { PHI, PSI, CSL, TIMING, fib, phiBackoffWithJitter, cslGate, cosineSimilarity } = require('../constants/phi');
const { CircuitBreaker, CircuitBreakerPool } = require('../infrastructure/circuit-breaker');
const { WorkerPool } = require('../infrastructure/worker-pool');

// ─── Agent States ──────────────────────────────────────────────────────────────

const AGENT_STATE = {
  IDLE:     'IDLE',
  BUSY:     'BUSY',
  ERROR:    'ERROR',
  OFFLINE:  'OFFLINE',
  STARTING: 'STARTING',
  DRAINING: 'DRAINING',
};

// ─── Task Priority ─────────────────────────────────────────────────────────────

const PRIORITY = {
  LOW:      0,
  STANDARD: 1,
  HIGH:     2,
  CRITICAL: 3,
  ADMIN:    4,   // "God Mode" — bypasses capacity checks
};

// ─── Conductor ─────────────────────────────────────────────────────────────────

class Conductor extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {number} [opts.maxConcurrentTasks] - Global task concurrency (default: fib(8)=21)
   * @param {number} [opts.taskTimeoutMs]      - Default task timeout (default: TIMING.LONG)
   * @param {number} [opts.heartbeatMs]        - Heartbeat interval (default: PHI^5 * 1000 ≈ 11,090ms)
   * @param {number} [opts.staleThresholdMs]   - Stale execution threshold (default: 60_000)
   */
  constructor(opts = {}) {
    super();
    this.maxConcurrentTasks = opts.maxConcurrentTasks ?? fib(8);   // 21
    this.taskTimeoutMs      = opts.taskTimeoutMs      ?? TIMING.LONG;
    this.heartbeatMs        = opts.heartbeatMs        ?? Math.round(Math.pow(PHI, 5) * 1000); // ~11,090ms
    this.staleThresholdMs   = opts.staleThresholdMs   ?? 60_000;

    // Agent registry: name → { config, state, metrics, breaker }
    this._agents = new Map();

    // Task execution
    this._pool = new WorkerPool('conductor', { maxConcurrent: this.maxConcurrentTasks });
    this._activeExecutions = new Map();  // execId → { agentName, taskType, startedAt }
    this._executionLog = [];             // Recent execution records (capped)

    // Heartbeat
    this._heartbeatTimer = null;

    // Metrics
    this.totalDispatched = 0;
    this.totalCompleted = 0;
    this.totalFailed = 0;
    this.startTime = Date.now();
  }

  // ─── Agent Lifecycle ──────────────────────────────────────────────────────

  /**
   * Register an agent with the conductor.
   * @param {string} name - Unique agent identifier
   * @param {object} config
   * @param {string[]} [config.categories]   - Task categories this agent handles
   * @param {string[]} [config.domains]      - Domains this agent specializes in
   * @param {function} [config.handler]      - async (task) => result
   * @param {string}   [config.endpoint]     - HTTP endpoint for remote agents
   * @param {number}   [config.maxConcurrent] - Agent-level concurrency limit
   * @param {string}   [config.modelTier]    - Model tier (fast, standard, premium)
   * @param {object}   [config.metadata]     - Additional metadata
   */
  registerAgent(name, config = {}) {
    if (this._agents.has(name)) {
      throw new Error(`Agent ${name} already registered`);
    }

    const agent = {
      name,
      config: {
        categories: config.categories || [],
        domains: config.domains || [],
        handler: config.handler || null,
        endpoint: config.endpoint || null,
        maxConcurrent: config.maxConcurrent ?? fib(4),  // 3
        modelTier: config.modelTier || 'standard',
        metadata: config.metadata || {},
      },
      state: AGENT_STATE.IDLE,
      activeTasks: 0,
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        totalLatencyMs: 0,
        lastActiveAt: null,
      },
      breaker: new CircuitBreaker(name, {
        failureThreshold: fib(4),       // 3
        resetTimeoutMs: TIMING.IDLE,    // ~12,944ms
      }),
    };

    this._agents.set(name, agent);
    this.emit('agent:registered', { name, categories: agent.config.categories });
    return this;
  }

  /** Unregister an agent */
  removeAgent(name) {
    const agent = this._agents.get(name);
    if (!agent) return false;
    if (agent.activeTasks > 0) {
      agent.state = AGENT_STATE.DRAINING;
      return false; // Can't remove while active
    }
    this._agents.delete(name);
    this.emit('agent:removed', { name });
    return true;
  }

  /** Get all registered agent names */
  getAgentNames() {
    return [...this._agents.keys()];
  }

  // ─── Task Dispatch ────────────────────────────────────────────────────────

  /**
   * Dispatch a task to the best-matched agent.
   * @param {object} task
   * @param {string} task.type     - Task type identifier
   * @param {object} task.payload  - Task data
   * @param {string} [task.agent]  - Explicitly target an agent
   * @param {string} [task.category] - Category for routing
   * @param {string} [task.domain]   - Domain for routing
   * @param {number} [task.priority] - Priority level (default: STANDARD)
   * @param {number} [task.timeoutMs] - Override timeout
   * @returns {Promise<object>} Task result
   */
  async dispatch(task) {
    const execId = `exec_${crypto.randomBytes(6).toString('hex')}`;
    const priority = task.priority ?? PRIORITY.STANDARD;
    const timeoutMs = task.timeoutMs ?? this.taskTimeoutMs;

    // Find target agent
    const agentName = task.agent || this._routeTask(task);
    if (!agentName) {
      throw new Error(`No agent available for task type: ${task.type}`);
    }

    const agent = this._agents.get(agentName);
    if (!agent) {
      throw new Error(`Agent not found: ${agentName}`);
    }

    // Capacity check (skip for ADMIN priority)
    if (priority < PRIORITY.ADMIN && agent.activeTasks >= agent.config.maxConcurrent) {
      throw new Error(`Agent ${agentName} at capacity (${agent.activeTasks}/${agent.config.maxConcurrent})`);
    }

    // Track execution
    this._activeExecutions.set(execId, {
      agentName,
      taskType: task.type,
      startedAt: Date.now(),
      priority,
    });
    this.totalDispatched++;
    agent.activeTasks++;
    agent.state = AGENT_STATE.BUSY;

    try {
      const result = await this._pool.submit(async () => {
        return agent.breaker.execute(async () => {
          return Promise.race([
            this._executeAgent(agent, task),
            this._timeout(timeoutMs, `task:${task.type}@${agentName}`),
          ]);
        });
      }, execId);

      // Success
      const elapsed = Date.now() - this._activeExecutions.get(execId).startedAt;
      agent.metrics.tasksCompleted++;
      agent.metrics.totalLatencyMs += elapsed;
      agent.metrics.lastActiveAt = Date.now();
      this.totalCompleted++;

      this._logExecution(execId, agentName, task.type, 'ok', elapsed);
      this.emit('task:complete', { execId, agentName, taskType: task.type, elapsed });

      return result;

    } catch (err) {
      const elapsed = Date.now() - (this._activeExecutions.get(execId)?.startedAt || Date.now());
      agent.metrics.tasksFailed++;
      agent.metrics.lastActiveAt = Date.now();
      this.totalFailed++;

      this._logExecution(execId, agentName, task.type, 'failed', elapsed, err.message);
      this.emit('task:failed', { execId, agentName, taskType: task.type, error: err.message });

      throw err;

    } finally {
      agent.activeTasks--;
      if (agent.activeTasks === 0) {
        agent.state = agent.state === AGENT_STATE.DRAINING
          ? AGENT_STATE.OFFLINE
          : AGENT_STATE.IDLE;
      }
      this._activeExecutions.delete(execId);
    }
  }

  /**
   * Dispatch multiple tasks, resolving dependencies.
   * Tasks run in parallel where possible, sequential where dependencies exist.
   * @param {object[]} tasks - Array of tasks with optional `dependsOn` field
   * @returns {Promise<Map<string, object>>} Results keyed by task type
   */
  async dispatchWorkflow(tasks) {
    const results = new Map();
    const completed = new Set();

    // Group by dependency depth
    const layers = this._resolveDependencyLayers(tasks);

    for (const layer of layers) {
      const layerResults = await Promise.allSettled(
        layer.map(task => this.dispatch({
          ...task,
          payload: {
            ...task.payload,
            // Inject dependency results
            _deps: Object.fromEntries(
              (task.dependsOn || []).map(dep => [dep, results.get(dep)])
            ),
          },
        }))
      );

      for (let i = 0; i < layer.length; i++) {
        const task = layer[i];
        const result = layerResults[i];
        if (result.status === 'fulfilled') {
          results.set(task.type, result.value);
          completed.add(task.type);
        } else {
          results.set(task.type, { error: result.reason?.message });
        }
      }
    }

    return results;
  }

  // ─── Routing ──────────────────────────────────────────────────────────────

  /** Find the best agent for a task via category/domain matching */
  _routeTask(task) {
    let bestAgent = null;
    let bestScore = -1;

    for (const [name, agent] of this._agents) {
      if (agent.state === AGENT_STATE.OFFLINE || agent.state === AGENT_STATE.DRAINING) continue;
      if (!agent.breaker.canRequest()) continue;
      if (agent.activeTasks >= agent.config.maxConcurrent) continue;

      let score = 0;

      // Category match
      if (task.category && agent.config.categories.includes(task.category)) {
        score += PHI;  // 1.618 — strong signal
      }

      // Domain match
      if (task.domain && agent.config.domains.includes(task.domain)) {
        score += 1;
      }

      // Prefer less loaded agents
      const loadFactor = 1 - (agent.activeTasks / agent.config.maxConcurrent);
      score += loadFactor * PSI;  // 0.618 weight for availability

      // Prefer agents with better success rates
      const total = agent.metrics.tasksCompleted + agent.metrics.tasksFailed;
      if (total > 0) {
        const successRate = agent.metrics.tasksCompleted / total;
        score += successRate * PSI;  // 0.618 weight for reliability
      }

      if (score > bestScore) {
        bestScore = score;
        bestAgent = name;
      }
    }

    return bestAgent;
  }

  // ─── Agent Execution ──────────────────────────────────────────────────────

  async _executeAgent(agent, task) {
    // Local handler
    if (agent.config.handler) {
      return agent.config.handler(task);
    }

    // Remote endpoint
    if (agent.config.endpoint) {
      return this._callRemoteAgent(agent, task);
    }

    // No handler — passthrough
    return { status: 'passthrough', taskType: task.type };
  }

  async _callRemoteAgent(agent, task) {
    // HTTP call to agent endpoint (abstract — replaced by actual HTTP client in production)
    const url = `${agent.config.endpoint}/execute`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: task.type, payload: task.payload }),
        signal: AbortSignal.timeout(this.taskTimeoutMs),
      });
      if (!response.ok) throw new Error(`Agent ${agent.name} returned ${response.status}`);
      return response.json();
    } catch (err) {
      throw new Error(`Remote agent ${agent.name} failed: ${err.message}`);
    }
  }

  // ─── Dependency Resolution ────────────────────────────────────────────────

  _resolveDependencyLayers(tasks) {
    const taskMap = new Map(tasks.map(t => [t.type, t]));
    const layers = [];
    const placed = new Set();

    while (placed.size < tasks.length) {
      const layer = [];
      for (const task of tasks) {
        if (placed.has(task.type)) continue;
        const deps = task.dependsOn || [];
        if (deps.every(d => placed.has(d))) {
          layer.push(task);
        }
      }
      if (layer.length === 0) {
        // Circular dependency — force remaining tasks into final layer
        const remaining = tasks.filter(t => !placed.has(t.type));
        layers.push(remaining);
        break;
      }
      layer.forEach(t => placed.add(t.type));
      layers.push(layer);
    }

    return layers;
  }

  // ─── Heartbeat ────────────────────────────────────────────────────────────

  /** Start heartbeat monitoring */
  startHeartbeat() {
    if (this._heartbeatTimer) return;
    this._heartbeatTimer = setInterval(() => this._heartbeat(), this.heartbeatMs);
  }

  /** Stop heartbeat monitoring */
  stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  _heartbeat() {
    const now = Date.now();

    // Detect stale executions
    for (const [execId, exec] of this._activeExecutions) {
      if (now - exec.startedAt > this.staleThresholdMs) {
        this.emit('execution:stale', { execId, ...exec, age: now - exec.startedAt });
      }
    }

    // Check agent health
    for (const [name, agent] of this._agents) {
      if (agent.state === AGENT_STATE.ERROR) {
        if (agent.breaker.canRequest()) {
          agent.state = AGENT_STATE.IDLE;
          this.emit('agent:recovered', { name });
        }
      }
    }

    this.emit('heartbeat', this.health());
  }

  // ─── Utils ────────────────────────────────────────────────────────────────

  _timeout(ms, label) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });
  }

  _logExecution(execId, agentName, taskType, status, elapsed, error) {
    this._executionLog.push({ execId, agentName, taskType, status, elapsed, error, at: Date.now() });
    // Cap log at 100 entries
    if (this._executionLog.length > 100) {
      this._executionLog = this._executionLog.slice(-100);
    }
  }

  // ─── Query ────────────────────────────────────────────────────────────────

  /** Get single agent status */
  getAgentStatus(name) {
    const agent = this._agents.get(name);
    if (!agent) return null;
    const total = agent.metrics.tasksCompleted + agent.metrics.tasksFailed;
    return {
      name: agent.name,
      state: agent.state,
      activeTasks: agent.activeTasks,
      maxConcurrent: agent.config.maxConcurrent,
      categories: agent.config.categories,
      domains: agent.config.domains,
      modelTier: agent.config.modelTier,
      metrics: {
        ...agent.metrics,
        successRate: total > 0 ? agent.metrics.tasksCompleted / total : 1,
        avgLatencyMs: total > 0 ? Math.round(agent.metrics.totalLatencyMs / total) : 0,
      },
      circuitBreaker: agent.breaker.status(),
    };
  }

  /** Get all agent statuses */
  getAllAgentStatuses() {
    const statuses = {};
    for (const name of this._agents.keys()) {
      statuses[name] = this.getAgentStatus(name);
    }
    return statuses;
  }

  /** Overall conductor health */
  health() {
    const agents = [...this._agents.values()];
    return {
      uptime: Date.now() - this.startTime,
      agents: {
        total: agents.length,
        idle: agents.filter(a => a.state === AGENT_STATE.IDLE).length,
        busy: agents.filter(a => a.state === AGENT_STATE.BUSY).length,
        error: agents.filter(a => a.state === AGENT_STATE.ERROR).length,
        offline: agents.filter(a => a.state === AGENT_STATE.OFFLINE).length,
      },
      tasks: {
        active: this._activeExecutions.size,
        totalDispatched: this.totalDispatched,
        totalCompleted: this.totalCompleted,
        totalFailed: this.totalFailed,
      },
      pool: this._pool.status(),
      recentExecutions: this._executionLog.slice(-10),
    };
  }

  /** Graceful shutdown */
  async shutdown() {
    this.stopHeartbeat();
    // Mark all agents as draining
    for (const agent of this._agents.values()) {
      if (agent.state !== AGENT_STATE.OFFLINE) {
        agent.state = AGENT_STATE.DRAINING;
      }
    }
    // Wait for active tasks
    await this._pool.drain();
    this.emit('shutdown');
  }
}

module.exports = { Conductor, AGENT_STATE, PRIORITY };
