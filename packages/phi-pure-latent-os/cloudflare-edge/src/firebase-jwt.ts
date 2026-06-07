// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: packages/phi-pure-latent-os/cloudflare-edge/src/firebase-jwt.ts                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Heady φ-Pure Latent OS — Firebase JWT Verification at Edge
 *
 * Verifies Firebase Auth RS256 ID tokens using the Web Crypto API.
 * No Node.js dependencies — runs natively in the Cloudflare Workers runtime.
 *
 * Pipeline:
 *  1. Decode JWT header to get `kid` (key ID)
 *  2. Fetch Google's public X.509 certs (cached in KV with 1 h TTL)
 *  3. Convert PEM → CryptoKey via Web Crypto importKey (RSASSA-PKCS1-v1_5 / SHA-256)
 *  4. Verify RS256 signature
 *  5. Validate standard claims: iss, aud, exp, iat, sub, auth_time
 *
 * Google public key endpoint:
 *  https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com
 *
 * @module cloudflare-edge/firebase-jwt
 */

import { PHI, PSI, FIB, CSL } from '../../shared/phi-math';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Google's Firebase public key endpoint */
const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

/** Firebase token issuer prefix */
const FIREBASE_ISSUER_PREFIX = 'https://securetoken.google.com/';

/** KV cache key for Google public certs */
const KV_CERTS_KEY = 'firebase:public-certs';

/**
 * Cache TTL for public certs: 1 hour in seconds.
 * FIB[11] = 144; 144 × 25 = 3600 s exactly.
 */
const CERTS_CACHE_TTL_SECONDS = FIB[11] * 25; // 3600

/**
 * Clock skew tolerance: FIB[6] × 10 = 80 seconds.
 * Accommodates edge nodes with minor clock drift.
 */
const CLOCK_SKEW_SECONDS = FIB[6] * 10; // 80

/** Coherence threshold for accepted tokens (must be ≥ CSL.MEDIUM) */
const MIN_COHERENCE = CSL.MEDIUM; // 0.809

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parsed Firebase ID token payload */
export interface FirebasePayload {
  /** JWT subject — Firebase UID */
  sub: string;
  /** Token issuer */
  iss: string;
  /** Audience (Firebase project ID) */
  aud: string;
  /** Issued-at timestamp (Unix epoch, seconds) */
  iat: number;
  /** Expiry timestamp (Unix epoch, seconds) */
  exp: number;
  /** Authentication time (Unix epoch, seconds) */
  auth_time: number;
  /** Firebase UID (duplicate of sub) */
  user_id?: string;
  /** Email if available */
  email?: string;
  /** Email verification status */
  email_verified?: boolean;
  /** Phone number if available */
  phone_number?: string;
  /** Firebase-specific claims */
  firebase?: {
    identities?: Record<string, string[]>;
    sign_in_provider?: string;
  };
  /** Custom claims from Firebase Admin SDK */
  [key: string]: unknown;
}

/** Internal cache entry stored in KV */
interface CertsCacheEntry {
  certs: Record<string, string>;
  fetchedAt: number;
}

// ---------------------------------------------------------------------------
// Base64url utilities (Web Crypto / Cloudflare Workers compatible)
// ---------------------------------------------------------------------------

function base64urlDecode(str: string): Uint8Array {
  // Pad to multiple of 4
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (padded.length % 4)) % 4;
  const base64 = padded + '='.repeat(padding);
  const binary  = atob(base64);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function base64urlDecodeToString(str: string): string {
  const bytes = base64urlDecode(str);
  return new TextDecoder().decode(bytes);
}

// ---------------------------------------------------------------------------
// PEM → CryptoKey conversion
// ---------------------------------------------------------------------------

/**
 * Strips PEM headers/footers and decodes the DER bytes of an X.509 certificate,
 * then extracts the RSA public key via SubtleCrypto.importKey.
 *
 * Cloudflare Workers support `importKey` with format "spki" but X.509 certs
 * wrap the SPKI in a certificate structure. We use the `"raw"` SubjectPublicKeyInfo
 * approach: parse the cert bytes to extract the BIT-STRING-wrapped SPKI.
 *
 * Because the Workers runtime only exposes `SubtleCrypto`, we rely on importing
 * the full X.509 DER via the non-standard but widely-supported
 * `"pkcs8"` workaround. Instead, we use `importKey` with format `"spki"` after
 * extracting the SubjectPublicKeyInfo from the certificate DER.
 */
