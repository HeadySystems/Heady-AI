/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  @heady-ai/platform — auth/index.js                                 ║
 * ║  JWT + mTLS + service-to-service auth, Ed25519 receipt signing   ║
 * ║  © 2026 HeadySystems Inc. — 60+ Provisional Patents             ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Three authentication layers:
 *   1. User JWT — Bearer token validation (EdDSA Ed25519 or RS256)
 *   2. Service-to-Service — mTLS client certificate validation (via Envoy)
 *   3. Receipt Signing — Ed25519 cryptographic receipts for audit trails
 *
 * Zero-trust default: all requests require valid auth unless explicitly
 * exempted via allowList.
 */

'use strict';

import { createRemoteJWKSet, jwtVerify, SignJWT, generateKeyPair, exportJWK } from 'jose';
import { createPrivateKey, createPublicKey, sign, verify } from 'crypto';
import { PSI, CSL_THRESHOLDS, TIMEOUTS } from '../phi/index.js';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

/** Token expiry: φ⁷ × 1000 ms ≈ 29 seconds (short-lived service tokens) */
const SERVICE_TOKEN_EXPIRY_MS = TIMEOUTS.PHI_7;

/** JWKS cache TTL: φ⁸ × 1000 ms ≈ 46.9 seconds */
const JWKS_CACHE_TTL_MS = TIMEOUTS.PHI_8;

// ─── JWT VALIDATOR ────────────────────────────────────────────────────────────

/**
 * @typedef {Object} JwtConfig
 * @property {string} [jwksUri] — JWKS endpoint for key verification
 * @property {string} [issuer] — expected token issuer
 * @property {string} [audience] — expected token audience
 * @property {string[]} [algorithms] — allowed algorithms (default: ['EdDSA', 'RS256'])
 */

export class JwtValidator {
  /**
   * @param {JwtConfig} config
   */
  constructor(config = {}) {
    this._issuer    = config.issuer    ?? process.env.JWT_ISSUER    ?? 'headysystems.com';
    this._audience  = config.audience  ?? process.env.JWT_AUDIENCE  ?? 'heady-api';
    this._algorithms = config.algorithms ?? ['EdDSA', 'RS256'];
    this._jwksUri   = config.jwksUri   ?? process.env.JWKS_URI;

    this._jwks = null;
    this._jwksCachedAt = 0;
  }

  /**
   * Get or refresh the JWKS key set.
   * Cached for φ⁸ × 1000 ms to avoid hammering the JWKS endpoint.
   * @returns {import('jose').JWTVerifyGetKey}
   */
  async getKeySet() {
    if (!this._jwksUri) throw new Error('JwtValidator: JWKS URI not configured');

    const now = Date.now();
    if (!this._jwks || now - this._jwksCachedAt > JWKS_CACHE_TTL_MS) {
      this._jwks = createRemoteJWKSet(new URL(this._jwksUri), {
        cacheMaxAge: JWKS_CACHE_TTL_MS,
        timeoutDuration: TIMEOUTS.PHI_3,
      });
      this._jwksCachedAt = now;
    }

    return this._jwks;
  }

  /**
   * Verify a JWT and return its payload.
   * @param {string} token
   * @returns {Promise<import('jose').JWTVerifyResult>}
   */
  async verify(token) {
    if (!token) throw Object.assign(new Error('No token provided'), { status: 401 });

    const keySet = await this.getKeySet();
    return jwtVerify(token, keySet, {
      issuer:     this._issuer,
      audience:   this._audience,
      algorithms: this._algorithms,
    });
  }

  /**
   * Express middleware: validate Bearer JWT, attach payload to req.user.
   * @returns {import('express').RequestHandler}
   */
  middleware() {
    return async (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
          const err = new Error('Missing or malformed Authorization header');
          err.status = 401;
          return next(err);
        }

        const token = authHeader.slice(7);
        const { payload } = await this.verify(token);
        req.user = payload;
        req.userId = payload.sub;
        next();
      } catch (err) {
        err.status = err.code === 'ERR_JWT_EXPIRED' ? 401 : 403;
        err.name = 'AuthenticationError';
        next(err);
      }
    };
  }
}

// ─── SERVICE-TO-SERVICE AUTH ──────────────────────────────────────────────────

/**
 * Validate mTLS service-to-service identity (via Envoy x-forwarded-client-cert header).
 * Envoy injects XFCC header after verifying client certificate.
 * This middleware trusts Envoy's validation and extracts the service identity.
 *
 * @param {string[]} [allowedServices] — allowed service names (empty = allow all verified)
 * @returns {import('express').RequestHandler}
 */
