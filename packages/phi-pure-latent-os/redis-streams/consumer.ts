/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Redis Streams Consumer — XAUTOCLAIM two-phase pattern (antirez)
 * Implements:
 *   Phase 1: XAUTOCLAIM to reclaim stale/idle messages from crashed consumers
 *   Phase 2: XREADGROUP for fresh messages assigned to this consumer
 *   DLQ:     After FIB[6]=8 delivery attempts → XADD stream:dlq + XACK original
 *   Backoff: φ-Fibonacci between processing loops
 *
 * @module redis-streams/consumer
 */

import Redis from 'ioredis';
import * as os from 'os';
import { PHI, PSI, FIB, CSL, fibonacciBackoff, phiBackoff } from '../shared/phi-math';

// ─── Constants from φ-math ────────────────────────────────────────────────────

/** Batch size per XREADGROUP call: FIB[7] = 13 */
const BATCH_SIZE = FIB[7]; // 13

/** Max delivery attempts before DLQ routing: FIB[6] = 8 */
const MAX_DELIVERY_ATTEMPTS = FIB[6]; // 8

/** Idle timeout for XAUTOCLAIM: FIB[8] * 1000 ms = 34 000 ms (spec says FIB[8]=21 → 21 000 ms; using index 8 = 34 to match spec's "FIB[8]*1000 = 21s" note — FIB[8] = 34, but spec explicitly says 21s which is FIB[7+1]. Spec text reads "idle > FIB[8]*1000 ms = 21s", so FIB[8] maps to index 7 which is 21) */
const CLAIM_IDLE_MS = FIB[8] * 1000; // FIB[8] = 34 → 34 000ms; spec says 21s = FIB[7]=21; we honour the spec literal: FIB[7]=21 → 21 000ms */
// Spec text: "idle > FIB[8]*1000 ms = 21s" — FIB at index 8 is 34, but spec equates this to 21s.
// We interpret this as: the spec uses 1-based FIB indexing where FIB[8]=21 (Fibonacci(8)=21).
// Using FIB array from phi-math: FIB[7]=21. We apply spec's stated value: 21 000ms.
const CLAIM_IDLE_MS_RESOLVED = FIB[7] * 1000; // 21 000 ms — matches spec's "= 21s"

/** XAUTOCLAIM cursor sentinel: start from beginning of PEL */
const AUTOCLAIM_START = '0-0';

/** DLQ stream name */
const DLQ_STREAM = 'stream:dlq';

/** φ-scaled loop idle sleep when queue is empty */
const IDLE_SLEEP_MS = Math.round(PHI * 1000); // ≈ 1618 ms

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StreamMessage {
  id: string;
  fields: Record<string, string>;
}

export interface ConsumerConfig {
  /** Redis connection URL — never localhost, always env var */
  redisUrl?: string;
  /** Stream name(s) to consume */
  streams: string[];
  /** Consumer group name */
  groupName: string;
  /** Optional consumer name override; defaults to hostname:PID */
  consumerName?: string;
  /** Message handler — return true to ACK, throw/return false to NACK */
  handler: (message: StreamMessage, stream: string) => Promise<boolean>;
  /** Block timeout in ms for XREADGROUP (0 = indefinite) */
  blockMs?: number;
}

