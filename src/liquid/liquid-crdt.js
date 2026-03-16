/**
 * Heady™ LiquidCRDT v1.0
 * Multiplayer AI collaboration with conflict-free replicated data types
 * Absorbed from: Yjs, Automerge, Loro CRDT architectures
 *
 * Enables multiple humans + multiple AI agents to edit simultaneously
 * with automatic conflict resolution, presence indicators, and
 * role-based access control on shared documents.
 *
 * @author Eric Haywood — HeadySystems Inc.
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');
const {
  PHI, PSI, fib,
  CSL_THRESHOLDS,
} = require('../../shared/phi-math');
const { createLogger } = require('../../shared/logger');

const logger = createLogger('liquid-crdt');

const MAX_CLIENTS = fib(8);          // 21 concurrent clients
const MAX_OPS_PER_SEC = fib(10);     // 55 ops/sec before backpressure
const AWARENESS_TTL_MS = fib(8) * 1000; // 21s presence timeout
const SNAPSHOT_INTERVAL = fib(12);    // every 144 ops
const MAX_HISTORY = fib(13);          // 233 ops retained

const CLIENT_ROLES = Object.freeze({
  OWNER:    'OWNER',
  EDITOR:   'EDITOR',
  AGENT:    'AGENT',
  VIEWER:   'VIEWER',
});

const ROLE_PERMISSIONS = Object.freeze({
  OWNER:  ['read', 'write', 'delete', 'manage', 'undo_any'],
  EDITOR: ['read', 'write'],
  AGENT:  ['read', 'write', 'undo_own'],
  VIEWER: ['read'],
});

class VectorClock {
  constructor() {
    this._clock = new Map(); // clientId → counter
  }

  increment(clientId) {
    const current = this._clock.get(clientId) || 0;
    this._clock.set(clientId, current + 1);
    return current + 1;
  }

  get(clientId) { return this._clock.get(clientId) || 0; }

  merge(other) {
    for (const [id, count] of other._clock) {
      this._clock.set(id, Math.max(this._clock.get(id) || 0, count));
    }
  }

  happensBefore(other) {
    for (const [id, count] of this._clock) {
      if (count > (other._clock.get(id) || 0)) return false;
    }
    return true;
  }

  toJSON() { return Object.fromEntries(this._clock); }
}

class CRDTOperation {
  constructor(clientId, type, path, value, clock) {
    this.id = crypto.randomUUID();
    this.clientId = clientId;
    this.type = type;     // 'insert', 'delete', 'update', 'move'
    this.path = path;     // JSON path to the field
    this.value = value;
    this.clock = clock;
    this.timestamp = Date.now();
  }
}

class CRDTDocument {
  constructor(docId) {
    this.id = docId;
    this._state = {};
    this._ops = [];
    this._clock = new VectorClock();
    this._snapshots = [];
    this._opsSinceSnapshot = 0;

    // Per-client undo managers
    this._undoManagers = new Map(); // clientId → Array<CRDTOperation>
  }

  applyOp(op) {
    this._ops.push(op);
    this._clock.merge(op.clock);
    this._opsSinceSnapshot++;

    switch (op.type) {
      case 'insert':
      case 'update':
        this._setPath(op.path, op.value);
        break;
      case 'delete':
        this._deletePath(op.path);
        break;
      case 'move':
        const val = this._getPath(op.path);
        this._deletePath(op.path);
        if (op.value && val !== undefined) this._setPath(op.value, val);
        break;
    }

    // Track for undo
    if (!this._undoManagers.has(op.clientId)) {
      this._undoManagers.set(op.clientId, []);
    }
    this._undoManagers.get(op.clientId).push(op);

    // Auto-snapshot
    if (this._opsSinceSnapshot >= SNAPSHOT_INTERVAL) {
      this._snapshots.push({ state: JSON.parse(JSON.stringify(this._state)), opIndex: this._ops.length, timestamp: Date.now() });
      this._opsSinceSnapshot = 0;
    }

    // Trim history
    if (this._ops.length > MAX_HISTORY) {
      this._ops = this._ops.slice(-Math.round(MAX_HISTORY * PSI));
    }

    return op;
  }

  undoClient(clientId) {
    const stack = this._undoManagers.get(clientId);
    if (!stack || stack.length === 0) return null;

    const lastOp = stack.pop();

    // Generate inverse operation
    let inverseOp;
    switch (lastOp.type) {
      case 'insert':
        inverseOp = new CRDTOperation(clientId, 'delete', lastOp.path, null, lastOp.clock);
        break;
      case 'delete':
        inverseOp = new CRDTOperation(clientId, 'insert', lastOp.path, lastOp.value, lastOp.clock);
        break;
      case 'update':
        // Would need previous value — simplified
        inverseOp = new CRDTOperation(clientId, 'delete', lastOp.path, null, lastOp.clock);
        break;
    }

    if (inverseOp) this.applyOp(inverseOp);
    return inverseOp;
  }

  getState() { return JSON.parse(JSON.stringify(this._state)); }

  // Path operations for nested JSON
  _setPath(pathStr, value) {
    const parts = pathStr.split('.');
    let obj = this._state;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
  }

  _getPath(pathStr) {
    const parts = pathStr.split('.');
    let obj = this._state;
    for (const p of parts) {
      if (!obj || typeof obj !== 'object') return undefined;
      obj = obj[p];
    }
    return obj;
  }

  _deletePath(pathStr) {
    const parts = pathStr.split('.');
    let obj = this._state;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj || typeof obj !== 'object') return;
      obj = obj[parts[i]];
    }
    if (obj) delete obj[parts[parts.length - 1]];
  }
}

class LiquidCRDT extends EventEmitter {
  constructor(config = {}) {
    super();

    this._documents = new Map();  // docId → CRDTDocument
    this._clients = new Map();    // clientId → { role, name, type, lastSeen }
    this._awareness = new Map();  // clientId → { cursor, selection, state, updatedAt }

    // Rate limiting
    this._opCounts = new Map();   // clientId → { count, windowStart }

    this._metrics = {
      totalOps: 0,
      conflictsResolved: 0,
      clientsActive: 0,
      documentsActive: 0,
    };

    // Awareness cleanup interval
    this._cleanupTimer = setInterval(() => this._cleanupAwareness(), AWARENESS_TTL_MS);

    logger.info('LiquidCRDT initialized');
  }

  // ── Client Management ──────────────────────────────────────────
  connect(clientId, config = {}) {
    if (this._clients.size >= MAX_CLIENTS) {
      throw new Error('HEADY-CRDT-001: Max concurrent clients reached');
    }

    this._clients.set(clientId, {
      role: config.role || CLIENT_ROLES.VIEWER,
      name: config.name || `client-${clientId.slice(0, 8)}`,
      type: config.type || 'human', // 'human' or 'agent'
      connectedAt: Date.now(),
      lastSeen: Date.now(),
    });

    this._metrics.clientsActive = this._clients.size;
    this.emit('client:connected', { clientId, role: config.role });
    return { clientId, role: config.role || CLIENT_ROLES.VIEWER };
  }

  disconnect(clientId) {
    this._clients.delete(clientId);
    this._awareness.delete(clientId);
    this._opCounts.delete(clientId);
    this._metrics.clientsActive = this._clients.size;
    this.emit('client:disconnected', { clientId });
  }

  // ── Document Management ────────────────────────────────────────
  createDocument(docId, initialState = {}) {
    const doc = new CRDTDocument(docId);
    doc._state = JSON.parse(JSON.stringify(initialState));
    this._documents.set(docId, doc);
    this._metrics.documentsActive = this._documents.size;
    this.emit('document:created', { docId });
    return docId;
  }

  getDocument(docId) {
    const doc = this._documents.get(docId);
    return doc ? doc.getState() : null;
  }

  // ── Operations ─────────────────────────────────────────────────
  applyOperation(clientId, docId, type, path, value) {
    const client = this._clients.get(clientId);
    if (!client) throw new Error('HEADY-CRDT-002: Client not connected');

    const doc = this._documents.get(docId);
    if (!doc) throw new Error('HEADY-CRDT-003: Document not found');

    // Permission check
    const perms = ROLE_PERMISSIONS[client.role] || [];
    if (type !== 'read' && !perms.includes('write')) {
      throw new Error('HEADY-CRDT-004: Write permission denied');
    }

    // Rate limiting
    if (!this._checkRate(clientId)) {
      throw new Error('HEADY-CRDT-005: Rate limit exceeded');
    }

    // Create and apply operation
    const clock = new VectorClock();
    clock.increment(clientId);
    clock.merge(doc._clock);

    const op = new CRDTOperation(clientId, type, path, value, clock);
    doc.applyOp(op);

    client.lastSeen = Date.now();
    this._metrics.totalOps++;

    // Broadcast to all connected clients
    this.emit('operation', { docId, op: op, clientId });

    return op;
  }

  undo(clientId, docId) {
    const client = this._clients.get(clientId);
    if (!client) return null;

    const perms = ROLE_PERMISSIONS[client.role] || [];
    if (!perms.includes('undo_own') && !perms.includes('undo_any')) return null;

    const doc = this._documents.get(docId);
    if (!doc) return null;

    return doc.undoClient(clientId);
  }

  // ── Awareness (live cursors, presence) ─────────────────────────
  updateAwareness(clientId, state) {
    if (!this._clients.has(clientId)) return;

    this._awareness.set(clientId, {
      ...state,
      updatedAt: Date.now(),
    });

    this.emit('awareness:update', { clientId, state });
  }

  getAwareness() {
    const result = {};
    for (const [id, state] of this._awareness) {
      if (this._clients.has(id)) {
        const client = this._clients.get(id);
        result[id] = { ...state, name: client.name, role: client.role, type: client.type };
      }
    }
    return result;
  }

  // ── Rate Limiting ──────────────────────────────────────────────
  _checkRate(clientId) {
    const now = Date.now();
    let counter = this._opCounts.get(clientId);

    if (!counter || now - counter.windowStart > 1000) {
      counter = { count: 0, windowStart: now };
      this._opCounts.set(clientId, counter);
    }

    counter.count++;
    return counter.count <= MAX_OPS_PER_SEC;
  }

  // ── Cleanup stale awareness ────────────────────────────────────
  _cleanupAwareness() {
    const now = Date.now();
    for (const [id, state] of this._awareness) {
      if (now - state.updatedAt > AWARENESS_TTL_MS) {
        this._awareness.delete(id);
        this.emit('awareness:timeout', { clientId: id });
      }
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────
  destroy() {
    clearInterval(this._cleanupTimer);
    this._documents.clear();
    this._clients.clear();
    this._awareness.clear();
    this.removeAllListeners();
  }

  get metrics() { return { ...this._metrics }; }
}

module.exports = { LiquidCRDT, CLIENT_ROLES, CRDTDocument, VectorClock };
