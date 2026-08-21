#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Intelligence Router v1.0.0                               ║
// ║  Authority-aware task routing across Heady skills and workflows. ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assign, loadRoles } from "../../packages/perspective/src/index.mjs";
import { preflight } from "./preflight.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");
const PHI = 1.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13];
const MAX_SELECTED = FIB[4];
const MIN_BENEFIT = 1 / (PHI * FIB[4]);
const ROUTER_REFS = new Set(["heady", "heady-command"]);

function pathsFor(candidate) {
  if (candidate.kind === "skill") {
    return {
      source: join(REPO_ROOT, ".agents", "skills", candidate.ref, "SKILL.md"),
      projection: join(REPO_ROOT, ".claude", "skills", candidate.ref, "SKILL.md"),
    };
  }
  return {
    source: join(REPO_ROOT, ".agents", "workflows", `${candidate.ref}.md`),
    projection: join(REPO_ROOT, ".claude", "commands", `${candidate.ref}.md`),
  };
}

function qualify(candidate) {
  const paths = pathsFor(candidate);
  const sourceAvailable = existsSync(paths.source);
  const projectionAvailable = existsSync(paths.projection);
  return {
    ...candidate,
    source: paths.source,
    projection: paths.projection,
    sourceAvailable,
    projectionAvailable,
    available: sourceAvailable && projectionAvailable,
    authority: sourceAvailable ? "canonical-source" : "unverified",
  };
}

/** Build a deterministic, non-recursive execution route; the caller remains the executor. */
export function routeTask(taskText, { preflightResult, roles } = {}) {
  const task = String(taskText ?? "").trim();
  if (!task) throw new TypeError("routeTask requires non-empty task text");

  const capabilityScan = preflightResult ?? preflight(task);
  const candidates = capabilityScan.shortlist.map(qualify);
  const explicitOrder = new Map(capabilityScan.explicitRefs.map((ref, index) => [ref, index]));
  const selected = candidates
    .filter((candidate) => !ROUTER_REFS.has(candidate.ref))
    .filter((candidate) => candidate.available)
    .filter((candidate) => candidate.explicit || (candidate.decision === "EXECUTE" && candidate.score >= MIN_BENEFIT))
    .sort((a, b) => {
      const aOrder = explicitOrder.get(a.ref) ?? Number.POSITIVE_INFINITY;
      const bOrder = explicitOrder.get(b.ref) ?? Number.POSITIVE_INFINITY;
      return aOrder - bOrder || Number(b.explicit) - Number(a.explicit) || b.score - a.score || a.ref.localeCompare(b.ref);
    })
    .slice(0, MAX_SELECTED);

  const perspectiveRoles = roles ?? loadRoles();
  const roleRouting = assign(task, perspectiveRoles, { topN: MAX_SELECTED });
  const unresolved = [
    ...capabilityScan.unresolvedExplicitRefs,
    ...candidates.filter((candidate) => candidate.explicit && !candidate.available).map((candidate) => candidate.ref),
  ].filter((ref, index, refs) => refs.indexOf(ref) === index);

  return {
    task,
    policy: {
      mechanism: "Heady Auto-Flow capability scan plus HeadyPerspective authority-weighted role assignment",
      userAuthorityRequired: true,
      availabilityRequired: true,
      recursiveRouterInvocation: false,
      minimumAutomaticBenefit: MIN_BENEFIT,
      maxSelected: MAX_SELECTED,
    },
    roleRouting,
    selected,
    unresolvedExplicitRefs: unresolved,
    advisory: candidates.filter((candidate) => candidate.decision === "CAUTIOUS" && candidate.available),
    catalogSize: capabilityScan.catalogSize,
  };
}

function render(result) {
  const lines = [
    "",
    `HEADY™ intelligence route — scanned ${result.catalogSize} capabilities`,
    `  task: "${result.task}"`,
    "",
    "  perspective roles:",
  ];
  if (result.roleRouting.length === 0) lines.push("  · no registry role matched lexically");
  for (const role of result.roleRouting) lines.push(`  · ${role.role} (${role.kind}, ${role.score.toFixed(4)})`);
  lines.push("", "  execution route:");
  if (result.selected.length === 0) lines.push("  · no available capability cleared the execution gate; proceed from governed primitives");
  for (const item of result.selected) {
    const why = item.explicit ? "explicit user request" : `benefit ${item.score.toFixed(3)}`;
    lines.push(`  · ${item.kind} ${item.ref} — ${why}; ${item.authority}`);
  }
  if (result.unresolvedExplicitRefs.length > 0) {
    lines.push("", `  unresolved explicit references: ${result.unresolvedExplicitRefs.join(", ")}`);
  }
  lines.push("");
  return lines.join("\n");
}

function main(argv) {
  const asJson = argv.includes("--json");
  const task = argv.filter((arg) => arg !== "--json" && arg !== "--").join(" ").trim();
  if (!task) {
    process.stderr.write('heady-route: provide a task, e.g. node route.mjs "audit the repository"\n');
    process.exitCode = 2;
    return;
  }
  try {
    const result = routeTask(task);
    process.stdout.write(asJson ? `${JSON.stringify(result, null, 2)}\n` : render(result));
  } catch (error) {
    process.stderr.write(`heady-route: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && process.argv[1].endsWith("route.mjs")) main(process.argv.slice(2));
