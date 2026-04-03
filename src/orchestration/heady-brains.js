'use strict';
// Stub heady-brains (compiled from heady-brains.ts)
class HeadyBrains {
  constructor(opts = {}) {}
  async assemble(query) { return { context: [], tokens: 0 }; }
  async embed(text) { return new Array(384).fill(0); }
}
module.exports = HeadyBrains;
module.exports.HeadyBrains = HeadyBrains;
