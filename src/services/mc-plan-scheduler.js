'use strict';
// Stub mc-plan-scheduler
class MCPlanScheduler {
  constructor(opts = {}) { this._queue = []; }
  async schedule(plan) { this._queue.push(plan); return { scheduled: true, id: Date.now().toString() }; }
  async next() { return this._queue.shift() || null; }
}
module.exports = MCPlanScheduler;
module.exports.MCPlanScheduler = MCPlanScheduler;
