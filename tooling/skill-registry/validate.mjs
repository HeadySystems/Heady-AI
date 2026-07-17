#!/usr/bin/env node
// heady-allow:orphans — baseline orphan (rebuild in progress); triage dead-vs-wire in follow-up (audit FILE_MANIFEST)
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Skill/Workflow Validator v1.0.0                          ║
// ║  Validates ALL data in .agents/skills + .agents/workflows:        ║
// ║  frontmatter, name↔dir, description, stubs, wikilinks, dupes.     ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Structural/data validation of the skill + workflow corpus (token-level
// store/embedding consistency is the data-consistency gate's job). Pure read +
// report; exit 1 on errors. `--json` for machine output.

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");
const SKILLS_DIR = join(REPO_ROOT, ".agents", "skills");
const WORKFLOWS_DIR = join(REPO_ROOT, ".agents", "workflows");

// Claude frontmatter constraints (external spec) + discoverability minimums.
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DESC_MAX = 1024;
const DESC_MIN = 20; // too-short descriptions hurt skill selection
const STUB_MIN_LINES = 8; // fewer substantive body lines ⇒ a stub shell

function frontmatter(raw) {
  const lines = raw.split("\n");
  let open = -1;
  for (let i = 0; i < lines.length; i++) if (lines[i].trim() === "---") { open = i; break; }
  if (open === -1) return { ok: false, yaml: [], bodyStart: 0 };
  for (let j = open + 1; j < lines.length; j++) {
    if (lines[j].trim() === "---") return { ok: true, yaml: lines.slice(open + 1, j), bodyStart: j + 1, lines };
  }
  return { ok: false, yaml: [], bodyStart: 0 };
}

