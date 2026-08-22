// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval Evidence Round-Trip Tests v1.0.0                ║
// ║  Signs a built envelope with an ephemeral Ed25519 key and checks ║
// ║  the service-side ceremony verifier accepts it — proving the      ║
// ║  loop without ever invoking the founder's KMS key.               ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

import assert from "node:assert/strict";
import { generateKeyPairSync, sign as signPayload } from "node:crypto";
import test from "node:test";
import {
  canonicalize,
  EVIDENCE_CEREMONY_MAX_MS,
  verifyEvidenceCeremony,
} from "@heady/approvals";
import { buildDecisionCeremony } from "../src/envelope.mjs";

const APPROVAL_STATE = Object.freeze({
  approvalId: "01JZ9F7Q8T4V2W6X8Y0Z1A2B3C",
  state: "pending",
  payloadSha256: "1".repeat(64),
  diffSha256: "2".repeat(64),
  policySha256: "3".repeat(64),
});

function ephemeralCeremonyKey() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    publicJwk: publicKey.export({ format: "jwk" }),
    sign: (envelope) => signPayload(null, Buffer.from(canonicalize(envelope)), privateKey)
      .toString("base64url"),
  };
}

test("a built envelope signed by its principal passes the service verifier", () => {
  const key = ephemeralCeremonyKey();
  const now = Date.now();
  const { envelope, envelopeSha256 } = buildDecisionCeremony({
    approvalState: APPROVAL_STATE,
    evidenceClass: "founder_decision",
    request: {
      decision: "approve",
      reason: "round-trip proof",
      nowEpochMs: now,
      ttlMs: EVIDENCE_CEREMONY_MAX_MS,
    },
  });

  const verified = verifyEvidenceCeremony({
    publicJwk: key.publicJwk,
    envelope,
    signature: key.sign(envelope),
    now,
  });
  assert.equal(verified.envelopeSha256, envelopeSha256);
});

test("any tampering with the signed envelope fails verification", () => {
  const key = ephemeralCeremonyKey();
  const now = Date.now();
  const { envelope } = buildDecisionCeremony({
    approvalState: APPROVAL_STATE,
    evidenceClass: "founder_decision",
    request: { decision: "approve", reason: "tamper proof", nowEpochMs: now },
  });
  const signature = key.sign(envelope);

  const tampered = [
    { ...envelope, action: "reject" },
    { ...envelope, diffSha256: "4".repeat(64) },
    { ...envelope, detail: { ...envelope.detail, decision: "reject" } },
    { ...envelope, nonce: `${envelope.nonce}x` },
  ];
  for (const candidate of tampered) {
    assert.throws(
      () => verifyEvidenceCeremony({
        publicJwk: key.publicJwk,
        envelope: candidate,
        signature,
        now,
      }),
      /verification failed/,
    );
  }
});

test("a signature from another key is refused", () => {
  const key = ephemeralCeremonyKey();
  const impostor = ephemeralCeremonyKey();
  const now = Date.now();
  const { envelope } = buildDecisionCeremony({
    approvalState: APPROVAL_STATE,
    evidenceClass: "founder_decision",
    request: { decision: "approve", reason: "wrong key", nowEpochMs: now },
  });
  assert.throws(
    () => verifyEvidenceCeremony({
      publicJwk: key.publicJwk,
      envelope,
      signature: impostor.sign(envelope),
      now,
    }),
    /verification failed/,
  );
});

test("an elapsed ceremony window is refused even with a valid signature", () => {
  const key = ephemeralCeremonyKey();
  const now = Date.now();
  const ttlMs = EVIDENCE_CEREMONY_MAX_MS;
  const { envelope } = buildDecisionCeremony({
    approvalState: APPROVAL_STATE,
    evidenceClass: "founder_decision",
    request: { decision: "approve", reason: "expired", nowEpochMs: now, ttlMs },
  });
  assert.throws(
    () => verifyEvidenceCeremony({
      publicJwk: key.publicJwk,
      envelope,
      signature: key.sign(envelope),
      now: now + ttlMs + 1,
    }),
    /expired/,
  );
});
