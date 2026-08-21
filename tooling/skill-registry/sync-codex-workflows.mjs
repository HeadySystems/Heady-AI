#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Codex Workflow Shortcut Sync v1.1.0                      ║
// ║  Projects canonical workflows into Codex-discoverable skills.    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Codex discovers repository shortcuts from `.agents/skills` and invokes
// them with `$name` or `/skills`. Workflow sources remain authoritative in
// `.agents/workflows`; this tool creates small generated skill adapters under
// `.agents/codex-workflows` and relative directory symlinks in `.agents/skills`.
// Existing authored skills win on name collisions and are never overwritten.
//
// Usage:
//   node sync-codex-workflows.mjs [--check] [--json]

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");
const WORKFLOWS_DIR = join(REPO_ROOT, ".agents", "workflows");
const SKILLS_DIR = join(REPO_ROOT, ".agents", "skills");
const ADAPTERS_DIR = join(REPO_ROOT, ".agents", "codex-workflows");
const ADAPTER_MARKER = "<!-- HEADY_CODEX_WORKFLOW_SHORTCUT:GENERATED -->";
const LINK_PREFIX = join("..", "codex-workflows");
const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EXPLICIT_INVOCATION_POLICY = "policy:\n  allow_implicit_invocation: false\n";

function listWorkflows() {
  if (!existsSync(WORKFLOWS_DIR)) {
    throw new Error(`workflow source directory not found: ${WORKFLOWS_DIR}`);
  }
  return readdirSync(WORKFLOWS_DIR, { withFileTypes: true })
    .filter((entry) => (entry.isFile() || entry.isSymbolicLink()) && entry.name.endsWith(".md"))
    .map((entry) => entry.name.slice(0, -3))
    .sort();
}

function splitFrontmatter(lines) {
  if (lines[0]?.trim() !== "---") return { yaml: [], bodyStart: 0 };
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "---") {
      return { yaml: lines.slice(1, index), bodyStart: index + 1 };
    }
  }
  return { yaml: [], bodyStart: 0 };
}

