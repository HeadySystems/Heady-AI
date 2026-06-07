#!/usr/bin/env node
// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: scripts/rebuild/create-project-zip.js                                                    ║
// ║  LAYER: automation                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

/**
 * DEPRECATED — use `npm run rebuild:zip` → scripts/make_zip.py instead.
 *
 * This shim delegates to the consolidated make_zip.py which handles
 * symlinks, missing files, proper exclusions, and argparse for output/prefix.
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const CONSOLIDATED = path.join(ROOT, 'scripts', 'make_zip.py');

function main() {
    process.stdout.write(`[DEPRECATED] Delegating to scripts/make_zip.py\n`);
    const result = spawnSync('python3', [CONSOLIDATED], {
        cwd: ROOT,
        stdio: 'inherit',
    });
    process.exitCode = result.status ?? 1;
}

main();
