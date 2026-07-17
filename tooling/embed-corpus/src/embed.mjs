#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Corpus Embedding Workflow v1.0.0                          ║
// ║  Gate-then-embed: bring files to current spec + prove global      ║
// ║  consistency, THEN systematically embed the corpus.               ║
// ║  Phases: 0 spec-sync → 1 consistency-gate (fail-closed) →         ║
// ║  2 scan → 3 merkle-trigger (ADR-0023) → 4 embed (ADR-0024) →      ║
// ║  5 commit. Embedding NEVER runs unless the gate passes.           ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { check, loadInvariants } from "../../data-consistency/src/cli.mjs";
import { collectFiles } from "../../data-consistency/src/scan.mjs";
import { planCorpusEmbedding } from "../../../packages/embedding/src/corpus.mjs";
import { resolveEmbedder, hfTokenPresent } from "./embedder.mjs";
import { embedJobs, mergeOutbox } from "./pipeline.mjs";
import { createStore, FILES } from "./store.mjs";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

async function fetchCloudflareSecrets() {
  if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) return;
  try {
    const client = new SecretManagerServiceClient();
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || "heady-ai";
    const [acc] = await client.accessSecretVersion({ name: `projects/${projectId}/secrets/CLOUDFLARE_ACCOUNT_ID/versions/latest` });
    if (acc?.payload?.data) process.env.CLOUDFLARE_ACCOUNT_ID = acc.payload.data.toString("utf8");
    const [token] = await client.accessSecretVersion({ name: `projects/${projectId}/secrets/CLOUDFLARE_API_TOKEN/versions/latest` });
    if (token?.payload?.data) process.env.CLOUDFLARE_API_TOKEN = token.payload.data.toString("utf8");
  } catch (err) {
    // Fall back to environment variables / graceful fail
  }
}

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const VECTOR_MEMORY_DIR = join(REPO_ROOT, ".data", "vector-memory");
const SYNC_CLI = join(REPO_ROOT, "tooling", "data-consistency", "src", "sync.mjs");

const SEV_ICON = { error: "✗", warn: "▲", info: "·" };

/** Phase 0 — best-effort legacy→rebuild spec migration. Never fatal; the gate is the authority. */
function runSpecSync() {
  const r = spawnSync(process.execPath, [SYNC_CLI, "pull"], { encoding: "utf8" });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const applied = [...out.matchAll(/applied (\d+) update/g)].reduce((n, m) => n + Number(m[1]), 0);
  const reachable = !/no flow sources were reachable/.test(out);
  return { applied, reachable, raw: out.trim() };
}

/** Map the consistency gate result to the in-scope corpus files (canonical + extended). */
function scanCorpus() {
  const cfg = loadInvariants();
  const sets = collectFiles(REPO_ROOT, cfg.scope);
  return [...sets.canonical, ...sets.extended].map((f) => ({ rel: f.rel, content: f.content }));
}

function printGateFailure(result, write) {
  write(`\nHEADY™ corpus embedding — BLOCKED at the consistency gate.\n`);
  write(`  files are not at current spec / globally consistent; embedding did NOT run.\n\n`);
  for (const f of result.findings) {
    write(`  ${SEV_ICON[f.severity] ?? "?"} [${f.invariant}] ${f.file}:${f.line}:${f.column}\n`);
    write(`      ${f.excerpt}\n`);
    if (f.fix) write(`      fix → ${f.fix}\n`);
  }
  write(
    `\n  summary: ${result.summary.errors} error(s), ${result.summary.warns} warning(s). ` +
      `Resolve, then re-run.\n`,
  );
}

