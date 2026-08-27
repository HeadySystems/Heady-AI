// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ heady-manager — Workers-AI query embedder (origin/REST)    ║
// ║  The Cloud Run origin has no Workers-AI *binding* (that lives at    ║
// ║  the edge), so the origin embeds search queries over the Cloudflare ║
// ║  REST API against the LOCKED model (bge-small-en-v1.5, dim 384).    ║
// ║  Fail-closed on a wrong dimension (never corrupt a cosine ranking); ║
// ║  φ-backoff on transient 429/5xx/network; structured logs only.      ║
// ║  Absent creds ⇒ the composition root passes null ⇒ keyword-only.    ║
// ║  Made with ❤️ by HeadySystems Inc.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { LOCKED_MODEL, assertModelLock } from "@heady/embedding/core";
import { withRetry } from "@heady/resilience";
import { fib } from "@heady/phi-math";

const CF_API = "https://api.cloudflare.com/client/v4";

/**
 * Build a query embedder: text → 384-d vector via Workers-AI REST.
 * @param {object} opts
 * @param {string} opts.accountId    Cloudflare account id (CLOUDFLARE_ACCOUNT_ID)
 * @param {string} opts.apiToken     scoped Workers-AI token (Bearer) or legacy Global API Key
 * @param {string|null} [opts.email] set ONLY for a legacy Global API Key (X-Auth-Email/Key auth)
 * @param {object} [opts.model]      model lock (default LOCKED_MODEL — asserted)
 * @param {typeof fetch} [opts.fetchImpl]  injectable for tests
 * @param {number} [opts.retries]    transient-failure retries (φ-backoff)
 * @returns {(text:string)=>Promise<number[]>}
 */
export function createWorkersAiQueryEmbedder({ accountId, apiToken, email = null, model = LOCKED_MODEL, fetchImpl = fetch, retries = fib(4), log } = {}) {
  if (typeof accountId !== "string" || accountId.length < 8) throw new TypeError("accountId required");
  if (typeof apiToken !== "string" || apiToken.length < 20) throw new TypeError("apiToken required");
  assertModelLock(model);

  const url = `${CF_API}/accounts/${accountId}/ai/run/${model.id}`;
  // Scoped token → Bearer (preferred). Legacy Global API Key → X-Auth-Email + X-Auth-Key.
  const authHeaders = email
    ? { "X-Auth-Email": email, "X-Auth-Key": apiToken }
    : { Authorization: `Bearer ${apiToken}` };

  const retryable = (err) => err?.transient === true;

  return async function embedQuery(text) {
    if (typeof text !== "string" || text.trim() === "") throw new TypeError("query text required");

    const vector = await withRetry(
      async () => {
        let res;
        try {
          res = await fetchImpl(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({ text: [text] }),
          });
        } catch (netErr) {
          const e = new Error(`workers-ai network error: ${netErr?.message ?? netErr}`);
          e.transient = true;
          throw e;
        }
        if (!res.ok) {
          const e = new Error(`workers-ai ${res.status}`);
          e.transient = res.status === 429 || res.status >= 500;
          throw e;
        }
        const body = await res.json();
        const vec = body?.result?.data?.[0];
        if (!Array.isArray(vec) || vec.length !== model.dim) {
          // Fail closed: a wrong-dimension vector would silently corrupt the pgvector cosine ranking.
          throw new Error(`workers-ai returned dim=${Array.isArray(vec) ? vec.length : "none"}, expected ${model.dim} (fail-closed)`);
        }
        return vec;
      },
      {
        // withRetry sleeps phiBackoffMs(attempt) between tries — φ-backoff, inherited.
        retries,
        retryable,
        onRetry: (attempt, delay, err) => log?.warn?.({ attempt, delayMs: delay, err: String(err?.message ?? err) }, "heady990 embed: transient failure — φ-backoff retry"),
      },
    );
    return vector;
  };
}
