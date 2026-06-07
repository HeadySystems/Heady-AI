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
// ║  FILE: packages/phi-pure-latent-os/redis-streams/producer.ts                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Redis Streams Producer
 * XADD with MAXLEN ~ FIB[14]=377 approximate trimming.
 * Supports multiple stream names with typed message schema.
 * Graceful shutdown via LIFO cleanup pattern.
 *
 * @module redis-streams/producer
 */

import Redis from 'ioredis';
import * as crypto from 'crypto';
import { PHI, FIB, fibonacciBackoff, phiBackoff } from '../shared/phi-math';

// ─── Constants from φ-math ────────────────────────────────────────────────────

/** MAXLEN trim threshold: FIB[14] = 377 */
const STREAM_MAXLEN = FIB[13]; // FIB[13] = 377

/** Max retry attempts for XADD: FIB[5] = 8 */
const MAX_PUBLISH_RETRIES = FIB[5]; // 8

/** Circuit breaker open duration: PHI^4 ≈ 6854 ms */
const CIRCUIT_OPEN_MS = Math.round(Math.pow(PHI, 4) * 1000); // 6854 ms

// ─── Types ────────────────────────────────────────────────────────────────────

/** Canonical Heady stream message schema */
export interface StreamMessage<TPayload = unknown> {
  /** Discriminated union type for the message */
  type: string;
  /** Domain-specific payload */
  payload: TPayload;
  /** Propagation ID for distributed tracing */
  correlationId: string;
  /** ISO 8601 creation timestamp */
  createdAt: string;
}

export interface ProducerConfig {
  /** Redis connection URL — never localhost, always env var */
  redisUrl?: string;
  /** Default stream name if not specified at publish time */
  defaultStream?: string;
  /** Custom MAXLEN — defaults to FIB[14]=377 */
  maxLen?: number;
  /** Whether to use approximate trimming (~) — defaults to true */
  approximateTrim?: boolean;
}

export interface PublishResult {
  /** The auto-generated Redis stream message ID (e.g. "1716000000000-0") */
  messageId: string;
  stream: string;
  correlationId: string;
}

interface CircuitState {
  failures: number;
  openSince: number | null;
  halfOpen: boolean;
}

// ─── Producer ─────────────────────────────────────────────────────────────────

/**
 * HeadyStreamProducer — production Redis Streams producer.
 *
 * Features:
 * - XADD with MAXLEN ~ FIB[14]=377 approximate trimming
 * - φ-backoff retry on transient failures
 * - Simple circuit breaker to avoid cascading Redis failures
 * - Structured JSON logging
 * - LIFO graceful shutdown
 */
export class HeadyStreamProducer {
  private readonly redis: Redis;
  private readonly config: Required<ProducerConfig>;
  private readonly circuit: CircuitState = {
    failures: 0,
    openSince: null,
    halfOpen: false,
  };

  constructor(config: ProducerConfig = {}) {
    const redisUrl = config.redisUrl ?? process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('Redis URL must be provided via config.redisUrl or REDIS_URL env var');
    }

    this.redis = new Redis(redisUrl, {
      enableReadyCheck: true,
      maxRetriesPerRequest: 1,
      retryStrategy: (times: number) => {
        if (times > FIB[4]) return null; // stop after 5 attempts
        return fibonacciBackoff(times, 250);
      },
      lazyConnect: true,
    });

