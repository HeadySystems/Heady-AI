// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Coherence Kernel v1.0.0                                    ║
// ║  Derives the System Map from ground-truth artifacts, gates on      ║
// ║  CONTRADICTION (not incompleteness), computes change blast-radius.  ║
// ║  The build-time realization of heady-knowledge-cartographer.        ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import {
  existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { checkStage0, parseCodeownersPatterns } from './stage0.mjs';
import { checkLaws } from './laws.mjs';
import { SCALAR_GUARDS, scalarViolations } from './scalar-guards.mjs';
import {
  DOMAIN_CARRIERS, checkDomainCarriers, extractRegistryStatus, rosterProjection,
} from './domain-guards.mjs';
import { checkFrameworks, checkTestsAlongside, checkMerkleTrigger } from './packages-law.mjs';
import {
  LOCALHOST_RULES, GLASSBOX_LINE_RULES, GLASSBOX_BLOCK_RULES, SECRET_RULES,
} from '../../enforcers/lib/rules.mjs';
import { check as checkDataConsistency } from '../../data-consistency/src/cli.mjs';

const ROOT = resolve(new URL('../../..', import.meta.url).pathname);
const OUT = join(ROOT, '.data', 'coherence');
// The domain roster is a COMMITTED projection (src/ consumers read it at runtime),
// unlike the .data/ artifacts above which are build-local.
const ROSTER_REL = 'configs/_generated/domain-roster.json';
const log = (level, msg, f = {}) => process.stdout.write(`${JSON.stringify({ t: 'coherence', level, msg, ...f })}\n`);
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const rdj = (p) => JSON.parse(rd(p));
const has = (p) => existsSync(join(ROOT, p));
const lsd = (p) => { try { return readdirSync(join(ROOT, p), { withFileTypes: true }); } catch { return []; } };

