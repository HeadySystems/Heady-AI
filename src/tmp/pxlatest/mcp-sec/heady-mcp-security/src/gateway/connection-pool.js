'use strict';
// Stub connection pool
class ConnectionPool {
  constructor(opts = {}) { this.size = opts.size || 10; this._pool = []; }
  async acquire() { return { id: Date.now(), release: () => {} }; }
  async release(conn) {}
  async destroy() {}
}
module.exports = ConnectionPool;
module.exports.ConnectionPool = ConnectionPool;
