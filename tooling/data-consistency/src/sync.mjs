#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Legacy→Rebuild Sync System v1.0.0                        ║
// ║  Pulls data from the current Heady build into the rebuild:        ║
// ║  transform → validate (consistency gate) → record provenance.     ║
// ║  Supersedes scratch/migrate_skills.js (CommonJS, ungated).        ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// "Ensures data is updated for the rebuild when taken from the current build":
// every source file is content-addressed (sha256). Re-running the sync detects
// which legacy sources changed and re-applies only those (incremental, like the
// embedding pipeline's content-addressed dedup). Every write is recorded in a
// provenance manifest and the global consistency gate runs as the exit check.
//
// Commands:
//   heady-sync status        show legacy sources that are new/changed/in-sync (no writes)
//   heady-sync pull [flow]    apply transforms for changed sources, then run the gate
//   heady-sync list           list registered flows

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
  statSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { homedir } from "node:os";

import { check } from "./cli.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TOOL_ROOT = join(HERE, "..");
const REPO_ROOT = join(TOOL_ROOT, "..", "..");
const PROVENANCE_DIR = join(TOOL_ROOT, ".provenance");

function expandHome(p) {
  return p.startsWith("~") ? join(homedir(), p.slice(1)) : p;
}

const TRANSFORM_VERSION = "1.0.0";

const PREAMBLE = `> **OPTIMAL BUILD NOTICE:** This file was auto-migrated from the current Heady build into the Heady-AI Latent OS (v2.0.0) by \`@heady/data-consistency\` sync.
> - **Package Manager:** \`pnpm\` + \`Turborepo\`
> - **Stores:** Neon pgvector (authority) · Vectorize (derived edge cache, 384-dim) · Redis/KV (best-effort). **Qdrant dropped (ADR-0003 amended, R2).**
> - **Embedding lock:** \`@cf/baai/bge-small-en-v1.5\`, 384-dim, mean (ADR-0015)
> - **Rule File:** Follow \`AGENTS.md\`

`;

/**
 * Canonical transform applied to every migrated document. Idempotent: skips the
 * preamble if already present. Rewrites legacy paths, npm→pnpm, and the dropped
 * Qdrant store reference toward the locked pgvector/Vectorize model.
 */
function transform(content) {
  let out = content;
  out = out.replace(/\/home\/headyme\/Heady(?!-AI)/g, "/home/headyme/Heady-AI");
  out = out.replace(/\bnpm install\b/g, "pnpm install");
  out = out.replace(/\bnpm run\b/g, "pnpm run");
  out = out.replace(/\bnpm i\s/g, "pnpm add ");
  out = out.replace(/\bnpx turbo\b/g, "pnpm turbo");
  out = out.replace(/\bnpm audit\b/g, "pnpm audit");
  // Spec-conformance rewrites (defense-in-depth; the consistency gate is the hard backstop):
  // migrate unambiguous dropped-store drift toward the locked stack — Qdrant is dropped, the
  // authority is Neon pgvector and the derived edge cache is Vectorize (ADR-0003 amended, R2).
  out = out.replace(/\bQdrant\s*\+\s*pgvector\b/g, "Neon pgvector (authority) → Vectorize (edge cache)");
  out = out.replace(/\bStore in Qdrant\b/g, "Store in Neon pgvector (authority), projected to Vectorize");
  if (!out.includes("OPTIMAL BUILD NOTICE")) out = PREAMBLE + out;
  return out;
}

/** Strip leading index and trailing -SKILL from a skill filename. */
function skillNameFromFile(file) {
  return file
    .replace(/\.md$/, "")
    .replace(/^\d+-/, "")
    .replace(/-SKILL$/, "");
}

/**
 * Flow registry — the real legacy→rebuild data flows that exist today. Each
 * flow enumerates source files and maps each to a rebuild target path.
 */
const FLOWS = [
  {
    id: "skills",
    description: "Dropzone skill library → .agents/skills/<name>/SKILL.md",
    sourceDir: "~/Heady/dropzone/06-Skills-Library",
    enumerate(sourceDir) {
      if (!existsSync(sourceDir)) return [];
      return readdirSync(sourceDir)
        .filter(
          (f) =>
            f.endsWith(".md") &&
            !["MANIFEST.md", "NEW-SKILLS-SUMMARY.md", "SKILL.md"].includes(f),
        )
        .map((f) => ({
          source: join(sourceDir, f),
          target: join(REPO_ROOT, ".agents", "skills", skillNameFromFile(f), "SKILL.md"),
        }));
    },
  },
];

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function manifestPath(flowId) {
  return join(PROVENANCE_DIR, `${flowId}.json`);
}

function loadManifest(flowId) {
  const p = manifestPath(flowId);
  if (!existsSync(p)) return { flow: flowId, transformVersion: TRANSFORM_VERSION, entries: {} };
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (err) {
    throw new Error(`provenance manifest ${p} is corrupt: ${err.message}`);
  }
}

function saveManifest(flowId, manifest) {
  if (!existsSync(PROVENANCE_DIR)) mkdirSync(PROVENANCE_DIR, { recursive: true });
  writeFileSync(manifestPath(flowId), `${JSON.stringify(manifest, null, 2)}\n`);
}

