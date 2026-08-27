#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Derive — single-source injection engine                   ║
// ║  Keeps load-bearing values across ALL files consistent with the    ║
// ║  golden record by rewriting inline "managed regions" in place:     ║
// ║                                                                    ║
// ║    <!--heady:inject facts.company.patents_provisional-->51<!--/heady:inject-->
// ║                                                                    ║
// ║  The text between the markers is ALWAYS overwritten from canon     ║
// ║  (facts.yaml/lexicon.yaml). Hand-edit the value and `check` fails  ║
// ║  closed — this is the write side of the consistency loop; the      ║
// ║  coherence scalar-guard is the read/guard side.                    ║
// ║                                                                    ║
// ║  Modes:  derive.mjs check   → exit 1 if any region is stale (CI)   ║
// ║          derive.mjs write   → rewrite stale regions in place       ║
// ║  Made with ❤️ by HeadySystems Inc.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { resolveCanon, canonValue } from "./canon.mjs";

const ROOT = resolve(new URL("../../..", import.meta.url).pathname);
const log = (level, msg, f = {}) => process.stdout.write(`${JSON.stringify({ t: "heady-derive", level, msg, ...f })}\n`);

// Marker grammar. HTML-comment form for markdown/configs; both delimiters carry the key for safety.
const RE = /<!--\s*heady:inject\s+([\w.]+)\s*-->([\s\S]*?)<!--\s*\/heady:inject\s*-->/g;

// Files to scan: tracked text files under canonical roots (git ls-files = no node_modules/.data).
// Test files are excluded — they legitimately embed `heady:inject` markers inside fixtures with
// intentionally-drifted values (to exercise applyRegions), which are NOT real managed regions.
function targetFiles() {
  const out = execFileSync("git", ["ls-files", "docs", "packages", "tooling", "configs", ".agents", "AGENTS.md", "README.md"], { cwd: ROOT, encoding: "utf8" });
  return out.split("\n").filter(Boolean)
    .filter((f) => /\.(md|mjs|js|ts|json|yaml|yml)$/.test(f))
    .filter((f) => !/(^|\/)test\//.test(f) && !/\.test\.(mjs|js|ts)$/.test(f));
}

/** Rewrite all managed regions in one file's text. Returns {text, changed:[{key,old,new}]}. */
export function applyRegions(text, canon) {
  const changed = [];
  const next = text.replace(RE, (m, key, body) => {
    // `KEY` is the canonical documentation sentinel used to explain the marker
    // grammar. It is not a source-of-truth lookup and must remain literal.
    if (key === "KEY") return m;
    const val = canonValue(key, canon);
    if (body !== val) changed.push({ key, old: body, new: val });
    return `<!--heady:inject ${key}-->${val}<!--/heady:inject-->`;
  });
  return { text: next, changed };
}

function run(mode) {
  const canon = resolveCanon();
  const files = targetFiles();
  let stale = 0, written = 0, regions = 0;
  const drift = [];
  for (const rel of files) {
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) continue;
    const src = readFileSync(abs, "utf8");
    if (!src.includes("heady:inject")) continue;
    const { text, changed } = applyRegions(src, canon);
    regions += (src.match(RE) || []).length;
    if (changed.length) {
      stale += changed.length;
      for (const c of changed) drift.push({ file: rel, key: c.key, old: c.old, new: c.new });
      if (mode === "write") { writeFileSync(abs, text); written++; }
    }
  }
  if (mode === "check") {
    if (stale) {
      for (const d of drift) log("error", "stale managed region", d);
      log("error", "derive check FAILED — run `node tooling/heady-derive/src/derive.mjs write`", { stale, regions, files: files.length });
      process.exit(1);
    }
    log("info", "derive check OK — all managed regions match the golden record", { regions });
  } else {
    log("info", "derive write complete", { regionsRewritten: stale, filesChanged: written, regionsTotal: regions });
  }
}

const mode = process.argv[2] === "write" ? "write" : "check";
const direct = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (direct) run(mode);
