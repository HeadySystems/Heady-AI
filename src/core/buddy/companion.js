/**
 * Heady Buddy — Conversational Companion Interface
 *
 * HeadyBuddy is the primary conversational interface for the Heady platform.
 * Routes user intents to the Conductor, maintains conversation memory,
 * learns user preferences, and provides anticipatory suggestions.
 *
 * Flow: User → HeadyBuddy → HeadyConductor → Target Nodes → HeadyBuddy → User
 *
 * @module core/buddy/companion
 * @author Eric Haywood — HeadySystems Inc.
 * @license PROPRIETARY — 51+ Provisional Patents
 */

import { EventEmitter } from 'events';
import {
  PHI, PSI, FIB,
  phiThreshold,
} from '../../packages/phi-math-foundation/src/index.js';
import { createLogger } from '../../packages/structured-logger/src/index.js';

const logger = createLogger('heady-buddy');

/** Phi-scaled configuration */
const CONFIG = Object.freeze({
  maxConversationLength: FIB[11],        // 89 turns before compression
  compressionTrigger: FIB[8],            // 21 turns trigger first compression
  preferenceDecayRate: PSI,              // ≈ 0.618 — preference weight decay
  suggestionThreshold: phiThreshold(2),   // ≈ 0.809 — minimum confidence for auto-suggest
  memoryRecallTopK: FIB[6],              // 8 memory results
  memoryRecallThreshold: PSI,            // ≈ 0.618 minimum relevance
  intentConfidenceMin: phiThreshold(1),   // ≈ 0.691 — minimum to route intent
  maxActiveConversations: FIB[7],        // 13 concurrent conversations
  sessionTimeoutMs: FIB[10] * 60 * 1000, // 55 minutes
});

/** Intent categories mapped to Conductor domains */
const INTENT_MAP = Object.freeze({
  code:           { domain: 'code-generation', nodes: ['JULES', 'BUILDER'] },
  review:         { domain: 'code-review', nodes: ['OBSERVER', 'HeadyAnalyze'] },
  security:       { domain: 'security', nodes: ['MURPHY', 'CIPHER'] },
  architecture:   { domain: 'architecture', nodes: ['ATLAS', 'PYTHIA'] },
  research:       { domain: 'research', nodes: ['HeadyResearch', 'SOPHIA'] },
  documentation:  { domain: 'documentation', nodes: ['ATLAS', 'HeadyCodex'] },
  creative:       { domain: 'creative', nodes: ['MUSE', 'NOVA'] },
  monitoring:     { domain: 'monitoring', nodes: ['OBSERVER', 'SENTINEL'] },
  deployment:     { domain: 'deployment', nodes: ['HeadyDeploy', 'HeadyOps'] },
  memory:         { domain: 'memory', nodes: ['HeadyMemory', 'HeadyEmbed'] },
  conversation:   { domain: 'companion', nodes: ['HeadyBuddy'] },
});

/**
 * User preference record — learned from interactions.
 */
class UserPreference {
  constructor(key, value, confidence = PSI) {
    this.key = key;
    this.value = value;
    this.confidence = confidence;
    this.learnedAt = Date.now();
    this.reinforcements = 1;
  }

  /** Reinforce a preference — increases confidence toward φ-threshold(3) */
  reinforce() {
    this.reinforcements++;
    this.confidence = Math.min(
      phiThreshold(4), // Cap at ≈ 0.927
      this.confidence + (1 - this.confidence) * Math.pow(PSI, this.reinforcements)
    );
  }

  /** Decay a preference — decreases confidence toward φ-threshold(0) */
  decay() {
    this.confidence *= CONFIG.preferenceDecayRate;
  }
}

/**
 * Conversation turn — a single exchange in a conversation.
 */
