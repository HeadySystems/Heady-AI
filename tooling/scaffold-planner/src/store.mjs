// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Scaffold Planner — store v1.0.0                           ║
// ║  Shared IO: the immutable plan source + the decision overlay.     ║
// ║  One module so the CLI and the sync server never drift on paths.  ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, "..", "..", "..");
export const PATHS = Object.freeze({
  plan: join(REPO_ROOT, "configs", "scaffold-plan.json"),
  decisions: join(REPO_ROOT, ".data", "scaffold", "decisions.json"),
  portalCopy: join(REPO_ROOT, "apps", "headyme-portal", "public", "scaffold-plan.json"),
});

export function loadPlan() {
  return JSON.parse(readFileSync(PATHS.plan, "utf8"));
}

export function loadDecisions() {
  if (!existsSync(PATHS.decisions)) return {};
  try { return JSON.parse(readFileSync(PATHS.decisions, "utf8")); } catch { return {}; }
}

export function saveDecisions(decisions) {
  mkdirSync(dirname(PATHS.decisions), { recursive: true });
  writeFileSync(PATHS.decisions, `${JSON.stringify(decisions, null, 2)}\n`);
  return decisions;
}
