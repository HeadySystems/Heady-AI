// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Perspective — hc-train (TrainPort) v1.0.0                 ║
// ║  Calibrate HeadyPerspective from ground truth (HeadyRegistry +      ║
// ║  lexicon): source perspective levels + role weights. Deterministic  ║
// ║  (canonical hash) and persisted. © 2026 HeadySystems — E. Haywood   ║
// ╚══════════════════════════════════════════════════════════════════╝
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { loadRoles } from './roles.mjs';
import { sourceLevels } from './perspective-level.mjs';
import { getEmbedder, embedTexts } from './semantic.mjs';

const ROOT = resolve(new URL('../../..', import.meta.url).pathname);
const canon = (o) => (Array.isArray(o) ? `[${o.map(canon).join(',')}]` : (o && typeof o === 'object') ? `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canon(o[k])}`).join(',')}}` : JSON.stringify(o));

/** Build the perspective profile from ground truth. Deterministic: same registry ⇒ same hash. */
export function train(opts = {}) {
  const sources = sourceLevels(opts);
  const roles = loadRoles(opts);
  const profile = {
    schema: 'perspective.v1',
    counts: { sources: sources.length, roles: roles.length, agents: roles.filter((r) => r.kind === 'agent').length, bees: roles.filter((r) => r.kind === 'bee').length, skills: roles.filter((r) => r.kind === 'skill').length },
    sources,
    roles,
  };
  profile.hash = createHash('sha256').update(canon(profile)).digest('hex').slice(0, 16);
  return profile;
}

/** Attach real embedding vectors to roles (locked bge-small). No-op without an embedder → lexical mode. */
export async function embedRoles(roles, embedder) {
  if (!embedder) return roles;
  const vecs = await embedTexts(embedder, roles.map((r) => r.competencies.join(' ')));
  return roles.map((r, i) => ({ ...r, vector: Array.isArray(vecs[i]) ? vecs[i] : null }));
}

/** Calibrate WITH semantic vectors when a token is configured; otherwise the lexical profile. */
export async function trainSemantic(opts = {}) {
  const base = train(opts);
  const embedder = opts.embedder ?? getEmbedder();
  base.semantic = !!embedder;
  base.roles = await embedRoles(base.roles, embedder);
  base.hash = createHash('sha256').update(canon(base)).digest('hex').slice(0, 16);
  return base;
}

/** Persist the profile under .data/perspective/profiles.json. */
export function persist(profile, { root = ROOT } = {}) {
  const out = join(root, '.data', 'perspective', 'profiles.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(profile, null, 2));
  return out;
}

// CLI: `node hc-train.mjs [registryPath]`
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const profile = await trainSemantic(process.argv[2] ? { registryPath: process.argv[2] } : {});
  const at = persist(profile);
  process.stdout.write(`${JSON.stringify({ t: 'hc-train', level: 'info', msg: 'perspective calibrated', hash: profile.hash, semantic: profile.semantic, ...profile.counts, at })}\n`);
}
