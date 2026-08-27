// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval KMS Signer Tests v1.0.0                        ║
// ║  CRC32C integrity and detached Ed25519 signature verification.  ║
// ║  Made with ❤️ by HeadySystems Inc.                              ║
// ╚══════════════════════════════════════════════════════════════════╝

import assert from "node:assert/strict";
import {
  generateKeyPairSync,
  sign,
} from "node:crypto";
import { test } from "node:test";
import crc32c from "fast-crc32c";
import { verifyEd25519 } from "@heady/approvals";
import { createKmsReceiptSigner } from "../src/kms-signer.mjs";

const KEY_NAME = "projects/heady/locations/global/keyRings/approval/cryptoKeys/receipts/cryptoKeyVersions/1";

function checksum(value) {
  return crc32c.calculate(Buffer.from(value)) >>> 0;
}

function fakeKms({
  corruptSignatureChecksum = false,
  algorithm = "EC_SIGN_ED25519",
} = {}) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const pem = publicKey.export({ type: "spki", format: "pem" });
  return {
    publicKey,
    client: {
      async getPublicKey({ name }) {
        return [{
          name,
          algorithm,
          pem,
          pemCrc32c: { value: checksum(pem) },
        }];
      },
      async asymmetricSign({ name, data, dataCrc32c }) {
        assert.equal(name, KEY_NAME);
        assert.equal(Number(dataCrc32c.value), checksum(data));
        const signature = sign(null, data, privateKey);
        return [{
          name,
          verifiedDataCrc32c: true,
          signature,
          signatureCrc32c: {
            value: corruptSignatureChecksum ? checksum(signature) + 1 : checksum(signature),
          },
        }];
      },
    },
  };
}

test("KMS signer verifies transport integrity and returns a locally verifiable signature", async () => {
  const fixture = fakeKms();
  const signer = await createKmsReceiptSigner({
    keyVersionName: KEY_NAME,
    client: fixture.client,
  });
  const payload = Buffer.from('{"receipt":"bound"}');
  const result = await signer.sign({ payload });
  assert.equal(result.algorithm, "EC_SIGN_ED25519");
  assert.equal(result.signingKeyId, KEY_NAME);
  assert.equal(verifyEd25519({
    publicJwk: result.publicJwk,
    payload,
    signature: result.signature,
  }), true);
});

test("KMS signer fails closed on a signature CRC32C mismatch", async () => {
  const fixture = fakeKms({ corruptSignatureChecksum: true });
  const signer = await createKmsReceiptSigner({
    keyVersionName: KEY_NAME,
    client: fixture.client,
  });
  await assert.rejects(() => signer.sign({ payload: Buffer.from("receipt") }), /CRC32C/);
});

test("KMS signer rejects a key version with the wrong signing algorithm", async () => {
  const fixture = fakeKms({ algorithm: "EC_SIGN_P256_SHA256" });
  await assert.rejects(
    () => createKmsReceiptSigner({
      keyVersionName: KEY_NAME,
      client: fixture.client,
    }),
    /metadata or algorithm/,
  );
});
