// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Codeflow Engine v1.0.0                                    ║
// ║  Proposal state machine: every code change is submitted, validated,║
// ║  governed, approved, applied, and reversible. Grounded in ADR-0005 ║
// ║  (three-layer gate, human approval for sensitive paths, no self-   ║
// ║  approve). Made with ❤️ by HeadySystems Inc.                       ║
// ╚══════════════════════════════════════════════════════════════════╝
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { validate, autoCorrect } from './validate.mjs';
import { unifiedDiff } from './diff.mjs';
import { FIB } from '../../phi-math/src/index.mjs';

export const STATES = Object.freeze({
  SUBMITTED: 'submitted', VALIDATING: 'validating', VALIDATED: 'validated',
  VALIDATION_FAILED: 'validation_failed', AUTO_CORRECTING: 'auto_correcting',
  GOVERNANCE_PENDING: 'governance_pending', APPROVED: 'approved', REJECTED: 'rejected',
  APPLIED: 'applied', ROLLED_BACK: 'rolled_back',
});

// ADR-0005: sensitive surfaces NEVER auto-approve — a human signature is required.
const SENSITIVE = /(^|\/)(auth|security|secrets?|deploy|billing|patent)|\.github\/|^facts\.yaml$|(^|\/)ci(\/|\.|$)|^lexicon\.yaml$/i;
const MAX_CORRECTIONS = 2; // bounded self-correction (⌈φ⌉)

export class Codeflow {
  constructor({ root, ledgerPath } = {}) {
    this.root = root || resolve(new URL('../../..', import.meta.url).pathname);
    this.ledgerPath = ledgerPath || join(this.root, '.data', 'codeflow', 'ledger.json');
    this.backupDir = join(this.root, '.data', 'codeflow', 'backups');
    this._load();
  }

  _load() {
    try { this.db = JSON.parse(readFileSync(this.ledgerPath, 'utf8')); }
    catch { this.db = { proposals: {}, events: [] }; }
  }

  _save() {
    mkdirSync(dirname(this.ledgerPath), { recursive: true });
    writeFileSync(this.ledgerPath, JSON.stringify(this.db, null, 2));
  }

  _event(id, type, detail = {}) {
    this.db.events.push({ id, type, detail, at: new Date().toISOString() });
  }

  _transition(p, state, detail = {}) {
    p.state = state;
    p.history.push({ state, at: new Date().toISOString(), ...detail });
    this._event(p.id, state, detail);
  }

  /** 1. Submit — capture intent, hash content, mint a trace id. */
  submit({ actor, intent, targetFile, content, priority = 'normal' }) {
    const id = randomUUID();
    const p = {
      id, traceId: `hc-${randomUUID().slice(0, 8)}`, actor: actor || 'unknown',
      intent: intent || '', targetFile, content: content ?? '', priority,
      contentHash: createHash('sha256').update(String(content ?? '')).digest('hex').slice(0, 16),
      sensitive: SENSITIVE.test(String(targetFile || '')),
      state: STATES.SUBMITTED, validation: null, governance: null, applied: null,
      corrections: 0, createdAt: new Date().toISOString(), history: [],
    };
    this._transition(p, STATES.SUBMITTED, { actor: p.actor });
    this.db.proposals[id] = p;
    this._save();
    return this._public(p);
  }

  /** 2+3. Evaluate — validate (fail-closed), bounded auto-correct, then route to governance. */
  evaluate(id) {
    const p = this._req(id);
    this._transition(p, STATES.VALIDATING);
    let result = validate(p.targetFile, p.content);

    while (result.verdict === 'BLOCK' && result.autoCorrectable && p.corrections < MAX_CORRECTIONS) {
      this._transition(p, STATES.AUTO_CORRECTING, { iteration: p.corrections + 1 });
      const { content, strategies } = autoCorrect(p.content);
      p.content = content; p.corrections += 1;
      result = validate(p.targetFile, p.content);
      p.history.push({ state: 'auto_corrected', strategies, at: new Date().toISOString() });
    }
    p.validation = result;

    if (result.verdict === 'BLOCK') {
      this._transition(p, STATES.VALIDATION_FAILED, { errors: result.findings.filter((f) => f.severity === 'error').map((f) => f.rule) });
      this._save();
      return this._public(p);
    }
    this._transition(p, STATES.VALIDATED);
    // Compute the diff vs the file on disk — the reviewer's view + audit record.
    let current = '';
    try { current = readFileSync(join(this.root, p.targetFile), 'utf8'); } catch { /* new file */ }
    const d = unifiedDiff(current, p.content);
    p.diffStat = { added: d.added, removed: d.removed, existed: current !== '', truncated: !!d.truncated };
    p.diffPreview = d.preview.slice(0, FIB[12]); // 144-line capped preview
    // 4. Validation ≠ approval. Sensitive paths require a human; the rest auto-approve (stage-1 allowlist).
    if (p.sensitive) {
      p.governance = { requiresHuman: true, approver: null, decidedAt: null };
      this._transition(p, STATES.GOVERNANCE_PENDING, { reason: 'sensitive path — human approval required (ADR-0005)' });
    } else {
      p.governance = { requiresHuman: false, approver: 'auto:validation-gate', decidedAt: new Date().toISOString() };
      this._transition(p, STATES.APPROVED, { approver: 'auto:validation-gate' });
    }
    this._save();
    return this._public(p);
  }

