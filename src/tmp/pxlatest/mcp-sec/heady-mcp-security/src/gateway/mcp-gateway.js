'use strict';
// Stub gateway module
module.exports = {
  connect: async (opts = {}) => ({ connected: true }),
  disconnect: async () => ({ disconnected: true }),
  send: async (msg) => ({ sent: true, id: Date.now().toString() }),
  receive: async () => null,
};