    this.config = {
      redisUrl,
      defaultStream: config.defaultStream ?? 'heady:events',
      maxLen: config.maxLen ?? STREAM_MAXLEN,
      approximateTrim: config.approximateTrim !== false, // default true
    };
  }

  /** Connect to Redis — must be called before any publish() */
  async connect(): Promise<void> {
    await this.redis.connect();
    console.info(
      JSON.stringify({
        level: 'info',
        service: 'redis-producer',
        event: 'connected',
        defaultStream: this.config.defaultStream,
        maxLen: this.config.maxLen,
        approximateTrim: this.config.approximateTrim,
        phi: PHI,
        fibMaxLen: STREAM_MAXLEN,
      }),
    );
  }

  /**
   * Publish a message to a Redis stream.
   *
   * @param type    - Message type discriminator
   * @param payload - Domain payload (will be JSON-serialised)
   * @param options - Override stream name or provide custom correlationId
   * @returns       - Published message ID and metadata
   */
  async publish<TPayload = unknown>(
    type: string,
    payload: TPayload,
    options: { stream?: string; correlationId?: string } = {},
  ): Promise<PublishResult> {
    const stream = options.stream ?? this.config.defaultStream;
    const correlationId = options.correlationId ?? crypto.randomUUID();
    const createdAt = new Date().toISOString();

    const message: StreamMessage<TPayload> = { type, payload, correlationId, createdAt };

    // Circuit breaker guard
    this.guardCircuit();

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_PUBLISH_RETRIES; attempt++) {
      try {
        const messageId = await this.xadd(stream, message);

        // Reset circuit on success
        this.circuit.failures = 0;
        this.circuit.openSince = null;
        this.circuit.halfOpen = false;

        console.debug(
          JSON.stringify({
            level: 'debug',
            service: 'redis-producer',
            event: 'message_published',
            stream,
            messageId,
            type,
            correlationId,
            attempt,
          }),
        );

        return { messageId, stream, correlationId };
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.circuit.failures++;

        if (attempt < MAX_PUBLISH_RETRIES - 1) {
          const backoffMs = phiBackoff(attempt, 200, 30_000);
          console.warn(
            JSON.stringify({
              level: 'warn',
              service: 'redis-producer',
              event: 'publish_retry',
              stream,
              type,
              correlationId,
              attempt,
              backoffMs,
              error: lastError.message,
            }),
          );
          await sleep(backoffMs);
        }
      }
    }

    // All retries exhausted — trip circuit breaker
    if (this.circuit.failures >= FIB[4]) { // FIB[4]=5 consecutive failures → open
      this.circuit.openSince = Date.now();
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'redis-producer',
          event: 'circuit_opened',
          failures: this.circuit.failures,
          openUntil: new Date(Date.now() + CIRCUIT_OPEN_MS).toISOString(),
        }),
      );
    }

    throw new Error(
      `Failed to publish message to stream "${stream}" after ${MAX_PUBLISH_RETRIES} attempts: ${lastError?.message}`,
    );
  }

  /**
   * Publish multiple messages to the same or different streams.
   * Uses a pipeline for efficiency when all messages target the same stream.
   */
  async publishBatch<TPayload = unknown>(
    messages: Array<{
      type: string;
      payload: TPayload;
      stream?: string;
      correlationId?: string;
    }>,
  ): Promise<PublishResult[]> {
    this.guardCircuit();

    const results: PublishResult[] = [];

    // Group by stream to use pipelines
    const byStream = new Map<string, typeof messages>();
    for (const msg of messages) {
      const stream = msg.stream ?? this.config.defaultStream;
      if (!byStream.has(stream)) byStream.set(stream, []);
      byStream.get(stream)!.push(msg);
    }

    for (const [stream, streamMessages] of byStream) {
      const pipeline = this.redis.pipeline();
      const correlationIds: string[] = [];
      const createdAt = new Date().toISOString();

      for (const msg of streamMessages) {
        const correlationId = msg.correlationId ?? crypto.randomUUID();
        correlationIds.push(correlationId);

        const message: StreamMessage<TPayload> = {
          type: msg.type,
          payload: msg.payload,
          correlationId,
          createdAt,
        };

        const trimArg = this.config.approximateTrim ? '~' : '=';

        pipeline.call(
          'XADD',
          stream,
          'MAXLEN',
          trimArg,
          String(this.config.maxLen),
          '*',
          'type', message.type,
          'payload', JSON.stringify(message.payload),
          'correlationId', message.correlationId,
          'createdAt', message.createdAt,
        );
      }

      const pipelineResults = await pipeline.exec();
      if (!pipelineResults) continue;

      for (let i = 0; i < pipelineResults.length; i++) {
        const [err, messageId] = pipelineResults[i];
        if (err) throw err;
        results.push({
          messageId: messageId as string,
          stream,
          correlationId: correlationIds[i],
        });
      }
    }

    console.info(
      JSON.stringify({
        level: 'info',
        service: 'redis-producer',
        event: 'batch_published',
        count: results.length,
        streams: [...byStream.keys()],
      }),
    );

    return results;
  }

  /** Disconnect from Redis */
  async disconnect(): Promise<void> {
    await this.redis.quit();
    console.info(
      JSON.stringify({
        level: 'info',
        service: 'redis-producer',
        event: 'disconnected',
      }),
    );
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private async xadd(stream: string, message: StreamMessage): Promise<string> {
    const trimArg = this.config.approximateTrim ? '~' : '=';

    const messageId = (await this.redis.call(
      'XADD',
      stream,
      'MAXLEN',
      trimArg,
      String(this.config.maxLen),
      '*',
      // Field-value pairs for the message
      'type', message.type,
      'payload', JSON.stringify(message.payload),
      'correlationId', message.correlationId,
      'createdAt', message.createdAt,
    )) as string;

    return messageId;
  }

  /** Circuit breaker guard — throws if circuit is open */
  private guardCircuit(): void {
    if (this.circuit.openSince === null) return;

    const elapsed = Date.now() - this.circuit.openSince;
    if (elapsed < CIRCUIT_OPEN_MS) {
      throw new Error(
        `Redis producer circuit breaker OPEN — retry in ${Math.ceil((CIRCUIT_OPEN_MS - elapsed) / 1000)}s`,
      );
    }

    // Half-open: allow one probe through
    this.circuit.halfOpen = true;
    this.circuit.openSince = null;
    console.info(
      JSON.stringify({
        level: 'info',
        service: 'redis-producer',
        event: 'circuit_half_open',
      }),
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create and connect a producer with LIFO cleanup for graceful shutdown.
 */
export async function createProducer(config: ProducerConfig = {}): Promise<HeadyStreamProducer> {
  const producer = new HeadyStreamProducer(config);
  await producer.connect();

  // LIFO cleanup stack
  const cleanups: Array<{ name: string; fn: () => Promise<void> }> = [];
  const registerCleanup = (name: string, fn: () => Promise<void>): void => {
    cleanups.unshift({ name, fn });
  };

  registerCleanup('redis-producer', () => producer.disconnect());

  const shutdown = async (signal: string): Promise<void> => {
    console.info(
      JSON.stringify({
        level: 'info',
        service: 'redis-producer',
        event: 'shutdown_initiated',
        signal,
      }),
    );
    for (const { name, fn } of cleanups) {
      try {
        await fn();
        console.info(JSON.stringify({ level: 'info', service: 'redis-producer', event: 'cleanup_complete', name }));
      } catch (err: unknown) {
        console.error(JSON.stringify({ level: 'error', service: 'redis-producer', event: 'cleanup_failed', name, error: err instanceof Error ? err.message : String(err) }));
      }
    }
    process.exit(0);
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));

  return producer;
}
