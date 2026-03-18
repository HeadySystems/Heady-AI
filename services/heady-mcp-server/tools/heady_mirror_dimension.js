'use strict';

/**
 * heady_mirror_dimension — Create isolated sandbox replicas for safe
 * experimentation using copy-on-write state forking.
 * JSON-RPC 2.0 MCP Tool
 */

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
const CSL = { MINIMUM: 0.500, LOW: 0.691, MEDIUM: 0.809, HIGH: 0.882, CRITICAL: 0.927, DEDUP: 0.972 };

const MIRROR_STATES = { ACTIVE: 'active', FROZEN: 'frozen', MERGED: 'merged', DISCARDED: 'discarded' };
const mirrors = new Map();
let mirrorSeq = 0;

function correlationId() {
  return `mirror-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function classifyError(code) {
  if (code >= 9000 && code < 9500) return 'MIRROR_INPUT_ERROR';
  if (code >= 9500 && code < 10000) return 'MIRROR_STATE_ERROR';
  return 'UNKNOWN_ERROR';
}

class CopyOnWriteStore {
  constructor(base) {
    this._base = base ? JSON.parse(JSON.stringify(base)) : {};
    this._overlay = {};
    this._deleted = new Set();
    this._writes = 0;
    this._reads = 0;
  }

  get(key) {
    this._reads++;
    if (this._deleted.has(key)) return undefined;
    return key in this._overlay ? this._overlay[key] : this._base[key];
  }

  set(key, value) {
    this._writes++;
    this._deleted.delete(key);
    this._overlay[key] = JSON.parse(JSON.stringify(value));
  }

  delete(key) {
    this._writes++;
    this._deleted.add(key);
    delete this._overlay[key];
  }

  keys() {
    const all = new Set([...Object.keys(this._base), ...Object.keys(this._overlay)]);
    for (const d of this._deleted) all.delete(d);
    return Array.from(all);
  }

  snapshot() {
    const merged = {};
    for (const k of this.keys()) merged[k] = this.get(k);
    return merged;
  }

  diff() {
    const added = Object.keys(this._overlay).filter(k => !(k in this._base));
    const modified = Object.keys(this._overlay).filter(k => k in this._base);
    const deleted = Array.from(this._deleted);
    return { added, modified, deleted, total_changes: added.length + modified.length + deleted.length };
  }

  stats() {
    return { reads: this._reads, writes: this._writes, base_keys: Object.keys(this._base).length, overlay_keys: Object.keys(this._overlay).length, deleted_keys: this._deleted.size };
  }
}

function createMirror(sourceState, config) {
  const id = `mirror_${++mirrorSeq}_${Date.now().toString(36)}`;
  const store = new CopyOnWriteStore(sourceState);
  const mirror = {
    id,
    state: MIRROR_STATES.ACTIVE,
    store,
    config: config || {},
    created_at: new Date().toISOString(),
    operations: [],
    ttl_ms: (config?.ttl_minutes || FIB[6]) * 60000,
  };
  mirrors.set(id, mirror);
  return mirror;
}

function getMirror(id) {
  const m = mirrors.get(id);
  if (!m) throw { code: 9501, message: `Mirror not found: ${id}` };
  if (m.state !== MIRROR_STATES.ACTIVE) throw { code: 9502, message: `Mirror ${id} is ${m.state}, not active` };
  const elapsed = Date.now() - new Date(m.created_at).getTime();
  if (elapsed > m.ttl_ms) { m.state = MIRROR_STATES.DISCARDED; throw { code: 9503, message: `Mirror ${id} expired after ${m.ttl_ms}ms` }; }
  return m;
}

const name = 'heady_mirror_dimension';

const description = 'Create isolated sandbox replicas for safe experimentation using copy-on-write state forking. Fork state, run experiments, diff changes, merge or discard.';

const inputSchema = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['fork', 'read', 'write', 'delete_key', 'diff', 'merge', 'discard', 'snapshot', 'list'], description: 'Mirror action' },
    mirror_id: { type: 'string', description: 'Mirror ID (required for all except fork/list)' },
    source_state: { type: 'object', description: 'Source state to fork (for fork action)' },
    key: { type: 'string', description: 'State key (for read/write/delete_key)' },
    value: { description: 'Value to write (for write action)' },
    config: { type: 'object', properties: { ttl_minutes: { type: 'number' }, max_writes: { type: 'number' }, label: { type: 'string' } } },
  },
  required: ['action'],
};

async function handler(params) {
  const cid = correlationId();
  const ts = new Date().toISOString();

  try {
    switch (params.action) {
      case 'fork': {
        if (!params.source_state || typeof params.source_state !== 'object') throw { code: 9001, message: 'source_state required as object' };
        const mirror = createMirror(params.source_state, params.config);
        return { jsonrpc: '2.0', result: { mirror_id: mirror.id, state: mirror.state, keys: mirror.store.keys().length, ttl_ms: mirror.ttl_ms, label: params.config?.label || null, csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      case 'read': {
        if (!params.key) throw { code: 9002, message: 'key required' };
        const mirror = getMirror(params.mirror_id);
        const value = mirror.store.get(params.key);
        mirror.operations.push({ type: 'read', key: params.key, at: ts });
        return { jsonrpc: '2.0', result: { key: params.key, value, exists: value !== undefined, stats: mirror.store.stats(), csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      case 'write': {
        if (!params.key) throw { code: 9003, message: 'key required' };
        const mirror = getMirror(params.mirror_id);
        const maxWrites = mirror.config.max_writes || FIB[10];
        if (mirror.store.stats().writes >= maxWrites) throw { code: 9504, message: `Write limit ${maxWrites} reached` };
        mirror.store.set(params.key, params.value);
        mirror.operations.push({ type: 'write', key: params.key, at: ts });
        return { jsonrpc: '2.0', result: { key: params.key, written: true, stats: mirror.store.stats(), csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      case 'delete_key': {
        if (!params.key) throw { code: 9004, message: 'key required' };
        const mirror = getMirror(params.mirror_id);
        mirror.store.delete(params.key);
        mirror.operations.push({ type: 'delete', key: params.key, at: ts });
        return { jsonrpc: '2.0', result: { key: params.key, deleted: true, stats: mirror.store.stats(), csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      case 'diff': {
        const mirror = getMirror(params.mirror_id);
        const diff = mirror.store.diff();
        const changeRatio = diff.total_changes / (mirror.store.keys().length || 1);
        return { jsonrpc: '2.0', result: { mirror_id: params.mirror_id, diff, change_ratio: Number(changeRatio.toFixed(6)), phi_divergence: Number((changeRatio * PHI).toFixed(6)), stats: mirror.store.stats(), csl_confidence: changeRatio < PSI ? CSL.HIGH : CSL.MEDIUM, correlation_id: cid, timestamp: ts } };
      }

      case 'merge': {
        const mirror = getMirror(params.mirror_id);
        const merged = mirror.store.snapshot();
        const diff = mirror.store.diff();
        mirror.state = MIRROR_STATES.MERGED;
        return { jsonrpc: '2.0', result: { mirror_id: params.mirror_id, merged_state: merged, changes_applied: diff, operations_count: mirror.operations.length, csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      case 'discard': {
        const mirror = getMirror(params.mirror_id);
        const stats = mirror.store.stats();
        mirror.state = MIRROR_STATES.DISCARDED;
        return { jsonrpc: '2.0', result: { mirror_id: params.mirror_id, discarded: true, operations_lost: mirror.operations.length, stats, csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      case 'snapshot': {
        const mirror = getMirror(params.mirror_id);
        return { jsonrpc: '2.0', result: { mirror_id: params.mirror_id, snapshot: mirror.store.snapshot(), stats: mirror.store.stats(), csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      case 'list': {
        const entries = [];
        for (const [id, m] of mirrors) entries.push({ id, state: m.state, keys: m.store.keys().length, operations: m.operations.length, created_at: m.created_at, stats: m.store.stats() });
        return { jsonrpc: '2.0', result: { mirrors: entries, total: entries.length, active: entries.filter(e => e.state === MIRROR_STATES.ACTIVE).length, csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      default:
        throw { code: 9000, message: `Unknown action: ${params.action}` };
    }
  } catch (err) {
    const code = err.code || 9999;
    return { jsonrpc: '2.0', error: { code, message: err.message || 'Mirror dimension error', classification: classifyError(code), correlation_id: cid, timestamp: ts } };
  }
}

function health() {
  const active = Array.from(mirrors.values()).filter(m => m.state === MIRROR_STATES.ACTIVE).length;
  return { status: 'healthy', total_mirrors: mirrors.size, active_mirrors: active, phi: PHI, states: Object.values(MIRROR_STATES), timestamp: new Date().toISOString() };
}

module.exports = { name, description, inputSchema, handler, health };
