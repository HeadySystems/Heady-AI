#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ report binding — task & proposal counts                   ║
// ║  Prints JSON for {{ledger.*}} slots. Degrades gracefully: when no  ║
// ║  live DB is reachable it reports the file-backed codeflow ledger    ║
// ║  + the decomposition artifact, and null for DB-only counts.        ║
// ║  (A live build wires this to @heady/task-ledger getUndispatchedOutbox/counts.)
// ║  Made with ❤️ by HeadySystems Inc.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(new URL("../../..", import.meta.url).pathname);
const read = (rel) => { try { return JSON.parse(readFileSync(join(ROOT, rel), "utf8")); } catch { return null; } };

const cf = read(".data/codeflow/ledger.json");
const dec = read(".data/decomposition/decomposition-report.json");
const proposals = Array.isArray(cf) ? cf : (cf?.proposals || cf ? Object.keys(cf).length : null);

process.stdout.write(JSON.stringify({
  // task-ledger requires a live Neon tx → null offline (wire in the live build)
  tasks: { total: null, byStatus: null, note: "live counts require a DB tx (@heady/task-ledger)" },
  proposals: proposals ?? 0,
  decomposition: dec ? { groups: dec.groups_total, components: dec.components_total, bundled: dec.bundled } : null,
}));
