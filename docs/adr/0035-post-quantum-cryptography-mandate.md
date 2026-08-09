# ADR-0035: Post-Quantum Cryptography Mandate — ML-DSA/ML-KEM Hybrid Mode

- **Status:** Accepted (2026-06-17, legacy corpus docs/ADR) · Transferred to canonical corpus 2026-08-09
- **Author:** Eric Haywood
- **Compliance:** NIST FIPS 203 (ML-KEM), FIPS 204 (ML-DSA), FIPS 205 (SLH-DSA)
- **Enforced by (legacy):** `scripts/pqc-scanner.js` + `adr-sentinel.yml` pqc-scan job — see Reconciliation for the rebuild's enforcement point

## Context

Shor's algorithm running on a cryptographically relevant quantum computer (CRQC) breaks RSA, ECDSA, ECDH, and all elliptic-curve key exchange in polynomial time. NIST finalized the first post-quantum standards in August 2024: FIPS 203 (ML-KEM, née CRYSTALS-Kyber), FIPS 204 (ML-DSA, née CRYSTALS-Dilithium), and FIPS 205 (SLH-DSA, née SPHINCS+).

The Heady codebase already contains `src/security/pqc.js` implementing CRYSTALS-Kyber (KEM) and CRYSTALS-Dilithium (signatures) using the pre-standardization names. The rebuild must:

1. Align naming and algorithm IDs to the final NIST FIPS designations
2. Mandate hybrid mode (classical + PQC simultaneously) for all new code
3. Prohibit net-new classical-only cryptographic operations
4. Formalize the migration timeline for legacy classical operations

NIST recommends full migration by 2030 for federal systems; Heady targets 2027 for all sovereign AI platform endpoints as a competitive differentiator.

## Decision

### Approved Algorithm Registry

| Role | Algorithm | NIST Standard | Heady Approved | Classical Equivalent |
|------|-----------|--------------|----------------|---------------------|
| Digital signatures | **ML-DSA** (Dilithium3) | FIPS 204 | APPROVED | ECDSA P-256 |
| Key encapsulation | **ML-KEM** (Kyber-768) | FIPS 203 | APPROVED | X25519 / ECDH |
| Hash-based signatures | **SLH-DSA** (SHAKE-256s) | FIPS 205 | APPROVED (long-lived certs only) | RSA-PSS |
| Symmetric encryption | **AES-256-GCM** | NIST SP 800-38D | APPROVED (symmetric; Grover halves, still 128-bit) | — |
| Hash | **SHA-3-256 / BLAKE3** | FIPS 202 | APPROVED | SHA-256 (still safe) |
| Classical hybrid KEM | **X25519 + ML-KEM** | Hybrid KEM draft | APPROVED (transitional) | X25519 alone |
| Classical hybrid sign | **Ed25519 + ML-DSA** | Composite sig draft | APPROVED (transitional) | Ed25519 alone |

### Prohibited Algorithms (net-new code)

| Algorithm | Why prohibited |
|-----------|---------------|
| **RSA** (any key size) | Broken by Shor's algorithm |
| **ECDSA / ECDH** (all curves) | Broken by Shor's algorithm |
| **DSA** | Broken by Shor's algorithm |
| **DH / DHE** (classical) | Broken by Shor's algorithm |
| **AES-128-CBC / AES-128-ECB** | ECB mode always prohibited; CBC unauthenticated; 128-bit halved by Grover |
| **AES-256-CBC** | Unauthenticated — use GCM mode |
| **MD5 / SHA-1** | Collision attacks; not quantum-specific but deprecated |
| **3DES / DES** | Deprecated; Sweet32 attack |
| **RC4** | Broken |

### Hybrid Mode Requirement

All new asymmetric operations MUST combine classical and PQC in hybrid mode:

```js
// APPROVED — hybrid KEM (X25519 + ML-KEM-768)
import { hybridKEM } from './src/security/pqc.js';
const { ciphertext, sharedSecret } = await hybridKEM.encapsulate(recipientPublicKey);
// sharedSecret = HKDF(X25519_secret || ML-KEM_secret)

// APPROVED — hybrid signatures (Ed25519 + ML-DSA)
import { hybridSign } from './src/security/pqc.js';
const signature = await hybridSign.sign(message, privateKey);
// signature = Ed25519_sig || ML-DSA_sig (composite)

// PROHIBITED — classical-only RSA
import { createSign } from 'node:crypto';
const sign = createSign('RSA-SHA256');    // PQC-mandate violation

// PROHIBITED — ECDH alone
import { createECDH } from 'node:crypto';
const ecdh = createECDH('prime256v1');    // PQC-mandate violation
```

