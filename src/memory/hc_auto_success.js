'use strict';
// Stub hc_auto_success
class AutoSuccess {
  constructor(opts = {}) {}
  async run(task) { return { success: true, result: null }; }
  async evaluate(result) { return { score: 0.8, passed: true }; }
}
module.exports = AutoSuccess;
module.exports.AutoSuccess = AutoSuccess;
