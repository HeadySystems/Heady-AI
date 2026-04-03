'use strict';
// Stub heady-autobiographer (compiled from heady-autobiographer.ts)
class HeadyAutobiographer {
  constructor(opts = {}) { this._events = []; }
  async log(event) { this._events.push({ ...event, timestamp: Date.now() }); return { logged: true }; }
  async getHistory(n = 100) { return this._events.slice(-n); }
}
module.exports = HeadyAutobiographer;
module.exports.HeadyAutobiographer = HeadyAutobiographer;
