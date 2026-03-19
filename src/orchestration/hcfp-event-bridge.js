/*
 * © 2026 Heady™Systems Inc.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * HCFP Event Bridge
 * ════════════════════════════════════════════════════════════════════
 *
 * Bridges HCFullPipeline stage events to the Auto-Success reactive engine.
 * Connects the canonical HeadyEventBus topics to auto-success triggers,
 * ensuring pipeline lifecycle events drive the reactive task system.
 *
 * Event mappings:
 *   PIPELINE_STAGE_COMPLETED  →  auto_success:reaction  (per-stage learning)
 *   PIPELINE_RUN_COMPLETED    →  next task batch trigger (pipeline-wide sweep)
 *   PIPELINE_STAGE_FAILED     →  error:absorbed + auto_success:reaction
 *   PIPELINE_RUN_FAILED       →  escalation event
 *
 * Usage:
 *   const { bridgeHCFPEvents } = require('./hcfp-event-bridge');
 *   bridgeHCFPEvents(eventBus, autoSuccessEngine);
 */

'use strict';

const { TOPICS } = require('../core/heady-event-bus');

const PHI = 1.6180339887;

/**
 * Bridge HCFP pipeline events to auto-success triggers.
 *
 * @param {import('../core/heady-event-bus').HeadyEventBus} eventBus - The global event bus
 * @param {EventEmitter} [autoSuccessEngine] - The auto-success engine (optional, wired later if null)
 * @returns {{ stats: Function, destroy: Function }}
 */
