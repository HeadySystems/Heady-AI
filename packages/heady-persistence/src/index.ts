/**
 * @fileoverview Heady Persistence — Complete user state management system
 * @module @heady/persistence
 * @version 1.0.0
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 */

export { PersistenceEngine } from './persistence-engine.js';
export type { UserState, UserProfile, DeviceSession, UserPreferences, BuddyConfig, ConnectedService } from './persistence-engine.js';
export { SessionManager } from './session-manager.js';
export type { SessionToken, CookieOptions } from './session-manager.js';
export { StateSyncEngine } from './state-sync.js';
export type { CRDTOp, StateDiff } from './state-sync.js';
export { PHI, PSI, FIB, CSL, SESSION, SYNC, EMBEDDING_DIM, HEADY_DOMAINS } from './constants.js';
