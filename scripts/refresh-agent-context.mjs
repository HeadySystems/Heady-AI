#!/usr/bin/env node
/* HEADY_BRAND:BEGIN */
/* FILE: scripts/refresh-agent-context.mjs · regenerates the daily context pack */
/* HEADY_BRAND:END */
/**
 * Refreshes the DAILY_REFRESH block in docs/AGENT_CONTEXT_PACK.md so agents always
 * boot with current state. Idempotent: only the marked block changes. Pulls live
 * state from package.json, git, and HEADY_CONTEXT.md (the auto-scanned root context).
 *
 * Usage: node scripts/refresh-agent-context.mjs [--check]
 *   --check : exit 1 if the pack is out of date instead of rewriting it (CI gate).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACK = join(ROOT, 'docs', 'AGENT_CONTEXT_PACK.md');
const BEGIN = '<!-- DAILY_REFRESH:BEGIN -->';
const END = '<!-- DAILY_REFRESH:END -->';
const SOURCE_OF_TRUTH = 'HeadySystems/heady-ai';

function safe(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

function readVersion() {
  return safe(() => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    return `${pkg.name ?? 'heady'} v${pkg.version ?? '0.0.0'}`;
  }, 'unknown (package.json unreadable)');
}

function readBranch() {
  return safe(
    () => execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim(),
    'unknown',
  );
}

function readLiveStateLine() {
  // Pull the most recent "Scanned" timestamp + a couple counters from HEADY_CONTEXT.md.
  return safe(() => {
    const ctx = readFileSync(join(ROOT, 'HEADY_CONTEXT.md'), 'utf8');
    const scanned = ctx.match(/\*\*Scanned:\*\*\s*([^\n]+)/)?.[1]?.trim();
    const services = ctx.match(/\*\*Services:\*\*\s*([^\n]+)/)?.[1]?.trim();
    const parts = [];
    if (scanned) parts.push(`scanned ${scanned}`);
    if (services) parts.push(services);
    return parts.length ? parts.join(' · ') : 'see HEADY_CONTEXT.md';
  }, 'see HEADY_CONTEXT.md');
}

function buildBlock() {
  const now = new Date().toISOString();
  return [
    BEGIN,
    '## Daily Refresh',
    `- **Refreshed:** ${now}`,
    `- **Source of truth:** ${SOURCE_OF_TRUTH}`,
    `- **Platform version:** ${readVersion()}`,
    `- **Branch:** ${readBranch()}`,
    `- **Live state:** ${readLiveStateLine()}`,
    END,
  ].join('\n');
}

function main() {
  const check = process.argv.includes('--check');
  let doc;
  try {
    doc = readFileSync(PACK, 'utf8');
  } catch {
    console.error(`[refresh-agent-context] cannot read ${PACK}`);
    process.exit(2);
  }

  const start = doc.indexOf(BEGIN);
  const stop = doc.indexOf(END);
  if (start === -1 || stop === -1 || stop < start) {
    console.error('[refresh-agent-context] DAILY_REFRESH markers missing or malformed');
    process.exit(2);
  }

  const before = doc.slice(0, start);
  const after = doc.slice(stop + END.length);
  const next = `${before}${buildBlock()}${after}`;

  // Normalize the only volatile line (timestamp) when comparing for --check.
  const stripTs = (s) => s.replace(/- \*\*Refreshed:\*\* [^\n]+/g, '- **Refreshed:** <ts>');
  const changed = stripTs(next) !== stripTs(doc);

  if (check) {
    if (changed) {
      console.error('[refresh-agent-context] pack is STALE — run without --check to regenerate');
      process.exit(1);
    }
    console.log('[refresh-agent-context] pack is current');
    return;
  }

  writeFileSync(PACK, next);
  console.log(`[refresh-agent-context] refreshed ${PACK}`);
}

main();
