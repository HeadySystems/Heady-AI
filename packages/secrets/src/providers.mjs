// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Secret Providers v1.0.0                                   ║
// ║  Injectable lookups: env (runtime/dev) + GCP Secret Manager       ║
// ║  (via gcloud, zero SDK deps) + auto (gcp→env fallback).           ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// Production pattern: Cloud Run maps Secret Manager → env via `--set-secrets`, so the runtime path is
// the env provider over an injected secret set. The gcloud provider is for local dev and the rotate
// CLI; it reads `:latest` so a freshly-added version is picked up with no code change.

import { spawnSync } from "node:child_process";

/** Reads from a process-env-shaped object. The runtime path under Cloud Run `--set-secrets`. */
export function envProvider(env = process.env) {
  return async (name) => {
    const v = env[name];
    return v == null || v === "" ? undefined : v;
  };
}

/** Build the optional `--project` argv fragment (omit ⇒ gcloud uses its active config project). */
function projectArgs(project) {
  return project ? ["--project", project] : [];
}

/** Reads `:latest` from GCP Secret Manager via gcloud. Missing/forbidden ⇒ undefined (not throw). */
export function gcloudProvider({ project, env = process.env } = {}) {
  const proj = project ?? env.GCP_PROJECT ?? env.GOOGLE_CLOUD_PROJECT;
  return async (name) => {
    const r = spawnSync(
      "gcloud",
      ["secrets", "versions", "access", "latest", "--secret", name, ...projectArgs(proj), "--quiet"],
      { encoding: "utf8" },
    );
    if (r.error) throw new Error(`gcloud unavailable: ${r.error.message}`);
    if (r.status !== 0) return undefined; // not found / no access → treat as absent (fail-closed upstream)
    return r.stdout.length ? r.stdout : undefined; // exact bytes; stored without trailing newline
  };
}

/** Prefer GCP Secret Manager, fall back to env (local dev convenience). */
export function autoProvider(opts = {}) {
  const gcp = gcloudProvider(opts);
  const fromEnv = envProvider(opts.env);
  return async (name) => {
    try {
      const v = await gcp(name);
      if (v !== undefined) return v;
    } catch {
      // gcloud absent on this host — fall through to env without failing the whole load.
    }
    return fromEnv(name);
  };
}

/** Resolve a named provider. */
export function providerFor(source, opts = {}) {
  if (source === "env") return envProvider(opts.env);
  if (source === "gcp") return gcloudProvider(opts);
  if (source === "auto") return autoProvider(opts);
  throw new Error(`unknown secret source "${source}" (use env | gcp | auto)`);
}
