// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval Canonicalization v1.0.0                         ║
// ║  Deterministic JSON, SHA-256 binding, and detached verification. ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

import {
  createHash,
  createPublicKey,
  timingSafeEqual,
  verify as verifySignature,
} from "node:crypto";

function encode(value, path) {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`canonical value at ${path} must be finite`);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry, index) => encode(entry, `${path}[${index}]`)).join(",")}]`;
  }
  if (typeof value === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      throw new TypeError(`canonical value at ${path} must be a plain object`);
    }
    const entries = Object.keys(value).sort().map((key) => {
      const entry = value[key];
      if (entry === undefined) throw new TypeError(`canonical value at ${path}.${key} is undefined`);
      return `${JSON.stringify(key)}:${encode(entry, `${path}.${key}`)}`;
    });
    return `{${entries.join(",")}}`;
  }
  throw new TypeError(`unsupported canonical value at ${path}: ${typeof value}`);
}

export function canonicalize(value) {
  return encode(value, "$");
}

export function sha256(value) {
  const input = typeof value === "string" || Buffer.isBuffer(value)
    ? value
    : canonicalize(value);
  return createHash("sha256").update(input).digest("hex");
}

export function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

export function base64UrlDecode(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new TypeError("value must be unpadded base64url");
  }
  return Buffer.from(value, "base64url");
}

export function safeHashEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function assertHash(expected, actual, label) {
  if (!safeHashEqual(expected, actual)) {
    throw new TypeError(`${label} hash mismatch`);
  }
  return true;
}

export function publicJwkFingerprint(publicJwk) {
  if (
    !publicJwk
    || publicJwk.kty !== "OKP"
    || publicJwk.crv !== "Ed25519"
    || typeof publicJwk.x !== "string"
    || !/^[A-Za-z0-9_-]+$/.test(publicJwk.x)
    || Object.hasOwn(publicJwk, "d")
  ) {
    throw new TypeError("public JWK must be an Ed25519 OKP key");
  }
  const key = createPublicKey({ key: publicJwk, format: "jwk" });
  if (key.asymmetricKeyType !== "ed25519") {
    throw new TypeError("public JWK must be an Ed25519 OKP key");
  }
  const normalized = key.export({ format: "jwk" });
  return sha256({ crv: normalized.crv, kty: normalized.kty, x: normalized.x });
}

export function verifyEd25519({ publicJwk, payload, signature }) {
  try {
    const key = createPublicKey({ key: publicJwk, format: "jwk" });
    const bytes = typeof payload === "string" || Buffer.isBuffer(payload)
      ? Buffer.from(payload)
      : Buffer.from(canonicalize(payload));
    return verifySignature(null, bytes, key, base64UrlDecode(signature));
  } catch {
    return false;
  }
}
