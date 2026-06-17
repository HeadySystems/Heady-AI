// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Edge Gatekeeper — Cloudflare Worker ingress               ║
// ║  Ed25519-authed ingest → Workers AI embed → Vectorize upsert.     ║
// ║  Structured JSON logs → Logpush (the Workers logging transport).  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { z } from "zod";

export interface Env {
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  CONFIG_KV: KVNamespace;
  HYPERDRIVE: Hyperdrive;
  SIGNAL_QUEUE: Queue;
  WEBHOOK_ED25519_PUBLIC_KEY: string;
  CLOUD_RUN_ORIGIN: string;
  MAX_SIGNATURE_AGE_SECONDS: string;
}

const IngestSchema = z.object({
  tenantId: z.string().min(1).max(128),
  documentId: z.string().min(1).max(256),
  text: z.string().min(1).max(8192),
  audioObjectKey: z.string().min(1).max(512).optional(),
});

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function verifyEd25519(
  env: Env,
  timestamp: string,
  rawBody: string,
  signatureB64: string,
): Promise<boolean> {
  const skew = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(skew) || skew > Number(env.MAX_SIGNATURE_AGE_SECONDS)) {
    return false;
  }
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "raw",
      b64ToBytes(env.WEBHOOK_ED25519_PUBLIC_KEY),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
  } catch {
    return false;
  }
  const data = new TextEncoder().encode(`${timestamp}.${rawBody}`);
  let sig: Uint8Array;
  try {
    sig = b64ToBytes(signatureB64);
  } catch {
    return false;
  }
  return crypto.subtle.verify({ name: "Ed25519" }, key, sig, data);
}

const app = new Hono<{ Bindings: Env }>();

app.use("*", secureHeaders());
app.use(
  "/v1/*",
  cors({
    origin: ["https://headyme.com", "https://headyai.com"],
    allowMethods: ["POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "X-Heady-Timestamp", "X-Heady-Signature"],
    maxAge: 600,
  }),
);

app.post("/v1/ingest", async (c) => {
  const env = c.env;
  const reqId = crypto.randomUUID();

  const rawBody = await c.req.text();
  const timestamp = c.req.header("X-Heady-Timestamp") ?? "";
  const signature = c.req.header("X-Heady-Signature") ?? "";

  const authed = await verifyEd25519(env, timestamp, rawBody, signature);
  if (!authed) {
    console.log(JSON.stringify({ reqId, level: "warn", msg: "auth_failed" }));
    return c.json({ error: "unauthorized" }, 401);
  }

  let parsed;
  try {
    parsed = IngestSchema.parse(JSON.parse(rawBody));
  } catch (err) {
    return c.json({ error: "invalid_input", detail: String(err) }, 400);
  }
  const { tenantId, documentId, text, audioObjectKey } = parsed;

  try {
    const emb = await env.AI.run("@cf/baai/bge-small-en-v1.5", { text: [text] });
    const values: number[] = emb.data[0];

    await env.VECTORIZE.upsert([
      {
        id: `${tenantId}:${documentId}`,
        values,
        namespace: tenantId,
        metadata: { tenantId, documentId, ts: Date.now() },
      },
    ]);

    if (audioObjectKey) {
      await env.SIGNAL_QUEUE.send({ tenantId, documentId, audioObjectKey });
    }

    console.log(JSON.stringify({ reqId, level: "info", tenantId, documentId, msg: "ingested" }));
    return c.json({ ok: true, id: `${tenantId}:${documentId}` }, 200);
  } catch (err) {
    console.log(JSON.stringify({ reqId, level: "error", msg: "ingest_failed", err: String(err) }));
    return c.json({ error: "internal_error", reqId }, 500);
  }
});

export default app satisfies ExportedHandler<Env>;
