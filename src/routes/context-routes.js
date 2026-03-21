/**
 * Context CRUD Routes — F-5
 * REST endpoints for user context profiles
 * Wraps context-window-manager.js
 */
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const logger = require('../utils/logger');

// In-memory context store (backed by file for persistence)
const CONTEXT_STORE_PATH = path.join(__dirname, "..", "..", ".heady", "contexts.json");

function loadContexts() {
  try {
    if (fs.existsSync(CONTEXT_STORE_PATH)) {
      return JSON.parse(fs.readFileSync(CONTEXT_STORE_PATH, "utf8"));
    }
  } catch (e) {
    logger.error('Unexpected error', { error: e.message, stack: e.stack });
  }
  return {};
}

function saveContexts(data) {
  fs.mkdirSync(path.dirname(CONTEXT_STORE_PATH), { recursive: true });
  fs.writeFileSync(CONTEXT_STORE_PATH, JSON.stringify(data, null, 2), "utf8");
}

// GET /api/context — list all contexts for a user
router.get("/", (req, res) => {
  const userId = req.query.userId || "default";
  const contexts = loadContexts();
  const userContexts = contexts[userId] || [];
  res.json({ userId, contexts: userContexts, count: userContexts.length, ts: new Date().toISOString() });
});

// GET /api/context/:contextId — get a specific context
router.get("/:contextId", (req, res) => {
  const userId = req.query.userId || "default";
  const contexts = loadContexts();
  const userContexts = contexts[userId] || [];
  const ctx = userContexts.find((c) => c.id === req.params.contextId);
  if (!ctx) return res.status(404).json({ error: "Context not found" });
  res.json(ctx);
});

// POST /api/context — create a new context
router.post("/", (req, res) => {
  const { userId = "default", name, type = "workspace", config = {} } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });

  const contexts = loadContexts();
  if (!contexts[userId]) contexts[userId] = [];

  const newContext = {
    id: `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    type,
    config,
    active: contexts[userId].length === 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  contexts[userId].push(newContext);
  saveContexts(contexts);

  // Broadcast via WebSocket if available
  if (global.headyBroadcastWs) {
    global.headyBroadcastWs("context:created", { userId, context: newContext });
  }

  res.status(201).json(newContext);
});

// PUT /api/context/:contextId — update a context
router.put("/:contextId", (req, res) => {
  const { userId = "default", ...updates } = req.body;
  const contexts = loadContexts();
  const userContexts = contexts[userId] || [];
  const idx = userContexts.findIndex((c) => c.id === req.params.contextId);
  if (idx === -1) return res.status(404).json({ error: "Context not found" });

  userContexts[idx] = { ...userContexts[idx], ...updates, updatedAt: new Date().toISOString() };
  contexts[userId] = userContexts;
  saveContexts(contexts);

  if (global.headyBroadcastWs) {
    global.headyBroadcastWs("context:updated", { userId, context: userContexts[idx] });
  }

  res.json(userContexts[idx]);
});

// POST /api/context/:contextId/activate — switch active context
router.post("/:contextId/activate", (req, res) => {
  const userId = req.body.userId || req.query.userId || "default";
  const contexts = loadContexts();
  const userContexts = contexts[userId] || [];

  userContexts.forEach((c) => (c.active = c.id === req.params.contextId));
  contexts[userId] = userContexts;
  saveContexts(contexts);

  const activated = userContexts.find((c) => c.active);
  if (!activated) return res.status(404).json({ error: "Context not found" });

  if (global.headyBroadcastWs) {
    global.headyBroadcastWs("context:switched", { userId, contextId: activated.id, name: activated.name });
  }

  res.json({ ok: true, activeContext: activated });
});

// DELETE /api/context/:contextId — delete a context
router.delete("/:contextId", (req, res) => {
  const userId = req.query.userId || "default";
  const contexts = loadContexts();
  const userContexts = contexts[userId] || [];
  const idx = userContexts.findIndex((c) => c.id === req.params.contextId);
  if (idx === -1) return res.status(404).json({ error: "Context not found" });

  const removed = userContexts.splice(idx, 1)[0];
  contexts[userId] = userContexts;
  saveContexts(contexts);

  if (global.headyBroadcastWs) {
    global.headyBroadcastWs("context:deleted", { userId, contextId: removed.id });
  }

  res.json({ ok: true, deleted: removed.id });
});

module.exports = router;
