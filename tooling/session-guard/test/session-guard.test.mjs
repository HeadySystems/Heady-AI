// session-guard — end-to-end CLI tests (real lock file in a temp dir). node:test, no deps.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const GUARD = resolve(import.meta.dirname, "..", "src", "session-guard.mjs");

/** Run the CLI with an isolated lock dir + declared owner. Returns {code, out}. */
function run(dir, owner, args = []) {
  const env = { ...process.env, HEADY_SESSION_DIR: dir, HEADY_SESSION_OWNER: owner };
  try {
    const out = execFileSync("node", [GUARD, ...args], { env, encoding: "utf8" });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

function withDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "sg-"));
  try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test("check passes when no lock exists", () => withDir((dir) => {
  assert.equal(run(dir, "alice", ["check"]).code, 0);
}));

test("acquire then check: owner allowed, other blocked", () => withDir((dir) => {
  assert.equal(run(dir, "alice", ["acquire", "--intent", "edit"]).code, 0);
  assert.ok(existsSync(join(dir, "session.lock")), "lock file written");
  assert.equal(run(dir, "alice", ["check"]).code, 0, "owner may write");
  assert.equal(run(dir, "bob", ["check"]).code, 1, "other session blocked");
}));

test("acquire conflict exits 3 without --force; --force steals", () => withDir((dir) => {
  run(dir, "alice", ["acquire"]);
  assert.equal(run(dir, "bob", ["acquire"]).code, 3, "conflict without force");
  assert.equal(run(dir, "bob", ["acquire", "--force"]).code, 0, "force steals");
  assert.equal(run(dir, "alice", ["check"]).code, 1, "alice now blocked");
}));

test("release frees the lock", () => withDir((dir) => {
  run(dir, "alice", ["acquire"]);
  assert.equal(run(dir, "alice", ["release"]).code, 0);
  assert.ok(!existsSync(join(dir, "session.lock")), "lock removed");
  assert.equal(run(dir, "bob", ["check"]).code, 0, "free after release");
}));

test("a STALE lock (heartbeat older than ttl) is ignored", () => withDir((dir) => {
  // Hand-write a lock whose heartbeat is well past its ttl.
  const stale = { owner: "ghost", pid: 1, host: "h", acquiredAt: 0, heartbeatAt: 10, ttlSec: 60 };
  writeFileSync(join(dir, "session.lock"), JSON.stringify(stale));
  assert.equal(run(dir, "bob", ["check"]).code, 0, "stale lock does not block — no permanent deadlock");
}));

test("a corrupt lock file is treated as no lock (fail-open, never wedges)", () => withDir((dir) => {
  writeFileSync(join(dir, "session.lock"), "{not json");
  assert.equal(run(dir, "bob", ["check"]).code, 0);
}));

test("pause writes the flag; status reports it; resume clears it", () => withDir((dir) => {
  run(dir, "alice", ["pause"]);
  assert.ok(existsSync(join(dir, "autonomy.paused")), "pause flag written");
  const st = run(dir, "alice", ["status"]);
  assert.match(st.out, /"autonomyPaused":true/);
  run(dir, "alice", ["resume"]);
  assert.ok(!existsSync(join(dir, "autonomy.paused")), "pause flag cleared");
}));

test("heartbeat refreshes only for the owner", () => withDir((dir) => {
  run(dir, "alice", ["acquire", "--ttl", "60"]);
  assert.equal(run(dir, "alice", ["heartbeat"]).code, 0);
  assert.equal(run(dir, "bob", ["heartbeat"]).code, 1, "non-owner cannot heartbeat");
  const lock = JSON.parse(readFileSync(join(dir, "session.lock"), "utf8"));
  assert.equal(lock.owner, "alice");
}));
