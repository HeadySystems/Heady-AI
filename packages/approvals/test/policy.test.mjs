// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval WASM Policy Tests v1.0.0                        ║
// ║  Proves typed quorum, escalation, binding, and automation scope. ║
// ║  Made with ❤️ by HeadySystems Inc.                               ║
// ╚══════════════════════════════════════════════════════════════════╝

import assert from "node:assert/strict";
import { test } from "node:test";
import { createPolicyEvaluator } from "../src/policy.mjs";
import {
  automationEvidence,
  arbiterEvidence,
  founderEvidence,
  policyInput,
  renovateEvidence,
  reviewerEvidence,
} from "../fixtures/policy-fixtures.mjs";

const evaluatorPromise = createPolicyEvaluator();

async function evaluate(input) {
  const evaluator = await evaluatorPromise;
  return evaluator.evaluate(input);
}

test("standard sensitive changes require one active founder decision", async () => {
  const missing = await evaluate(policyInput());
  assert.equal(missing.allow, false);
  assert.deepEqual(missing.missingEvidence, ["founder_decision"]);

  const allowed = await evaluate(policyInput({ evidence: [founderEvidence()] }));
  assert.equal(allowed.allow, true);
  assert.deepEqual(allowed.reasons, []);
});

test("patent changes require founder plus exact-diff ARBITER ALLOW", async () => {
  const result = await evaluate(policyInput({
    changeClass: "patent_locked",
    patentLocked: true,
    zonePaths: ["packages/bees/worker.mjs"],
    evidence: [founderEvidence(), arbiterEvidence()],
  }));
  assert.equal(result.allow, true);
  assert.deepEqual(result.requiredEvidence, ["founder_decision", "arbiter_attestation"]);
});

test("ARBITER ESCALATE replaces ALLOW with an external human resolution", async () => {
  const escalated = arbiterEvidence({ verdict: "ESCALATE" });
  const missing = await evaluate(policyInput({
    changeClass: "patent_locked",
    patentLocked: true,
    evidence: [founderEvidence(), escalated],
  }));
  assert.equal(missing.allow, false);
  assert.equal(missing.escalationRequired, true);
  assert.deepEqual(missing.missingEvidence, ["external_human_review"]);

  const resolved = await evaluate(policyInput({
    changeClass: "patent_locked",
    patentLocked: true,
    evidence: [
      founderEvidence(),
      escalated,
      reviewerEvidence("external_human_review"),
    ],
  }));
  assert.equal(resolved.allow, true);
});

test("approval-system changes require a separate external security reviewer", async () => {
  const input = policyInput({
    changeClass: "approval_system",
    zonePaths: ["packages/approvals/src/service.mjs"],
    evidence: [
      founderEvidence(),
      reviewerEvidence("external_security_review"),
    ],
  });
  assert.equal((await evaluate(input)).allow, true);
});

test("approval-system changes that touch patent scope also require ARBITER", async () => {
  const withoutArbiter = await evaluate(policyInput({
    changeClass: "approval_system",
    patentLocked: true,
    zonePaths: ["packages/approvals/src/service.mjs", "packages/csl-engine/src/gate.mjs"],
    evidence: [
      founderEvidence(),
      reviewerEvidence("external_security_review"),
    ],
  }));
  assert.equal(withoutArbiter.allow, false);
  assert.deepEqual(withoutArbiter.missingEvidence, ["arbiter_attestation"]);

  const allowed = await evaluate(policyInput({
    changeClass: "approval_system",
    patentLocked: true,
    zonePaths: ["packages/approvals/src/service.mjs", "packages/csl-engine/src/gate.mjs"],
    evidence: [
      founderEvidence(),
      reviewerEvidence("external_security_review"),
      arbiterEvidence(),
    ],
  }));
  assert.equal(allowed.allow, true);
});

test("binding drift, revocation, expiry, duplicate evidence, and negative evidence deny", async () => {
  const cases = [
    policyInput({ evidence: [founderEvidence({ diffSha256: "4".repeat(64) })] }),
    policyInput({ evidence: [founderEvidence({ principalActive: false })] }),
    policyInput({ nowEpochMs: 2_000, evidence: [founderEvidence()] }),
    policyInput({ evidence: [founderEvidence(), founderEvidence({ eventId: "duplicate" })] }),
    policyInput({ evidence: [founderEvidence({ decision: "reject" })] }),
  ];
  for (const input of cases) {
    assert.equal((await evaluate(input)).allow, false);
  }
});

