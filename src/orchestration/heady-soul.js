'use strict';
// Stub heady-soul (compiled from heady-soul.ts)
// TODO: compile heady-soul.ts or replace with real implementation
class HeadySoul {
  constructor(opts = {}) {}
  async validateLaws(decision) { return { passed: true, laws: [] }; }
  async veto(action) { return { vetoed: false }; }
}
module.exports = HeadySoul;
module.exports.HeadySoul = HeadySoul;
