# ╔══════════════════════════════════════════════════════════════════╗
# ║  HEADY™ Approval Policy v1.0.0                                  ║
# ║  Typed quorum and evidence binding for the approval control plane.║
# ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
# ╚══════════════════════════════════════════════════════════════════╝

package heady.approval

import rego.v1

known_change_classes := {
	"standard_sensitive",
	"patent_locked",
	"approval_system",
	"renovate_patch",
}

known_evidence_slots := {
	"founder_decision",
	"arbiter_attestation",
	"external_human_review",
	"external_security_review",
	"renovate_attestation",
}

automation_blocked_prefixes := {
	".github/CODEOWNERS",
	"apps/approval-api/",
	"auth/",
	"configs/stage0-untouchables.json",
	"docs/adr/0031-solo-founder-approval-bootstrap.md",
	"docs/design/APPROVAL_SERVICE_BOOTSTRAP_SPEC.md",
	"packages/db/migrations/0004_approval_control_plane.sql",
	"packages/approvals/",
	"packages/auth/",
	"packages/bees/",
	"packages/csl-engine/",
	"packages/security-mesh/",
	"policies/",
	"signer/",
}

base_required_evidence := {
	"standard_sensitive": ["founder_decision"],
	"patent_locked": ["founder_decision", "arbiter_attestation"],
	"approval_system": ["founder_decision", "external_security_review"],
	"renovate_patch": ["renovate_attestation"],
}

default patent_escalated := false

patent_scope if {
	input.patentLocked == true
}

patent_scope if {
	input.changeClass == "patent_locked"
}

patent_escalated if {
	patent_scope
	some evidence in input.evidence
	common_evidence_valid(evidence)
	evidence.evidenceClass == "arbiter_attestation"
	evidence.principalType == "service"
	evidence.verdict == "ESCALATE"
	count(evidence.patentClaims) > 0
	count(evidence.reviewedPaths) > 0
}

required_evidence := ["founder_decision", "external_security_review"] if {
	input.changeClass == "approval_system"
	patent_scope
	patent_escalated
} else := ["founder_decision", "external_security_review", "arbiter_attestation"] if {
	input.changeClass == "approval_system"
	patent_scope
	not patent_escalated
} else := ["founder_decision", "external_human_review"] if {
	patent_escalated
} else := object.get(base_required_evidence, input.changeClass, [])

path_matches_prefix(path, prefix) if {
	path == trim_suffix(prefix, "/")
}

path_matches_prefix(path, prefix) if {
	endswith(prefix, "/")
	startswith(path, prefix)
}

renovate_scope_forbidden if {
	input.changeClass == "renovate_patch"
	some path in input.zonePaths
	some prefix in automation_blocked_prefixes
	path_matches_prefix(path, prefix)
}

renovate_scope_forbidden if {
	input.changeClass == "renovate_patch"
	input.renovatePatchOnly != true
}

common_evidence_valid(evidence) if {
	evidence.principalActive == true
	evidence.ceremonyVerified == true
	evidence.payloadSha256 == input.payloadSha256
	evidence.diffSha256 == input.diffSha256
	evidence.policySha256 == input.policySha256
}

slot_matches("founder_decision", evidence) if {
	evidence.evidenceClass == "founder_decision"
	evidence.principalType == "human"
	evidence.principalRole == "founder"
	evidence.decision == "approve"
}

slot_matches("arbiter_attestation", evidence) if {
	evidence.evidenceClass == "arbiter_attestation"
	evidence.principalType == "service"
	evidence.principalRole == "arbiter"
	evidence.verdict == "ALLOW"
	count(evidence.patentClaims) > 0
	count(evidence.reviewedPaths) > 0
}

slot_matches("external_human_review", evidence) if {
	evidence.evidenceClass == "external_human_review"
	evidence.principalType == "external_reviewer"
	evidence.decision == "approve"
	evidence.resolvesEscalation == true
}

security_review_resolves_required if {
	input.changeClass == "approval_system"
	patent_scope
	patent_escalated
}

slot_matches("external_security_review", evidence) if {
	evidence.evidenceClass == "external_security_review"
	evidence.principalType == "external_reviewer"
	evidence.decision == "approve"
	not security_review_resolves_required
}

slot_matches("external_security_review", evidence) if {
	evidence.evidenceClass == "external_security_review"
	evidence.principalType == "external_reviewer"
	evidence.decision == "approve"
	security_review_resolves_required
	evidence.resolvesEscalation == true
}

slot_matches("renovate_attestation", evidence) if {
	evidence.evidenceClass == "renovate_attestation"
	evidence.principalType == "service"
	evidence.principalRole == "renovate"
	evidence.verdict == "ALLOW"
	not renovate_scope_forbidden
}

slot_evidence[slot] contains evidence if {
	some slot in known_evidence_slots
	some evidence in input.evidence
	common_evidence_valid(evidence)
	slot_matches(slot, evidence)
}

slot_satisfied(slot) if {
	count(slot_evidence[slot]) == 1
}

missing_evidence contains slot if {
	some slot in required_evidence
	not slot_satisfied(slot)
}

duplicate_evidence contains evidence_key if {
	some evidence in input.evidence
	evidence_key := sprintf("%s:%s", [evidence.principalId, evidence.evidenceClass])
	count({
		candidate.eventId |
		some candidate in input.evidence
		candidate.principalId == evidence.principalId
		candidate.evidenceClass == evidence.evidenceClass
	}) > 1
}

principal_slots[principal_id] contains slot if {
	some slot in required_evidence
	some evidence in slot_evidence[slot]
	principal_id := evidence.principalId
}

principal_slot_collision contains principal_id if {
	some principal_id
	count(principal_slots[principal_id]) > 1
}

bound_negative_evidence if {
	some evidence in input.evidence
	common_evidence_valid(evidence)
	evidence.decision == "reject"
}

bound_negative_evidence if {
	some evidence in input.evidence
	common_evidence_valid(evidence)
	evidence.verdict == "BLOCK"
}

invalid_evidence_binding if {
	some evidence in input.evidence
	not common_evidence_valid(evidence)
}

denial_reasons contains "approval_not_pending" if {
	input.state != "pending"
}

denial_reasons contains "approval_expired" if {
	input.nowEpochMs >= input.expiresAtEpochMs
}

denial_reasons contains "unknown_change_class" if {
	not input.changeClass in known_change_classes
}

denial_reasons contains "negative_evidence" if {
	bound_negative_evidence
}

denial_reasons contains "invalid_evidence_binding" if {
	invalid_evidence_binding
}

denial_reasons contains "duplicate_principal_evidence" if {
	count(duplicate_evidence) > 0
}

denial_reasons contains "one_principal_fills_multiple_slots" if {
	count(principal_slot_collision) > 0
}

denial_reasons contains "renovate_scope_forbidden" if {
	renovate_scope_forbidden
}

default allowed := false

allowed if {
	count(missing_evidence) == 0
	count(denial_reasons) == 0
}

decision := {
	"allow": allowed,
	"missingEvidence": sort(missing_evidence),
	"reasons": sort(denial_reasons),
	"requiredEvidence": required_evidence,
	"escalationRequired": patent_escalated,
	"duplicateEvidence": sort(duplicate_evidence),
	"principalSlotCollisions": sort(principal_slot_collision),
}
