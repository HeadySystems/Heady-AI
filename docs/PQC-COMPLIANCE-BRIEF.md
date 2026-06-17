# Heady™ Post-Quantum Cryptography Compliance Brief
**Version:** 1.0 | **Date:** 2026-06-17 | **Author:** Eric Haywood  
**Governing ADR:** [ADR-0021](ADR/0021-post-quantum-cryptography-mandate.md)  
**Enforcement:** `scripts/pqc-scanner.js` + `adr-sentinel.yml` pqc-scan / pqc-gate jobs

---

## 1. The Threat: Harvest Now, Decrypt Later

A cryptographically relevant quantum computer (CRQC) running Shor's algorithm breaks
RSA, ECDSA, ECDH, and all elliptic-curve key exchange in polynomial time — rendering
every ciphertext encrypted with those algorithms retroactively readable.

The practical attack is already underway: nation-state adversaries are collecting
encrypted traffic today with the intent to decrypt it once a CRQC is available. NIST
estimates a capable CRQC within the 2030–2035 window. Any Heady user data, agent
keypair, or service credential encrypted with classical asymmetric crypto is at risk
from the moment it was captured, not the moment a CRQC arrives.

---

## 2. NIST Standards Adopted (FIPS 203/204/205)

NIST finalised the first post-quantum standards in August 2024:

| Standard | Algorithm | Former Name | Role |
|----------|-----------|-------------|------|
| **FIPS 203** | **ML-KEM** | CRYSTALS-Kyber | Key encapsulation mechanism (replaces ECDH/RSA-KEM) |
| **FIPS 204** | **ML-DSA** | CRYSTALS-Dilithium | Digital signatures (replaces ECDSA/RSA-PSS) |
| **FIPS 205** | **SLH-DSA** | SPHINCS+ | Hash-based signatures (long-lived certificates only) |

The Heady codebase (`src/security/pqc.js`) already implements the underlying algorithms
under the pre-standardisation names. **ADR-0021 and the PQC scanner enforce alignment
to the final FIPS designations going forward.**

---

## 3. How the PQC Scanner Maps to ML-DSA / ML-KEM

### 3.1 Scanner → ML-KEM coverage

ML-KEM (FIPS 203) replaces all classical key encapsulation and key exchange.
The scanner detects every pathway that would route key material through classical algorithms:

| Rule | Pattern Detected | Violation | ML-KEM Replacement |
|------|-----------------|-----------|-------------------|
| PQC-C002 | `createECDH()` | ECDH key exchange | `hybridKEM.encapsulate()` — X25519 + ML-KEM-768 composite |
| PQC-C001 | `createDiffieHellman()` | Classical DH | `hybridKEM.encapsulate()` |
| PQC-H001 | `CRYSTALS-Kyber` / `Kyber768` in strings | Pre-NIST name | Rename to `ML-KEM-768` (FIPS 203) |
| PQC-H004 | `hybridMode: false` | Hybrid disabled | Set `hybridMode: true` in `PQC_CONFIG` |

The scanner operates in PR-diff mode by default — it only evaluates files changed in
the current PR, ensuring the check is fast (seconds, not minutes) while catching every
new classical KEM operation before it reaches `main`.

### 3.2 Scanner → ML-DSA coverage

ML-DSA (FIPS 204) replaces all classical digital signature operations.
The scanner detects every signature pathway that bypasses the hybrid PQC layer:

| Rule | Pattern Detected | Violation | ML-DSA Replacement |
|------|-----------------|-----------|-------------------|
| PQC-C003 | `createSign('RSA-SHA256')` / `algorithm: 'RS256'` | RSA signature | `hybridSign.sign()` — Ed25519 + ML-DSA-65 composite |
| PQC-C004 | `generateKeyPair('rsa')` | RSA key generation | `headyPQC.generateHybridKeyPair()` |
| PQC-C005 | `generateKeyPair('ec')` | EC key generation | `headyPQC.generateHybridKeyPair()` |
| PQC-C006 | `algorithm: 'ES256'` / `'ES384'` / `'ES512'` | ECDSA JWT | HMAC-SHA256 (symmetric) or ML-DSA composite JWT |
| PQC-C007 | `algorithm: 'RS256'` / `'RS384'` / `'RS512'` | RSA JWT | HMAC-SHA256 |
| PQC-H002 | `CRYSTALS-Dilithium` / `Dilithium3` in strings | Pre-NIST name | Rename to `ML-DSA-65` (FIPS 204) |

### 3.3 Hybrid mode is the invariant

The scanner's deepest check is `PQC-H004: hybridMode: false`. The hybrid requirement
is the architectural invariant that makes the entire PQC posture defensible:

```
hybridMode = true  →  BOTH classical AND PQC operations run
                       If ML-KEM/ML-DSA has a flaw → classical layer still protects
                       If CRQC breaks classical     → PQC layer still protects
```

A system that only checks whether PQC is *present* misses the subtler failure mode
where PQC is present but classical is still the *only* active layer.

---

## 4. Current Codebase Findings (Baseline Scan)

`src/security/pqc.js` and `src/routes/pqc.js` contain known HIGH findings that
represent the migration already in progress — not net-new violations:

| File | Rule | Finding | Migration Status |
|------|------|---------|-----------------|
| `src/security/pqc.js` | PQC-H001 | `CRYSTALS-Kyber` / `Kyber768` | **Phase 2 — rename to ML-KEM-768** |
| `src/security/pqc.js` | PQC-H002 | `CRYSTALS-Dilithium` / `Dilithium3` | **Phase 2 — rename to ML-DSA-65** |
| `src/routes/pqc.js` | — | Uses `require()` (CJS) | **ADR-0011 — migrate to ESM** |
| `packages/security-mesh/src/index.mjs` | PQC-I003 | `Ed25519` reference (hybrid audit) | **INFO — verify hybrid wrapping** |

