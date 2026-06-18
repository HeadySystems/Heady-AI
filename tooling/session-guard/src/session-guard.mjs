#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Session Guard — write-coordination for a multi-writer repo ║
// ║  One machine, many writers (interactive agents, the IDE, the cron  ║
// ║  auto-committer, watchers). They race: interleaved commits, edits  ║
// ║  clobbered mid-session. This is the single coordination primitive  ║
// ║  every local writer consults before it commits/pushes.             ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// MODEL: a machine-wide advisory lock (~/.heady/session.lock) + a persistent pause flag
// (~/.heady/autonomy.paused). Locks carry a heartbeat + TTL so a crashed session NEVER blocks
// forever (stale locks are ignored). `check` is the chokepoint the git hooks + the cron call:
//   exit 0 → caller MAY write (no lock, stale lock, or the caller owns it / autonomy not paused)
//   exit 1 → BLOCKED (a different owner holds a fresh lock)
//   exit 3 → acquire conflict (another fresh owner) without --force
//
// Identity: an "owner" is a short string (e.g. "claude-code", "cron:auto-commit", "antigravity").
// The current actor declares itself via $HEADY_SESSION_OWNER (env) or --owner. Autonomous writers
// pass their own owner and call `check` first; if blocked, they SKIP that cycle (exit 0, no-op).

import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { hostname } from "node:os";

const HOME = process.env.HOME || process.env.USERPROFILE || "/tmp";
const DIR = process.env.HEADY_SESSION_DIR || join(HOME, ".heady");
const LOCK = join(DIR, "session.lock");
const PAUSE = join(DIR, "autonomy.paused");
const DEFAULT_TTL = Number(process.env.HEADY_SESSION_TTL || 1800); // 30 min heartbeat window

const now = () => Math.floor(Date.now() / 1000);
const log = (level, msg, f = {}) =>
  process.stdout.write(`${JSON.stringify({ t: "session-guard", level, msg, ...f })}\n`);

function ensureDir() { if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true }); }

/** Read the current lock, or null. Tolerates a corrupt file (treats as no lock). */
export function readLock() {
  if (!existsSync(LOCK)) return null;
  try { return JSON.parse(readFileSync(LOCK, "utf8")); } catch { return null; }
}

/** A lock is fresh while (now - heartbeatAt) <= ttlSec; otherwise it is stale and ignored. */
export function isFresh(lock, at = now()) {
  if (!lock) return false;
  const beat = Number(lock.heartbeatAt ?? lock.acquiredAt ?? 0);
  const ttl = Number(lock.ttlSec ?? DEFAULT_TTL);
  return at - beat <= ttl;
}

export function isPaused() { return existsSync(PAUSE); }

/** Resolve the caller's owner identity. */
function callerOwner(explicit) {
  return explicit || process.env.HEADY_SESSION_OWNER || `${hostname()}:${process.pid}`;
}

/**
 * May `owner` write right now? True unless a *different* owner holds a *fresh* lock.
 * Pause state does NOT block interactive owners — pause is advisory and consulted
 * separately by autonomous writers (they OR it into their own skip decision).
 */
export function mayWrite(owner) {
  const lock = readLock();
  if (!isFresh(lock)) return { ok: true, reason: lock ? "stale-lock" : "no-lock" };
  if (lock.owner === owner) return { ok: true, reason: "self" };
  return { ok: false, reason: "held", by: lock.owner, intent: lock.intent ?? null, heartbeatAt: lock.heartbeatAt };
}

function acquire({ owner, ttl, intent, force }) {
  ensureDir();
  const lock = readLock();
  if (isFresh(lock) && lock.owner !== owner && !force) {
    log("warn", "acquire blocked — a different fresh session holds the lock", { by: lock.owner, intent: lock.intent });
    process.exit(3);
  }
  const rec = { owner, pid: process.pid, host: hostname(), acquiredAt: now(), heartbeatAt: now(), ttlSec: Number(ttl) || DEFAULT_TTL, intent: intent ?? null };
  writeFileSync(LOCK, `${JSON.stringify(rec, null, 2)}\n`);
  log("info", "session lock acquired", { owner, ttlSec: rec.ttlSec, intent: rec.intent });
}

function heartbeat({ owner }) {
  const lock = readLock();
  if (!lock || lock.owner !== owner) { log("warn", "heartbeat skipped — not the lock owner", { owner, lockOwner: lock?.owner ?? null }); process.exit(1); }
  lock.heartbeatAt = now();
  writeFileSync(LOCK, `${JSON.stringify(lock, null, 2)}\n`);
  log("info", "heartbeat", { owner, heartbeatAt: lock.heartbeatAt });
}

function release({ owner, force }) {
  const lock = readLock();
  if (!lock) { log("info", "release no-op — no lock"); return; }
  if (lock.owner !== owner && !force) { log("warn", "release refused — not the owner (use --force)", { owner, lockOwner: lock.owner }); process.exit(1); }
  rmSync(LOCK, { force: true });
  log("info", "session lock released", { owner, forced: !!force });
}

function status() {
  const lock = readLock();
  const fresh = isFresh(lock);
  const ageS = lock ? now() - Number(lock.heartbeatAt ?? lock.acquiredAt ?? 0) : null;
  log("info", "status", { locked: !!lock && fresh, stale: !!lock && !fresh, owner: lock?.owner ?? null, intent: lock?.intent ?? null, ageSeconds: ageS, autonomyPaused: isPaused(), lockPath: LOCK });
  process.exit(0);
}

function pause(on) {
  ensureDir();
  if (on) { writeFileSync(PAUSE, `${JSON.stringify({ pausedAt: now(), by: callerOwner() })}\n`); log("info", "autonomy PAUSED — autonomous writers will skip", { flag: PAUSE }); }
  else { rmSync(PAUSE, { force: true }); log("info", "autonomy RESUMED", { flag: PAUSE }); }
}

// ─── CLI ────────────────────────────────────────────────────────────────────
function parseFlags(argv) {
  const f = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--force") f.force = true;
    else if (a === "--owner") f.owner = argv[++i];
    else if (a === "--ttl") f.ttl = argv[++i];
    else if (a === "--intent") f.intent = argv[++i];
  }
  return f;
}

const direct = process.argv[1] && process.argv[1].endsWith("session-guard.mjs");
if (direct) {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  const owner = callerOwner(flags.owner);
  switch (cmd) {
    case "acquire": acquire({ owner, ttl: flags.ttl, intent: flags.intent, force: flags.force }); break;
    case "heartbeat": heartbeat({ owner }); break;
    case "release": release({ owner, force: flags.force }); break;
    case "status": status(); break;
    case "pause": pause(true); break;
    case "resume": pause(false); break;
    case "check": {
      // The chokepoint. Blocked iff a different owner holds a fresh lock.
      const v = mayWrite(owner);
      if (v.ok) process.exit(0);
      log("error", "WRITE BLOCKED — another session holds the lock", { you: owner, heldBy: v.by, intent: v.intent });
      process.exit(1);
    }
    default:
      process.stderr.write("usage: heady-session <acquire|heartbeat|release|status|pause|resume|check> [--owner X] [--ttl S] [--intent T] [--force]\n");
      process.exit(2);
  }
}