/** Classify each source as new | changed | in-sync against the manifest. */
function planFlow(flow, nowIso) {
  const sourceDir = expandHome(flow.sourceDir);
  const reachable = existsSync(sourceDir);
  const manifest = loadManifest(flow.id);
  const items = reachable ? flow.enumerate(sourceDir) : [];
  const plan = [];
  for (const item of items) {
    const raw = readFileSync(item.source, "utf8");
    const sourceHash = sha256(raw);
    const prev = manifest.entries[item.source];
    let state = "new";
    if (prev) {
      state =
        prev.sourceHash === sourceHash && prev.transformVersion === TRANSFORM_VERSION
          ? "in-sync"
          : "changed";
    }
    plan.push({ ...item, raw, sourceHash, state });
  }
  return { flow, sourceDir, reachable, manifest, plan, nowIso };
}

function applyFlow(planned) {
  const { flow, manifest, plan, nowIso } = planned;
  const applied = [];
  for (const item of plan) {
    if (item.state === "in-sync") continue;
    const transformed = transform(item.raw);
    const dir = dirname(item.target);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(item.target, transformed);
    manifest.entries[item.source] = {
      target: item.target.replace(`${REPO_ROOT}/`, ""),
      sourceHash: item.sourceHash,
      outputHash: sha256(transformed),
      transformVersion: TRANSFORM_VERSION,
      state: item.state,
      syncedAt: nowIso,
    };
    applied.push({ source: item.source, target: item.target, state: item.state });
  }
  manifest.transformVersion = TRANSFORM_VERSION;
  manifest.lastSyncAt = nowIso;
  saveManifest(flow.id, manifest);
  return applied;
}

function selectFlows(flowId) {
  if (!flowId) return FLOWS;
  const f = FLOWS.find((x) => x.id === flowId);
  if (!f) throw new Error(`unknown flow "${flowId}". Known: ${FLOWS.map((x) => x.id).join(", ")}`);
  return [f];
}

function cmdList() {
  const out = ["", "Registered legacy→rebuild sync flows:", ""];
  for (const f of FLOWS) {
    out.push(`  ${f.id} — ${f.description}`);
    out.push(`      source: ${f.sourceDir}${existsSync(expandHome(f.sourceDir)) ? "" : "  (NOT REACHABLE)"}`);
  }
  out.push("");
  process.stdout.write(out.join("\n"));
}

function cmdStatus(flowId, nowIso) {
  const out = ["", "HEADY™ sync status (no writes):", ""];
  for (const flow of selectFlows(flowId)) {
    const planned = planFlow(flow, nowIso);
    if (!planned.reachable) {
      out.push(`  [${flow.id}] source not reachable: ${planned.sourceDir}`);
      continue;
    }
    const counts = { new: 0, changed: 0, "in-sync": 0 };
    for (const i of planned.plan) counts[i.state]++;
    out.push(
      `  [${flow.id}] ${planned.plan.length} source(s): ${counts.new} new, ${counts.changed} changed, ${counts["in-sync"]} in-sync`,
    );
    for (const i of planned.plan.filter((x) => x.state !== "in-sync")) {
      out.push(`      ${i.state.toUpperCase()} ${i.source}`);
    }
  }
  out.push("");
  process.stdout.write(out.join("\n"));
}

function cmdPull(flowId, nowIso) {
  const out = ["", "HEADY™ sync pull:", ""];
  let totalApplied = 0;
  let anyReachable = false;
  for (const flow of selectFlows(flowId)) {
    const planned = planFlow(flow, nowIso);
    if (!planned.reachable) {
      out.push(`  [${flow.id}] SKIPPED — source not reachable: ${planned.sourceDir}`);
      continue;
    }
    anyReachable = true;
    const applied = applyFlow(planned);
    totalApplied += applied.length;
    out.push(`  [${flow.id}] applied ${applied.length} update(s); provenance → ${manifestPath(flow.id).replace(`${REPO_ROOT}/`, "")}`);
    for (const a of applied) out.push(`      ${a.state.toUpperCase()} → ${a.target.replace(`${REPO_ROOT}/`, "")}`);
  }
  process.stdout.write(`${out.join("\n")}\n`);

  // Gate: run the single global consistency checker over the rebuild.
  const result = check();
  process.stdout.write(
    `\n  consistency gate: ${result.summary.ok ? "PASS" : "FAIL"} ` +
      `(${result.summary.errors} error(s), ${result.summary.warns} warning(s)).\n`,
  );
  if (!result.summary.ok) {
    process.stdout.write(
      "  ↳ run `node tooling/data-consistency/src/cli.mjs` for the full report; synced data introduced canonical inconsistencies.\n",
    );
  }
  if (!anyReachable) {
    process.stdout.write("  note: no flow sources were reachable from this host.\n");
  }
  process.exitCode = result.summary.ok ? 0 : 1;
  return totalApplied;
}

function main(argv) {
  const [cmd = "status", arg] = argv;
  const nowIso = new Date().toISOString();
  try {
    if (cmd === "list") return cmdList();
    if (cmd === "status") return cmdStatus(arg, nowIso);
    if (cmd === "pull") return cmdPull(arg, nowIso);
    process.stderr.write(`heady-sync: unknown command "${cmd}". Use: status | pull [flow] | list.\n`);
    process.exitCode = 2;
  } catch (err) {
    process.stderr.write(`heady-sync: ${err.message}\n`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && process.argv[1].endsWith("sync.mjs")) {
  main(process.argv.slice(2));
}

export { transform, skillNameFromFile, FLOWS, sha256 };
