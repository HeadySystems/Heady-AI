'use strict';
// Stub sync-projection-bee
class SyncProjectionBee {
  constructor(opts = {}) {}
  async sync(data) { return { synced: true, data }; }
  async project(vector) { return vector; }
}
module.exports = SyncProjectionBee;
module.exports.SyncProjectionBee = SyncProjectionBee;
