#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Law-Lint v2.0.0                                           ║
// ║  Narrowed to the two AGENTS.md rules NOT owned by the canonical    ║
// ║  governance enforcers (tooling/enforcers + ENF-anti-shortcut.md): ║
// ║    • #1 ESM-only (no CommonJS require)                             ║
// ║    • #6 HEADY_BRAND header on authored code files                 ║
// ║  Law 0 (no-localhost/secrets), Laws 1&2 (glass-box logging /      ║
// ║  placeholders) are enforced canonically by tooling/enforcers —    ║
// ║  this tool no longer duplicates them (no policy fork).            ║
// ║  Exit 0 = clean · Exit 1 = violations · © 2026 HeadySystems Inc.  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const _defaultRoot = fileURLToPath(new URL("../../..", import.meta.url));
const rootArgIdx = process.argv.indexOf("--root");
const ROOT = rootArgIdx !== -1 ? process.argv[rootArgIdx + 1] : _defaultRoot;

const CODE_EXT = /\.(mjs|cjs|jsx?|tsx?)$/;
const IN_SCOPE = /\/(apps|packages|tooling|configs)\//;
// Generated bundles, vendored/legacy imports, templates, tests, docs are out of scope.
// heady-desktop preload: Electron sandboxed preloads are CJS-only by platform design —
// an ESM preload would force sandbox OFF (a real security downgrade to satisfy a style
// law). Narrow, single-file exemption; everything else in heady-desktop stays ESM.
const EXEMPT = /(node_modules|\.agents|\/scratch\/|\/docs\/|\.test\.|\.spec\.|\/test\/|__tests__|law-lint|\/dist\/|\/assets\/|INSTALLABLE_PACKAGES|\/templates\/|heady-sacred-geometry-sdk|heady-desktop\/src\/preload\.cjs)/;

const RULES = [
  {
    id: "esm-only",
    re: /\brequire\s*\(\s*['"`]/,
    msg: "AGENTS.md #1: ESM only — no CommonJS require().",
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
    lines.forEach((line, i) => {
      if (rule.re.test(line)) findings.push({ file: rel, line: i + 1, rule: rule.id, msg: rule.msg });
    });
  }

  // #6 HEADY_BRAND header — required on authored code files (not type-declaration files).
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
    process.stdout.write("HEADY law-lint: clean — 0 violations (ESM-only + brand-header)\n");
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
  process.stderr.write("\nFix these — ESM + brand-header are enforced here; logging/placeholders/localhost by tooling/enforcers.\n");
  process.exit(1);
}

main();
