/**
 * Heady™ Project - Human-on-the-Loop Interstitial Gates
 *
 * Manages approval queues for high-stakes AI actions (e.g. database mutations,
 * financial transactions, system modifications, deployments, agent spawning).
 * Implements cryptographic receipt logic.
 *
 * Gate coverage:
 *   deploy              — Cloud Run / CF Workers / Docker deployments
 *   scale               — Instance count, concurrency, memory ceiling changes
 *   memory-write        — Writes to T0/T1/T2 persistent memory stores
 *   agent-spawn         — Spawning new agent instances or swarm bees
 *   config-modify       — Changes to YAML/JSON governance or service configs
 *   patent-locked-file-edit — Edits to HS-2026-051 … HS-2026-062 patent zones
 *   (generic)           — Any other high-stakes action via requestApproval()
 */

const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');

const AUDIT_DIR = path.join(__dirname, '../../data/receipts');

// ─── Gate intent constants ────────────────────────────────────────────────────
const GATE_INTENTS = Object.freeze({
    DEPLOY:               'deploy',
    SCALE:                'scale',
    MEMORY_WRITE:         'memory-write',
    AGENT_SPAWN:          'agent-spawn',
    CONFIG_MODIFY:        'config-modify',
    PATENT_LOCKED_EDIT:   'patent-locked-file-edit',
});

// ─── Risk levels mapped to required approval tier ────────────────────────────
const RISK_PROFILE = Object.freeze({
    [GATE_INTENTS.DEPLOY]:             { level: 'CRITICAL', requiresToken: true,  timeoutMs: 300_000 },
    [GATE_INTENTS.SCALE]:              { level: 'HIGH',     requiresToken: true,  timeoutMs: 180_000 },
    [GATE_INTENTS.MEMORY_WRITE]:       { level: 'MEDIUM',   requiresToken: false, timeoutMs: 120_000 },
    [GATE_INTENTS.AGENT_SPAWN]:        { level: 'HIGH',     requiresToken: true,  timeoutMs: 180_000 },
    [GATE_INTENTS.CONFIG_MODIFY]:      { level: 'CRITICAL', requiresToken: true,  timeoutMs: 300_000 },
    [GATE_INTENTS.PATENT_LOCKED_EDIT]: { level: 'CRITICAL', requiresToken: true,  timeoutMs: 600_000 },
});

// ─── Patent-locked file patterns (HS-2026-051 … HS-2026-062) ─────────────────
const PATENT_LOCK_PATTERNS = [
    /PATENT\s*LOCK/i,
    /HS-2026-05[1-9]/,
    /HS-2026-06[0-2]/,
];

class HumanApprovalGates {
    constructor() {
        this.pendingApprovals = new Map(); // id -> { intent, model, payload, status, expiresAt }

        if (!fs.existsSync(AUDIT_DIR)) {
            fs.mkdirSync(AUDIT_DIR, { recursive: true });
        }
    }

    // ─── Generic gate ──────────────────────────────────────────────────────────

    /**
     * Agent requests an action to be executed, but execution is halted pending human approval.
     */
    requestApproval(intent, modelDecision, toolsExecuted, projectedROI = null, meta = {}) {
        const id = randomUUID();
        const risk = RISK_PROFILE[intent] || { level: 'MEDIUM', requiresToken: false, timeoutMs: 120_000 };
        const request = {
            id,
            timestamp: Date.now(),
            expiresAt: Date.now() + risk.timeoutMs,
            intent,
            riskLevel: risk.level,
            requiresToken: risk.requiresToken,
            modelDecision,
            toolsExecuted,
            projectedROI,
            meta,
            status: 'PENDING',
        };

        this.pendingApprovals.set(id, request);
        this._expireStale();
        return id;
    }

    // ─── Intent-specific gate helpers ─────────────────────────────────────────

    /**
     * Gate: deploy — requires explicit approval token before any deployment executes.
     * @param {object} opts - { service, environment, image, canaryPercent }
     */
    requestDeployApproval(modelDecision, toolsExecuted, opts = {}) {
        if (!opts.service || !opts.environment) {
            throw new Error('deploy gate requires opts.service and opts.environment');
        }
        return this.requestApproval(
            GATE_INTENTS.DEPLOY,
            modelDecision,
            toolsExecuted,
            null,
            { service: opts.service, environment: opts.environment, image: opts.image, canaryPercent: opts.canaryPercent ?? 5 }
        );
    }

    /**
     * Gate: scale — any change to instance count, concurrency, or memory limits.
     * @param {object} opts - { service, fromReplicas, toReplicas, metric }
     */
    requestScaleApproval(modelDecision, toolsExecuted, opts = {}) {
        if (!opts.service) throw new Error('scale gate requires opts.service');
        return this.requestApproval(
            GATE_INTENTS.SCALE,
            modelDecision,
            toolsExecuted,
            null,
            { service: opts.service, fromReplicas: opts.fromReplicas, toReplicas: opts.toReplicas, metric: opts.metric }
        );
    }

    /**
     * Gate: memory-write — writes to T0 Redis, T1 pgvector, or T2 Qdrant stores.
     * @param {object} opts - { tier, namespace, keyCount }
     */
    requestMemoryWriteApproval(modelDecision, toolsExecuted, opts = {}) {
        const validTiers = ['T0', 'T1', 'T2'];
        if (!validTiers.includes(opts.tier)) {
            throw new Error(`memory-write gate requires opts.tier in ${validTiers.join('|')}`);
        }
        return this.requestApproval(
            GATE_INTENTS.MEMORY_WRITE,
            modelDecision,
            toolsExecuted,
            null,
            { tier: opts.tier, namespace: opts.namespace, keyCount: opts.keyCount }
        );
    }

