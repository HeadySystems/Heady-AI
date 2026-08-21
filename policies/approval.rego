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
	"autonomous_operation",
}

known_evidence_slots := {
	"founder_decision",
	"arbiter_attestation",
	"external_human_review",
	"external_security_review",
	"renovate_attestation",
	"automation_attestation",
}

automation_blocked_prefixes := {
	".github/",
	"apps/approval-api/",
	"auth/",
	"cloudbuild.yaml",
	"configs/stage0-untouchables.json",
	"deploy/",
	"docs/adr/0031-solo-founder-approval-bootstrap.md",
	"docs/design/APPROVAL_SERVICE_BOOTSTRAP_SPEC.md",
	"docs/design/AUTONOMOUS_APPROVAL_SIGNING.md",
	"infra/",
	"packages/db/migrations/",
	"packages/approvals/",
	"packages/auth/",
	"packages/bees/",
	"packages/csl-engine/",
	"packages/secrets/",
	"packages/security-mesh/",
	"policies/",
	"signer/",
}

base_required_evidence := {
	"standard_sensitive": ["founder_decision"],
	"patent_locked": ["founder_decision", "arbiter_attestation"],
	"approval_system": ["founder_decision", "external_security_review"],
	"renovate_patch": ["renovate_attestation"],
	"autonomous_operation": ["automation_attestation"],
}

autonomous_capabilities := {
	"source_authorship",
	"build_attestation",
	"maintenance_execution",
}

# FIB[9] resource ceiling and round(PHI * FIB[8] * 60 * 1000) duration,
# pinned to the policy build. Expanding resource breadth does not expand
# capability, risk tier, path, duration, evidence, or one-time nonce bounds.
autonomous_max_affected_resources := 34
autonomous_max_duration_ms := 2038723

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

autonomous_scope_forbidden if {
	input.changeClass == "autonomous_operation"
	some path in input.zonePaths
	some prefix in automation_blocked_prefixes
	path_matches_prefix(path, prefix)
}

autonomous_payload_invalid if {
	input.changeClass == "autonomous_operation"
	input.subjectType != "autonomous_process"
}

autonomous_payload_invalid if {
	input.changeClass == "autonomous_operation"
	object.get(input.autonomous, "schema", "") != "heady.autonomous.approval.v1"
}

autonomous_payload_invalid if {
	input.changeClass == "autonomous_operation"
	not object.get(input.autonomous, "capability", "") in autonomous_capabilities
}

autonomous_payload_invalid if {
	input.changeClass == "autonomous_operation"
	object.get(input.autonomous, "riskTier", "") != "low"
}

autonomous_payload_invalid if {
	input.changeClass == "autonomous_operation"
	object.get(input.autonomous, "reversible", false) != true
}

autonomous_payload_invalid if {
	input.changeClass == "autonomous_operation"
	object.get(input.autonomous, "dryRunVerified", false) != true
}

autonomous_payload_invalid if {
	input.changeClass == "autonomous_operation"
	object.get(input.autonomous, "requesterPrincipalId", "") != input.creatorPrincipalId
}

autonomous_payload_invalid if {
	input.changeClass == "autonomous_operation"
	object.get(input.autonomous, "requesterWorkloadIdentity", "") == ""
}

autonomous_payload_invalid if {
	input.changeClass == "autonomous_operation"
	not regex.match("^[a-f0-9]{64}$", object.get(input.autonomous, "subjectSha256", ""))
}

autonomous_payload_invalid if {
	input.changeClass == "autonomous_operation"
	not regex.match("^[a-f0-9]{64}$", object.get(input.autonomous, "rollbackPlanSha256", ""))
}

autonomous_payload_invalid if {
	input.changeClass == "autonomous_operation"
	not object.get(input.autonomous, "networkAccess", "") in {"none", "allowlisted"}
}

autonomous_payload_invalid if {
	input.changeClass == "autonomous_operation"
	not is_array(object.get(input.autonomous, "resourceScopes", null))
}

autonomous_payload_invalid if {
	input.changeClass == "autonomous_operation"
	count(object.get(input.autonomous, "resourceScopes", [])) == 0
}

autonomous_payload_invalid if {
	input.changeClass == "autonomous_operation"
	value := object.get(input.autonomous, "maxAffectedResources", 0)
	not is_number(value)
}

autonomous_payload_invalid if {
	input.changeClass == "autonomous_operation"
	value := object.get(input.autonomous, "maxAffectedResources", 0)
	is_number(value)
	value <= 0
}

autonomous_payload_invalid if {
	input.changeClass == "autonomous_operation"
	value := object.get(input.autonomous, "maxAffectedResources", 0)
	is_number(value)
	value != round(value)
}

autonomous_payload_invalid if {
	input.changeClass == "autonomous_operation"
	value := object.get(input.autonomous, "maxAffectedResources", 0)
	is_number(value)
	value > autonomous_max_affected_resources
}

autonomous_payload_invalid if {
	input.changeClass == "autonomous_operation"
	value := object.get(input.autonomous, "maxAffectedResources", 0)
	is_number(value)
	count(object.get(input.autonomous, "resourceScopes", [])) > value
}

autonomous_payload_invalid if {
	input.changeClass == "autonomous_operation"
	value := object.get(input.autonomous, "maxDurationMs", 0)
	not is_number(value)
}

autonomous_payload_invalid if {
	input.changeClass == "autonomous_operation"
	value := object.get(input.autonomous, "maxDurationMs", 0)
	is_number(value)
	value <= 0
}

autonomous_payload_invalid if {
	input.changeClass == "autonomous_operation"
	value := object.get(input.autonomous, "maxDurationMs", 0)
	is_number(value)
	value != round(value)
}

autonomous_payload_invalid if {
	input.changeClass == "autonomous_operation"
	value := object.get(input.autonomous, "maxDurationMs", 0)
	is_number(value)
	value > autonomous_max_duration_ms
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

slot_matches("automation_attestation", evidence) if {
	evidence.evidenceClass == "automation_attestation"
	evidence.principalType == "service"
	evidence.principalRole == "automation_guard"
	evidence.principalId != input.creatorPrincipalId
	evidence.verdict == "ALLOW"
	not autonomous_scope_forbidden
	not autonomous_payload_invalid
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

denial_reasons contains "autonomous_scope_forbidden" if {
	autonomous_scope_forbidden
}

denial_reasons contains "autonomous_payload_invalid" if {
	autonomous_payload_invalid
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