async function pemCertToPublicKey(pem: string): Promise<CryptoKey> {
  // Strip PEM headers
  const base64Der = pem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '');

  const derBytes = Uint8Array.from(atob(base64Der), c => c.charCodeAt(0));

  // Extract the SubjectPublicKeyInfo (SPKI) from the X.509 DER-encoded certificate.
  // X.509 structure (simplified ASN.1):
  //   SEQUENCE {              <- Certificate
  //     SEQUENCE {            <- TBSCertificate
  //       [0] { INTEGER }     <- version
  //       INTEGER             <- serialNumber
  //       SEQUENCE            <- signature AlgorithmIdentifier
  //       SEQUENCE            <- issuer
  //       SEQUENCE            <- validity
  //       SEQUENCE            <- subject
  //       SEQUENCE            <- subjectPublicKeyInfo  ← what we want
  //       ...
  //     }
  //     SEQUENCE              <- signatureAlgorithm
  //     BIT STRING            <- signature
  //   }
  //
  // We walk the DER to find the subjectPublicKeyInfo offset.

  const spkiBytes = extractSpkiFromCertDer(derBytes);

  return crypto.subtle.importKey(
    'spki',
    spkiBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

/**
 * Minimal ASN.1 DER parser to extract the SubjectPublicKeyInfo from an X.509 cert.
 * Walks the outer SEQUENCE (Certificate) → inner SEQUENCE (TBSCertificate) →
 * skips version, serialNumber, signature AlgId, issuer, validity, subject →
 * returns the next SEQUENCE (subjectPublicKeyInfo).
 */
function extractSpkiFromCertDer(der: Uint8Array): Uint8Array {
  let offset = 0;

  // Parse a DER TLV and return { tag, length, valueOffset }
  function parseTLV(off: number): { tag: number; length: number; valueOffset: number } {
    const tag = der[off++];
    let len = der[off++];
    if (len & 0x80) {
      const numBytes = len & 0x7f;
      len = 0;
      for (let i = 0; i < numBytes; i++) {
        len = (len << 8) | der[off++];
      }
    }
    return { tag, length: len, valueOffset: off };
  }

  // Skip a TLV element, returning the offset after it
  function skipTLV(off: number): number {
    const { length, valueOffset } = parseTLV(off);
    return valueOffset + length;
  }

  // Enter a SEQUENCE (tag 0x30), returning offset of first child
  function enterSequence(off: number): number {
    const { tag, valueOffset } = parseTLV(off);
    if (tag !== 0x30) throw new Error(`Expected SEQUENCE (0x30), got 0x${tag.toString(16)}`);
    return valueOffset;
  }

  // Certificate outer SEQUENCE
  offset = enterSequence(0);

  // TBSCertificate SEQUENCE
  const tbsStart  = offset;
  const tbsInner  = enterSequence(tbsStart);
  offset = tbsInner;

  // [0] EXPLICIT version (optional, context tag 0xa0)
  if (der[offset] === 0xa0) {
    offset = skipTLV(offset);
  }

  // serialNumber INTEGER (tag 0x02)
  offset = skipTLV(offset);

  // signature AlgorithmIdentifier SEQUENCE
  offset = skipTLV(offset);

  // issuer Name SEQUENCE
  offset = skipTLV(offset);

  // validity SEQUENCE
  offset = skipTLV(offset);

  // subject Name SEQUENCE
  offset = skipTLV(offset);

  // subjectPublicKeyInfo SEQUENCE — this is what we need
  const { tag, length, valueOffset } = parseTLV(offset);
  if (tag !== 0x30) throw new Error(`Expected SPKI SEQUENCE, got 0x${tag.toString(16)}`);

  return der.slice(offset, valueOffset + length);
}

// ---------------------------------------------------------------------------
// Google public cert fetching with KV cache
// ---------------------------------------------------------------------------

/**
 * Fetches Google's Firebase RS256 public keys (X.509 PEM certs).
 * Keys are cached in KV for `CERTS_CACHE_TTL_SECONDS` (1 hour).
 * On cache miss or expiry, fetches fresh certs from Google.
 */
async function fetchGoogleCerts(kv: KVNamespace): Promise<Record<string, string>> {
  // 1. Try KV cache first
  const cached = await kv.get<CertsCacheEntry>(KV_CERTS_KEY, 'json');
  if (cached?.certs && Object.keys(cached.certs).length > 0) {
    const ageSeconds = (Date.now() - cached.fetchedAt) / 1000;
    if (ageSeconds < CERTS_CACHE_TTL_SECONDS) {
      return cached.certs;
    }
  }

  // 2. Fetch from Google
  const response = await fetch(GOOGLE_CERTS_URL, {
    cf: {
      // Cloudflare edge cache: bypass so we control freshness via KV
      cacheEverything: false,
    } as RequestInitCfProperties,
  });

  if (!response.ok) {
    throw new JwtVerificationError(
      `Failed to fetch Google public certs: HTTP ${response.status}`,
      'CERTS_FETCH_FAILED'
    );
  }

  const certs: Record<string, string> = await response.json();

  if (!certs || typeof certs !== 'object' || Object.keys(certs).length === 0) {
    throw new JwtVerificationError('Google certs response was empty or malformed', 'CERTS_INVALID');
  }

  // Validate that each value looks like a PEM certificate
  for (const [kid, pem] of Object.entries(certs)) {
    if (typeof pem !== 'string' || !pem.includes('BEGIN CERTIFICATE')) {
      throw new JwtVerificationError(`Cert for kid ${kid} is not a valid PEM`, 'CERTS_INVALID');
    }
  }

  // 3. Store in KV with TTL
  const entry: CertsCacheEntry = { certs, fetchedAt: Date.now() };
  await kv.put(KV_CERTS_KEY, JSON.stringify(entry), {
    expirationTtl: CERTS_CACHE_TTL_SECONDS,
  });

  return certs;
}

// ---------------------------------------------------------------------------
// JWT claim validation
// ---------------------------------------------------------------------------

function validateClaims(
  payload: Record<string, unknown>,
  projectId: string
): void {
  const now = Math.floor(Date.now() / 1000);

  // iss: must be "https://securetoken.google.com/<projectId>"
  const expectedIss = `${FIREBASE_ISSUER_PREFIX}${projectId}`;
  if (payload.iss !== expectedIss) {
    throw new JwtVerificationError(
      `Invalid issuer: expected ${expectedIss}, got ${payload.iss}`,
      'INVALID_ISS'
    );
  }

  // aud: must match the Firebase project ID
  if (payload.aud !== projectId) {
    throw new JwtVerificationError(
      `Invalid audience: expected ${projectId}, got ${payload.aud}`,
      'INVALID_AUD'
    );
  }

  // exp: must be in the future (with clock skew tolerance)
  if (typeof payload.exp !== 'number' || payload.exp < now - CLOCK_SKEW_SECONDS) {
    throw new JwtVerificationError('Token has expired', 'TOKEN_EXPIRED');
  }

  // iat: must be in the past (with clock skew tolerance)
  if (typeof payload.iat !== 'number' || payload.iat > now + CLOCK_SKEW_SECONDS) {
    throw new JwtVerificationError('Token issued in the future (iat)', 'INVALID_IAT');
  }

  // auth_time: must be in the past (with clock skew tolerance)
  if (typeof payload.auth_time !== 'number' || payload.auth_time > now + CLOCK_SKEW_SECONDS) {
    throw new JwtVerificationError('auth_time is in the future', 'INVALID_AUTH_TIME');
  }

  // sub: must be present and non-empty
  if (typeof payload.sub !== 'string' || payload.sub.trim().length === 0) {
    throw new JwtVerificationError('Missing or empty sub claim', 'MISSING_SUB');
  }

  // sub must not be excessively long (Firebase UIDs are max 128 chars)
  if (payload.sub.length > 128) {
    throw new JwtVerificationError('sub claim exceeds maximum length', 'INVALID_SUB');
  }
}

// ---------------------------------------------------------------------------
// JWT verification error
// ---------------------------------------------------------------------------

export class JwtVerificationError extends Error {
  public readonly code: string;
  public readonly coherenceImpact: number;

  constructor(message: string, code: string) {
    super(message);
    this.name             = 'JwtVerificationError';
    this.code             = code;
    // Coherence impact: verification failure drops coherence by PSI^2 ≈ 0.382
    this.coherenceImpact  = PSI * PSI;
  }
}

// ---------------------------------------------------------------------------
// Main verification function
// ---------------------------------------------------------------------------

/**
 * Verifies a Firebase RS256 ID token at the Cloudflare edge.
 *
 * @param token       Raw JWT string from Authorization: Bearer header
 * @param projectId   Firebase project ID (from env.FIREBASE_PROJECT_ID)
 * @param kv          HEADY_CACHE KV namespace for public key caching
 * @returns           Verified and decoded FirebasePayload
 * @throws            JwtVerificationError on any verification failure
 */
export async function verifyFirebaseJwt(
  token: string,
  projectId: string,
  kv: KVNamespace
): Promise<FirebasePayload> {
  // ------------------------------------------------------------------
  // 1. Split the JWT into parts
  // ------------------------------------------------------------------
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new JwtVerificationError('Malformed JWT: expected 3 parts', 'MALFORMED_JWT');
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // ------------------------------------------------------------------
  // 2. Decode header to extract kid and alg
  // ------------------------------------------------------------------
  let header: Record<string, unknown>;
  try {
    header = JSON.parse(base64urlDecodeToString(headerB64));
  } catch {
    throw new JwtVerificationError('Failed to decode JWT header', 'MALFORMED_HEADER');
  }

  if (header.alg !== 'RS256') {
    throw new JwtVerificationError(
      `Unsupported algorithm: expected RS256, got ${header.alg}`,
      'UNSUPPORTED_ALG'
    );
  }

  const kid = header.kid;
  if (typeof kid !== 'string' || kid.length === 0) {
    throw new JwtVerificationError('JWT header missing kid', 'MISSING_KID');
  }

  // ------------------------------------------------------------------
  // 3. Decode payload
  // ------------------------------------------------------------------
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(base64urlDecodeToString(payloadB64));
  } catch {
    throw new JwtVerificationError('Failed to decode JWT payload', 'MALFORMED_PAYLOAD');
  }

  // ------------------------------------------------------------------
  // 4. Validate claims BEFORE signature verification
  //    (avoids expensive crypto on obviously invalid tokens)
  // ------------------------------------------------------------------
  validateClaims(payload, projectId);

  // ------------------------------------------------------------------
  // 5. Fetch Google public certs (KV-cached)
  // ------------------------------------------------------------------
  const certs = await fetchGoogleCerts(kv);

  const pemCert = certs[kid];
  if (!pemCert) {
    throw new JwtVerificationError(
      `No public key found for kid: ${kid}. Available kids: ${Object.keys(certs).join(', ')}`,
      'UNKNOWN_KID'
    );
  }

  // ------------------------------------------------------------------
  // 6. Import public key via Web Crypto API
  // ------------------------------------------------------------------
  let publicKey: CryptoKey;
  try {
    publicKey = await pemCertToPublicKey(pemCert);
  } catch (err) {
    throw new JwtVerificationError(
      `Failed to import public key for kid ${kid}: ${String(err)}`,
      'KEY_IMPORT_FAILED'
    );
  }

  // ------------------------------------------------------------------
  // 7. Verify RS256 signature using Web Crypto subtleCrypto.verify
  //    Message = ASCII(headerB64 + "." + payloadB64)
  //    Signature = base64url-decoded signatureB64
  // ------------------------------------------------------------------
  const message   = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64urlDecode(signatureB64);

  let valid: boolean;
  try {
    valid = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      publicKey,
      signature,
      message
    );
  } catch (err) {
    throw new JwtVerificationError(
      `Signature verification threw: ${String(err)}`,
      'SIGNATURE_ERROR'
    );
  }

  if (!valid) {
    throw new JwtVerificationError('JWT signature is invalid', 'INVALID_SIGNATURE');
  }

  // ------------------------------------------------------------------
  // 8. Coherence gate — token must pass minimum semantic coherence
  //    We compute a simple coherence proxy: 1 - (ageRatio * PSI)
  //    where ageRatio = (now - iat) / (exp - iat)
  // ------------------------------------------------------------------
  const now        = Math.floor(Date.now() / 1000);
  const iat        = payload.iat as number;
  const exp        = payload.exp as number;
  const lifetime   = exp - iat;
  const age        = now - iat;
  const ageRatio   = lifetime > 0 ? Math.min(age / lifetime, 1) : 1;
  const coherence  = 1 - ageRatio * PSI; // Fresh tokens near 1.0, expiring tokens near 0.382

  if (coherence < MIN_COHERENCE) {
    // Token is within its validity window but very close to expiry
    // — issue a soft warning rather than rejection (exp check already enforced above)
    console.warn(JSON.stringify({
      level:   'WARN',
      service: 'firebase-jwt',
      message: 'Token coherence below medium threshold — consider refresh',
      coherence,
      threshold: MIN_COHERENCE,
      sub:     payload.sub,
    }));
  }

  // ------------------------------------------------------------------
  // 9. Return verified payload typed as FirebasePayload
  // ------------------------------------------------------------------
  return payload as unknown as FirebasePayload;
}

/**
 * Attempts JWT verification and returns null on any failure.
 * Useful for optional auth paths where you don't want to throw.
 */
export async function tryVerifyFirebaseJwt(
  token: string,
  projectId: string,
  kv: KVNamespace
): Promise<FirebasePayload | null> {
  try {
    return await verifyFirebaseJwt(token, projectId, kv);
  } catch {
    return null;
  }
}
