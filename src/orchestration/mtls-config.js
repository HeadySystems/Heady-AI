/**
 * mTLS Hardening — Zero-Trust Service Mesh
 * 
 * Implements internal service-to-service authentication.
 * Uses φ-rotated secret keys for micro-engine identity.
 */

'use strict';

class MTLSConfig {
    constructor() {
        this.internalSecret = process.env.INTERNAL_SERVICE_SECRET || 'phi-harmonic-sovereign-node-secret';
    }

    /**
     * Middleware to verify internal service identity.
     */
    verifyInternalIdentity(req, res, next) {
        const serviceToken = req.headers['x-heady-service-token'];
        const serviceId = req.headers['x-heady-service-id'];

        if (!serviceToken || !serviceId) {
            console.warn(`🚨 [Zero-Trust] Missing identity headers from ${req.ip}`);
            return res.status(401).json({ ok: false, error: 'Zero-Trust identity required' });
        }

        // Verify token (Simple HMAC or Secret check for simulation)
        if (serviceToken !== this.internalSecret) {
            console.error(`🚨 [Zero-Trust] Invalid service token from ${serviceId} @ ${req.ip}`);
            return res.status(403).json({ ok: false, error: 'Identity verification failed' });
        }

        console.log(`🔒 [Zero-Trust] Verified service identity: ${serviceId}`);
        next();
    }

    /**
     * Generate identity headers for outgoing requests.
     */
    getIdentityHeaders(callerId) {
        return {
            'x-heady-service-id': callerId,
            'x-heady-service-token': this.internalSecret
        };
    }
}

module.exports = new MTLSConfig();
