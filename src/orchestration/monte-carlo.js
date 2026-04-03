'use strict';
// Stub monte-carlo optimizer
class MonteCarlo {
  constructor(opts = {}) { this.iterations = opts.iterations || 1000; }
  async simulate(fn, trials = this.iterations) {
    const results = [];
    for (let i = 0; i < Math.min(trials, 100); i++) results.push(await fn());
    return { mean: results.reduce((a,b)=>a+b,0)/results.length, results };
  }
}
module.exports = MonteCarlo;
module.exports.MonteCarlo = MonteCarlo;
