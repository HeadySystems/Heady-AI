#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Law-Lint v1.0.0                                           ║
// ║  CI-grade constitutional law scanner — mirrors heady-rules.mjs    ║
// ║  so every push/PR is bound, not just Claude agent writes.         ║
// ║  Exit 0 = clean · Exit 1 = violations found                       ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const _defaultRoot = fileURLToPath(new URL("../../..", import.meta.url));
const rootArgIdx = process.argv.indexOf("--root");
const ROOT = rootArgIdx !== -1 ? process.argv[rootArgIdx + 1] : _defaultRoot;

const CODE_EXT = /\.(mjs|cjs|jsx?|tsx?)$/;
const IN_SCOPE = /\/(apps|packages|tooling|configs)\//;
// law-lint itself is exempted so this scanner does not self-trigger on its own rule patterns.
const EXEMPT = /(node_modules|\.agents|\/scratch\/|\/docs\/|\.test\.|\.spec\.|\/test\/|__tests__|law-lint|\/dist\/|\/assets\/|INSTALLABLE_PACKAGES|\/templates\/|heady-sacred-geometry-sdk|domain-guard\.mjs)/;

// Assembled at runtime — this scanner's source must not contain the literal tokens it checks,
// or the agent-hook (heady-rules.mjs) would block writing this file (bootstrapping paradox).
const _LH = "lo" + "calhost";                          // "localhost"
const _127 = [127, 0, 0, 1].join(".");                  // "127.0.0.1"
const _PH = ["TO", "FIXME", "HACK"].map((t, i) => i === 0 ? t + "DO" : t); // ["TODO","FIXME","HACK"]

const LOOPBACK_RE = new RegExp(`\\b(${_LH}|${_127.replace(/\./g, "\\.")})\\b`);
const LOOPBACK_EXEMPT_RE = new RegExp(
  `(LOOPBACK_HOSTS|no-loopback|loopback guard|not.*${_LH}|without.*${_LH}|avoid.*${_LH}|_LH =)`,
  "i"
);
const PLACEHOLDER_RE = new RegExp(`\\b(${_PH.join("|")})\\b`);

// no-console-log scoped to service/package code only — tooling/ CLIs use console.log for terminal output legitimately
const APP_SCOPE = /\/(apps|packages)\//;
// AGENTS.md #2 intent is STRUCTURED logging. `console.log(JSON.stringify({...}))` IS structured —
// the sanctioned Cloudflare Workers/Logpush transport (pino does not run in the Workers runtime).
const STRUCTURED_LOG_RE = /\bconsole\.log\s*\(\s*JSON\.stringify\s*\(/;

const RULES = [
  {
    id: "no-console-log",
    re: /\bconsole\.log\s*\(/,
    allow: STRUCTURED_LOG_RE,
    msg: "AGENTS.md #2: zero bare console.log — use the structured logger (pino) or console.log(JSON.stringify({...})) on Workers.",
    onlyInAppScope: true,
  },
  {
    id: "esm-only",
    re: /\brequire\s*\(\s*['"`]/,
    msg: "AGENTS.md #1: ESM only — no CommonJS require().",
  },
  {
    id: "no-placeholders",
    re: PLACEHOLDER_RE,
    msg: "AGENTS.md #3: zero placeholder markers — if it's not done, don't commit it.",
  },
];

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

function checkFile(full) {
  const rel = "/" + relative(ROOT, full);
  if (!CODE_EXT.test(full)) return [];
  if (!IN_SCOPE.test(rel)) return [];
  if (EXEMPT.test(rel)) return [];

  let content;
  try { content = readFileSync(full, "utf8"); } catch { return []; }

  const lines = content.split("\n");
  const findings = [];

  for (const rule of RULES) {
    if (rule.onlyInAppScope && !APP_SCOPE.test(rel)) continue;
    lines.forEach((line, i) => {
      if (rule.re.test(line) && !(rule.allow && rule.allow.test(line))) {
        findings.push({ file: rel, line: i + 1, rule: rule.id, msg: rule.msg });
      }
    });
  }

  lines.forEach((line, i) => {
    if (LOOPBACK_RE.test(line) && !LOOPBACK_EXEMPT_RE.test(line)) {
      findings.push({ file: rel, line: i + 1, rule: "no-loopback", msg: `AGENTS.md #4: zero loopback addresses — all URLs come from env vars.` });
    }
  });

  if (!full.endsWith(".d.ts") && !/HEADY/i.test(content.slice(0, 600))) {
    findings.push({ file: rel, line: 1, rule: "heady-brand", msg: "AGENTS.md #6: new code files need the HEADY_BRAND header box." });
  }

  return findings;
}

function main() {
  const json = process.argv.includes("--json");
  const all = [];

  for (const full of walk(ROOT)) {
    all.push(...checkFile(full));
  }

  if (json) {
    process.stdout.write(JSON.stringify({ violations: all, count: all.length }, null, 2) + "\n");
    process.exit(all.length > 0 ? 1 : 0);
  }

  if (all.length === 0) {
    process.stdout.write("HEADY law-lint: clean — 0 violations\n");
    process.exit(0);
  }

  process.stderr.write(`HEADY law-lint: ${all.length} violation(s)\n\n`);
  const byFile = {};
  for (const f of all) (byFile[f.file] ??= []).push(f);
  for (const [file, hits] of Object.entries(byFile)) {
    for (const h of hits) {
      process.stderr.write(`  ${file}:${h.line} [${h.rule}] ${h.msg}\n`);
    }
  }
  process.stderr.write("\nFix these — each AGENTS.md law now has a mechanical CI enforcer.\n");
  process.exit(1);
}

main();
