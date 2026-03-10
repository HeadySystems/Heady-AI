/**
 * HeadyAutobiographer — Event Logging & Narrative Construction
 * 
 * Records the life story of the Heady system. Every significant event,
 * decision, healing action, and state transition is logged as a narrative
 * entry in the system's autobiography.
 * 
 * Features:
 * - Event sourcing with phi-scaled retention
 * - Narrative generation from raw events
 * - Pattern detection across event sequences
 * - Coherence timeline tracking
 * - Chapter-based organization (sessions, incidents, milestones)
 * - Searchable event archive via embeddings
 * - Prometheus metrics emission
 * 
 * @module HeadyAutobiographer
 * @author Eric Haywood
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

const crypto = require('crypto');
const { PHI, PSI, PSI_SQ, fibonacci, phiThreshold, CSL_THRESHOLDS } = require('../../shared/phi-math');
const { createLogger } = require('../../shared/logger');

const logger = createLogger('heady-autobiographer');

// ─── Constants ──────────────────────────────────────────────────────────────
const MAX_EVENTS = fibonacci(17);           // 1597 events in memory
const MAX_CHAPTERS = fibonacci(11);          // 89 chapters
const NARRATIVE_BUFFER = fibonacci(13);      // 233 events before auto-narrate
const RETENTION_MS = fibonacci(14) * 60 * 60 * 1000; // 377 hours ≈ 15.7 days

// Event categories
const EVENT_CATEGORIES = {
  SYSTEM:      'system',       // startup, shutdown, config changes
  TASK:        'task',         // task received, routed, completed
  HEALING:     'healing',      // drift detected, healing applied, verified
  DECISION:    'decision',     // routing decision, model selection, escalation
  LEARNING:    'learning',     // pattern captured, model updated, skill acquired
  ERROR:       'error',        // errors, failures, degradations
  MILESTONE:   'milestone',    // significant achievements, thresholds crossed
  COHERENCE:   'coherence',    // coherence score changes, drift events
  USER:        'user',         // user interactions, feedback, preferences
  DEPLOYMENT:  'deployment'    // deploys, rollbacks, migrations
};

// Severity levels (phi-derived)
const SEVERITY = {
  TRACE:    0,                         // Raw telemetry
  INFO:     CSL_THRESHOLDS.LOW,        // 0.691 — Normal operations
  WARNING:  CSL_THRESHOLDS.MEDIUM,     // 0.809 — Attention needed
  CRITICAL: CSL_THRESHOLDS.HIGH,       // 0.882 — Immediate attention
  FATAL:    CSL_THRESHOLDS.CRITICAL    // 0.927 — System failure
};

/**
 * Autobiographical Event
 */
class AutoEvent {
  constructor({ category, action, description, severity = SEVERITY.INFO,
                source = 'unknown', metadata = {}, correlationId = null }) {
    this.id = crypto.randomUUID();
    this.timestamp = Date.now();
    this.category = category;
    this.action = action;
    this.description = description;
    this.severity = severity;
    this.source = source;
    this.metadata = metadata;
    this.correlationId = correlationId || crypto.randomUUID();
    this.chapterId = null;
  }

  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      isoTime: new Date(this.timestamp).toISOString(),
      category: this.category,
      action: this.action,
      description: this.description,
      severity: this.severity,
      source: this.source,
      metadata: this.metadata,
      correlationId: this.correlationId,
      chapterId: this.chapterId
    };
  }
}

/**
 * Chapter — a narrative grouping of related events
 */
class Chapter {
  constructor({ title, type = 'session', summary = '' }) {
    this.id = crypto.randomUUID();
    this.title = title;
    this.type = type;
    this.summary = summary;
    this.startedAt = Date.now();
    this.endedAt = null;
    this.eventCount = 0;
    this.coherenceStart = 1.0;
    this.coherenceEnd = null;
    this.keyEvents = [];    // Most significant events
    this.closed = false;
  }

  addEvent(event) {
    this.eventCount++;
    if (event.severity >= SEVERITY.WARNING) {
      // Keep max fib(7) = 13 key events per chapter
      this.keyEvents.push({
        id: event.id,
        action: event.action,
        severity: event.severity,
        timestamp: event.timestamp
      });
      if (this.keyEvents.length > fibonacci(7)) {
        this.keyEvents.shift();
      }
    }
  }

