'use strict';
// Stub provider usage tracker
module.exports = {
  track: async (provider, tokens, cost) => {},
  getUsage: async (provider) => ({ tokens: 0, cost: 0 }),
  reset: async () => {},
};
