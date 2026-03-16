// ═══════════════════════════════════════════════════════════════════════════════
// SYS-003: Post-Quantum Trust Receipt Signing Module
// Hybrid PQC: CRYSTALS-Dilithium (ML-DSA-65) + Ed25519 classical fallback
// Pipeline stage 20 RECEIPT — cryptographic signing for Glass Box Mandate
//
// ENABLE_PQC=true activates Dilithium signatures (quantum-resistant)
// Receipts carry BOTH signatures when PQC is enabled (hybrid scheme)
//
// © 2026 HeadySystems Inc. — 60+ Provisional Patents
// ═══════════════════════════════════════════════════════════════════════════════

import { createPrivateKey, createPublicKey, sign, verify, createHash, generateKeyPairSync } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const PHI = 1.618033988749895;
const ENABLE_PQC = process.env.ENABLE_PQC === 'true';

// ─── PQC: CRYSTALS-Dilithium (ML-DSA-65) ───────────────────────────────────
// Node.js 20+ with OpenSSL 3.2+ supports ML-DSA natively via the oqsprovider.
// If the provider is unavailable, we use a pure-JS Dilithium fallback.

let dilithium = null;

/**
 * Attempt to load PQC provider — graceful degradation if unavailable
 */
async function initPQC() {
  if (!ENABLE_PQC) return false;

  try {
    // Try native OpenSSL 3.2+ oqsprovider (fastest, production-grade)
    const testKey = generateKeyPairSync('ml-dsa-65', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    dilithium = { type: 'native', algorithm: 'ml-dsa-65' };
    return true;
  } catch {
    // Native ML-DSA not available — try npm package
  }

  try {
    // Try @noble/post-quantum (pure JS, audited)
    const { ml_dsa65 } = await import('@noble/post-quantum/ml-dsa');
    dilithium = {
      type: 'noble',
      algorithm: 'ML-DSA-65',
      keygen: ml_dsa65.keygen,
      sign: ml_dsa65.sign,
      verify: ml_dsa65.verify,
    };
    return true;
  } catch {
    // Try dilithium-crystals package
  }

  try {
    const crystals = await import('dilithium-crystals');
    dilithium = {
      type: 'crystals',
      algorithm: 'Dilithium3',
      keygen: crystals.keygen || crystals.default?.keygen,
      sign: crystals.sign || crystals.default?.sign,
      verify: crystals.verify || crystals.default?.verify,
    };
    return true;
  } catch {
    // No PQC provider available — fall back to Ed25519 only
  }

  console.warn('[TrustReceipt] ENABLE_PQC=true but no PQC provider available. Using Ed25519 only.');
  return false;
}

// ─── CLASSICAL: Ed25519 ─────────────────────────────────────────────────────

/**
 * TrustReceiptSigner — Hybrid PQC + Classical Signing
 *
 * When ENABLE_PQC=true:
 *   Receipt carries BOTH a Dilithium (ML-DSA-65) signature AND an Ed25519 signature.
 *   Verification requires BOTH to pass (dual-signature hybrid scheme).
 *   This ensures security even if one algorithm is broken.
 *
 * When ENABLE_PQC=false (or no PQC provider):
 *   Receipt carries only an Ed25519 signature (classical).
 */
export class TrustReceiptSigner {
  #ed25519PrivateKey;
  #ed25519PublicKey;
  #pqcKeypair;
  #pqcEnabled;

  constructor(keyPath) {
    const pkiDir = keyPath || join(process.cwd(), 'configs/pki');
    this.#pqcEnabled = false;

    // Load Ed25519 keys
    const privPath = join(pkiDir, 'ed25519-receipt-key.pem');
    const pubPath = join(pkiDir, 'ed25519-receipt-key.pub');

    if (existsSync(privPath)) {
      this.#ed25519PrivateKey = createPrivateKey(readFileSync(privPath));
    }
    if (existsSync(pubPath)) {
      this.#ed25519PublicKey = createPublicKey(readFileSync(pubPath));
    }

    // Load PQC keys if they exist
    const pqcPrivPath = join(pkiDir, 'dilithium-receipt-key.bin');
    const pqcPubPath = join(pkiDir, 'dilithium-receipt-key.pub.bin');
    if (existsSync(pqcPrivPath) && existsSync(pqcPubPath)) {
      this.#pqcKeypair = {
        secretKey: readFileSync(pqcPrivPath),
        publicKey: readFileSync(pqcPubPath),
      };
    }
  }

  /**
   * Initialize PQC — call once at startup
   */
  async init() {
    this.#pqcEnabled = await initPQC();

    // Generate PQC keypair if enabled and not already on disk
    if (this.#pqcEnabled && !this.#pqcKeypair && dilithium) {
      await this.#generatePQCKeys();
    }

    return {
      pqcEnabled: this.#pqcEnabled,
      pqcAlgorithm: dilithium?.algorithm || 'none',
      pqcProvider: dilithium?.type || 'none',
      ed25519Available: !!this.#ed25519PrivateKey,
    };
  }

  /**
   * Generate and persist PQC keypair
   */
  async #generatePQCKeys() {
    const pkiDir = join(process.cwd(), 'configs/pki');
    if (!existsSync(pkiDir)) mkdirSync(pkiDir, { recursive: true });

    if (dilithium?.type === 'native') {
      // Native OpenSSL ML-DSA
      const { publicKey, privateKey } = generateKeyPairSync('ml-dsa-65', {
        publicKeyEncoding: { type: 'spki', format: 'der' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' },
      });
      this.#pqcKeypair = { publicKey: Buffer.from(publicKey), secretKey: Buffer.from(privateKey) };
    } else if (dilithium?.keygen) {
      // JS-based Dilithium keygen
      const kp = dilithium.keygen();
      this.#pqcKeypair = {
        publicKey: Buffer.from(kp.publicKey),
        secretKey: Buffer.from(kp.secretKey),
      };
    }

    if (this.#pqcKeypair) {
      writeFileSync(join(pkiDir, 'dilithium-receipt-key.bin'), this.#pqcKeypair.secretKey, { mode: 0o600 });
      writeFileSync(join(pkiDir, 'dilithium-receipt-key.pub.bin'), this.#pqcKeypair.publicKey, { mode: 0o644 });
      console.log('[TrustReceipt] PQC keypair generated and persisted');
    }
  }

  /**
   * Sign a trust receipt — hybrid PQC + Ed25519
   */
  signReceipt(receipt) {
    const payload = {
      ...receipt,
      signedAt: new Date().toISOString(),
      phi: PHI,
      schemaVersion: '2.0.0-pqc',
      pqcEnabled: this.#pqcEnabled,
    };

    const canonical = JSON.stringify(payload, Object.keys(payload).sort());
    const contentHash = createHash('sha256').update(canonical).digest('hex');
    const messageBytes = Buffer.from(canonical);

    const result = {
      ...payload,
      contentHash,
      signatures: {},
    };

    // ── Ed25519 signature (classical) ──
    if (this.#ed25519PrivateKey) {
      const ed25519Sig = sign(null, messageBytes, this.#ed25519PrivateKey);
      result.signatures.ed25519 = {
        algorithm: 'Ed25519',
        signature: ed25519Sig.toString('base64'),
        keyId: 'hcfp-receipt-ed25519-v1',
      };
    }

    // ── Dilithium/ML-DSA signature (post-quantum) ──
    if (this.#pqcEnabled && this.#pqcKeypair && dilithium) {
      try {
        let pqcSig;
        if (dilithium.type === 'native') {
          const privKey = createPrivateKey({ key: this.#pqcKeypair.secretKey, format: 'der', type: 'pkcs8' });
          pqcSig = sign(null, messageBytes, privKey);
        } else if (dilithium.sign) {
          pqcSig = Buffer.from(dilithium.sign(this.#pqcKeypair.secretKey, messageBytes));
        }

        if (pqcSig) {
          result.signatures.dilithium = {
            algorithm: dilithium.algorithm,
            provider: dilithium.type,
            signature: pqcSig.toString('base64'),
            keyId: 'hcfp-receipt-dilithium-v1',
            signatureBytes: pqcSig.length,
          };
        }
      } catch (err) {
        result.signatures.dilithium = {
          algorithm: dilithium.algorithm,
          error: `PQC signing failed: ${err.message}`,
        };
      }
    }

    // Determine scheme
    const hasEd = !!result.signatures.ed25519?.signature;
    const hasPqc = !!result.signatures.dilithium?.signature;
    result.scheme = hasPqc && hasEd ? 'HYBRID-PQC-ED25519' :
                    hasPqc ? 'PQC-ONLY' :
                    hasEd ? 'ED25519-ONLY' : 'UNSIGNED';

    return result;
  }

  /**
   * Verify a trust receipt — both signatures must pass for hybrid scheme
   */
  verifyReceipt(signedReceipt) {
    const { signatures, contentHash, scheme, ...payload } = signedReceipt;
    const canonical = JSON.stringify(payload, Object.keys(payload).sort());
    const computedHash = createHash('sha256').update(canonical).digest('hex');
    const messageBytes = Buffer.from(canonical);

    if (computedHash !== contentHash) {
      return { valid: false, reason: 'Content hash mismatch — receipt tampered' };
    }

    const results = { hashValid: true, ed25519: null, dilithium: null };

    // ── Verify Ed25519 ──
    if (signatures?.ed25519?.signature && this.#ed25519PublicKey) {
      const sig = Buffer.from(signatures.ed25519.signature, 'base64');
      results.ed25519 = verify(null, messageBytes, this.#ed25519PublicKey, sig);
    }

    // ── Verify Dilithium ──
    if (signatures?.dilithium?.signature && this.#pqcKeypair && dilithium) {
      try {
        const sig = Buffer.from(signatures.dilithium.signature, 'base64');
        if (dilithium.type === 'native') {
          const pubKey = createPublicKey({ key: this.#pqcKeypair.publicKey, format: 'der', type: 'spki' });
          results.dilithium = verify(null, messageBytes, pubKey, sig);
        } else if (dilithium.verify) {
          results.dilithium = dilithium.verify(this.#pqcKeypair.publicKey, messageBytes, sig);
        }
      } catch (err) {
        results.dilithium = false;
        results.dilithiumError = err.message;
      }
    }

    // Hybrid scheme requires BOTH to pass
    const valid = scheme === 'HYBRID-PQC-ED25519'
      ? results.ed25519 === true && results.dilithium === true
      : scheme === 'PQC-ONLY'
        ? results.dilithium === true
        : scheme === 'ED25519-ONLY'
          ? results.ed25519 === true
          : false;

    return { valid, scheme, ...results };
  }

  /**
   * Create a receipt for a pipeline stage completion
   */
  createStageReceipt(stageId, stageName, result, taskId) {
    return this.signReceipt({
      type: 'pipeline_stage_receipt',
      stageId,
      stageName,
      taskId,
      result: result.success ? 'SUCCESS' : 'FAILURE',
      outputHash: createHash('sha256').update(JSON.stringify(result)).digest('hex'),
      executedAt: new Date().toISOString(),
    });
  }

  get pqcEnabled() { return this.#pqcEnabled; }
  get pqcAlgorithm() { return dilithium?.algorithm || 'none'; }
  get hasPrivateKey() { return !!this.#ed25519PrivateKey; }
  get hasPublicKey() { return !!this.#ed25519PublicKey; }
  get hasPQCKeys() { return !!this.#pqcKeypair; }
  get scheme() {
    if (this.#pqcEnabled && this.#pqcKeypair && this.#ed25519PrivateKey) return 'HYBRID-PQC-ED25519';
    if (this.#pqcEnabled && this.#pqcKeypair) return 'PQC-ONLY';
    if (this.#ed25519PrivateKey) return 'ED25519-ONLY';
    return 'UNSIGNED';
  }
}

export default TrustReceiptSigner;
