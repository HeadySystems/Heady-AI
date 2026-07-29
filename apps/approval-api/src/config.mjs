// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval API Configuration v1.0.0                       ║
// ║  Strict non-secret Cloud Run and identity configuration.        ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

import { z } from "zod";

const KMS_KEY_VERSION_RE = /^projects\/[^/]+\/locations\/[^/]+\/keyRings\/[^/]+\/cryptoKeys\/[^/]+\/cryptoKeyVersions\/[1-9]\d*$/;

const EnvironmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(8_080),
  FIREBASE_PROJECT_ID: z.string().min(1),
  APPROVAL_SERVICE_AUDIENCE: z.string().min(1),
  APPROVAL_KMS_KEY_VERSION: z.string().regex(KMS_KEY_VERSION_RE),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
}).passthrough();

export function loadConfig(environment = process.env) {
  return Object.freeze(EnvironmentSchema.parse(environment));
}
