'use strict';
// Stub agent
class Agent {
  constructor(opts = {}) { this.name = opts.name || 'agent'; }
  async run(task) { return { result: null, agent: this.name }; }
  async stop() {}
}
module.exports = Agent;
module.exports.Agent = Agent;
