/**
 * Projection API Routes — UI-2
 * GET /api/projection/:userId — returns UIProjection for rendering
 * Wraps projection-manager.js and ui-projection-engine.js
 */
const express = require("express");
const router = express.Router();
const path = require("path");

// Try to load the existing projection engine
let projectionEngine = null;
try {
  projectionEngine = require(path.join(__dirname, "..", "onboarding", "ui-projection-engine"));
} catch { /* will use fallback */ }

// Try to load projection manager
let projectionManager = null;
try {
  projectionManager = require(path.join(__dirname, "..", "projection", "projection-manager"));
} catch { /* will use fallback */ }

// Default workspace layout for new users
const DEFAULT_PROJECTION = {
  layout: "grid",
  columns: 3,
  panels: [
    { id: "chat", type: "chat", title: "HeadyBuddy", position: { row: 0, col: 0, rowSpan: 2, colSpan: 1 }, config: { personality: "helpful" } },
    { id: "editor", type: "code-editor", title: "Code Editor", position: { row: 0, col: 1, rowSpan: 2, colSpan: 1 }, config: { language: "javascript" } },
    { id: "agents", type: "agent-monitor", title: "Agent Activity", position: { row: 0, col: 2, rowSpan: 1, colSpan: 1 }, config: {} },
    { id: "services", type: "service-grid", title: "Services", position: { row: 1, col: 2, rowSpan: 1, colSpan: 1 }, config: {} },
  ],
  theme: {
    mode: "dark",
    accent: "#6C63FF",
    sacredGeometry: true,
    cssVars: {
      "--bg-primary": "#0a0a1a",
      "--bg-secondary": "#111133",
      "--text-primary": "#e0e0ff",
      "--accent": "#6C63FF",
      "--accent-glow": "rgba(108, 99, 255, 0.3)",
    },
  },
};

// GET /api/projection/:userId — get UI projection for a user
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  const contextId = req.query.contextId || "default";

  try {
    // Try projection engine first
    if (projectionEngine && typeof projectionEngine.getProjection === "function") {
      const projection = await projectionEngine.getProjection(userId, contextId);
      if (projection) return res.json({ ok: true, userId, contextId, projection, source: "engine", ts: new Date().toISOString() });
    }

    // Try projection manager
    if (projectionManager && typeof projectionManager.getProjection === "function") {
      const projection = await projectionManager.getProjection(userId);
      if (projection) return res.json({ ok: true, userId, contextId, projection, source: "manager", ts: new Date().toISOString() });
    }

    // Return default projection
    res.json({
      ok: true,
      userId,
      contextId,
      projection: DEFAULT_PROJECTION,
      source: "default",
      ts: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate projection", message: err.message });
  }
});

// POST /api/projection/:userId/save — save custom layout
router.post("/:userId/save", (req, res) => {
  const { userId } = req.params;
  const { projection } = req.body;
  if (!projection) return res.status(400).json({ error: "projection object required" });

  // Store in projection manager if available
  if (projectionManager && typeof projectionManager.saveProjection === "function") {
    projectionManager.saveProjection(userId, projection);
  }

  if (global.headyBroadcastWs) {
    global.headyBroadcastWs("projection:updated", { userId, projection });
  }

  res.json({ ok: true, userId, saved: true, ts: new Date().toISOString() });
});

// GET /api/projection/:userId/panels — list available panel types
router.get("/:userId/panels", (req, res) => {
  res.json({
    panels: [
      { type: "chat", label: "HeadyBuddy Chat", icon: "💬", description: "AI assistant with context awareness" },
      { type: "code-editor", label: "Code Editor", icon: "📝", description: "In-browser code editor" },
      { type: "agent-monitor", label: "Agent Monitor", icon: "🤖", description: "Real-time agent activity tracker" },
      { type: "service-grid", label: "Service Grid", icon: "⚙️", description: "Toggleable service cards" },
      { type: "terminal", label: "Terminal", icon: "💻", description: "Integrated terminal" },
      { type: "memory", label: "Memory Viewer", icon: "🧠", description: "Vector memory visualization" },
      { type: "pipeline", label: "Pipeline Status", icon: "🔄", description: "HCFullPipeline tracker" },
      { type: "metrics", label: "Metrics Dashboard", icon: "📊", description: "Real-time system metrics" },
    ],
    ts: new Date().toISOString(),
  });
});

module.exports = router;
