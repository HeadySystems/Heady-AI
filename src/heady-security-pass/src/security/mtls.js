/*
 * © 2026 Heady™Systems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Mutual TLS (mTLS) Configuration Module
 *
 * Zero-Trust security layer for inter-agent mesh communication.
 * All agent-to-agent traffic must be encrypted via TLS 1.3 with
 * mutual certificate verification.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const tls = require('tls');
const https = require('https');
const logger = require('../utils/logger');
const { fib } = require('../shared/phi-math');

const DEFAULT_CERT_DIR = process.env.HEADY_CERT_DIR || path.join(process.cwd(), 'certs');
const DEFAULT_MAX_SOCKETS = fib(10);

function isReadableFile(filePath) {
    try {
        fs.accessSync(filePath, fs.constants.R_OK);
        return true;
    } catch {
        return false;
    }
}

function shouldAllowInsecureMTLS(opts = {}) {
    return opts.allowInsecure === true || process.env.HEADY_ALLOW_INSECURE_MTLS === 'true';
}

function getMTLSPaths(opts = {}) {
    const certDir = opts.certDir || DEFAULT_CERT_DIR;

    return {
        certDir,
        certFile: path.join(certDir, opts.certFile || 'server.crt'),
        keyFile: path.join(certDir, opts.keyFile || 'server.key'),
        caFile: path.join(certDir, opts.caFile || 'ca.crt'),
    };
}

function readTlsAsset(filePath) {
    return fs.readFileSync(filePath);
}

/**
 * Load mTLS configuration from certificate files.
 * @param {Object} opts
 * @param {string} opts.certDir - Directory containing cert files
 * @param {string} opts.certFile - Server certificate file name
 * @param {string} opts.keyFile - Server private key file name
 * @param {string} opts.caFile - Certificate Authority file name
 * @returns {Object|null} TLS options or null if certs not found
 */
function loadMTLSConfig(opts = {}) {
    const { certDir, certFile, keyFile, caFile } = getMTLSPaths(opts);

    const hasCert = isReadableFile(certFile);
    const hasKey = isReadableFile(keyFile);
    const hasCA = isReadableFile(caFile);

    if (!hasCert || !hasKey) {
        logger.warn('[mTLS] Certificates not found or unreadable — running in non-mTLS mode', {
            certDir,
            certFile,
            keyFile,
            hasCert,
            hasKey,
        });
        return null;
    }

    const allowInsecure = shouldAllowInsecureMTLS(opts);
    const rejectUnauthorized = opts.rejectUnauthorized !== false && !allowInsecure;

    if (!hasCA && rejectUnauthorized) {
        logger.warn('[mTLS] CA certificate missing — refusing to enable strict mTLS without a CA bundle', {
            certDir,
            caFile,
        });
        return null;
    }

    const config = {
        cert: readTlsAsset(certFile),
        key: readTlsAsset(keyFile),
        ca: hasCA ? [readTlsAsset(caFile)] : undefined,
        requestCert: true,
        rejectUnauthorized,
        minVersion: 'TLSv1.3',
        maxVersion: 'TLSv1.3',
        ciphers: [
            'TLS_AES_256_GCM_SHA384',
            'TLS_CHACHA20_POLY1305_SHA256',
            'TLS_AES_128_GCM_SHA256',
        ].join(':'),
    };

    logger.info('[mTLS] Configuration loaded — TLS 1.3 with mutual verification', {
        certDir,
        rejectUnauthorized,
        hasCA,
        insecureOverride: allowInsecure,
    });

    return config;
}

/**
 * Create an HTTPS server with mTLS enforcement.
 * Falls back to the provided Express app on regular HTTP if no certs.
 */
function createMTLSServer(app, opts = {}) {
    const tlsConfig = loadMTLSConfig(opts);

    if (!tlsConfig) {
        return { server: null, mtlsEnabled: false, reason: 'certificates_not_found' };
    }

    const server = https.createServer(tlsConfig, app);
    return { server, mtlsEnabled: true };
}

/**
 * Create an HTTPS agent for outbound mTLS requests.
 * Used by agents to communicate with other agents in the mesh.
 */
function createMTLSAgent(opts = {}) {
    const tlsConfig = loadMTLSConfig(opts);
    if (!tlsConfig) return null;

    return new https.Agent({
        cert: tlsConfig.cert,
        key: tlsConfig.key,
        ca: tlsConfig.ca,
        minVersion: 'TLSv1.3',
        rejectUnauthorized: tlsConfig.rejectUnauthorized,
        keepAlive: true,
        maxSockets: opts.maxSockets || DEFAULT_MAX_SOCKETS,
    });
}

/**
 * Express middleware to enforce mTLS on specific routes.
 */
function enforceMTLS(requiredPaths = []) {
    return (req, res, next) => {
        // Only enforce on specified paths
        if (requiredPaths.length > 0) {
            const requiresCheck = requiredPaths.some(p => req.path.startsWith(p));
            if (!requiresCheck) return next();
        }

        // Check if the connection has a valid client certificate
        const cert = req.socket.getPeerCertificate?.();
        const authorized = req.socket.authorized;

        if (!cert || !cert.subject) {
            return res.status(401).json({
                error: 'Client certificate required',
                protocol: 'mTLS 1.3',
                hint: 'Provide a valid client certificate signed by the trusted CA',
            });
        }

        if (!authorized) {
            return res.status(403).json({
                error: 'Client certificate not authorized',
                subject: cert.subject?.CN,
                issuer: cert.issuer?.CN,
            });
        }

        // Attach cert info to request for RBAC
        req.clientCert = {
            cn: cert.subject.CN,
            org: cert.subject.O,
            issuer: cert.issuer.CN,
            validFrom: cert.valid_from,
            validTo: cert.valid_to,
            fingerprint: cert.fingerprint256,
        };

        next();
    };
}

/**
 * Register mTLS status routes.
 */
function registerMTLSRoutes(app, tlsConfig) {
    app.get('/api/v2/security/mtls/status', (req, res) => {
        const cert = req.socket.getPeerCertificate?.();
        res.json({
            ok: true,
            mtlsEnabled: !!tlsConfig,
            tlsVersion: req.socket.getProtocol?.() || 'unknown',
            clientCert: cert?.subject ? {
                cn: cert.subject.CN,
                org: cert.subject.O,
                issuer: cert.issuer?.CN,
                authorized: req.socket.authorized,
            } : null,
            serverConfig: tlsConfig ? {
                minVersion: 'TLSv1.3',
                ciphers: 'TLS_AES_256_GCM_SHA384',
                mutualVerification: true,
            } : null,
        });
    });
}

module.exports = {
    loadMTLSConfig,
    createMTLSServer,
    createMTLSAgent,
    enforceMTLS,
    registerMTLSRoutes,
};
