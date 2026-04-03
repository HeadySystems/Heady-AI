'use strict';
// Stub kernel module — TODO: implement
module.exports = {
  init: async (opts = {}) => ({ initialized: true }),
  shutdown: async () => ({ stopped: true }),
};
