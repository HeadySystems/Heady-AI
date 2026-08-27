// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Enforcer Lib — File Selector v1.0.0                        ║
// ║  Shared tracked-file / diff-file selection for the governance      ║
// ║  enforcers. Default CI mode scans only files changed vs the merge  ║
// ║  base so the gate holds NEW code to the standard without           ║
// ║  retroactively failing the rebuild baseline (compliant day one).   ║
// ║  Made with ❤️ by HeadySystems Inc.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { workerData } from 'node:worker_threads';

export const ROOT = resolve(new URL('../../..', import.meta.url).pathname);

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 })
  .split('\n').map((s) => s.trim()).filter(Boolean);
const injectedFiles = Array.isArray(workerData?.headyGateFiles)
  ? workerData.headyGateFiles.filter((file) => typeof file === 'string' && file.length > 0)
  : null;

/**
 * Select files to scan.
 * argv: pass process.argv.slice(2). Supports:
 *   --diff <base>   scan only files added/changed vs <base> (e.g. origin/rebuild)
 *   --all           scan all tracked files (full-repo mode)
 * Default (no flag) = --all.
 * @returns {{ mode: 'diff'|'all', base: string|null, files: string[] }}
 */
export function selectFiles(argv) {
  const di = argv.indexOf('--diff');
  if (di !== -1) {
    const base = argv[di + 1] || 'origin/rebuild';
    let files = [];
    try {
      // Added/Copied/Modified/Renamed tracked files in the diff range.
      files = git(['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`]);
    } catch {
      files = git(['ls-files']); // fall back to full scan if base is unavailable
    }
    return { mode: 'diff', base, files };
  }
  return { mode: 'all', base: null, files: injectedFiles ?? git(['ls-files']) };
}
