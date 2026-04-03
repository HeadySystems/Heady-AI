'use strict';
// Stub buddy agent module
module.exports = {
  authorize: async (req) => ({ authorized: false, reason: 'stub' }),
  use: async (task) => ({ result: null }),
  bridge: async (device, action) => ({ bridged: false, reason: 'stub' }),
};
