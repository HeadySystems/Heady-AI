#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Projection Engine — manifest generator (ADR-0017)          ║
// ║  For each headyX projection candidate in configs/connectors.json,   ║
// ║  derives a governed projection from its monorepo source_path        ║
// ║  (configs/projections/sources.json), runs the SyncProjectionBee,    ║
// ║  and writes the projection.json manifest + the ServerManifest the    ║
// ║  §8 console reads. Fail-closed: a missing source_path aborts that    ║
// ║  shell. NOTHING is deployed — this only emits manifests.             ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                   ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { validateProjectionManifest } from "@heady/contracts";
import { runProjectionBee } from "../src/sync-projection-bee.mjs";
import { collectSource } from "../src/collect.mjs";

const ROOT = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const log = (level, msg, f = {}) => process.stdout.write(`${JSON.stringify({ t: "projection-engine", level, msg, ...f })}\n`);

function gitSha() {
  try { return execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim(); }
  catch { return "unknown"; }
}

function readJson(rel, fallback) {
  try { return JSON.parse(readFileSync(join(ROOT, rel), "utf8")); } catch { return fallback; }
}

function main(argv) {
  const dryRun = argv.includes("--dry-run");
  const nowIso = new Date().toISOString();
  const sourceSha = gitSha();

  const connectors = readJson("configs/connectors.json", null);
  const sources = readJson("configs/projections/sources.json", null);
  if (!connectors || !sources) { log("error", "missing configs/connectors.json or configs/projections/sources.json"); process.exit(2); }

  const pattern = sources.target_repo_pattern || "HeadySystems/{id}-core";
  const sourceById = new Map((sources.sources || []).map((s) => [s.id, s]));
  const candidates = (connectors.connectors || []).filter((c) => c.expected === "projection");

  const results = [];
  let failed = 0;
  for (const c of candidates) {
    const src = sourceById.get(c.id);
    if (!src) { log("error", "no source mapping", { id: c.id }); failed++; results.push({ id: c.id, ok: false, reason: "no source mapping" }); continue; }
    if (!existsSync(join(ROOT, src.source_path))) { log("error", "source_path does not exist (fail-closed)", { id: c.id, source_path: src.source_path }); failed++; results.push({ id: c.id, ok: false, reason: "source missing" }); continue; }

    const prior = readJson(`configs/projections/${c.id}.projection.json`, null);
    const manifest = {
      schema: "projection.v1",
      id: c.id,
      source_path: src.source_path,
      target_repo: pattern.replace("{id}", c.id),
      projection_type: src.projection_type,
      deploy_target: src.deploy_target,
      status: prior?.status ?? "proposed",
      owner: "eric@headyconnection.org",
      license: "UNLICENSED",
      private_paths: [],
      ...(prior?.last_sync_hash ? { last_sync_hash: prior.last_sync_hash } : {}),
    };
    const mv = validateProjectionManifest(manifest);
    if (!mv.ok) { log("error", "manifest invalid", { id: c.id, errors: mv.errors }); failed++; results.push({ id: c.id, ok: false, reason: "invalid manifest" }); continue; }

    const files = collectSource(ROOT, src.source_path, { privatePaths: manifest.private_paths ?? [] });
    const bee = runProjectionBee({ manifest, sourceFiles: files, sourceSha, nowIso });
    if (!bee.ok) { log("error", "projection failed", { id: c.id, errors: bee.errors }); failed++; results.push({ id: c.id, ok: false, reason: "projection error" }); continue; }

    if (!dryRun) {
      mkdirSync(join(ROOT, "configs/projections"), { recursive: true });
      mkdirSync(join(ROOT, ".data/projections"), { recursive: true });
      writeFileSync(join(ROOT, `configs/projections/${c.id}.projection.json`), `${JSON.stringify(bee.nextManifest, null, 2)}\n`);
      writeFileSync(join(ROOT, `.data/projections/${c.id}.server-manifest.json`), `${JSON.stringify(bee.serverManifest, null, 2)}\n`);
    }
    log("info", "projected", { id: c.id, drift: bee.drift, status: bee.status, files: files.length, source_path: src.source_path, confirmed: src.confirmed === true });
    results.push({ id: c.id, ok: true, drift: bee.drift, status: bee.status, confirmed: src.confirmed === true });
  }

  const unconfirmed = results.filter((r) => r.ok && !r.confirmed).map((r) => r.id);
  log(failed ? "error" : "info", `generate complete${dryRun ? " (dry-run)" : ""}`, {
    candidates: candidates.length, ok: results.filter((r) => r.ok).length, failed,
    unconfirmed_sources: unconfirmed, sourceSha,
  });
  process.exit(failed ? 2 : 0);
}

main(process.argv.slice(2));
