/*
 * © 2026 Heady™Systems Inc.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ─── Type-Safe Vector Bridge ──────────────────────────────────
 * Strict type-validated 3D coordinate handshakes between services.
 * Prevents spatial drift during agent deployment by enforcing
 * Vec3 contracts on all coordinate exchanges.
 *
 * Zero-Hour Mandate 2 — Liquid Architecture v9.0
 * Patent: PPA #06 — 3D Memory Architecture
 * ──────────────────────────────────────────────────────────────
 */

'use strict';

const crypto = require('crypto');
const { Vec3 } = require('../memory/octree-spatial-index');

// ── Constants ──────────────────────────────────────────────────
const PHI = 1.6180339887;
const COORD_BOUNDS = { x: [-10, 10], y: [-10, 10], z: [-10, 10] };
const HANDSHAKE_VERSION = '1.0.0';

// ── Validation ─────────────────────────────────────────────────

/**
 * Validate that a value is a finite number.
 * @param {*} val
 * @param {string} label
 * @throws {TypeError}
 */
function assertFinite(val, label) {
    if (typeof val !== 'number' || !Number.isFinite(val)) {
        throw new TypeError(`VectorBridge: ${label} must be a finite number, got ${typeof val} (${val})`);
    }
}

/**
 * Validate a Vec3-like input and return a canonical Vec3.
 * Accepts: Vec3 instance, { x, y, z } object, or [x, y, z] array.
 *
 * @param {Vec3|{x:number,y:number,z:number}|number[]} input
 * @param {string} [context='coords']
 * @returns {Vec3}
 * @throws {TypeError}
 */
function validateVec3(input, context = 'coords') {
    let x, y, z;

    if (input instanceof Vec3) {
        x = input.x; y = input.y; z = input.z;
    } else if (Array.isArray(input) && input.length === 3) {
        [x, y, z] = input;
    } else if (input && typeof input === 'object' && 'x' in input && 'y' in input && 'z' in input) {
        x = input.x; y = input.y; z = input.z;
    } else {
        throw new TypeError(
            `VectorBridge [${context}]: expected Vec3, {x,y,z}, or [x,y,z] — got ${JSON.stringify(input)}`
        );
    }

    assertFinite(x, `${context}.x`);
    assertFinite(y, `${context}.y`);
    assertFinite(z, `${context}.z`);

    return new Vec3(x, y, z);
}

/**
 * Validate Vec3 is within defined spatial bounds.
 * @param {Vec3} vec
 * @param {Object} [bounds=COORD_BOUNDS]
 * @returns {Vec3} clamped Vec3
 */
function clampToBounds(vec, bounds = COORD_BOUNDS) {
    return new Vec3(
        Math.max(bounds.x[0], Math.min(bounds.x[1], vec.x)),
        Math.max(bounds.y[0], Math.min(bounds.y[1], vec.y)),
        Math.max(bounds.z[0], Math.min(bounds.z[1], vec.z))
    );
}

/**
 * Check if a Vec3 is within spatial bounds without clamping.
 * @param {Vec3} vec
 * @param {Object} [bounds=COORD_BOUNDS]
 * @returns {boolean}
 */
function isInBounds(vec, bounds = COORD_BOUNDS) {
    return vec.x >= bounds.x[0] && vec.x <= bounds.x[1] &&
           vec.y >= bounds.y[0] && vec.y <= bounds.y[1] &&
           vec.z >= bounds.z[0] && vec.z <= bounds.z[1];
}

// ── Coordinate Handshake ───────────────────────────────────────

/**
 * Create a signed, validated coordinate handshake between services.
 * Provides an immutable transfer receipt with integrity hash.
 *
 * @param {string} source - Source service identifier
 * @param {string} target - Target service identifier
 * @param {Vec3|{x,y,z}|number[]} coords - 3D coordinates
 * @param {Object} [meta={}] - Additional metadata
 * @returns {Object} Signed handshake object
 */
function createCoordHandshake(source, target, coords, meta = {}) {
    if (!source || typeof source !== 'string') throw new TypeError('VectorBridge: source must be a non-empty string');
    if (!target || typeof target !== 'string') throw new TypeError('VectorBridge: target must be a non-empty string');

    const validated = validateVec3(coords, `${source}→${target}`);
    const clamped = clampToBounds(validated);
    const drifted = !validated.equals(clamped, 1e-9);

    const payload = {
        version: HANDSHAKE_VERSION,
        source,
        target,
        coordinates: { x: clamped.x, y: clamped.y, z: clamped.z },
        original: drifted ? { x: validated.x, y: validated.y, z: validated.z } : null,
        driftDetected: drifted,
        driftMagnitude: drifted ? validated.distanceTo(clamped) : 0,
        metadata: meta,
        timestamp: Date.now(),
        phiEntropy: (clamped.x * PHI + clamped.y * PHI ** 2 + clamped.z * PHI ** 3) % 1,
    };

    payload.receipt = crypto.createHash('sha256')
        .update(JSON.stringify({
            v: payload.version,
            s: payload.source,
            t: payload.target,
            c: payload.coordinates,
            ts: payload.timestamp,
        }))
        .digest('hex')
        .slice(0, 16);

    return Object.freeze(payload);
}

