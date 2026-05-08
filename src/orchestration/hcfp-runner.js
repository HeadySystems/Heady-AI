'use strict';
// Stub HCFP runner
class HCFPRunner {
  constructor(opts = {}) {}
  async run(pipeline, input) { return { result: input, stages: 0 }; }
  async execute(task) { return { result: null }; }
}
module.exports = HCFPRunner;
module.exports.HCFPRunner = HCFPRunner;
module.exports.default = HCFPRunner;
