// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Awareness — Git Introspection v1.0.0                      ║
// ║  Dependency-free, read-only git porcelain over spawnSync. Every   ║
// ║  call is fail-closed: it returns a structured { ok, ... } result  ║
// ║  and NEVER throws on a non-zero git exit. NOTHING here mutates     ║
// ║  history — history rewrites are gated to the squash *proposer*.    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { spawnSync } from "node:child_process";

const NUL = String.fromCharCode(0); // `-z` record terminator
const RS = String.fromCharCode(30); // ASCII record separator (git %x1e) — never in commit text
const US = String.fromCharCode(31); // ASCII unit/field separator (git %x1f)

/**
 * Run a read-only git command. Returns a structured result; never throws on a
 * non-zero exit (fail-closed: callers branch on `.ok`, they never catch).
 * @param {string} repoRoot
 * @param {string[]} args
 * @returns {{ ok: boolean, code: number, stdout: string, stderr: string }}
 */
export function git(repoRoot, args) {
  const r = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error) return { ok: false, code: -1, stdout: "", stderr: r.error.message };
  return {
    ok: r.status === 0,
    code: r.status ?? -1,
    stdout: (r.stdout ?? "").trim(),
    stderr: (r.stderr ?? "").trim(),
  };
}

/** True if `repoRoot` is inside a git work tree. */
export function isGitRepo(repoRoot) {
  return git(repoRoot, ["rev-parse", "--is-inside-work-tree"]).stdout === "true";
}

/** Resolve the absolute git directory (so hook installers don't assume `.git/`). */
export function gitDir(repoRoot) {
  const r = git(repoRoot, ["rev-parse", "--absolute-git-dir"]);
  return r.ok ? r.stdout : null;
}

/** Current HEAD sha (full). Null when unresolved (e.g. an empty repo). */
export function head(repoRoot) {
  const r = git(repoRoot, ["rev-parse", "HEAD"]);
  return r.ok ? r.stdout : null;
}

/** Current branch name, or null in detached-HEAD state. */
export function branch(repoRoot) {
  const r = git(repoRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  return r.ok && r.stdout ? r.stdout : null;
}

/** True when there are staged or unstaged tracked changes in the work tree. */
export function isDirty(repoRoot) {
  const r = git(repoRoot, ["status", "--porcelain", "--untracked-files=no"]);
  return r.ok ? r.stdout.length > 0 : false;
}

/** Repo-relative paths with uncommitted (tracked) modifications. */
export function workingChanges(repoRoot) {
  const r = git(repoRoot, ["status", "--porcelain", "-z", "--untracked-files=no"]);
  if (!r.ok || !r.stdout) return [];
  // `-z` records are NUL-terminated; the XY status prefix is 3 chars wide.
  return r.stdout
    .split(NUL)
    .filter(Boolean)
    .map((rec) => rec.slice(3))
    .filter(Boolean);
}

/**
 * Repo-relative paths that changed between two commit-ish refs (committed diff).
 * A null `fromRef` (first observation / cold start) yields an empty list — there
 * is no prior baseline to diff against, which the caller reports as "cold".
 */
export function changedFiles(repoRoot, fromRef, toRef = "HEAD") {
  if (!fromRef) return [];
  const r = git(repoRoot, ["diff", "--name-only", "-z", `${fromRef}..${toRef}`]);
  if (!r.ok || !r.stdout) return [];
  return r.stdout.split(NUL).filter(Boolean);
}

/** Merge-base of two refs, or null when they share no history. */
export function mergeBase(repoRoot, a, b) {
  const r = git(repoRoot, ["merge-base", a, b]);
  return r.ok ? r.stdout : null;
}

/**
 * Commits in `range` (e.g. "main..HEAD" or a single ref), newest first.
 * Each commit carries its touched repo-relative paths.
 * @returns {Array<{ sha:string, shortSha:string, author:string, dateIso:string,
 *                   subject:string, body:string, files:string[] }>}
 */
export function log(repoRoot, range, limit = 89) {
  // Field-delimited with unambiguous record/field separators (RS/US never appear
  // in commit text), then `--name-only` files per commit.
  const fmt = ["%H", "%h", "%an", "%cI", "%s", "%b"].join("%x1f");
  const args = ["log", `--max-count=${limit}`, `--format=%x1e${fmt}`, "--name-only"];
  if (range) args.push(range);
  const r = git(repoRoot, args);
  if (!r.ok || !r.stdout) return [];
  const commits = [];
  for (const block of r.stdout.split(RS)) {
    const trimmed = block.replace(/^\n+/, "");
    if (!trimmed) continue;
    const nl = trimmed.indexOf("\n");
    const metaLine = nl === -1 ? trimmed : trimmed.slice(0, nl);
    const rest = nl === -1 ? "" : trimmed.slice(nl + 1);
    const [sha, shortSha, author, dateIso, subject, body] = metaLine.split(US);
    if (!sha) continue;
    const files = rest.split("\n").map((l) => l.trim()).filter(Boolean);
    commits.push({
      sha,
      shortSha,
      author,
      dateIso,
      subject: subject ?? "",
      body: (body ?? "").trim(),
      files,
    });
  }
  return commits;
}

/** Count of commits in `range` (cheap; used for squash sizing without a full log). */
export function countCommits(repoRoot, range) {
  const r = git(repoRoot, ["rev-list", "--count", range]);
  return r.ok ? Number(r.stdout) || 0 : 0;
}

/** Best-effort upstream tracking ref of the current branch (e.g. origin/rebuild). */
export function upstream(repoRoot) {
  const r = git(repoRoot, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
  return r.ok && r.stdout ? r.stdout : null;
}