test("a single principal cannot fill multiple typed evidence slots", async () => {
  const reviewer = reviewerEvidence("external_security_review", {
    principalId: "founder",
    principalType: "external_reviewer",
  });
  const result = await evaluate(policyInput({
    changeClass: "approval_system",
    evidence: [founderEvidence(), reviewer],
  }));
  assert.equal(result.allow, false);
  assert.ok(result.reasons.includes("one_principal_fills_multiple_slots"));
});

test("Renovate is allowed only for patch-only changes outside protected paths", async () => {
  const allowed = await evaluate(policyInput({
    changeClass: "renovate_patch",
    renovatePatchOnly: true,
    zonePaths: ["packages/example/package.json"],
    evidence: [renovateEvidence()],
  }));
  assert.equal(allowed.allow, true);

  const protectedPath = await evaluate(policyInput({
    changeClass: "renovate_patch",
    renovatePatchOnly: true,
    zonePaths: ["packages/auth/package.json"],
    evidence: [renovateEvidence()],
  }));
  assert.equal(protectedPath.allow, false);
  assert.ok(protectedPath.reasons.includes("renovate_scope_forbidden"));

  const approvalMigration = await evaluate(policyInput({
    changeClass: "renovate_patch",
    renovatePatchOnly: true,
    zonePaths: ["packages/db/migrations/0004_approval_control_plane.sql"],
    evidence: [renovateEvidence()],
  }));
  assert.equal(approvalMigration.allow, false);
  assert.ok(approvalMigration.reasons.includes("renovate_scope_forbidden"));
});

test("autonomous approvals require an independent guard and bounded safe payload", async () => {
  const autonomous = {
    schema: "heady.autonomous.approval.v1",
    capability: "source_authorship",
    requesterPrincipalId: "automation-requester",
    requesterWorkloadIdentity: "automation-requester-subject",
    subjectSha256: "5".repeat(64),
    rollbackPlanSha256: "6".repeat(64),
    riskTier: "low",
    reversible: true,
    dryRunVerified: true,
    networkAccess: "none",
    resourceScopes: ["repo:Heady-AI/packages/example"],
    maxAffectedResources: 1,
    maxDurationMs: 1_000,
  };
  const allowed = await evaluate(policyInput({
    changeClass: "autonomous_operation",
    subjectType: "autonomous_process",
    creatorPrincipalId: "automation-requester",
    autonomous,
    evidence: [automationEvidence()],
  }));
  assert.equal(allowed.allow, true);

  const ceilingScopes = Array.from(
    { length: 34 },
    (_, index) => `provider:catalog-${index + 1}`,
  );
  const ceilingAllowed = await evaluate(policyInput({
    changeClass: "autonomous_operation",
    subjectType: "autonomous_process",
    creatorPrincipalId: "automation-requester",
    autonomous: {
      ...autonomous,
      resourceScopes: ceilingScopes,
      maxAffectedResources: ceilingScopes.length,
    },
    evidence: [automationEvidence()],
  }));
  assert.equal(ceilingAllowed.allow, true);

  const overflowDenied = await evaluate(policyInput({
    changeClass: "autonomous_operation",
    subjectType: "autonomous_process",
    creatorPrincipalId: "automation-requester",
    autonomous: {
      ...autonomous,
      resourceScopes: [...ceilingScopes, "provider:catalog-overflow"],
      maxAffectedResources: ceilingScopes.length + 1,
    },
    evidence: [automationEvidence()],
  }));
  assert.equal(overflowDenied.allow, false);
  assert.ok(overflowDenied.reasons.includes("autonomous_payload_invalid"));

  const selfApproved = await evaluate(policyInput({
    changeClass: "autonomous_operation",
    subjectType: "autonomous_process",
    creatorPrincipalId: "automation-guard",
    autonomous,
    evidence: [automationEvidence()],
  }));
  assert.equal(selfApproved.allow, false);
  assert.deepEqual(selfApproved.missingEvidence, ["automation_attestation"]);

  const protectedPath = await evaluate(policyInput({
    changeClass: "autonomous_operation",
    subjectType: "autonomous_process",
    creatorPrincipalId: "automation-requester",
    zonePaths: ["packages/auth/src/session.mjs"],
    autonomous,
    evidence: [automationEvidence({ reviewedPaths: ["packages/auth/src/session.mjs"] })],
  }));
  assert.equal(protectedPath.allow, false);
  assert.ok(protectedPath.reasons.includes("autonomous_scope_forbidden"));

  const irreversible = await evaluate(policyInput({
    changeClass: "autonomous_operation",
    subjectType: "autonomous_process",
    creatorPrincipalId: "automation-requester",
    autonomous: { ...autonomous, reversible: false },
    evidence: [automationEvidence()],
  }));
  assert.equal(irreversible.allow, false);
  assert.ok(irreversible.reasons.includes("autonomous_payload_invalid"));
});
