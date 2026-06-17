// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Template Registry Routes v1.1.0                       ║
// ║  Express router for HeadyBee template registry operations      ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝
'use strict';

const express = require("express");
const {
    readRegistry,
    readOptimizationPolicy,
    validateRegistry,
    scoreTemplate,
    buildOptimizationReport,
    getHealthStatus,
} = require("../services/headybee-template-registry");

const router = express.Router();

router.get("/health", (_req, res) => {
    try {
        res.json(getHealthStatus());
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.get("/templates", (req, res) => {
    try {
        const { query, category } = req.query;
        const registry = readRegistry();
        const policy = readOptimizationPolicy();
        let templates = registry.templates.map((template) => ({
            ...template,
            readinessScore: scoreTemplate(template, policy),
            confidence: Number(Math.min(1, scoreTemplate(template, policy) * 1.15).toFixed(4)),
        }));

        if (category) {
            templates = templates.filter((t) =>
                (t.situations || []).some((s) => s.toLowerCase().includes(category.toLowerCase())));
        }
        if (query) {
            const q = query.toLowerCase();
            templates = templates.filter((t) =>
                (t.id || '').toLowerCase().includes(q) ||
                (t.name || '').toLowerCase().includes(q) ||
                (t.skills || []).some((s) => s.toLowerCase().includes(q)));
        }

        res.json({
            ok: true,
            total: templates.length,
            templates,
            ts: new Date().toISOString(),
        });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.get("/templates/:id", (req, res) => {
    try {
        const registry = readRegistry();
        const template = registry.templates.find((t) => t.id === req.params.id);
        if (!template) {
            return res.status(404).json({ ok: false, error: "Template not found" });
        }
        return res.json({ ok: true, template, ts: new Date().toISOString() });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
    }
});

router.post("/validate", (_req, res) => {
    try {
        const registry = readRegistry();
        const report = validateRegistry(registry);
        res.json({ ok: true, report, ts: new Date().toISOString() });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.post("/optimize", (req, res) => {
    try {
        const report = buildOptimizationReport();
        const { targetProjection } = req.body || {};
        const sweep = {
            ...report,
            autopilotProjection: {
                sourceOfTruth: "github",
                target: targetProjection || "default",
                registryHash: report.registryHash,
            },
        };
        res.json({ ok: true, sweep, ts: new Date().toISOString() });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.get("/projection", (_req, res) => {
    try {
        const registry = readRegistry();
        const validation = validateRegistry(registry);
        res.json({
            ok: true,
            projection: {
                sourceOfTruth: registry.sourceOfTruth,
                templateCount: validation.totalTemplates,
                coverage: validation.coverage,
                registryHash: validation.registryHash,
            },
            ts: new Date().toISOString(),
        });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
