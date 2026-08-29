#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Byte Pins CLI                                              ║
// ║  Ask BEFORE a sweep: which of these paths may I not casually edit? ║
// ║  Made with ❤️ by HeadySystems Inc.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
//
//   node tooling/byte-pins/bin/byte-pins.mjs list
//   node tooling/byte-pins/bin/byte-pins.mjs check --staged
//   node tooling/byte-pins/bin/byte-pins.mjs check --since <ref>
//   node tooling/byte-pins/bin/byte-pins.mjs check path/one path/two
//
// Exits 2 when a pinned path changed, so it can gate a sweep or a hook.

import { execFileSync } from 'node:child_process';
import { BYTE_PINS, classify, groupByPin } from '../src/pins.mjs';

const log = (s = '') => process.stdout.write(`${s}\n`);

function changedPaths(args) {
  const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).split('\n').filter(Boolean);
  if (args.includes('--staged')) return git('diff', '--cached', '--name-only');
  const i = args.indexOf('--since');
  if (i !== -1 && args[i + 1]) return git('diff', '--name-only', `${args[i + 1]}..HEAD`);
  const explicit = args.filter((a) => !a.startsWith('--'));
  if (explicit.length) return explicit;
  return git('diff', '--name-only');
}

const cmd = process.argv[2] ?? 'list';
const rest = process.argv.slice(3);

if (cmd === 'list') {
  log(`${BYTE_PINS.length} byte pins registered.\n`);
  for (const p of BYTE_PINS) {
    log(`● ${p.id}${p.offlineVerifiable ? '' : '   [authority is REMOTE — cannot be verified offline]'}`);
    log(`    pinned by : ${p.pinnedBy}`);
    log(`    breaks    : ${p.breaks}`);
    log(`    re-pin    : ${p.repin}\n`);
  }
  process.exit(0);
}

if (cmd !== 'check') {
  log(`unknown command "${cmd}" — expected list or check`);
  process.exit(64);
}

const paths = changedPaths(rest);
const groups = groupByPin(classify(paths));

if (groups.length === 0) {
  log(`byte-pins: ${paths.length} changed path(s), none byte-pinned — safe to sweep.`);
  process.exit(0);
}

log(`byte-pins: ${groups.length} PIN(S) HIT across ${paths.length} changed path(s).\n`);
for (const g of groups) {
  const shown = g.paths.slice(0, 5);
  log(`● ${g.pin.id} — ${g.paths.length} path(s)`);
  for (const p of shown) log(`    ${p}`);
  if (g.paths.length > shown.length) log(`    … and ${g.paths.length - shown.length} more`);
  log(`    pinned by : ${g.pin.pinnedBy}`);
  log(`    breaks    : ${g.pin.breaks}`);
  log(`    re-pin    : ${g.pin.repin}\n`);
}
log('Re-pin each one in the SAME commit as the edit, or revert the edit.');
process.exit(2);
