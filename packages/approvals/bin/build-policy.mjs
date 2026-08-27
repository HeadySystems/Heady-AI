// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval Policy Builder v1.0.0                           ║
// ║  Reproducibly compiles Rego to WASM and records source binding.  ║
// ║  Made with ❤️ by HeadySystems Inc.                               ║
// ╚══════════════════════════════════════════════════════════════════╝

import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "../src/canonical.mjs";
import {
  OPA_COMPILER_VERSION,
  OPA_ENTRYPOINT,
  POLICY_VERSION,
} from "../src/constants.mjs";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY_ROOT = resolve(PACKAGE_ROOT, "../..");
const SOURCE_PATH = join(REPOSITORY_ROOT, "policies", "approval.rego");
const OUTPUT_DIRECTORY = join(PACKAGE_ROOT, "policy");
const OUTPUT_PATH = join(OUTPUT_DIRECTORY, "approval.wasm");
const MANIFEST_PATH = join(OUTPUT_DIRECTORY, "manifest.json");
const OPA_BINARY = process.env.OPA_BIN ?? "opa";

function runOpa(arguments_, options) {
  try {
    return execFileSync(OPA_BINARY, arguments_, options);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new TypeError(
        `OPA ${OPA_COMPILER_VERSION} is required; set OPA_BIN to its absolute binary path`,
        { cause: error },
      );
    }
    throw error;
  }
}

const opaVersionOutput = runOpa(["version"], { encoding: "utf8" });
const opaVersion = opaVersionOutput.match(/^Version:\s*(.+)$/m)?.[1]?.trim();
if (opaVersion !== OPA_COMPILER_VERSION) {
  throw new TypeError(
    `OPA compiler version mismatch: expected ${OPA_COMPILER_VERSION}, received ${opaVersion ?? "unknown"}`,
  );
}

runOpa(["check", "--strict", SOURCE_PATH], { stdio: "inherit" });

const temporaryDirectory = mkdtempSync(join(tmpdir(), "heady-approval-policy-"));
try {
  const bundlePath = join(temporaryDirectory, "bundle.tar.gz");
  const extractDirectory = join(temporaryDirectory, "bundle");

  mkdirSync(extractDirectory, { recursive: true });
  runOpa([
    "build",
    "--target",
    "wasm",
    "--entrypoint",
    OPA_ENTRYPOINT,
    "--output",
    bundlePath,
    SOURCE_PATH,
  ], { stdio: "inherit" });
  execFileSync("tar", ["-xzf", bundlePath, "-C", extractDirectory], { stdio: "inherit" });

  const wasm = readFileSync(join(extractDirectory, "policy.wasm"));
  const source = readFileSync(SOURCE_PATH);

  mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  writeFileSync(OUTPUT_PATH, wasm);
  writeFileSync(MANIFEST_PATH, `${JSON.stringify({
    policyVersion: POLICY_VERSION,
    entrypoint: OPA_ENTRYPOINT,
    opaVersion,
    sourceSha256: sha256(source),
    wasmSha256: sha256(wasm),
  }, null, 2)}\n`);
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
