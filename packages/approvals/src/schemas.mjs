// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval Boundary Schemas v1.0.0                         ║
// ║  Strict Zod validation for every approval API input.             ║
// ║  Made with ❤️ by HeadySystems Inc.                               ║
// ╚══════════════════════════════════════════════════════════════════╝

import { z } from "zod";
import {
  AUTONOMOUS_CAPABILITIES,
  AUTONOMOUS_MAX_AFFECTED_RESOURCES,
  AUTONOMOUS_MAX_DURATION_MS,
  ATTESTATION_VERDICTS,
  CREATE_APPROVAL_SUBJECT_TYPES,
  DECISIONS,
  SHA256_RE,
  ULID_RE,
} from "./constants.mjs";

const MAX_TITLE = 233;
const MAX_REASON = 1_597;
const MAX_PATHS = 144;
const MAX_CLAIMS = 89;
const MAX_PATH_LENGTH = 610;
const PATENT_CLAIM_RE = /^HS-\d{4}-\d{3}$/;

export const Sha256Schema = z.string().regex(SHA256_RE);
export const OciDigestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
export const UlidSchema = z.string().regex(ULID_RE);
export const IsoTimestampSchema = z.string().datetime({ offset: true });
export const NonceSchema = z.string().min(21).max(233).regex(/^[A-Za-z0-9_-]+$/);
export const SignatureSchema = z.string().min(64).max(610).regex(/^[A-Za-z0-9_-]+$/);

export const EvidenceEnvelopeSchema = z.object({
  schema: z.literal("heady.approval.evidence.v1"),
  approvalId: UlidSchema,
  action: z.string().min(1).max(MAX_PATH_LENGTH),
  payloadSha256: Sha256Schema,
  diffSha256: Sha256Schema,
  policySha256: Sha256Schema,
  nonce: NonceSchema,
  evidenceExpiresAt: IsoTimestampSchema,
  detail: z.record(z.unknown()),
}).strict();

const ZonePathSchema = z.string()
  .min(1)
  .max(MAX_PATH_LENGTH)
  .refine((value) => (
    !value.startsWith("/")
    && !value.startsWith("./")
    && !value.includes("..")
    && !value.includes("\\")
    && !value.includes("//")
  ), {
    message: "zone path must be a normalized repository path",
  });

export const CreateApprovalSchema = z.object({
  hcpIdentifier: z.string().regex(/^HCP-\d{4}$/),
  title: z.string().min(1).max(MAX_TITLE),
  subjectType: z.enum(CREATE_APPROVAL_SUBJECT_TYPES),
  patentLocked: z.boolean().default(false),
  zonePaths: z.array(ZonePathSchema).min(1).max(MAX_PATHS),
  payload: z.record(z.unknown()),
  payloadSha256: Sha256Schema.optional(),
  diffSha256: Sha256Schema,
  artifactDigest: OciDigestSchema.optional(),
  renovatePatchOnly: z.boolean().default(false),
}).strict().superRefine((value, context) => {
  if (value.subjectType === "deployment" && !value.artifactDigest) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["artifactDigest"],
      message: "deployment approvals require an immutable OCI image digest",
    });
  }
});

const ResourceScopeSchema = z.string()
  .min(1)
  .max(MAX_PATH_LENGTH)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/@-]*$/)
  .refine((value) => !value.includes("//") && !value.includes(".."), {
    message: "resource scope must be a normalized non-URL identifier",
  });

export const AutonomousApprovalRequestSchema = z.object({
  hcpIdentifier: z.string().regex(/^HCP-\d{4}$/),
  title: z.string().min(1).max(MAX_TITLE),
  capability: z.enum(AUTONOMOUS_CAPABILITIES),
  zonePaths: z.array(ZonePathSchema).min(1).max(MAX_PATHS),
  resourceScopes: z.array(ResourceScopeSchema).min(1).max(AUTONOMOUS_MAX_AFFECTED_RESOURCES),
  subjectSha256: Sha256Schema,
  diffSha256: Sha256Schema,
  rollbackPlanSha256: Sha256Schema,
  riskTier: z.literal("low"),
  reversible: z.literal(true),
  dryRunVerified: z.literal(true),
  networkAccess: z.enum(["none", "allowlisted"]),
  maxAffectedResources: z.number().int().min(1).max(AUTONOMOUS_MAX_AFFECTED_RESOURCES),
  maxDurationMs: z.number().int().min(1).max(AUTONOMOUS_MAX_DURATION_MS),
}).strict().superRefine((value, context) => {
  if (value.resourceScopes.length > value.maxAffectedResources) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["maxAffectedResources"],
      message: "declared resource scopes cannot exceed max affected resources",
    });
  }
});

