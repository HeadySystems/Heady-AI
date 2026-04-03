'use strict';
// Stub hc_claude — Claude API integration stub
class HCClaude {
  constructor(opts = {}) { this.model = opts.model || 'claude-3-5-sonnet-20241022'; }
  async complete(messages, opts = {}) { return { content: '', model: this.model }; }
  async stream(messages, opts = {}) { return []; }
}
const instance = new HCClaude();
module.exports = instance;
module.exports.HCClaude = HCClaude;
module.exports.claude = instance;
