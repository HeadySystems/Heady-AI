/**
 * @fileoverview Heady State Sync — CRDT-based cross-device real-time sync
 * @module @heady/persistence/sync
 * @version 1.0.0
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 *
 * Optimistic replication with CRDT conflict resolution.
 * WebSocket for real-time, REST for batch. Offline queue with sync-on-reconnect.
 */

import pino from 'pino';
import { WebSocket } from 'ws';
import { PHI, PSI, SYNC, SESSION, CSL } from './constants.js';
import type { UserState } from './persistence-engine.js';

const log = pino({ name: 'heady-state-sync', level: process.env.LOG_LEVEL || 'info' });

/** CRDT operation types */
export type CRDTOp =
  | { type: 'lww'; key: string; value: unknown; timestamp: number; deviceId: string }
  | { type: 'counter'; key: string; delta: number; timestamp: number; deviceId: string }
  | { type: 'set-add'; key: string; value: unknown; timestamp: number; deviceId: string }
  | { type: 'set-remove'; key: string; value: unknown; timestamp: number; deviceId: string };

/** State diff for bandwidth-efficient sync */
export interface StateDiff {
  version: number;
  operations: CRDTOp[];
  checksum: string;
  compressedSize: number;
  originDevice: string;
  timestamp: number;
}

/** Offline queue entry */
interface QueueEntry {
  diff: StateDiff;
  retryCount: number;
  createdAt: number;
}

/**
 * StateSyncEngine — Manages real-time cross-device state synchronization.
 * Uses CRDT for conflict-free merges and phi-exponential backoff for reconnection.
 */
export class StateSyncEngine {
  private ws: WebSocket | null = null;
  private offlineQueue: QueueEntry[] = [];
  private isConnected = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingOps: CRDTOp[] = [];

  constructor(private config: {
    syncUrl: string;
    userId: string;
    deviceId: string;
    onStateUpdate: (state: Partial<UserState>) => void;
  }) {
    log.info({ syncUrl: config.syncUrl, deviceId: config.deviceId }, 'StateSyncEngine initialized');
  }

  /**
   * Connect to the sync server via WebSocket.
   */
  async connect(): Promise<void> {
    const correlationId = `sync-connect-${this.config.deviceId}-${Date.now()}`;
    log.info({ correlationId }, 'Connecting to sync server');

    try {
      this.ws = new WebSocket(this.config.syncUrl, {
        headers: {
          'X-Heady-User': this.config.userId,
          'X-Heady-Device': this.config.deviceId,
        },
      });

      this.ws.on('open', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        log.info({ correlationId }, 'Connected to sync server');
        this.drainOfflineQueue();
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleSyncMessage(msg);
        } catch (err) {
          log.error({ err, correlationId }, 'Failed to parse sync message');
        }
      });

      this.ws.on('close', () => {
        this.isConnected = false;
        log.info({ correlationId }, 'Disconnected from sync server');
        this.scheduleReconnect();
      });

