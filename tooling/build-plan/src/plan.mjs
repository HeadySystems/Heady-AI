// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Build-Plan Harness v1.0.0                                 ║
// ║  Map an end goal once → emit two build plans (mapped-straight-     ║
// ║  through vs simple-first) → compare them deterministically.        ║
// ║  Deterministic: canonical-hash stable across runs (replay-proof).  ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(new URL('../../..', import.meta.url).pathname);
const log = (level, msg, f = {}) => process.stdout.write(`${JSON.stringify({ t: 'build-plan', level, msg, ...f })}\n`);

// ── deterministic canonical hash (sorted keys → same input, same hash) ──
function canon(o) {
  if (Array.isArray(o)) return `[${o.map(canon).join(',')}]`;
  if (o && typeof o === 'object') return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canon(o[k])}`).join(',')}}`;
  return JSON.stringify(o);
}
export const planHash = (plan) => { const { hash, ...rest } = plan; return createHash('sha256').update(canon(rest)).digest('hex').slice(0, 16); };

// ── DAG ──
export function topoSort(caps) {
  const id = (c) => c.id;
  const indeg = new Map(caps.map((c) => [c.id, 0]));
  const adj = new Map(caps.map((c) => [c.id, []]));
  for (const c of caps) for (const d of (c.depends || [])) { adj.get(d)?.push(c.id); indeg.set(c.id, indeg.get(c.id) + 1); }
  const q = caps.filter((c) => indeg.get(c.id) === 0).map(id).sort(); // sort → deterministic
  const order = [];
  while (q.length) {
    const n = q.shift(); order.push(n);
    for (const m of (adj.get(n) || []).sort()) { indeg.set(m, indeg.get(m) - 1); if (indeg.get(m) === 0) { q.push(m); q.sort(); } }
  }
  if (order.length !== caps.length) throw new Error('cycle detected — not a DAG');
  return order;
}
// "simplest first" = fewest deps first, deterministic tie-break by id. Models the naive prototype path.
const simplestFirst = (caps) => [...caps].sort((a, b) => (a.depends?.length || 0) - (b.depends?.length || 0) || a.id.localeCompare(b.id)).map((c) => c.id);

// ── metrics (objective, reproducible) ──
function metrics(goal, order, frozen) {
  const caps = goal.capabilities;
  const byId = Object.fromEntries(caps.map((c) => [c.id, c]));
  const idx = Object.fromEntries(order.map((id, i) => [id, i]));
  const frozenSet = new Set(frozen);

  // a contract bound by ≥2 capabilities that is NOT frozen up front forces interface rework
  const binders = {};
  for (const c of caps) if (c.seam) (binders[c.seam] ||= []).push(c.id);
  let seamRework = 0;
  const seamReworkOn = [];
  for (const [seam, b] of Object.entries(binders)) {
    if (b.length >= 2 && !frozenSet.has(seam)) { seamRework += b.length - 1; seamReworkOn.push(seam); }
  }
  // dependency-order violations: a dependee built AFTER its depender (must rework when the dep lands)
  let orderViolations = 0;
  const violationsOn = [];
  for (const c of caps) for (const d of (c.depends || [])) if (idx[d] > idx[c.id]) { orderViolations++; violationsOn.push(`${d}→${c.id}`); }
  // a deferred capability is "wired" only if its seam is frozen (dependents stay runnable)
  const deferred = caps.filter((c) => c.deferred);
  const deferredWired = deferred.filter((c) => frozenSet.has(c.seam)).length;
  // dependents of an UNWIRED deferred cap are broken (the deferral became a surprise)
  const brokenByDefer = caps.filter((c) => (c.depends || []).some((d) => byId[d]?.deferred && !frozenSet.has(byId[d].seam))).map((c) => c.id);
  const runnableAtBuild = caps.filter((c) => (c.depends || []).every((d) => idx[d] < idx[c.id])).length;

  return {
    slices: caps.length,
    seamsFrozenUpfront: frozen.length,
    totalContracts: Object.keys(binders).length,
    seamRework, seamReworkOn,
    orderViolations, violationsOn,
    runnableAtBuild,
    deferred: deferred.length, deferredWired, brokenByDefer,
    greenFromStart: frozen.length === Object.keys(binders).length,
  };
}

