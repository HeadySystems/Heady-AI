// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Awareness — Embed Bridge v1.0.0                           ║
// ║  Thin, authoritative bridge to the gate-then-embed workflow. The  ║
// ║  awareness service NEVER re-implements the gate→Merkle→embed       ║
// ║  pipeline; it spawns `heady-embed --json` and consumes the report  ║
// ║  so the LEDGER stays the single source of truth for "embedded"     ║
// ║  (CLAUDE_MEMORY §2) and there is exactly one embed code path.      ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const EMBED_CLI = join(HERE, "..", "..", "embed-corpus", "src", "embed.mjs");

/**
 * Run the gate-then-embed workflow once and return its parsed JSON report.
 * The workflow itself owns the fail-closed consistency gate, Merkle trigger,
 * and embed/enqueue decision — we only observe the outcome.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.dryRun]   pass --dry-run (plan only, write nothing)
 * @param {boolean} [opts.noSync]   pass --no-sync (skip legacy spec-sync hop)
 * @param {boolean} [opts.allowHf]  pass --allow-hf (consent to non-locked HF serving)
 * @returns {{ ok: boolean, blocked: boolean, report: object|null, raw: string, code: number }}
 */
export function runEmbed({ dryRun = false, noSync = true, allowHf = false } = {}) {
  const args = [EMBED_CLI, "--json"];
  if (dryRun) args.push("--dry-run");
  if (noSync) args.push("--no-sync");
  if (allowHf) args.push("--allow-hf");

  const r = spawnSync(process.execPath, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const raw = `${r.stdout ?? ""}`.trim();
  const code = r.status ?? -1;

  let report = null;
  try {
    report = raw ? JSON.parse(raw) : null;
  } catch {
    // The workflow prints strict JSON in --json mode; a parse miss means the
    // process died before emitting a report. Surface it, never fabricate one.
    report = null;
  }

  // exit 1 from embed.mjs === gate blocked (fail-closed). exit 0 === gate passed.
  const blocked = report?.status === "blocked" || code === 1;
  return { ok: code === 0 && !!report, blocked, report, raw, code };
}
