// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Founder Terminal CLI Tests v1.0.0                      ║
// ║  Deterministic argument and fail-closed entrypoint coverage.    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = resolve(PACKAGE_ROOT, "bin/founder-terminal.mjs");

test("founder terminal exposes one explicit immutable-key invocation", () => {
  const result = spawnSync(process.execPath, [CLI, "--help"], {
    cwd: PACKAGE_ROOT,
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /--key-version projects\/\.\.\.\/cryptoKeyVersions\/N/);
});

test("founder terminal rejects missing key-version and non-interactive execution", () => {
  const missing = spawnSync(process.execPath, [CLI, "--check"], {
    cwd: PACKAGE_ROOT,
    encoding: "utf8",
    env: { ...process.env, HEADY_FOUNDER_KEY_VERSION: "" },
  });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /founder-terminal/);

  const nonInteractive = spawnSync(process.execPath, [
    CLI,
    "--check",
    "--key-version",
    "projects/heady/locations/global/keyRings/approval/cryptoKeys/founder/cryptoKeyVersions/1",
  ], {
    cwd: PACKAGE_ROOT,
    encoding: "utf8",
  });
  assert.equal(nonInteractive.status, 1);
  assert.match(nonInteractive.stderr, /interactive TTY/);
});