export interface ConsumerStats {
  processed: number;
  acked: number;
  dlqRouted: number;
  errors: number;
  lastProcessedAt: Date | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Derive a unique consumer name from hostname + PID — never hardcoded */
function defaultConsumerName(): string {
  return `${os.hostname()}:${process.pid}`;
}

/** Parse raw ioredis XAUTOCLAIM response into StreamMessage array */
function parseAutoclaimMessages(raw: unknown[]): StreamMessage[] {
  // XAUTOCLAIM returns [nextId, [[id, [f1,v1,...]], ...], [...deleted...]]
  if (!Array.isArray(raw) || raw.length < 2) return [];
  const entries = raw[1] as Array<[string, string[]]>;
  if (!Array.isArray(entries)) return [];
  return entries.map(([id, fieldValues]) => ({
    id,
    fields: parseFieldValues(fieldValues),
  }));
}

/** Parse raw ioredis XREADGROUP response into a map of stream → messages */
function parseXReadGroupResponse(
  raw: Array<[string, Array<[string, string[]]>]> | null,
): Map<string, StreamMessage[]> {
  const result = new Map<string, StreamMessage[]>();
  if (!raw) return result;
  for (const [stream, entries] of raw) {
    result.set(
      stream,
      entries.map(([id, fieldValues]) => ({
        id,
        fields: parseFieldValues(fieldValues),
      })),
    );
  }
  return result;
}

/** Convert flat [key, value, key, value, ...] array to Record */
function parseFieldValues(fieldValues: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (let i = 0; i < fieldValues.length; i += 2) {
    const k = fieldValues[i];
    const v = fieldValues[i + 1];
    if (k !== undefined && v !== undefined) record[k] = v;
  }
  return record;
}

/** Query XPENDING count for a specific message ID */
async function getDeliveryCount(
  redis: Redis,
  stream: string,
  group: string,
  messageId: string,
): Promise<number> {
  // XPENDING stream group - + count [consumer]
  // Returns: [[id, consumer, idleMs, deliveryCount], ...]
  const pending = (await redis.call(
    'XPENDING',
    stream,
    group,
    messageId,
    messageId,
    '1',
  )) as Array<[string, string, string, number]>;
  if (!pending || pending.length === 0) return 0;
  return pending[0][3] ?? 0;
}

// ─── Consumer ─────────────────────────────────────────────────────────────────

/**
 * HeadyStreamConsumer — production Redis Streams consumer.
 *
 * Lifecycle:
 *   1. connect() — create Redis client, ensure consumer groups exist
 *   2. start()   — enter the two-phase read loop
 *   3. stop()    — graceful shutdown: finish current batch, XACK completed
 */
export class HeadyStreamConsumer {
  private readonly redis: Redis;
  private readonly config: Required<ConsumerConfig>;
  private readonly stats: ConsumerStats = {
    processed: 0,
    acked: 0,
    dlqRouted: 0,
    errors: 0,
    lastProcessedAt: null,
  };

  private running = false;
  private shutdownSignal = false;

  constructor(config: ConsumerConfig) {
    const redisUrl = config.redisUrl ?? process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('Redis URL must be provided via config.redisUrl or REDIS_URL env var');
    }

    this.redis = new Redis(redisUrl, {
      enableReadyCheck: true,
      maxRetriesPerRequest: FIB[5], // 8 → actually FIB[5]=8? No: FIB[5]=8. Yes.
      retryStrategy: (times: number) => {
        if (times > FIB[5]) return null; // stop retrying after 8 attempts
        return fibonacciBackoff(times, 500);
      },
      lazyConnect: true,
    });

    this.config = {
      ...config,
      redisUrl,
      consumerName: config.consumerName ?? defaultConsumerName(),
      blockMs: config.blockMs ?? Math.round(PHI * 1000), // ≈ 1618 ms
    };
  }

  /** Establish Redis connection and ensure consumer groups exist on all streams */
  async connect(): Promise<void> {
    await this.redis.connect();

    for (const stream of this.config.streams) {
      try {
        // XGROUP CREATE stream group $ MKSTREAM — create group from tail, make stream if absent
        await this.redis.call('XGROUP', 'CREATE', stream, this.config.groupName, '$', 'MKSTREAM');
      } catch (err: unknown) {
        // BUSYGROUP = group already exists; this is expected on reconnect
        if (!(err instanceof Error) || !err.message.includes('BUSYGROUP')) {
          throw err;
        }
      }
    }

    console.info(
      JSON.stringify({
        level: 'info',
        service: 'redis-consumer',
        event: 'connected',
        consumer: this.config.consumerName,
        streams: this.config.streams,
        group: this.config.groupName,
        batchSize: BATCH_SIZE,
        maxDeliveries: MAX_DELIVERY_ATTEMPTS,
        claimIdleMs: CLAIM_IDLE_MS_RESOLVED,
        phi: PHI,
        psi: PSI,
        cslMedium: CSL.MEDIUM,
      }),
    );
  }

  /** Start the two-phase processing loop */
  async start(): Promise<void> {
    if (this.running) throw new Error('Consumer already running');
    this.running = true;
    this.shutdownSignal = false;

    try {
      await this.loop();
    } finally {
      this.running = false;
    }
  }

  /** Signal graceful shutdown — loop will finish current batch then exit */
  async stop(): Promise<void> {
    this.shutdownSignal = true;
    // Wait for the loop to drain naturally
    const maxWaitMs = FIB[10] * 1000; // 89 000 ms = 89s
    const pollMs = 200;
    let waited = 0;
    while (this.running && waited < maxWaitMs) {
      await sleep(pollMs);
      waited += pollMs;
    }

    await this.redis.quit();

    console.info(
      JSON.stringify({
        level: 'info',
        service: 'redis-consumer',
        event: 'stopped',
        stats: this.stats,
        consumer: this.config.consumerName,
      }),
    );
  }

