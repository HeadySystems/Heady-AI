// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Projection Engine — source collector                       ║
// ║  Walks a source_path into the {rel, content} file set the hash and   ║
// ║  projector consume (ADR-0017). Honors the content-hash excludes      ║
// ║  (.git/node_modules/build/dist/…), bounds file size, and replaces    ║
// ║  binary/oversize bodies with a stable marker so the tree hash stays  ║
// ║  deterministic. Shared by the generator and the drift checker.       ║
// ║  Made with ❤️ by HeadySystems Inc.                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { isExcluded } from "./hash.mjs";

/** Skip files larger than 256KB from the content hash (bounded, deterministic). */
export const MAX_BYTES = 262144;

/**
 * Collect a source tree as {rel, content}[], where rel is repo-relative
 * (`${sourcePathRel}/…`) so excludes and private_paths match on the real path.
 * @param {string} rootAbs        absolute repo root
 * @param {string} sourcePathRel  repo-relative source_path (e.g. "apps/headysystems")
 * @param {object} [opts]         { privatePaths } forwarded to isExcluded
 * @returns {Array<{rel:string, content:string}>}
 */
export function collectSource(rootAbs, sourcePathRel, opts = {}) {
  const out = [];
  const walk = (abs, rel) => {
    let entries;
    try { entries = readdirSync(abs, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      const fullRel = `${sourcePathRel}/${childRel}`;
      if (isExcluded(fullRel, opts)) continue;
      const abschild = join(abs, e.name);
      if (e.isDirectory()) { walk(abschild, childRel); continue; }
      if (!e.isFile()) continue;
      try {
        if (statSync(abschild).size > MAX_BYTES) { out.push({ rel: fullRel, content: `__oversize__${e.name}` }); continue; }
        const buf = readFileSync(abschild);
        if (buf.includes(0)) { out.push({ rel: fullRel, content: `__binary__${e.name}` }); continue; }
        out.push({ rel: fullRel, content: buf.toString("utf8") });
      } catch { /* unreadable — skip */ }
    }
  };
  walk(join(rootAbs, sourcePathRel), "");
  return out;
}
