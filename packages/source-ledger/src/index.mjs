// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Source Ledger v1.0.0                                   ║
// ║  Neon universal SSOT commit and reconciliation primitives.      ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

import { createHash, randomUUID } from "node:crypto";

const PATH_PATTERN = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[^\u0000-\u001f]+$/;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sourceMerkleRoot(files) {
  if (files.length === 0) return sha256(Buffer.alloc(0));
  let level = files.map(({ path, contentSha256, fileMode }) => (
    sha256(Buffer.from(`${path}\0${contentSha256}\0${fileMode}`, "utf8"))
  ));
  while (level.length > 1) {
    const next = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      const right = level[index + 1] ?? left;
      next.push(sha256(Buffer.from(left + right, "hex")));
    }
    level = next;
  }
  return level[0];
}

export function buildSourceSnapshot(files) {
  const normalized = files.map((file) => {
    const path = String(file.path ?? file.rel ?? "");
    if (!PATH_PATTERN.test(path)) throw new TypeError(`invalid source path: ${path}`);
    const content = Buffer.isBuffer(file.content) ? file.content : Buffer.from(String(file.content), "utf8");
    return {
      path,
      content,
      contentSha256: sha256(content),
      mediaType: file.mediaType ?? "text/plain; charset=utf-8",
      fileMode: file.fileMode ?? 33188,
    };
  }).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  if (new Set(normalized.map(({ path }) => path)).size !== normalized.length) {
    throw new TypeError("source snapshot contains duplicate paths");
  }
  return { files: normalized, merkleRoot: sourceMerkleRoot(normalized), fileCount: normalized.length };
}

export function reconcileSnapshot(authorityEntries, worktreeFiles) {
  const authority = new Map(authorityEntries.map((entry) => [entry.path, {
    contentSha256: entry.contentSha256,
    fileMode: Number(entry.fileMode ?? 33188),
  }]));
  const worktree = buildSourceSnapshot(worktreeFiles);
  const current = new Map(worktree.files.map((entry) => [entry.path, {
    contentSha256: entry.contentSha256,
    fileMode: Number(entry.fileMode),
  }]));
  const matches = (path, value) => {
    const authoritative = authority.get(path);
    return authoritative?.contentSha256 === value.contentSha256 && authoritative.fileMode === value.fileMode;
  };
  return {
    merkleRoot: worktree.merkleRoot,
    added: [...current.keys()].filter((path) => !authority.has(path)),
    changed: [...current].filter(([path, value]) => authority.has(path) && !matches(path, value)).map(([path]) => path),
    removed: [...authority.keys()].filter((path) => !current.has(path)),
    unchanged: [...current].filter(([path, value]) => matches(path, value)).map(([path]) => path),
  };
}

export async function commitSourceRevision(port, {
  repositorySlug,
  displayName = repositorySlug,
  refName = "refs/heads/main",
  expectedRefVersion,
  files,
  message,
  actor,
  parentRevisionIds = [],
  gitProvenance = {},
  evidence = {},
  revisionId = randomUUID(),
} = {}) {
  if (!repositorySlug || !message || !actor || !Number.isInteger(expectedRefVersion) || expectedRefVersion < 0) {
    throw new TypeError("repositorySlug, message, actor, and non-negative expectedRefVersion are required");
  }
  const snapshot = buildSourceSnapshot(files);
  return port.tx(async (tx) => {
    const repository = await tx.query(
      `WITH inserted AS (
         INSERT INTO heady_source.repository(slug, display_name) VALUES ($1, $2)
         ON CONFLICT (slug) DO NOTHING RETURNING repository_id
       )
       SELECT repository_id FROM inserted
       UNION ALL
       SELECT repository_id FROM heady_source.repository WHERE slug = $1
       LIMIT 1`,
      [repositorySlug, displayName],
    );
    const repositoryId = repository.rows[0].repository_id;
    for (const file of snapshot.files) {
      await tx.query(
        `INSERT INTO heady_source.blob(content_sha256, content, media_type)
         VALUES ($1, $2, $3) ON CONFLICT (content_sha256) DO NOTHING`,
        [file.contentSha256, file.content, file.mediaType],
      );
    }
    await tx.query(
      `INSERT INTO heady_source.revision
         (revision_id, repository_id, merkle_root, message, actor, git_provenance)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [revisionId, repositoryId, snapshot.merkleRoot, message, actor, gitProvenance],
    );
    for (const [parentOrder, parentRevisionId] of parentRevisionIds.entries()) {
      await tx.query(
        `INSERT INTO heady_source.revision_parent
           (repository_id, revision_id, parent_revision_id, parent_order)
         VALUES ($1, $2, $3, $4)`,
        [repositoryId, revisionId, parentRevisionId, parentOrder],
      );
    }
    for (const file of snapshot.files) {
      await tx.query(
        `INSERT INTO heady_source.revision_entry(revision_id, path, content_sha256, file_mode)
         VALUES ($1, $2, $3, $4)`,
        [revisionId, file.path, file.contentSha256, file.fileMode],
      );
    }
    const advanced = await tx.query(
      "SELECT heady_source.advance_ref($1, $2, $3, $4, $5, $6) AS version",
      [repositoryId, refName, expectedRefVersion, revisionId, actor, evidence],
    );
    return { repositoryId, revisionId, refName, refVersion: Number(advanced.rows[0].version), ...snapshot };
  });
}

export async function readSourceRevision(port, revisionId) {
  const result = await port.query(
    `SELECT e.path, e.content_sha256, e.file_mode, b.media_type, b.content
       FROM heady_source.revision_entry e
       JOIN heady_source.blob b USING (content_sha256)
      WHERE e.revision_id = $1 ORDER BY e.path ASC`,
    [revisionId],
  );
  return result.rows.map((row) => {
    const content = Buffer.from(row.content);
    if (sha256(content) !== row.content_sha256) throw new Error(`source blob checksum mismatch: ${row.path}`);
    return { path: row.path, content, contentSha256: row.content_sha256, fileMode: row.file_mode, mediaType: row.media_type };
  });
}
