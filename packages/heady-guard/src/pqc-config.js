/**
 * Heady™ Post-Quantum TLS Configuration — ML-KEM Hybrid
 * Requires Node.js 22+ (OpenSSL 3.x with ML-KEM support).
 * Patent coverage: HS-059 (Self-Healing Attestation Mesh)
 * @module core/security/pqc-config
 */
import { readFileSync } from 'node:fs';

export function getPQCTLSOptions({ certPath, keyPath, caPath } = {}) {
  const opts = {
    sigalgs: 'ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256',
    groups: 'X25519MLKEM768:x25519:P-256:P-384',
    minVersion: 'TLSv1.3',
    ciphers: ['TLS_AES_256_GCM_SHA384','TLS_CHACHA20_POLY1305_SHA256','TLS_AES_128_GCM_SHA256'].join(':'),
    requestCert: !!(caPath),
    rejectUnauthorized: !!(caPath),
  };
  if (certPath && keyPath) { opts.cert = readFileSync(certPath); opts.key = readFileSync(keyPath); }
  if (caPath) opts.ca = readFileSync(caPath);
  return opts;
}

export function checkPQCSupport() {
  const major = parseInt(process.version.slice(1));
  return { mlKemSupported: major >= 22, version: process.version, recommendation: major < 22 ? 'Upgrade to Node.js 22+ for ML-KEM hybrid TLS support' : 'ML-KEM hybrid TLS available' };
}

export const CLOUDFLARE_PQC_HEADERS = { 'CF-PQ-KEM': '1', 'X-Heady-PQC': 'mlkem768' };
