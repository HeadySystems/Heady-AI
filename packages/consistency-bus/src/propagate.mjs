// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Consistency Bus — Propagation (PropagatePort) v1.0.0      ║
// ║  An authorized canonical change → its blast radius → a change-set   ║
// ║  covering every link-site → governed global apply (no partial       ║
// ║  update). © 2026 HeadySystems Inc. — Eric Haywood, Founder         ║
// ╚══════════════════════════════════════════════════════════════════╝
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { lookup } from './link-index.mjs';
import { Codeflow } from '../../codeflow/src/index.mjs';

const ROOT = resolve(new URL('../../..', import.meta.url).pathname);
const ROOTS = ['docs', 'packages', 'tooling', 'configs', 'facts.yaml', 'lexicon.yaml', 'AGENTS.md'];

/** Every file that carries `value` across the canonical roots — the ripple/blast-radius. */
export function blastRadius(value, { root = ROOT, roots = ROOTS } = {}) {
  if (value === '' || value == null) return [];
  const present = roots.filter((r) => existsSync(join(root, r)));
  if (!present.length) return [];
  // grep exits 1 (no match) / 2 (a path-level error, e.g. missing file) but still prints matches to
  // stdout — capture it from the thrown error too, so a partial error never hides found sites.
  let out = '';
  try {
    out = execFileSync('grep', ['-rIl', '--no-messages', '--exclude-dir=node_modules', '--exclude-dir=.git', '--exclude-dir=.data', '-F', String(value), ...present], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 });
  } catch (e) { out = String(e.stdout || ''); }
  return out.split('\n').filter(Boolean);
}

/** Build a change-set for an authorized canonical change. Covers ALL link-sites (no partial update). */
export function changeSet(index, key, newValue, opts = {}) {
  const e = lookup(index, key);
  if (!e) throw new Error(`not a registered value: ${key}`);
  if (String(newValue) === String(e.value)) return { key: e.name, from: e.value, to: newValue, sites: [], proposals: [], noop: true };
  const sites = blastRadius(e.value, opts);
  const proposals = sites.map((targetFile) => ({
    targetFile,
    intent: `propagate ${e.name}: ${e.value} → ${newValue}`,
    find: String(e.value),
    replace: String(newValue),
  }));
  return { key: e.name, from: e.value, to: newValue, sites, proposals, noop: false };
}

/**
 * Apply the change-set as governed proposals (reuse @heady/codeflow). Each site is read, the canonical
 * value replaced, and submitted through validate→govern→approve→apply. Sensitive sites (facts.yaml,
 * security, …) correctly hold at governance_pending — global propagation is itself a governed change.
 */
export function applyChangeSet(cs, { root = ROOT, actor = 'consistency-bus', autoApprove = false, approver } = {}) {
  const cf = new Codeflow({ root });
  const results = [];
  for (const p of cs.proposals) {
    let content;
    try { content = readFileSync(join(root, p.targetFile), 'utf8'); } catch { results.push({ targetFile: p.targetFile, state: 'unreadable' }); continue; }
    const next = content.split(p.find).join(p.replace);
    if (next === content) { results.push({ targetFile: p.targetFile, state: 'no-op' }); continue; }
    const sub = cf.submit({ actor, intent: p.intent, targetFile: p.targetFile, content: next });
    const ev = cf.evaluate(sub.id);
    let proposal = ev;
    if (autoApprove && ev.state === 'governance_pending' && approver) proposal = cf.approve(ev.id, { approver, human: true });
    if (proposal.state === 'approved') proposal = cf.apply(proposal.id);
    results.push({ targetFile: p.targetFile, id: proposal.id, state: proposal.state });
  }
  return { applied: results.filter((r) => r.state === 'applied').length, pending: results.filter((r) => r.state === 'governance_pending').length, results };
}
