// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval Principal Verification v1.0.0                  ║
// ║  Server-derived identities and explicit Ed25519 evidence keys.  ║
// ║  Made with ❤️ by HeadySystems Inc.                              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { HeadyError, UnauthorizedError } from "@heady/shared";
import { ActorSchema } from "./schemas.mjs";
import { resolvePrincipal } from "./store.mjs";
import {
  publicJwkFingerprint,
  safeHashEqual,
  sha256,
  verifyEd25519,
} from "./canonical.mjs";
import { EVIDENCE_CEREMONY_MAX_MS } from "./constants.mjs";

export class ForbiddenError extends HeadyError {
  constructor(message, context) {
    super(message, { code: "FORBIDDEN", status: 403, context });
  }
}

export async function requirePrincipal(client, actorInput) {
  const actor = ActorSchema.parse(actorInput);
  if (actor.authType === "firebase" && (!actor.emailVerified || !actor.email)) {
    throw new UnauthorizedError("a verified Firebase email is required");
  }

  const principal = await resolvePrincipal(client, actor);
  if (!principal || !principal.active) {
    throw new UnauthorizedError("authenticated identity is not an active approval principal");
  }
  if (
    actor.authType === "firebase"
    && principal.verified_email.toLowerCase() !== actor.email.toLowerCase()
  ) {
    throw new UnauthorizedError("Firebase identity does not match the registered principal");
  }
  if (
    actor.authType === "workload_identity"
    && principal.principal_type !== "service"
  ) {
    throw new UnauthorizedError("workload identity is not registered as a service principal");
  }
  return { actor, principal };
}

export function actorSnapshot(principal, actor, {
  key = null,
  ceremonyVerified = false,
} = {}) {
  return {
    principalId: principal.id,
    stableIdentifier: principal.stable_identifier,
    principalType: principal.principal_type,
    principalRole: principal.principal_role,
    authenticatedBy: actor.authType,
    keyId: key?.id ?? null,
    keyFingerprint: key?.fingerprint ?? null,
    ceremonyVerified,
  };
}

export function assertEvidenceAllowed(principal, evidenceClass) {
  if (!principal.allowed_evidence_classes.includes(evidenceClass)) {
    throw new ForbiddenError("principal is not authorized for this evidence class", {
      evidenceClass,
      principalRole: principal.principal_role,
    });
  }
}

export function verifyPrincipalEvidence({
  principal,
  envelope,
  signature,
  now,
}) {
  const expiresAt = Date.parse(envelope.evidenceExpiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    throw new UnauthorizedError("evidence ceremony is expired");
  }
  if (expiresAt - now > EVIDENCE_CEREMONY_MAX_MS) {
    throw new UnauthorizedError("evidence ceremony expiry exceeds the allowed window");
  }
  const matches = principal.keys
    .filter((candidate) => (
      candidate.active
      && new Date(candidate.validFrom).getTime() <= now
    ))
    .filter((candidate) => safeHashEqual(
      candidate.fingerprint,
      publicJwkFingerprint(candidate.publicJwk),
    ))
    .filter((candidate) => verifyEd25519({
      publicJwk: candidate.publicJwk,
      payload: envelope,
      signature,
    }));
  if (matches.length !== 1) {
    throw new UnauthorizedError("evidence signature did not match exactly one active principal key");
  }
  const key = matches[0];
  return {
    key,
    verification: {
      envelope,
      envelopeSha256: sha256(envelope),
      keyFingerprint: publicJwkFingerprint(key.publicJwk),
    },
  };
}
