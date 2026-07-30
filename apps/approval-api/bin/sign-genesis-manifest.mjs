// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Founder Genesis KMS Ceremony v1.0.0                    ║
// ║  Human-run exact-hash invocation of the founder key version.    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { signGenesisManifest } from "../src/genesis-signer.mjs";

const ArgumentsSchema = z.tuple([
  z.literal("--key-version"),
  z.string().min(1),
  z.literal("--manifest"),
  z.string().min(1),
  z.literal("--confirm-manifest-sha256"),
  z.string().regex(/^[a-f0-9]{64}$/),
]);

const [
  ,
  keyVersionName,
  ,
  manifestPath,
  ,
  confirmedManifestSha256,
] = ArgumentsSchema.parse(
  process.argv[2] === "--" ? process.argv.slice(3) : process.argv.slice(2),
);

const result = await signGenesisManifest({
  manifestText: await readFile(resolve(manifestPath), "utf8"),
  keyVersionName,
  confirmedManifestSha256,
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
