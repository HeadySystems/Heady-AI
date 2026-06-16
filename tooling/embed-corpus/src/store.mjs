// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Vector-Memory Store v1.0.0                                ║
// ║  On-disk SoR projection for the corpus embedding workflow.        ║
// ║  Reconstructible (ADR-0000): merkle index · dedup ledger ·        ║
// ║  embedding-jobs outbox · vector projection · run report.          ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// This is the local stand-in for the canonical stores: in production the authority is Neon pgvector
// and the edge cache is Vectorize (ADR-0003). On a dev host with no bindings, the same shapes are
// persisted as atomically-written JSON under .data/vector-memory/ so the workflow is end-to-end real
// and its output is durable + reconstructible. Nothing here is authoritative truth — it is a
// projection of the embedding job set (ADR-0000 / ADR-0024 outbox).

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";

export const FILES = Object.freeze({
  MERKLE: "merkle-index.json",
  LEDGER: "ledger.json",
  JOBS: "embedding-jobs.json",
  VECTORS: "vectors.json",
  REPORT: "embed-corpus-report.json",
});

/** Create a store rooted at `dir` (created if missing). All writes are atomic (tmp + rename). */
export function createStore(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const path = (name) => join(dir, name);

  function readJson(name, fallback) {
    const file = path(name);
    if (!existsSync(file)) return fallback;
    try {
      return JSON.parse(readFileSync(file, "utf8"));
    } catch (err) {
      throw new Error(`vector-memory store corrupt: ${file} — ${err.message}`);
    }
  }

  function writeJson(name, value) {
    const file = path(name);
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
    renameSync(tmp, file); // atomic on POSIX — no torn reads
    return file;
  }

  return { dir, path, readJson, writeJson };
}