### Migration Timeline

| Phase | Date | Target |
|-------|------|--------|
| Phase 1 — Inventory | 2026-06-17 (done at acceptance) | Static analysis scanner deployed (this ADR) |
| Phase 2 — No net-new classical | 2026-07-01 | CI gate blocks new classical-only operations |
| Phase 3 — Legacy migration | 2026-Q3 | All existing RSA/ECDSA in signing paths replaced |
| Phase 4 — Service auth migration | 2026-Q4 | mTLS certificates re-issued with ML-DSA |
| Phase 5 — Full PQC posture | 2027-Q1 | All Heady endpoints sovereign PQC-ready |

### Exemptions (must be documented in code with `// PQC-EXEMPT:` comment)

- `_archive/` — legacy code, no migration required
- `test/` and `*.test.js` — test fixtures using known classical vectors
- Vendor SDK code in `node_modules/` — out of scope
- HMAC-SHA256 for webhook signature verification — symmetric; quantum-safe
- `crypto.randomBytes()`, `crypto.randomUUID()` — not asymmetric; quantum-safe

## Consequences

### Positive

- Harvest-now-decrypt-later (HNDL) attacks neutralized: adversaries cannot stockpile Heady-encrypted traffic today and decrypt with a future CRQC
- First-mover differentiation: sovereign AI platform with full PQC posture by 2027 is a genuine enterprise and government sales differentiator
- Patent alignment: Heady's 51 provisional patents reference PQC in security claims
- FIPS 203/204/205 compliance opens federal/government procurement paths
- Hybrid mode ensures no regression if an unexpected flaw in ML-KEM/ML-DSA emerges

### Negative

- ML-DSA signatures are ~5× larger than Ed25519 (2420 bytes vs 64 bytes) — JWT/cookie size implications require review
- ML-KEM ciphertexts are ~1100 bytes vs 32 bytes for X25519 — protocol overhead
- `@noble/post-quantum` (or equivalent) must be added to the dependency manifest
- Not all cloud provider TLS termination supports PQC cipher suites in 2026 — Cloudflare supports X25519Kyber768 hybrid TLS; Cloud Run LB does not yet natively

## Alternatives Considered

- **PQC-only (no hybrid):** rejected — if a flaw is found in ML-KEM/ML-DSA, classical hybrid provides defense-in-depth fallback
- **Wait for cloud native support:** rejected — HNDL attacks require protecting traffic now regardless of whether the TLS layer supports PQC
- **SLH-DSA everywhere:** rejected — 7–50KB signatures impractical for API flows; reserved for long-lived certificate signing only

## Reconciliation (2026-08-09 transfer)

- **Enforcement point moved.** The enforcement mechanisms named in the source (`scripts/pqc-scanner.js`, `.github/workflows/adr-sentinel.yml` pqc-scan job) were legacy-repo CI. In the rebuild the equivalent enforcement point is the governance gate (`/home/headyme/Heady-AI/tooling/governance-gate`); the mandate carries forward as policy awaiting a wired PQC scanner in this repo's CI.
- **Prohibition list unchanged.** The prohibited-algorithm list (no net-new RSA/ECDSA/ECDH/DSA/DH, AES-CBC/ECB, MD5/SHA-1, 3DES, RC4) applies to the rebuild unchanged.
- **Locked-fact correction.** The source's Consequences claimed "60+ Heady provisionals"; Heady has 51 provisional patents (HS-2026-001..051). The count is corrected to 51 in the Consequences above — the substance of the point (the provisional portfolio references PQC in security claims) is unchanged.

## Provenance

- **Source:** `/home/headyme/Heady-AI/docs/ADR/0021-post-quantum-cryptography-mandate.md` (legacy docs/ADR/0021)
- **Transferred:** 2026-08-09 into the canonical corpus as ADR-0035.
- The legacy file remains in place as a historical artifact; this canonical file is the operative record.
