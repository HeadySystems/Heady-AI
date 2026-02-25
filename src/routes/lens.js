/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * HeadyLens — System-Wide Differential Observer
 * Connected to EVERY aspect of the system to capture real-time
 * differentials — state changes, metric deltas, service transitions.
 * Forms a complete picture from granular observations.
 *
 * Architecture: Lens taps into all services, captures snapshots,
 * computes deltas, stores in vector-ready format for Qdrant.
 */
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ── Vision Provider Setup (lazy — reads env at request time) ──
let _genAI = null;
function getGenAI() {
    const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY_HEADY || "";
    if (!key) return null;
    if (!_genAI) _genAI = new GoogleGenerativeAI(key);
    return _genAI;
}
function getOpenAIKey() { return process.env.OPENAI_API_KEY || ""; }

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const LENS_STATE_FILE = path.join(DATA_DIR, "lens-state.json");

// System-wide differential store
const differentials = [];
const snapshots = new Map(); // service → last snapshot
const MAX_DIFFERENTIALS = 1000;

// Services HeadyLens monitors
const MONITORED_SERVICES = [
    "heady-brain", "heady-soul", "heady-battle", "heady-hcfp",
    "heady-patterns", "heady-ops", "heady-maintenance", "heady-vinci",
    "heady-notion", "heady-lens", "heady-conductor",
];

router.get("/health", (req, res) => {
    res.json({
        status: "ACTIVE",
        service: "heady-lens",
        mode: "system-wide-differential-observer",
        monitoredServices: MONITORED_SERVICES.length,
        differentials: differentials.length,
        snapshots: snapshots.size,
        memoryGained: differentials.filter(d => d.significance > 0.5).length,
        memoryDiscarded: differentials.filter(d => d.significance <= 0.5).length,
        ts: new Date().toISOString(),
    });
});

