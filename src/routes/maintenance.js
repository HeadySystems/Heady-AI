/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * HeadyMaintenance — Legacy read-only file hygiene router.
 * Cloud Run filesystems are ephemeral; durable audit/task data belongs in Neon.
 */
const express = require("express");
const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

const router = express.Router();
const maintenanceLog = [];
const startTime = Date.now();
const ROOT_DIR = path.join(__dirname, "..", "..");

const CLEANUP_RULES = [
    { label: "backup-files", pattern: /\.bak$/i, deleteMode: "file" },
    { label: "runtime-logs", pattern: /\.log$/i, deleteMode: "file" },
    { label: "runtime-pid", pattern: /server\.pid$/i, deleteMode: "file" },
];

const PROTECTED_PATTERNS = [
    /(^|[/\\])(audit|audits|observations?)([/\\]|[._-])/i,
    /\.jsonl$/i,
    /(^|[/\\])\.github([/\\]|$)/,
    /(^|[/\\])configs?([/\\]|$)/i,
];

function pushLog(entry) {
    maintenanceLog.push(entry);
    if (maintenanceLog.length > 400) maintenanceLog.splice(0, maintenanceLog.length - 400);
}

function walkDirectory(dirPath, results = []) {
    let entries = [];
    try {
        entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (err) {
        logger.logError("OBSERVER", "Maintenance scan could not read directory", { path: dirPath, error: err.message });
        return results;
    }

    for (const entry of entries) {
        if (entry.name === ".git" || entry.name === "node_modules") continue;
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            walkDirectory(fullPath, results);
            continue;
        }

        results.push(fullPath);
    }

    return results;
}

function fileCleanupAudit() {
    const allFiles = walkDirectory(ROOT_DIR);
    const candidates = [];

    for (const filePath of allFiles) {
        const relative = path.relative(ROOT_DIR, filePath);
        const basename = path.basename(filePath);

        if (PROTECTED_PATTERNS.some((pattern) => pattern.test(relative))) continue;

        for (const rule of CLEANUP_RULES) {
            if (rule.pattern.test(relative) || rule.pattern.test(basename)) {
                candidates.push({ path: relative, rule: rule.label, deleteMode: rule.deleteMode });
                break;
            }
        }
    }

    return candidates;
}

function executeCleanup(_candidates, dryRun = true) {
    if (!dryRun) {
        return { deleted: [], errors: [{ error: "runtime filesystem mutation is disabled; replace the immutable image instead" }] };
    }
    return { deleted: [], errors: [] };
}

router.get("/health", (req, res) => {
    res.json({
        status: "ACTIVE",
        service: "heady-maintenance",
        mode: "audit-only",
        runtimeFilesystem: "ephemeral",
        localMutationEnabled: false,
        durableAuditAuthority: "neon.task_outbox",
        uptime: Math.floor((Date.now() - startTime) / 1000),
        tasks: maintenanceLog.length,
        ts: new Date().toISOString(),
    });
});

router.post("/status", (req, res) => {
    const entry = { id: `maint-${Date.now()}`, action: "status-check", ts: new Date().toISOString() };
    pushLog(entry);

    const dataDir = path.join(ROOT_DIR, "data");
    let dataHealth = { exists: false };
    try {
        if (fs.existsSync(dataDir)) {
            const files = fs.readdirSync(dataDir);
            dataHealth = { exists: true, fileCount: files.length, files: files.slice(0, 10) };
        }
    } catch (err) {
        dataHealth.error = err.message;
    }

    res.json({
        ok: true,
        service: "heady-maintenance",
        requestId: entry.id,
        maintenance: {
            status: "healthy",
            lastCheck: entry.ts,
            uptime: Math.floor((Date.now() - startTime) / 1000),
            dataDirectory: dataHealth,
            scheduledTasks: ["log-rotation", "cache-cleanup", "health-checks", "projection-hygiene"],
        },
        ts: entry.ts,
    });
});

router.post("/backup", (req, res) => {
    const { scope } = req.body;
    const entry = { id: `maint-${Date.now()}`, action: "backup", scope: scope || "data", ts: new Date().toISOString() };
    pushLog(entry);
    res.status(501).json({
        ok: false,
        service: "heady-maintenance",
        action: "backup",
        requestId: entry.id,
        backup: { scope: entry.scope, status: "unsupported", authority: "Neon point-in-time restore", ts: entry.ts },
    });
});

router.get("/audit", (_req, res) => {
    const entry = { id: `maint-${Date.now()}`, action: "audit", ts: new Date().toISOString() };
    const candidates = fileCleanupAudit();
    pushLog({ ...entry, candidateCount: candidates.length });

    res.json({
        ok: true,
        service: "heady-maintenance",
        requestId: entry.id,
        summary: {
            candidateCount: candidates.length,
            ruleCoverage: CLEANUP_RULES.map((rule) => rule.label),
        },
        candidates,
        ts: entry.ts,
    });
});

router.post("/cleanup", (req, res) => {
    const dryRun = req.body?.dryRun !== false;
    if (!dryRun) {
        return res.status(409).json({
            ok: false,
            error: "runtime_filesystem_mutation_disabled",
            policy: "Cloud Run images are immutable and durable audit records remain in Neon",
        });
    }
    const entry = { id: `maint-${Date.now()}`, action: "cleanup", dryRun, ts: new Date().toISOString() };
    const candidates = fileCleanupAudit();
    const result = executeCleanup(candidates, dryRun);
    pushLog({ ...entry, candidateCount: candidates.length, deleted: result.deleted.length, errors: result.errors.length });

    logger.logNodeActivity("OBSERVER", "Maintenance cleanup audit executed", {
        dryRun,
        candidateCount: candidates.length,
        deletedCount: result.deleted.length,
        errorCount: result.errors.length,
    });

    res.json({
        ok: true,
        service: "heady-maintenance",
        requestId: entry.id,
        dryRun,
        candidateCount: candidates.length,
        deleted: result.deleted,
        errors: result.errors,
        ts: entry.ts,
    });
});

router.get("/status", (req, res) => res.json({ ok: true, recent: maintenanceLog.filter((e) => e.action === "status-check").slice(-5) }));
router.get("/backup", (req, res) => res.json({ ok: true, recent: maintenanceLog.filter((e) => e.action === "backup").slice(-5) }));

module.exports = router;
