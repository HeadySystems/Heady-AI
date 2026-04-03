'use strict';
// Stub redis pool
const _store = new Map();
module.exports = {
  get: async (key) => _store.get(key) ?? null,
  set: async (key, val, ex) => { _store.set(key, val); return 'OK'; },
  del: async (key) => { _store.delete(key); return 1; },
  exists: async (key) => _store.has(key) ? 1 : 0,
  quit: async () => {},
};
