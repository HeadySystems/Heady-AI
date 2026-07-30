// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Founder Genesis Signer Tests v1.0.0                    ║
// ║  Exact-hash, canonical-manifest, and KMS-key binding coverage.  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

import assert from "node:assert/strict";
import {
  generateKeyPairSync,
  sign,
} from "node:crypto";
import { test } from "node:test";
import crc32c from "fast-crc32c";
import {
  buildGenesisManifest,
  publicJwkFingerprint,
  verifyEd25519,
} from "@heady/approvals";
import { signGenesisManifest } from "../src/genesis-signer.mjs";

const KEY_NAME = "projects/heady/locations/global/keyRings/approval/cryptoKeys/founder/cryptoKeyVersions/1";
const HASH = "a".repeat(64);
const OTHER_HASH = "b".repeat(64);

function checksum(value) {
  return crc32c.calculate(Buffer.from(value)) >>> 0;
}

function fakeKms() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const pem = publicKey.export({ type: "spki", format: "pem" });
  const publicJwk = publicKey.export({ format: "jwk" });
  return {
    publicJwk,
    client: {
      async getPublicKey({ name }) {
        return [{
          name,
          algorithm: "EC_SIGN_ED25519",
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
          signatureCrc32c: { value: checksum(signature) },
        }];
      },
    },
  };
}

function manifestFor(founderEvidence) {
  return buildGenesisManifest({
    implementationCommit: "c".repeat(40),
    approvalSourceTreeSha256: HASH,
    specificationSha256: HASH,
    migrationSha256: HASH,
    policySourceSha256: HASH,
    policyWasmSha256: HASH,
    deploymentManifestSha256: HASH,
    deploymentArtifactDigest: `sha256:${HASH}`,
    rollbackArtifactDigest: `sha256:${OTHER_HASH}`,
    governanceReportSha256: HASH,
    securityReviewSha256: HASH,
    founderPublicKeyFingerprint: founderEvidence,
    arbiterPublicKeyFingerprint: HASH,
    receiptSignerPublicKeyFingerprint: HASH,
  });
}

test("founder helper invokes the bound KMS key for the exact canonical manifest", async () => {
  const fixture = fakeKms();
  const prepared = manifestFor(publicJwkFingerprint(fixture.publicJwk));
  const result = await signGenesisManifest({
    manifestText: prepared.canonicalManifest,
    keyVersionName: KEY_NAME,
    confirmedManifestSha256: prepared.manifestSha256,
    client: fixture.client,
  });

  assert.equal(result.manifestSha256, prepared.manifestSha256);
  assert.equal(result.keyVersionName, KEY_NAME);
  assert.equal(verifyEd25519({
    publicJwk: result.publicJwk,
    payload: prepared.canonicalManifest,
    signature: result.signature,
  }), true);
});

test("founder helper rejects an unconfirmed or noncanonical manifest", async () => {
  const fixture = fakeKms();
  const prepared = manifestFor(publicJwkFingerprint(fixture.publicJwk));

  await assert.rejects(
    () => signGenesisManifest({
      manifestText: prepared.canonicalManifest,
      keyVersionName: KEY_NAME,
      confirmedManifestSha256: OTHER_HASH,
      client: fixture.client,
    }),
    /confirmed genesis manifest hash mismatch/,
  );

  await assert.rejects(
    () => signGenesisManifest({
      manifestText: JSON.stringify(prepared.manifest, null, 2),
      keyVersionName: KEY_NAME,
      confirmedManifestSha256: prepared.manifestSha256,
      client: fixture.client,
    }),
    /not canonical JSON/,
  );
});

test("founder helper rejects a KMS key not bound by the manifest", async () => {
  const fixture = fakeKms();
  const prepared = manifestFor(HASH);
  await assert.rejects(
    () => signGenesisManifest({
      manifestText: prepared.canonicalManifest,
      keyVersionName: KEY_NAME,
      confirmedManifestSha256: prepared.manifestSha256,
      client: fixture.client,
    }),
    /does not match the founder key/,
  );
});
