// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Genesis Review Digest v1.0.0                           ║
// ║  Canonical source-scope hash for external executor review.     ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { canonicalize, sha256 } from "@heady/approvals";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SCOPE_PATH = "apps/approval-api/genesis-review-scope.json";
const ScopeSchema = z.object({
  headyBrand: z.literal("HEADY™ Genesis Review Scope v1.0.0 — © 2026 HeadySystems Inc."),
  schema: z.literal("heady.approval.genesis.review-scope.v1"),
  files: z.array(z.string().min(1)).min(1),
}).strict();

export function buildGenesisReviewDigest({
  repositoryRoot = REPOSITORY_ROOT,
  readFile = readFileSync,
} = {}) {
  const scope = ScopeSchema.parse(JSON.parse(readFile(
    join(repositoryRoot, SCOPE_PATH),
    "utf8",
  )));
  if (
    !scope.files.includes(SCOPE_PATH)
    || new Set(scope.files).size !== scope.files.length
    || canonicalize([...scope.files].sort()) !== canonicalize(scope.files)
  ) {
    throw new TypeError("genesis review scope must be unique, sorted, and self-inclusive");
  }
  const files = scope.files.map((path) => ({
    path,
    sha256: sha256(readFile(join(repositoryRoot, path))),
  }));
  const record = {
    schema: "heady.approval.genesis.review-bundle.v1",
    files,
  };
  return Object.freeze({
    record,
    canonicalRecord: canonicalize(record),
    bundleSha256: sha256(record),
  });
}