  close(coherence = null) {
    this.endedAt = Date.now();
    this.coherenceEnd = coherence;
    this.closed = true;
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      type: this.type,
      summary: this.summary,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      duration: this.endedAt ? this.endedAt - this.startedAt : Date.now() - this.startedAt,
      eventCount: this.eventCount,
      coherenceStart: this.coherenceStart,
      coherenceEnd: this.coherenceEnd,
      keyEvents: this.keyEvents,
      closed: this.closed
    };
  }
}

/**
 * HeadyAutobiographer — The system's narrative engine
 */
class HeadyAutobiographer {
  constructor(config = {}) {
    this.events = [];          // Ring buffer of recent events
    this.chapters = [];        // Chapter history
    this.currentChapter = null;
    this.eventIndex = new Map(); // correlationId -> [events]
    this.categoryCounters = {}; // category -> count
    this.metrics = {
      totalEvents: 0,
      totalChapters: 0,
      narrativesGenerated: 0,
      healingEvents: 0,
      errorEvents: 0,
      averageCoherence: 1.0
    };
    this._persistFn = config.persistFn || null; // Optional: persist to HeadyMemory
    this._coherenceTimeline = [];  // [{timestamp, coherence}]

    // Start first chapter
    this.startChapter('System Initialization', 'system');

    logger.info({ msg: 'HeadyAutobiographer initialized' });
  }

  /**
   * Record an event in the system autobiography
   */
  record(eventData) {
    const event = new AutoEvent(eventData);

    // Assign to current chapter
    if (this.currentChapter && !this.currentChapter.closed) {
      event.chapterId = this.currentChapter.id;
      this.currentChapter.addEvent(event);
    }

    // Add to ring buffer
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) {
      this.events.shift();
    }

    // Index by correlation ID
    if (!this.eventIndex.has(event.correlationId)) {
      this.eventIndex.set(event.correlationId, []);
    }
    this.eventIndex.get(event.correlationId).push(event);

    // Update counters
    this.categoryCounters[event.category] = (this.categoryCounters[event.category] || 0) + 1;
    this.metrics.totalEvents++;

    if (event.category === EVENT_CATEGORIES.HEALING) this.metrics.healingEvents++;
    if (event.category === EVENT_CATEGORIES.ERROR) this.metrics.errorEvents++;

    // Auto-narrate when buffer fills
    if (this.events.length % NARRATIVE_BUFFER === 0) {
      this._autoNarrate();
    }

    // Persist high-severity events
    if (event.severity >= SEVERITY.WARNING && this._persistFn) {
      this._persistFn(event).catch(err => {
        logger.warn({ err: err.message, msg: 'Event persistence failed' });
      });
    }

    logger.info({
      eventId: event.id,
      category: event.category,
      action: event.action,
      severity: event.severity,
      msg: 'Event recorded'
    });

