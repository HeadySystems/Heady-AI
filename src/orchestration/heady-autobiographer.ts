/**
 * Heady™ Autobiographer v5.0.0
 * Event logging, narrative construction, pattern recording
 * Author: Eric Haywood / HeadySystems Inc. — 51 Provisional Patents
 */

import { PHI, PSI, FIB, CSL_THRESHOLDS, TIMING } from '../../shared/phi-math.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('autobiographer');

// ═══ Types ═══
export type EventCategory =
  | 'task' | 'decision' | 'discovery' | 'error' | 'recovery'
  | 'deployment' | 'learning' | 'milestone' | 'collaboration' | 'governance';

export interface LifeEvent {
  id: string;
  category: EventCategory;
  title: string;
  narrative: string;
  actors: string[];
  embedding: number[] | null;
  impact: number;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface Pattern {
  id: string;
  name: string;
  description: string;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  relatedEvents: string[];
  strength: number;
  embedding: number[] | null;
}

export interface NarrativeChapter {
  title: string;
  timeRange: { start: string; end: string };
  events: LifeEvent[];
  patterns: Pattern[];
  summary: string;
}

// ═══ State ═══
const timeline: LifeEvent[] = [];
const patterns = new Map<string, Pattern>();
const MAX_TIMELINE_SIZE = FIB[17]; // 1597

// ═══ Record Event ═══
export function recordEvent(
  category: EventCategory,
  title: string,
  narrative: string,
  actors: string[] = [],
  impact: number = PSI,
  embedding: number[] | null = null,
  metadata: Record<string, unknown> = {},
): LifeEvent {
  const event: LifeEvent = {
    id: `event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    category,
    title,
    narrative,
    actors,
    embedding,
    impact,
    timestamp: new Date().toISOString(),
    metadata,
  };

  timeline.push(event);

  // Trim if over capacity
  while (timeline.length > MAX_TIMELINE_SIZE) {
    timeline.shift();
  }

  logger.info('Event recorded', { eventId: event.id, category, title, actors });
  return event;
}

// ═══ Detect Pattern ═══
export function detectPattern(
  name: string,
  description: string,
  relatedEventIds: string[],
  embedding: number[] | null = null,
): Pattern {
  const existing = patterns.get(name);

  if (existing) {
    existing.occurrences++;
    existing.lastSeen = new Date().toISOString();
    existing.relatedEvents.push(...relatedEventIds);
    // Keep last FIB[9] related events
    while (existing.relatedEvents.length > FIB[9]) existing.relatedEvents.shift();
    existing.strength = Math.min(1.0, existing.strength + Math.pow(PSI, 3));
    return existing;
  }

  const pattern: Pattern = {
    id: `pattern-${Date.now().toString(36)}`,
    name,
    description,
    occurrences: 1,
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    relatedEvents: relatedEventIds,
    strength: Math.pow(PSI, 2), // Start at ≈ 0.382
    embedding,
  };

  patterns.set(name, pattern);
  logger.info('Pattern detected', { patternId: pattern.id, name, description });
  return pattern;
}

// ═══ Get Timeline ═══
export function getTimeline(options?: {
  category?: EventCategory;
  since?: string;
  limit?: number;
  minImpact?: number;
}): LifeEvent[] {
  let events = [...timeline];

  if (options?.category) events = events.filter(e => e.category === options.category);
  if (options?.since) {
    const sinceMs = new Date(options.since).getTime();
    events = events.filter(e => new Date(e.timestamp).getTime() >= sinceMs);
  }
  if (options?.minImpact) events = events.filter(e => e.impact >= options.minImpact);

  const limit = options?.limit || FIB[8]; // 21 default
  return events.slice(-limit);
}

// ═══ Get Patterns ═══
export function getPatterns(minStrength: number = CSL_THRESHOLDS.MINIMUM): Pattern[] {
  return Array.from(patterns.values())
    .filter(p => p.strength >= minStrength)
    .sort((a, b) => b.strength - a.strength);
}

// ═══ Build Narrative Chapter ═══
export function buildChapter(
  title: string,
  startTime: string,
  endTime: string,
): NarrativeChapter {
  const startMs = new Date(startTime).getTime();
  const endMs = new Date(endTime).getTime();

  const events = timeline.filter(e => {
    const ts = new Date(e.timestamp).getTime();
    return ts >= startMs && ts <= endMs;
  });

  const relatedPatterns = Array.from(patterns.values()).filter(p => {
    const lastMs = new Date(p.lastSeen).getTime();
    return lastMs >= startMs && lastMs <= endMs;
  });

  // Auto-generate summary
  const categoryCounts = events.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topCategories = Object.entries(categoryCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, FIB[3])
    .map(([cat, count]) => `${count} ${cat} events`);

  const summary = `Chapter "${title}": ${events.length} events across ${topCategories.join(', ')}. ` +
    `${relatedPatterns.length} patterns active. ` +
    `Average impact: ${events.length > 0 ? (events.reduce((s, e) => s + e.impact, 0) / events.length).toFixed(3) : 'N/A'}.`;

  return { title, timeRange: { start: startTime, end: endTime }, events, patterns: relatedPatterns, summary };
}

// ═══ Stats ═══
export function getAutobiographerStats(): Record<string, unknown> {
  return {
    totalEvents: timeline.length,
    maxTimelineSize: MAX_TIMELINE_SIZE,
    totalPatterns: patterns.size,
    categoryDistribution: timeline.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    strongestPatterns: Array.from(patterns.values())
      .sort((a, b) => b.strength - a.strength)
      .slice(0, FIB[5])
      .map(p => ({ name: p.name, strength: p.strength, occurrences: p.occurrences })),
  };
}
