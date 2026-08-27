#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Change Awareness CLI v1.0.0                              ║
// ║  heady-awareness <command>                                        ║
// ║   react           react to a change once (gate→embed→snapshot)    ║
// ║   context         print the current-state snapshot (read-only)    ║
// ║   propose-squash  NON-destructive intelligent squash proposal     ║
// ║   install-hooks   wire git-event triggers (idempotent/reversible) ║
// ║   uninstall-hooks remove the awareness git hooks                  ║
// ║   status          service health + metrics                        ║
// ║   serve           run the service (optional --poll HEAD loop)      ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createAwarenessService } from "./service.mjs";
import { react } from "./react.mjs";
import { buildContextSnapshot } from "./context.mjs";
import { proposeSquash } from "./squash.mjs";
import { installHooks, uninstallHooks, hooksStatus } from "./hooks.mjs";
import { openState } from "./state.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const VECTOR_MEMORY_DIR = join(REPO_ROOT, ".data", "vector-memory");
const STATE_DIR = join(REPO_ROOT, ".data", "awareness");

const out = (s) => process.stdout.write(`${s}\n`);
const has = (argv, flag) => argv.includes(flag);
function opt(argv, name, fallback = null) {
  const i = argv.indexOf(name);
  return i !== -1 && i + 1 < argv.length ? argv[i + 1] : fallback;
}

function fmtList(items, empty = "(none)") {
  return items.length ? items.map((x) => `    • ${x}`).join("\n") : `    ${empty}`;
}

async function cmdReact(argv) {
  const json = has(argv, "--json");
  const quiet = has(argv, "--quiet");
  const trigger = opt(argv, "--trigger", "manual");
  const embedOpts = { dryRun: has(argv, "--dry-run"), allowHf: has(argv, "--allow-hf") };
  const result = await react({ repoRoot: REPO_ROOT, vectorMemoryDir: VECTOR_MEMORY_DIR, stateDir: STATE_DIR, trigger, embedOpts });
  if (json) return out(JSON.stringify(result, null, 2));
  if (quiet) return; // hook-invoked path stays silent
  const s = result.snapshot;
  out(`\nHEADY™ awareness — reacted (${trigger})`);
  out(`  head        : ${s.repo.headShort ?? "—"} @ ${s.repo.branch ?? "detached"}${s.repo.dirty ? " (dirty)" : ""}`);
  out(`  changes     : ${s.changes.committedCount} committed since last seen, ${s.changes.uncommittedCount} uncommitted`);
  out(`  gate        : ${s.consistency.gateOk === null ? "unknown" : s.consistency.gateOk ? "PASS" : "BLOCKED"}`);
  out(`  merkle root : ${s.vectorMemory.merkleRoot ? s.vectorMemory.merkleRoot.slice(0, 16) + "…" : "—"} (${s.vectorMemory.merkleCount} files)`);
  out(`  embed       : ${s.vectorMemory.pendingEmbedJobs} pending; embedder ${s.vectorMemory.embedderBound ? "BOUND (vectors live)" : "UNBOUND (enqueue-only)"}`);
  out(`  currency    : ${s.currency.fresh ? "FRESH" : `stale — ${s.currency.blockedReason ?? "uncommitted edits"}`}\n`);
}

function cmdContext(argv) {
  const state = openState(STATE_DIR);
  const sinceHead = state.readState().lastSeenHead;
  const snapshot = buildContextSnapshot({ repoRoot: REPO_ROOT, vectorMemoryDir: VECTOR_MEMORY_DIR, nowIso: new Date().toISOString(), sinceHead });
  state.writeContext(snapshot); // keep the on-disk artifact current for any AI / SSE consumer
  if (has(argv, "--json")) return out(JSON.stringify(snapshot, null, 2));
  out(`\nHEADY™ current-state context  (${snapshot.generatedAt})`);
  out(`  repo       : ${snapshot.repo.headShort} @ ${snapshot.repo.branch} → upstream ${snapshot.repo.upstream ?? "—"}`);
  out(`  gate       : ${snapshot.consistency.gateOk === null ? "unknown" : snapshot.consistency.gateOk ? "PASS" : "BLOCKED"}`);
  out(`  vectors    : model ${snapshot.vectorMemory.model ?? "—"} dim ${snapshot.vectorMemory.dim ?? "—"}; ledger ${snapshot.vectorMemory.ledgerSize}; ${snapshot.vectorMemory.pendingEmbedJobs} pending`);
  out(`  embedder   : ${snapshot.vectorMemory.embedderBound ? "BOUND" : "UNBOUND (enqueue-only)"}`);
  out(`  currency   : ${snapshot.currency.fresh ? "FRESH" : `stale — ${snapshot.currency.blockedReason ?? "uncommitted edits"}`}`);
  out(`  recent commits:`);
  out(fmtList(snapshot.changes.recentCommits.slice(0, 8).map((c) => `${c.sha} ${c.subject}`)));
  out("");
}

