#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Rule-Enforcement Hook v1.2.0                              ║
// ║  PreToolUse gate — mechanically enforces AGENTS.md coding rules   ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
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
// v1.2.0 — waiver-contract alignment (founder-approved 2026-07-23): the hook
// now scans LINE-BY-LINE and honors exactly the per-line `heady-allow:` waivers
// the downstream gate scripts honor (glass-box: `heady-allow:(glass-box|<rule>)`;
// no-localhost: `heady-allow:no-localhost` only), tested against the same
// trimmed 200-char window the enforcers use. Previously a line waiver the gate
// scripts accept was unauthorable through Edit/Write (the second half of the
// policy fork). ESM has NO waiver — law-lint accepts none, and the hook must
// never accept a waiver the downstream gate would reject.
//
// Scope: only code files (.js/.mjs/.cjs/.ts/.tsx/.jsx) under the authored
// source trees. Tests, node_modules, .agents, docs, scratch are exempt.

import { readFileSync } from "node:fs";

const CODE_EXT = /\.(mjs|cjs|jsx?|tsx?)$/;
// Only enforce inside authored source trees.
const IN_SCOPE = /\/(apps|packages|src|tooling|configs)\//;
// Never enforce inside these.
const EXEMPT = /(node_modules|\.agents|\/scratch\/|\/docs\/|\.test\.|\.spec\.|\/test\/|__tests__)/;

// ESM (#1) is law-lint-owned and has no shared-lib export → always inline (identical
// regex). family:null = NO waiver token exists for it (law-lint accepts none).
const ESM_RULE = {
  id: "esm-only",
  re: /\brequire\s*\(\s*['"`]/,
  msg: "AGENTS.md #1: ESM only — use import/export, never CommonJS require().",
  family: null,
};

// Inline FALLBACK for the canonical line rules — used ONLY if the lib import fails,
// so a broken import degrades to prior (weaker) behavior instead of bricking edits.
const FALLBACK_LINE_RULES = [
  { id: "console", re: /\bconsole\.log\s*\(/, msg: "AGENTS.md #2: zero console.log — use the pino structured logger with X-Heady-Trace-Id.", family: "glass-box" },
  { id: "placeholder", re: /\b(TODO|FIXME|HACK)\b/, msg: "AGENTS.md #3: zero TODO/FIXME/HACK — if it's not done, don't commit it.", family: "glass-box" },
  { id: "localhost", re: /\b(localhost|127\.0\.0\.1)\b/, msg: "AGENTS.md #4: zero localhost/127.0.0.1 — all URLs come from env vars (cloud-deployed only).", family: "no-localhost" },
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

// Family per canonical rule id — which gate script owns it (drives the waiver token).
const GLASSBOX_IDS = new Set(["console", "placeholder", "ts-suppress", "stub-throw"]);
const LOCALHOST_IDS = new Set(["localhost", "loopback-v4", "all-ifaces", "loopback-v6", "hardcoded-port"]);
const familyFor = (id) => (GLASSBOX_IDS.has(id) ? "glass-box" : LOCALHOST_IDS.has(id) ? "no-localhost" : null);

// Mirror of each gate script's waiver contract (per flagged line):
//   glass-box.mjs    → /heady-allow:\s*(glass-box|<ruleId>)/
//   no-localhost.mjs → /heady-allow:\s*no-localhost/   (family token ONLY)
//   esm-only / brand → NO waiver (law-lint accepts none)
function waiverRe(rule) {
  if (rule.family === "glass-box") return new RegExp(`heady-allow:\\s*(glass-box|${rule.id})`);
  if (rule.family === "no-localhost") return /heady-allow:\s*no-localhost/;
  return null;
}

/** Load the canonical line rules (console/placeholder/localhost family) from the single
 *  SoT; on any import failure, fall back to the inline subset so edits never brick. */
async function loadLineRules() {
  try {
    const lib = await import("../../tooling/enforcers/lib/rules.mjs");
    const mapped = [...lib.GLASSBOX_LINE_RULES, ...lib.LOCALHOST_RULES].map((r) => ({
      id: r.id,
      re: r.re,
      msg: MSG[r.id] ?? `AGENTS.md: forbidden pattern "${r.id}".`,
      family: familyFor(r.id),
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
  const lines = text.split("\n");
  const hits = [];
  for (const rule of rules) {
    const waiver = waiverRe(rule);
    for (const raw of lines) {
      if (!rule.re.test(raw)) continue;
      // Same evidence window the gate scripts test waivers against (trim + 200 chars).
      if (waiver && waiver.test(raw.trim().slice(0, 200))) continue;
      hits.push(`  ✗ [${rule.id}] ${rule.msg}`);
      break; // one report per rule is enough
    }
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