function field(yaml, key) {
  const inline = yaml.find((l) => new RegExp(`^${key}:`).test(l));
  if (!inline) return "";
  const v = inline.replace(new RegExp(`^${key}:\\s*`), "").trim();
  if (v && v !== ">" && v !== "|" && v !== ">-" && v !== "|-") return v.replace(/^["']|["']$/g, "");
  // block scalar
  const i = yaml.indexOf(inline);
  const parts = [];
  for (let j = i + 1; j < yaml.length; j++) {
    if (/^\S/.test(yaml[j]) && /^[A-Za-z0-9_-]+:/.test(yaml[j])) break;
    parts.push(yaml[j].trim());
  }
  return parts.join(" ").trim();
}

function substantiveLines(raw) {
  return raw
    .replace(/^---[\s\S]*?\n---\n/, "") // strip frontmatter
    .split("\n")
    .filter((l) => l.trim() && !/^>/.test(l) && !/^<!--/.test(l) && !/^#/.test(l) && !/OPTIMAL BUILD NOTICE/.test(l)).length;
}

// Compile an invariants.json pattern (handles a leading "(?i)" inline flag).
function compilePattern(pattern, base) {
  let flags = base;
  let src = pattern;
  const m = src.match(/^\(\?([a-z]+)\)/);
  if (m) {
    for (const ch of m[1]) if (!flags.includes(ch)) flags += ch;
    src = src.slice(m[0].length);
  }
  return new RegExp(src, flags);
}

// Load the extended-scope token invariants (staleness/drift) from the consistency
// catalog so this validator and the global gate share ONE source of truth.
function loadStaleInvariants() {
  const path = join(REPO_ROOT, "tooling", "data-consistency", "invariants.json");
  if (!existsSync(path)) return [];
  const cfg = JSON.parse(readFileSync(path, "utf8"));
  return (cfg.invariants ?? [])
    .filter((inv) => (inv.appliesTo ?? []).includes("extended"))
    .map((inv) => ({ id: inv.id, banned: compilePattern(inv.banned, "g"), allow: inv.allow ? compilePattern(inv.allow, "") : null }));
}

function scanStale(raw, inv) {
  const out = [];
  for (const line of raw.split("\n")) {
    if (inv.allow && inv.allow.test(line)) continue;
    inv.banned.lastIndex = 0;
    if (inv.banned.test(line)) out.push(line.trim().slice(0, 80));
  }
  return out;
}

export function validate() {
  const findings = [];
  const add = (sev, id, target, msg) => findings.push({ sev, id, target, msg });
  const staleInvariants = loadStaleInvariants();

  if (!existsSync(SKILLS_DIR)) throw new Error(`skills dir missing: ${SKILLS_DIR}`);
  const skillDirs = readdirSync(SKILLS_DIR, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  const skillSet = new Set(skillDirs);
  const nameSeen = new Map();

  for (const dir of skillDirs) {
    const file = join(SKILLS_DIR, dir, "SKILL.md");
    const t = `skill:${dir}`;
    if (!existsSync(file)) { add("error", "MISSING-SKILL-MD", t, "directory has no SKILL.md"); continue; }
    const raw = readFileSync(file, "utf8");
    const fm = frontmatter(raw);
    if (!fm.ok) { add("error", "NO-FRONTMATTER", t, "no parseable --- frontmatter block"); continue; }

    const name = field(fm.yaml, "name");
    const desc = field(fm.yaml, "description");

    if (!name) add("error", "NO-NAME", t, "frontmatter missing name");
    else {
      if (name !== dir) add("error", "NAME-MISMATCH", t, `name "${name}" ≠ directory "${dir}"`);
      if (!NAME_RE.test(name)) add("error", "NAME-INVALID", t, `name "${name}" fails ${NAME_RE}`);
      if (nameSeen.has(name)) add("error", "NAME-DUPLICATE", t, `name also used by ${nameSeen.get(name)}`);
      else nameSeen.set(name, dir);
    }
    if (!desc) add("error", "NO-DESCRIPTION", t, "frontmatter missing description");
    else {
      if (desc.length < DESC_MIN) add("warn", "DESC-SHORT", t, `description ${desc.length} chars (< ${DESC_MIN})`);
      if (desc.length > DESC_MAX) add("error", "DESC-LONG", t, `description ${desc.length} chars (> ${DESC_MAX})`);
    }

    const lines = substantiveLines(raw);
    if (lines < STUB_MIN_LINES || /STUB — body pending/.test(raw)) {
      add("warn", "STUB", t, `only ${lines} substantive body lines — likely a stub shell`);
    }

    // wikilinks must resolve to an existing skill
    for (const m of raw.matchAll(/\[\[([a-z0-9-]+)\]\]/g)) {
      if (!skillSet.has(m[1])) add("warn", "WIKILINK-DANGLING", t, `[[${m[1]}]] does not resolve to a skill`);
    }

    // staleness: references to superseded mechanisms / non-locked embedders
    for (const inv of staleInvariants) {
      const hits = scanStale(raw, inv);
      if (hits.length) add("warn", `STALE:${inv.id}`, t, `${hits.length} line(s) reference a superseded mechanism — e.g. "${hits[0]}"`);
    }
  }

  // workflows
  if (existsSync(WORKFLOWS_DIR)) {
    for (const f of readdirSync(WORKFLOWS_DIR).filter((x) => x.endsWith(".md"))) {
      const t = `workflow:${basename(f, ".md")}`;
      const raw = readFileSync(join(WORKFLOWS_DIR, f), "utf8");
      const fm = frontmatter(raw);
      if (!fm.ok) { add("error", "NO-FRONTMATTER", t, "no parseable frontmatter"); continue; }
      const desc = field(fm.yaml, "description");
      if (!desc) add("error", "NO-DESCRIPTION", t, "workflow missing description");
      else if (desc.length < DESC_MIN) add("warn", "DESC-SHORT", t, `description ${desc.length} chars (< ${DESC_MIN})`);
      for (const inv of staleInvariants) {
        if (scanStale(raw, inv).length) add("warn", `STALE:${inv.id}`, t, "references a superseded mechanism");
      }
    }
  }

  const errors = findings.filter((f) => f.sev === "error").length;
  const warns = findings.filter((f) => f.sev === "warn").length;
  return { findings, summary: { skills: skillDirs.length, errors, warns, ok: errors === 0 } };
}

function main(argv) {
  const asJson = argv.includes("--json");
  let result;
  try {
    result = validate();
  } catch (err) {
    process.stderr.write(`validate: ${err.message}\n`);
    process.exitCode = 2;
    return;
  }
  if (asJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    const out = ["", "HEADY™ skill/workflow data validation", `  ${result.summary.skills} skills + workflows scanned`, ""];
    const mark = { error: "✗", warn: "▲" };
    if (result.findings.length === 0) out.push("  ✓ all skill/workflow data is valid.");
    for (const f of result.findings) out.push(`  ${mark[f.sev]} [${f.id}] ${f.target} — ${f.msg}`);
    out.push("", `  summary: ${result.summary.errors} error(s), ${result.summary.warns} warning(s).`, "");
    process.stdout.write(out.join("\n"));
  }
  process.exitCode = result.summary.ok ? 0 : 1;
}

if (process.argv[1] && process.argv[1].endsWith("validate.mjs")) main(process.argv.slice(2));
