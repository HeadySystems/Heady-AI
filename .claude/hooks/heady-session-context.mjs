#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Session Context — SessionStart Hook v1.0.0               ║
// ║  Injects live repo state so each session starts grounded in      ║
// ║  current branch/HEAD/source-of-truth files, not a stale snapshot.║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Wired into .claude/settings.json (SessionStart). Emits the
// additionalContext contract on stdout:
//   { hookSpecificOutput: { hookEventName, additionalContext } }
// Always exits 0 — context injection must never block a session.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
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

const SOURCE_OF_TRUTH = [
  "AGENTS.md",
  "CLAUDE_MEMORY.md",
  "governance/CONSTITUTION.md",
  "governance/PRIME_DIRECTIVE.md",
  "facts.yaml",
  "turbo.json",
  "pnpm-workspace.yaml",
];
const present = SOURCE_OF_TRUTH.filter((f) => existsSync(resolve(REPO_ROOT, f)));

const additionalContext = [
  `HEADY SESSION CONTEXT (auto-loaded ${new Date().toISOString()}):`,
  `- Branch: ${branch} @ ${headSha} — "${headSubject}"`,
  `- Source-of-truth files present: ${present.length ? present.join(", ") : "(none found)"}`,
  `- Read AGENTS.md (architecture rules) and CLAUDE_MEMORY.md (handoff state) BEFORE`,
  `  authoring; follow their pointers. They are the spec — neighbouring files are not.`,
  `- Context budget: 1M window, auto-compact at the boundary, xhigh effort. Use the`,
  `  full window — read whole files and configs rather than fragments.`,
  `- The 8+1 Unbreakable Laws are CI-enforced: new code under the scanned trees must`,
  `  pass the cloud-only-URL, structured-logging, and credential-signature gates.`,
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
