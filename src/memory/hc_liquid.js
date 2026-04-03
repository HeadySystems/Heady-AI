'use strict';
// Stub hc_liquid
class HeadyLiquid {
  constructor(opts = {}) { this._nodes = new Map(); }
  addNode(id, node) { this._nodes.set(id, node); return this; }
  async flow(input) { return input; }
}
module.exports = HeadyLiquid;
module.exports.HeadyLiquid = HeadyLiquid;