class ConversationTurn {
  constructor(role, content, metadata = {}) {
    this.id = `turn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.role = role; // 'user' | 'assistant' | 'system' | 'tool'
    this.content = content;
    this.metadata = metadata;
    this.timestamp = Date.now();
    this.intent = null;
    this.tokensEstimate = Math.ceil(content.length / 4); // Rough estimate
  }
}

/**
 * HeadyBuddy — The conversational companion.
 *
 * @fires HeadyBuddy#message:received
 * @fires HeadyBuddy#intent:classified
 * @fires HeadyBuddy#response:generated
 * @fires HeadyBuddy#preference:learned
 * @fires HeadyBuddy#suggestion:offered
 * @fires HeadyBuddy#conversation:compressed
 */
export class HeadyBuddy extends EventEmitter {
  constructor(options = {}) {
    super();

    /** @type {Map<string, ConversationTurn[]>} sessionId → turns */
    this.conversations = new Map();

    /** @type {Map<string, Map<string, UserPreference>>} userId → preferences */
    this.preferences = new Map();

    /** @type {object|null} HeadyConductor reference */
    this.conductor = options.conductor || null;

    /** @type {object|null} VectorMemoryStore reference */
    this.memoryStore = options.memoryStore || null;

    /** @type {object|null} TieredContextManager reference */
    this.contextManager = options.contextManager || null;

    this.totalMessages = 0;
    this.totalSessions = 0;

    logger.info({
      config: CONFIG,
      hasConductor: !!this.conductor,
      hasMemory: !!this.memoryStore,
    }, 'HeadyBuddy initialized');
  }

  /**
   * Process an incoming user message.
   *
   * @param {string} sessionId - Conversation session identifier
   * @param {string} userId - User identifier
   * @param {string} message - User's message content
   * @param {object} [context] - Additional context (file paths, selections, etc.)
   * @returns {object} Response with content, intent, suggestions
   */
  async processMessage(sessionId, userId, message, context = {}) {
    this.totalMessages++;

    // Initialize conversation if needed
    if (!this.conversations.has(sessionId)) {
      this.conversations.set(sessionId, []);
      this.totalSessions++;
    }

    const turns = this.conversations.get(sessionId);
    const userTurn = new ConversationTurn('user', message, { userId, context });

    // 1. Classify intent
    const intent = this._classifyIntent(message, context);
    userTurn.intent = intent;
    turns.push(userTurn);

    this.emit('message:received', {
      sessionId,
      userId,
      turnId: userTurn.id,
      intent,
    });

    this.emit('intent:classified', {
      sessionId,
      intent: intent.category,
      confidence: intent.confidence,
      domain: intent.domain,
    });

    // 2. Recall relevant memory
    const memories = await this._recallMemory(message, userId);

    // 3. Get user preferences
    const prefs = this._getUserPreferences(userId);

    // 4. Build enriched context
    const enrichedContext = {
      message,
      intent,
      memories,
      preferences: prefs,
      conversationHistory: turns.slice(-FIB[6]), // Last 8 turns
      additionalContext: context,
    };

    // 5. Route to conductor or handle locally
    let response;
    if (intent.category === 'conversation' || !this.conductor) {
      response = this._handleConversation(enrichedContext);
    } else if (intent.confidence >= CONFIG.intentConfidenceMin) {
      response = await this._routeToConductor(enrichedContext);
    } else {
      response = this._handleAmbiguous(enrichedContext);
    }

    // 6. Record assistant turn
    const assistantTurn = new ConversationTurn('assistant', response.content, {
      intent: intent.category,
      confidence: intent.confidence,
    });
    turns.push(assistantTurn);

    // 7. Learn from interaction
    this._learnFromInteraction(userId, message, intent, context);

    // 8. Check if compression needed
    if (turns.length >= CONFIG.compressionTrigger) {
      this._compressConversation(sessionId);
    }

    // 9. Generate proactive suggestions
    const suggestions = this._generateSuggestions(userId, intent, memories);

    this.emit('response:generated', {
      sessionId,
      turnId: assistantTurn.id,
      intent: intent.category,
      hasSuggestions: suggestions.length > 0,
    });

    return {
      content: response.content,
      intent,
      suggestions,
      sessionId,
      turnId: assistantTurn.id,
    };
  }

  /**
   * Get conversation history for a session.
   *
   * @param {string} sessionId
   * @param {number} [limit]
   * @returns {ConversationTurn[]}
   */
  getConversation(sessionId, limit = FIB[8]) {
    const turns = this.conversations.get(sessionId) || [];
    return turns.slice(-limit);
  }

  /**
   * Set a user preference explicitly.
   *
   * @param {string} userId
   * @param {string} key
   * @param {*} value
   */
  setPreference(userId, key, value) {
    if (!this.preferences.has(userId)) {
      this.preferences.set(userId, new Map());
    }
    const prefs = this.preferences.get(userId);
    const existing = prefs.get(key);

    if (existing) {
      existing.value = value;
      existing.reinforce();
    } else {
      prefs.set(key, new UserPreference(key, value, phiThreshold(2)));
    }

    this.emit('preference:learned', { userId, key, value });
  }

  /**
   * Get buddy statistics.
   * @returns {object}
   */
  getStats() {
    return {
      totalMessages: this.totalMessages,
      totalSessions: this.totalSessions,
      activeConversations: this.conversations.size,
      usersWithPreferences: this.preferences.size,
      config: CONFIG,
    };
  }

  // --- Private Methods ---

  /**
   * Classify user intent using keyword/pattern matching.
   * In production, this would use embedding-based classification.
   */
  _classifyIntent(message, context) {
    const lower = message.toLowerCase();
    const patterns = {
      code:           /\b(write|code|implement|build|create|function|class|api)\b/,
      review:         /\b(review|analyze|check|audit|inspect|lint)\b/,
      security:       /\b(security|vulnerability|auth|encrypt|permission|cors)\b/,
      architecture:   /\b(architect|design|structure|pattern|diagram|topology)\b/,
      research:       /\b(research|find|search|look up|compare|benchmark)\b/,
      documentation:  /\b(document|docs|readme|explain|describe|api docs)\b/,
      creative:       /\b(creative|design|ui|ux|visual|style|brand)\b/,
      monitoring:     /\b(monitor|health|status|metric|alert|dashboard)\b/,
      deployment:     /\b(deploy|ship|release|publish|docker|cloud run)\b/,
      memory:         /\b(remember|recall|store|embed|vector|memory)\b/,
    };

    let bestMatch = 'conversation';
    let bestConfidence = 0;

    for (const [category, regex] of Object.entries(patterns)) {
      const matches = lower.match(regex);
      if (matches) {
        const confidence = Math.min(1, PSI + matches.length * PSI * PSI * PSI);
        if (confidence > bestConfidence) {
          bestMatch = category;
          bestConfidence = confidence;
        }
      }
    }

    // Boost confidence if context has file paths matching the intent
    if (context.filePath) {
      if (bestMatch === 'code' && context.filePath.endsWith('.js')) bestConfidence += 0.1;
      if (bestMatch === 'security' && context.filePath.includes('auth')) bestConfidence += 0.1;
    }

    const mapping = INTENT_MAP[bestMatch] || INTENT_MAP.conversation;

    return {
      category: bestMatch,
      confidence: Math.min(1, bestConfidence),
      domain: mapping.domain,
      targetNodes: mapping.nodes,
    };
  }

  /**
   * Recall relevant memories from vector store.
   */
  async _recallMemory(message, userId) {
    if (!this.memoryStore) return [];

    try {
      // In production, this would embed the message first
      // For now, return empty — embedding requires API call
      return [];
    } catch (error) {
      logger.warn({ error: error.message, userId }, 'Memory recall failed');
      return [];
    }
  }

  /**
   * Get user preferences as a flat object.
   */
  _getUserPreferences(userId) {
    const prefs = this.preferences.get(userId);
    if (!prefs) return {};

    const result = {};
    for (const [key, pref] of prefs) {
      if (pref.confidence >= phiThreshold(1)) { // Only include confident preferences
        result[key] = { value: pref.value, confidence: pref.confidence };
      }
    }
    return result;
  }

  /**
   * Handle conversational (non-task) messages locally.
   */
  _handleConversation(enrichedContext) {
    const { message } = enrichedContext;
    return {
      content: `I understand. Let me help you with that. Based on our conversation, I'll route this through the appropriate Heady systems.`,
      source: 'buddy:local',
    };
  }

  /**
   * Route to HeadyConductor for task execution.
   */
  async _routeToConductor(enrichedContext) {
    if (!this.conductor) {
      return this._handleConversation(enrichedContext);
    }

    try {
      const result = await this.conductor.classify({
        input: enrichedContext.message,
        context: enrichedContext,
      });

      return {
        content: result?.response || 'Task has been routed to the appropriate Heady nodes.',
        source: `conductor:${enrichedContext.intent.domain}`,
      };
    } catch (error) {
      logger.error({
        error: error.message,
        domain: enrichedContext.intent.domain,
      }, 'Conductor routing failed');

      return {
        content: 'I encountered an issue routing this task. Let me handle it directly.',
        source: 'buddy:fallback',
      };
    }
  }

  /**
   * Handle ambiguous intents — ask for clarification.
   */
  _handleAmbiguous(enrichedContext) {
    return {
      content: `I'm not quite sure what you need. Could you provide more detail? I can help with code, architecture, security, research, documentation, and more.`,
      source: 'buddy:clarify',
    };
  }

  /**
   * Learn user patterns from interactions.
   */
  _learnFromInteraction(userId, message, intent, context) {
    if (!this.preferences.has(userId)) {
      this.preferences.set(userId, new Map());
    }
    const prefs = this.preferences.get(userId);

    // Track preferred domains
    const domainKey = `preferred_domain:${intent.domain}`;
    const existing = prefs.get(domainKey);
    if (existing) {
      existing.reinforce();
    } else {
      prefs.set(domainKey, new UserPreference(domainKey, intent.domain, PSI * PSI));
    }

    // Track interaction time patterns
    const hour = new Date().getHours();
    const timeKey = `active_hour:${hour}`;
    const timeExisting = prefs.get(timeKey);
    if (timeExisting) {
      timeExisting.reinforce();
    } else {
      prefs.set(timeKey, new UserPreference(timeKey, hour, PSI * PSI));
    }
  }

  /**
   * Compress older turns in a conversation.
   */
  _compressConversation(sessionId) {
    const turns = this.conversations.get(sessionId);
    if (!turns || turns.length < CONFIG.compressionTrigger) return;

    // Keep the most recent FIB[6] = 8 turns, summarize the rest
    const keepCount = FIB[6];
    const toCompress = turns.splice(0, turns.length - keepCount);

    if (toCompress.length > 0) {
      const summary = new ConversationTurn(
        'system',
        `[Compressed ${toCompress.length} earlier turns in this conversation]`,
        { compressed: true, originalCount: toCompress.length }
      );
      turns.unshift(summary);

      this.emit('conversation:compressed', {
        sessionId,
        compressedTurns: toCompress.length,
        remainingTurns: turns.length,
      });

      logger.info({
        sessionId,
        compressed: toCompress.length,
      }, 'Conversation compressed');
    }
  }

  /**
   * Generate proactive suggestions based on context.
   */
  _generateSuggestions(userId, intent, memories) {
    const suggestions = [];
    const prefs = this.preferences.get(userId);

    if (!prefs) return suggestions;

    // Suggest related domains the user frequently uses
    for (const [key, pref] of prefs) {
      if (key.startsWith('preferred_domain:') && pref.confidence >= CONFIG.suggestionThreshold) {
        const domain = pref.value;
        if (domain !== intent.domain) {
          suggestions.push({
            type: 'domain',
            text: `You often work with ${domain}. Need help there too?`,
            confidence: pref.confidence,
          });
        }
      }
    }

    // Limit suggestions
    return suggestions.slice(0, FIB[3]); // Max 2 suggestions
  }
}
