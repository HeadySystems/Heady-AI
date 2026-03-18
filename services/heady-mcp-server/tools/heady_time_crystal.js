'use strict';

/**
 * heady_time_crystal — Temporal state management with undo/redo/branch/merge
 * across a timeline DAG. Captures 384D state snapshots at phi-scaled intervals.
 * JSON-RPC 2.0 MCP Tool
 */

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
const CSL = { MINIMUM: 0.500, LOW: 0.691, MEDIUM: 0.809, HIGH: 0.882, CRITICAL: 0.927, DEDUP: 0.972 };
const EMBEDDING_DIM = 384;

const timelines = new Map();
let snapshotSeq = 0;
let timelineSeq = 0;

function correlationId() {
  return `crystal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function classifyError(code) {
  if (code >= 8000 && code < 8500) return 'CRYSTAL_INPUT_ERROR';
  if (code >= 8500 && code < 9000) return 'CRYSTAL_STATE_ERROR';
  return 'UNKNOWN_ERROR';
}

function hashSimple(str) {
  let h = FIB[7];
  for (let i = 0; i < str.length; i++) h = ((h << FIB[3]) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function generateStateEmbedding(state) {
  const text = JSON.stringify(state);
  const vec = new Float32Array(EMBEDDING_DIM);
  const h = hashSimple(text);
  for (let i = 0; i < EMBEDDING_DIM; i++) vec[i] = Math.sin((h + i) * PHI) * PSI;
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (norm > 0) for (let i = 0; i < EMBEDDING_DIM; i++) vec[i] /= norm;
  return vec;
}

function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

function createSnapshot(state, parentId, branchName) {
  const id = `snap_${++snapshotSeq}_${Date.now().toString(36)}`;
  const embedding = generateStateEmbedding(state);
  return {
    id,
    parent_id: parentId,
    branch: branchName,
    state: JSON.parse(JSON.stringify(state)),
    embedding,
    created_at: new Date().toISOString(),
    phi_interval: FIB[Math.min(snapshotSeq % FIB.length, FIB.length - 1)],
  };
}

function createTimeline(name) {
  const id = `timeline_${++timelineSeq}_${Date.now().toString(36)}`;
  const tl = { id, name: name || id, branches: { main: [] }, current_branch: 'main', cursor: -1, created_at: new Date().toISOString() };
  timelines.set(id, tl);
  return tl;
}

function getTimeline(id) {
  const tl = timelines.get(id);
  if (!tl) throw { code: 8501, message: `Timeline not found: ${id}` };
  return tl;
}

const name = 'heady_time_crystal';

const description = 'Temporal state management with undo/redo/branch/merge across a timeline DAG. Captures 384D state snapshots at phi-scaled intervals for reversible state exploration.';

const inputSchema = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['create_timeline', 'capture', 'undo', 'redo', 'branch', 'merge', 'list', 'diff', 'goto'], description: 'Timeline action' },
    timeline_id: { type: 'string', description: 'Timeline ID (required for all actions except create_timeline and list)' },
    state: { type: 'object', description: 'State to capture (for capture action)' },
    branch_name: { type: 'string', description: 'Branch name (for branch/merge)' },
    target_branch: { type: 'string', description: 'Target branch for merge' },
    snapshot_id: { type: 'string', description: 'Snapshot ID (for goto)' },
    timeline_name: { type: 'string', description: 'Name for new timeline' },
  },
  required: ['action'],
};

async function handler(params) {
  const cid = correlationId();
  const ts = new Date().toISOString();

  try {
    switch (params.action) {
      case 'create_timeline': {
        const tl = createTimeline(params.timeline_name);
        return { jsonrpc: '2.0', result: { timeline_id: tl.id, name: tl.name, branches: Object.keys(tl.branches), csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      case 'capture': {
        if (!params.state) throw { code: 8001, message: 'state required for capture' };
        const tl = getTimeline(params.timeline_id);
        const branch = tl.branches[tl.current_branch];
        const parentId = tl.cursor >= 0 ? branch[tl.cursor]?.id : null;
        if (tl.cursor < branch.length - 1) branch.splice(tl.cursor + 1);
        const snap = createSnapshot(params.state, parentId, tl.current_branch);
        branch.push(snap);
        tl.cursor = branch.length - 1;
        return { jsonrpc: '2.0', result: { snapshot_id: snap.id, branch: tl.current_branch, cursor: tl.cursor, history_depth: branch.length, phi_interval: snap.phi_interval, csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      case 'undo': {
        const tl = getTimeline(params.timeline_id);
        const branch = tl.branches[tl.current_branch];
        if (tl.cursor <= 0) throw { code: 8502, message: 'Nothing to undo' };
        tl.cursor--;
        const snap = branch[tl.cursor];
        return { jsonrpc: '2.0', result: { snapshot_id: snap.id, state: snap.state, cursor: tl.cursor, remaining_undos: tl.cursor, remaining_redos: branch.length - 1 - tl.cursor, csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      case 'redo': {
        const tl = getTimeline(params.timeline_id);
        const branch = tl.branches[tl.current_branch];
        if (tl.cursor >= branch.length - 1) throw { code: 8503, message: 'Nothing to redo' };
        tl.cursor++;
        const snap = branch[tl.cursor];
        return { jsonrpc: '2.0', result: { snapshot_id: snap.id, state: snap.state, cursor: tl.cursor, remaining_undos: tl.cursor, remaining_redos: branch.length - 1 - tl.cursor, csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      case 'branch': {
        if (!params.branch_name) throw { code: 8002, message: 'branch_name required' };
        const tl = getTimeline(params.timeline_id);
        if (tl.branches[params.branch_name]) throw { code: 8504, message: `Branch already exists: ${params.branch_name}` };
        const source = tl.branches[tl.current_branch];
        tl.branches[params.branch_name] = source.slice(0, tl.cursor + 1).map(s => ({ ...s, branch: params.branch_name }));
        tl.current_branch = params.branch_name;
        return { jsonrpc: '2.0', result: { branch: params.branch_name, branched_from: tl.current_branch, cursor: tl.cursor, snapshot_count: tl.branches[params.branch_name].length, branches: Object.keys(tl.branches), csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      case 'merge': {
        if (!params.target_branch) throw { code: 8003, message: 'target_branch required' };
        const tl = getTimeline(params.timeline_id);
        const source = tl.branches[tl.current_branch];
        const target = tl.branches[params.target_branch];
        if (!target) throw { code: 8505, message: `Target branch not found: ${params.target_branch}` };
        const sourceNew = source.slice(target.length);
        for (const snap of sourceNew) target.push({ ...snap, branch: params.target_branch });
        tl.current_branch = params.target_branch;
        tl.cursor = target.length - 1;
        return { jsonrpc: '2.0', result: { merged_into: params.target_branch, snapshots_merged: sourceNew.length, total_snapshots: target.length, cursor: tl.cursor, csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      case 'diff': {
        const tl = getTimeline(params.timeline_id);
        const branch = tl.branches[tl.current_branch];
        if (branch.length < FIB[3]) throw { code: 8506, message: 'Need at least 2 snapshots to diff' };
        const latest = branch[tl.cursor];
        const previous = branch[Math.max(0, tl.cursor - 1)];
        const similarity = cosineSimilarity(latest.embedding, previous.embedding);
        const stateKeys = new Set([...Object.keys(latest.state), ...Object.keys(previous.state)]);
        const changes = [];
        for (const k of stateKeys) {
          const a = JSON.stringify(latest.state[k]);
          const b = JSON.stringify(previous.state[k]);
          if (a !== b) changes.push({ key: k, type: a === undefined ? 'removed' : b === undefined ? 'added' : 'modified' });
        }
        return { jsonrpc: '2.0', result: { from: previous.id, to: latest.id, embedding_similarity: Number(similarity.toFixed(6)), state_changes: changes, change_count: changes.length, phi_drift: Number(((1 - similarity) * PHI).toFixed(6)), csl_confidence: similarity >= CSL.HIGH ? CSL.CRITICAL : CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      case 'goto': {
        if (!params.snapshot_id) throw { code: 8004, message: 'snapshot_id required' };
        const tl = getTimeline(params.timeline_id);
        const branch = tl.branches[tl.current_branch];
        const idx = branch.findIndex(s => s.id === params.snapshot_id);
        if (idx < 0) throw { code: 8507, message: `Snapshot not found: ${params.snapshot_id}` };
        tl.cursor = idx;
        return { jsonrpc: '2.0', result: { snapshot_id: params.snapshot_id, state: branch[idx].state, cursor: idx, csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      case 'list': {
        const entries = [];
        for (const [id, tl] of timelines) entries.push({ id, name: tl.name, branches: Object.keys(tl.branches), current_branch: tl.current_branch, cursor: tl.cursor, total_snapshots: Object.values(tl.branches).reduce((s, b) => s + b.length, 0), created_at: tl.created_at });
        return { jsonrpc: '2.0', result: { timelines: entries, total: entries.length, csl_confidence: CSL.HIGH, correlation_id: cid, timestamp: ts } };
      }

      default:
        throw { code: 8000, message: `Unknown action: ${params.action}` };
    }
  } catch (err) {
    const code = err.code || 8999;
    return { jsonrpc: '2.0', error: { code, message: err.message || 'Time crystal operation failed', classification: classifyError(code), correlation_id: cid, timestamp: ts } };
  }
}

function health() {
  let totalSnapshots = 0;
  for (const tl of timelines.values()) for (const b of Object.values(tl.branches)) totalSnapshots += b.length;
  return { status: 'healthy', timelines: timelines.size, total_snapshots: totalSnapshots, embedding_dim: EMBEDDING_DIM, phi: PHI, timestamp: new Date().toISOString() };
}

module.exports = { name, description, inputSchema, handler, health };
