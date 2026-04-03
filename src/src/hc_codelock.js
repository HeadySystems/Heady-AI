'use strict';
// Stub hc_codelock
module.exports = {
  lock: async (path) => ({ locked: true }),
  unlock: async (path) => ({ unlocked: true }),
  check: async (path) => ({ locked: false }),
};
