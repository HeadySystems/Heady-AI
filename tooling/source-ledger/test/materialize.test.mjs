// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Source Materializer Tests v1.0.0                       ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

import { mkdtempSync, readFileSync, readlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { materializeRevision } from "../src/materialize.mjs";

test("materializes exact bytes and symlinks into a clean projection", () => {
  const base = mkdtempSync(join(tmpdir(), "heady-source-ledger-"));
  const target = join(base, "projection");
  const result = materializeRevision([
    { path: "src/value.bin", content: Buffer.from([0, 1, 255]), fileMode: 33188 },
    { path: "value-link", content: Buffer.from("src/value.bin"), fileMode: 40960 },
  ], { target, protectedRoot: "/workspace/repository" });
  assert.equal(result.fileCount, 2);
  assert.deepEqual(readFileSync(join(target, "src/value.bin")), Buffer.from([0, 1, 255]));
  assert.equal(readlinkSync(join(target, "value-link")), "src/value.bin");
});

test("refuses materialization over a non-empty target", () => {
  const base = mkdtempSync(join(tmpdir(), "heady-source-ledger-"));
  writeFileSync(join(base, "existing"), "preserve");
  assert.throws(
    () => materializeRevision([{ path: "x", content: Buffer.from("x"), fileMode: 33188 }], {
      target: base,
      protectedRoot: "/workspace/repository",
    }),
    /absent or an empty directory/,
  );
});
