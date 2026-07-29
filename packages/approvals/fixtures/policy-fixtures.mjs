// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval Policy Fixtures v1.0.0                          ║
// ║  Exact-diff evidence fixtures shared by approval policy tests.   ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

const HASHES = Object.freeze({
  payloadSha256: "1".repeat(64),
  diffSha256: "2".repeat(64),
  policySha256: "3".repeat(64),
});

export function policyInput(overrides = {}) {
  return {
    changeClass: "standard_sensitive",
    patentLocked: false,
    state: "pending",
    ...HASHES,
    expiresAtEpochMs: 2_000,
    nowEpochMs: 1_000,
    zonePaths: ["packages/example/src/index.mjs"],
    renovatePatchOnly: false,
    evidence: [],
    ...overrides,
  };
}

export function founderEvidence(overrides = {}) {
  return {
    eventId: "founder-event",
    principalId: "founder",
    principalType: "human",
    principalRole: "founder",
    evidenceClass: "founder_decision",
    decision: "approve",
    verdict: null,
    resolvesEscalation: false,
    patentClaims: [],
    reviewedPaths: [],
    principalActive: true,
    ceremonyVerified: true,
    ...HASHES,
    ...overrides,
  };
}

export function arbiterEvidence(overrides = {}) {
  return {
    eventId: "arbiter-event",
    principalId: "arbiter",
    principalType: "service",
    principalRole: "arbiter",
    evidenceClass: "arbiter_attestation",
    decision: null,
    verdict: "ALLOW",
    resolvesEscalation: false,
    patentClaims: ["HS-2026-051"],
    reviewedPaths: ["packages/bees/"],
    principalActive: true,
    ceremonyVerified: true,
    ...HASHES,
    ...overrides,
  };
}

export function reviewerEvidence(evidenceClass, overrides = {}) {
  return {
    eventId: `reviewer-event-${evidenceClass}`,
    principalId: "external-reviewer",
    principalType: "external_reviewer",
    principalRole: "security_reviewer",
    evidenceClass,
    decision: "approve",
    verdict: null,
    resolvesEscalation: evidenceClass === "external_human_review",
    patentClaims: [],
    reviewedPaths: [],
    principalActive: true,
    ceremonyVerified: true,
    ...HASHES,
    ...overrides,
  };
}

export function renovateEvidence(overrides = {}) {
  return {
    eventId: "renovate-event",
    principalId: "renovate",
    principalType: "service",
    principalRole: "renovate",
    evidenceClass: "renovate_attestation",
    decision: null,
    verdict: "ALLOW",
    resolvesEscalation: false,
    patentClaims: [],
    reviewedPaths: ["packages/example/package.json"],
    principalActive: true,
    ceremonyVerified: true,
    ...HASHES,
    ...overrides,
  };
}
