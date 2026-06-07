// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ A2A Protocol v1.0.0                                     ║
// ║  Agent-to-Agent communication protocol for cross-swarm         ║
// ║  messaging, capability discovery, and task delegation          ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝
import { EventEmitter } from 'events';
import { PlatformConfig } from '../../config/platform-config.js';
import { randomUUID } from 'crypto';

const PHI = 1.6180339887498948;

/**
 * A2AProtocol — Agent-to-Agent communication layer.
 *
 * Absorbed from:
 *   - Google A2A Protocol: Agent cards, capability discovery, task lifecycle
 *   - Heady native: CSL-gated routing, mesh overlay
 *
 * Supports:
 *   - Agent registration with capability cards
 *   - Typed message exchange (request, response, stream, error)
 *   - Task delegation across swarm boundaries
 *   - Capability-based agent discovery
 */
export class A2AProtocol extends EventEmitter {
  /**
   * @param {object} messageBus — SwarmMessageBus instance
   */
  constructor(messageBus) {
    super();
    this._messageBus = messageBus;
    this._agents = new Map();         // agentId → AgentCard
    this._pendingTasks = new Map();    // taskId → { from, to, state, result }
  }

  /**
   * Register an agent with its capability card.
   *
   * @param {string} agentId — Unique agent/swarm identifier
   * @param {object} card — { name, capabilities, domain, layer, ... }
   */
  registerAgent(agentId, card) {
    this._agents.set(agentId, {
      id: agentId,
      name: card.name || agentId,
      capabilities: card.capabilities || [],
      domain: card.domain || 'general',
      layer: card.layer || 'operational',
      registeredAt: Date.now(),
      status: 'available',
    });

    // Subscribe to incoming A2A messages for this agent
    if (this._messageBus) {
      this._messageBus.subscribe(`a2a.${agentId}.*`, (envelope) => {
        this._handleIncoming(agentId, envelope);
      });
    }
  }

  /**
   * Discover agents by capability.
   *
   * @param {string} capability — Required capability string
   * @returns {Array<object>} — Matching agent cards
   */
  discover(capability) {
    const matches = [];
    for (const [, card] of this._agents) {
      if (card.status === 'available' && card.capabilities.includes(capability)) {
        matches.push(card);
      }
    }
    return matches;
  }

  /**
   * Send a task from one agent to another.
   *
   * @param {string} fromAgent — Source agent ID
   * @param {string} toAgent — Target agent ID
   * @param {object} task — { description, priority?, metadata? }
   * @returns {string} — A2A task ID for tracking
   */
  sendTask(fromAgent, toAgent, task) {
    const taskId = `a2a-${randomUUID().slice(0, 12)}`;

    const a2aTask = {
      id: taskId,
      from: fromAgent,
      to: toAgent,
      state: 'submitted', // submitted → working → completed | failed
      description: task.description,
      priority: task.priority || 5,
      metadata: task.metadata || {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this._pendingTasks.set(taskId, a2aTask);

    // Publish to target agent's A2A channel
    if (this._messageBus) {
      this._messageBus.publish(`a2a.${toAgent}.task`, {
        type: 'task:request',
        taskId,
        from: fromAgent,
        task: { description: task.description, priority: task.priority },
      });
    }

    this.emit('a2a:task-sent', { taskId, from: fromAgent, to: toAgent });
    return taskId;
  }

  /**
   * Complete an A2A task.
   *
   * @param {string} taskId — A2A task ID
   * @param {object} result — Task result
   */
  completeTask(taskId, result) {
    const task = this._pendingTasks.get(taskId);
    if (!task) return;

    task.state = 'completed';
    task.result = result;
    task.updatedAt = Date.now();

    // Notify sender
    if (this._messageBus) {
      this._messageBus.publish(`a2a.${task.from}.result`, {
        type: 'task:completed',
        taskId,
        from: task.to,
        result,
      });
    }

    this.emit('a2a:task-completed', { taskId, from: task.to, to: task.from });
  }

  /**
   * Fail an A2A task.
   */
  failTask(taskId, error) {
    const task = this._pendingTasks.get(taskId);
    if (!task) return;

    task.state = 'failed';
    task.error = error;
    task.updatedAt = Date.now();

    if (this._messageBus) {
      this._messageBus.publish(`a2a.${task.from}.error`, {
        type: 'task:failed',
        taskId,
        from: task.to,
        error,
      });
    }

    this.emit('a2a:task-failed', { taskId, from: task.to, to: task.from, error });
  }

  /**
   * Get task status.
   */
  getTaskStatus(taskId) {
    return this._pendingTasks.get(taskId) || null;
  }

  /**
   * Get all registered agents.
   */
  getAgentDirectory() {
    return Array.from(this._agents.values());
  }

  /**
   * Get protocol statistics.
   */
  getStats() {
    const tasks = Array.from(this._pendingTasks.values());
    return {
      agents: this._agents.size,
      totalTasks: tasks.length,
      submitted: tasks.filter(t => t.state === 'submitted').length,
      working: tasks.filter(t => t.state === 'working').length,
      completed: tasks.filter(t => t.state === 'completed').length,
      failed: tasks.filter(t => t.state === 'failed').length,
    };
  }

  // ─── Private ──────────────────────────────────────────────────────

  _handleIncoming(agentId, envelope) {
    const msg = envelope.message;
    if (!msg) return;

    switch (msg.type) {
      case 'task:request': {
        const task = this._pendingTasks.get(msg.taskId);
        if (task) {
          task.state = 'working';
          task.updatedAt = Date.now();
        }
        this.emit('a2a:task-received', { agentId, taskId: msg.taskId, from: msg.from });
        break;
      }
      case 'task:completed':
      case 'task:failed': {
        this.emit('a2a:result-received', { agentId, taskId: msg.taskId, type: msg.type });
        break;
      }
    }
  }
}