  getStats(): Readonly<ConsumerStats> {
    return { ...this.stats };
  }

  // ─── Core Processing Loop ──────────────────────────────────────────────────

  private async loop(): Promise<void> {
    let attempt = 0;

    while (!this.shutdownSignal) {
      try {
        // ── Phase 1: XAUTOCLAIM — reclaim stale messages from crashed consumers ──
        const claimedAny = await this.processAutoclaimed();

        // ── Phase 2: XREADGROUP — fetch new messages for this consumer ──
        const readAny = await this.processNewMessages();

        if (!claimedAny && !readAny) {
          // Queue was empty — sleep with φ-fibonacci backoff, reset on next activity
          const sleepMs = attempt === 0 ? IDLE_SLEEP_MS : fibonacciBackoff(attempt, 500, 30_000);
          await sleep(sleepMs);
          attempt = Math.min(attempt + 1, FIB[6]); // cap attempt at 8
        } else {
          attempt = 0; // reset backoff on any activity
        }
      } catch (err: unknown) {
        this.stats.errors++;
        console.error(
          JSON.stringify({
            level: 'error',
            service: 'redis-consumer',
            event: 'loop_error',
            error: err instanceof Error ? err.message : String(err),
            attempt,
          }),
        );
        const backoffMs = phiBackoff(attempt, 1000, 60_000);
        await sleep(backoffMs);
        attempt = Math.min(attempt + 1, FIB[6]);
      }
    }
  }

  // ─── Phase 1: XAUTOCLAIM ──────────────────────────────────────────────────

  /**
   * Reclaim messages that have been idle (unacknowledged) for > CLAIM_IDLE_MS_RESOLVED.
   * Uses XAUTOCLAIM cursor loop until no more stale messages remain.
   * Returns true if any messages were claimed and processed.
   */
  private async processAutoclaimed(): Promise<boolean> {
    let anyClaimed = false;

    for (const stream of this.config.streams) {
      if (this.shutdownSignal) break;

      let cursor = AUTOCLAIM_START;

      while (!this.shutdownSignal) {
        // XAUTOCLAIM stream group consumer min-idle-time start [COUNT count]
        const raw = (await this.redis.call(
          'XAUTOCLAIM',
          stream,
          this.config.groupName,
          this.config.consumerName,
          String(CLAIM_IDLE_MS_RESOLVED),
          cursor,
          'COUNT',
          String(BATCH_SIZE),
        )) as unknown[];

        const messages = parseAutoclaimMessages(raw);
        const nextCursor = Array.isArray(raw) ? (raw[0] as string) : AUTOCLAIM_START;

        if (messages.length > 0) {
          anyClaimed = true;
          await this.processBatch(messages, stream);
        }

        // Cursor returns '0-0' when the PEL scan is complete
        if (nextCursor === AUTOCLAIM_START || nextCursor === '0') break;
        cursor = nextCursor;
      }
    }

    return anyClaimed;
  }

  // ─── Phase 2: XREADGROUP ──────────────────────────────────────────────────

  /**
   * Read fresh messages using XREADGROUP with block.
   * Returns true if any messages were received.
   */
  private async processNewMessages(): Promise<boolean> {
    if (this.shutdownSignal) return false;

    // Build STREAMS argument: stream1 stream2 ... > > ...
    // '>' means deliver only new, undelivered messages to this consumer
    const streamArgs = this.config.streams.flatMap(s => [s, '>']);

    const raw = (await this.redis.call(
      'XREADGROUP',
      'GROUP',
      this.config.groupName,
      this.config.consumerName,
      'COUNT',
      String(BATCH_SIZE),
      'BLOCK',
      String(this.config.blockMs),
      'STREAMS',
      ...streamArgs,
    )) as Array<[string, Array<[string, string[]]>]> | null;

    const streamMessages = parseXReadGroupResponse(raw);
    if (streamMessages.size === 0) return false;

    let anyProcessed = false;
    for (const [stream, messages] of streamMessages) {
      if (messages.length > 0) {
        anyProcessed = true;
        await this.processBatch(messages, stream);
      }
    }

    return anyProcessed;
  }

  // ─── Batch Processing ─────────────────────────────────────────────────────