// ── VectorBridge Class ─────────────────────────────────────────

class VectorBridge {
    /**
     * @param {Object} opts
     * @param {string} opts.serviceId - This service's identifier
     * @param {Object} [opts.bounds] - Custom spatial bounds
     * @param {boolean} [opts.strictMode=true] - Reject drift instead of clamping
     */
    constructor(opts = {}) {
        this.serviceId = opts.serviceId || 'unknown';
        this.bounds = opts.bounds || COORD_BOUNDS;
        this.strictMode = opts.strictMode !== false;
        this._handshakeLog = [];
        this._maxLog = 500;
    }

    /**
     * Validate and prepare coordinates for outgoing transfer.
     * @param {string} targetService
     * @param {Vec3|{x,y,z}|number[]} coords
     * @param {Object} [meta]
     * @returns {Object} Frozen handshake
     */
    send(targetService, coords, meta = {}) {
        const handshake = createCoordHandshake(this.serviceId, targetService, coords, meta);

        if (this.strictMode && handshake.driftDetected) {
            throw new RangeError(
                `VectorBridge [STRICT]: coordinates out of bounds for ${this.serviceId}→${targetService}. ` +
                `Drift: ${handshake.driftMagnitude.toFixed(6)} units. ` +
                `Original: (${handshake.original.x}, ${handshake.original.y}, ${handshake.original.z})`
            );
        }

        this._log(handshake);
        return handshake;
    }

    /**
     * Validate incoming coordinates from another service.
     * @param {Object} handshake - A handshake object from another VectorBridge
     * @returns {Vec3} Validated Vec3
     * @throws {Error} If handshake is invalid
     */
    receive(handshake) {
        if (!handshake || handshake.version !== HANDSHAKE_VERSION) {
            throw new Error(`VectorBridge: invalid or version-mismatched handshake`);
        }
        if (handshake.target !== this.serviceId) {
            throw new Error(
                `VectorBridge: handshake target mismatch. Expected '${this.serviceId}', got '${handshake.target}'`
            );
        }

        const vec = validateVec3(handshake.coordinates, `receive:${handshake.source}`);

        if (!isInBounds(vec, this.bounds)) {
            throw new RangeError(
                `VectorBridge: received coordinates out of bounds from ${handshake.source}`
            );
        }

        return vec;
    }

    /**
     * Validate coordinates without creating a transfer. Utility method.
     * @param {*} coords
     * @returns {{ valid: boolean, vec3?: Vec3, error?: string }}
     */
    validate(coords) {
        try {
            const vec = validateVec3(coords, 'validate');
            const inBounds = isInBounds(vec, this.bounds);
            return { valid: inBounds, vec3: vec, inBounds, error: inBounds ? null : 'Out of bounds' };
        } catch (err) {
            return { valid: false, error: err.message };
        }
    }

    /**
     * Get the handshake audit log.
     * @param {number} [limit=50]
     * @returns {Array}
     */
    getLog(limit = 50) {
        return this._handshakeLog.slice(-limit).reverse();
    }

    _log(handshake) {
        this._handshakeLog.push({
            receipt: handshake.receipt,
            source: handshake.source,
            target: handshake.target,
            coords: handshake.coordinates,
            drift: handshake.driftDetected,
            ts: handshake.timestamp,
        });
        if (this._handshakeLog.length > this._maxLog) this._handshakeLog.shift();
    }

    /**
     * Get bridge health stats.
     */
    getHealth() {
        const log = this._handshakeLog;
        const driftCount = log.filter(l => l.drift).length;
        return {
            serviceId: this.serviceId,
            strictMode: this.strictMode,
            bounds: this.bounds,
            totalHandshakes: log.length,
            driftDetections: driftCount,
            driftRate: log.length > 0 ? (driftCount / log.length * 100).toFixed(2) + '%' : '0%',
        };
    }
}

// ── Express Route Registration ─────────────────────────────────
function registerVectorBridgeRoutes(app) {
    const bridge = new VectorBridge({ serviceId: 'heady-manager' });

    app.post('/api/vector-bridge/validate', (req, res) => {
        try {
            const result = bridge.validate(req.body.coordinates || req.body);
            res.json({ ok: true, ...result, coordinates: result.vec3 ? result.vec3.toArray() : null });
        } catch (err) {
            res.status(400).json({ ok: false, error: err.message });
        }
    });

    app.post('/api/vector-bridge/handshake', (req, res) => {
        try {
            const { target, coordinates, metadata } = req.body;
            const handshake = bridge.send(target || 'external', coordinates, metadata || {});
            res.json({ ok: true, handshake });
        } catch (err) {
            res.status(400).json({ ok: false, error: err.message });
        }
    });

    app.get('/api/vector-bridge/health', (_req, res) => {
        res.json({ ok: true, ...bridge.getHealth() });
    });

    app.get('/api/vector-bridge/log', (req, res) => {
        const limit = parseInt(req.query.limit) || 50;
        res.json({ ok: true, log: bridge.getLog(limit) });
    });

    return bridge;
}

module.exports = {
    validateVec3,
    clampToBounds,
    isInBounds,
    createCoordHandshake,
    VectorBridge,
    registerVectorBridgeRoutes,
    COORD_BOUNDS,
    HANDSHAKE_VERSION,
};