// Capture a differential from any system component
router.post("/observe", (req, res) => {
    const { source, metric, value, previous, context } = req.body;
    const entry = {
        id: `lens-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        source: source || "unknown",
        metric: metric || "state-change",
        value,
        previous,
        delta: typeof value === "number" && typeof previous === "number" ? value - previous : null,
        context: (context || "").substring(0, 500),
        significance: calculateSignificance(source, metric, value, previous),
        ts: new Date().toISOString(),
    };

    differentials.push(entry);
    if (differentials.length > MAX_DIFFERENTIALS) differentials.splice(0, differentials.length - MAX_DIFFERENTIALS);

    // Update snapshot for this source
    snapshots.set(source || "unknown", { value, metric, ts: entry.ts });

    // Persist significant observations
    if (entry.significance > 0.5) {
        persistObservation(entry);
    }

    res.json({ ok: true, service: "heady-lens", observation: entry });
});

// Full system differential analysis or Image Analysis
router.post("/analyze", async (req, res) => {
    const { focus, depth, timeRange, action, image_url, prompt } = req.body;
    
    // Check if this is an image analysis request (from CLI)
    if (action === "analyze" && image_url) {
        return handleImageAnalysis(req, res, "analyze");
    }

    const cutoffMs = (timeRange || 300) * 1000;
    const cutoff = new Date(Date.now() - cutoffMs).toISOString();

    const recent = differentials.filter(d => d.ts >= cutoff);
    const bySources = {};
    for (const d of recent) {
        if (!bySources[d.source]) bySources[d.source] = [];
        bySources[d.source].push(d);
    }

    const analysis = {
        timeRange: `${timeRange || 300}s`,
        totalObservations: recent.length,
        sources: Object.keys(bySources).length,
        bySource: {},
        significantEvents: recent.filter(d => d.significance > 0.7).length,
        systemHealth: recent.length > 0
            ? recent.reduce((s, d) => s + d.significance, 0) / recent.length
            : 1.0,
    };

    for (const [src, obs] of Object.entries(bySources)) {
        analysis.bySource[src] = {
            observations: obs.length,
            avgSignificance: (obs.reduce((s, d) => s + d.significance, 0) / obs.length).toFixed(3),
            latestMetric: obs[obs.length - 1]?.metric,
            latestValue: obs[obs.length - 1]?.value,
        };
    }

    res.json({ ok: true, service: "heady-lens", action: "system-analysis", analysis, focus: focus || "all", depth: depth || "standard", ts: new Date().toISOString() });
});

// Post endpoints for CLI commands
router.post("/detect", (req, res) => handleImageAnalysis(req, res, "detect"));
router.post("/process", (req, res) => handleImageAnalysis(req, res, "process"));

// ── Vision AI — real provider integration ──
const ACTION_PROMPTS = {
    analyze: "Analyze this image in detail. Describe what you see, identify key elements, colors, composition, and any text present.",
    detect: "Detect and list all distinct objects, people, text, logos, and notable elements in this image. Return structured results.",
    process: "Process this image: extract all text (OCR), identify dominant colors, estimate dimensions, and summarize the visual content.",
};

async function handleImageAnalysis(req, res, actionType) {
    const { image_url, prompt } = req.body;
    const systemPrompt = prompt || ACTION_PROMPTS[actionType] || ACTION_PROMPTS.analyze;
    let provider = "none";

    try {
        let analysisText = "";

        // ── Strategy 1: Google Gemini Vision ──
        const genAI = getGenAI();
        const OPENAI_API_KEY = getOpenAIKey();
        if (genAI) {
            try {
                provider = "google-gemini";
                const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

                let parts = [{ text: systemPrompt }];

                // If image_url is a local file path, read and inline it
                const resolvedPath = path.isAbsolute(image_url)
                    ? image_url
                    : path.join(__dirname, "..", "..", image_url);

                if (fs.existsSync(resolvedPath)) {
                    const imageData = fs.readFileSync(resolvedPath);
                    const ext = path.extname(resolvedPath).toLowerCase().replace(".", "");
                    const mimeMap = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" };
                    parts.push({
                        inlineData: {
                            mimeType: mimeMap[ext] || "image/png",
                            data: imageData.toString("base64"),
                        },
                    });
                } else if (image_url.startsWith("http")) {
                    // For remote URLs, pass as file data via fetch
                    const imgRes = await fetch(image_url, { signal: AbortSignal.timeout(10000) });
                    if (imgRes.ok) {
                        const buf = Buffer.from(await imgRes.arrayBuffer());
                        const ct = imgRes.headers.get("content-type") || "image/png";
                        parts.push({ inlineData: { mimeType: ct, data: buf.toString("base64") } });
                    } else {
                        parts = [{ text: `${systemPrompt}\n\nImage URL: ${image_url}` }];
                    }
                } else {
                    parts = [{ text: `${systemPrompt}\n\nImage reference: ${image_url}` }];
                }

                const result = await model.generateContent(parts);
                analysisText = result.response.text();
            } catch (geminiErr) {
                console.warn(`⚠ HeadyLens Gemini failed: ${geminiErr.message}, falling back to OpenAI`);
                analysisText = "";
            }
        }

        // ── Strategy 2: OpenAI Vision fallback ──
        if (!analysisText && OPENAI_API_KEY) {
            try {
                provider = "openai-vision";
                const messages = [{ role: "user", content: [{ type: "text", text: systemPrompt }] }];

                const resolvedPath = path.isAbsolute(image_url)
                    ? image_url
                    : path.join(__dirname, "..", "..", image_url);

                if (fs.existsSync(resolvedPath)) {
                    const imageData = fs.readFileSync(resolvedPath);
                    const ext = path.extname(resolvedPath).toLowerCase().replace(".", "");
                    const mimeMap = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };
                    const dataUrl = `data:${mimeMap[ext] || "image/png"};base64,${imageData.toString("base64")}`;
                    messages[0].content.push({ type: "image_url", image_url: { url: dataUrl } });
                } else if (image_url.startsWith("http")) {
                    messages[0].content.push({ type: "image_url", image_url: { url: image_url } });
                }

                const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
                    body: JSON.stringify({ model: "gpt-4o-mini", messages, max_tokens: 1024 }),
                    signal: AbortSignal.timeout(20000),
                });

                if (oaiRes.ok) {
                    const data = await oaiRes.json();
                    analysisText = data.choices?.[0]?.message?.content || "";
                }
            } catch (oaiErr) {
                console.warn(`⚠ HeadyLens OpenAI fallback failed: ${oaiErr.message}`);
            }
        }

        if (!analysisText) {
            analysisText = `No vision provider available. Ensure GOOGLE_API_KEY or OPENAI_API_KEY is set.`;
            provider = "none";
        }

        // Persist as a lens observation
        const observation = {
            id: `lens-vision-${Date.now()}`,
            source: "heady-lens-vision",
            metric: actionType,
            value: analysisText.substring(0, 500),
            context: image_url,
            significance: 0.8,
            ts: new Date().toISOString(),
        };
        differentials.push(observation);
        if (differentials.length > MAX_DIFFERENTIALS) differentials.splice(0, differentials.length - MAX_DIFFERENTIALS);
        persistObservation(observation);

        res.json({
            ok: true,
            service: "heady-lens",
            action: actionType,
            provider,
            target: image_url,
            result: {
                analysis: analysisText,
                confidence: analysisText && provider !== "none" ? 0.95 : 0.0,
                tags: ["vision", actionType, provider],
                prompt_used: systemPrompt,
            },
            ts: new Date().toISOString(),
        });
    } catch (err) {
        console.error(`✖ HeadyLens vision error:`, err.message);
        res.status(500).json({ ok: false, service: "heady-lens", error: err.message });
    }
}

// Get all current snapshots (system state)
router.get("/snapshots", (req, res) => {
    const snap = {};
    for (const [k, v] of snapshots) snap[k] = v;
    res.json({ ok: true, snapshots: snap, count: snapshots.size });
});

// Get differential history
router.get("/differentials", (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    res.json({ ok: true, differentials: differentials.slice(-limit), total: differentials.length });
});

// Memory summary: gained vs discarded
router.get("/memory", (req, res) => {
    const gained = differentials.filter(d => d.significance > 0.5);
    const discarded = differentials.filter(d => d.significance <= 0.5);
    res.json({
        ok: true, service: "heady-lens",
        memory: {
            gained: gained.length,
            discarded: discarded.length,
            retentionRate: differentials.length > 0 ? (gained.length / differentials.length * 100).toFixed(1) + "%" : "N/A",
            recentGained: gained.slice(-5).map(d => ({ source: d.source, metric: d.metric, significance: d.significance, ts: d.ts })),
            recentDiscarded: discarded.slice(-3).map(d => ({ source: d.source, metric: d.metric, significance: d.significance, ts: d.ts })),
        },
        ts: new Date().toISOString(),
    });
});

// Vector-ready export for Qdrant
router.get("/vector-export", (req, res) => {
    const significant = differentials.filter(d => d.significance > 0.3);
    const vectors = significant.map(d => ({
        id: d.id,
        payload: { source: d.source, metric: d.metric, value: d.value, significance: d.significance, ts: d.ts },
        text: `${d.source} ${d.metric}: ${JSON.stringify(d.value)} (Δ=${d.delta}, sig=${d.significance.toFixed(2)})`,
    }));
    res.json({ ok: true, vectors, count: vectors.length, format: "qdrant-ready" });
});

router.get("/analyze", (req, res) => res.json({ ok: true, recentDifferentials: differentials.slice(-10) }));
router.get("/process", (req, res) => res.json({ ok: true, snapshots: snapshots.size, differentials: differentials.length }));

// ── Helpers ──
function calculateSignificance(source, metric, value, previous) {
    let sig = 0.5;
    if (source && MONITORED_SERVICES.includes(source)) sig += 0.1;
    if (metric === "error" || metric === "failure") sig += 0.3;
    if (metric === "state-change") sig += 0.2;
    if (typeof value === "number" && typeof previous === "number") {
        const delta = Math.abs(value - previous);
        const pctChange = previous !== 0 ? delta / Math.abs(previous) : delta;
        if (pctChange > 0.5) sig += 0.2;
        if (pctChange > 1.0) sig += 0.1;
    }
    return Math.min(1.0, sig);
}

function persistObservation(entry) {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        const line = JSON.stringify({ ...entry, persisted: true }) + "\n";
        fs.appendFileSync(path.join(DATA_DIR, "lens-observations.jsonl"), line);
    } catch { /* non-critical */ }
}

module.exports = router;
