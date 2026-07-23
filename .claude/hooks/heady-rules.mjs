#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Rule-Enforcement Hook v1.1.0                              ║
// ║  PreToolUse gate — mechanically enforces AGENTS.md coding rules   ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Wired into .claude/settings.json as a PreToolUse hook on Edit|Write|
// MultiEdit|NotebookEdit. Reads the hook payload from stdin, inspects the
// text being written, and BLOCKS (exit 2) on hard AGENTS.md violations so
// the rules are guaranteed rather than honor-system.
//
// v1.1.0 — de-forked: the console / placeholder / localhost patterns are now
// SOURCED FROM THE CANONICAL RULE LIB (tooling/enforcers/lib/rules.mjs) instead
// of a weaker private copy, so write-time and CI/local-gate enforcement can no
// longer drift (closes configs/laws.json known_defects.rule-gate-hook-fork).
// The import is dynamic with an inline fallback: a load failure degrades to the
// prior inline behavior rather than bricking the edit path. ESM (#1) and BRAND
// (#6) are owned by law-lint (no shared-lib export) and stay inline.
//
// Scope: only code files (.js/.mjs/.cjs/.ts/.tsx/.jsx) under the authored
// source trees. Tests, node_modules, .agents, docs, scratch are exempt.

import { readFileSync } from "node:fs";

const CODE_EXT = /\.(mjs|cjs|jsx?|tsx?)$/;
// Only enforce inside authored source trees.
const IN_SCOPE = /\/(apps|packages|src|tooling|configs)\//;
// Never enforce inside these.
const EXEMPT = /(node_modules|\.agents|\/scratch\/|\/docs\/|\.test\.|\.spec\.|\/test\/|__tests__)/;

// ESM (#1) is law-lint-owned and has no shared-lib export → always inline (identical regex).
const ESM_RULE = {
  id: "esm-only",
  re: /\brequire\s*\(\s*['"`]/,
  msg: "AGENTS.md #1: ESM only — use import/export, never CommonJS require().",
};

// Inline FALLBACK for the canonical line rules — used ONLY if the lib import fails,
// so a broken import degrades to prior (weaker) behavior instead of bricking edits.
const FALLBACK_LINE_RULES = [
  { id: "console", re: /\bconsole\.log\s*\(/, msg: "AGENTS.md #2: zero console.log — use the pino structured logger with X-Heady-Trace-Id." },
  { id: "placeholder", re: /\b(TODO|FIXME|HACK)\b/, msg: "AGENTS.md #3: zero TODO/FIXME/HACK — if it's not done, don't commit it." },
  { id: "localhost", re: /\b(localhost|127\.0\.0\.1)\b/, msg: "AGENTS.md #4: zero localhost/127.0.0.1 — all URLs come from env vars (cloud-deployed only)." },
];

// AGENTS.md message per canonical rule id (falls back to a generic message).
const MSG = {
  console: "AGENTS.md #2: zero console.* — use the pino structured logger with X-Heady-Trace-Id.",
  placeholder: "AGENTS.md #3: zero TODO/FIXME/HACK/XXX/KLUDGE/TEMP — if it's not done, don't commit it.",
  "ts-suppress": "AGENTS.md: no @ts-ignore/@ts-nocheck/blanket eslint-disable — fix it, don't suppress it.",
  "stub-throw": "AGENTS.md #3: no stub throws (not implemented/todo/stub) — finish it or don't commit it.",
  localhost: "AGENTS.md #4: no localhost — URLs from env vars (cloud-deployed only).",
  "loopback-v4": "AGENTS.md #4: no 127.0.0.1 loopback — URLs from env vars (cloud-deployed only).",
  "all-ifaces": "AGENTS.md #4: no 0.0.0.0 all-interfaces bind — bind from config (cloud-deployed only).",
  "loopback-v6": "AGENTS.md #4: no ::1 loopback — URLs from env vars (cloud-deployed only).",
  "hardcoded-port": "AGENTS.md #4: no hardcoded host:port — derive from env vars.",
};

/** Load the canonical line rules (console/placeholder/localhost family) from the single
 *  SoT; on any import failure, fall back to the inline subset so edits never brick. */
async function loadLineRules() {
  try {
    const lib = await import("../../tooling/enforcers/lib/rules.mjs");
    const mapped = [...lib.GLASSBOX_LINE_RULES, ...lib.LOCALHOST_RULES].map((r) => ({
      id: r.id,
      re: r.re,
      msg: MSG[r.id] ?? `AGENTS.md: forbidden pattern "${r.id}".`,
    }));
    return [ESM_RULE, ...mapped];
  } catch {
    return [ESM_RULE, ...FALLBACK_LINE_RULES];
  }
}

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

async function main() {
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

  const rules = await loadLineRules();
  const hits = [];
  for (const rule of rules) {
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

// Fail-open on any unexpected internal error — a rule-gate must never brick the
// edit path; the local-gate/dormant-ci enforcers are the fail-closed backstop.
main().catch(() => process.exit(0));
