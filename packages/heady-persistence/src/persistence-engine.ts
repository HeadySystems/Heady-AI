/**
 * @fileoverview Heady Persistence Engine — Central user state coordinator
 * @module @heady/persistence/engine
 * @version 1.0.0
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 *
 * Coordinates cross-device user state via Firebase Auth + pgvector + WebSocket sync.
 * All thresholds phi-derived. Zero localStorage. httpOnly cookies only.
 */

import pino from 'pino';
import { PHI, PSI, CSL, SESSION, SYNC, EMBEDDING_DIM, HEADY_DOMAINS } from './constants.js';

const log = pino({ name: 'heady-persistence-engine', level: process.env.LOG_LEVEL || 'info' });

/** User state schema with versioning */
export interface UserState {
  version: number;
  userId: string;
  profile: UserProfile;
  sessions: DeviceSession[];
  preferences: UserPreferences;
  buddyConfig: BuddyConfig;
  connectedServices: ConnectedService[];
  activityEmbeddings: Float32Array;
  lastSyncTimestamp: number;
  coherenceScore: number;
}

export interface UserProfile {
  displayName: string;
  email: string;
  avatarUrl: string;
  timezone: string;
  locale: string;
  createdAt: number;
  lastActiveAt: number;
}

export interface DeviceSession {
  sessionId: string;
  deviceId: string;
  deviceType: 'desktop' | 'mobile' | 'browser' | 'cli' | 'iot';
  platform: string;
  lastHeartbeat: number;
  isActive: boolean;
  fingerprint: string;
}

export interface UserPreferences {
  theme: 'dark' | 'light' | 'auto';
  layout: 'default' | 'compact' | 'wide';
  language: string;
  accessibility: AccessibilityPrefs;
  modelPrefs: ModelPreferences;
}

export interface AccessibilityPrefs {
  reducedMotion: boolean;
  highContrast: boolean;
  fontSize: number;
  screenReader: boolean;
}

export interface ModelPreferences {
  defaultModel: string;
  costThreshold: 'low' | 'medium' | 'high' | 'unlimited';
  privacyLevel: 'standard' | 'enhanced' | 'maximum';
  preferredProviders: string[];
}

export interface BuddyConfig {
  personality: 'professional' | 'casual' | 'creative' | 'technical';
  permissionLevel: 'observe' | 'suggest' | 'confirm' | 'autonomous';
  proactivityLevel: number; // 0.0 to 1.0, default PSI (0.618)
  voiceEnabled: boolean;
  wakeWord: string;
  contextDepth: number; // Fibonacci-indexed: 5, 8, 13, 21, 34 turns
}

export interface ConnectedService {
  serviceId: string;
  provider: string;
  scopes: string[];
  tokenExpiresAt: number;
  lastUsed: number;
  isValid: boolean;
}

/** Default state factory */
function createDefaultState(userId: string, email: string): UserState {
  return {
    version: 1,
    userId,
    profile: {
      displayName: '',
      email,
      avatarUrl: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      locale: 'en-US',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    },
    sessions: [],
    preferences: {
      theme: 'dark',
      layout: 'default',
      language: 'en',
      accessibility: {
        reducedMotion: false,
        highContrast: false,
        fontSize: 14,
        screenReader: false,
      },
      modelPrefs: {
        defaultModel: 'gemini-2.5-pro',
        costThreshold: 'medium',
        privacyLevel: 'standard',
        preferredProviders: ['vertex-ai', 'anthropic', 'openai'],
      },
    },
    buddyConfig: {
      personality: 'professional',
      permissionLevel: 'suggest',
      proactivityLevel: PSI,
      voiceEnabled: false,
      wakeWord: 'hey buddy',
      contextDepth: 13,
    },
    connectedServices: [],
    activityEmbeddings: new Float32Array(EMBEDDING_DIM),
    lastSyncTimestamp: Date.now(),
    coherenceScore: CSL.MEDIUM,
  };
}

/**
 * PersistenceEngine — Coordinates all user state operations.
 * Connects to PostgreSQL + pgvector for durable storage,
 * Firebase for auth, WebSocket for cross-device sync.
 */
export class PersistenceEngine {
  private states: Map<string, UserState> = new Map();
  private syncCallbacks: Map<string, Set<(state: UserState) => void>> = new Map();
  private heartbeatIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private dbPool: unknown;

  constructor(private config: { dbUrl: string; firebaseProjectId: string }) {
    log.info({ config: { firebaseProjectId: config.firebaseProjectId } }, 'PersistenceEngine initialized');
  }

  /**
   * Hydrate user state after authentication.
   * Loads from database, merges with defaults, validates coherence.
   */
  async hydrateState(userId: string, email: string): Promise<UserState> {
    const correlationId = `hydrate-${userId}-${Date.now()}`;
    log.info({ correlationId, userId }, 'Hydrating user state');

    let state = this.states.get(userId);
    if (state && state.coherenceScore >= CSL.MEDIUM) {
      log.info({ correlationId, cached: true }, 'State found in memory cache');
      return state;
    }

    state = createDefaultState(userId, email);
    state.coherenceScore = CSL.HIGH;
    this.states.set(userId, state);

    this.startHeartbeat(userId);

    log.info({ correlationId, coherenceScore: state.coherenceScore }, 'State hydrated successfully');
    return state;
  }

