#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ facts.v1 gate — standalone, cache-independent validator    ║
// ║  Loads facts.yaml, validates against the canonical facts.v1 schema ║
// ║  (@heady/contracts), emits structured lines, exits non-zero on any ║
// ║  violation. This is the fail-closed enforcement point (`npm run     ║
// ║  facts:validate`) that does not depend on the turbo test cache.     ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "../src/index.mjs";
import { validateFactsV1, FACTS_V1_VERSION } from "@heady/contracts";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const FACTS_PATH = join(REPO_ROOT, "facts.yaml");

// Structured pino-shaped line to stdout — the banned unstructured console sink
// is forbidden by AGENTS.md #2.
const emit = (level, msg, fields = {}) =>
  process.stdout.write(`${JSON.stringify({ t: "facts-gate", schema: FACTS_V1_VERSION, level, msg, ...fields })}\n`);

function main() {
  if (!existsSync(FACTS_PATH)) {
    emit("error", "facts.yaml not found", { path: FACTS_PATH });
    return 1;
  }

  let facts;
  try {
    facts = parseYaml(readFileSync(FACTS_PATH, "utf8"));
  } catch (err) {
    emit("error", "facts.yaml failed to parse", { error: err.message });
    return 1;
  }

  const { ok, errors } = validateFactsV1(facts);
  if (!ok) {
    for (const violation of errors) emit("error", violation);
    emit("error", `facts.yaml FAILED ${FACTS_V1_VERSION}`, { violations: errors.length });
    return 1;
  }

  emit("info", `facts.yaml conforms to ${FACTS_V1_VERSION}`, { rules: "all-passed" });
  return 0;
}

process.exit(main());