    /**
     * Gate: agent-spawn — spawning any new agent instance or swarm bee.
     * @param {object} opts - { agentClass, beeType, maxConcurrency, parentSwarm }
     */
    requestAgentSpawnApproval(modelDecision, toolsExecuted, opts = {}) {
        if (!opts.agentClass) throw new Error('agent-spawn gate requires opts.agentClass');
        return this.requestApproval(
            GATE_INTENTS.AGENT_SPAWN,
            modelDecision,
            toolsExecuted,
            null,
            { agentClass: opts.agentClass, beeType: opts.beeType, maxConcurrency: opts.maxConcurrency, parentSwarm: opts.parentSwarm }
        );
    }

    /**
     * Gate: config-modify — changes to YAML/JSON governance or service configs.
     * @param {object} opts - { configFile, changeDescription }
     */
    requestConfigModifyApproval(modelDecision, toolsExecuted, opts = {}) {
        if (!opts.configFile) throw new Error('config-modify gate requires opts.configFile');
        return this.requestApproval(
            GATE_INTENTS.CONFIG_MODIFY,
            modelDecision,
            toolsExecuted,
            null,
            { configFile: opts.configFile, changeDescription: opts.changeDescription }
        );
    }

    /**
     * Gate: patent-locked-file-edit — any edit to a file marked ⚠️ PATENT LOCK
     * (patent IDs HS-2026-051 … HS-2026-062). Requires ARBITER swarm token.
     * @param {object} opts - { filePath, patentId, arbiterSwarmId }
     */
    requestPatentLockedEditApproval(modelDecision, toolsExecuted, opts = {}) {
        if (!opts.filePath) throw new Error('patent-locked-file-edit gate requires opts.filePath');
        if (!opts.patentId) throw new Error('patent-locked-file-edit gate requires opts.patentId');
        return this.requestApproval(
            GATE_INTENTS.PATENT_LOCKED_EDIT,
            modelDecision,
            toolsExecuted,
            null,
            { filePath: opts.filePath, patentId: opts.patentId, arbiterSwarmId: opts.arbiterSwarmId }
        );
    }

    // ─── Query helpers ────────────────────────────────────────────────────────

    /**
     * Fetches all pending approval gates (excluding expired).
     */
    getPending() {
        this._expireStale();
        return Array.from(this.pendingApprovals.values()).filter(a => a.status === 'PENDING');
    }

    /**
     * Returns whether the given intent requires an approval gate.
     */
    requiresApproval(intent) {
        return Object.values(GATE_INTENTS).includes(intent);
    }

    // ─── Resolution ───────────────────────────────────────────────────────────

    /**
     * Human operator approves or denies the action cryptographically.
     * For CRITICAL-level gates, approvalToken must be supplied.
     */
    resolveApproval(id, approved, operatorId, signature, approvalToken = null) {
        const req = this.pendingApprovals.get(id);
        if (!req) throw new Error('Gate ID not found or already processed.');

        if (Date.now() > req.expiresAt) {
            this.pendingApprovals.delete(id);
            throw new Error(`Gate ${id} expired — re-request required.`);
        }

        if (req.requiresToken && !approvalToken) {
            throw new Error(`Gate intent '${req.intent}' (${req.riskLevel}) requires an approvalToken.`);
        }

        req.status = approved ? 'APPROVED' : 'DENIED';
        req.operatorId = operatorId;
        req.signature = signature;
        req.approvalToken = approvalToken;
        req.resolvedAt = Date.now();

        this._generateReceipt(req);
        this.pendingApprovals.delete(id);

        return req;
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    /**
     * Expire stale PENDING gates that exceeded their timeout.
     */
    _expireStale() {
        const now = Date.now();
        for (const [id, req] of this.pendingApprovals.entries()) {
            if (req.status === 'PENDING' && now > req.expiresAt) {
                req.status = 'EXPIRED';
                this._generateReceipt(req);
                this.pendingApprovals.delete(id);
            }
        }
    }

    /**
     * "Proof View UI" Receipt Generation.
     * Immutable receipt detailing intent, routing, tools, validation, and ROI.
     */
    _generateReceipt(requestData) {
        const receipt = {
            receiptId: requestData.id,
            actionIntent: requestData.intent,
            riskLevel: requestData.riskLevel,
            routingDecision: requestData.modelDecision,
            toolsExecuted: requestData.toolsExecuted,
            meta: requestData.meta,
            validation: requestData.status === 'APPROVED'
                ? 'Human Verified: PASS'
                : requestData.status === 'EXPIRED'
                    ? 'Auto-Expired: TIMEOUT'
                    : 'Human Verified: DENIED',
            roi: requestData.projectedROI || 'N/A',
            operatorSignature: requestData.signature || null,
            approvalToken: requestData.approvalToken || null,
            timestamp: new Date().toISOString(),
        };

        const rPath = path.join(AUDIT_DIR, `${receipt.receiptId}.json`);
        fs.writeFileSync(rPath, JSON.stringify(receipt, null, 2));
    }
}

// ─── Static utility ──────────────────────────────────────────────────────────

/**
 * Returns true if the file content or path matches any patent-lock pattern.
 * Use in pre-commit hooks and CI checks.
 */
function isPatentLocked(filePathOrContent) {
    return PATENT_LOCK_PATTERNS.some(re => re.test(filePathOrContent));
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _gates = null;
function getApprovalGates() {
    if (!_gates) _gates = new HumanApprovalGates();
    return _gates;
}

module.exports = { HumanApprovalGates, getApprovalGates, GATE_INTENTS, RISK_PROFILE, isPatentLocked };
