// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Arena Spec Dump v1.0.0                                     ║
// ║  Refreshes the committed Battle Arena spec artifacts under configs/ ║
// ║  from the live generator, so the D7 guard can hold them to the      ║
// ║  domain canon.                                                      ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// WHY THESE ARTIFACTS EXIST. Nothing reads them at runtime — the live spec is
// `generateBlueprint()` behind `/api/battle/blueprint` and
// `/api/battle/context/:id`. They are kept because they are the ONLY window the
// configs/-scoped content gates have into `src/services/battle-arena.js`: the
// legacy CommonJS tree under src/ is outside the data-consistency scan scope, so
// a canon violation written into the spec that ten external models are asked to
// build from is otherwise invisible. Re-dumping is what surfaces it.
//
// The generator is legacy CommonJS and cannot be `import`ed; `createRequire` is
// the ESM-side bridge (AGENTS.md #1 forbids authoring CommonJS, not interop with
// a module that has not been converted yet).

import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const GENERATOR = join(ROOT, 'src', 'services', 'battle-arena.js');
const BLUEPRINT = join(ROOT, 'configs', 'battle-blueprint.json');
const CONTEXT_DIR = join(ROOT, 'configs', 'battle-contexts');
const log = (level, msg, f = {}) => process.stdout.write(`${JSON.stringify({ t: 'arena-spec', level, msg, ...f })}\n`);

const write = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');

/**
 * Decide which contender dumps to refresh. The artifact set is a deliberate choice,
 * not a side effect of the contender registry: only paths already committed are
 * refreshed, and a contender with no committed dump is REPORTED rather than silently
 * created. Pure, so the decision is unit-testable without touching the repo.
 *
 * @param {Array<{id:string}>} contenders  the arena contender registry
 * @param {Iterable<string>}   presentNames file names present in configs/battle-contexts
 * @returns {{refresh: Array<{id:string,file:string}>, uncommitted: string[]}}
 */
export function planRefresh(contenders, presentNames) {
  const present = new Set(presentNames);
  const refresh = [];
  const uncommitted = [];
  for (const c of contenders ?? []) {
    const file = `${c.id}-context.json`;
    if (present.has(file)) refresh.push({ id: c.id, file });
    else uncommitted.push(c.id);
  }
  return { refresh, uncommitted };
}

function main() {
  if (!existsSync(GENERATOR)) {
    log('error', 'arena generator absent', { generator: GENERATOR });
    process.exit(1);
  }
  const arena = createRequire(import.meta.url)(GENERATOR);

  // generateBlueprint() throws if the domain roster projection is missing, which is
  // the correct failure: a spec with no domain canon must never be dumped.
  const blueprint = arena.generateBlueprint();
  write(BLUEPRINT, blueprint);

  const { refresh, uncommitted } = planRefresh(
    arena.CONTENDERS,
    existsSync(CONTEXT_DIR) ? readdirSync(CONTEXT_DIR).filter((n) => n.endsWith('-context.json')) : [],
  );
  for (const { id, file } of refresh) {
    const context = arena.getContextForModel(id);
    if (!context) {
      log('error', 'contender registered but yields no context', { contender: id });
      process.exit(1);
    }
    write(join(CONTEXT_DIR, file), context);
  }

  log('info', 'arena spec dumps refreshed', {
    roster: blueprint.project.domains.length,
    blueprint: 'configs/battle-blueprint.json',
    contexts: refresh.length,
    uncommitted_contenders: uncommitted,
  });
}

// Only when invoked as the bin — importing this module (tests) must not rewrite
// committed artifacts as an import side effect.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
