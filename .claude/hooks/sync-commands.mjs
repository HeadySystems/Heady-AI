#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Auto-Sync Commands Hook v1.0.0                           ║
// ║  Makes every NEW automated flow instantly usable as a manual      ║
// ║  /heady-* shortcut — no manual step. Fires on:                    ║
// ║   • SessionStart      → full sync (workflows→commands + skills)    ║
// ║   • PostToolUse(Write/Edit under .agents/workflows|.agents/skills) ║
// ║       → targeted sync so the new command/skill is live mid-session ║
// ║  Fail-OPEN: never blocks a session or edit (always exit 0).        ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function run(script, args = []) {
  spawnSync("node", [join(ROOT, script), ...args], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
}

function main() {
  let payload = {};
  try { payload = JSON.parse(readFileSync(0, "utf8") || "{}"); } catch { /* fall through to safe defaults */ }

  const event = payload.hook_event_name ?? "";
  const filePath = payload.tool_input?.file_path ?? "";

  const touchedWorkflow = /\.agents\/workflows\//.test(filePath);
  const touchedSkill = /\.agents\/skills\//.test(filePath);
  const sessionStart = event === "SessionStart";

  // Workflows→commands sync is cheap (relative symlinks) — run on session start or any workflow edit.
  if (sessionStart || touchedWorkflow) run("tooling/skill-registry/sync-workflows.mjs");
  // Skill registration is heavier — only on session start or a skill edit.
  if (sessionStart || touchedSkill) run("tooling/skill-registry/register.mjs");

  process.exit(0); // fail-open, always
}

main();
