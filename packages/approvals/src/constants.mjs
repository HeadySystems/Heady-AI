// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval Constants v1.0.0                                ║
// ║  Typed states, evidence classes, and φ-derived security windows. ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { FIB, PHI } from "@heady/phi-math";

export const APPROVAL_STATES = Object.freeze([
  "draft",
  "pending",
  "approved",
  "rejected",
  "expired",
  "superseded",
]);

export const PRINCIPAL_TYPES = Object.freeze(["human", "service", "external_reviewer"]);

export const EVIDENCE_CLASSES = Object.freeze([
  "founder_decision",
  "arbiter_attestation",
  "external_human_review",
  "external_security_review",
  "renovate_attestation",
  "automation_attestation",
]);

export const CHANGE_CLASSES = Object.freeze([
  "standard_sensitive",
  "patent_locked",
  "approval_system",
  "renovate_patch",
  "autonomous_operation",
]);

export const SUBJECT_TYPES = Object.freeze([
  "change",
  "deployment",
  "policy",
  "approval_system",
  "dependency_update",
  "autonomous_process",
]);

export const CREATE_APPROVAL_SUBJECT_TYPES = Object.freeze(
  SUBJECT_TYPES.filter((subjectType) => subjectType !== "autonomous_process"),
);

export const AUTONOMOUS_CAPABILITIES = Object.freeze([
  "source_authorship",
  "build_attestation",
  "maintenance_execution",
]);

export const DECISIONS = Object.freeze(["approve", "reject"]);
export const ATTESTATION_VERDICTS = Object.freeze(["ALLOW", "BLOCK", "ESCALATE"]);

// Unit conversions are physical definitions, not tunable runtime constants.
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const MILLISECONDS_PER_SECOND = 1_000;
export const HOUR_MS = SECONDS_PER_MINUTE * MINUTES_PER_HOUR * MILLISECONDS_PER_SECOND;

// φ × 10 hours, where 10 = fib(5) × fib(3).
export const APPROVAL_LIFETIME_MS = Math.round(PHI * FIB[5] * FIB[3] * HOUR_MS);

// Short-lived machine grants: φ × 21 minutes.
export const AUTONOMOUS_APPROVAL_LIFETIME_MS = Math.round(
  PHI * FIB[8] * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND,
);
export const AUTONOMOUS_MAX_AFFECTED_RESOURCES = FIB[8];
export const AUTONOMOUS_MAX_DURATION_MS = AUTONOMOUS_APPROVAL_LIFETIME_MS;

// A signed human/service evidence challenge may be at most φ × 5 minutes ahead.
export const EVIDENCE_CEREMONY_MAX_MS = Math.round(
  PHI * FIB[5] * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND,
);

export const POLICY_VERSION = "heady.approval.v2";
export const OPA_COMPILER_VERSION = "1.18.2";
export const OPA_ENTRYPOINT = "heady/approval/decision";
export const RECEIPT_SCHEMA = "heady.approval.receipt.v1";
export const EVIDENCE_SCHEMA = "heady.approval.evidence.v1";
export const EVENT_SCHEMA = "heady.approval.event.v1";

export const SHA256_RE = /^[a-f0-9]{64}$/;
export const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

const APPROVAL_SYSTEM_PREFIXES = Object.freeze([
  "packages/approvals/",
  "apps/approval-api/",
  "packages/db/migrations/0004_approval_control_plane.sql",
  "packages/db/migrations/0007_autonomous_approval_grants.sql",
  "policies/approval.rego",
  "docs/adr/0031-solo-founder-approval-bootstrap.md",
  "docs/design/APPROVAL_SERVICE_BOOTSTRAP_SPEC.md",
  "docs/design/AUTONOMOUS_APPROVAL_SIGNING.md",
  "configs/stage0-untouchables.json",
  ".github/CODEOWNERS",
]);

const AUTONOMOUS_BLOCKED_PREFIXES = Object.freeze([
  ".github/",
  "apps/approval-api/",
  "auth/",
  "cloudbuild.yaml",
  "configs/stage0-untouchables.json",
  "deploy/",
  "docs/adr/0031-solo-founder-approval-bootstrap.md",
  "docs/design/APPROVAL_SERVICE_BOOTSTRAP_SPEC.md",
  "infra/",
  "packages/approvals/",
  "packages/auth/",
  "packages/db/migrations/",
  "packages/secrets/",
  "packages/security-mesh/",
  "policies/",
  "signer/",
]);

const PATENT_ZONE_PREFIXES = Object.freeze([
  "packages/bees/",
  "packages/csl-engine/",
  "packages/security-mesh/",
  "packages/memory-stream/",
  "packages/auto-context/",
  "patent-locked/",
]);

export function normalizeZonePath(value) {
  return String(value ?? "").replace(/^\.?\//, "");
}

function matchesProtectedPath(path, protectedPath) {
  if (!protectedPath.endsWith("/")) return path === protectedPath;
  return path === protectedPath.slice(0, -1) || path.startsWith(protectedPath);
}

export function isApprovalSystemPath(value) {
  const path = normalizeZonePath(value);
  return APPROVAL_SYSTEM_PREFIXES.some((prefix) => matchesProtectedPath(path, prefix));
}

export function isPatentZonePath(value) {
  const path = normalizeZonePath(value);
  return PATENT_ZONE_PREFIXES.some((prefix) => matchesProtectedPath(path, prefix));
}

export function isAutonomousBlockedPath(value) {
  const path = normalizeZonePath(value);
  return (
    isApprovalSystemPath(path)
    || isPatentZonePath(path)
    || AUTONOMOUS_BLOCKED_PREFIXES.some((prefix) => matchesProtectedPath(path, prefix))
  );
}

export function classifyChange({ subjectType, patentLocked, zonePaths, renovatePatchOnly = false }) {
  const paths = zonePaths.map(normalizeZonePath);
  if (subjectType === "approval_system" || paths.some(isApprovalSystemPath)) return "approval_system";
  if (patentLocked || paths.some(isPatentZonePath)) return "patent_locked";
  if (subjectType === "autonomous_process") return "autonomous_operation";
  if (subjectType === "dependency_update" && renovatePatchOnly) return "renovate_patch";
  return "standard_sensitive";
}

export function requiredEvidenceFor(changeClass, { patentLocked = false } = {}) {
  const requirements = {
    standard_sensitive: ["founder_decision"],
    patent_locked: ["founder_decision", "arbiter_attestation"],
    approval_system: ["founder_decision", "external_security_review"],
    renovate_patch: ["renovate_attestation"],
    autonomous_operation: ["automation_attestation"],
  };
  const value = requirements[changeClass];
  if (!value) throw new TypeError(`unknown change class: ${changeClass}`);
  if (changeClass === "approval_system" && patentLocked) {
    return Object.freeze([...value, "arbiter_attestation"]);
  }
  return Object.freeze([...value]);
}