async function run(argv) {
  const dryRun = argv.includes("--dry-run");
  const strict = argv.includes("--strict");
  const asJson = argv.includes("--json");
  const skipSync = argv.includes("--no-sync");
  const allowHf = argv.includes("--allow-hf");
  const write = (s) => process.stdout.write(s);
  const nowIso = new Date().toISOString();

  // ── Phase 0 — spec sync (best-effort) ─────────────────────────────────────
  const sync = skipSync ? { applied: 0, reachable: false, raw: "(skipped)" } : runSpecSync();

  // ── Phase 1 — consistency gate (FAIL-CLOSED precondition) ─────────────────
  const gate = check();
  const blocked = !gate.summary.ok || (strict && gate.summary.warns > 0);
  if (blocked) {
    if (asJson) {
      write(`${JSON.stringify({ status: "blocked", phase: "consistency-gate", gate: gate.summary, findings: gate.findings }, null, 2)}\n`);
    } else {
      printGateFailure(gate, write);
    }
    process.exitCode = 1;
    return;
  }

  // ── Phase 2 — scan the gate-governed corpus ───────────────────────────────
  const files = scanCorpus();

  // ── Phase 3 — Merkle trigger + plan (ADR-0023 / ADR-0024) ─────────────────
  const store = createStore(VECTOR_MEMORY_DIR);
  const prevIndex = store.readJson(FILES.MERKLE, null);
  const ledger = store.readJson(FILES.LEDGER, {});
  const plan = planCorpusEmbedding({ files, prevIndex, ledger });

  // ── Phase 4 — embed (every ledger-missing job; locked model) ──────────────
  await fetchCloudflareSecrets();
  const embedder = resolveEmbedder(process.env, { allowHf });
  const hfGated = !embedder && hfTokenPresent() && !allowHf;
  let embedded = 0;
  let committedVectors = null;
  let committedLedger = null;
  if (embedder && plan.jobs.length > 0 && !dryRun) {
    const maps = { vectors: store.readJson(FILES.VECTORS, {}), ledger: store.readJson(FILES.LEDGER, {}) };
    const res = await embedJobs(plan.jobs, embedder, maps, nowIso);
    committedVectors = res.vectors;
    committedLedger = res.ledger;
    embedded = res.embedded;
  }

  // ── Phase 5 — commit durable artifacts (atomic) ───────────────────────────
  const report = {
    status: "ok",
    ranAt: nowIso,
    embedderBound: Boolean(embedder),
    serving: embedder?.serving ?? null,
    hfAvailableButGated: hfGated,
    dryRun,
    specSync: { applied: sync.applied, sourcesReachable: sync.reachable },
    gate: gate.summary,
    merkle: { algorithm: plan.nextIndex.algorithm, root: plan.nextIndex.root, count: plan.nextIndex.count },
    plan: plan.summary,
    embedded,
    enqueued: plan.jobs.length - embedded,
    tombstones: plan.tombstones,
  };

  if (!dryRun) {
    const outbox = mergeOutbox(store.readJson(FILES.JOBS, {}), plan.jobs);
    store.writeJson(FILES.JOBS, outbox);
    store.writeJson(FILES.MERKLE, plan.nextIndex);
    if (committedVectors) store.writeJson(FILES.VECTORS, committedVectors);
    if (committedLedger) store.writeJson(FILES.LEDGER, committedLedger);
    store.writeJson(FILES.REPORT, report);
  }

  if (asJson) {
    write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  write(`\nHEADY™ corpus embedding workflow — ${dryRun ? "DRY RUN" : "COMMITTED"}\n`);
  write(`  phase 0 spec-sync : applied ${sync.applied} update(s); legacy sources ${sync.reachable ? "reachable" : "not reachable (no-op)"}\n`);
  write(`  phase 1 gate      : PASS (${gate.summary.errors} error, ${gate.summary.warns} warn) — embedding authorized\n`);
  write(`  phase 2 scan      : ${files.length} in-scope file(s) (${gate.summary.filesCanonical} canonical + ${gate.summary.filesExtended} extended)\n`);
  write(`  phase 3 merkle    : root ${plan.nextIndex.root.slice(0, 16)}… — ${plan.summary.added} added, ${plan.summary.changed} changed, ${plan.summary.unchanged} unchanged, ${plan.summary.removed} removed\n`);
  write(`  phase 4 plan      : ${plan.summary.jobsQueued} job(s) to embed (${plan.summary.backfill} backfill), ${plan.summary.dedupHits} already-embedded dedup hit(s)\n`);
  if (embedder) {
    write(`  phase 5 embed     : ${embedded} vector(s) written to the SoR projection (.data/vector-memory) via ${embedder.serving}\n`);
  } else if (plan.jobs.length === 0) {
    write(`  phase 5 embed     : corpus fully embedded — 0 pending\n`);
  } else if (hfGated) {
    write(`  phase 5 embed     : 0 embedded — ${plan.jobs.length} file(s) pending. A Hugging Face token is present but\n`);
    write(`                      HF serving is NON-locked and would transmit corpus content (incl. patent IP) to a\n`);
    write(`                      third party. Re-run with --allow-hf to consent, or set Cloudflare Workers AI creds.\n`);
  } else {
    write(`  phase 5 embed     : 0 embedded — NO embedder binding on this host; ${plan.jobs.length} file(s) remain UN-embedded\n`);
    write(`                      set CLOUDFLARE_ACCOUNT_ID + a Workers AI token and re-run to embed them.\n`);
  }
  write(`  artifacts         : ${dryRun ? "(dry run — nothing written)" : ".data/vector-memory/{merkle-index,embedding-jobs,ledger,vectors,embed-corpus-report}.json"}\n\n`);
}

run(process.argv.slice(2)).catch((err) => {
  process.stderr.write(`heady-embed: ${err.stack ?? err.message}\n`);
  process.exitCode = 2;
});