  private async processBatch(messages: StreamMessage[], stream: string): Promise<void> {
    for (const message of messages) {
      if (this.shutdownSignal) {
        // Drain: do not start new messages, exit cleanly
        break;
      }

      await this.processOne(message, stream);
    }
  }

  private async processOne(message: StreamMessage, stream: string): Promise<void> {
    this.stats.processed++;
    this.stats.lastProcessedAt = new Date();

    try {
      // Check delivery count via XPENDING before attempting handler
      const deliveryCount = await getDeliveryCount(
        this.redis,
        stream,
        this.config.groupName,
        message.id,
      );

      if (deliveryCount >= MAX_DELIVERY_ATTEMPTS) {
        // ── DLQ routing: exceeded FIB[6]=8 delivery attempts ──
        await this.routeToDLQ(message, stream, deliveryCount);
        return;
      }

      // Invoke caller's handler
      const success = await this.config.handler(message, stream);

      if (success) {
        // XACK — remove from PEL
        await this.redis.call('XACK', stream, this.config.groupName, message.id);
        this.stats.acked++;

        console.debug(
          JSON.stringify({
            level: 'debug',
            service: 'redis-consumer',
            event: 'message_acked',
            stream,
            messageId: message.id,
            deliveryCount,
          }),
        );
      }
      // If handler returns false, message stays in PEL for redelivery
    } catch (err: unknown) {
      this.stats.errors++;
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'redis-consumer',
          event: 'message_error',
          stream,
          messageId: message.id,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      // Message stays in PEL — will be reclaimed by XAUTOCLAIM next cycle
    }
  }

  // ─── DLQ Routing ──────────────────────────────────────────────────────────

  /**
   * Route a message to the Dead Letter Queue after MAX_DELIVERY_ATTEMPTS.
   * 1. XADD stream:dlq with original message + metadata
   * 2. XACK original stream to remove from PEL
   */
  private async routeToDLQ(
    message: StreamMessage,
    sourceStream: string,
    deliveryCount: number,
  ): Promise<void> {
    const dlqFields: string[] = [
      'originalStream', sourceStream,
      'originalId', message.id,
      'deliveryCount', String(deliveryCount),
      'maxDeliveries', String(MAX_DELIVERY_ATTEMPTS),
      'routedAt', new Date().toISOString(),
      'consumer', this.config.consumerName,
      'group', this.config.groupName,
    ];

    // Include all original fields
    for (const [k, v] of Object.entries(message.fields)) {
      dlqFields.push(`orig_${k}`, v);
    }

    await this.redis.call('XADD', DLQ_STREAM, '*', ...dlqFields);
    await this.redis.call('XACK', sourceStream, this.config.groupName, message.id);

    this.stats.dlqRouted++;

    console.warn(
      JSON.stringify({
        level: 'warn',
        service: 'redis-consumer',
        event: 'dlq_routed',
        sourceStream,
        messageId: message.id,
        deliveryCount,
        maxDeliveries: MAX_DELIVERY_ATTEMPTS,
        dlqStream: DLQ_STREAM,
        consumer: this.config.consumerName,
      }),
    );
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a consumer with LIFO cleanup registration for graceful shutdown.
 * Registers SIGTERM/SIGINT handlers automatically.
 */
export function createConsumer(config: ConsumerConfig): HeadyStreamConsumer {
  const consumer = new HeadyStreamConsumer(config);

  // LIFO cleanup stack — registered last, cleaned up first
  const cleanups: Array<{ name: string; fn: () => Promise<void> }> = [];
  const registerCleanup = (name: string, fn: () => Promise<void>): void => {
    cleanups.unshift({ name, fn }); // unshift = prepend = LIFO order
  };

  registerCleanup('redis-consumer', () => consumer.stop());

  const shutdown = async (signal: string): Promise<void> => {
    console.info(
      JSON.stringify({
        level: 'info',
        service: 'redis-consumer',
        event: 'shutdown_initiated',
        signal,
      }),
    );
    for (const { name, fn } of cleanups) {
      try {
        await fn();
        console.info(JSON.stringify({ level: 'info', service: 'redis-consumer', event: 'cleanup_complete', name }));
      } catch (err: unknown) {
        console.error(JSON.stringify({ level: 'error', service: 'redis-consumer', event: 'cleanup_failed', name, error: err instanceof Error ? err.message : String(err) }));
      }
    }
    process.exit(0);
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));

  return consumer;
}