These findings are tracked but will not block the build until Phase 2 (2026-07-01)
because they exist in the migration-in-progress paths, not net-new code. Add
`// PQC-EXEMPT: pre-NIST names — migration tracked in ADR-0021 Phase 2` to these
lines to suppress the HIGH gate until the rename is complete.

---

## 5. Migration Workflow

### Replacing an ECDSA operation (most common case)

```js
// ❌ BEFORE — classical ECDSA, breaks under CRQC
import { generateKeyPairSync, createSign } from 'node:crypto';
const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const sign = createSign('SHA256');
sign.update(payload);
const signature = sign.sign(privateKey, 'base64');

// ✅ AFTER — Ed25519 + ML-DSA-65 hybrid (ADR-0021 compliant)
import { headyPQC, hybridSign } from './src/security/pqc.js';
const keyPair = headyPQC.generateHybridKeyPair(serviceId);   // generates Ed25519 + ML-DSA composite
const { signature, algorithm, timestamp } = hybridSign.sign(serviceId, payload);
```

### Replacing an ECDH key exchange

```js
// ❌ BEFORE — classical ECDH
import { createECDH } from 'node:crypto';
const ecdh = createECDH('prime256v1');
const publicKey = ecdh.generateKeys();

// ✅ AFTER — X25519 + ML-KEM-768 hybrid
import { hybridKEM } from './src/security/pqc.js';
const { ciphertext, sharedSecret } = await hybridKEM.encapsulate(recipientPublicKey);
// sharedSecret = HKDF(X25519_ss || ML-KEM_ss, 'heady-hkdf-v1')
```

### Renaming algorithm ID strings (Phase 2 quick wins)

```js
// src/security/pqc.js — PQC_CONFIG update
export const PQC_CONFIG = {
  kem: {
    algorithm: 'ML-KEM',          // was: 'CRYSTALS-Kyber'
    variant:   'ML-KEM-768',      // was: 'Kyber768'  — FIPS 203 Level 3
    standard:  'FIPS-203',
  },
  signature: {
    algorithm: 'ML-DSA',          // was: 'CRYSTALS-Dilithium'
    variant:   'ML-DSA-65',       // was: 'Dilithium3' — FIPS 204 Level 3
    standard:  'FIPS-204',
  },
  hash: {
    algorithm: 'SHA3-256',
    standard:  'FIPS-202',
  },
  hybridMode: true,               // MUST remain true per ADR-0021
};
```

---

## 6. Competitive and Patent Significance

### Sovereign AI differentiator

The enterprise and government AI market is rapidly requiring PQC readiness as a
procurement condition. NIST's 2024 finalisation triggered mandatory migration timelines
at NSA (CNSA 2.0), CISA, and major financial regulators. Heady's 2027 full-PQC target
is ahead of the federal deadline.

### Patent coverage

The following Heady provisional patents include PQC claims that are strengthened by
ADR-0021 enforcement:

| Patent | Claim area | PQC relevance |
|--------|-----------|--------------|
| HS-051+ | AI orchestration security | ML-DSA-signed pipeline receipts in OracleChain |
| HS-062 | Vector-native security | PQC-protected 384D embedding operations |
| Hybrid KEM provisionals | Key exchange methods | X25519+ML-KEM composite is a novel claim |
| HeadyGuard provisionals | Cryptographic agility | Algorithm-agnostic registry switching classical ↔ PQC |

Every PR that introduces classical-only crypto without the hybrid wrapper dilutes these
claims by demonstrating that the system does not consistently enforce its own PQC mandate.
The scanner prevents that dilution automatically.

---

## 7. SLH-DSA — Long-Lived Certificates Only

SLH-DSA (FIPS 205, formerly SPHINCS+) produces 7–50KB signatures — impractical for
API flows but appropriate for certificate signing where the signing key must outlast any
future algorithmic improvement to ML-DSA.

Heady reserves SLH-DSA for:
- Root CA key signing in the mTLS certificate hierarchy (ADR-0009)
- Long-lived HeadyGuard signing keys (rotation interval: 377 days, fib(14))
- OracleChain anchor signatures (anchored to blockchain, must remain verifiable for decades)

The scanner issues INFO-level findings for SLH-DSA in production flows — it is not
prohibited, but its use outside the three approved contexts is flagged for review.

---

## 8. Exemption Policy

Any line can be exempted with an inline comment. The exemption must include a reason:

```js
// Acceptable exemptions:
const ecdh = createECDH('prime256v1'); // PQC-EXEMPT: vendor test vector (test/fixtures/ecdh.test.js)
const hash = createHash('sha1');       // PQC-EXEMPT: git object ID format, not security-critical
```

Blanket file-level exemptions require the comment on the first line of the file:

```js
// PQC-EXEMPT: legacy compatibility shim — tracked for removal in ADR-0021 Phase 3
```

Exemptions in production paths (`src/`, `packages/`, `core/`) that are not test
fixtures must be reviewed and approved before merge. The scanner reports all exemption
lines in the INFO section of the PR comment so they are visible to reviewers.

---

_This brief is maintained alongside [ADR-0021](ADR/0021-post-quantum-cryptography-mandate.md).
The scanner rule set is defined in [`scripts/pqc-scanner.js`](../scripts/pqc-scanner.js)._
