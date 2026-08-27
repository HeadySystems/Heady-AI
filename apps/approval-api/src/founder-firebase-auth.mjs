// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Founder Firebase Authentication v1.0.0                 ║
// ║  Fresh password sign-in plus revoked-aware Admin verification. ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { z } from "zod";
import { EVIDENCE_CEREMONY_MAX_MS } from "@heady/approvals";
import { HEARTBEAT_MS } from "@heady/phi-math";

export const FOUNDER_FIREBASE_PROJECT_ID = "heady-ai";
export const FOUNDER_FIREBASE_EMAILS = Object.freeze([
  "eric@headyconnection.org",
  "eric@headysystems.com",
]);

const FounderEmailSchema = z.enum(FOUNDER_FIREBASE_EMAILS);
const SignInResponseSchema = z.object({
  localId: z.string().min(1),
  email: FounderEmailSchema,
  idToken: z.string().min(89),
  expiresIn: z.string().regex(/^[1-9]\d*$/),
  registered: z.boolean().optional(),
});
const FirebaseErrorSchema = z.object({
  error: z.object({
    message: z.string().min(1).max(233),
  }),
});

function requireFreshFounderClaims({
  decoded,
  expectedEmail,
  expectedUid,
  nowEpochMs,
}) {
  const authenticatedAtMs = Number(decoded.auth_time) * 1_000;
  const issuedAtMs = Number(decoded.iat) * 1_000;
  if (
    decoded.email !== expectedEmail
    || decoded.email_verified !== true
    || decoded.aud !== FOUNDER_FIREBASE_PROJECT_ID
    || decoded.iss !== `https://securetoken.google.com/${FOUNDER_FIREBASE_PROJECT_ID}`
    || typeof decoded.uid !== "string"
    || !decoded.uid
    || (expectedUid && decoded.uid !== expectedUid)
    || !Number.isFinite(authenticatedAtMs)
    || !Number.isFinite(issuedAtMs)
    || authenticatedAtMs > nowEpochMs
    || issuedAtMs > nowEpochMs
    || nowEpochMs - authenticatedAtMs > EVIDENCE_CEREMONY_MAX_MS
    || nowEpochMs - issuedAtMs > EVIDENCE_CEREMONY_MAX_MS
  ) {
    throw new TypeError("Firebase token is not a fresh, verified founder ceremony");
  }
  return Object.freeze({
    uid: decoded.uid,
    email: decoded.email,
    emailVerified: true,
    authenticatedAt: new Date(authenticatedAtMs).toISOString(),
    issuedAt: new Date(issuedAtMs).toISOString(),
  });
}

export async function verifyFounderIdToken({
  firebaseAuth,
  idToken,
  expectedEmail,
  expectedUid,
  now = () => Date.now(),
}) {
  if (!firebaseAuth || typeof firebaseAuth.verifyIdToken !== "function") {
    throw new TypeError("founder authentication requires a Firebase Admin verifier");
  }
  if (typeof idToken !== "string" || idToken.length < 89) {
    throw new TypeError("founder authentication requires a Firebase ID token");
  }
  const parsedEmail = FounderEmailSchema.parse(expectedEmail);
  const nowEpochMs = Number(now());
  if (!Number.isFinite(nowEpochMs)) {
    throw new TypeError("founder authentication clock is invalid");
  }
  const decoded = await firebaseAuth.verifyIdToken(idToken, true);
  return Object.freeze({
    ...requireFreshFounderClaims({
      decoded,
      expectedEmail: parsedEmail,
      expectedUid,
      nowEpochMs,
    }),
    idToken,
  });
}

export async function signInFounderWithPassword({
  firebaseAuth,
  apiKey,
  email,
  password,
  expectedUid,
  fetchFn = globalThis.fetch,
  now = () => Date.now(),
}) {
  const parsedEmail = FounderEmailSchema.parse(email);
  if (typeof apiKey !== "string" || apiKey.length < 21) {
    throw new TypeError("FIREBASE_WEB_API_KEY is required for founder sign-in");
  }
  if (typeof password !== "string" || password.length < 6) {
    throw new TypeError("founder Firebase password is required");
  }
  if (typeof fetchFn !== "function") throw new TypeError("a fetch implementation is required");

  const response = await fetchFn(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(HEARTBEAT_MS),
      body: JSON.stringify({
        email: parsedEmail,
        password,
        returnSecureToken: true,
      }),
    },
  );
  const body = await response.json();
  if (!response.ok) {
    const parsedError = FirebaseErrorSchema.safeParse(body);
    const code = parsedError.success
      ? parsedError.data.error.message.replace(/[^A-Z0-9_:-]/g, "")
      : "AUTHENTICATION_FAILED";
    throw new TypeError(`Firebase founder sign-in failed: ${code}`);
  }
  const signedIn = SignInResponseSchema.parse(body);
  if (
    signedIn.email !== parsedEmail
    || (signedIn.registered !== undefined && signedIn.registered !== true)
  ) {
    throw new TypeError("Firebase sign-in response does not match the founder identity");
  }
  const verified = await verifyFounderIdToken({
    firebaseAuth,
    idToken: signedIn.idToken,
    expectedEmail: parsedEmail,
    expectedUid,
    now,
  });
  if (verified.uid !== signedIn.localId) {
    throw new TypeError("Firebase sign-in UID differs from the verified ID token");
  }
  return verified;
}
