'use strict';
// Stub database pool
class DBPool {
  constructor(opts = {}) {}
  async query(sql, params = []) { return { rows: [], rowCount: 0 }; }
  async connect() { return { query: this.query, release: () => {} }; }
  async end() {}
}
const pool = new DBPool();
module.exports = pool;
module.exports.DBPool = DBPool;
