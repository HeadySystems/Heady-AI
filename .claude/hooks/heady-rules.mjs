#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Rule-Enforcement Hook v1.0.0                              ║
// ║  PreToolUse gate — mechanically enforces AGENTS.md coding rules   ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Wired into .claude/settings.json as a PreToolUse hook on Edit|Write|
// MultiEdit|NotebookEdit. Reads the hook payload from stdin, inspects the
// text being written, and BLOCKS (exit 2) on hard AGENTS.md violations so
// the rules are guaranteed rather than honor-system.
//
// Scope: only code files (.js/.mjs/.cjs/.ts/.tsx/.jsx) under the authored
// source trees. Tests, node_modules, .agents, docs, scratch are exempt.

import { readFileSync } from "node:fs";

const CODE_EXT = /\.(mjs|cjs|jsx?|tsx?)$/;
// Only enforce inside authored source trees.
const IN_SCOPE = /\/(apps|packages|src|tooling|configs)\//;
// Never enforce inside these.
const EXEMPT = /(node_modules|\.agents|\/scratch\/|\/docs\/|\.test\.|\.spec\.|\/test\/|__tests__)/;

// Each rule: { id, re, msg }. `re` tests the ADDED text only.
const RULES = [
  {
    id: "no-console-log",
    re: /\bconsole\.log\s*\(/,
    msg: "AGENTS.md #2: zero console.log — use the pino structured logger with X-Heady-Trace-Id.",
  },
  {
    id: "esm-only",
    re: /\brequire\s*\(\s*['"`]/,
    msg: "AGENTS.md #1: ESM only — use import/export, never CommonJS require().",
  },
  {
    id: "no-placeholders",
    re: /\b(TODO|FIXME|HACK)\b/,
    msg: "AGENTS.md #3: zero TODO/FIXME/HACK — if it's not done, don't commit it.",
  },
  {
    id: "no-localhost",
    re: /\b(localhost|127\.0\.0\.1)\b/,
    msg: "AGENTS.md #4: zero localhost/127.0.0.1 — all URLs come from env vars (cloud-deployed only).",
  },
];

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function addedText(toolName, input) {
  if (!input) return "";
  switch (toolName) {
    case "Write":
      return input.content ?? "";
    case "Edit":
      return input.new_string ?? "";
    case "MultiEdit":
      return (input.edits ?? []).map((e) => e?.new_string ?? "").join("\n");
    case "NotebookEdit":
      return input.new_source ?? "";
    default:
      return "";
  }
}

function main() {
  let payload;
  try {
    payload = JSON.parse(readStdin() || "{}");
  } catch {
    process.exit(0); // never block on a parse failure
  }

  const toolName = payload.tool_name ?? "";
  const input = payload.tool_input ?? {};
  const filePath = input.file_path ?? "";

  if (!CODE_EXT.test(filePath)) process.exit(0);
  if (!IN_SCOPE.test(filePath)) process.exit(0);
  if (EXEMPT.test(filePath)) process.exit(0);

  const text = addedText(toolName, input);
  if (!text) process.exit(0);

  const hits = [];
  for (const rule of RULES) {
    if (rule.re.test(text)) hits.push(`  ✗ [${rule.id}] ${rule.msg}`);
  }

  // HEADY_BRAND header: only enforced on whole-file Writes of code files.
  if (toolName === "Write" && !/HEADY/i.test(text.slice(0, 600))) {
    hits.push(
      "  ✗ [heady-brand] AGENTS.md #6: new files need the HEADY_BRAND header box (see template in AGENTS.md)."
    );
  }

  if (hits.length === 0) process.exit(0);

  process.stderr.write(
    `HEADY rule-gate blocked this write to ${filePath}:\n${hits.join("\n")}\n` +
      `Fix these and retry. (Enforced by .claude/hooks/heady-rules.mjs)\n`
  );
  process.exit(2);
}

main();
