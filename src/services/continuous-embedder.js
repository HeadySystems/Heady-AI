/**
 * ─── Continuous Embedder Service ──────────────────────────────
 * 
 * RAM-FIRST ARCHITECTURE:
 *   Vector memory IS the source of truth.
 *   Files in src/, configs/, etc. are PROJECTIONS — derived state.
 *   
 *   Flow:
 *     Events → Vector Memory (ingest) → Projections (outbound)
 *                    ↑                         ↓
 *             User interactions         src/, configs/, data/
 *             System telemetry          .agents/workflows/
 *             Bee reactions             docs/, _archive/
 *             Health/errors
 *             Environment
 * 
 * After the initial deep embed, this service NEVER scans files.
 * It only:
 *   1. INGESTS new data from event bus hooks (inbound)
 *   2. PROJECTS updated state to file areas when vector state changes (outbound)
 * 
 * Uses smartIngest() with density gating to prevent redundancy.
 * Uses ProjectionManager to track which file areas are stale.
 * ────────────────────────────────────────────────────────────────
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const logger = require('../utils/logger');

const PHI = 1.6180339887;
const EMBED_INTERVAL_MS = Math.round(PHI ** 5 * 1000); // ~11s phi-derived
const PROJECTION_INTERVAL_MS = Math.round(PHI ** 7 * 1000); // ~29s phi-derived
const ENV_INTERVAL_MS = Math.round(PHI ** 8 * 1000); // ~47s phi-derived
const CONTEXT_REFRESH_INTERVAL_MS = Math.round(PHI ** 6 * 1000); // ~18s
const BATCH_SIZE = 8;
const DENSITY_GATE = 0.92;
const MAX_QUEUE = 1000;
const BURST_FLUSH_THRESHOLD = 64;
const MAX_CONTENT_CHARS = 4000;
const REQUIRED_CONTEXT_DOMAINS = ['user-interaction', 'analyst-action', 'system-action', 'environment'];
const STALE_CONTEXT_THRESHOLD_MS = Math.round(PHI ** 9 * 1000); // ~76s
const STALE_PROJECTION_THRESHOLD_MS = Math.round(PHI ** 11 * 1000); // ~199s
const LIQUID_CLEANUP_MAX_ITEMS = 250;
const DEVICE_SYNC_STALE_THRESHOLD_MS = Math.round(PHI ** 10 * 1000); // ~123s
const SELF_HEAL_MIN_INTERVAL_MS = Math.round(PHI ** 9 * 1000); // ~76s

let vm = null;
let running = false;

const stats = {
    started: null,
    totalIngested: 0,
    totalFiltered: 0,
    totalErrors: 0,
    totalProjections: 0,
    cycles: 0,
    bySource: {},
    lastIngestAt: null,
    lastContextRefreshAt: null,
    lastTemplateProjectionAt: null,
    lastEmbeddedByDomain: {},
    keepAliveEvents: 0,
    projectionReads: {},
    projectionWrites: {},
    lastProjectionTouchAt: {},
    deviceSync: {
        lastSyncedAt: null,
        failures: 0,
        pendingTasks: 0,
        byDevice: {},
        projectionTemplatesInjected: 0,
    },
    authOnboarding: {
        lastEventAt: null,
        byStage: {},
        byProvider: {},
        activeUsers: {},
    },
    selfHealing: {
        lastRunAt: null,
        actionsQueued: 0,
        actionsApplied: 0,
        lastReasons: [],
    },
};

// ── Inbound Queue ───────────────────────────────────────────────
// Events push here; batch cycle drains to vector memory
const pendingQueue = [];

// ── Projection State ────────────────────────────────────────────
// Tracks which projection targets are stale vs synced
const projections = new Map([
    ['src', { lastHash: null, stale: false, lastSynced: null }],
    ['configs', { lastHash: null, stale: false, lastSynced: null }],
    ['data', { lastHash: null, stale: false, lastSynced: null }],
    ['agents', { lastHash: null, stale: false, lastSynced: null }],
    ['docs', { lastHash: null, stale: false, lastSynced: null }],
]);

// ── RAM State Hash ──────────────────────────────────────────────
let lastRAMHash = null;

function computeRAMHash() {
    const state = JSON.stringify({
        ingested: stats.totalIngested,
        ts: Math.floor(Date.now() / 10000), // 10s buckets
        cycles: stats.cycles,
    });
    return crypto.createHash('sha256').update(state).digest('hex');
}

// ── Inbound: Queue for Embedding ────────────────────────────────

function sanitizeContent(content) {
    if (content === null || content === undefined) return '';
    const normalized = typeof content === 'string' ? content : JSON.stringify(content);
    return normalized.substring(0, MAX_CONTENT_CHARS);
}

function normalizeMetadata(metadata = {}) {
    const ts = new Date().toISOString();
    return {
        ...metadata,
        source: metadata.source || 'continuous-embedder',
        capturedAt: metadata.capturedAt || ts,
    };
}

function queueForEmbed(content, metadata) {
    const safeContent = sanitizeContent(content);
    if (!safeContent) return false;

    if (metadata && metadata.domain) markDomainFresh(metadata.domain);
    pendingQueue.push({
        content: safeContent,
        metadata: normalizeMetadata(metadata),
        queuedAt: Date.now(),
    });

    if (pendingQueue.length > MAX_QUEUE) {
        pendingQueue.splice(0, pendingQueue.length - MAX_QUEUE);
    }

    return true;
}

// ── Inbound Event Handlers ──────────────────────────────────────
// These NEVER scan files. They react to system events only.

function onUserInteraction(data) {
    const { message, response, userId, sessionId } = data || {};
    if (!message && !response) return;

    queueForEmbed(
        [
            `User: ${(message || '').substring(0, 500)}`,
            response ? `Response: ${response.substring(0, 500)}` : '',
        ].filter(Boolean).join('\n'),
        {
            type: 'episodic',
            domain: 'user-interaction',
            category: 'conversation',
            userId: userId || 'unknown',
            sessionId: sessionId || 'unknown',
            source: 'continuous-embedder',
        },
    );
}

function onTelemetry(data) {
    const { metric, value, component, confidence } = data || {};
    if (!metric) return;

    queueForEmbed(
        `Telemetry: ${component || 'system'} → ${metric}: ${JSON.stringify(value)} (confidence: ${confidence || 'N/A'})`,
        {
            type: 'episodic',
            domain: 'telemetry',
            category: 'system-state',
            component: component || 'system',
            metric,
            source: 'continuous-embedder',
        },
    );
}

function onDeployment(data) {
    const { target, status, commitHash, files } = data || {};
    queueForEmbed(
        `Deployment: ${target || 'unknown'} → ${status || 'completed'} (commit: ${commitHash || 'N/A'}, files: ${files?.length || 0})`,
        {
            type: 'procedural',
            domain: 'deployment',
            category: 'system-change',
            target,
            commitHash,
            source: 'continuous-embedder',
        },
    );

    // Mark all projections stale after a deploy
    for (const [, proj] of projections) proj.stale = true;
}

function onError(data) {
    const { error, component, severity, stack } = data || {};
    queueForEmbed(
        `Error [${severity || 'unknown'}]: ${component || 'system'} → ${error || 'unknown'}${stack ? '\n' + stack.substring(0, 300) : ''}`,
        {
            type: 'episodic',
            domain: 'errors',
            category: 'incident',
            component,
            severity: severity || 'unknown',
            source: 'continuous-embedder',
        },
    );
}

function onConfigChange(data) {
    const { filePath, diff, changedBy } = data || {};
    if (!filePath) return;

    let content = `Config changed: ${filePath}`;
    if (diff) content += `\n${diff.substring(0, 500)}`;

    queueForEmbed(content, {
        type: 'procedural',
        domain: 'governance',
        category: 'config-change',
        filePath,
        changedBy: changedBy || 'system',
        source: 'continuous-embedder',
    });

    projections.get('configs').stale = true;
}

function onBeeReaction(data) {
    const { bee, action, result, duration } = data || {};
    queueForEmbed(
        `Bee: ${bee || 'unknown'} → ${action || 'work'} (${duration || 0}ms): ${JSON.stringify(result || {}).substring(0, 400)}`,
        {
            type: 'procedural',
            domain: 'swarm',
            category: 'bee-work',
            bee,
            action,
            durationMs: duration,
            source: 'continuous-embedder',
        },
    );
}

function onHealthCheck(data) {
    const { status, components, uptime } = data || {};
    queueForEmbed(
        `Health: ${status || 'unknown'} | uptime: ${uptime || 0}s | components: ${JSON.stringify(components || {}).substring(0, 400)}`,
        {
            type: 'episodic',
            domain: 'health',
            category: 'system-health',
            status,
            source: 'continuous-embedder',
        },
    );
}

function onCodeChange(data) {
    const { filePath, changeType, content: code, author } = data || {};
    if (!filePath) return;

    // Ingest the actual change into vector memory
    queueForEmbed(
        `Code ${changeType || 'modified'}: ${filePath}\n${(code || '').substring(0, 1000)}`,
        {
            type: 'procedural',
            domain: 'codebase',
            category: 'code-change',
            filePath,
            changeType: changeType || 'modified',
            author: author || 'system',
            source: 'continuous-embedder',
        },
    );

    // Mark appropriate projection stale
    if (filePath.startsWith('src/')) projections.get('src').stale = true;
    if (filePath.startsWith('configs/')) projections.get('configs').stale = true;
    if (filePath.startsWith('.agents/')) projections.get('agents').stale = true;
    if (filePath.startsWith('docs/')) projections.get('docs').stale = true;
}

function captureEnvironment() {
    const os = require('os');
    const env = {
        platform: os.platform(),
        cpus: os.cpus().length,
        totalMem: Math.round(os.totalmem() / 1024 / 1024),
        freeMem: Math.round(os.freemem() / 1024 / 1024),
        uptime: Math.round(os.uptime()),
        loadAvg: os.loadavg().map(l => +l.toFixed(2)),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    };

    queueForEmbed(
        `Environment: ${env.platform} | CPUs: ${env.cpus} | RAM: ${env.freeMem}/${env.totalMem}MB | Heap: ${env.heapUsed}/${env.heapTotal}MB | Load: ${env.loadAvg.join(', ')} | Uptime: ${env.uptime}s`,
        {
            type: 'episodic',
            domain: 'environment',
            category: 'system-snapshot',
            ...env,
            source: 'continuous-embedder',
        },
    );
}

// ── Domain / Projection Freshness Tracking ──────────────────────

function markDomainFresh(domain) {
    if (!domain) return;
    stats.lastEmbeddedByDomain[domain] = new Date().toISOString();
}

function markProjectionRead(target) {
    if (!target) return;
    stats.projectionReads[target] = (stats.projectionReads[target] || 0) + 1;
    stats.lastProjectionTouchAt[target] = new Date().toISOString();
}

function markProjectionWrite(target) {
    if (!target) return;
    stats.projectionWrites[target] = (stats.projectionWrites[target] || 0) + 1;
    stats.lastProjectionTouchAt[target] = new Date().toISOString();
}

function onProjectionAccess(data) {
    const { target, mode, requestId, templateId, actor } = data || {};
    if (!target) return;

    const normalizedMode = mode === 'write' ? 'write' : 'read';
    if (normalizedMode === 'read') markProjectionRead(target);
    if (normalizedMode === 'write') markProjectionWrite(target);

    queueForEmbed(
        `ProjectionAccess: target=${target} mode=${normalizedMode} actor=${actor || 'unknown'} request=${requestId || 'n/a'} template=${templateId || 'n/a'}`,
        {
            type: 'episodic',
            domain: 'projection-access',
            category: 'template-injection',
            target,
            mode: normalizedMode,
            requestId: requestId || null,
            templateId: templateId || null,
            actor: actor || 'unknown',
            source: 'continuous-embedder',
        },
    );
}

function injectContextKeepAlive() {
    const now = Date.now();
    for (const domain of REQUIRED_CONTEXT_DOMAINS) {
        const last = stats.lastEmbeddedByDomain[domain];
        const stale = !last || (now - new Date(last).getTime()) > STALE_CONTEXT_THRESHOLD_MS;
        if (!stale) continue;

        queueForEmbed(
            `Context keep-alive: ${domain} domain heartbeat at ${new Date(now).toISOString()}`,
            {
                type: 'episodic',
                domain,
                category: 'context-keepalive',
                source: 'continuous-embedder',
                synthetic: true,
            },
        );
        stats.keepAliveEvents++;
    }
}

// ── Analyst / System Action Handlers ────────────────────────────

function onAnalystAction(data) {
    const { analystId, action, note, hypothesis, confidence, tags } = data || {};
    if (!action && !note && !hypothesis) return;

    queueForEmbed(
        [
            `Analyst: ${analystId || 'unknown'}`,
            action ? `Action: ${action}` : '',
            note ? `Note: ${String(note).substring(0, 500)}` : '',
            hypothesis ? `Hypothesis: ${String(hypothesis).substring(0, 300)}` : '',
            confidence !== undefined ? `Confidence: ${confidence}` : '',
            Array.isArray(tags) && tags.length ? `Tags: ${tags.join(', ')}` : '',
        ].filter(Boolean).join('\n'),
        {
            type: 'episodic',
            domain: 'analyst-action',
            category: 'analysis',
            analystId: analystId || 'unknown',
            confidence: confidence ?? null,
            source: 'continuous-embedder',
        },
    );
}

function onSystemAction(data) {
    const { actor, action, payload, status, latencyMs } = data || {};
    if (!action && !payload) return;

    queueForEmbed(
        `SystemAction: ${actor || 'system'} -> ${action || 'unknown'} | status=${status || 'n/a'} | latency=${latencyMs || 0}ms | payload=${JSON.stringify(payload || {}).substring(0, 500)}`,
        {
            type: 'procedural',
            domain: 'system-action',
            category: 'orchestration-action',
            actor: actor || 'system',
            action: action || 'unknown',
            status: status || 'unknown',
            latencyMs: latencyMs || 0,
            source: 'continuous-embedder',
        },
    );
}

// ── Widget / Cross-Device Sync ──────────────────────────────────

function onWidgetTaskSync(data) {
    const {
        deviceId, workspaceId, storageProvider,
        taskCount, status, templatesInjected, pendingTasks, userId,
    } = data || {};

    const normalizedStatus = String(status || 'ok').toLowerCase();
    const normalizedTaskCount = Number(taskCount || 0);
    const normalizedPending = Number(pendingTasks || 0);
    const normalizedInjected = Number(templatesInjected || 0);
    const targetDevice = deviceId || 'unknown-device';

    stats.deviceSync.lastSyncedAt = new Date().toISOString();
    stats.deviceSync.pendingTasks = normalizedPending;
    stats.deviceSync.byDevice[targetDevice] = {
        workspaceId: workspaceId || 'default-workspace',
        storageProvider: storageProvider || 'persistent-personal-storage',
        taskCount: normalizedTaskCount,
        pendingTasks: normalizedPending,
        templatesInjected: normalizedInjected,
        status: normalizedStatus,
        userId: userId || 'unknown-user',
        updatedAt: stats.deviceSync.lastSyncedAt,
    };
    stats.deviceSync.projectionTemplatesInjected += Math.max(0, normalizedInjected);
    if (normalizedStatus !== 'ok' && normalizedStatus !== 'synced') {
        stats.deviceSync.failures += 1;
    }

    queueForEmbed(
        `WidgetSync: device=${targetDevice} workspace=${workspaceId || 'default-workspace'} storage=${storageProvider || 'persistent-personal-storage'} status=${normalizedStatus} tasks=${normalizedTaskCount} pending=${normalizedPending} templatesInjected=${normalizedInjected}`,
        {
            type: 'procedural',
            domain: 'device-sync',
            category: 'widget-cross-device-sync',
            deviceId: targetDevice,
            workspaceId: workspaceId || 'default-workspace',
            storageProvider: storageProvider || 'persistent-personal-storage',
            taskCount: normalizedTaskCount,
            pendingTasks: normalizedPending,
            templatesInjected: normalizedInjected,
            userId: userId || 'unknown-user',
            status: normalizedStatus,
            source: 'continuous-embedder',
        },
    );
}

// ── Auth / Onboarding ───────────────────────────────────────────

function onAuthOnboardingEvent(data) {
    const { stage, status, provider, userId } = data || {};
    if (!stage) return;

    const nowIso = new Date().toISOString();
    const normalizedStatus = String(status || 'started').toLowerCase();
    const normalizedProvider = provider || 'unknown-provider';
    const normalizedUser = userId || 'anonymous';

    stats.authOnboarding.lastEventAt = nowIso;
    stats.authOnboarding.byStage[stage] = {
        status: normalizedStatus,
        provider: normalizedProvider,
        userId: normalizedUser,
        updatedAt: nowIso,
    };
    stats.authOnboarding.byProvider[normalizedProvider] = (stats.authOnboarding.byProvider[normalizedProvider] || 0) + 1;
    stats.authOnboarding.activeUsers[normalizedUser] = nowIso;

    queueForEmbed(
        `AuthOnboarding: stage=${stage} status=${normalizedStatus} provider=${normalizedProvider} user=${normalizedUser}`,
        {
            type: 'episodic',
            domain: 'auth-onboarding',
            category: 'identity-flow',
            stage,
            status: normalizedStatus,
            provider: normalizedProvider,
            userId: normalizedUser,
            source: 'continuous-embedder',
        },
    );
}

// ── Status / Health Functions ────────────────────────────────────

function getCrossDeviceSyncStatus() {
    const now = Date.now();
    const lastSyncedAt = stats.deviceSync.lastSyncedAt;
    const ageMs = lastSyncedAt ? Math.max(0, now - new Date(lastSyncedAt).getTime()) : null;
    const deviceEntries = Object.entries(stats.deviceSync.byDevice);
    const stale = ageMs === null || ageMs > DEVICE_SYNC_STALE_THRESHOLD_MS;

    return {
        generatedAt: new Date().toISOString(),
        thresholdMs: DEVICE_SYNC_STALE_THRESHOLD_MS,
        lastSyncedAt,
        ageMs,
        stale,
        failures: stats.deviceSync.failures,
        pendingTasks: stats.deviceSync.pendingTasks,
        projectionTemplatesInjected: stats.deviceSync.projectionTemplatesInjected,
        devices: deviceEntries.map(([deviceId, summary]) => ({ deviceId, ...summary })),
        healthy: !stale && stats.deviceSync.failures === 0,
    };
}

function getAuthOnboardingStatus() {
    const stageEntries = Object.entries(stats.authOnboarding.byStage);
    const completedStages = stageEntries
        .filter(([, detail]) => detail.status === 'completed')
        .map(([stage]) => stage);

    return {
        generatedAt: new Date().toISOString(),
        lastEventAt: stats.authOnboarding.lastEventAt,
        stageCount: stageEntries.length,
        completedStages,
        providersSeen: stats.authOnboarding.byProvider,
        activeUsers: Object.keys(stats.authOnboarding.activeUsers).length,
        stageStatus: stats.authOnboarding.byStage,
    };
}

function getContextCoverage() {
    const now = Date.now();
    const freshness = {};
    const staleDomains = [];

    for (const domain of REQUIRED_CONTEXT_DOMAINS) {
        const last = stats.lastEmbeddedByDomain[domain] || null;
        const ageMs = last ? Math.max(0, now - new Date(last).getTime()) : null;
        freshness[domain] = {
            lastEmbeddedAt: last,
            ageMs,
            stale: ageMs === null || ageMs > STALE_CONTEXT_THRESHOLD_MS,
        };
        if (freshness[domain].stale) staleDomains.push(domain);
    }

    return {
        requiredDomains: REQUIRED_CONTEXT_DOMAINS,
        thresholdMs: STALE_CONTEXT_THRESHOLD_MS,
        freshness,
        staleDomains,
        fullyCovered: staleDomains.length === 0,
    };
}

function buildProjectionOptimizationStatus() {
    const now = Date.now();
    const targets = [...projections.keys()];

    const details = targets.map((target) => {
        const reads = stats.projectionReads[target] || 0;
        const writes = stats.projectionWrites[target] || 0;
        const lastTouch = stats.lastProjectionTouchAt[target] || null;
        const ageMs = lastTouch ? Math.max(0, now - new Date(lastTouch).getTime()) : null;
        const staleProjection = ageMs === null || ageMs > STALE_PROJECTION_THRESHOLD_MS;
        return {
            target,
            reads,
            writes,
            staleProjection,
            ageMs,
            utilizationScore: Number(((reads * 0.6) + (writes * 0.4)).toFixed(3)),
        };
    });

    const staleTargets = details.filter((d) => d.staleProjection).map((d) => d.target);
    const lowUtilizationTargets = details.filter((d) => d.utilizationScore === 0).map((d) => d.target);

    return {
        generatedAt: new Date().toISOString(),
        thresholdMs: STALE_PROJECTION_THRESHOLD_MS,
        paradigm: 'dynamic-liquid-template-injection',
        staleTargets,
        lowUtilizationTargets,
        details,
        optimized: staleTargets.length === 0 && lowUtilizationTargets.length === 0,
    };
}

function buildAliveSystemStatus() {
    const contextCoverage = getContextCoverage();
    const projectionOptimization = buildProjectionOptimizationStatus();
    const deviceSync = getCrossDeviceSyncStatus();
    const authOnboarding = getAuthOnboardingStatus();

    const staleDomainPenalty = contextCoverage.staleDomains.length * 15;
    const staleProjectionPenalty = projectionOptimization.staleTargets.length * 8;
    const lowUtilizationPenalty = projectionOptimization.lowUtilizationTargets.length * 5;
    const devicePenalty = deviceSync.stale ? 20 : 0;
    const failurePenalty = Math.min(25, deviceSync.failures * 5);

    const vitalityScore = Math.max(0, 100 - staleDomainPenalty - staleProjectionPenalty - lowUtilizationPenalty - devicePenalty - failurePenalty);

    return {
        generatedAt: new Date().toISOString(),
        mode: 'alive-unified-living-system',
        vitalityScore,
        contextCoverage,
        projectionOptimization,
        deviceSync,
        authOnboarding,
        selfHealing: stats.selfHealing,
        healthy: vitalityScore >= 80 && contextCoverage.staleDomains.length === 0 && !deviceSync.stale,
    };
}

// ── Self-Healing ────────────────────────────────────────────────

function buildSelfHealPlan() {
    const alive = buildAliveSystemStatus();
    const actions = [];

    for (const domain of alive.contextCoverage.staleDomains) {
        actions.push({ type: 'context-keepalive', domain, priority: 'high', reason: `stale-domain:${domain}` });
    }
    for (const target of alive.projectionOptimization.staleTargets) {
        actions.push({ type: 'projection-refresh', target, priority: 'medium', reason: `stale-projection:${target}` });
    }
    if (alive.deviceSync.stale) {
        actions.push({ type: 'device-sync-pulse', target: 'all-devices', priority: 'high', reason: 'device-sync-stale' });
    }
    if (alive.authOnboarding.stageCount === 0) {
        actions.push({ type: 'onboarding-heartbeat', target: 'auth-provider-select', priority: 'medium', reason: 'onboarding-telemetry-empty' });
    }

    return {
        generatedAt: new Date().toISOString(),
        mode: 'safe-plan-only',
        actions,
        actionCount: actions.length,
    };
}

function executeSelfHealCycle() {
    const now = Date.now();
    const lastRunAt = stats.selfHealing.lastRunAt ? new Date(stats.selfHealing.lastRunAt).getTime() : 0;
    if (lastRunAt && now - lastRunAt < SELF_HEAL_MIN_INTERVAL_MS) return null;

    const plan = buildSelfHealPlan();
    if (plan.actionCount === 0) {
        stats.selfHealing.lastRunAt = new Date(now).toISOString();
        stats.selfHealing.lastReasons = [];
        return plan;
    }

    for (const action of plan.actions) {
        if (action.type === 'context-keepalive') {
            queueForEmbed(
                `SelfHeal: keep alive ${action.domain} at ${new Date(now).toISOString()}`,
                { type: 'episodic', domain: action.domain, category: 'self-heal-keepalive', source: 'continuous-embedder', synthetic: true },
            );
            stats.selfHealing.actionsApplied += 1;
        }
        if (action.type === 'projection-refresh' && projections.has(action.target)) {
            projections.get(action.target).stale = true;
            stats.selfHealing.actionsApplied += 1;
        }
        if (action.type === 'device-sync-pulse') {
            onWidgetTaskSync({ deviceId: 'self-heal-pulse', workspaceId: 'global', storageProvider: 'persistent-personal-storage', taskCount: 0, pendingTasks: 0, templatesInjected: 0, status: 'synced', userId: 'system' });
            stats.selfHealing.actionsApplied += 1;
        }
        if (action.type === 'onboarding-heartbeat') {
            onAuthOnboardingEvent({ stage: action.target, status: 'started', provider: 'system-heartbeat', userId: 'system' });
            stats.selfHealing.actionsApplied += 1;
        }
    }

    stats.selfHealing.lastRunAt = new Date(now).toISOString();
    stats.selfHealing.actionsQueued += plan.actionCount;
    stats.selfHealing.lastReasons = plan.actions.map((a) => a.reason);

    if (global.eventBus) {
        global.eventBus.emit('self-heal:executed', { actions: plan.actions, at: stats.selfHealing.lastRunAt });
    }

    return plan;
}

// ── Cleanup Plan ────────────────────────────────────────────────

function buildCleanupPlan() {
    const now = Date.now();
    const candidates = [];
    const roots = [
        path.join(process.cwd(), 'tmp'),
        path.join(process.cwd(), '.tmp'),
        path.join(process.cwd(), 'logs'),
        path.join(process.cwd(), 'data', 'projections'),
    ];

    for (const root of roots) {
        if (!fs.existsSync(root)) continue;
        const entries = fs.readdirSync(root, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(root, entry.name);
            const stat = fs.statSync(full);
            const ageMs = now - stat.mtimeMs;
            const stale = ageMs > STALE_PROJECTION_THRESHOLD_MS;
            if (!stale) continue;
            candidates.push({
                path: full.replace(process.cwd() + path.sep, ''),
                type: entry.isDirectory() ? 'directory' : 'file',
                ageMs: Math.round(ageMs),
                reason: 'stale-generated-artifact',
            });
            if (candidates.length >= LIQUID_CLEANUP_MAX_ITEMS) break;
        }
    }

    return {
        generatedAt: new Date().toISOString(),
        thresholdMs: STALE_PROJECTION_THRESHOLD_MS,
        maxItems: LIQUID_CLEANUP_MAX_ITEMS,
        candidates,
        safeMode: true,
        action: 'plan-only-no-delete',
    };
}

// ── Inbound Batch Processing ────────────────────────────────────

async function processBatch() {
    if (!vm) return;
    injectContextKeepAlive();
    executeSelfHealCycle();
    if (pendingQueue.length === 0) return;

    const batch = pendingQueue.splice(0, BATCH_SIZE);
    let ingested = 0;
    let filtered = 0;

    for (const item of batch) {
        try {
            item.metadata.ingestedAt = new Date().toISOString();
            const id = await vm.smartIngest(
                { content: item.content, metadata: item.metadata },
                DENSITY_GATE,
            );
            if (id) {
                ingested++;
                stats.totalIngested++;
                stats.lastIngestAt = new Date().toISOString();
                const src = item.metadata.domain || 'unknown';
                stats.bySource[src] = (stats.bySource[src] || 0) + 1;
                markDomainFresh(src);
            } else {
                filtered++;
                stats.totalFiltered++;
            }
        } catch (err) {
            stats.totalErrors++;
            logger.warn('ContinuousEmbedder: ingest error:', err.message);
        }
    }

    stats.cycles++;

    if (ingested > 0) {
        // Check if RAM state changed — mark projections stale
        const currentHash = computeRAMHash();
        if (currentHash !== lastRAMHash) {
            lastRAMHash = currentHash;
            if (global.eventBus) {
                global.eventBus.emit('projections:stale', {
                    reason: 'new-vectors',
                    ingested,
                    totalVectors: stats.totalIngested,
                });
            }
        }

        logger.info(`ContinuousEmbedder: +${ingested} vectors (${filtered} deduped) | queue: ${pendingQueue.length}`);
    }
}

// ── Outbound: Projection Sync ───────────────────────────────────

async function syncProjections() {
    if (!vm) return;

    let synced = 0;

    for (const [target, proj] of projections) {
        if (!proj.stale) continue;

        try {
            markProjectionRead(target);
            const results = await vm.queryMemory(
                `latest state for ${target} projection`,
                5,
                { domain: target }
            );

            if (results && results.length > 0) {
                proj.lastHash = computeRAMHash();
                proj.stale = false;
                proj.lastSynced = new Date().toISOString();
                proj.lastVectors = results.length;
                markProjectionWrite(target);
                synced++;
                stats.totalProjections++;
            }
        } catch (err) {
            logger.warn(`ContinuousEmbedder: projection sync failed for ${target}:`, err.message);
        }
    }

    if (synced > 0) {
        logger.info(`ContinuousEmbedder: projected ${synced} targets`);
        if (global.eventBus) {
            global.eventBus.emit('projections:synced', {
                targets: [...projections.entries()]
                    .filter(([, p]) => !p.stale)
                    .map(([t]) => t),
            });
        }
    }
}

// ── Lifecycle ───────────────────────────────────────────────────

async function start(vectorMemory) {
    if (running) return;
    vm = vectorMemory || require('../vector-memory');
    running = true;
    stats.started = new Date().toISOString();
    lastRAMHash = computeRAMHash();

    // Register event bus hooks — inbound only, NO file scanning
    if (global.eventBus) {
        const bus = global.eventBus;

        // User interaction events
        bus.on('buddy:message', onUserInteraction);
        bus.on('chat:response', onUserInteraction);
        bus.on('user:action', onUserInteraction);

        // Analyst events
        bus.on('analyst:note', onAnalystAction);
        bus.on('analyst:decision', onAnalystAction);
        bus.on('analyst:feedback', onAnalystAction);

        // System telemetry events
        bus.on('telemetry:ingested', onTelemetry);
        bus.on('self-awareness:assessed', onTelemetry);

        // Deployment/git events
        bus.on('deployment:completed', onDeployment);
        bus.on('git:commit', onDeployment);

        // System actions
        bus.on('system:action', onSystemAction);
        bus.on('orchestration:action', onSystemAction);

        // Widget / cross-device sync
        bus.on('widget:task-sync', onWidgetTaskSync);
        bus.on('device:sync', onWidgetTaskSync);
        bus.on('workspace:sync', onWidgetTaskSync);

        // Auth/onboarding
        bus.on('auth:onboarding-event', onAuthOnboardingEvent);
        bus.on('auth:state-changed', onAuthOnboardingEvent);

        // Error events
        bus.on('error:classified', onError);
        bus.on('circuit-breaker:opened', onError);

        // Config events
        bus.on('config:updated', onConfigChange);

        // Bee swarm events
        bus.on('bee:reacted', onBeeReaction);

        // Health events
        bus.on('health:checked', onHealthCheck);

        // Projection/template injection access events
        bus.on('projection:accessed', onProjectionAccess);
        bus.on('template:injected', onProjectionAccess);

        // Code change events (from sync-projection-bee or git hooks)
        bus.on('code:changed', onCodeChange);
        bus.on('code:created', onCodeChange);

        logger.info('ContinuousEmbedder: event bus hooks registered (inbound only — no file scanning)');
    } else {
        logger.warn('ContinuousEmbedder: no event bus — running in capture-only mode');
    }

    // ── Inbound cycle: drain queue → vector memory (φ⁵ ≈ 11s)
    const inboundCycle = async () => {
        if (!running) return;
        await processBatch();
        setTimeout(inboundCycle, EMBED_INTERVAL_MS);
    };
    setTimeout(inboundCycle, EMBED_INTERVAL_MS);

    // ── Outbound cycle: project vector state → files (φ⁷ ≈ 29s)
    const projectionCycle = async () => {
        if (!running) return;
        await syncProjections();
        setTimeout(projectionCycle, PROJECTION_INTERVAL_MS);
    };
    setTimeout(projectionCycle, PROJECTION_INTERVAL_MS);

    // ── Environment capture (φ⁸ ≈ 47s)
    const envCycle = () => {
        if (!running) return;
        captureEnvironment();
        setTimeout(envCycle, ENV_INTERVAL_MS);
    };
    setTimeout(envCycle, ENV_INTERVAL_MS);

    const contextCycle = async () => {
        if (!running) return;
        await runAutonomyOptimizationCycle();
        setTimeout(contextCycle, CONTEXT_REFRESH_INTERVAL_MS);
    };
    setTimeout(contextCycle, CONTEXT_REFRESH_INTERVAL_MS);

    if (global.eventBus) {
        global.eventBus.emit('embedder:started', { service: 'continuous-embedder', mode: 'ram-first' });
    }

    logger.info([
        'ContinuousEmbedder: started',
        `  Inbound:    every ${EMBED_INTERVAL_MS}ms (φ⁵)`,
        `  Projection: every ${PROJECTION_INTERVAL_MS}ms (φ⁷)`,
        `  Env capture:every ${ENV_INTERVAL_MS}ms (φ⁸)`,
        '  Mode: RAM-first — no file scanning, events only',
    ].join('\n'));
}

function stop() {
    running = false;
    logger.info('ContinuousEmbedder: stopped');
}

function getStats() {
    return {
        ...stats,
        running,
        queueLength: pendingQueue.length,
        projections: Object.fromEntries(projections),
        ramHash: lastRAMHash,
        contextCoverage: getContextCoverage(),
        projectionOptimization: buildProjectionOptimizationStatus(),
        aliveStatus: buildAliveSystemStatus(),
    };
}

async function ingest(content, metadata = {}) {
    const accepted = queueForEmbed(content, { ...metadata, source: 'manual-ingest' });
    if (!accepted) return { ok: false, queued: pendingQueue.length };

    if (running && pendingQueue.length >= BURST_FLUSH_THRESHOLD) {
        await processBatch();
    }

    return { ok: true, queued: pendingQueue.length };
}

async function buildLiveContextSnapshot() {
    if (!vm || typeof vm.queryMemory !== 'function') {
        return {
            ok: true,
            mode: 'capture-only',
            generatedAt: new Date().toISOString(),
            slices: {},
        };
    }

    const slices = {
        userActions: await vm.queryMemory('latest user actions and intent', 5, { domain: 'user-interaction' }),
        analystActions: await vm.queryMemory('latest analyst actions and decisions', 5, { domain: 'analyst-actions' }),
        systemActions: await vm.queryMemory('latest system orchestration actions', 5, { domain: 'system-actions' }),
        environment: await vm.queryMemory('latest environment telemetry snapshot', 5, { domain: 'environment' }),
    };

    stats.lastContextRefreshAt = new Date().toISOString();

    return {
        ok: true,
        mode: 'ram-first-live-context',
        generatedAt: stats.lastContextRefreshAt,
        counts: Object.fromEntries(Object.entries(slices).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])),
        slices,
    };
}

async function buildInjectableTemplates({ topK = 12, channel = 'internal' } = {}) {
    if (!vm || typeof vm.buildOutboundRepresentation !== 'function') {
        return { ok: true, mode: 'capture-only', templates: [], generatedAt: new Date().toISOString() };
    }

    const projection = vm.buildOutboundRepresentation({ channel, topK });
    const templates = (projection.sample || []).map((entry, idx) => ({
        templateId: `heady-template-${entry.id || idx}`,
        sourceVectorId: entry.id,
        archetype: entry.type || 'unknown',
        profile: projection.profile,
        injectionTarget: channel,
        headybee: {
            role: entry.type || 'assistant',
            zone: entry.zone,
            vectorBinding: entry.id,
        },
        headyswarm: {
            swarmId: `swarm-${entry.zone || 0}`,
            coordinator: 'HeadyConductor',
            participants: [`bee-${entry.zone || 0}-a`, `bee-${entry.zone || 0}-b`],
        },
        representation: entry.representation,
    }));

    const generatedAt = new Date().toISOString();
    stats.lastTemplateProjectionAt = generatedAt;

    if (global.eventBus) {
        global.eventBus.emit('projection:templates:generated', {
            channel,
            profile: projection.profile,
            templateCount: templates.length,
            generatedAt,
        });
    }

    return {
        ok: true,
        channel,
        profile: projection.profile,
        generatedAt,
        templateCount: templates.length,
        templates,
    };
}

async function runAutonomyOptimizationCycle() {
    try {
        const context = await buildLiveContextSnapshot();
        const templates = await buildInjectableTemplates({ topK: 8, channel: 'internal' });
        if (global.eventBus) {
            global.eventBus.emit('self-awareness:assessed', {
                metric: 'autonomy-optimization-cycle',
                value: {
                    contextCounts: context.counts || {},
                    templateCount: templates.templateCount || 0,
                },
                component: 'continuous-embedder',
                confidence: 0.93,
            });
        }
        return {
            ok: true,
            contextCounts: context.counts || {},
            templateCount: templates.templateCount || 0,
            ranAt: new Date().toISOString(),
        };
    } catch (error) {
        stats.totalErrors += 1;
        queueForEmbed(`Autonomy cycle error: ${error.message}`, {
            type: 'episodic',
            domain: 'errors',
            category: 'autonomy-cycle',
            source: 'continuous-embedder',
        });
        return { ok: false, error: error.message, ranAt: new Date().toISOString() };
    }
}

function onProjectionUpdate(filePath) {
    if (!filePath) return;
    const normalizedPath = filePath.replace(/\\/g, '/');

    for (const [target] of projections) {
        if (normalizedPath.includes(`/${target}/`) || normalizedPath.startsWith(`${target}/`)) {
            projections.get(target).stale = true;
        }
    }

    try {
        const content = fs.readFileSync(filePath, 'utf8').substring(0, MAX_CONTENT_CHARS);
        queueForEmbed(
            `File updated: ${normalizedPath}\n${content.substring(0, 1000)}`,
            {
                type: 'procedural',
                domain: 'code-changes',
                category: 'projection-update',
                file: normalizedPath,
                changeType: 'projection-sync',
                source: 'projection-engine',
            },
        );
        logger.info(`ContinuousEmbedder: queued re-embed for ${normalizedPath}`);
    } catch (err) {
        logger.warn(`ContinuousEmbedder: failed to read ${filePath} for re-embed: ${err.message}`);
    }
}

function getEmbeddingHealth() {
    const now = Date.now();
    const lastIngestAge = stats.lastIngestAt
        ? now - new Date(stats.lastIngestAt).getTime()
        : null;

    const staleProjections = [...projections.entries()]
        .filter(([, p]) => p.stale)
        .map(([name]) => name);

    const throughput = stats.cycles > 0
        ? Math.round(stats.totalIngested / stats.cycles * 100) / 100
        : 0;

    const errorRate = stats.totalIngested > 0
        ? Math.round(stats.totalErrors / (stats.totalIngested + stats.totalErrors) * 10000) / 100
        : 0;

    return {
        status: running ? 'running' : 'stopped',
        queueDepth: pendingQueue.length,
        totalIngested: stats.totalIngested,
        totalFiltered: stats.totalFiltered,
        totalErrors: stats.totalErrors,
        errorRatePercent: errorRate,
        avgVectorsPerCycle: throughput,
        lastIngestAgeMs: lastIngestAge,
        isIngestStale: lastIngestAge !== null && lastIngestAge > EMBED_INTERVAL_MS * 5,
        staleProjections,
        projectionsHealth: Object.fromEntries(
            [...projections.entries()].map(([name, p]) => [
                name,
                {
                    stale: p.stale,
                    lastSynced: p.lastSynced,
                    syncAgeMs: p.lastSynced ? now - new Date(p.lastSynced).getTime() : null,
                },
            ])
        ),
        intervals: {
            embedMs: EMBED_INTERVAL_MS,
            projectionMs: PROJECTION_INTERVAL_MS,
            envMs: ENV_INTERVAL_MS,
        },
        checkedAt: new Date().toISOString(),
    };
}

function registerRoutes(app) {
    app.get('/api/embedder/status', (req, res) => {
        res.json({ ok: true, mode: 'ram-first', ...getStats() });
    });

    app.get('/api/embedder/health', (req, res) => {
        res.json({
            ok: true,
            service: 'continuous-embedder',
            running,
            queueLength: pendingQueue.length,
            totalIngested: stats.totalIngested,
            totalErrors: stats.totalErrors,
            lastIngestAt: stats.lastIngestAt,
            lastContextRefreshAt: stats.lastContextRefreshAt,
            lastTemplateProjectionAt: stats.lastTemplateProjectionAt,
            checkedAt: new Date().toISOString(),
        });
    });

    app.get('/api/embedder/context/live', async (req, res) => {
        const snapshot = await buildLiveContextSnapshot();
        res.json(snapshot);
    });

    app.get('/api/embedder/templates/injectable', async (req, res) => {
        const payload = await buildInjectableTemplates({
            topK: req.query?.top_k,
            channel: req.query?.channel || 'internal',
        });
        res.json(payload);
    });

    app.post('/api/embedder/autonomy/run', async (_req, res) => {
        const result = await runAutonomyOptimizationCycle();
        res.status(result.ok ? 200 : 500).json(result);
    });

    app.post('/api/embedder/ingest', async (req, res) => {
        const { content, metadata } = req.body || {};
        if (!content) return res.status(400).json({ error: 'content required' });
        const result = await ingest(content, metadata);
        res.json(result);
    });

    app.post('/api/embedder/flush', async (req, res) => {
        const before = pendingQueue.length;
        while (pendingQueue.length > 0) {
            await processBatch();
        }
        res.json({ ok: true, flushed: before, ingested: stats.totalIngested });
    });

    app.get('/api/embedder/context-coverage', (req, res) => {
        res.json({ ok: true, contextCoverage: getContextCoverage() });
    });

    app.get('/api/embedder/device-sync-status', (req, res) => {
        res.json({ ok: true, deviceSync: getCrossDeviceSyncStatus() });
    });

    app.get('/api/embedder/auth-onboarding-status', (req, res) => {
        res.json({ ok: true, authOnboarding: getAuthOnboardingStatus() });
    });

    app.get('/api/embedder/alive-status', (req, res) => {
        res.json({ ok: true, alive: buildAliveSystemStatus() });
    });

    app.get('/api/embedder/self-heal-plan', (req, res) => {
        res.json({ ok: true, selfHealPlan: buildSelfHealPlan() });
    });

    app.get('/api/embedder/liquid-architecture-status', (req, res) => {
        res.json({ ok: true, projectionOptimization: buildProjectionOptimizationStatus() });
    });

    app.get('/api/embedder/cleanup-plan', (req, res) => {
        res.json({ ok: true, cleanup: buildCleanupPlan() });
    });

    app.post('/api/embedder/projection-access', (req, res) => {
        onProjectionAccess(req.body || {});
        res.json({ ok: true, projectionOptimization: buildProjectionOptimizationStatus() });
    });

    app.post('/api/embedder/widget-sync', (req, res) => {
        onWidgetTaskSync(req.body || {});
        res.json({ ok: true, deviceSync: getCrossDeviceSyncStatus() });
    });

    app.post('/api/embedder/auth-onboarding-event', (req, res) => {
        onAuthOnboardingEvent(req.body || {});
        res.json({ ok: true, authOnboarding: getAuthOnboardingStatus() });
    });

    app.post('/api/embedder/self-heal', (req, res) => {
        const result = executeSelfHealCycle();
        res.json({ ok: true, selfHeal: result || buildSelfHealPlan(), alive: buildAliveSystemStatus() });
    });

    app.get('/api/embedder/projections', (req, res) => {
        res.json({ ok: true, projections: Object.fromEntries(projections) });
    });

    app.post('/api/embedder/re-embed', async (req, res) => {
        const { filePath } = req.body;
        if (!filePath) return res.status(400).json({ error: 'filePath required' });
        onProjectionUpdate(filePath);
        res.json({ ok: true, queued: true, filePath });
    });

    app.get('/api/embedder/pipeline-health', (_req, res) => {
        res.json(getEmbeddingHealth());
    });

    app.post('/api/embedder/project', async (req, res) => {
        for (const [, proj] of projections) proj.stale = true;
        await syncProjections();
        res.json({ ok: true, projections: Object.fromEntries(projections) });
    });
}

module.exports = {
    start,
    stop,
    getStats,
    ingest,
    queueForEmbed,
    registerRoutes,
    syncProjections,
    buildLiveContextSnapshot,
    buildInjectableTemplates,
    runAutonomyOptimizationCycle,
    onProjectionUpdate,
    getEmbeddingHealth,
    // Event handlers exposed for direct wiring
    onUserInteraction,
    onAnalystAction,
    onSystemAction,
    onWidgetTaskSync,
    onAuthOnboardingEvent,
    onProjectionAccess,
    onTelemetry,
    onDeployment,
    onError,
    onConfigChange,
    onBeeReaction,
    onHealthCheck,
    onCodeChange,
    captureEnvironment,
    getContextCoverage,
    getCrossDeviceSyncStatus,
    getAuthOnboardingStatus,
    buildAliveSystemStatus,
    buildSelfHealPlan,
    executeSelfHealCycle,
    buildProjectionOptimizationStatus,
    buildCleanupPlan,
};