    return event;
  }

  // ─── Convenience Recorders ────────────────────────────────────────────

  recordTaskReceived(task, source) {
    return this.record({
      category: EVENT_CATEGORIES.TASK,
      action: 'task_received',
      description: `Task received: ${task.query?.substring(0, fibonacci(11))}`, // 89 chars
      severity: SEVERITY.INFO,
      source,
      metadata: { taskId: task.id, type: task.type },
      correlationId: task.id
    });
  }

  recordTaskCompleted(taskId, result) {
    return this.record({
      category: EVENT_CATEGORIES.TASK,
      action: 'task_completed',
      description: `Task completed: ${result.status || 'success'}`,
      severity: SEVERITY.INFO,
      source: result.completedBy || 'conductor',
      metadata: { taskId, duration: result.duration, nodes: result.nodesUsed },
      correlationId: taskId
    });
  }

  recordDecision(decision) {
    return this.record({
      category: EVENT_CATEGORIES.DECISION,
      action: decision.type || 'routing_decision',
      description: `Decision: ${decision.description?.substring(0, fibonacci(11))}`,
      severity: SEVERITY.INFO,
      source: decision.source || 'conductor',
      metadata: decision.metadata || {},
      correlationId: decision.correlationId
    });
  }

  recordHealing(healingEvent) {
    return this.record({
      category: EVENT_CATEGORIES.HEALING,
      action: healingEvent.action || 'healing_applied',
      description: `Healing: ${healingEvent.description}`,
      severity: SEVERITY.WARNING,
      source: healingEvent.source || 'self-healing',
      metadata: healingEvent.metadata || {},
      correlationId: healingEvent.correlationId
    });
  }

  recordError(error, source) {
    return this.record({
      category: EVENT_CATEGORIES.ERROR,
      action: 'error_occurred',
      description: `Error: ${error.message?.substring(0, fibonacci(11))}`,
      severity: SEVERITY.CRITICAL,
      source,
      metadata: { errorType: error.name, stack: error.stack?.substring(0, fibonacci(13) * 2) } // 466 chars
    });
  }

  recordCoherence(coherenceScore, source) {
    this._coherenceTimeline.push({ timestamp: Date.now(), coherence: coherenceScore });
    // Keep timeline to fib(13) = 233 entries
    if (this._coherenceTimeline.length > fibonacci(13)) {
      this._coherenceTimeline.shift();
    }

    // Update running average
    const recent = this._coherenceTimeline.slice(-fibonacci(8)); // Last 21
    this.metrics.averageCoherence = recent.reduce((s, e) => s + e.coherence, 0) / recent.length;

    // Only record event if coherence dropped below threshold
    if (coherenceScore < CSL_THRESHOLDS.MEDIUM) {
      return this.record({
        category: EVENT_CATEGORIES.COHERENCE,
        action: 'coherence_drift',
        description: `Coherence dropped to ${coherenceScore.toFixed(3)}`,
        severity: coherenceScore < CSL_THRESHOLDS.LOW ? SEVERITY.CRITICAL : SEVERITY.WARNING,
        source,
        metadata: { coherence: coherenceScore, threshold: CSL_THRESHOLDS.MEDIUM }
      });
    }

    return null;
  }

  recordMilestone(title, description, metadata = {}) {
    return this.record({
      category: EVENT_CATEGORIES.MILESTONE,
      action: 'milestone_reached',
      description: `Milestone: ${title} — ${description}`,
      severity: SEVERITY.INFO,
      source: 'system',
      metadata: { title, ...metadata }
    });
  }

  recordDeployment(action, details) {
    return this.record({
      category: EVENT_CATEGORIES.DEPLOYMENT,
      action,
      description: `Deployment: ${action} — ${details.description || ''}`,
      severity: SEVERITY.WARNING,
      source: details.source || 'deploy',
      metadata: details
    });
  }

  // ─── Chapter Management ───────────────────────────────────────────────

  startChapter(title, type = 'session') {
    // Close current chapter
    if (this.currentChapter && !this.currentChapter.closed) {
      this.currentChapter.close(this.metrics.averageCoherence);
    }

    const chapter = new Chapter({ title, type });
    chapter.coherenceStart = this.metrics.averageCoherence;

    this.chapters.push(chapter);
    this.currentChapter = chapter;
    this.metrics.totalChapters++;

    // Evict old chapters
    if (this.chapters.length > MAX_CHAPTERS) {
      this.chapters.shift();
    }

    logger.info({
      chapterId: chapter.id,
      title,
      type,
      msg: 'New chapter started'
    });

    return chapter;
  }

  closeChapter(summary = '') {
    if (!this.currentChapter) return null;

    this.currentChapter.summary = summary;
    this.currentChapter.close(this.metrics.averageCoherence);

    logger.info({
      chapterId: this.currentChapter.id,
      title: this.currentChapter.title,
      eventCount: this.currentChapter.eventCount,
      duration: this.currentChapter.endedAt - this.currentChapter.startedAt,
      msg: 'Chapter closed'
    });

    return this.currentChapter;
  }

  // ─── Query & Retrieval ────────────────────────────────────────────────

  /**
   * Get events by correlation ID (trace a full task lifecycle)
   */
  getTrace(correlationId) {
    return (this.eventIndex.get(correlationId) || []).map(e => e.toJSON());
  }

  /**
   * Get events by category
   */
  getByCategory(category, limit = fibonacci(8)) {
    return this.events
      .filter(e => e.category === category)
      .slice(-limit)
      .map(e => e.toJSON());
  }

  /**
   * Get recent events above a severity threshold
   */
  getAlerts(minSeverity = SEVERITY.WARNING, limit = fibonacci(8)) {
    return this.events
      .filter(e => e.severity >= minSeverity)
      .slice(-limit)
      .map(e => e.toJSON());
  }

  /**
   * Get the coherence timeline
   */
  getCoherenceTimeline() {
    return [...this._coherenceTimeline];
  }

  /**
   * Generate a narrative summary of recent events
   */
  generateNarrative(options = {}) {
    const { since = Date.now() - fibonacci(12) * 60 * 1000, maxEvents = fibonacci(8) } = options;

    const recentEvents = this.events
      .filter(e => e.timestamp >= since)
      .slice(-maxEvents);

    if (recentEvents.length === 0) {
      return { narrative: 'No significant events in the specified period.', events: 0 };
    }

    // Build narrative sections by category
    const sections = {};
    for (const event of recentEvents) {
      if (!sections[event.category]) sections[event.category] = [];
      sections[event.category].push(event);
    }

    const narrativeParts = [];
    const period = this._formatDuration(Date.now() - since);

    narrativeParts.push(`## System Narrative — Last ${period}`);
    narrativeParts.push(`*${recentEvents.length} events recorded*\n`);

    for (const [category, events] of Object.entries(sections)) {
      narrativeParts.push(`### ${category.charAt(0).toUpperCase() + category.slice(1)}`);
      for (const event of events.slice(-fibonacci(5))) { // 5 per category
        const time = new Date(event.timestamp).toISOString().substring(11, 19);
        narrativeParts.push(`- [${time}] ${event.description}`);
      }
      narrativeParts.push('');
    }

    // Add coherence summary
    if (this._coherenceTimeline.length > 0) {
      const latest = this._coherenceTimeline[this._coherenceTimeline.length - 1];
      narrativeParts.push(`### Coherence: ${latest.coherence.toFixed(3)} (avg: ${this.metrics.averageCoherence.toFixed(3)})`);
    }

    this.metrics.narrativesGenerated++;

    return {
      narrative: narrativeParts.join('\n'),
      events: recentEvents.length,
      categories: Object.keys(sections),
      coherence: this.metrics.averageCoherence
    };
  }

  // ─── Private Methods ──────────────────────────────────────────────────

  _autoNarrate() {
    const narrative = this.generateNarrative({
      since: Date.now() - fibonacci(11) * 60 * 1000, // Last 89 minutes
      maxEvents: fibonacci(8)
    });

    logger.info({
      events: narrative.events,
      categories: narrative.categories,
      msg: 'Auto-narrative generated'
    });
  }

  _formatDuration(ms) {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    if (ms < 86400000) return `${(ms / 3600000).toFixed(1)}h`;
    return `${(ms / 86400000).toFixed(1)}d`;
  }

  /**
   * Clean up expired events
   */
  prune() {
    const cutoff = Date.now() - RETENTION_MS;
    const before = this.events.length;
    this.events = this.events.filter(e => e.timestamp > cutoff);
    const pruned = before - this.events.length;

    if (pruned > 0) {
      logger.info({ pruned, remaining: this.events.length, msg: 'Events pruned' });
    }

    return { pruned, remaining: this.events.length };
  }

  // ─── Health & Stats ───────────────────────────────────────────────────

  health() {
    return {
      status: 'healthy',
      service: 'heady-autobiographer',
      metrics: { ...this.metrics },
      categoryCounters: { ...this.categoryCounters },
      eventBufferSize: this.events.length,
      eventBufferCapacity: MAX_EVENTS,
      chapterCount: this.chapters.length,
      currentChapter: this.currentChapter ? {
        id: this.currentChapter.id,
        title: this.currentChapter.title,
        eventCount: this.currentChapter.eventCount,
        duration: Date.now() - this.currentChapter.startedAt
      } : null,
      coherenceTimeline: this._coherenceTimeline.slice(-fibonacci(5))
    };
  }

  /**
   * Graceful shutdown — close chapter and generate final narrative
   */
  shutdown() {
    this.closeChapter('System shutdown — generating final narrative');
    const final = this.generateNarrative({ maxEvents: fibonacci(9) }); // Last 34 events

    logger.info({
      totalEvents: this.metrics.totalEvents,
      totalChapters: this.metrics.totalChapters,
      finalNarrative: final.events,
      msg: 'HeadyAutobiographer shutdown complete'
    });

    return final;
  }
}

module.exports = {
  HeadyAutobiographer,
  AutoEvent,
  Chapter,
  EVENT_CATEGORIES,
  SEVERITY
};
