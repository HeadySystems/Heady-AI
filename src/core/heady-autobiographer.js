// ═══════════════════════════════════════════════════════════════════════════════
// HEADY™ Autobiographer — Event Logging & Narrative Construction
// © 2026 HeadySystems Inc. — Eric Haywood, Founder
// ═══════════════════════════════════════════════════════════════════════════════

import {
  PHI, PSI, PSI2, FIB, CSL_THRESHOLDS, sha256, phiFusionWeights
} from '../shared/phi-math-v2.js';
import { textToEmbedding, cslAND, DIM } from '../shared/csl-engine-v2.js';

const EVENT_TYPES = Object.freeze([
  'task_started', 'task_completed', 'task_failed',
  'mutation_proposed', 'mutation_applied', 'mutation_rolled_back',
  'drift_detected', 'drift_resolved',
  'healing_started', 'healing_completed',
  'pattern_learned', 'pattern_applied',
  'council_convened', 'consensus_reached',
  'budget_alert', 'budget_downgrade',
  'system_boot', 'system_shutdown',
]);

class HeadyAutobiographer {
  #events;
  #narratives;
  #maxEvents;
  #maxNarratives;
  #retentionDays;

  constructor() {
    this.#events = [];
    this.#narratives = [];
    this.#maxEvents = FIB[20]; // 6765
    this.#maxNarratives = FIB[12]; // 144
    this.#retentionDays = FIB[11]; // 89
  }

  async record(eventType, actor, description, metadata = {}) {
    if (!EVENT_TYPES.includes(eventType)) {
      throw new Error('Unknown event type: ' + eventType);
    }

    const event = {
      id: await sha256(eventType + ':' + actor + ':' + Date.now()),
      type: eventType,
      actor,
      description: description.slice(0, FIB[12] * FIB[3]),
      embedding: textToEmbedding(description),
      metadata,
      timestamp: Date.now(),
    };

    this.#events.push(event);
    if (this.#events.length > this.#maxEvents) {
      this.#events = this.#events.slice(-this.#maxEvents);
    }

    return event;
  }

  getNarrative(timeRangeMs = FIB[8] * 60 * 60 * 1000) {
    const cutoff = Date.now() - timeRangeMs;
    const relevant = this.#events.filter(e => e.timestamp >= cutoff);

    const grouped = {};
    for (const event of relevant) {
      const hour = new Date(event.timestamp).toISOString().slice(0, 13);
      if (!grouped[hour]) grouped[hour] = [];
      grouped[hour].push(event);
    }

    const narrative = Object.entries(grouped).map(([hour, events]) => ({
      period: hour,
      eventCount: events.length,
      summary: this.#summarizeEvents(events),
      actors: [...new Set(events.map(e => e.actor))],
      types: [...new Set(events.map(e => e.type))],
    }));

    return { periods: narrative, totalEvents: relevant.length, timeRange: timeRangeMs };
  }

  summarize(limit = FIB[6]) {
    const recent = this.#events.slice(-limit * FIB[5]);
    const typeCounts = {};
    const actorCounts = {};

    for (const event of recent) {
      typeCounts[event.type] = (typeCounts[event.type] || 0) + 1;
      actorCounts[event.actor] = (actorCounts[event.actor] || 0) + 1;
    }

    return {
      totalEvents: recent.length,
      typeCounts,
      actorCounts,
      timeSpan: recent.length > 0
        ? { from: recent[0].timestamp, to: recent[recent.length - 1].timestamp }
        : null,
    };
  }

  getTimeline(limit = FIB[8]) {
    return this.#events.slice(-limit).map(e => ({
      id: e.id,
      type: e.type,
      actor: e.actor,
      description: e.description.slice(0, FIB[10]),
      timestamp: e.timestamp,
    }));
  }

  async exportStory(format = 'json') {
    const narrative = this.getNarrative();
    const story = {
      title: 'HEADY System Autobiography',
      generatedAt: Date.now(),
      founder: 'Eric Haywood',
      narrative: narrative.periods,
      summary: this.summarize(),
      hash: await sha256(JSON.stringify(narrative)),
    };

    if (format === 'markdown') {
      let md = '# HEADY System Autobiography\n';
      md += 'Generated: ' + new Date().toISOString() + '\n\n';
      for (const period of story.narrative) {
        md += '## ' + period.period + '\n';
        md += period.summary + '\n\n';
      }
      return md;
    }

    return story;
  }

  search(query, limit = FIB[8]) {
    const queryEmb = textToEmbedding(query);
    const scored = this.#events.map(e => ({
      event: e,
      relevance: e.embedding.reduce((s, v, i) => s + v * queryEmb[i], 0) /
        (Math.sqrt(e.embedding.reduce((s, v) => s + v * v, 0)) *
         Math.sqrt(queryEmb.reduce((s, v) => s + v * v, 0))),
    }));
    scored.sort((a, b) => b.relevance - a.relevance);
    return scored.slice(0, limit).map(s => ({
      ...s.event,
      relevance: s.relevance,
    }));
  }

  getEventTypes() { return EVENT_TYPES; }

  #summarizeEvents(events) {
    const types = [...new Set(events.map(e => e.type))];
    return events.length + ' events: ' + types.join(', ');
  }
}

export { HeadyAutobiographer, EVENT_TYPES };
export default HeadyAutobiographer;
