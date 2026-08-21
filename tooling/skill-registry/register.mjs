#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Skill Registry — Claude Code registration v1.0.0         ║
// ║  Normalizes .agents/skills/* into .claude/skills/* so Claude Code ║
// ║  can discover them: frontmatter-first, name=dir, clean desc.      ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// The legacy/migrated skill packs in `.agents/skills/<name>/SKILL.md` are the
// authoring source, but Claude Code loads project skills from
// `.claude/skills/<name>/SKILL.md` and requires VALID YAML frontmatter on line
// 1 with `name` (matching the directory) and `description`. Two defects block
// direct use: (1) 25 sync-migrated packs have a preamble + HEADY_BRAND banner
// ABOVE the frontmatter, and (2) five packs declare a `name` that drops the
// `heady-` prefix and so mismatches their directory.
//
// This tool reads each source pack, lifts/repairs the frontmatter, canonicalizes
// `name` to the directory, collapses the description to a single capped line,
// and writes a clean pack (plus any sibling resource files) into .claude/skills.
// Idempotent and re-runnable after every `heady-sync pull`.
//
// Usage:
//   node register.mjs            register all skills into .claude/skills
//   node register.mjs --check    report what WOULD change; write nothing

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
  statSync,
  rmSync,
} from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");
const SRC_DIR = join(REPO_ROOT, ".agents", "skills");
const DEST_DIR = join(REPO_ROOT, ".claude", "skills");

// Claude Code frontmatter constraints (external spec, not φ-derived):
// name must match ^[a-z0-9]+(-[a-z0-9]+)*$; description is capped for the
// model's skill-selection context budget.
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_DESCRIPTION = 1024;

/** Locate the first `---`…`---` YAML frontmatter block; return {yaml, bodyStart}. */
function splitFrontmatter(lines) {
  let open = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      open = i;
      break;
    }
  }
  if (open === -1) return { yaml: [], bodyStart: 0 };
  for (let j = open + 1; j < lines.length; j++) {
    if (lines[j].trim() === "---") {
      return { yaml: lines.slice(open + 1, j), bodyStart: j + 1 };
    }
  }
  return { yaml: [], bodyStart: 0 };
}

/** Extract the `description` value, supporting inline and block (`>`/`|`) scalars. */
function extractDescription(yaml) {
  for (let i = 0; i < yaml.length; i++) {
    const m = yaml[i].match(/^description:\s*(.*)$/);
    if (!m) continue;
    let inline = m[1].trim();
    if (inline && inline !== ">" && inline !== "|" && inline !== ">-" && inline !== "|-") {
      return clean(stripQuotes(inline));
    }
    // Block scalar: gather subsequent more-indented lines until the next key.
    const parts = [];
    for (let j = i + 1; j < yaml.length; j++) {
      if (/^\S/.test(yaml[j]) && /^[A-Za-z0-9_-]+:/.test(yaml[j])) break;
      parts.push(yaml[j].trim());
    }
    return clean(parts.join(" "));
  }
  return "";
}

