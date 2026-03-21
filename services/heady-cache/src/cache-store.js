'use strict';

function createCacheStore(maxEntries) {
  const entries = new Map();

  return {
    set(key, value, ttlSeconds) {
      if (entries.size >= maxEntries && !entries.has(key)) {
        const oldest = entries.keys().next().value;
        entries.delete(oldest);
      }
      entries.set(key, {
        value,
        ok: true,
        expires: Date.now() + (ttlSeconds || 60) * 1000
      });
    },

    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (Date.now() > entry.expires) {
        entries.delete(key);
        return undefined;
      }
      return { ok: entry.ok, value: entry.value };
    },

    delete(key) {
      return entries.delete(key);
    },

    clear() {
      entries.clear();
    },

    get size() {
      return entries.size;
    }
  };
}

module.exports = { createCacheStore };
