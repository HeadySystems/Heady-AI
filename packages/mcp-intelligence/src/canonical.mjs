// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ MCP Canonical Data v1.0.0                                ║
// ║  Stable hashing and recursive secret-safe result projection.     ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { createHash } from "node:crypto";
import { redactSecrets } from "@heady/security-mesh";

const SENSITIVE_KEY = /(?:authorization|cookie|credential|password|passphrase|private.?key|secret|token|api.?key)/i;

export function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const entries = Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`).join(",")}}`;
}

export function sha256(value) {
  const text = typeof value === "string" ? value : canonicalize(value);
  return createHash("sha256").update(text).digest("hex");
}

export function redact(value, seen = new WeakSet()) {
  if (typeof value === "string") return redactSecrets(value);
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redact(item, seen));

  const out = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : redact(item, seen);
  }
  return out;
}