function cmdProposeSquash(argv) {
  const proposal = proposeSquash({ repoRoot: REPO_ROOT, base: opt(argv, "--base"), head: opt(argv, "--head", "HEAD"), nowIso: new Date().toISOString() });
  openState(STATE_DIR).writeSquash(proposal);
  if (has(argv, "--json")) return out(JSON.stringify(proposal, null, 2));
  out(`\nHEADY™ squash proposal  (NON-destructive — review before running)`);
  out(`  range       : ${proposal.range ?? "—"}`);
  if (proposal.noop) {
    out(`  result      : no-op — ${proposal.reason}\n`);
    return;
  }
  out(`  commits     : ${proposal.commitCount} → ${proposal.clusterCount} cluster(s) @ τ=${proposal.clusterTau.toFixed(3)}`);
  out(`  ${proposal.recommendation}`);
  proposal.clusters.forEach((c, i) => {
    out(`\n  ── cluster ${i + 1} (${c.commits.length} commit(s), ${c.fileCount} file(s)) ──`);
    out(`     message: ${c.message}`);
    c.commits.forEach((cm) => out(`       · ${cm.sha} ${cm.subject}`));
  });
  out(`\n  suggested commands (NOT executed — requires your confirmation):`);
  proposal.commands.forEach((cmd) => out(`     $ ${cmd}`));
  out("");
}

function cmdInstallHooks() {
  const r = installHooks(REPO_ROOT);
  out(`\nHEADY™ awareness hooks installed → ${r.hooksDir}`);
  out(fmtList(r.installed));
  out(`  reverse with: heady-awareness uninstall-hooks\n`);
}

function cmdUninstallHooks() {
  const r = uninstallHooks(REPO_ROOT);
  out(`\nHEADY™ awareness hooks removed from → ${r.hooksDir}`);
  out(fmtList(r.cleaned, "(none were installed)"));
  out("");
}

function cmdStatus(argv) {
  const svc = createAwarenessService({ repoRoot: REPO_ROOT, vectorMemoryDir: VECTOR_MEMORY_DIR, stateDir: STATE_DIR });
  const health = svc.health();
  const metrics = svc.metrics();
  if (has(argv, "--json")) return out(JSON.stringify({ health, metrics }, null, 2));
  out(`\nHEADY™ awareness — ${health.status.toUpperCase()}`);
  out(`  head        : ${health.head ?? "—"} @ ${health.branch ?? "detached"}`);
  out(`  gate        : ${health.gateOk === null ? "unknown" : health.gateOk ? "PASS" : "BLOCKED"}`);
  out(`  embedder    : ${health.embedderBound ? "BOUND (vectors live)" : "UNBOUND (enqueue-only)"}`);
  out(`  hooks       : ${health.hooks.length ? health.hooks.join(", ") : "not installed"}`);
  out(`  last react  : ${health.lastReactionAt ?? "never"} (${health.lastTrigger ?? "—"})`);
  out(`  metrics     : ${metrics.reactions} reactions, ${metrics.gateBlocks} gate-blocks, ${metrics.jobsEnqueued} jobs enqueued, ${metrics.errors} errors`);
  out(`  pending     : ${metrics.pendingEmbedJobs} embed job(s); ledger ${metrics.ledgerSize}\n`);
}

async function cmdServe(argv) {
  const poll = has(argv, "--poll");
  const svc = createAwarenessService({ repoRoot: REPO_ROOT, vectorMemoryDir: VECTOR_MEMORY_DIR, stateDir: STATE_DIR });
  const health = await svc.start({ installGitHooks: true, poll, reactNow: true });
  out(`\nHEADY™ awareness service — ${health.status.toUpperCase()} (hooks: ${health.hooks.join(", ") || "none"}, poll: ${poll})`);
  out(`  Heady & external AIs read current data from: .data/awareness/context.json`);
  out(`  durable event stream: .data/awareness/lens.ndjson  ·  Ctrl-C to stop\n`);
  const shutdown = () => { svc.stop(); process.exit(0); };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  if (!poll) {
    // Hooks drive reactions; nothing to keep alive. Print health and exit cleanly.
    out("  (no --poll: git hooks are the trigger; service initialized and exiting)\n");
    svc.stop();
  }
}

function help() {
  out(`HEADY™ Change Awareness — heady-awareness <command>

  react            React to a change once: fail-closed gate → Merkle embed → snapshot → event.
                   flags: --trigger <name> --json --quiet --dry-run --allow-hf
  context          Print the current-state snapshot any AI reads (read-only).  flags: --json
  propose-squash   NON-destructive intelligent squash proposal.  flags: --base <ref> --head <ref> --json
  install-hooks    Install git-event triggers (post-commit/merge/checkout/rewrite). Idempotent.
  uninstall-hooks  Remove the awareness git hooks (preserves any user hook content).
  status           Service health + cumulative metrics.  flags: --json
  serve            Initialize the service; --poll arms the φ⁷≈29s HEAD-poll loop.
`);
}

async function main() {
  const [cmd, ...argv] = process.argv.slice(2);
  switch (cmd) {
    case "react": return cmdReact(argv);
    case "context": return cmdContext(argv);
    case "propose-squash": return cmdProposeSquash(argv);
    case "install-hooks": return cmdInstallHooks();
    case "uninstall-hooks": return cmdUninstallHooks();
    case "status": return cmdStatus(argv);
    case "serve": return cmdServe(argv);
    case "help": case "--help": case "-h": case undefined: return help();
    default:
      process.stderr.write(`heady-awareness: unknown command "${cmd}"\n`);
      help();
      process.exitCode = 2;
  }
}

main().catch((err) => {
  process.stderr.write(`heady-awareness: ${err.stack ?? err.message}\n`);
  process.exitCode = 1;
});
