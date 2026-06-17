// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Locked Embedder Resolver v1.0.0                           ║
// ║  Resolves the ADR-0015 embedder from env (Workers AI or HF), or   ║
// ║  null when no binding exists.                                      ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// The lock (ADR-0015) pins the MODEL IDENTITY — bge-small-en-v1.5, 384-dim, mean — not the serving
// platform. The canonical serving is Cloudflare Workers AI (`@cf/baai/bge-small-en-v1.5`); the open
// weights `BAAI/bge-small-en-v1.5` on Hugging Face are the same model and produce lock-equivalent
// 384-dim vectors. Cloudflare is preferred when both are configured. All credentials come from the
// environment (GCP Secret Manager / .env with [SECRET] markers) — never hardcoded. When NO binding
// is present this returns null and the workflow emits the job outbox WITHOUT fabricating vectors.
// Every response is dimension-checked and fails closed (ADR-0015).

import { LOCKED_MODEL, assertModelLock } from "../../../packages/embedding/src/core.mjs";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";
const HF_INFERENCE_BASE = "https://api-inference.huggingface.co/models";
// The HF open-weights mirror of the locked model (same weights as the @cf/ id).
const HF_MODEL_ID = "BAAI/bge-small-en-v1.5";

/** Validate a batch of vectors against the dimension lock; fail closed on mismatch. */
function assertVectors(data, expectedLen) {
  if (!Array.isArray(data) || data.length !== expectedLen) {
    throw new Error(`embedder: expected ${expectedLen} vector(s), got ${Array.isArray(data) ? data.length : typeof data}`);
  }
  for (const v of data) {
    if (!Array.isArray(v) || v.length !== LOCKED_MODEL.dim) {
      throw new Error(`embedder returned dim=${v?.length}, expected ${LOCKED_MODEL.dim} (ADR-0015 fail-closed)`);
    }
  }
  return data;
}

/** Cloudflare Workers AI — the canonical locked serving path.
 *  Two credential shapes are supported: a scoped API token (preferred, least-privilege →
 *  `Authorization: Bearer`) or a legacy account-wide Global API Key (requires the account email →
 *  `X-Auth-Email` + `X-Auth-Key`). The shape is inferred from whether `email` is present. */
function cloudflareEmbedder(accountId, token, email) {
  const endpoint = `${CF_API_BASE}/accounts/${accountId}/ai/run/${LOCKED_MODEL.id}`;
  const authHeaders = email
    ? { "X-Auth-Email": email, "X-Auth-Key": token }
    : { Authorization: `Bearer ${token}` };
  return {
    model: LOCKED_MODEL,
    serving: email ? "workers-ai:global-key" : "workers-ai",
    async embed(texts) {
      if (texts.length === 0) return [];
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ text: texts }),
      });
      if (!res.ok) {
        throw new Error(`Workers AI embed failed: HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 300)}`);
      }
      const json = await res.json();
      return assertVectors(json?.result?.data ?? json?.data, texts.length);
    },
  };
}

/** Hugging Face Inference — same weights as the lock, lock-equivalent 384-dim vectors. */
function huggingFaceEmbedder(token) {
  const endpoint = `${HF_INFERENCE_BASE}/${HF_MODEL_ID}`;
  return {
    model: LOCKED_MODEL,
    serving: "huggingface",
    async embed(texts) {
      if (texts.length === 0) return [];
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: texts, options: { wait_for_model: true } }),
      });
      if (!res.ok) {
        throw new Error(`HF embed failed: HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 300)}`);
      }
      return assertVectors(await res.json(), texts.length);
    },
  };
}

/** True when the environment carries a usable HF inference token. */
export function hfTokenPresent(env = process.env) {
  return Boolean(env.HF_TOKEN || env.HUGGINGFACE_TOKEN || env.HUGGINGFACEHUB_API_TOKEN);
}

/**
 * Resolve the embedder. Cloudflare Workers AI (the locked serving path) is selected automatically.
 * Hugging Face is a NON-locked serving path that transmits corpus content — including patent-locked
 * IP — to a third-party inference API, so it requires EXPLICIT opt-in (`opts.allowHf` or
 * `HEADY_ALLOW_HF_EMBED=1`). Default is fail-safe: no opt-in ⇒ HF is never used, even if a token
 * exists, so an unattended run cannot leak IP to an unsanctioned provider.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{allowHf?:boolean}} [opts]
 * @returns {{model:typeof LOCKED_MODEL, serving:string, embed:(texts:string[])=>Promise<number[][]>}|null}
 */
export function resolveEmbedder(env = process.env, opts = {}) {
  assertModelLock(); // the lock holds regardless of which serving path is chosen

  const cfAccount = env.CLOUDFLARE_ACCOUNT_ID;
  const cfToken = env.CLOUDFLARE_API_TOKEN || env.CLOUDFLARE_WORKERS_AI_TOKEN || env.CF_API_TOKEN;
  // A Global API Key needs the account email (X-Auth-*); a scoped token does not (Bearer).
  const cfEmail = env.CLOUDFLARE_EMAIL || env.CLOUDFLARE_API_EMAIL || env.CF_API_EMAIL;
  if (cfAccount && cfToken) return cloudflareEmbedder(cfAccount, cfToken, cfEmail);

  const allowHf = opts.allowHf === true || env.HEADY_ALLOW_HF_EMBED === "1";
  const hfToken = env.HF_TOKEN || env.HUGGINGFACE_TOKEN || env.HUGGINGFACEHUB_API_TOKEN;
  if (allowHf && hfToken) return huggingFaceEmbedder(hfToken);

  return null;
}
