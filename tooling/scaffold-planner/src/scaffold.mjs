#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ heady-scaffold CLI v1.0.0                                 ║
// ║  Native interface to the interactive rebuild plan. Two builds:    ║
// ║  --build v1 (Heady-V1 legacy) | --build ai (Heady-AI rebuild).    ║
// ║  plan · status · accept · defer · replan · verify · sync.         ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { flattenBuild, applyDecisions, setDecision, summarize, verifyPlan } from "./core.mjs";
import { PATHS, REPO_ROOT, loadPlan, loadDecisions, saveDecisions } from "./store.mjs";
import { startScaffoldServer } from "./server.mjs";

const PORTAL_COPY = PATHS.portalCopy;
const STATE_ICON = { done: "✓", "in-progress": "◐", pending: "○", deferred: "⏸", accepted: "✓", replan: "↻" };
const write = (s) => process.stdout.write(s);

function flag(argv, name, fallback) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}
function buildId(argv) {
  const b = flag(argv, "--build", "ai").toLowerCase();
  return b === "v1" || b === "heady-v1" ? "heady-v1" : "heady-ai";
}

function cmdPlan(argv) {
  const plan = loadPlan();
  const id = buildId(argv);
  const { build, rows } = flattenBuild(plan, id);
  const decorated = applyDecisions(rows, loadDecisions());
  if (argv.includes("--json")) return write(`${JSON.stringify({ build, options: decorated }, null, 2)}\n`);
  write(`\n${build.label}  ·  ${build.root}\n${build.summary}\n\n`);
  let group = null;
  for (const r of decorated) {
    if (r.group !== group) { group = r.group; write(`  ── ${group} ──\n`); }
    const dec = r.decision !== "pending" ? `  ⟦${STATE_ICON[r.decision] ?? ""}${r.decision}${r.note ? `: ${r.note}` : ""}⟧` : "";
    write(`  ${STATE_ICON[r.state] ?? "·"} ${r.id.padEnd(22)} ${r.title}${dec}\n`);
  }
  write("\n");
}

function cmdStatus(argv) {
  const plan = loadPlan();
  const id = buildId(argv);
  const { build, rows } = flattenBuild(plan, id);
  const s = summarize(applyDecisions(rows, loadDecisions()));
  if (argv.includes("--json")) return write(`${JSON.stringify({ build: build.id, ...s }, null, 2)}\n`);
  write(`\n${build.label}: ${s.total} options\n`);
  write(`  decisions: ${Object.entries(s.byDecision).map(([k, n]) => `${n} ${k}`).join(" · ")}\n`);
  write(`  state:     ${Object.entries(s.byState).map(([k, n]) => `${n} ${k}`).join(" · ")}\n\n`);
}

function knownIds(plan) {
  const ids = new Set();
  for (const b of Object.keys(plan.builds)) for (const r of flattenBuild(plan, b).rows) ids.add(r.id);
  return ids;
}

const VERB_TO_DECISION = { accept: "accepted", defer: "deferred", replan: "replan" };

async function cmdDecide(verb, argv) {
  const decision = VERB_TO_DECISION[verb];
  const plan = loadPlan();
  const id = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--note");
  if (!id) throw new Error(`${verb} requires an option id (see: heady-scaffold plan)`);
  if (!knownIds(plan).has(id)) throw new Error(`unknown option id "${id}"`);
  const note = flag(argv, "--note", undefined);
  const decisions = setDecision(loadDecisions(), id, decision, note, new Date().toISOString());
  saveDecisions(decisions);
  write(`\n  ${STATE_ICON[decision]} ${decision} ${id}${note ? ` — ${note}` : ""}\n`);

  if (decision === "replan") {
    const url = process.env.HEADYBUDDY_URL;
    if (!url) {
      write(`  ↳ HeadyBuddy not connected — replan recorded locally. Set HEADYBUDDY_URL to converse.\n\n`);
      return;
    }
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...(process.env.HEADYBUDDY_TOKEN ? { authorization: `Bearer ${process.env.HEADYBUDDY_TOKEN}` } : {}) },
        body: JSON.stringify({ kind: "scaffold.replan", optionId: id, note: note ?? null }),
      });
      const body = await res.json().catch(() => ({}));
      write(`  ↳ HeadyBuddy: ${res.ok ? (body.reply ?? "received") : `HTTP ${res.status}`}\n\n`);
    } catch (err) {
      write(`  ↳ HeadyBuddy unreachable (${err.message}); replan recorded locally.\n\n`);
    }
  } else {
    write("\n");
  }
}

function cmdVerify(argv) {
  const plan = loadPlan();
  const result = verifyPlan(plan, (rel) => existsSync(join(REPO_ROOT, rel)));
  if (argv.includes("--json")) return write(`${JSON.stringify(result, null, 2)}\n`);
  write(`\nscaffold plan verify: ${result.ok ? "OK" : "ERRORS"}\n`);
  for (const f of result.findings) write(`  ${f.level === "error" ? "✗" : "▲"} [${f.id}] ${f.message}\n`);
  if (!result.findings.length) write("  ✓ no drift — every done package resolves, ids unique\n");
  write("\n");
  process.exitCode = result.ok ? 0 : 1;
}

function cmdSync() {
  const raw = readFileSync(PATHS.plan, "utf8");
  mkdirSync(dirname(PORTAL_COPY), { recursive: true });
  writeFileSync(PORTAL_COPY, raw);
  write(`\n  ✓ synced plan → ${PORTAL_COPY.replace(`${REPO_ROOT}/`, "")} (served to the AdminUI section)\n\n`);
}

function cmdServe() {
  // Shared decision state for both interfaces (web + CLI converge on .data/scaffold/decisions.json).
  startScaffoldServer({ token: process.env.SCAFFOLD_TOKEN });
}

async function main(argv) {
  const cmd = argv[0] ?? "plan";
  try {
    if (cmd === "plan") return cmdPlan(argv.slice(1));
    if (cmd === "status") return cmdStatus(argv.slice(1));
    if (cmd === "accept" || cmd === "defer" || cmd === "replan") return await cmdDecide(cmd, argv.slice(1));
    if (cmd === "verify") return cmdVerify(argv.slice(1));
    if (cmd === "sync") return cmdSync();
    if (cmd === "serve") return cmdServe();
    process.stderr.write(`heady-scaffold: unknown command "${cmd}". Use: plan | status | accept | defer | replan | verify | sync | serve [--build v1|ai] [--note]\n`);
    process.exitCode = 2;
  } catch (err) {
    process.stderr.write(`heady-scaffold: ${err.message}\n`);
    process.exitCode = 2;
  }
}

function isProgramEntry() {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; }
}
if (isProgramEntry()) main(process.argv.slice(2));

export { loadPlan };
