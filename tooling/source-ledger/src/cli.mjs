#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Source Ledger CLI v1.0.0                               ║
// ║  Plan-first Neon SSOT reconciliation and guarded source commit. ║
// ║  Made with ❤️ by HeadySystems Inc.                              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createDbPort } from "@heady/db/port";
import { loadSecrets } from "@heady/secrets";
import { commitSourceRevision, readSourceRevision, reconcileSnapshot } from "@heady/source-ledger";
import { materializeRevision } from "./materialize.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const emit = (level, msg, fields = {}) => process.stdout.write(`${JSON.stringify({ t: "source-ledger", level, msg, ...fields })}\n`);

function argument(name, fallback = null) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function git(args) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args[0]} failed`);
  return result.stdout.trim();
}

function scanWorktree() {
  const listed = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: ROOT,
    encoding: "buffer",
  });
  if (listed.status !== 0) throw new Error(listed.stderr.toString("utf8").trim() || "git file scan failed");
  return listed.stdout.toString("utf8").split("\0").filter(Boolean).map((path) => {
    const absolute = join(ROOT, path);
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) {
      return { path, content: Buffer.from(readlinkSync(absolute), "utf8"), fileMode: 40960 };
    }
    if (!stat.isFile()) return null;
    return { path, content: readFileSync(absolute), fileMode: stat.mode & 0o111 ? 33261 : 33188 };
  }).filter(Boolean);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const repositorySlug = argument("repository", "headysystems/heady-ai");
  const refName = argument("ref", "refs/heads/main");
  const message = argument("message");
  const actorId = argument("actor");
  const materializeTarget = argument("materialize");
  const requestedRevision = argument("revision");
  if (apply && (!message || !actorId)) throw new Error("--apply requires --message and --actor");

  const { DATABASE_URL } = await loadSecrets({ require: ["DATABASE_URL"] });
  const port = createDbPort({ connectionString: DATABASE_URL });
  await port.connect();
  try {
    const ref = await port.query(
      `SELECT r.repository_id, n.revision_id, n.version
         FROM heady_source.repository r
         LEFT JOIN heady_source.named_ref n
           ON n.repository_id = r.repository_id AND n.ref_name = $2
        WHERE r.slug = $1`,
      [repositorySlug, refName],
    );
    const current = ref.rows[0] ?? null;
    if (materializeTarget) {
      const revisionId = requestedRevision ?? current?.revision_id;
      if (!revisionId) throw new Error("--materialize requires --revision when the ref has no current revision");
      const projection = materializeRevision(await readSourceRevision(port, revisionId), {
        target: materializeTarget,
        protectedRoot: ROOT,
      });
      emit("info", "source revision materialized", { revisionId, ...projection });
      return;
    }
    const entries = current?.revision_id
      ? await port.query(
        `SELECT path, content_sha256, file_mode FROM heady_source.revision_entry
          WHERE revision_id = $1 ORDER BY path`,
        [current.revision_id],
      )
      : { rows: [] };
    const files = scanWorktree();
    const plan = reconcileSnapshot(
      entries.rows.map((entry) => ({
        path: entry.path,
        contentSha256: entry.content_sha256,
        fileMode: Number(entry.file_mode),
      })),
      files,
    );
    emit("info", "reconciliation planned", {
      mode: apply ? "apply" : "plan",
      repository: repositorySlug,
      ref: refName,
      authorityRevision: current?.revision_id ?? null,
      authorityVersion: Number(current?.version ?? 0),
      worktreeFiles: files.length,
      merkleRoot: plan.merkleRoot,
      changes: { added: plan.added.length, changed: plan.changed.length, removed: plan.removed.length },
    });
    if (!apply) {
      emit("info", "nothing written; pass --apply with actor and message after review");
      return;
    }
    const committed = await commitSourceRevision(port, {
      repositorySlug,
      refName,
      expectedRefVersion: Number(current?.version ?? 0),
      parentRevisionIds: current?.revision_id ? [current.revision_id] : [],
      files,
      message,
      actor: { type: "human", id: actorId },
      gitProvenance: { head: git(["rev-parse", "HEAD"]), branch: git(["branch", "--show-current"]) },
      evidence: { merkleRoot: plan.merkleRoot, scanner: "git-ls-files" },
    });
    emit("info", "canonical source revision committed", {
      revisionId: committed.revisionId,
      refVersion: committed.refVersion,
      merkleRoot: committed.merkleRoot,
      fileCount: committed.fileCount,
    });
  } finally {
    await port.end();
  }
}

main().catch((error) => {
  emit("error", "source ledger halted", { error: String(error?.message ?? error) });
  process.exitCode = 1;
});
