// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ KMS Evidence Ceremony v1.0.0                            ║
// ║  Human-invoked signing of one canonical approval envelope.      ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import {
  canonicalize,
  EvidenceEnvelopeSchema,
  publicJwkFingerprint,
  sha256,
} from "@heady/approvals";
import { createKmsReceiptSigner } from "../src/kms-signer.mjs";

const ArgumentsSchema = z.tuple([
  z.literal("--key-version"),
  z.string().regex(/^projects\/[^/]+\/locations\/[^/]+\/keyRings\/[^/]+\/cryptoKeys\/[^/]+\/cryptoKeyVersions\/[1-9]\d*$/),
  z.literal("--envelope"),
  z.string().min(1),
]);

const [, keyVersionName, , envelopePath] = ArgumentsSchema.parse(process.argv.slice(2));
const envelope = EvidenceEnvelopeSchema.parse(JSON.parse(
  await readFile(resolve(envelopePath), "utf8"),
));
const canonicalEnvelope = canonicalize(envelope);
const signer = await createKmsReceiptSigner({ keyVersionName });
const signed = await signer.sign({
  payload: Buffer.from(canonicalEnvelope),
  payloadSha256: sha256(canonicalEnvelope),
});

process.stdout.write(`${JSON.stringify({
  envelope,
  envelopeSha256: sha256(canonicalEnvelope),
  keyFingerprint: publicJwkFingerprint(signed.publicJwk),
  keyVersionName,
  signature: signed.signature,
}, null, 2)}\n`);
