#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Report Templates — render engine (HeadyBee report filler)  ║
// ║  A template (.hbs with YAML frontmatter declaring `output` + the   ║
// ║  `bindings` it needs) is filled with LIVE data + CANONICAL values  ║
// ║  and written to its output path. Reports become projections of     ║
// ║  system state, never hand-written prose → always current, drift-   ║
// ║  free (reuses the heady-derive canon), auditable (generated header).║
// ║                                                                    ║
// ║  Slots:  {{ns.dotted.key}}                 ← from a binding's JSON  ║
// ║          {{canon facts.company.patents…}}  ← from heady-derive canon║
// ║          <!--heady:inject KEY-->…<!--/…-->  ← managed region (locked)║
// ║                                                                    ║
// ║  Modes:  render.mjs render [name]   → write the report(s)          ║
// ║          render.mjs check  [name]   → exit 1 if any output is stale ║
// ║  Made with ❤️ by HeadySystems Inc.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { resolveCanon } from "../../heady-derive/src/canon.mjs";

const ROOT = resolve(new URL("../../..", import.meta.url).pathname);
const TPL_DIR = resolve(new URL("../templates", import.meta.url).pathname);
const BIND_DIR = resolve(new URL("../bindings", import.meta.url).pathname);
const log = (level, msg, f = {}) => process.stdout.write(`${JSON.stringify({ t: "report-render", level, msg, ...f })}\n`);

// Minimal frontmatter parser: --- \n key: value \n bindings: [a, b] \n ---
function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([\w.]+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith("[") && v.endsWith("]")) v = v.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
    meta[kv[1]] = v;
  }
  return { meta, body: m[2] };
}

const dget = (obj, path) => path.split(".").reduce((a, k) => (a == null ? a : a[k]), obj);

// Run a binding script (bindings/<name>.mjs prints JSON to stdout). Fail-soft → {} with a logged warn.
function runBinding(name) {
  const file = join(BIND_DIR, `${name}.mjs`);
  if (!existsSync(file)) { log("warn", "binding missing", { name }); return {}; }
  try {
    const out = execFileSync("node", [file], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 24 });
    return JSON.parse(out.trim() || "{}");
  } catch (e) { log("warn", "binding failed (rendered with nulls)", { name, err: String(e.message).slice(0, 160) }); return {}; }
}

/** Fill one template string against a data context + canon. Returns the rendered markdown. */
export function fillTemplate(body, ctx, canon) {
  let out = body;
  // {{canon some.key}} → canonical value (locked source of truth)
  out = out.replace(/\{\{\s*canon\s+([\w.]+)\s*\}\}/g, (_, k) => (k in canon ? canon[k] : `«canon:${k}?»`));
  // <!--heady:inject KEY-->…<!--/heady:inject--> → managed region from canon (drift-proof)
  out = out.replace(/<!--\s*heady:inject\s+([\w.]+)\s*-->([\s\S]*?)<!--\s*\/heady:inject\s*-->/g,
    (_, k, body2) => `<!--heady:inject ${k}-->${k in canon ? canon[k] : body2}<!--/heady:inject-->`);
  // {{ns.dotted.key}} → binding data
  out = out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => {
    const v = dget(ctx, k);
    return v === undefined || v === null ? "—" : (typeof v === "object" ? JSON.stringify(v) : String(v));
  });
  return out;
}

function templates(only) {
  return readdirSync(TPL_DIR).filter((f) => f.endsWith(".hbs")).filter((f) => !only || f === only || f === `${only}.hbs`);
}

function renderOne(file, canon) {
  const { meta, body } = parseFrontmatter(readFileSync(join(TPL_DIR, file), "utf8"));
  if (!meta.output) throw new Error(`template ${file} missing 'output:' in frontmatter`);
  const needed = Array.isArray(meta.bindings) ? meta.bindings : (meta.bindings ? [meta.bindings] : []);
  const ctx = {};
  for (const b of needed) ctx[b] = runBinding(b);
  const header = `<!--\n  ⚠️ GENERATED REPORT — DO NOT EDIT DIRECTLY.\n  Rendered from tooling/report-templates/templates/${file}\n  by @heady/report-templates (bindings: ${needed.join(", ") || "none"} + heady-derive canon).\n  Refresh: node tooling/report-templates/src/render.mjs render ${file}\n-->\n\n`;
  return { output: meta.output, content: header + fillTemplate(body, ctx, canon) };
}

function run(mode, only) {
  const canon = resolveCanon();
  const files = templates(only);
  if (!files.length) { log("warn", "no templates matched", { only }); return; }
  let stale = 0;
  for (const file of files) {
    const { output, content } = renderOne(file, canon);
    const abs = join(ROOT, output);
    const cur = existsSync(abs) ? readFileSync(abs, "utf8") : null;
    if (mode === "check") {
      if (cur !== content) { stale++; log("error", "report out of date", { template: file, output }); }
    } else {
      writeFileSync(abs, content);
      log("info", "rendered", { template: file, output });
    }
  }
  if (mode === "check") {
    if (stale) { log("error", "report-render check FAILED — run `node tooling/report-templates/src/render.mjs render`", { stale }); process.exit(1); }
    log("info", "report-render check OK — all reports match templates + live data", { count: files.length });
  }
}

const mode = process.argv[2] === "check" ? "check" : "render";
const only = process.argv[3];
const direct = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (direct) run(mode, only);
