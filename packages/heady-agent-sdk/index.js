'use strict';
const EventEmitter = require('events');
const crypto = require('crypto');

class HeadyAgent extends EventEmitter {
  constructor(manifest) {
    super();
    this.id = manifest.id || crypto.randomUUID();
    this.name = manifest.name;
    this.version = manifest.version || '1.0.0';
    this.skills = manifest.skills || [];
    this.author = manifest.author;
    this.pricing = manifest.pricing || { model: 'free' };
    this._started = false;
  }

  async start() {
    this._started = true;
    this.emit('agent:started', { id: this.id, name: this.name });
    return this;
  }

  async stop() {
    this._started = false;
    this.emit('agent:stopped', { id: this.id });
  }

  async execute(task) {
    if (!this._started) throw new Error('Agent not started');
    const startTime = Date.now();
    this.emit('task:started', { taskId: task.id, agentId: this.id });
    try {
      const result = await this.onExecute(task);
      const duration = Date.now() - startTime;
      this.emit('task:completed', { taskId: task.id, agentId: this.id, duration, result });
      return { ok: true, result, duration };
    } catch (err) {
      this.emit('task:failed', { taskId: task.id, agentId: this.id, error: err.message });
      return { ok: false, error: err.message };
    }
  }

  async onExecute(task) {
    throw new Error('onExecute() must be implemented by subclass');
  }

  toManifest() {
    return {
      id: this.id, name: this.name, version: this.version,
      skills: this.skills, author: this.author, pricing: this.pricing,
    };
  }
}

class AgentMarketplace {
  constructor() {
    this._registry = new Map();
    this._usageTracker = new Map();
    this.platformFeeRate = 0.20; // 20%
  }

  register(agent) {
    if (!(agent instanceof HeadyAgent)) throw new Error('Must be a HeadyAgent instance');
    this._registry.set(agent.id, { agent, registeredAt: new Date().toISOString(), downloads: 0 });
    return agent.id;
  }

  unregister(agentId) { return this._registry.delete(agentId); }

  find(query = {}) {
    const results = [];
    for (const [id, entry] of this._registry) {
      if (query.skill && !entry.agent.skills.includes(query.skill)) continue;
      if (query.name && !entry.agent.name.toLowerCase().includes(query.name.toLowerCase())) continue;
      results.push({ id, ...entry.agent.toManifest(), downloads: entry.downloads });
    }
    return results;
  }

  async executeAgent(agentId, task) {
    const entry = this._registry.get(agentId);
    if (!entry) throw new Error(`Agent ${agentId} not found`);
    entry.downloads++;
    const usage = this._usageTracker.get(agentId) || { executions: 0, revenue: 0 };
    usage.executions++;
    this._usageTracker.set(agentId, usage);
    return entry.agent.execute(task);
  }

  getStats() {
    return {
      totalAgents: this._registry.size,
      totalExecutions: [...this._usageTracker.values()].reduce((s, u) => s + u.executions, 0),
      platformFeeRate: this.platformFeeRate,
    };
  }
}

module.exports = { HeadyAgent, AgentMarketplace };
