// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval Policy Input v1.0.0                            ║
// ║  Trusted projection from Neon evidence into the Rego contract.  ║
// ║  Made with ❤️ by HeadySystems Inc.                              ║
// ╚══════════════════════════════════════════════════════════════════╝

function evidenceFromRow(row) {
  const detail = row.evidence_envelope?.detail ?? {};
  return {
    eventId: row.id,
    principalId: row.actor_principal_id,
    principalType: row.actor_snapshot.principalType,
    principalRole: row.actor_snapshot.principalRole,
    evidenceClass: row.evidence_class,
    decision: row.decision,
    verdict: row.verdict,
    resolvesEscalation: detail.resolvesEscalation === true,
    patentClaims: detail.patentClaims ?? [],
    reviewedPaths: detail.reviewedPaths ?? [],
    principalActive: row.current_principal_active === true && row.current_key_active === true,
    ceremonyVerified: row.actor_snapshot.ceremonyVerified === true,
    payloadSha256: row.evidence_envelope.payloadSha256,
    diffSha256: row.evidence_envelope.diffSha256,
    policySha256: row.evidence_envelope.policySha256,
  };
}

export function buildPolicyInput({
  approval,
  evidenceRows,
  nowEpochMs,
  state = approval.state,
  extraEvidence = [],
}) {
  return {
    changeClass: approval.change_class,
    subjectType: approval.subject_type,
    creatorPrincipalId: approval.created_by,
    patentLocked: approval.patent_locked,
    state,
    materializedState: approval.state,
    payloadSha256: approval.payload_sha256,
    diffSha256: approval.diff_sha256,
    policySha256: approval.policy_sha256,
    expiresAtEpochMs: approval.expires_at
      ? new Date(approval.expires_at).getTime()
      : Number.MAX_SAFE_INTEGER,
    nowEpochMs,
    zonePaths: approval.zone_paths,
    renovatePatchOnly: approval.renovate_patch_only,
    autonomous: approval.change_class === "autonomous_operation"
      ? approval.canonical_payload
      : null,
    evidence: [
      ...evidenceRows.map(evidenceFromRow),
      ...extraEvidence,
    ],
  };
}

export function buildPendingPolicyInput(options) {
  return buildPolicyInput({ ...options, state: "pending" });
}
