// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ @heady/secrets — public API v1.0.0                        ║
// ║  Fail-closed secret loading via secure injection (Secret Manager  ║
// ║  / env), validated against the registry. Never logs values.       ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { SECRETS } from "./registry.mjs";
import { resolveSecrets } from "./core.mjs";
import { providerFor } from "./providers.mjs";

export class SecretsError extends Error {
  constructor(message, result) {
    super(message);
    this.name = "SecretsError";
    this.result = result; // { present, missing, invalid } — never includes values
  }
}

/**
 * Load + validate secrets, fail-closed. Returns a frozen { NAME: value } map.
 * @param {object} [opts]
 * @param {"auto"|"gcp"|"env"} [opts.source]  default "auto" (Secret Manager, env fallback)
 * @param {string} [opts.project]             GCP project (default: gcloud active config)
 * @param {NodeJS.ProcessEnv} [opts.env]
 * @param {string[]} [opts.require]           promote these names to required for this caller
 * @param {string[]} [opts.only]              restrict resolution to these names
 */
export async function loadSecrets({ source = "auto", project, env = process.env, require = [], only } = {}) {
  let registry = SECRETS;
  if (only) registry = registry.filter((s) => only.includes(s.name));
  if (require.length) {
    const req = new Set(require);
    registry = registry.map((s) => (req.has(s.name) ? { ...s, required: true } : s));
  }
  const lookup = providerFor(source, { project, env });
  const result = await resolveSecrets(registry, lookup);
  if (!result.ok) {
    const reasons = [
      ...result.missing.map((n) => `${n}: missing`),
      ...result.invalid.map((i) => `${i.name}: ${i.error}`),
    ];
    throw new SecretsError(`secret resolution failed (fail-closed) — ${reasons.join("; ")}`, {
      present: result.present,
      missing: result.missing,
      invalid: result.invalid,
    });
  }
  return Object.freeze(result.values);
}

export { SECRETS, SECRET_NAMES, specFor, ROTATION_STRATEGIES } from "./registry.mjs";
export { resolveSecrets, validateSecret } from "./core.mjs";
export { envProvider, gcloudProvider, autoProvider, providerFor } from "./providers.mjs";
export { planRotation, partitionPlan } from "./rotation.mjs";
