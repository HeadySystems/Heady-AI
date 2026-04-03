'use strict';
// Stub template-bee
class TemplateBee {
  constructor(opts = {}) { this.template = opts.template || ''; }
  async render(ctx = {}) { return this.template; }
  async execute(task) { return { rendered: this.template }; }
}
module.exports = TemplateBee;
module.exports.TemplateBee = TemplateBee;