function bridgeHCFPEvents(eventBus, autoSuccessEngine = null) {
    if (!eventBus) {
        throw new Error('[hcfp-event-bridge] eventBus is required');
    }

    let _autoSuccess = autoSuccessEngine;
    const _unsubscribers = [];
    const _stats = {
        stageCompletedBridged: 0,
        runCompletedBridged: 0,
        stageFailedBridged: 0,
        runFailedBridged: 0,
        totalBridged: 0,
        startedAt: Date.now(),
    };

    // ── PIPELINE_STAGE_COMPLETED → auto_success:reaction ─────────────────
    const unsubStageCompleted = eventBus.subscribe(TOPICS.PIPELINE_STAGE_COMPLETED, (event) => {
        _stats.stageCompletedBridged++;
        _stats.totalBridged++;

        const payload = event.payload || {};

        // Emit auto_success:reaction on the event bus for the reactive engine
        eventBus.publish('heady:auto-success:reaction', {
            trigger: 'pipeline_stage_completed',
            stage: payload.stage || payload.stageName || 'unknown',
            runId: payload.runId || event.correlationId,
            duration: payload.durationMs || 0,
            bridgedAt: Date.now(),
        }).catch(() => { /* non-critical */ });

        // Direct-fire to auto-success engine if wired
        if (_autoSuccess && typeof _autoSuccess.emit === 'function') {
            _autoSuccess.emit('auto_success:reaction', {
                trigger: 'pipeline_stage_completed',
                stage: payload.stage || payload.stageName,
                runId: payload.runId,
            });
        }
    });
    _unsubscribers.push(unsubStageCompleted);

    // ── PIPELINE_RUN_COMPLETED → next task batch trigger ─────────────────
    const unsubRunCompleted = eventBus.subscribe(TOPICS.PIPELINE_RUN_COMPLETED, (event) => {
        _stats.runCompletedBridged++;
        _stats.totalBridged++;

        const payload = event.payload || {};

        // Trigger a full task batch sweep — all categories should re-evaluate
        eventBus.publish('heady:auto-success:batch-trigger', {
            trigger: 'pipeline_run_completed',
            runId: payload.runId || event.correlationId,
            stages: payload.stages || [],
            totalDuration: payload.totalDurationMs || 0,
            bridgedAt: Date.now(),
        }).catch(() => { /* non-critical */ });

        // Direct-fire for immediate task scheduling
        if (_autoSuccess && typeof _autoSuccess.emit === 'function') {
            _autoSuccess.emit('auto_success:reaction', {
                trigger: 'pipeline_run_completed',
                runId: payload.runId,
                fullSweep: true,
            });
        }
    });
    _unsubscribers.push(unsubRunCompleted);

    // ── PIPELINE_STAGE_FAILED → error:absorbed + auto_success:reaction ───
    const unsubStageFailed = eventBus.subscribe(TOPICS.PIPELINE_STAGE_FAILED, (event) => {
        _stats.stageFailedBridged++;
        _stats.totalBridged++;

        const payload = event.payload || {};

        // Emit as an absorbed error for the reactive engine to learn from
        eventBus.publish('heady:auto-success:reaction', {
            trigger: 'pipeline_stage_failed',
            stage: payload.stage || payload.stageName || 'unknown',
            runId: payload.runId || event.correlationId,
            error: payload.error || 'unknown',
            bridgedAt: Date.now(),
        }).catch(() => { /* non-critical */ });

        if (_autoSuccess && typeof _autoSuccess.emit === 'function') {
            _autoSuccess.emit('error:absorbed', {
                source: 'hcfp_pipeline',
                stage: payload.stage || payload.stageName,
                error: payload.error,
            });
        }
    });
    _unsubscribers.push(unsubStageFailed);

    // ── PIPELINE_RUN_FAILED → escalation ─────────────────────────────────
    const unsubRunFailed = eventBus.subscribe(TOPICS.PIPELINE_RUN_FAILED, (event) => {
        _stats.runFailedBridged++;
        _stats.totalBridged++;

        const payload = event.payload || {};

        eventBus.publish('heady:auto-success:reaction', {
            trigger: 'pipeline_run_failed',
            runId: payload.runId || event.correlationId,
            error: payload.error || 'unknown',
            severity: 'critical',
            bridgedAt: Date.now(),
        }).catch(() => { /* non-critical */ });
    });
    _unsubscribers.push(unsubRunFailed);

    // ── AUTO-DEPLOY EVENTS → drift detection + sync triggers ────────────
    const unsubAutoDeploy = eventBus.subscribe('auto-deploy:pushed', (event) => {
        _stats.totalBridged++;
        // After every auto-deploy push, trigger audit tasks for sync verification
        eventBus.publish('heady:auto-success:reaction', {
            trigger: 'auto_deploy_pushed',
            remote: event.remote,
            branch: event.branch,
            commit: event.commit,
            bridgedAt: Date.now(),
        }).catch(() => { /* non-critical */ });
    });
    _unsubscribers.push(unsubAutoDeploy);

    const unsubDrift = eventBus.subscribe('auto-deploy:drift-detected', (event) => {
        _stats.totalBridged++;
        eventBus.publish('heady:auto-success:reaction', {
            trigger: 'config_drift_detected',
            remote: event.remote,
            fileCount: event.fileCount,
            severity: 'high',
            bridgedAt: Date.now(),
        }).catch(() => { /* non-critical */ });
    });
    _unsubscribers.push(unsubDrift);

    const unsubPushFailed = eventBus.subscribe('auto-deploy:push-failed', (event) => {
        _stats.totalBridged++;
        eventBus.publish('heady:auto-success:reaction', {
            trigger: 'auto_deploy_push_failed',
            remote: event.remote,
            error: event.error,
            severity: 'critical',
            bridgedAt: Date.now(),
        }).catch(() => { /* non-critical */ });
    });
    _unsubscribers.push(unsubPushFailed);

    return {
        /**
         * Late-bind the auto-success engine (for cases where it initializes after the bridge).
         * @param {EventEmitter} engine
         */
        wireAutoSuccess(engine) {
            _autoSuccess = engine;
        },

        /** Get bridge statistics. */
        stats() {
            return {
                ..._stats,
                uptimeMs: Date.now() - _stats.startedAt,
                autoSuccessWired: !!_autoSuccess,
                autoDeployEventsWired: true,
            };
        },

        /** Tear down all subscriptions. */
        destroy() {
            for (const unsub of _unsubscribers) {
                if (typeof unsub === 'function') unsub();
            }
            _unsubscribers.length = 0;
        },
    };
}

module.exports = { bridgeHCFPEvents };
