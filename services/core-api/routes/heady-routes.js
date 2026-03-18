// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: services/core-api/routes/heady-routes.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Heady Claude API Routes (heady-routes.js)
 * 
 * REST API endpoints for the Claude service.
 * Provides: conversation management, completions, and caching.
 */

const { heady } = require('../hc_heady');
const express = require('express');
const router = express.Router();

// ============================================================================
// INITIALIZATION
// ============================================================================

// Ensure heady service is initialized
let initialized = false;
async function ensureInit() {
  if (!initialized) {
    await heady.init();
    initialized = true;
  }
}

// ============================================================================
// CONVERSATION MANAGEMENT
// ============================================================================

/**
 * POST /api/heady/conversations
 * Create new conversation
 */
router.post('/conversations', async (req, res) => {
  await ensureInit();
  
  const conversation = await heady.createConversation();
  
  res.json({
    id: conversation.id,
    createdAt: conversation.createdAt,
    messageCount: conversation.messages.length
  });
});

/**
 * GET /api/heady/conversations/:id
 * Get conversation details
 */
router.get('/conversations/:id', async (req, res) => {
  await ensureInit();
  
  const conversation = heady.conversations.get(req.params.id);
  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  
  res.json({
    id: conversation.id,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messages: conversation.messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content.substring(0, 100) + (m.content.length > 100 ? '...' : ''),
      timestamp: m.timestamp
    }))
  });
});

/**
 * POST /api/heady/conversations/:id/messages
 * Add message to conversation
 */
router.post('/conversations/:id/messages', async (req, res) => {
  await ensureInit();
  
  const { role, content } = req.body;
  if (!role || !content) {
    return res.status(400).json({ error: 'role and content are required' });
  }
  
  try {
    const message = await heady.addMessage(req.params.id, role, content);
    res.json({
      id: message.id,
      conversationId: req.params.id,
      role: message.role,
      content: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
      timestamp: message.timestamp
    });
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

// ============================================================================
// COMPLETIONS
// ============================================================================

/**
 * POST /api/heady/conversations/:id/completions
 * Get completion for conversation
 */
router.post('/conversations/:id/completions', async (req, res) => {
  await ensureInit();
  
  const { options = {} } = req.body;
  
  try {
    const completion = await heady.getCompletion(req.params.id, options);
    res.json({
      conversationId: req.params.id,
      completion: completion.completion,
      stopReason: completion.stopReason
    });
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

// ============================================================================
// SYSTEM MANAGEMENT
// ============================================================================

/**
 * GET /api/heady/stats
 * Get service statistics
 */
router.get('/stats', async (req, res) => {
  await ensureInit();
  
  res.json(heady.getStats());
});

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = router;
