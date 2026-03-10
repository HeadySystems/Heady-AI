/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Autonomy Guardrails — Operation Allowlist/Denylist
 * ═══════════════════════════════════════════════════
 * Defines the boundary of what autonomous agents can and cannot do.
 * Every production action requires Git-versioned approval trail.
 *
 * CSL confidence gating on risky operations:
 *   - PSI² (0.382): Requires human review
 *   - PSI  (0.618): Allowed with audit trail
 *   - CSL inject (0.718): Auto-approved
 */

'use strict';

// ─── φ-Math Constants ─────────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PSI = 1 / PHI;                     // ≈ 0.618
const PSI2 = PSI * PSI;                  // ≈ 0.382
const CSL_INJECT = PSI + 0.1;            // ≈ 0.718

// ─── Operation Categories ────────────────────────────────────────────────────

const ALLOWED_OPERATIONS = Object.freeze({
    // Development
    'code.read': { minConfidence: 0, description: 'Read source code files' },
    'code.write': { minConfidence: PSI2, description: 'Write/modify source code' },
    'code.lint': { minConfidence: 0, description: 'Run linting and formatting' },
    'code.test': { minConfidence: 0, description: 'Run test suites' },

    // Build & Deploy
    'build.local': { minConfidence: 0, description: 'Build locally' },
    'build.staging': { minConfidence: PSI2, description: 'Build for staging' },
    'deploy.staging': { minConfidence: PSI, description: 'Deploy to staging environment' },
    'deploy.canary': { minConfidence: PSI, description: 'Deploy canary release (< 6.18%)' },

    // Dependencies
    'deps.audit': { minConfidence: 0, description: 'Audit dependencies for vulnerabilities' },
    'deps.update.minor': { minConfidence: PSI2, description: 'Update minor/patch dependencies' },

    // Observability
    'observability.config': { minConfidence: PSI2, description: 'Generate observability configs' },
    'observability.dashboard': { minConfidence: PSI2, description: 'Create monitoring dashboards' },
    'logs.read': { minConfidence: 0, description: 'Read log entries' },
    'metrics.read': { minConfidence: 0, description: 'Read metrics' },

    // Documentation
    'docs.generate': { minConfidence: 0, description: 'Generate documentation' },
    'docs.update': { minConfidence: PSI2, description: 'Update documentation' },

    // Git
    'git.branch': { minConfidence: PSI2, description: 'Create feature branches' },
    'git.commit': { minConfidence: PSI2, description: 'Commit changes' },
    'git.pr.create': { minConfidence: PSI, description: 'Create pull requests' },
});

const FORBIDDEN_OPERATIONS = Object.freeze({
    'data.delete': 'Delete user data or database records',
    'data.export.bulk': 'Bulk export user data',

    'secrets.rotate.production': 'Rotate production secrets or API keys',
    'secrets.create.production': 'Create new production secrets',

    'auth.rules.modify': 'Modify authentication rules or RBAC policies',
    'auth.users.delete': 'Delete user accounts',

    'billing.modify': 'Change billing configuration, plans, or pricing',
    'billing.refund': 'Issue refunds',

    'deploy.production': 'Deploy directly to production (requires human approval)',

    'deps.update.major': 'Update major version dependencies',

    'infra.scale.down': 'Scale down infrastructure (min-instances, replicas)',
    'infra.delete': 'Delete infrastructure resources',

    'dns.modify': 'Modify DNS records',

    'git.force.push': 'Force push to protected branches',
    'git.branch.delete.main': 'Delete main/master branch',
});

// ─── Guardrail Engine ────────────────────────────────────────────────────────

class AutonomyGuardrails {
    /**
     * @param {object} [opts]
     * @param {Function} [opts.auditLogger] - (entry) => void — structured audit logger
     * @param {string}   [opts.agentId]     - Identifier for the requesting agent
     */
    constructor(opts = {}) {
        this._auditLogger = opts.auditLogger || _defaultAuditLogger;
        this._agentId = opts.agentId || 'unknown-agent';
        this._approvalOverrides = new Map(); // operation → { approvedBy, expiresAt }
    }