export function serviceAuthMiddleware(allowedServices = []) {
  return (req, res, next) => {
    const xfcc = req.headers['x-forwarded-client-cert'];

    if (!xfcc) {
      const err = new Error('Missing mTLS client certificate (x-forwarded-client-cert)');
      err.status = 401;
      err.name = 'AuthenticationError';
      return next(err);
    }

    // Parse XFCC header to extract service identity
    const serviceId = extractServiceFromXFCC(xfcc);
    if (!serviceId) {
      const err = new Error('Could not extract service identity from XFCC header');
      err.status = 403;
      err.name = 'AuthorizationError';
      return next(err);
    }

    if (allowedServices.length > 0 && !allowedServices.includes(serviceId)) {
      const err = new Error(`Service '${serviceId}' not in allowed service list`);
      err.status = 403;
      err.name = 'AuthorizationError';
      return next(err);
    }

    req.serviceId = serviceId;
    next();
  };
}

/**
 * Extract service name from Envoy XFCC (x-forwarded-client-cert) header.
 * Format: By=...,Hash=...,Subject="/CN=heady-gateway/O=headysystems",...
 * @param {string} xfcc
 * @returns {string|null}
 */
function extractServiceFromXFCC(xfcc) {
  const subjectMatch = xfcc.match(/Subject="([^"]+)"/);
  if (!subjectMatch) return null;
  const cnMatch = subjectMatch[1].match(/CN=([^,/]+)/);
  return cnMatch?.[1] ?? null;
}

// ─── ED25519 RECEIPT SIGNER ───────────────────────────────────────────────────

/**
 * Creates cryptographic audit receipts using Ed25519.
 * Every significant Heady operation produces a signed receipt
 * for the immutable audit trail.
 */
export class ReceiptSigner {
  /**
   * @param {Object} [opts]
   * @param {string} [opts.privateKeyPem] — Ed25519 private key PEM
   * @param {string} [opts.serviceName]
   */
  constructor(opts = {}) {
    this._serviceName = opts.serviceName ?? process.env.SERVICE_NAME ?? 'heady';
    this._privateKeyPem = opts.privateKeyPem ?? process.env.RECEIPT_SIGNING_KEY;
    this._privateKey = this._privateKeyPem
      ? createPrivateKey(this._privateKeyPem)
      : null;
  }

  /**
   * Sign a receipt payload. Returns the receipt with Ed25519 signature.
   * @param {Object} payload — receipt data
   * @returns {{ receipt: Object, signature: string, valid: boolean }}
   */
  sign(payload) {
    const receipt = {
      ...payload,
      service:   this._serviceName,
      timestamp: new Date().toISOString(),
      version:   '1.0',
    };

    if (!this._privateKey) {
      return { receipt, signature: 'NO_KEY_CONFIGURED', valid: false };
    }

    const data = Buffer.from(JSON.stringify(receipt), 'utf8');
    const sig = sign(null, data, this._privateKey);

    return {
      receipt,
      signature: sig.toString('base64url'),
      valid: true,
    };
  }

  /**
   * Verify a receipt signature using the corresponding public key.
   * @param {Object} receipt
   * @param {string} signature — base64url Ed25519 signature
   * @param {string} publicKeyPem
   * @returns {boolean}
   */
  static verifyReceipt(receipt, signature, publicKeyPem) {
    try {
      const publicKey = createPublicKey(publicKeyPem);
      const data = Buffer.from(JSON.stringify(receipt), 'utf8');
      const sig  = Buffer.from(signature, 'base64url');
      return verify(null, data, publicKey, sig);
    } catch {
      return false;
    }
  }
}

// ─── API KEY VALIDATOR ────────────────────────────────────────────────────────

/**
 * Simple API key middleware for public API endpoints.
 * Keys should be stored in env: HEADY_API_KEYS="key1,key2,key3"
 * @returns {import('express').RequestHandler}
 */
export function apiKeyMiddleware() {
  const validKeys = new Set(
    (process.env.HEADY_API_KEYS ?? '').split(',').map(k => k.trim()).filter(Boolean)
  );

  return (req, res, next) => {
    const apiKey = req.headers['x-api-key'] ?? req.query.api_key;

    if (!apiKey || !validKeys.has(apiKey)) {
      const err = new Error('Invalid or missing API key');
      err.status = 401;
      err.name = 'AuthenticationError';
      return next(err);
    }

    req.apiKeyAuth = true;
    next();
  };
}
