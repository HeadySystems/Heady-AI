// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval Evidence Envelope Tests v1.0.0                  ║
// ║  Proves the locally built envelope is byte-identical to the one  ║
// ║  the approval service reconstructs for a decision.               ║
// ║  Made with ❤️ by HeadySystems Inc.                               ║
// ╚══════════════════════════════════════════════════════════════════╝

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEvidenceEnvelope,
  canonicalize,
  EVIDENCE_CEREMONY_MAX_MS,
  sha256,
} from "@heady/approvals";
import {
  buildDecisionCeremony,
  freshNonce,
  NONCE_BYTES,
} from "../src/envelope.mjs";

const APPROVAL_STATE = Object.freeze({
  approvalId: "01JZ9F7Q8T4V2W6X8Y0Z1A2B3C",
  state: "pending",
  payloadSha256: "a".repeat(64),
  diffSha256: "b".repeat(64),
  policySha256: "c".repeat(64),
  changeClass: "patent_locked",
  missingEvidence: ["arbiter_attestation"],
});

const NOW_EPOCH_MS = 1_800_000_000_000;
const NONCE = "Zm91bmRlci1jZXJlbW9ueS1ub25jZQ";

test("the built envelope matches the service-side reconstruction byte for byte", () => {
  const { envelope, envelopeSha256, decisionRequest } = buildDecisionCeremony({
    approvalState: APPROVAL_STATE,
    evidenceClass: "founder_decision",
    request: {
      decision: "approve",
      reason: "HCP-0003 narrowed claim surface reviewed",
      nonce: NONCE,
      nowEpochMs: NOW_EPOCH_MS,
      ttlMs: EVIDENCE_CEREMONY_MAX_MS,
    },
  });

  // Exactly what packages/approvals/src/service.mjs decide() rebuilds.
  const expected = buildEvidenceEnvelope({
    approvalId: APPROVAL_STATE.approvalId,
    action: "approve",
    payloadSha256: APPROVAL_STATE.payloadSha256,
    diffSha256: APPROVAL_STATE.diffSha256,
    policySha256: APPROVAL_STATE.policySha256,
    nonce: NONCE,
    evidenceExpiresAt: new Date(NOW_EPOCH_MS + EVIDENCE_CEREMONY_MAX_MS).toISOString(),
    detail: {
      evidenceClass: "founder_decision",
      decision: "approve",
      reason: "HCP-0003 narrowed claim surface reviewed",
      resolvesEscalation: false,
    },
  });

  assert.equal(canonicalize(envelope), canonicalize(expected));
  assert.equal(envelopeSha256, sha256(canonicalize(expected)));
  assert.equal(decisionRequest.nonce, NONCE);
  assert.equal(decisionRequest.evidenceExpiresAt, envelope.evidenceExpiresAt);
  assert.ok(!Object.hasOwn(decisionRequest, "signature"));
  // The service rebuilds detail.reason from the request body; if these two ever
  // diverge the signature verifies against bytes nobody agreed to.
  assert.equal(decisionRequest.reason, envelope.detail.reason);
  assert.equal(decisionRequest.decision, envelope.action);
  assert.equal(decisionRequest.resolvesEscalation, envelope.detail.resolvesEscalation);
});

test("a reason the decision endpoint would reject fails before a ceremony is spent", () => {
  const MAX_REASON = 1_597;
  const atLimit = "r".repeat(MAX_REASON);
  const overLimit = "r".repeat(MAX_REASON + 1);

  const ok = buildDecisionCeremony({
    approvalState: APPROVAL_STATE,
    evidenceClass: "founder_decision",
    request: { decision: "approve", reason: atLimit, nonce: NONCE, nowEpochMs: NOW_EPOCH_MS },
  });
  assert.equal(ok.decisionRequest.reason.length, MAX_REASON);

  assert.throws(() => buildDecisionCeremony({
    approvalState: APPROVAL_STATE,
    evidenceClass: "founder_decision",
    request: { decision: "approve", reason: overLimit, nonce: NONCE, nowEpochMs: NOW_EPOCH_MS },
  }));
});

test("a reject decision changes the signed action and detail", () => {
  const { envelope } = buildDecisionCeremony({
    approvalState: APPROVAL_STATE,
    evidenceClass: "founder_decision",
    request: {
      decision: "reject",
      reason: "claim surface still too broad",
      nonce: NONCE,
      nowEpochMs: NOW_EPOCH_MS,
    },
  });
  assert.equal(envelope.action, "reject");
  assert.equal(envelope.detail.decision, "reject");
});

test("evidence cannot be built for an approval that is not pending", () => {
  for (const state of ["draft", "approved", "rejected", "expired", "superseded"]) {
    assert.throws(
      () => buildDecisionCeremony({
        approvalState: { ...APPROVAL_STATE, state },
        evidenceClass: "founder_decision",
        request: { decision: "approve", reason: "premature", nonce: NONCE },
      }),
      /may only be added while pending/,
    );
  }
});

test("a ceremony window wider than the service allowance is refused", () => {
  assert.throws(
    () => buildDecisionCeremony({
      approvalState: APPROVAL_STATE,
      evidenceClass: "founder_decision",
      request: {
        decision: "approve",
        reason: "too long",
        nonce: NONCE,
        ttlMs: EVIDENCE_CEREMONY_MAX_MS + 1,
      },
    }),
    /ttlMs/,
  );
});

test("a service evidence class cannot be smuggled through the human ceremony", () => {
  for (const evidenceClass of ["arbiter_attestation", "automation_attestation", "renovate_attestation"]) {
    assert.throws(
      () => buildDecisionCeremony({
        approvalState: APPROVAL_STATE,
        evidenceClass,
        request: { decision: "approve", reason: "wrong lane", nonce: NONCE },
      }),
    );
  }
});

test("a mangled approval view is rejected before any envelope is produced", () => {
  assert.throws(() => buildDecisionCeremony({
    approvalState: { ...APPROVAL_STATE, diffSha256: "not-a-hash" },
    evidenceClass: "founder_decision",
    request: { decision: "approve", reason: "bad hash", nonce: NONCE },
  }));
  assert.throws(() => buildDecisionCeremony({
    approvalState: { ...APPROVAL_STATE, approvalId: "not-a-ulid" },
    evidenceClass: "founder_decision",
    request: { decision: "approve", reason: "bad id", nonce: NONCE },
  }));
});

test("generated nonces are unique, base64url, and inside the schema window", () => {
  const seen = new Set();
  for (let index = 0; index < 89; index += 1) {
    const nonce = freshNonce();
    assert.match(nonce, /^[A-Za-z0-9_-]+$/);
    assert.ok(nonce.length >= 21 && nonce.length <= 233);
    assert.ok(!seen.has(nonce));
    seen.add(nonce);
  }
  assert.equal(NONCE_BYTES, 21);
});