    /**
     * Check if an operation is permitted.
     *
     * @param {string} operation   - Operation key (e.g., 'deploy.staging')
     * @param {number} confidence  - CSL confidence score [0, 1]
     * @param {object} [context]   - Additional context for audit
     * @returns {{ permitted: boolean, reason: string, requiresApproval: boolean }}
     */
    check(operation, confidence = 0, context = {}) {
        // Check forbidden first
        if (FORBIDDEN_OPERATIONS[operation]) {
            const entry = {
                action: 'BLOCKED',
                operation,
                reason: FORBIDDEN_OPERATIONS[operation],
                confidence,
                agentId: this._agentId,
                timestamp: new Date().toISOString(),
                context,
            };
            this._auditLogger(entry);

            return {
                permitted: false,
                reason: `FORBIDDEN: ${FORBIDDEN_OPERATIONS[operation]}`,
                requiresApproval: false,
            };
        }

        // Check override approvals
        const override = this._approvalOverrides.get(operation);
        if (override && new Date(override.expiresAt) > new Date()) {
            const entry = {
                action: 'ALLOWED_OVERRIDE',
                operation,
                confidence,
                approvedBy: override.approvedBy,
                agentId: this._agentId,
                timestamp: new Date().toISOString(),
                context,
            };
            this._auditLogger(entry);

            return { permitted: true, reason: 'Approved by override', requiresApproval: false };
        }

        // Check allowed operations
        const allowed = ALLOWED_OPERATIONS[operation];
        if (!allowed) {
            const entry = {
                action: 'BLOCKED_UNKNOWN',
                operation,
                confidence,
                agentId: this._agentId,
                timestamp: new Date().toISOString(),
                context,
            };
            this._auditLogger(entry);

            return {
                permitted: false,
                reason: `UNKNOWN: Operation "${operation}" not in allowlist`,
                requiresApproval: true,
            };
        }

        // Check confidence meets minimum
        if (confidence < allowed.minConfidence) {
            const entry = {
                action: 'REQUIRES_APPROVAL',
                operation,
                confidence,
                minRequired: allowed.minConfidence,
                agentId: this._agentId,
                timestamp: new Date().toISOString(),
                context,
            };
            this._auditLogger(entry);

            return {
                permitted: false,
                reason: `Confidence ${confidence.toFixed(3)} below minimum ${allowed.minConfidence.toFixed(3)}`,
                requiresApproval: true,
            };
        }

        // Permitted
        const entry = {
            action: 'ALLOWED',
            operation,
            confidence,
            agentId: this._agentId,
            timestamp: new Date().toISOString(),
            context,
        };
        this._auditLogger(entry);

        return { permitted: true, reason: allowed.description, requiresApproval: false };
    }

    /**
     * Execute an operation with guardrail check.
     * @param {string} operation
     * @param {number} confidence
     * @param {Function} fn - The operation to execute
     * @param {object} [context]
     * @returns {*} Result of the operation
     * @throws {Error} If operation is not permitted
     */
    async execute(operation, confidence, fn, context = {}) {
        const result = this.check(operation, confidence, context);
        if (!result.permitted) {
            throw new GuardrailError(operation, result.reason, result.requiresApproval);
        }
        return fn();
    }

    /**
     * Register a human approval override for an operation.
     * @param {string} operation
     * @param {string} approvedBy - Human approver identifier
     * @param {number} [ttlMs]    - Override duration (default: 1 hour)
     */
    approve(operation, approvedBy, ttlMs = 3600000) {
        this._approvalOverrides.set(operation, {
            approvedBy,
            expiresAt: new Date(Date.now() + ttlMs).toISOString(),
        });

        this._auditLogger({
            action: 'APPROVAL_GRANTED',
            operation,
            approvedBy,
            expiresAt: new Date(Date.now() + ttlMs).toISOString(),
            agentId: this._agentId,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * List all operations and their status.
     */
    listOperations() {
        return {
            allowed: Object.entries(ALLOWED_OPERATIONS).map(([op, cfg]) => ({
                operation: op,
                minConfidence: cfg.minConfidence,
                description: cfg.description,
            })),
            forbidden: Object.entries(FORBIDDEN_OPERATIONS).map(([op, reason]) => ({
                operation: op,
                reason,
            })),
        };
    }
}

// ─── Custom Error ────────────────────────────────────────────────────────────

class GuardrailError extends Error {
    constructor(operation, reason, requiresApproval) {
        super(`Autonomy guardrail: ${operation} — ${reason}`);
        this.name = 'GuardrailError';
        this.code = 'HEADY-GUARDRAIL-001';
        this.operation = operation;
        this.requiresApproval = requiresApproval;
    }
}

// ─── Default Logger ──────────────────────────────────────────────────────────

function _defaultAuditLogger(entry) {
    process.stdout.write(JSON.stringify({ ...entry, service: 'autonomy-guardrails' }) + '\n');
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
    AutonomyGuardrails,
    GuardrailError,
    ALLOWED_OPERATIONS,
    FORBIDDEN_OPERATIONS,
};
