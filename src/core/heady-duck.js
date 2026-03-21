/* © 2026 Heady™Systems Inc. PROPRIETARY AND CONFIDENTIAL. */
// STUB — awaiting full implementation

'use strict';

class Database {
  constructor(path = ':memory:') {
    this.path = path;
    this.db = null;
    this._initDB();
  }

  _initDB() {
    try {
      const duckdb = require('duckdb');
      this.db = new duckdb.Database(this.path);
    } catch (err) {
      // DuckDB native bindings not available, using in-memory fallback
      this.db = { type: 'in-memory' };
    }
  }

  query(sql) {
    return {
      ok: false,
      reason: 'not-implemented',
      rows: [],
      error: null
    };
  }

  close() {
    try {
      if (this.db && this.db.close) {
        this.db.close();
      }
    } catch (err) {
      const logger = require('../utils/logger');
      logger.error('Unexpected error', { error: err.message, stack: err.stack });
    }
    this.db = null;
  }
}

module.exports = { Database };