function stripQuotes(s) {
  return s.replace(/^["']/, "").replace(/["']$/, "");
}

function clean(s) {
  const out = s.replace(/\s+/g, " ").trim();
  return out.length > MAX_DESCRIPTION ? `${out.slice(0, MAX_DESCRIPTION - 1)}…` : out;
}

/** Escape a description for a double-quoted YAML scalar. */
function yamlQuote(s) {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function listSkillDirs() {
  if (!existsSync(SRC_DIR)) throw new Error(`source skills dir not found: ${SRC_DIR}`);
  return readdirSync(SRC_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

/** All files under a skill dir except SKILL.md (resources: scripts, data, etc.). */
function resourceFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    for (const e of readdirSync(cur, { withFileTypes: true })) {
      const abs = join(cur, e.name);
      if (e.isDirectory()) stack.push(abs);
      else if (!(cur === dir && e.name === "SKILL.md")) out.push(abs);
    }
  }
  return out;
}

function sameFileContent(left, right) {
  return existsSync(left) && readFileSync(left).equals(readFileSync(right));
}

function projectionDrift(name, content) {
  const sourceSkillDir = join(SRC_DIR, name);
  const destSkillDir = join(DEST_DIR, name);
  const drift = [];
  const destSkill = join(destSkillDir, "SKILL.md");

  if (!existsSync(destSkill)) {
    drift.push("missing projected SKILL.md");
  } else if (readFileSync(destSkill, "utf8") !== content) {
    drift.push("projected SKILL.md content differs");
  }

  const expectedResources = new Map(
    resourceFiles(sourceSkillDir).map((source) => [relative(sourceSkillDir, source), source]),
  );
  for (const [rel, source] of expectedResources) {
    const target = join(destSkillDir, rel);
    if (!sameFileContent(target, source)) drift.push(`resource differs: ${rel}`);
  }

  if (existsSync(destSkillDir)) {
    for (const target of resourceFiles(destSkillDir)) {
      const rel = relative(destSkillDir, target);
      if (!expectedResources.has(rel)) drift.push(`orphan projected resource: ${rel}`);
    }
  }

  return drift;
}

function buildSkill(name) {
  const srcFile = join(SRC_DIR, name, "SKILL.md");
  const raw = readFileSync(srcFile, "utf8");
  const lines = raw.split("\n");
  const { yaml, bodyStart } = splitFrontmatter(lines);
  let description = extractDescription(yaml);
  const issues = [];

  if (!NAME_RE.test(name)) issues.push(`name "${name}" is not a valid Claude skill name`);
  const fmName = (yaml.find((l) => /^name:/.test(l)) || "").replace(/^name:\s*/, "").trim();
  if (fmName && stripQuotes(fmName) !== name) {
    issues.push(`name canonicalized: "${stripQuotes(fmName)}" → "${name}"`);
  }
  if (!description) {
    description = `Heady ${name.replace(/-/g, " ")} skill. Use for ${name.replace(/^heady-/, "").replace(/-/g, " ")} tasks in the Heady ecosystem.`;
    issues.push("description synthesized (none found in source)");
  }
  if (yaml.length === 0) issues.push("no frontmatter in source — reconstructed");

  const body = lines.slice(bodyStart).join("\n").replace(/^\n+/, "");
  const content = `---\nname: ${name}\ndescription: ${yamlQuote(description)}\n---\n\n${body}`;
  return { name, srcFile, content, issues };
}

function main(argv) {
  const checkOnly = argv.includes("--check");
  const names = listSkillDirs();
  const out = [];
  out.push("");
  out.push(`HEADY™ skill registration → .claude/skills (${checkOnly ? "CHECK, no writes" : "writing"})`);
  out.push(`  source: ${relative(REPO_ROOT, SRC_DIR)}  (${names.length} skill packs)`);
  out.push("");

  if (!checkOnly && !existsSync(DEST_DIR)) mkdirSync(DEST_DIR, { recursive: true });

  let written = 0;
  let drifted = 0;
  const repaired = [];
  for (const name of names) {
    let built;
    try {
      built = buildSkill(name);
    } catch (err) {
      out.push(`  ✗ ${name}: ${err.message}`);
      continue;
    }
    if (built.issues.length) repaired.push(`  • ${name}: ${built.issues.join("; ")}`);
    if (checkOnly) {
      const drift = projectionDrift(name, built.content);
      if (drift.length) {
        drifted++;
        out.push(`  ✗ ${name}: ${drift.join("; ")}`);
      }
      continue;
    }

    const destSkillDir = join(DEST_DIR, name);
    if (existsSync(destSkillDir)) rmSync(destSkillDir, { recursive: true, force: true });
    mkdirSync(destSkillDir, { recursive: true });
    writeFileSync(join(destSkillDir, "SKILL.md"), built.content);
    // Carry bundled resource files (scripts, data) preserving relative layout.
    const srcSkillDir = join(SRC_DIR, name);
    for (const res of resourceFiles(srcSkillDir)) {
      const rel = relative(srcSkillDir, res);
      const target = join(destSkillDir, rel);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, readFileSync(res));
    }
    written++;
  }

  if (checkOnly && existsSync(DEST_DIR)) {
    const sourceNames = new Set(names);
    for (const entry of readdirSync(DEST_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory() || sourceNames.has(entry.name)) continue;
      drifted++;
      out.push(`  ✗ ${entry.name}: orphan projected skill directory`);
    }
  }

  if (repaired.length) {
    out.push(`  repairs applied (${repaired.length}):`);
    out.push(...repaired);
    out.push("");
  }
  out.push(
    checkOnly
      ? drifted === 0
        ? `  ✓ ${names.length}/${names.length} skill projections are in sync.`
        : `  ✗ ${drifted} skill projection(s) require registration.`
      : `  ✓ registered ${written}/${names.length} skills into ${relative(REPO_ROOT, DEST_DIR)}.`,
  );
  out.push("");
  process.stdout.write(out.join("\n"));
  if (checkOnly && drifted > 0) process.exitCode = 1;
}

main(process.argv.slice(2));
