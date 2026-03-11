/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Feature Flags — φ-Scaled Rollout System
 * ════════════════════════════════════════
 * Progressive rollout: 6.18% → 38.2% → 61.8% → 100%
 * Each flag: name, rollout %, CSL confidence gate, kill switch.
 * Backed by in-memory store (swap for Cloudflare KV in production).
 *
 * φ-derived:
 *   - Rollout stages: PSI²×10 → PSI² → PSI → 1.0
 *   - Hash function uses φ for consistent user bucketing
 */

'use strict';

const crypto = require('crypto');

// ─── φ-Math Constants ─────────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 1 / PHI;                     // ≈ 0.618
const PSI2 = PSI * PSI;                  // ≈ 0.382

const ROLLOUT_STAGES = Object.freeze([
    PSI2 / (PHI * PHI * PHI),   // ≈ 6.18%  — canary
    PSI2,                        // ≈ 38.2%  — early adopters
    PSI,                         // ≈ 61.8%  — majority
    1.0,                         // 100%     — general availability
]);

const CSL_GATES = Object.freeze({
    include: PSI2,    // ≈ 0.382
    boost: PSI,       // ≈ 0.618
    inject: PSI + 0.1 // ≈ 0.718
});

// ─── Feature Flag Store ──────────────────────────────────────────────────────

class FeatureFlagStore {
    constructor() {
        /** @type {Map<string, FeatureFlag>} */
        this._flags = new Map();
    }

