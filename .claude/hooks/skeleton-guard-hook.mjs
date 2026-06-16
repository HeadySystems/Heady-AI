#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Skeleton Guard — PreToolUse Hook v1.0.0                  ║
// ║  Blocks file writes to unrecognized scaffold locations.          ║
// ║  Wired into .claude/settings.json alongside heady-rules.mjs.    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Reads the hook payload from stdin, extracts the file_path from the
// tool_input, and runs verifyPlacement() against skeleton.json.
//
// Exit codes:
//   0 — EXECUTE or CAUTIOUS (allow the write)
//   2 — HALT (block the write, print reason to stderr)

import { readFileSync } from "node:fs";
import { relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyPlacement } from "../../tooling/skeleton-guard/verify-placement.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

/**
 * Extract the target file path from the tool payload.
 * Supports Write, Edit, MultiEdit, and NotebookEdit.
 */
function extractFilePath(payload) {
  const input = payload.tool_input ?? {};
  return input.file_path ?? "";
}

function main() {
  let payload;
  try {
    payload = JSON.parse(readStdin() || "{}");
  } catch {
    process.exit(0); // never block on a parse failure
  }

  const toolName = payload.tool_name ?? "";
  // Only gate file-writing tools.
  const writingTools = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
  if (!writingTools.has(toolName)) {
    process.exit(0);
  }

  const filePath = extractFilePath(payload);
  if (!filePath) {
    process.exit(0);
  }

  // Convert absolute path to repo-relative.
  let relPath;
  try {
    relPath = relative(REPO_ROOT, resolve(filePath)).replace(/\\/g, "/");
  } catch {
    process.exit(0); // if path resolution fails, don't block
  }

  // Paths outside the repo are not our concern.
  if (relPath.startsWith("..") || relPath.startsWith("/")) {
    process.exit(0);
  }

  const result = verifyPlacement(relPath);

  if (result.decision === "HALT") {
    process.stderr.write(
      `HEADY™ Skeleton Guard blocked write to ${relPath}:\n` +
        `  ${result.reason}\n` +
        `  Fix: move the file to a recognized location or update tooling/skeleton-guard/skeleton.json.\n` +
        `  (Enforced by .claude/hooks/skeleton-guard-hook.mjs)\n`,
    );
    process.exit(2);
  }

  if (result.decision === "CAUTIOUS") {
    process.stderr.write(
      `HEADY™ Skeleton Guard warning for ${relPath}:\n` +
        `  ${result.reason}\n`,
    );
  }

  process.exit(0);
}

main();