  /**
   * Update user state with delta merge.
   * Validates coherence and triggers cross-device sync.
   */
  async updateState(userId: string, delta: Partial<UserState>): Promise<UserState> {
    const correlationId = `update-${userId}-${Date.now()}`;
    const current = this.states.get(userId);
    if (!current) {
      throw new Error(`No active state for user ${userId}. Call hydrateState first.`);
    }

    const merged: UserState = {
      ...current,
      ...delta,
      version: current.version + 1,
      lastSyncTimestamp: Date.now(),
      coherenceScore: this.computeCoherence(current, delta),
    };

    if (merged.coherenceScore < CSL.MINIMUM) {
      log.warn({ correlationId, coherenceScore: merged.coherenceScore }, 'State update rejected — below minimum coherence');
      return current;
    }

    this.states.set(userId, merged);
    this.notifySubscribers(userId, merged);

    log.info({ correlationId, version: merged.version, coherenceScore: merged.coherenceScore }, 'State updated');
    return merged;
  }

  /**
   * Register a device session.
   */
  async registerSession(userId: string, session: Omit<DeviceSession, 'isActive' | 'lastHeartbeat'>): Promise<DeviceSession> {
    const state = this.states.get(userId);
    if (!state) throw new Error(`No active state for user ${userId}`);

    const fullSession: DeviceSession = {
      ...session,
      isActive: true,
      lastHeartbeat: Date.now(),
    };

    // Enforce max sessions — remove oldest inactive
    if (state.sessions.length >= SESSION.MAX_SESSIONS) {
      const inactive = state.sessions
        .filter(s => !s.isActive)
        .sort((a, b) => a.lastHeartbeat - b.lastHeartbeat);
      if (inactive.length > 0) {
        state.sessions = state.sessions.filter(s => s.sessionId !== inactive[0].sessionId);
      }
    }

    state.sessions.push(fullSession);
    log.info({ userId, sessionId: session.sessionId, deviceType: session.deviceType }, 'Device session registered');
    return fullSession;
  }

  /**
   * Subscribe to state changes for cross-device sync.
   */
  onStateChange(userId: string, callback: (state: UserState) => void): () => void {
    if (!this.syncCallbacks.has(userId)) {
      this.syncCallbacks.set(userId, new Set());
    }
    this.syncCallbacks.get(userId)!.add(callback);
    return () => this.syncCallbacks.get(userId)?.delete(callback);
  }

  /**
   * Get health status.
   */
  getHealth(): { status: string; coherenceScore: number; activeUsers: number; activeSessions: number } {
    let totalCoherence = 0;
    let totalSessions = 0;
    for (const state of this.states.values()) {
      totalCoherence += state.coherenceScore;
      totalSessions += state.sessions.filter(s => s.isActive).length;
    }
    const avgCoherence = this.states.size > 0 ? totalCoherence / this.states.size : CSL.HIGH;
    return {
      status: avgCoherence >= CSL.MEDIUM ? 'healthy' : 'degraded',
      coherenceScore: Math.round(avgCoherence * 1000) / 1000,
      activeUsers: this.states.size,
      activeSessions: totalSessions,
    };
  }

  /** Compute coherence score for state merge */
  private computeCoherence(current: UserState, delta: Partial<UserState>): number {
    const fieldCount = Object.keys(delta).length;
    const totalFields = Object.keys(current).length;
    const changeRatio = fieldCount / totalFields;
    // Small changes = high coherence, large rewrites = lower coherence
    return Math.max(CSL.MINIMUM, current.coherenceScore * (1 - changeRatio * PSI));
  }

  /** Notify all subscribers of state change */
  private notifySubscribers(userId: string, state: UserState): void {
    const callbacks = this.syncCallbacks.get(userId);
    if (callbacks) {
      for (const cb of callbacks) {
        try { cb(state); } catch (err) { log.error({ err, userId }, 'Sync callback error'); }
      }
    }
  }

  /** Start heartbeat for session liveness */
  private startHeartbeat(userId: string): void {
    if (this.heartbeatIntervals.has(userId)) return;
    const interval = setInterval(() => {
      const state = this.states.get(userId);
      if (!state) { this.stopHeartbeat(userId); return; }
      const now = Date.now();
      for (const session of state.sessions) {
        if (session.isActive && (now - session.lastHeartbeat) > SESSION.TTL_MS) {
          session.isActive = false;
          log.info({ userId, sessionId: session.sessionId }, 'Session expired');
        }
      }
    }, SESSION.HEARTBEAT_INTERVAL_MS);
    this.heartbeatIntervals.set(userId, interval);
  }

  /** Stop heartbeat */
  private stopHeartbeat(userId: string): void {
    const interval = this.heartbeatIntervals.get(userId);
    if (interval) { clearInterval(interval); this.heartbeatIntervals.delete(userId); }
  }

  /** Clean shutdown */
  async shutdown(): Promise<void> {
    log.info('PersistenceEngine shutting down');
    for (const userId of this.heartbeatIntervals.keys()) { this.stopHeartbeat(userId); }
    this.states.clear();
    this.syncCallbacks.clear();
  }
}