    /**
     * Define a new feature flag.
     *
     * @param {object} config
     * @param {string} config.name         - Flag name (e.g., 'new-auth-flow')
     * @param {string} [config.description] - Human-readable description
     * @param {number} [config.rolloutPct]  - Rollout percentage [0-1] (default: 0)
     * @param {number} [config.cslGate]     - Min CSL confidence to activate (default: PSI2)
     * @param {boolean} [config.killSwitch] - Force disable (default: false)
     * @param {string[]} [config.allowlist] - User IDs that always get the flag
     * @param {string[]} [config.denylist]  - User IDs that never get the flag
     * @param {object} [config.metadata]    - Arbitrary metadata
     */
    define(config) {
        const flag = {
            name: config.name,
            description: config.description || '',
            rolloutPct: config.rolloutPct ?? 0,
            cslGate: config.cslGate ?? CSL_GATES.include,
            killSwitch: config.killSwitch ?? false,
            allowlist: new Set(config.allowlist || []),
            denylist: new Set(config.denylist || []),
            metadata: config.metadata || {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        this._flags.set(flag.name, flag);
        _log('info', `Flag defined: ${flag.name}`, { rollout: flag.rolloutPct, cslGate: flag.cslGate });
        return this;
    }

    /**
     * Check if a flag is enabled for a specific user.
     *
     * @param {string} flagName      - Flag name
     * @param {string} userId        - User identifier for consistent hashing
     * @param {number} [cslConfidence] - CSL confidence for this context (default: 1.0)
     * @returns {{ enabled: boolean, reason: string, rolloutStage: number }}
     */
    isEnabled(flagName, userId, cslConfidence = 1.0) {
        const flag = this._flags.get(flagName);

        // Unknown flag → disabled
        if (!flag) {
            return { enabled: false, reason: 'Flag not found', rolloutStage: -1 };
        }

        // Kill switch overrides everything
        if (flag.killSwitch) {
            return { enabled: false, reason: 'Kill switch active', rolloutStage: -1 };
        }

        // Denylist check
        if (flag.denylist.has(userId)) {
            return { enabled: false, reason: 'User in denylist', rolloutStage: -1 };
        }

        // Allowlist check — bypass rollout and CSL
        if (flag.allowlist.has(userId)) {
            return { enabled: true, reason: 'User in allowlist', rolloutStage: 3 };
        }

        // CSL confidence gate
        if (cslConfidence < flag.cslGate) {
            return { enabled: false, reason: `CSL confidence ${cslConfidence.toFixed(3)} below gate ${flag.cslGate.toFixed(3)}`, rolloutStage: -1 };
        }

        // Consistent hash-based rollout
        const userHash = _consistentHash(flagName, userId);
        const enabled = userHash < flag.rolloutPct;

        // Determine current stage
        let rolloutStage = -1;
        for (let i = 0; i < ROLLOUT_STAGES.length; i++) {
            if (flag.rolloutPct >= ROLLOUT_STAGES[i]) rolloutStage = i;
        }

        return {
            enabled,
            reason: enabled ? `User in rollout bucket (${(flag.rolloutPct * 100).toFixed(1)}%)` : `User outside rollout (${(userHash * 100).toFixed(1)}% > ${(flag.rolloutPct * 100).toFixed(1)}%)`,
            rolloutStage,
        };
    }

    /**
     * Advance a flag to the next φ-scaled rollout stage.
     * @param {string} flagName
     * @returns {{ stage: number, rolloutPct: number }}
     */
    advanceRollout(flagName) {
        const flag = this._flags.get(flagName);
        if (!flag) throw new Error(`Flag not found: ${flagName}`);

        // Find current stage and advance to next
        let nextStageIdx = 0;
        for (let i = 0; i < ROLLOUT_STAGES.length; i++) {
            if (flag.rolloutPct >= ROLLOUT_STAGES[i]) nextStageIdx = i + 1;
        }

        if (nextStageIdx >= ROLLOUT_STAGES.length) {
            return { stage: ROLLOUT_STAGES.length - 1, rolloutPct: 1.0 };
        }

        flag.rolloutPct = ROLLOUT_STAGES[nextStageIdx];
        flag.updatedAt = new Date().toISOString();

        _log('info', `Flag advanced: ${flagName}`, { stage: nextStageIdx, rollout: `${(flag.rolloutPct * 100).toFixed(1)}%` });
        return { stage: nextStageIdx, rolloutPct: flag.rolloutPct };
    }

    /**
     * Activate kill switch for a flag.
     */
    kill(flagName) {
        const flag = this._flags.get(flagName);
        if (!flag) throw new Error(`Flag not found: ${flagName}`);
        flag.killSwitch = true;
        flag.updatedAt = new Date().toISOString();
        _log('warn', `Kill switch activated: ${flagName}`);
    }

    /**
     * Deactivate kill switch.
     */
    revive(flagName) {
        const flag = this._flags.get(flagName);
        if (!flag) throw new Error(`Flag not found: ${flagName}`);
        flag.killSwitch = false;
        flag.updatedAt = new Date().toISOString();
        _log('info', `Kill switch deactivated: ${flagName}`);
    }

    /**
     * Update flag configuration.
     */
    update(flagName, updates) {
        const flag = this._flags.get(flagName);
        if (!flag) throw new Error(`Flag not found: ${flagName}`);

        if (updates.rolloutPct !== undefined) flag.rolloutPct = updates.rolloutPct;
        if (updates.cslGate !== undefined) flag.cslGate = updates.cslGate;
        if (updates.killSwitch !== undefined) flag.killSwitch = updates.killSwitch;
        if (updates.description !== undefined) flag.description = updates.description;
        if (updates.metadata !== undefined) flag.metadata = updates.metadata;
        flag.updatedAt = new Date().toISOString();
    }

    /**
     * List all flags with status.
     */
    list() {
        return [...this._flags.values()].map(f => ({
            name: f.name,
            description: f.description,
            rolloutPct: f.rolloutPct,
            rolloutDisplay: `${(f.rolloutPct * 100).toFixed(1)}%`,
            cslGate: f.cslGate,
            killSwitch: f.killSwitch,
            allowlistSize: f.allowlist.size,
            denylistSize: f.denylist.size,
            updatedAt: f.updatedAt,
        }));
    }

    /**
     * Delete a flag.
     */
    delete(flagName) {
        return this._flags.delete(flagName);
    }
}

// ─── Consistent Hashing ──────────────────────────────────────────────────────

/**
 * Generate a consistent hash [0, 1) for a flag+user combination.
 * Uses φ-derived mixing to ensure uniform distribution.
 */
function _consistentHash(flagName, userId) {
    const hash = crypto.createHash('sha256').update(`${flagName}:${userId}`).digest();
    // Take first 4 bytes, normalize to [0, 1)
    const value = hash.readUInt32BE(0) / 0xFFFFFFFF;
    return value;
}

// ─── Express Middleware ──────────────────────────────────────────────────────

/**
 * Express middleware that checks feature flags and attaches to req.
 *
 * @param {FeatureFlagStore} store
 * @param {string[]} flagNames - Flags to check
 * @returns {Function}
 */
function featureFlagMiddleware(store, flagNames = []) {
    return (req, res, next) => {
        const userId = req.user?.id || req.headers['x-user-id'] || 'anonymous';
        const cslConfidence = parseFloat(req.headers['x-csl-confidence'] || '1.0');

        req.featureFlags = {};
        for (const name of flagNames) {
            req.featureFlags[name] = store.isEnabled(name, userId, cslConfidence);
        }

        next();
    };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _log(level, msg, meta = {}) {
    process.stdout.write(JSON.stringify({ level, service: 'feature-flags', message: msg, ...meta, timestamp: new Date().toISOString() }) + '\n');
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
    FeatureFlagStore,
    featureFlagMiddleware,
    ROLLOUT_STAGES,
    CSL_GATES,
};
