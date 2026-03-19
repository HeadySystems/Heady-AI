/**
 * Heady Colab Runtime Intelligence Service
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PHI = (1 + Math.sqrt(5)) / 2;

class MemoryTier {
  constructor(name, ttlMs, maxEntries) {
    this.name = name; this.ttlMs = ttlMs; this.maxEntries = maxEntries; this._store = new Map();
  }
  set(key, value, metadata = {}) {
    if (this._store.size >= this.maxEntries) { this._store.delete(this._store.keys().next().value); }
    this._store.set(key, { value, metadata, storedAt: Date.now(), expiresAt: Date.now() + this.ttlMs, accessCount: 0 });
  }
  get(key) {
    const e = this._store.get(key);
    if (!e) return null;
    if (Date.now() > e.expiresAt) { this._store.delete(key); return null; }
    e.accessCount++; return e;
  }
  gc() { const now = Date.now(); let n = 0; for (const [k, v] of this._store) { if (now > v.expiresAt) { this._store.delete(k); n++; } } return n; }
  getExpiring(withinMs = 3600000) {
    const t = Date.now() + withinMs; const r = [];
    for (const [k, v] of this._store) { if (v.expiresAt <= t) r.push({ key: k, ...v }); }
    return r;
  }
  stats() { return { tier: this.name, entries: this._store.size, max: this.maxEntries, ttlMs: this.ttlMs }; }
}

const EMBEDDING_BENCHMARKS = {
  'nomic-embed-text': { dimensions: 768, recall10: 0.89, latencyMs: 45 },
  'all-MiniLM-L6-v2': { dimensions: 384, recall10: 0.82, latencyMs: 12 },
  'text-embedding-3-small': { dimensions: 1536, recall10: 0.91, latencyMs: 85 },
  'text-embedding-3-large': { dimensions: 3072, recall10: 0.94, latencyMs: 120 },
};

class ColabRuntime {
  constructor(opts = {}) {
    this.sessionId = opts.sessionId || crypto.randomUUID();
    this.sessionCount = 0; this.totalLearnings = 0;
    this.hot = new MemoryTier('hot', 24*3600*1000, 1000);
    this.warm = new MemoryTier('warm', 7*24*3600*1000, 5000);
    this.cold = new MemoryTier('cold', 30*24*3600*1000, 20000);
    this._distillations = []; this._sessionHistory = [];
    this._preferredEmbedding = opts.embeddingModel || 'nomic-embed-text';
  }
  startSession(meta = {}) {
    this.sessionCount++;
    const s = { id: crypto.randomUUID(), number: this.sessionCount, startedAt: new Date().toISOString(), metadata: meta, learnings: [] };
    this._sessionHistory.push(s); return s;
  }
  endSession(sid) {
    const s = this._sessionHistory.find(x => x.id === sid); if (!s) return null;
    s.endedAt = new Date().toISOString(); s.duration = new Date(s.endedAt) - new Date(s.startedAt);
    for (const l of s.learnings) { this.warm.set(`learn:${crypto.randomBytes(4).toString('hex')}`, l, { sessionId: sid }); this.totalLearnings++; }
    return s;
  }
  learn(sid, content, category = 'general') {
    const s = this._sessionHistory.find(x => x.id === sid);
    if (s) s.learnings.push({ content, category, learnedAt: new Date().toISOString() });
    this.hot.set(`learn:${Date.now()}`, { content, category, sessionId: sid });
  }
  distill() {
    let promoted = 0;
    for (const e of this.hot.getExpiring()) { if (e.accessCount >= 3) { this.warm.set(e.key, e.value, { promotedFrom: 'hot' }); promoted++; } }
    for (const e of this.warm.getExpiring(7*24*3600*1000)) { if (e.accessCount >= 5) { this.cold.set(e.key, e.value, { promotedFrom: 'warm' }); promoted++; } }
    const evicted = this.hot.gc() + this.warm.gc() + this.cold.gc();
    const r = { promoted, evicted, timestamp: new Date().toISOString() }; this._distillations.push(r); return r;
  }
  getBestEmbeddingModel(priority = 'recall') {
    const m = Object.entries(EMBEDDING_BENCHMARKS);
    m.sort(priority === 'speed' ? (a,b) => a[1].latencyMs - b[1].latencyMs : (a,b) => b[1].recall10 - a[1].recall10);
    return { recommended: m[0][0], ...m[0][1], all: EMBEDDING_BENCHMARKS };
  }
  health() {
    return { service: 'heady-colab-runtime', sessionCount: this.sessionCount, totalLearnings: this.totalLearnings,
      memory: { hot: this.hot.stats(), warm: this.warm.stats(), cold: this.cold.stats() },
      distillations: this._distillations.length, embedding: this._preferredEmbedding };
  }
}

module.exports = { ColabRuntime, MemoryTier, EMBEDDING_BENCHMARKS };