function makePlan(goal, strategy) {
  const order = strategy === 'mapped' ? topoSort(goal.capabilities) : simplestFirst(goal.capabilities);
  const contracts = [...new Set(goal.capabilities.map((c) => c.seam).filter(Boolean))].sort();
  const frozen = strategy === 'mapped' ? contracts : []; // mapped freezes all seams up front; iterative lazily
  const preRegistered = strategy === 'mapped' ? (goal.entities || []).map((e) => e.id).sort() : [];
  const m = metrics(goal, order, frozen);
  const byId = Object.fromEntries(goal.capabilities.map((c) => [c.id, c]));
  const slices = order.map((id, i) => {
    const c = byId[id];
    return { step: i + 1, capability: id, context: c.context, seam: c.seam || null, dependsOn: c.depends || [], acceptance: c.acceptance || null, deferred: !!c.deferred };
  });
  const plan = { strategy, goal: goal.goal, order, frozenSeams: frozen, preRegistered, slices, metrics: m };
  plan.hash = planHash(plan);
  return plan;
}

export function compare(goal) {
  const mapped = makePlan(goal, 'mapped');
  const iterative = makePlan(goal, 'iterative');
  const benefit = (k, lowerIsBetter = true) => {
    const a = mapped.metrics[k]; const b = iterative.metrics[k];
    return { metric: k, mapped: a, iterative: b, winner: a === b ? 'tie' : ((a < b) === lowerIsBetter ? 'mapped' : 'iterative') };
  };
  const proof = {
    deterministic: 'each plan.hash is a canonical-JSON SHA-256; identical goal ⇒ identical hash (verify by re-running)',
    table: [
      benefit('seamRework'), benefit('orderViolations'),
      benefit('runnableAtBuild', false), benefit('deferredWired', false),
    ],
    invariantsHeld: {
      mapped_zero_seam_rework: mapped.metrics.seamRework === 0,
      mapped_zero_order_violations: mapped.metrics.orderViolations === 0,
      mapped_green_from_start: mapped.metrics.greenFromStart === true,
      mapped_dominates_seam_rework: mapped.metrics.seamRework < iterative.metrics.seamRework,
    },
  };
  proof.verdict = Object.values(proof.invariantsHeld).every(Boolean)
    ? 'PROVEN: mapped-straight-through is rework-free and green-by-construction; simple-first incurs deterministic rework.'
    : 'INCONCLUSIVE for this goal — inspect metrics.';
  return { goal: goal.goal, mapped, iterative, proof };
}

// ── CLI ──
const arg = process.argv[2];
if (arg) {
  const goalPath = resolve(arg);
  const goal = JSON.parse(readFileSync(goalPath, 'utf8'));
  const out = join(ROOT, '.data', 'build-plan');
  mkdirSync(out, { recursive: true });
  const name = goalPath.split('/').pop().replace(/\.json$/, '');
  const result = compare(goal);
  writeFileSync(join(out, `${name}.mapped.json`), JSON.stringify(result.mapped, null, 2));
  writeFileSync(join(out, `${name}.iterative.json`), JSON.stringify(result.iterative, null, 2));
  writeFileSync(join(out, `${name}.comparison.json`), JSON.stringify(result, null, 2));
  log('info', 'plans built + compared', {
    goal: name,
    mapped_hash: result.mapped.hash, iterative_hash: result.iterative.hash,
    seamRework: `${result.mapped.metrics.seamRework} vs ${result.iterative.metrics.seamRework}`,
    orderViolations: `${result.mapped.metrics.orderViolations} vs ${result.iterative.metrics.orderViolations}`,
    verdict: result.proof.verdict,
  });
  if (!Object.values(result.proof.invariantsHeld).every(Boolean)) process.exit(2);
}