function stripQuotes(value) {
  return value.replace(/^["']/, "").replace(/["']$/, "");
}

function clean(value) {
  return value.replace(/\s+/g, " ").trim();
}

function extractDescription(yaml) {
  for (let index = 0; index < yaml.length; index += 1) {
    const match = yaml[index].match(/^description:\s*(.*)$/);
    if (!match) continue;
    const inline = match[1].trim();
    if (inline && ![">", "|", ">-", "|-"].includes(inline)) {
      return clean(stripQuotes(inline));
    }
    const parts = [];
    for (let cursor = index + 1; cursor < yaml.length; cursor += 1) {
      if (/^\S/.test(yaml[cursor]) && /^[A-Za-z0-9_-]+:/.test(yaml[cursor])) break;
      parts.push(yaml[cursor].trim());
    }
    return clean(parts.join(" "));
  }
  return "";
}

function yamlQuote(value) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function buildAdapter(name) {
  const workflowPath = join(WORKFLOWS_DIR, `${name}.md`);
  const workflow = readFileSync(workflowPath, "utf8");
  const { yaml } = splitFrontmatter(workflow.split("\n"));
  const sourceDescription = extractDescription(yaml);
  const description = sourceDescription
    ? `Run the canonical ${name} Heady workflow. ${sourceDescription}`
    : `Run the canonical ${name} workflow from .agents/workflows/${name}.md.`;

  return `---
name: ${name}
description: ${yamlQuote(description)}
---

${ADAPTER_MARKER}
<!-- HEADY_BRAND:BEGIN
╔══════════════════════════════════════════════════════════════════╗
║  HEADY™ Codex Workflow Shortcut                                 ║
║  Generated adapter — canonical instructions stay in workflows   ║
║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END -->

# \`${name}\` Codex shortcut

This skill is a generated Codex adapter for the canonical workflow at
\`.agents/workflows/${name}.md\`.

It is an explicit-only command shortcut. Invoke it as \`$${name}\`; do not
select it implicitly from ordinary task wording.

When invoked:

1. Read \`.agents/workflows/${name}.md\` completely before taking task actions.
2. Follow that workflow as the authoritative execution contract.
3. Treat text following \`$${name}\` as workflow input and preserve its approval boundaries.
4. Read applicable \`AGENTS.md\` instructions and any skills explicitly required by the workflow.
5. If the canonical workflow is missing or unreadable, stop and report the broken projection.
`;
}

function lstatOrNull(path) {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
}

function isGeneratedAdapter(path) {
  try {
    return readFileSync(join(path, "SKILL.md"), "utf8").includes(ADAPTER_MARKER);
  } catch {
    return false;
  }
}

function classifySkill(name) {
  const path = join(SKILLS_DIR, name);
  const stat = lstatOrNull(path);
  if (!stat) return { kind: "missing", path };
  if (stat.isDirectory()) return { kind: "authored", path };
  if (!stat.isSymbolicLink()) return { kind: "conflict", path, reason: "not a directory or symlink" };
  const expected = join(LINK_PREFIX, name);
  const actual = readlinkSync(path);
  if (actual === expected) return { kind: "managed", path, actual, expected };
  return { kind: "conflict", path, reason: `symlink points to ${actual}`, actual, expected };
}

function collectPlan() {
  const workflows = listWorkflows();
  const workflowSet = new Set(workflows);
  const generatedNames = [];
  const coveredByAuthoredSkill = [];
  const conflicts = [];
  const adapterDrift = [];
  const linkDrift = [];

  for (const name of workflows) {
    if (!NAME_RE.test(name)) {
      conflicts.push({ name, reason: "workflow filename is not a valid skill name" });
      continue;
    }
    const skill = classifySkill(name);
    if (skill.kind === "authored") {
      coveredByAuthoredSkill.push(name);
      continue;
    }
    if (skill.kind === "conflict") {
      conflicts.push({ name, reason: skill.reason });
      continue;
    }

    generatedNames.push(name);
    const expectedAdapter = buildAdapter(name);
    const adapterPath = join(ADAPTERS_DIR, name, "SKILL.md");
    const policyPath = join(ADAPTERS_DIR, name, "agents", "openai.yaml");
    if (
      !existsSync(adapterPath)
      || readFileSync(adapterPath, "utf8") !== expectedAdapter
      || !existsSync(policyPath)
      || readFileSync(policyPath, "utf8") !== EXPLICIT_INVOCATION_POLICY
    ) {
      adapterDrift.push(name);
    }
    if (skill.kind !== "managed") linkDrift.push(name);
  }

  const generatedSet = new Set(generatedNames);
  const orphanAdapters = [];
  if (existsSync(ADAPTERS_DIR)) {
    for (const entry of readdirSync(ADAPTERS_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory() || generatedSet.has(entry.name)) continue;
      const path = join(ADAPTERS_DIR, entry.name);
      if (isGeneratedAdapter(path)) orphanAdapters.push(entry.name);
      else conflicts.push({ name: entry.name, reason: "unmanaged directory in adapter root" });
    }
  }

  const orphanLinks = [];
  if (existsSync(SKILLS_DIR)) {
    for (const entry of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
      if (!entry.isSymbolicLink()) continue;
      const path = join(SKILLS_DIR, entry.name);
      const target = readlinkSync(path);
      if (!target.startsWith(`${LINK_PREFIX}/`)) continue;
      if (!workflowSet.has(entry.name) || !generatedSet.has(entry.name)) orphanLinks.push(entry.name);
    }
  }

  return {
    workflows,
    generatedNames,
    coveredByAuthoredSkill,
    conflicts,
    adapterDrift,
    linkDrift,
    orphanAdapters,
    orphanLinks,
  };
}

function applyPlan(plan) {
  if (plan.conflicts.length > 0) return { written: 0, linked: 0, pruned: 0 };
  mkdirSync(ADAPTERS_DIR, { recursive: true });
  mkdirSync(SKILLS_DIR, { recursive: true });

  let written = 0;
  let linked = 0;
  let pruned = 0;

  for (const name of plan.generatedNames) {
    const adapterDir = join(ADAPTERS_DIR, name);
    const adapterPath = join(adapterDir, "SKILL.md");
    const policyPath = join(adapterDir, "agents", "openai.yaml");
    const expected = buildAdapter(name);
    let changed = false;
    mkdirSync(adapterDir, { recursive: true });
    if (!existsSync(adapterPath) || readFileSync(adapterPath, "utf8") !== expected) {
      writeFileSync(adapterPath, expected);
      changed = true;
    }
    mkdirSync(dirname(policyPath), { recursive: true });
    if (
      !existsSync(policyPath)
      || readFileSync(policyPath, "utf8") !== EXPLICIT_INVOCATION_POLICY
    ) {
      writeFileSync(policyPath, EXPLICIT_INVOCATION_POLICY);
      changed = true;
    }
    if (changed) written += 1;

    const skillPath = join(SKILLS_DIR, name);
    const skill = classifySkill(name);
    if (skill.kind === "missing") {
      symlinkSync(join(LINK_PREFIX, name), skillPath, "dir");
      linked += 1;
    }
  }

  for (const name of plan.orphanLinks) {
    rmSync(join(SKILLS_DIR, name), { force: true });
    pruned += 1;
  }
  for (const name of plan.orphanAdapters) {
    rmSync(join(ADAPTERS_DIR, name), { recursive: true, force: true });
    pruned += 1;
  }

  return { written, linked, pruned };
}

function main(argv) {
  const checkOnly = argv.includes("--check");
  const json = argv.includes("--json");
  const plan = collectPlan();
  const driftCount = plan.adapterDrift.length
    + plan.linkDrift.length
    + plan.orphanAdapters.length
    + plan.orphanLinks.length;
  const inSync = driftCount === 0 && plan.conflicts.length === 0;
  const changes = checkOnly ? { written: 0, linked: 0, pruned: 0 } : applyPlan(plan);
  const ok = checkOnly ? inSync : plan.conflicts.length === 0;
  const summary = {
    ok,
    inSync,
    workflows: plan.workflows.length,
    generatedShortcuts: plan.generatedNames.length,
    coveredByAuthoredSkill: plan.coveredByAuthoredSkill,
    conflicts: plan.conflicts,
    adapterDrift: plan.adapterDrift,
    linkDrift: plan.linkDrift,
    orphanAdapters: plan.orphanAdapters,
    orphanLinks: plan.orphanLinks,
    ...changes,
  };

  if (json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } else if (ok) {
    process.stdout.write(
      checkOnly
        ? `HEADY Codex workflow shortcuts: in sync — ${summary.workflows} workflows, ${summary.generatedShortcuts} generated, ${summary.coveredByAuthoredSkill.length} covered by authored skills\n`
        : `HEADY Codex workflow shortcuts: ${summary.workflows} workflows · wrote ${summary.written} · linked ${summary.linked} · pruned ${summary.pruned}\n`,
    );
  } else {
    process.stderr.write("HEADY Codex workflow shortcuts: OUT OF SYNC\n");
    for (const conflict of summary.conflicts) {
      process.stderr.write(`  ✗ ${conflict.name}: ${conflict.reason}\n`);
    }
    for (const name of summary.adapterDrift) process.stderr.write(`  ✗ adapter drift: ${name}\n`);
    for (const name of summary.linkDrift) process.stderr.write(`  ✗ shortcut link drift: ${name}\n`);
    for (const name of summary.orphanAdapters) process.stderr.write(`  ✗ orphan adapter: ${name}\n`);
    for (const name of summary.orphanLinks) process.stderr.write(`  ✗ orphan shortcut link: ${name}\n`);
  }

  process.exitCode = ok ? 0 : 1;
}

main(process.argv.slice(2));
