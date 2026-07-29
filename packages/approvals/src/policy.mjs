// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ OPA Approval Policy Runtime v1.0.0                       ║
// ║  Loads the source-bound WASM policy and fails closed on drift.   ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadPolicy } from "@open-policy-agent/opa-wasm";
import {
  OPA_COMPILER_VERSION,
  OPA_ENTRYPOINT,
  POLICY_VERSION,
} from "./constants.mjs";
import { safeHashEqual, sha256 } from "./canonical.mjs";

const POLICY_SOURCE_URL = new URL("../../../policies/approval.rego", import.meta.url);
const POLICY_WASM_URL = new URL("../policy/approval.wasm", import.meta.url);
const POLICY_MANIFEST_URL = new URL("../policy/manifest.json", import.meta.url);

function assertDecision(value) {
  if (!value || typeof value !== "object" || typeof value.allow !== "boolean") {
    throw new TypeError("OPA approval policy returned an invalid decision");
  }
  if (!Array.isArray(value.missingEvidence) || !Array.isArray(value.reasons)) {
    throw new TypeError("OPA approval policy decision is missing evidence or reasons");
  }
  return value;
}

export async function createPolicyEvaluator({
  sourceUrl = POLICY_SOURCE_URL,
  wasmUrl = POLICY_WASM_URL,
  manifestUrl = POLICY_MANIFEST_URL,
} = {}) {
  const [source, wasm, manifestText] = await Promise.all([
    readFile(sourceUrl, "utf8"),
    readFile(wasmUrl),
    readFile(manifestUrl, "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);
  const sourceSha256 = sha256(source);
  const wasmSha256 = sha256(wasm);

  if (manifest.policyVersion !== POLICY_VERSION) {
    throw new TypeError(`policy manifest version mismatch: ${manifest.policyVersion}`);
  }
  if (manifest.entrypoint !== OPA_ENTRYPOINT) {
    throw new TypeError(`policy manifest entrypoint mismatch: ${manifest.entrypoint}`);
  }
  if (manifest.opaVersion !== OPA_COMPILER_VERSION) {
    throw new TypeError(`policy compiler version mismatch: ${manifest.opaVersion}`);
  }
  if (!safeHashEqual(sourceSha256, manifest.sourceSha256)) {
    throw new TypeError("approval.rego source hash does not match the compiled policy manifest");
  }
  if (!safeHashEqual(wasmSha256, manifest.wasmSha256)) {
    throw new TypeError("approval policy WASM hash does not match the compiled policy manifest");
  }

  const policy = await loadPolicy(wasm);
  return Object.freeze({
    version: manifest.policyVersion,
    sourceSha256,
    wasmSha256,
    opaVersion: manifest.opaVersion,
    sourcePath: fileURLToPath(sourceUrl),
    async evaluate(input) {
      const rows = policy.evaluate(input);
      if (!Array.isArray(rows) || rows.length !== 1 || !("result" in rows[0])) {
        throw new TypeError("OPA approval policy returned no singular decision");
      }
      return assertDecision(rows[0].result);
    },
  });
}
