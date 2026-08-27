#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Projection Engine — drift gate (ADR-0017 §4)               ║
// ║  Recomputes each committed projection's source hash and compares    ║
// ║  it to the manifest's recorded last_sync_hash. A projection whose   ║
// ║  source moved (source-ahead) is STALE — re-run `heady-project`.     ║
// ║  Fail-closed (exit 2) on any drift so stale shells can't merge      ║
// ║  silently (the generated-artifact-not-hand-edited discipline).      ║
// ║  Made with ❤️ by HeadySystems Inc.                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateProjectionManifest } from "@heady/contracts";
import { deltaCheck } from "../src/sync-projection-bee.mjs";
import { collectSource } from "../src/collect.mjs";

const ROOT = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const DIR = join(ROOT, "configs", "projections");
const NOW = "1970-01-01T00:00:00.000Z"; // drift is hash-based; the timestamp is irrelevant here
const log = (level, msg, f = {}) => process.stdout.write(`${JSON.stringify({ t: "projection-drift", level, msg, ...f })}\n`);

function main() {
  if (!existsSync(DIR)) { log("info", "no projections dir — nothing to check"); process.exit(0); }
  const files = readdirSync(DIR).filter((f) => f.endsWith(".projection.json"));
  const drifted = [];
  let checked = 0;

  for (const f of files) {
    let manifest;
    try { manifest = JSON.parse(readFileSync(join(DIR, f), "utf8")); } catch (err) { drifted.push({ id: f, drift: "unreadable" }); log("error", "unreadable manifest", { file: f }); continue; }
    const mv = validateProjectionManifest(manifest);
    if (!mv.ok) { drifted.push({ id: manifest.id ?? f, drift: "invalid" }); log("error", "invalid manifest", { id: manifest.id ?? f, errors: mv.errors }); continue; }
    if (!existsSync(join(ROOT, manifest.source_path))) { drifted.push({ id: manifest.id, drift: "source-missing" }); log("error", "source_path missing", { id: manifest.id, source_path: manifest.source_path }); continue; }
    if (!manifest.last_sync_hash) { drifted.push({ id: manifest.id, drift: "never-synced" }); log("error", "manifest has no last_sync_hash — run heady-project", { id: manifest.id }); continue; }

    checked += 1;
    const files_ = collectSource(ROOT, manifest.source_path, { privatePaths: manifest.private_paths ?? [] });
    const d = deltaCheck({ manifest, sourceFiles: files_, sourceSha: manifest.last_sync_commit ?? "check", nowIso: NOW });
    if (d.changed) { drifted.push({ id: manifest.id, drift: d.drift }); log("error", "DRIFT — source moved since last projection; re-run heady-project", { id: manifest.id, drift: d.drift, source_path: manifest.source_path }); }
    else log("info", "in-sync", { id: manifest.id });
  }

  log(drifted.length ? "error" : "info", "drift check complete", { checked, manifests: files.length, drifted: drifted.map((d) => d.id) });
  process.exit(drifted.length ? 2 : 0);
}

main();