      this.ws.on('error', (err) => {
        log.error({ err, correlationId }, 'Sync WebSocket error');
      });
    } catch (err) {
      log.error({ err, correlationId }, 'Failed to connect to sync server');
      this.scheduleReconnect();
    }
  }

  /**
   * Push a state change to all devices.
   */
  async pushChange(key: string, value: unknown): Promise<void> {
    const op: CRDTOp = {
      type: 'lww',
      key,
      value,
      timestamp: Date.now(),
      deviceId: this.config.deviceId,
    };
    this.pendingOps.push(op);

    if (this.pendingOps.length >= SYNC.BATCH_SIZE) {
      await this.flushPendingOps();
    }
  }

  /**
   * Increment a counter across devices (e.g., usage metrics).
   */
  async incrementCounter(key: string, delta: number): Promise<void> {
    const op: CRDTOp = {
      type: 'counter',
      key,
      delta,
      timestamp: Date.now(),
      deviceId: this.config.deviceId,
    };
    this.pendingOps.push(op);
  }

  /**
   * Flush pending operations as a batched diff.
   */
  async flushPendingOps(): Promise<void> {
    if (this.pendingOps.length === 0) return;

    const diff: StateDiff = {
      version: Date.now(),
      operations: [...this.pendingOps],
      checksum: this.computeChecksum(this.pendingOps),
      compressedSize: JSON.stringify(this.pendingOps).length,
      originDevice: this.config.deviceId,
      timestamp: Date.now(),
    };

    this.pendingOps = [];

    if (this.isConnected && this.ws) {
      this.ws.send(JSON.stringify({ type: 'state-diff', diff }));
      log.info({ ops: diff.operations.length }, 'State diff pushed to sync server');
    } else {
      this.enqueueOffline(diff);
    }
  }

  /**
   * Resolve CRDT conflicts using Last-Writer-Wins with device priority.
   */
  resolveCRDTConflict(local: CRDTOp, remote: CRDTOp): CRDTOp {
    if (local.type === 'counter' && remote.type === 'counter') {
      // Counters are commutative — merge both deltas
      return {
        type: 'counter',
        key: local.key,
        delta: local.delta + remote.delta,
        timestamp: Math.max(local.timestamp, remote.timestamp),
        deviceId: local.timestamp >= remote.timestamp ? local.deviceId : remote.deviceId,
      };
    }

    // LWW: latest timestamp wins. Tie-break by deviceId lexicographic order
    if (local.timestamp > remote.timestamp) return local;
    if (remote.timestamp > local.timestamp) return remote;
    return local.deviceId < remote.deviceId ? local : remote;
  }

  /**
   * Get health status.
   */
  getHealth(): { status: string; coherenceScore: number; connected: boolean; offlineQueueSize: number } {
    return {
      status: this.isConnected ? 'healthy' : 'reconnecting',
      coherenceScore: this.isConnected ? CSL.HIGH : CSL.LOW,
      connected: this.isConnected,
      offlineQueueSize: this.offlineQueue.length,
    };
  }

  /**
   * Graceful disconnect.
   */
  async disconnect(): Promise<void> {
    await this.flushPendingOps();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) this.ws.close();
    log.info('StateSyncEngine disconnected');
  }

  /** Handle incoming sync message */
  private handleSyncMessage(msg: { type: string; diff?: StateDiff; state?: Partial<UserState> }): void {
    switch (msg.type) {
      case 'state-diff':
        if (msg.diff && msg.diff.originDevice !== this.config.deviceId) {
          this.applyRemoteDiff(msg.diff);
        }
        break;
      case 'full-state':
        if (msg.state) {
          this.config.onStateUpdate(msg.state);
        }
        break;
      default:
        log.warn({ msgType: msg.type }, 'Unknown sync message type');
    }
  }

  /** Apply remote diff to local state */
  private applyRemoteDiff(diff: StateDiff): void {
    const stateUpdate: Record<string, unknown> = {};
    for (const op of diff.operations) {
      if (op.type === 'lww') {
        stateUpdate[op.key] = op.value;
      }
    }
    if (Object.keys(stateUpdate).length > 0) {
      this.config.onStateUpdate(stateUpdate as Partial<UserState>);
      log.info({ ops: diff.operations.length, origin: diff.originDevice }, 'Remote diff applied');
    }
  }

  /** Enqueue diff for offline retry */
  private enqueueOffline(diff: StateDiff): void {
    if (this.offlineQueue.length >= SYNC.OFFLINE_QUEUE_MAX) {
      // Drop oldest entries when queue is full
      this.offlineQueue.shift();
      log.warn('Offline queue full — dropping oldest entry');
    }
    this.offlineQueue.push({ diff, retryCount: 0, createdAt: Date.now() });
    log.info({ queueSize: this.offlineQueue.length }, 'Diff enqueued for offline sync');
  }

  /** Drain offline queue on reconnect */
  private async drainOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0 || !this.ws || !this.isConnected) return;
    log.info({ queueSize: this.offlineQueue.length }, 'Draining offline queue');

    const queue = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const entry of queue) {
      try {
        this.ws.send(JSON.stringify({ type: 'state-diff', diff: entry.diff }));
      } catch (err) {
        log.error({ err }, 'Failed to drain offline queue entry');
        this.offlineQueue.push({ ...entry, retryCount: entry.retryCount + 1 });
      }
    }
  }

  /** Schedule reconnect with phi-exponential backoff */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= SESSION.MAX_RECONNECT_ATTEMPTS) {
      log.error('Max reconnect attempts reached');
      return;
    }

    const backoffMs = Math.round(Math.pow(PHI, this.reconnectAttempts) * SESSION.RECONNECT_BASE_MS);
    const jitter = (Math.random() - 0.5) * 2 * PSI * backoffMs;
    const delay = Math.max(SESSION.RECONNECT_BASE_MS, Math.round(backoffMs + jitter));

    log.info({ attempt: this.reconnectAttempts, delayMs: delay }, 'Scheduling reconnect');
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  /** Compute simple checksum for diff validation */
  private computeChecksum(ops: CRDTOp[]): string {
    const data = JSON.stringify(ops);
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}
