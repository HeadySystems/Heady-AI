// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval Evidence Envelope Builder v1.0.0                ║
// ║  Reconstructs the exact heady.approval.evidence.v1 envelope the  ║
// ║  approval API rebuilds server-side, so a human principal signs   ║
// ║  the same canonical bytes the service will verify. Holds no key  ║
// ║  material and performs no signing.                                ║
// ║  Made with ❤️ by HeadySystems Inc.                               ║
// ╚══════════════════════════════════════════════════════════════════╝

import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  base64UrlEncode,
  buildEvidenceEnvelope,
  canonicalize,
  DECISIONS,
  DecisionEvidenceSchema,
  EvidenceEnvelopeSchema,
  EVIDENCE_CEREMONY_MAX_MS,
  sha256,
} from "@heady/approvals";
import { FIB } from "@heady/phi-math";

// fib(8) = 21 raw bytes → 28 base64url characters, inside the schema's 21–233
// nonce window with headroom. Derived, not a tuned literal (AGENTS.md #7).
export const NONCE_BYTES = FIB[8];

// The service allows a ceremony to sit at most φ × 5 minutes in the future.
// The default is the full allowance; a caller may only narrow it.
export const DEFAULT_CEREMONY_TTL_MS = EVIDENCE_CEREMONY_MAX_MS;

/**
 * The subset of `GET /api/approvals/:approvalId` a decision ceremony binds.
 * Passthrough keeps the rest of the API view usable without re-declaring it.
 */
export const ApprovalStateSchema = z.object({
  approvalId: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),
  state: z.string().min(1),
  payloadSha256: z.string().regex(/^[a-f0-9]{64}$/),
  diffSha256: z.string().regex(/^[a-f0-9]{64}$/),
  policySha256: z.string().regex(/^[a-f0-9]{64}$/),
}).passthrough();

export const DecisionRequestSchema = z.object({
  decision: z.enum(DECISIONS),
  reason: z.string().min(1),
  resolvesEscalation: z.boolean().default(false),
  ttlMs: z.number().int().positive().max(EVIDENCE_CEREMONY_MAX_MS).default(DEFAULT_CEREMONY_TTL_MS),
  nonce: z.string().min(21).max(233).regex(/^[A-Za-z0-9_-]+$/).optional(),
  nowEpochMs: z.number().int().nonnegative().optional(),
}).strict();

export function freshNonce(bytes = NONCE_BYTES) {
  return base64UrlEncode(randomBytes(bytes));
}

/**
 * Build the founder/external-reviewer decision envelope.
 *
 * The `action` and `detail` shape mirror `decide()` in @heady/approvals
 * (`packages/approvals/src/service.mjs`) exactly. Any divergence produces a
 * signature the service will reject, which is the intended fail-closed
 * behaviour rather than a silently accepted mismatch.
 */
export function buildDecisionCeremony({ approvalState, request, evidenceClass }) {
  const approval = ApprovalStateSchema.parse(approvalState);
  const parsed = DecisionRequestSchema.parse(request);
  const parsedEvidenceClass = z.enum([
    "founder_decision",
    "external_human_review",
    "external_security_review",
  ]).parse(evidenceClass);

  if (approval.state !== "pending") {
    throw new TypeError(
      `approval ${approval.approvalId} is ${approval.state}; evidence may only be added while pending`,
    );
  }

  const nowEpochMs = parsed.nowEpochMs ?? Date.now();
  const nonce = parsed.nonce ?? freshNonce();
  const evidenceExpiresAt = new Date(nowEpochMs + parsed.ttlMs).toISOString();

  const detail = {
    evidenceClass: parsedEvidenceClass,
    decision: parsed.decision,
    reason: parsed.reason,
    resolvesEscalation: parsed.resolvesEscalation,
  };
  const envelope = EvidenceEnvelopeSchema.parse(buildEvidenceEnvelope({
    approvalId: approval.approvalId,
    action: parsed.decision,
    payloadSha256: approval.payloadSha256,
    diffSha256: approval.diffSha256,
    policySha256: approval.policySha256,
    nonce,
    evidenceExpiresAt,
    detail,
  }));

  // The decision request body, minus the detached signature the KMS ceremony
  // returns. `signature` is filled in by the human, never here. Validating it
  // against the service's own request schema now means a body the API would
  // reject fails BEFORE a ceremony is spent on it — and picks up any future
  // field limit without this tool having to mirror it.
  const decisionRequest = DecisionEvidenceSchema.omit({ signature: true }).parse({
    decision: parsed.decision,
    reason: parsed.reason,
    nonce,
    evidenceExpiresAt,
    resolvesEscalation: parsed.resolvesEscalation,
  });

  return {
    envelope,
    envelopeSha256: sha256(canonicalize(envelope)),
    decisionRequest,
  };
}
