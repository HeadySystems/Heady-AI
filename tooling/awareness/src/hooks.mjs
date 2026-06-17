// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Awareness — Git Hook Installer v1.0.0                     ║
// ║  Installs git-event triggers (post-commit/merge/checkout/rewrite) ║
// ║  that fire awareness reactions on the changes any AI should see —  ║
// ║  committed/merged state, NOT every keystroke. Chosen over a        ║
// ║  filesystem watcher on purpose: the fs-wide watcher path already   ║
// ║  blew up this host (1400% CPU / 11GB, CLAUDE_MEMORY §6). Hooks      ║
// ║  cost nothing idle, never block or fail the git operation, and     ║
// ║  are idempotent + reversible (marked block, preserves user hooks). ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { readFileSync, writeFileSync, existsSync, chmodSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { gitDir } from "./git.mjs";

export const HOOKS = Object.freeze(["post-commit", "post-merge", "post-checkout", "post-rewrite"]);

const BEGIN = "# >>> heady-awareness >>>";
const END = "# <<< heady-awareness <<<";

/** The marked block injected into each hook — backgrounded, non-blocking, never fatal. */
function block(hookName) {
  return [
    BEGIN,
    "# Heady Change Awareness — react to codebase changes (non-blocking; never fails the git op).",
    'REPO_TOP="$(git rev-parse --show-toplevel 2>/dev/null)"',
    'if [ -n "$REPO_TOP" ] && command -v node >/dev/null 2>&1; then',
    `  ( node "$REPO_TOP/tooling/awareness/src/cli.mjs" react --trigger ${hookName} --quiet >/dev/null 2>&1 & ) || true`,
    "fi",
    END,
    "",
  ].join("\n");
}

function stripBlock(content) {
  const lines = content.split("\n");
  const out = [];
  let skip = false;
  for (const line of lines) {
    if (line.trim() === BEGIN) { skip = true; continue; }
    if (line.trim() === END) { skip = false; continue; }
    if (!skip) out.push(line);
  }
  return out.join("\n");
}

/**
 * Install (idempotently) the awareness hooks. Preserves any existing hook body:
 * a non-Heady hook gets our block appended; re-running replaces only our block.
 * @returns {{ installed: string[], hooksDir: string }}
 */
export function installHooks(repoRoot) {
  const gd = gitDir(repoRoot);
  if (!gd) throw new Error("installHooks: not a git repository");
  const hooksDir = join(gd, "hooks");
  if (!existsSync(hooksDir)) mkdirSync(hooksDir, { recursive: true });

  const installed = [];
  for (const name of HOOKS) {
    const file = join(hooksDir, name);
    let base = "#!/bin/sh\n";
    if (existsSync(file)) {
      const existing = readFileSync(file, "utf8");
      base = stripBlock(existing).replace(/\n+$/, "\n"); // drop a prior Heady block, keep the rest
      if (!base.startsWith("#!")) base = `#!/bin/sh\n${base}`;
      if (!base.endsWith("\n")) base += "\n";
    }
    writeFileSync(file, `${base}\n${block(name)}`);
    chmodSync(file, 0o755);
    installed.push(name);
  }
  return { installed, hooksDir };
}

/**
 * Remove the awareness block from every hook (leaving any user content intact).
 * @returns {{ cleaned: string[], hooksDir: string }}
 */
export function uninstallHooks(repoRoot) {
  const gd = gitDir(repoRoot);
  if (!gd) throw new Error("uninstallHooks: not a git repository");
  const hooksDir = join(gd, "hooks");
  const cleaned = [];
  for (const name of HOOKS) {
    const file = join(hooksDir, name);
    if (!existsSync(file)) continue;
    const stripped = stripBlock(readFileSync(file, "utf8")).replace(/\n{3,}/g, "\n\n");
    // If nothing but a shebang remains, the file is ours alone — blank it to a no-op shebang.
    writeFileSync(file, stripped.trim() === "#!/bin/sh" ? "#!/bin/sh\n" : stripped);
    chmodSync(file, 0o755);
    cleaned.push(name);
  }
  return { cleaned, hooksDir };
}

/** Report which hooks currently carry the awareness block. */
export function hooksStatus(repoRoot) {
  const gd = gitDir(repoRoot);
  if (!gd) return { installed: [], hooksDir: null };
  const hooksDir = join(gd, "hooks");
  const installed = HOOKS.filter((name) => {
    const file = join(hooksDir, name);
    return existsSync(file) && readFileSync(file, "utf8").includes(BEGIN);
  });
  return { installed, hooksDir };
}
