// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ KMS Public JWK Export v1.0.0                            ║
// ║  Reads and integrity-checks public verification material only. ║
// ║  Made with ❤️ by HeadySystems Inc.                              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { z } from "zod";
import { publicJwkFingerprint } from "@heady/approvals";
import { createKmsReceiptSigner } from "../src/kms-signer.mjs";

const ArgumentsSchema = z.tuple([
  z.literal("--key-version"),
  z.string().regex(/^projects\/[^/]+\/locations\/[^/]+\/keyRings\/[^/]+\/cryptoKeys\/[^/]+\/cryptoKeyVersions\/[1-9]\d*$/),
]);

const [, keyVersionName] = ArgumentsSchema.parse(process.argv.slice(2));
const key = await createKmsReceiptSigner({ keyVersionName });
process.stdout.write(`${JSON.stringify({
  keyVersionName,
  publicJwk: key.publicJwk,
  fingerprint: publicJwkFingerprint(key.publicJwk),
}, null, 2)}\n`);
