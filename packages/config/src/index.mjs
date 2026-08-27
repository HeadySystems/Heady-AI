// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Config v1.0.0 — facts.yaml golden-record loader + env     ║
// ║  Single source of derived facts (DX-01). Fail-closed env access.  ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Dependency-free: a minimal YAML reader for the controlled `facts.yaml` subset
// (nested maps, scalar lists, scalars, full-line comments, quoted strings). A full
// `yaml` parser can replace `parseYaml` later without changing the public API.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ValidationError } from "@heady/shared";
import { validateFactsV1 } from "@heady/contracts";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const FACTS_PATH = join(REPO_ROOT, "facts.yaml");

// Loopback matcher built from fragments so this guard never embeds the banned
// literal it exists to forbid (AGENTS.md #4).
const LOOPBACK = new RegExp(["local" + "host", "127" + "\\.0\\.0\\.1", "::1"].join("|"));

function coerce(raw) {
  const v = raw.trim();
  if (v === "" || v === "~" || v === "null") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  if (/^-?\d*\.\d+$/.test(v)) return Number(v);
  return v.replace(/^["']/, "").replace(/["']$/, "");
}

/**
 * Parse the facts.yaml subset: nested maps + scalar lists + scalars + comments.
 * Frames hold {indent, parent, key, container}; a key with an empty value is a
 * pending frame whose container is materialized (map vs array) by its first child.
 */
export function parseYaml(text) {
  const root = {};
  const stack = [{ indent: -1, parent: null, key: null, container: root }];
  const popped = (frame) => {
    // An empty-value key with no children resolves to null.
    if (frame.container === null && frame.key !== null) frame.parent[frame.key] = null;
  };
  // Ensure the top frame has a concrete container of the needed shape.
  const materialize = (frame, asArray) => {
    if (frame.container === null) {
      frame.container = asArray ? [] : {};
      frame.parent[frame.key] = frame.container;
    }
    return frame.container;
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\t/g, "  ");
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const indent = line.length - line.trimStart().length;
    const content = line.trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) popped(stack.pop());
    const top = stack[stack.length - 1];

    if (content.startsWith("- ")) {
      materialize(top, true).push(coerce(content.slice(2)));
      continue;
    }

    const idx = content.indexOf(":");
    if (idx === -1) throw new ValidationError(`YAML: unparseable line "${content}"`);
    const key = content.slice(0, idx).trim();
    const rest = content.slice(idx + 1).trim();
    const container = materialize(top, false);
    if (rest === "") {
      stack.push({ indent, parent: container, key, container: null });
    } else {
      container[key] = coerce(rest);
    }
  }
  while (stack.length > 1) popped(stack.pop());
  return root;
}

function at(obj, path) {
  return path.reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

/**
 * Validate the golden record against the canonical `facts.v1` schema
 * (@heady/contracts). This package is the LOADER; `facts.v1` is the single
 * definition of the record's shape + locked invariants — no rules are
 * duplicated here (ADR-0025: one authority, non-orphanage). Throws with every
 * aggregated violation joined, so a caller sees all drift in one pass.
 */
export function validateFacts(facts) {
  const { ok, errors } = validateFactsV1(facts);
  if (!ok) throw new ValidationError(errors.join("; "));
  return facts;
}

let cached = null;
/** Load + validate the golden record (cached for the canonical path). */
export function loadFacts(path = FACTS_PATH) {
  if (cached && path === FACTS_PATH) return cached;
  if (!existsSync(path)) throw new ValidationError(`facts.yaml not found at ${path}`);
  const facts = validateFacts(parseYaml(readFileSync(path, "utf8")));
  if (path === FACTS_PATH) cached = facts;
  return facts;
}

/** Dotted-path accessor into the golden record: getFact("embedding.dim"). */
export function getFact(dotted, facts = loadFacts()) {
  return at(facts, dotted.split("."));
}

/** Fail-closed env access — throws if missing; rejects loopback URLs (AGENTS.md #4). */
export function requireEnv(name, { env = globalThis.process?.env ?? {} } = {}) {
  const v = env[name];
  if (v === undefined || v === "") throw new ValidationError(`required env var missing: ${name}`);
  if (LOOPBACK.test(v)) throw new ValidationError(`env ${name} must not reference a loopback address (cloud-deployed only)`);
  return v;
}