export const AutonomousProtectionSchema = z.object({
  approvalId: UlidSchema,
  capability: z.enum(AUTONOMOUS_CAPABILITIES),
  subjectSha256: Sha256Schema,
  payloadSha256: Sha256Schema,
  diffSha256: Sha256Schema,
  policySha256: Sha256Schema,
  executionNonce: NonceSchema,
}).strict();

export const AutonomousGrantSchema = z.object({
  schema: z.literal("heady.autonomous.grant.v1"),
  capability: z.enum(AUTONOMOUS_CAPABILITIES),
  subjectSha256: Sha256Schema,
  payloadSha256: Sha256Schema,
  diffSha256: Sha256Schema,
  policySha256: Sha256Schema,
  operationSha256: Sha256Schema,
  executionNonce: NonceSchema,
  expiresAt: IsoTimestampSchema,
  authorizationEvent: z.record(z.unknown()),
  authorizationReceipt: z.object({
    receiptId: UlidSchema,
    eventId: z.string().uuid(),
    payload: z.record(z.unknown()),
    payloadSha256: Sha256Schema,
    signingKeyId: z.string().min(1).max(MAX_PATH_LENGTH),
    algorithm: z.literal("EC_SIGN_ED25519"),
    signature: SignatureSchema,
    publicJwk: z.record(z.unknown()),
    publicJwkVersion: z.string().min(1).max(MAX_PATH_LENGTH),
    signatureVerified: z.boolean(),
    issuedAt: IsoTimestampSchema,
  }).strict(),
}).strict();

export const SubmitApprovalSchema = z.object({
  reason: z.string().min(1).max(MAX_REASON),
}).strict();

export const DecisionEvidenceSchema = z.object({
  decision: z.enum(DECISIONS),
  reason: z.string().min(1).max(MAX_REASON),
  nonce: NonceSchema,
  evidenceExpiresAt: IsoTimestampSchema,
  signature: SignatureSchema,
  resolvesEscalation: z.boolean().default(false),
}).strict();

export const AttestationEvidenceSchema = z.object({
  verdict: z.enum(ATTESTATION_VERDICTS),
  patentClaims: z.array(z.string().regex(PATENT_CLAIM_RE)).max(MAX_CLAIMS),
  reviewedPaths: z.array(ZonePathSchema).min(1).max(MAX_PATHS),
  rationaleSha256: Sha256Schema,
  nonce: NonceSchema,
  evidenceExpiresAt: IsoTimestampSchema,
  signature: SignatureSchema,
}).strict();

export const SupersedeApprovalSchema = z.object({
  replacementApprovalId: UlidSchema,
  reason: z.string().min(1).max(MAX_REASON),
  nonce: NonceSchema,
  evidenceExpiresAt: IsoTimestampSchema,
  signature: SignatureSchema,
}).strict();

export const VerifyApprovalSchema = z.object({
  reason: z.string().min(1).max(MAX_REASON).optional(),
}).strict();

export const DeploymentProtectionSchema = z.object({
  approvalId: UlidSchema,
  diffSha256: Sha256Schema,
  artifactDigest: OciDigestSchema,
  policySha256: Sha256Schema,
}).strict();

export const ActorSchema = z.object({
  authType: z.enum(["firebase", "workload_identity"]),
  subject: z.string().min(1).max(MAX_PATH_LENGTH),
  email: z.string().email().nullable().default(null),
  emailVerified: z.boolean().default(false),
}).strict();

export const IdempotencyKeySchema = z.string().min(13).max(233).regex(/^[A-Za-z0-9._:-]+$/);
export const TraceIdSchema = z.string().min(1).max(233);
