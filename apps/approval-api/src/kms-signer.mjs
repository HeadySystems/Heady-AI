// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval KMS Receipt Signer v1.0.0                      ║
// ║  Integrity-checked Cloud KMS Ed25519 asymmetric signatures.     ║
// ║  Made with ❤️ by HeadySystems Inc.                              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { createPublicKey } from "node:crypto";
import {
  KeyManagementServiceClient,
  protos,
} from "@google-cloud/kms";
import crc32c from "fast-crc32c";
import { base64UrlEncode } from "@heady/approvals";
import { UpstreamError } from "@heady/shared";

const KMS_ED25519_ALGORITHM = protos.google.cloud.kms.v1
  .CryptoKeyVersion.CryptoKeyVersionAlgorithm.EC_SIGN_ED25519;

function checksum(value) {
  return crc32c.calculate(Buffer.from(value)) >>> 0;
}

function numericChecksum(wrapper) {
  if (wrapper === null || wrapper === undefined) return null;
  const value = typeof wrapper === "object" && "value" in wrapper
    ? wrapper.value
    : wrapper;
  return Number(value);
}

export async function createKmsReceiptSigner({
  keyVersionName,
  client = new KeyManagementServiceClient(),
}) {
  const [publicKeyResponse] = await client.getPublicKey({ name: keyVersionName });
  if (
    !publicKeyResponse.pem
    || publicKeyResponse.name !== keyVersionName
    || ![KMS_ED25519_ALGORITHM, "EC_SIGN_ED25519"].includes(publicKeyResponse.algorithm)
  ) {
    throw new UpstreamError("Cloud KMS returned unexpected public-key metadata or algorithm");
  }
  const pemChecksum = numericChecksum(publicKeyResponse.pemCrc32c);
  if (pemChecksum === null || pemChecksum !== checksum(publicKeyResponse.pem)) {
    throw new UpstreamError("Cloud KMS public-key CRC32C verification failed");
  }
  const publicJwk = createPublicKey(publicKeyResponse.pem).export({ format: "jwk" });
  if (publicJwk.kty !== "OKP" || publicJwk.crv !== "Ed25519") {
    throw new UpstreamError("Cloud KMS key is not an Ed25519 asymmetric signing key");
  }

  return Object.freeze({
    signingKeyId: keyVersionName,
    publicJwk,
    publicJwkVersion: keyVersionName,
    async sign({ payload }) {
      const data = Buffer.from(payload);
      const dataCrc32c = checksum(data);
      const [response] = await client.asymmetricSign({
        name: keyVersionName,
        data,
        dataCrc32c: { value: dataCrc32c },
      });
      if (response.name !== keyVersionName || response.verifiedDataCrc32c !== true) {
        throw new UpstreamError("Cloud KMS did not verify receipt input integrity");
      }
      if (!response.signature) {
        throw new UpstreamError("Cloud KMS returned no receipt signature");
      }
      const signature = Buffer.from(response.signature);
      if (numericChecksum(response.signatureCrc32c) !== checksum(signature)) {
        throw new UpstreamError("Cloud KMS receipt signature CRC32C verification failed");
      }
      return {
        signingKeyId: keyVersionName,
        algorithm: "EC_SIGN_ED25519",
        signature: base64UrlEncode(signature),
        publicJwk,
        publicJwkVersion: keyVersionName,
      };
    },
  });
}