  /** 5. Approve — human only for sensitive paths. "Approve-all" exists nowhere. */
  approve(id, { approver, human = false } = {}) {
    const p = this._req(id);
    if (p.state !== STATES.GOVERNANCE_PENDING) throw new Error(`cannot approve from ${p.state}`);
    if (p.sensitive && !human) throw new Error('sensitive path requires a human approver (ADR-0005 — no self-approve)');
    if (!approver) throw new Error('approver identity required');
    p.governance = { ...p.governance, approver, human, decidedAt: new Date().toISOString() };
    this._transition(p, STATES.APPROVED, { approver, human });
    this._save();
    return this._public(p);
  }

  reject(id, { approver, reason } = {}) {
    const p = this._req(id);
    this._transition(p, STATES.REJECTED, { approver: approver || 'unknown', reason: reason || '' });
    this._save();
    return this._public(p);
  }

  /** 6. Apply — backup, atomic write, record provenance. Only from APPROVED. */
  apply(id) {
    const p = this._req(id);
    if (p.state !== STATES.APPROVED) throw new Error(`cannot apply from ${p.state}`);
    const abs = join(this.root, p.targetFile);
    if (!abs.startsWith(this.root)) throw new Error('refused: target escapes repo root');
    mkdirSync(this.backupDir, { recursive: true });
    const backupPath = join(this.backupDir, `${p.id}__${p.targetFile.replace(/[\\/]/g, '_')}`);
    const existed = existsSync(abs);
    if (existed) writeFileSync(backupPath, readFileSync(abs));
    else writeFileSync(backupPath, '\0HEADY_CODEFLOW_NEW_FILE\0'); // sentinel: rollback deletes
    mkdirSync(dirname(abs), { recursive: true });
    const tmp = `${abs}.codeflow.tmp`;
    writeFileSync(tmp, p.content);
    renameSync(tmp, abs); // atomic
    p.applied = { at: new Date().toISOString(), approver: p.governance?.approver, backupPath, existedBefore: existed };
    this._transition(p, STATES.APPLIED, { backupPath });
    this._save();
    return this._public(p);
  }

  /** 7. Rollback — restore the backup (or delete a created file). First-class. */
  rollback(id) {
    const p = this._req(id);
    if (p.state !== STATES.APPLIED) throw new Error(`cannot rollback from ${p.state}`);
    const abs = join(this.root, p.targetFile);
    const raw = readFileSync(p.applied.backupPath);
    if (raw.toString().startsWith('\0HEADY_CODEFLOW_NEW_FILE\0')) {
      if (existsSync(abs)) renameSync(abs, `${abs}.rolledback`);
    } else {
      writeFileSync(abs, raw);
    }
    this._transition(p, STATES.ROLLED_BACK, { restoredFrom: p.applied.backupPath });
    this._save();
    return this._public(p);
  }

  get(id) { return this._public(this._req(id)); }
  list() { return Object.values(this.db.proposals).map((p) => this._public(p)); }
  history(id) { return this.db.events.filter((e) => e.id === id); }

  _req(id) { const p = this.db.proposals[id]; if (!p) throw new Error(`unknown proposal: ${id}`); return p; }
  // Never leak full file content in status payloads — only its hash + metadata.
  _public(p) { const { content, ...rest } = p; return { ...rest, contentBytes: Buffer.byteLength(String(content || '')) }; }
}
