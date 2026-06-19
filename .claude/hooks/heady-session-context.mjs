#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Session Context — SessionStart Hook v2.0.0               ║
// ║  ACTIVE front door: reads the live @heady/awareness snapshot and  ║
// ║  fires a non-blocking awareness reaction so Heady registers the   ║
// ║  agent session as a durable event. Heady is an always-on          ║
// ║  projection system — this participates in it, it is not a sign.   ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Wired into .claude/settings.json (SessionStart). Emits the
// additionalContext contract on stdout:
//   { hookSpecificOutput: { hookEventName, additionalContext } }
// Always exits 0 — context injection must never block a session.

import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");

function git(args) {
  try {
    return execFileSync("git", args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch (err) {
    return ""; // git absent or not a repo — degrade gracefully, never throw
  }
}

const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]) || "detached";
const headSha = git(["rev-parse", "--short", "HEAD"]) || "unknown";
const headSubject = git(["log", "-1", "--pretty=%s"]) || "n/a";

// ── ACTIVE: read the live awareness snapshot any AI reads ────────────
function liveAwarenessLine() {
  const snapPath = resolve(REPO_ROOT, ".data/awareness/context.json");
  if (!existsSync(snapPath)) {
    return "- Awareness snapshot not present yet — run `heady-awareness serve --poll` (or `install-hooks`) to keep live state flowing.";
  }
  try {
    const s = JSON.parse(readFileSync(snapPath, "utf8"));
    const gate = s?.consistency?.gateOk;
    const gateTxt = gate === null || gate === undefined ? "unknown" : gate ? "PASS" : "BLOCKED";
    const fresh = s?.currency?.fresh ? "FRESH" : `stale (${s?.currency?.blockedReason ?? "uncommitted edits"})`;
    const bound = s?.vectorMemory?.embedderBound ? "bound" : "unbound/enqueue-only";
    const pending = s?.vectorMemory?.pendingEmbedJobs ?? "?";
    return `- LIVE awareness (.data/awareness/context.json @ ${s?.generatedAt ?? "?"}): gate ${gateTxt}, currency ${fresh}, embedder ${bound}, ${pending} embed job(s) pending.`;
  } catch (err) {
    return "- Awareness snapshot present but unreadable — treat live state as unknown.";
  }
}

// ── ACTIVE: fire a non-blocking awareness reaction (durable event) ───
// Registers this session in the awareness lens (.data/awareness/lens.ndjson) and
// refreshes the snapshot. Detached + unref'd so it never blocks session start.
function fireAwarenessReaction() {
  const cli = resolve(REPO_ROOT, "tooling/awareness/src/cli.mjs");
  if (!existsSync(cli)) return;
  try {
    const child = spawn(
      process.execPath,
      [cli, "react", "--quiet", "--trigger", "agent-session-start"],
      { cwd: REPO_ROOT, detached: true, stdio: "ignore" },
    );
    child.unref();
  } catch (err) {
    // Awareness optional / unavailable — never block the session on it.
  }
}

fireAwarenessReaction();

const SOURCE_OF_TRUTH = [
  "START_HERE.md",
  "AGENTS.md",
  "CLAUDE_MEMORY.md",
  "governance/CONSTITUTION.md",
  "facts.yaml",
];
const present = SOURCE_OF_TRUTH.filter((f) => existsSync(resolve(REPO_ROOT, f)));

const additionalContext = [
  `HEADY SESSION CONTEXT (auto-loaded ${new Date().toISOString()}):`,
  `- Branch: ${branch} @ ${headSha} — "${headSubject}"`,
  `- READ START_HERE.md FIRST — the agent front door: what's going on + exactly what`,
  `  to do. It routes you to AGENTS.md (rules) and CLAUDE_MEMORY.md (current state).`,
  liveAwarenessLine(),
  `- Fired a non-blocking awareness reaction (trigger=agent-session-start); on an`,
  `  installed workspace this records a durable event in .data/awareness/lens.ndjson.`,
  `- Source-of-truth files present: ${present.length ? present.join(", ") : "(none found)"}`,
  `- They are the spec — neighbouring files are examples, never a substitute.`,
  `- Context budget: 1M window, auto-compact at the boundary, xhigh effort. Use the`,
  `  full window — read whole files and configs rather than fragments.`,
  `- Heady is an always-on projection system: what you build for it should be ACTIVE`,
  `  (reacts/emits/stays current), not a passive file, unless it is genuinely inert.`,
].join("\n");

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext,
    },
  }),
);
process.exit(0);
