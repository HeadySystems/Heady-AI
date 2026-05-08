'use strict';
// Stub vector pipeline
class VectorPipeline {
  constructor(opts = {}) { this.stages = []; }
  addStage(fn) { this.stages.push(fn); return this; }
  async run(input) { let v = input; for (const s of this.stages) v = await s(v); return v; }
}
module.exports = VectorPipeline;
module.exports.VectorPipeline = VectorPipeline;