// ── minimal YAML reader (subset: nested maps + "- " lists + scalars) ──
const readFacts = () => readYaml('facts.yaml');
function readYaml(rel) {
  const lines = rd(rel).split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
  const root = {}; const stack = [{ indent: -1, node: root, pMap: null, pKey: null }];
  for (const raw of lines) {
    const indent = raw.length - raw.trimStart().length;
    const line = raw.trim();
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const top = stack[stack.length - 1];
    if (line.startsWith('- ')) {
      let node = top.node;
      if (!Array.isArray(node)) { node = []; top.pMap[top.pKey] = node; top.node = node; } // empty map → list
      node.push(strip(line.slice(2)));
      continue;
    }
    const i = line.indexOf(':'); const key = line.slice(0, i).trim(); const val = line.slice(i + 1).trim();
    if (val === '') { const child = {}; top.node[key] = child; stack.push({ indent, node: child, pMap: top.node, pKey: key }); }
    else top.node[key] = strip(val);
  }
  return root;
}
const strip = (s) => s.replace(/^["']|["']$/g, '');
const flat = (o, pfx = '') => Object.entries(o).flatMap(([k, v]) =>
  (v && typeof v === 'object' && !Array.isArray(v)) ? flat(v, `${pfx}${k}.`) : [[`${pfx}${k}`, v]]);

// ── ground-truth scanners (DERIVE — never hand-authored) ──
const CANON = ['docs', 'packages', 'tooling', 'configs', 'AGENTS.md', 'SOURCE_OF_TRUTH.md', 'CLAUDE.md', 'CLAUDE_MEMORY.md'];
// Scalar guards also scan .agents (the skill/workflow source) — previously a blind spot where a
// wrong canonical number could live in a SKILL.md undetected. .claude/skills is a generated
// mirror of .agents/skills, so scanning the source is sufficient.
const SCALAR_SCOPE = [...CANON, '.agents'];
// Canonical load-bearing scalars live in src/scalar-guards.mjs (table + pure semantics, so the
// guard contract is unit-tested); the kernel supplies the IO (grep over SCALAR_SCOPE) below.
const GREP_EXCLUDED_DIRS = new Set(['node_modules', '.git', '.turbo', 'dist', 'drupal', 'superseded-v1']);
function grepFilesUnder(absolute, collected) {
  let entries;
  try { entries = readdirSync(absolute, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const path = join(absolute, entry.name);
    if (entry.isDirectory()) {
      if (!GREP_EXCLUDED_DIRS.has(entry.name)) grepFilesUnder(path, collected);
    } else if (entry.isFile()) collected.push(path);
  }
}

const grep = (ere, paths, extraAllow) => {
  let pattern;
  try { pattern = new RegExp(ere); } catch { return []; }
  const files = [];
  for (const path of paths) {
    const absolute = join(ROOT, path);
    if (!existsSync(absolute)) continue;
    let entries = null;
    try { entries = readdirSync(absolute, { withFileTypes: true }); } catch { /* path is a file */ }
    if (entries) grepFilesUnder(absolute, files);
    else files.push(absolute);
  }
  const matches = [];
  for (const file of files) {
    let text;
    try { text = readFileSync(file, 'utf8'); } catch { continue; }
    if (text.includes('\u0000')) continue;
    for (const [index, line] of text.split('\n').entries()) {
      if (!pattern.test(line)) continue;
      const match = `${relative(ROOT, file)}:${index + 1}:${line}`;
      if (!(extraAllow && extraAllow.test(match))) matches.push(match);
    }
  }
  return matches;
};

function packages() {
  return lsd('packages').filter((d) => d.isDirectory()).map((d) => {
    const pj = `packages/${d.name}/package.json`;
    let name = null; let deps = [];
    if (has(pj)) { const p = rdj(pj); name = p.name; deps = Object.keys({ ...p.dependencies, ...p.devDependencies }).filter((x) => x.startsWith('@heady/')); }
    return { dir: d.name, name, deps, hasReadme: has(`packages/${d.name}/README.md`), hasTest: has(`packages/${d.name}/test`) || has(`packages/${d.name}/src`) };
  });
}
const skillNames = (root) => lsd(root).filter((d) => d.isDirectory()).map((d) => d.name);
const adrs = () => lsd('docs/adr').filter((f) => f.name.endsWith('.md') && /^\d/.test(f.name)).map((f) => f.name.match(/^(\d{4})/)[1]);

// Workspace members across the three source scopes, with their manifests and a
// recursive test-file probe — the IO side of packages-law (checks stay pure).
const TEST_FILE_RE = /\.(test|spec)\.[cm]?jsx?$/;
const WALK_SKIP = new Set(['node_modules', 'dist', '.turbo', 'coverage']);
function hasTestFileUnder(rel, depth = 0) {
  if (depth > 5) return false;
  for (const e of lsd(rel)) {
    if (e.isFile() && TEST_FILE_RE.test(e.name)) return true;
    if (e.isDirectory() && !WALK_SKIP.has(e.name) && hasTestFileUnder(`${rel}/${e.name}`, depth + 1)) return true;
  }
  return false;
}
function workspaceMembers() {
  const members = []; const manifests = [];
  if (has('package.json')) manifests.push({ path: 'package.json', ...rdj('package.json') });
  for (const scope of ['apps', 'packages', 'tooling']) {
    for (const d of lsd(scope).filter((x) => x.isDirectory())) {
      const pj = `${scope}/${d.name}/package.json`;
      if (!has(pj)) continue;
      manifests.push({ path: pj, ...rdj(pj) });
      members.push({ dir: d.name, scope, hasTestFile: hasTestFileUnder(`${scope}/${d.name}`) });
    }
  }
  return { members, manifests };
}

// ── build the System Map (entities + DERIVED edges) ──
function buildMap() {
  const facts = readFacts();
  const pkgs = packages();
  const nodes = [];
  const edges = [];
  for (const [k, v] of flat(facts)) nodes.push({ id: `fact:${k}`, kind: 'fact', value: v });
  for (const p of pkgs) {
    nodes.push({ id: `pkg:${p.name || p.dir}`, kind: 'package', dir: p.dir, built: !!p.name });
    for (const d of p.deps) edges.push({ from: `pkg:${p.name}`, to: `pkg:${d}`, rel: 'depends_on', src: 'package.json' });
  }
  for (const a of adrs()) nodes.push({ id: `adr:${a}`, kind: 'adr' });
  for (const s of skillNames('.agents/skills')) nodes.push({ id: `skill:${s}`, kind: 'skill', store: 'agents' });
  for (const t of lsd('tooling').filter((d) => d.isDirectory())) nodes.push({ id: `tool:${t.name}`, kind: 'tool' });
  for (const h of lsd('.claude/hooks').filter((f) => f.name.endsWith('.mjs'))) nodes.push({ id: `hook:${h.name}`, kind: 'hook' });
  // ingest the decomposition DAG + repos manifest as seed edges (already-built ground truth)
  if (has('tooling/decomposition/manifest.json')) {
    const m = rdj('tooling/decomposition/manifest.json');
    for (const g of m.groups) {
      nodes.push({ id: `group:${g.id}`, kind: 'transfer-group', components: g.components.length });
      for (const dep of (g.depends_on || [])) if (/^G\d/.test(dep)) edges.push({ from: `group:${g.id}`, to: `group:${dep}`, rel: 'depends_on', src: 'decomposition' });
    }
  }
  const map = { schema: 'system-map.v1', root: ROOT, counts: { nodes: nodes.length, edges: edges.length }, nodes, edges };
  return { map, facts, pkgs };
}

// ── coherence checks: error = CONTRADICTION (two sources disagree); info = INCOMPLETE ──
function check({ facts, pkgs }) {
  const F = Object.fromEntries(flat(facts));
  const findings = [];
  const err = (id, msg, ev) => findings.push({ id, tier: 'error', kind: 'contradiction', msg, evidence: ev });
  const info = (id, msg, ev) => findings.push({ id, tier: 'info', kind: 'incomplete', msg, evidence: ev });
  const root = rdj('package.json');

  // S1/S2/S3 — facts.yaml vs the root manifest (machine-readable, precise)
  if (root.packageManager !== `pnpm@${F['platform.pnpm_version']}`) err('S1-pnpm', 'facts pnpm_version disagrees with root packageManager', { facts: F['platform.pnpm_version'], manifest: root.packageManager });
  if (!String(root.engines?.node || '').includes(String(F['platform.node_version']))) err('S2-node', 'facts node_version disagrees with root engines.node', { facts: F['platform.node_version'], manifest: root.engines?.node });
  if (root.name !== F['product.name']) err('S3-name', 'facts product.name disagrees with root package name', { facts: F['product.name'], manifest: root.name });
  if (root.version !== F['product.version']) err('S3-version', 'facts product.version disagrees with root package version', { facts: F['product.version'], manifest: root.version });

  // S4 — every built package honors the locked npm scope
  const scope = F['registries.npm_scope'];
  for (const p of pkgs) if (p.name && !p.name.startsWith(`${scope}/`)) err('S4-scope', `package escapes locked npm scope ${scope}`, { dir: p.dir, name: p.name });

  // S5 — repos-manifest reality vs the actual packages dir
  if (has('.data/decomposition/repos-manifest.json')) {
    const real = new Set(pkgs.filter((p) => p.name).map((p) => p.name));
    const realDir = new Set(pkgs.map((p) => p.dir));
    for (const r of rdj('.data/decomposition/repos-manifest.json').repos) {
      if (r.type !== 'package') continue;
      const pkgName = `${scope}/${r.target.split('/')[1]}`;
      const present = real.has(pkgName) || realDir.has(r.target.split('/')[1]);
      if (r.exists_in_rebuild && !present) err('S5-manifest', 'repos-manifest claims package exists but it is absent', { target: r.target });
      else if (!r.exists_in_rebuild && !present) info('S5-unbuilt', 'planned package not yet built', { target: r.target });
    }
  }

  // D1–D6 — domain canon vs every live carrier. Semantics live in
  // domain-guards.mjs; the kernel supplies the IO (one read per carrier).
  // A carrier file that is absent is itself a contradiction — the guard table
  // is the registry of what MUST exist, so a silent skip would fail open.
  const carriers = {};
  for (const c of DOMAIN_CARRIERS) {
    if (!has(c.file)) { err('D0-carrier-missing', 'registered domain carrier file is absent', { carrier: c.token, file: c.file }); continue; }
    try { carriers[c.token] = c.extract(rd(c.file)); }
    catch (e) { err('D0-carrier-unreadable', 'registered domain carrier could not be parsed', { carrier: c.token, file: c.file, error: e.message }); }
  }
  const brandRegistry = DOMAIN_CARRIERS.find((c) => c.token === 'domain-registry');
  for (const f of checkDomainCarriers({
    domains: facts.domains,
    carriers,
    registryStatus: has(brandRegistry.file) ? extractRegistryStatus(rd(brandRegistry.file)) : {},
    roster: has(ROSTER_REL) ? rdj(ROSTER_REL) : null,
  })) err(f.id, f.msg, f.evidence);

  // S6 — decomposition @heady/* targets vs real package names (naming drift)
  if (has('tooling/decomposition/manifest.json')) {
    const real = new Set(pkgs.filter((p) => p.name).map((p) => p.name));
    const seen = new Set();
    for (const g of rdj('tooling/decomposition/manifest.json').groups) for (const c of g.components) {
      const t = String(c.target || '');
      const m = t.match(/@heady\/[a-z0-9-]+/);
      if (!m || seen.has(m[0])) continue; seen.add(m[0]);
      const stem = m[0].split('/')[1];
      const near = [...real].find((n) => n.includes(stem) || stem.includes(n.split('/')[1]));
      if (!real.has(m[0]) && near) err('S6-target-name', 'decomposition target name disagrees with the real package name', { target: m[0], real: near });
    }
  }

  // S7 — skill-registry drift between the two stores (must be in sync)
  const a = new Set(skillNames('.agents/skills'));
  const c = new Set(skillNames('.claude/skills'));
  const onlyA = [...a].filter((x) => !c.has(x));
  const onlyC = [...c].filter((x) => !a.has(x));
  if (onlyA.length || onlyC.length) err('S7-skill-drift', 'skill stores .agents vs .claude are out of sync (register.mjs not re-run)', { only_in_agents: onlyA, only_in_claude: onlyC });

  // S8 — every invariant authority that cites an ADR must point at a real ADR file
  if (has('tooling/data-consistency/invariants.json')) {
    const have = new Set(adrs());
    const inv = rdj('tooling/data-consistency/invariants.json');
    for (const v of (inv.invariants || [])) for (const ref of String(v.authority || '').match(/ADR-(\d{4})/g) || []) {
      const n = ref.slice(4); if (!have.has(n)) err('S8-adr-ref', 'invariant cites an ADR that does not exist', { invariant: v.id, ref });
    }
  }

  // C-fact — prose patent count vs the golden record (cross-source scalar drift)
  const pc = String(F['company.patents_provisional']);
  // allow assignment/provenance prose ("assign 51 provisionals to …") — that is reassignment count, not total
  for (const l of grep('[0-9]+\\+? provisional', SCALAR_SCOPE, /implement|fully|HS-051|claims|8 prov|assign|reassign|applicant|never[- ]formed|LLC|501\(c\)|provisionals to|to Heady/i)) {
    const n = l.match(/([0-9]+)\+? provisional/)?.[1];
    if (n && n !== pc && n !== `${pc}`) err('C-patents', `prose patent count (${n}) disagrees with facts.company.patents_provisional (${pc})`, { line: l.slice(0, 140) });
  }

  // C-scalar — load-bearing canonical SCALARS in prose/skills must match the golden record.
  // Generalizes C-patents into a table so any tracked fact is a one-line addition. CRITICAL: this
  // scans SCALAR_SCOPE (= CANON + .agents) so SKILL.md files are checked — they were previously a
  // blind spot, which is how a wrong HCFullPipeline stage-count slipped into a skill undetected.
  // Each guard: factKey (golden record), find (ERE, must co-locate the subject with the number),
  // extract (JS regex → the asserted number), allow (legit provenance/variant context to exempt).
  for (const g of SCALAR_GUARDS) {
    const want = String(F[g.factKey]);
    if (want === 'undefined') { info(g.id, `scalar-guard references missing fact ${g.factKey}`, {}); continue; }
    for (const v of scalarViolations(grep(g.find, SCALAR_SCOPE), g, want)) {
      err(g.id, `${g.label} (${v.asserted}) disagrees with facts.${g.factKey} (${want})`, { line: v.line.slice(0, 140) });
    }
  }

  // C-dropped — a store facts says is DROPPED must not appear as an active dependency/connector.
  // Test files legitimately reference dropped stores to assert their rejection → excluded (like fixtures).
  const isTest = (l) => /(^|\/)(test|tests|__tests__|fixtures?)\/|\.test\.|\.spec\./.test(l.split(':')[0]);
  for (const store of (facts.stores?.dropped || [])) {
    for (const l of grep(`\\b${store}\\b`, ['packages', 'tooling', 'configs'], /drop|reject|decommission|observed|amended|removed|legacy|unused|R2\b/i)) {
      if (!isTest(l)) err('C-dropped-store', `dropped store "${store}" referenced as active outside a drop/reject context`, { line: l.slice(0, 140) });
    }
  }

  // QUAR — quarantined trees must never be referenced by the rebuild. colab/ is
  // throwaway batch/experiment compute with documented locked-law violations
  // (configs/laws.json: colab-quarantine); an import from packages/apps/tooling
  // is a build-blocking contradiction, per the ops-brief quarantine order.
  for (const l of grep("from ['\\\"][^'\\\"]*colab/|require\\(['\\\"][^'\\\"]*colab/", ['packages', 'apps', 'tooling'])) {
    err('QUAR-colab', 'quarantined colab/ tree referenced from the rebuild', { line: l.slice(0, 140) });
  }

  // CONTENT — FEDERATE the data-consistency engine as a sub-gate (invoke; do not reimplement its rules)
  if (has('tooling/data-consistency/src/cli.mjs')) {
    try {
      const s = checkDataConsistency(ROOT).summary || {};
      if (s.errors > 0) err('FED-consistency', 'federated data-consistency engine reports content invariant violations', { errors: s.errors, warns: s.warns });
      else info('FED-consistency', 'data-consistency sub-gate clean', { files: (s.filesCanonical || 0) + (s.filesExtended || 0), errors: 0 });
    } catch (error) {
      err('FED-consistency', 'data-consistency sub-gate could not be evaluated', { error: String(error?.message ?? error).slice(0, 120) });
    }
  }

  // STAGE0 — the agent-untouchable bootstrap (verifier-of-verifiers) must resolve,
  // be CODEOWNERS-locked, and include the kernel itself (STEPWISE §0.8 / ADR-0016).
  findings.push(...checkStage0({
    manifest: has('configs/stage0-untouchables.json') ? rdj('configs/stage0-untouchables.json') : null,
    resolves: (glob) => has(glob),
    codeownerPatterns: has('.github/CODEOWNERS') ? parseCodeownersPatterns(rd('.github/CODEOWNERS')) : [],
  }));

  // LAW — every AGENTS.md law maps to a live enforcer; no canonical enforcer rule
  // is silently downgraded; advisory gaps + tracked defects surface (STEPWISE step 6).
  const libRuleIds = [...LOCALHOST_RULES, ...GLASSBOX_LINE_RULES, ...GLASSBOX_BLOCK_RULES, ...SECRET_RULES].map((r) => r.id);
  findings.push(...checkLaws({
    registry: has('configs/laws.json') ? rdj('configs/laws.json') : null,
    libRuleIds,
    moduleExists: (p) => has(p),
  }));

  // PKG-LAW — no forbidden frontend framework in any workspace manifest
  // (C-framework) and tests-alongside for every substrate member (TEST-missing);
  // apps without tests surface as INFO debt (AGENTS.md #9 / Do-Not list).
  const { members, manifests } = workspaceMembers();
  findings.push(...checkFrameworks(manifests));
  findings.push(...checkTestsAlongside(members));

  // LAW11 — file indexing triggers via the Merkle planner (ADR-0023), never
  // Postgres CDC; DB-level CDC (ADR-0014) must stay out of the file-index path.
  const embedOrch = has('tooling/embed-corpus/src/embed.mjs') ? rd('tooling/embed-corpus/src/embed.mjs') : '';
  findings.push(...checkMerkleTrigger({
    plannerImported: /\bplanCorpusEmbedding\b/.test(embedOrch),
    cdcHits: grep('pg-logical-replication|wal2json|pgoutput|START_REPLICATION|CREATE PUBLICATION', ['packages/embedding', 'tooling/embed-corpus', 'tooling/awareness'])
      .filter((l) => !isTest(l)).map((l) => ({ line: l })),
  }));

  return findings;
}

// ── ripple: blast radius of a change (DERIVED — what must regen/review) ──
function ripple(target, { pkgs }) {
  const facts = readFacts(); const F = Object.fromEntries(flat(facts));
  const out = { target, touches: [], packages: new Set(), why: [] };
  if (target.startsWith('fact:') || target.includes('.')) {
    const key = target.replace(/^fact:/, '');
    const val = F[key];
    out.why.push(`change to facts.${key} (= ${val}) propagates to every artifact that derives from or restates it`);
    const tokens = [key.split('.').pop(), String(val)].filter((s) => s && s.length > 2);
    for (const tok of tokens) for (const l of grep(tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), CANON)) {
      const file = l.split(':')[0]; out.touches.push(file);
      const pm = file.match(/^packages\/([^/]+)/); if (pm) out.packages.add(pm[1]);
    }
  } else if (target.startsWith('pkg:')) {
    const name = target.slice(4);
    for (const p of pkgs) if (p.deps.includes(name)) { out.packages.add(p.dir); out.why.push(`pkg:${p.name} depends_on ${name}`); }
  }
  out.touches = [...new Set(out.touches)]; out.packages = [...out.packages];
  return out;
}

// ── master variable registry: DERIVE every variable from its source of truth ──
async function buildVars() {
  const F = Object.fromEntries(flat(readFacts()));
  const vars = [];
  let secrets = [];
  try { ({ SECRETS: secrets } = await import(join(ROOT, 'packages/secrets/src/registry.mjs'))); } catch { /* unbuilt */ }
  for (const s of (secrets || [])) vars.push({ class: s.secret ? 'secret' : 'env', name: s.name, type: s.kind || (s.secret ? 'secret' : 'config'), required: !!s.required, value: s.secret ? '[SECRET]' : '', rotation: s.rotation?.strategy || '', sot: 'packages/secrets/src/registry.mjs', def: s.description || '' });
  let phi = {};
  try { phi = await import(join(ROOT, 'packages/phi-math/src/index.mjs')); } catch { /* unbuilt */ }
  const phiLines = (() => { try { return rd('packages/phi-math/src/index.mjs').split('\n'); } catch { return []; } })();
  const descFor = (name) => {
    const i = phiLines.findIndex((l) => new RegExp(`export (?:const|function) ${name}\\b`).test(l));
    if (i < 0) return '';
    const tr = phiLines[i].match(/\/\/\s*(.+)$/); if (tr) return tr[1].trim(); // trailing comment
    for (let j = i - 1; j >= 0 && j >= i - 2; j--) { // else preceding JSDoc / line comment
      const p = phiLines[j].trim(); if (!p) continue;
      const jd = p.match(/^\/\*\*?\s*(.+?)\s*\*\/$/); if (jd) return jd[1];
      const lc = p.match(/^\/\/\s*(.+)/); if (lc && !lc[1].includes('───')) return lc[1].trim();
      break;
    }
    return '';
  };
  for (const [name, val] of Object.entries(phi)) {
    if (name === 'default') continue;
    const t = typeof val === 'function' ? 'function' : Array.isArray(val) ? 'array' : typeof val;
    vars.push({ class: 'constant', name, type: t, value: t === 'number' ? String(val) : t === 'array' ? `[len ${val.length}]` : '', sot: 'packages/phi-math/src/index.mjs', def: descFor(name) });
  }
  for (const [k, v] of Object.entries(F)) vars.push({ class: 'fact', name: k, type: typeof v, value: Array.isArray(v) ? v.join(', ') : String(v), sot: 'facts.yaml', def: '' });
  // concepts / agents / bees — authored in lexicon.yaml
  let L = {};
  try { L = readYaml('lexicon.yaml'); } catch { /* optional */ }
  for (const [name, t] of Object.entries(L.terms || {})) vars.push({ class: 'term', name, type: 'concept', value: '', sot: t.sot || 'lexicon.yaml', def: t.def || '' });
  for (const [name, def] of Object.entries(L.agents || {})) vars.push({ class: 'agent', name, type: 'role', value: '', sot: 'heady-agent-orchestration', def });
  for (const [name, def] of Object.entries(L.bees || {})) vars.push({ class: 'bee', name, type: 'worker', value: '', sot: name === 'security-bee' ? 'agent: security-bee' : 'heady-bee-swarm-ops', def });
  // skills — DERIVED from each SKILL.md frontmatter description (auto-current)
  for (const d of lsd('.claude/skills').filter((x) => x.isDirectory())) {
    const sp = `.claude/skills/${d.name}/SKILL.md`; if (!has(sp)) continue;
    const m = rd(sp).match(/^description:\s*(.+)$/m);
    const def = (m ? m[1].trim().replace(/^["']|["']$/g, '') : '').replace(/\s+/g, ' ').slice(0, 200);
    vars.push({ class: 'skill', name: d.name, type: 'skill', value: '', sot: sp, def });
  }
  // decisions — DERIVED from ADR titles (auto-current)
  for (const f of lsd('docs/adr').filter((x) => x.name.endsWith('.md') && /^\d/.test(x.name))) {
    const id = f.name.match(/^(\d{4})/)[1];
    const t = rd(`docs/adr/${f.name}`).match(/^#\s*(.+)$/m);
    vars.push({ class: 'decision', name: `ADR-${id}`, type: 'adr', value: '', sot: `docs/adr/${f.name}`, def: t ? t[1].replace(/^ADR-\d+:\s*/, '').trim() : '' });
  }
  return { vars, secrets };
}

// V1 — .env.example and the secrets registry must agree (no undefined env var, no orphan registry entry)
function envDrift(secrets) {
  const out = [];
  const envNames = new Set();
  try { for (const l of rd('.env.example').split('\n')) { const m = l.match(/^#?\s*([A-Z][A-Z0-9_]+)=/); if (m) envNames.add(m[1]); } } catch { /* none */ }
  const reg = new Set((secrets || []).map((s) => s.name));
  for (const n of envNames) if (!reg.has(n)) out.push({ id: 'V1-env-undefined', tier: 'error', kind: 'contradiction', msg: '.env.example variable absent from the secrets registry', evidence: { name: n } });
  for (const n of reg) if (!envNames.has(n)) out.push({ id: 'V1-reg-orphan', tier: 'error', kind: 'contradiction', msg: 'secrets registry entry missing from .env.example', evidence: { name: n } });
  return out;
}

function renderRegistry(vars) {
  const by = (c) => vars.filter((v) => v.class === c);
  const tbl = (rows, cols, pick) => [`| ${cols.join(' | ')} |`, `|${cols.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${pick(r).join(' | ')} |`)].join('\n');
  const authored = ['secret', 'constant', 'term', 'agent', 'bee'];
  const undef = vars.filter((v) => authored.includes(v.class) && !v.def).map((v) => v.name);
  return `<!-- HEADY_BRAND:BEGIN
╔══════════════════════════════════════════════════════════════════╗
║  HEADY™ Master Variable Registry — AUTOGENERATED, DO NOT EDIT     ║
║  Source: tooling/coherence (vars). Edit the SoT, not this file.    ║
║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# Heady Master Variable Registry

> **AUTOGENERATED** by \`node tooling/coherence/src/coherence.mjs vars\`. ${vars.length} variables across 5 classes.
> Every row is **derived** from its source of truth — change the SoT, regenerate this file, never hand-edit.
> Definition coverage gap: ${undef.length ? undef.join(', ') : 'none — every secret/constant/term is defined'}.

## 1. Environment & Secrets — *SoT: \`packages/secrets/src/registry.mjs\` (mirrors \`.env.example\`)*

${tbl([...by('secret'), ...by('env')], ['Name', 'Type', 'Required', 'Rotation', 'Definition'], (v) => [v.name, v.type, v.required ? 'yes' : 'no', v.rotation || '—', v.def])}

## 2. φ-Constants — *SoT: \`packages/phi-math/src/index.mjs\`*

${tbl(by('constant'), ['Name', 'Type', 'Value', 'Definition'], (v) => [v.name, v.type, v.value || '—', v.def])}

## 3. Config Facts — *SoT: \`facts.yaml\`*

${tbl(by('fact'), ['Key', 'Type', 'Value'], (v) => [v.name, v.type, v.value])}

## 4. Concept Lexicon — *SoT: \`lexicon.yaml\` (authored)*

${tbl(by('term'), ['Term', 'Definition', 'Authority'], (v) => [v.name, v.def, v.sot])}

## 5. Cognitive Agents — *SoT: \`lexicon.yaml\` → heady-agent-orchestration*

${tbl(by('agent'), ['Agent', 'Role'], (v) => [v.name, v.def])}

## 6. Bee Worker Roles — *SoT: \`lexicon.yaml\` → heady-bee-swarm-ops*

${tbl(by('bee'), ['Bee', 'Role'], (v) => [v.name, v.def])}

## 7. Skills — *DERIVED from \`.claude/skills/*/SKILL.md\` frontmatter*

${tbl(by('skill'), ['Skill', 'Description'], (v) => [v.name, v.def])}

## 8. Decisions (ADRs) — *DERIVED from \`docs/adr/*\`*

${tbl(by('decision'), ['ADR', 'Title'], (v) => [v.name, v.def])}

---
*© 2026 HeadySystems Inc. — Eric Haywood, Founder*
`;
}

// ── main ──
const cmd = process.argv[2] || 'all';
const arg = process.argv[3];
const noWrite = process.argv.includes('--no-write');
if (!noWrite) mkdirSync(OUT, { recursive: true });
const built = buildMap();
const extra = [];

if (cmd === 'map' || cmd === 'all') {
  if (!noWrite) writeFileSync(join(OUT, 'system-map.json'), JSON.stringify(built.map, null, 2));
  log('info', 'system map built', built.map.counts);
}
if (cmd === 'ripple') {
  const r = ripple(arg, built);
  if (!noWrite) writeFileSync(join(OUT, 'ripple.json'), JSON.stringify(r, null, 2));
  log('info', 'blast radius', { target: r.target, files: r.touches.length, packages: r.packages.length });
  process.exit(0);
}
if (cmd === 'vars' || cmd === 'all') {
  const { vars, secrets } = await buildVars();
  if (!noWrite) {
    writeFileSync(join(OUT, 'variable-registry.json'), JSON.stringify({ schema: 'variable-registry.v1', count: vars.length, vars }, null, 2));
    writeFileSync(join(ROOT, 'docs', 'HEADY_VARIABLE_REGISTRY.md'), renderRegistry(vars));
  }
  extra.push(...envDrift(secrets));
  const byClass = vars.reduce((a, v) => { a[v.class] = (a[v.class] || 0) + 1; return a; }, {});
  log('info', 'variable registry built', { total: vars.length, ...byClass });
}
if (cmd === 'domains' || cmd === 'all') {
  const projection = rosterProjection(built.facts.domains);
  if (!noWrite) {
    mkdirSync(join(ROOT, 'configs', '_generated'), { recursive: true });
    writeFileSync(join(ROOT, ROSTER_REL), `${JSON.stringify(projection, null, 2)}\n`);
  }
  log('info', 'domain roster projected', { count: projection.count, out: ROSTER_REL });
}
if (cmd === 'check' || cmd === 'all' || cmd === 'vars') {
  const findings = [...(cmd === 'vars' ? [] : check(built)), ...extra];
  const errors = findings.filter((f) => f.tier === 'error');
  const report = { schema: 'coherence-report.v1', errors: errors.length, info: findings.length - errors.length, findings };
  if (cmd !== 'vars' && !noWrite) writeFileSync(join(OUT, 'coherence-report.json'), JSON.stringify(report, null, 2));
  for (const f of errors) log('error', `CONTRADICTION ${f.id}`, { msg: f.msg, evidence: f.evidence });
  log(errors.length ? 'error' : 'info', `${cmd} complete`, { contradictions: errors.length, incomplete: report.info });
  if (errors.length) process.exit(2);
}
