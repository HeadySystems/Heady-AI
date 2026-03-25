/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Heady φ-Pure Latent OS — Cloudflare Queue Consumer with DLQ
 *
 * Processes batched messages from the "heady-tasks" Cloudflare Queue.
 * Failed messages are retried with Fibonacci backoff up to FIB[6] = 8 attempts,
 * then routed to the Dead Letter Queue (DLQ) "heady-tasks-dlq".
 *
 * Retry policy:
 *  - retryCount 0-7  → re-enqueue with fibonacciBackoff delay hint in metadata
 *  - retryCount ≥ 8  → route to DLQ (FIB[6] = 8 — maximum retry ceiling)
 *
 * Message acknowledgement:
 *  - Success → message.ack() — removes from queue
 *  - Transient failure + retries remaining → message.retry() — redelivers
 *  - Exhausted retries → enqueue to DLQ, then message.ack() — removes from main queue
 *
 * @module cloudflare-edge/queue-handler
 */

import { FIB, PHI, PSI, CSL, fibonacciBackoff, phiBackoff } from '../../shared/phi-math';
import type { HeadyTaskMessage, Env } from './worker';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum retries before routing to DLQ: FIB[6] = 8 */
const MAX_RETRY_COUNT = FIB[6]; // 8

/** Batch processing coherence threshold: CSL.MEDIUM = 0.809 */
const BATCH_COHERENCE_THRESHOLD = CSL.MEDIUM;

/** Maximum batch size: FIB[8] = 34 messages */
const MAX_BATCH_SIZE = FIB[8]; // 34

/** Base delay for Fibonacci backoff: 1000 ms */
const BACKOFF_BASE_MS = 1000;

/** Maximum backoff: FIB[9] * 1000 = 55 000 ms */
const BACKOFF_MAX_MS = FIB[9] * 1000; // 55 000

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QueueMessage extends Message<HeadyTaskMessage> {}

interface BatchResult {
  processed:   number;
  succeeded:   number;
  retried:     number;
  dlqRouted:   number;
  failed:      number;
  durationMs:  number;
  coherenceScore: number;
}

interface TaskResult {
  taskId:      string;
  taskType:    string;
  success:     boolean;
  error?:      string;
  durationMs:  number;
}

// ---------------------------------------------------------------------------
// Structured logger (queue context)
// ---------------------------------------------------------------------------
function queueLog(
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG',
  message: string,
  extra: Record<string, unknown> = {}
): void {
  console.log(JSON.stringify({
    level,
    timestamp:    new Date().toISOString(),
    service:      'heady-queue-consumer',
    message,
    phiConstant:  PHI,
    ...extra,
  }));
}

// ---------------------------------------------------------------------------
// Task dispatcher — routes each task type to the appropriate handler
// ---------------------------------------------------------------------------
async function dispatchTask(
  msg: HeadyTaskMessage,
  env: Env
): Promise<void> {
  const { taskType, payload, taskId, correlationId } = msg;

  switch (taskType) {
    case 'embed':
      await handleEmbedTask(taskId, payload, correlationId, env);
      break;

    case 'artifact-index':
      await handleArtifactIndexTask(taskId, payload, correlationId, env);
      break;

    case 'vector-sync':
      await handleVectorSyncTask(taskId, payload, correlationId, env);
      break;

    case 'notification':
      await handleNotificationTask(taskId, payload, correlationId, env);
      break;

    case 'cache-warm':
      await handleCacheWarmTask(taskId, payload, correlationId, env);
      break;

    case 'health-check':
      await handleHealthCheckTask(taskId, payload, correlationId, env);
      break;

    default:
      // Unknown task types are forwarded to the upstream origin for processing
      await handleUnknownTask(taskId, taskType, payload, correlationId, env);
  }
}

// ---------------------------------------------------------------------------
// Task handler implementations
// ---------------------------------------------------------------------------

/**
 * embed — Generate vector embeddings via Workers AI and store result in KV
 */
async function handleEmbedTask(
  taskId: string,
  payload: unknown,
  correlationId: string,
  env: Env
): Promise<void> {
  const { text } = payload as { text?: string };

  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new TaskError('embed task requires non-empty text field', 'INVALID_PAYLOAD');
  }

  const result = await env.AI.run('@cf/baai/bge-small-en-v1.5', { text: [text] });

  if (!result?.data?.[0]) {
    throw new TaskError('AI embedding returned no data', 'AI_NO_OUTPUT');
  }

  const embedding = result.data[0];

  // Store embedding in KV with 24-hour TTL (FIB[11] * 25 * 24 = 86400 s)
  const kvKey = `embed:${taskId}`;
  await env.HEADY_CACHE.put(
    kvKey,
    JSON.stringify({
      taskId,
      embedding,
      dimensions:     embedding.length,
      model:          '@cf/baai/bge-small-en-v1.5',
      correlationId,
      generatedAt:    new Date().toISOString(),
      phiConstant:    PHI,
    }),
    { expirationTtl: 86400 }
  );

  queueLog('INFO', 'Embed task completed', {
    taskId,
    correlationId,
    dimensions:  embedding.length,
    kvKey,
  });
}

/**
 * artifact-index — Record artifact metadata in KV index
 */
async function handleArtifactIndexTask(
  taskId: string,
  payload: unknown,
  correlationId: string,
  env: Env
): Promise<void> {
  const { key, metadata } = payload as { key?: string; metadata?: Record<string, unknown> };

  if (typeof key !== 'string' || key.trim().length === 0) {
    throw new TaskError('artifact-index task requires key field', 'INVALID_PAYLOAD');
  }

  // Verify the artifact exists in R2
  const head = await env.HEADY_ARTIFACTS.head(key);
  if (!head) {
    throw new TaskError(`R2 artifact not found: ${key}`, 'ARTIFACT_NOT_FOUND');
  }

  // Write index entry in KV
  const indexEntry = {
    r2Key:        key,
    size:         head.size,
    etag:         head.httpEtag,
    contentType:  head.httpMetadata?.contentType ?? 'application/octet-stream',
    uploadedAt:   head.uploaded.toISOString(),
    customMeta:   head.customMetadata,
    indexedAt:    new Date().toISOString(),
    taskId,
    correlationId,
    ...(metadata ?? {}),
  };

  await env.HEADY_CACHE.put(
    `artifact-index:${key}`,
    JSON.stringify(indexEntry),
    { expirationTtl: 86400 * FIB[5] } // 8 days
  );

  queueLog('INFO', 'Artifact indexed', { taskId, correlationId, key });
}

/**
 * vector-sync — Sync an embedding to the upstream vector store via origin
 */
async function handleVectorSyncTask(
  taskId: string,
  payload: unknown,
  correlationId: string,
  env: Env
): Promise<void> {
  const { vectorId, embedding, metadata } = payload as {
    vectorId?: string;
    embedding?: number[];
    metadata?: Record<string, unknown>;
  };

  if (!vectorId || !Array.isArray(embedding) || embedding.length === 0) {
    throw new TaskError('vector-sync requires vectorId and embedding array', 'INVALID_PAYLOAD');
  }

  // Validate embedding dimensionality: must be 384 (BGE-small)
  if (embedding.length !== 384) {
    throw new TaskError(
      `Embedding must be 384-dimensional, got ${embedding.length}`,
      'INVALID_DIMENSIONS'
    );
  }

  const body = JSON.stringify({ vectorId, embedding, metadata, taskId, correlationId });

  const response = await fetch(`${env.ORIGIN_API_URL}/internal/vectors/upsert`, {
    method:  'POST',
    headers: {
      'Content-Type':            'application/json',
      'X-Heady-Queue-Task':      taskId,
      'X-Heady-Correlation-ID':  correlationId,
      'X-Heady-Edge':            'true',
    },
    body,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new TaskError(
      `Vector upsert failed: HTTP ${response.status} — ${errText.slice(0, 200)}`,
      'VECTOR_UPSERT_FAILED'
    );
  }

  queueLog('INFO', 'Vector synced', { taskId, correlationId, vectorId, dimensions: embedding.length });
}

/**
 * notification — Send notification via origin webhook
 */
async function handleNotificationTask(
  taskId: string,
  payload: unknown,
  correlationId: string,
  env: Env
): Promise<void> {
  const { userId, channel, content } = payload as {
    userId?: string;
    channel?: string;
    content?: unknown;
  };

  if (!userId || !channel) {
    throw new TaskError('notification task requires userId and channel', 'INVALID_PAYLOAD');
  }

  const response = await fetch(`${env.ORIGIN_API_URL}/internal/notifications/send`, {
    method:  'POST',
    headers: {
      'Content-Type':           'application/json',
      'X-Heady-Queue-Task':     taskId,
      'X-Heady-Correlation-ID': correlationId,
      'X-Heady-Edge':           'true',
    },
    body: JSON.stringify({ userId, channel, content, taskId, correlationId }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new TaskError(
      `Notification delivery failed: HTTP ${response.status} — ${errText.slice(0, 200)}`,
      'NOTIFICATION_FAILED'
    );
  }

  queueLog('INFO', 'Notification dispatched', { taskId, correlationId, userId, channel });
}

/**
 * cache-warm — Pre-populate KV cache entries from origin
 */
async function handleCacheWarmTask(
  taskId: string,
  payload: unknown,
  correlationId: string,
  env: Env
): Promise<void> {
  const { keys } = payload as { keys?: string[] };

  if (!Array.isArray(keys) || keys.length === 0) {
    throw new TaskError('cache-warm task requires non-empty keys array', 'INVALID_PAYLOAD');
  }

  // Limit to FIB[6] = 8 keys per task to prevent runaway fetching
  const targetKeys = keys.slice(0, FIB[6]);

  await Promise.allSettled(targetKeys.map(async (key) => {
    const response = await fetch(`${env.ORIGIN_API_URL}/internal/cache/warm?key=${encodeURIComponent(key)}`, {
      headers: {
        'X-Heady-Queue-Task':     taskId,
        'X-Heady-Correlation-ID': correlationId,
        'X-Heady-Edge':           'true',
      },
    });

    if (response.ok) {
      const body = await response.text();
      await env.HEADY_CACHE.put(`warm:${key}`, body, { expirationTtl: 3600 });
      queueLog('DEBUG', 'Cache key warmed', { key, taskId, correlationId });
    } else {
      queueLog('WARN', 'Cache warm failed for key', {
        key, status: response.status, taskId, correlationId,
      });
    }
  }));

  queueLog('INFO', 'Cache warm task completed', { taskId, correlationId, keyCount: targetKeys.length });
}

/**
 * health-check — Ping upstream and record health status in KV
 */
async function handleHealthCheckTask(
  taskId: string,
  payload: unknown,
  correlationId: string,
  env: Env
): Promise<void> {
  const startMs = Date.now();

  const response = await fetch(`${env.ORIGIN_API_URL}/health`, {
    headers: {
      'X-Heady-Queue-Task':     taskId,
      'X-Heady-Correlation-ID': correlationId,
      'X-Heady-Edge':           'true',
    },
  });

  const durationMs = Date.now() - startMs;
  const healthy    = response.ok;

  // Latency coherence: < FIB[7] ms = excellent, > FIB[9] ms = degraded
  const latencyCoherence = durationMs < FIB[7] * 10
    ? CSL.CRITICAL
    : durationMs < FIB[9] * 10
      ? CSL.HIGH
      : CSL.MEDIUM;

  const healthStatus = {
    healthy,
    durationMs,
    latencyCoherence,
    statusCode:   response.status,
    checkedAt:    new Date().toISOString(),
    taskId,
    correlationId,
  };

  await env.HEADY_CACHE.put(
    'health:upstream',
    JSON.stringify(healthStatus),
    { expirationTtl: 300 } // 5-minute TTL
  );

  queueLog('INFO', 'Health check recorded', { ...healthStatus });
}

/**
 * fallback — unknown task types forwarded to origin
 */
async function handleUnknownTask(
  taskId: string,
  taskType: string,
  payload: unknown,
  correlationId: string,
  env: Env
): Promise<void> {
  queueLog('WARN', 'Unknown task type — forwarding to origin', { taskId, taskType, correlationId });

  const response = await fetch(`${env.ORIGIN_API_URL}/internal/tasks/process`, {
    method:  'POST',
    headers: {
      'Content-Type':            'application/json',
      'X-Heady-Queue-Task':      taskId,
      'X-Heady-Task-Type':       taskType,
      'X-Heady-Correlation-ID':  correlationId,
      'X-Heady-Edge':            'true',
    },
    body: JSON.stringify({ taskId, taskType, payload, correlationId }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new TaskError(
      `Origin rejected unknown task ${taskType}: HTTP ${response.status} — ${errText.slice(0, 200)}`,
      'ORIGIN_TASK_FAILED'
    );
  }

  queueLog('INFO', 'Unknown task forwarded successfully', { taskId, taskType, correlationId });
}

// ---------------------------------------------------------------------------
// Task error class
// ---------------------------------------------------------------------------
class TaskError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'TaskError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// DLQ routing — enqueue exhausted messages to dead letter queue
// ---------------------------------------------------------------------------
async function routeToDlq(
  msg: HeadyTaskMessage,
  env: Env,
  lastError: string
): Promise<void> {
  const dlqMessage: HeadyTaskMessage = {
    ...msg,
    retryCount: msg.retryCount + 1,
    payload: {
      ...(msg.payload as object),
      __dlq: {
        routedAt:     new Date().toISOString(),
        lastError,
        totalRetries: msg.retryCount,
        maxRetries:   MAX_RETRY_COUNT,
        fibMaxIndex:  6,
      },
    },
  };

  await env.HEADY_TASKS_DLQ.send(dlqMessage);

  queueLog('WARN', 'Message routed to DLQ', {
    taskId:        msg.taskId,
    taskType:      msg.taskType,
    correlationId: msg.correlationId,
    retryCount:    msg.retryCount,
    lastError,
  });
}

// ---------------------------------------------------------------------------
// Single message processor
// ---------------------------------------------------------------------------
async function processMessage(
  message: QueueMessage,
  env: Env
): Promise<TaskResult> {
  const startMs  = Date.now();
  const body     = message.body;
  const { taskId, taskType, retryCount, correlationId } = body;

  queueLog('INFO', 'Processing queue message', {
    taskId,
    taskType,
    retryCount,
    correlationId,
    maxRetry: MAX_RETRY_COUNT,
  });

  try {
    await dispatchTask(body, env);

    message.ack();

    const durationMs = Date.now() - startMs;
    queueLog('INFO', 'Task succeeded', { taskId, taskType, correlationId, durationMs });

    return { taskId, taskType, success: true, durationMs };

  } catch (err) {
    const error      = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startMs;

    queueLog('ERROR', 'Task failed', {
      taskId,
      taskType,
      correlationId,
      retryCount,
      error,
      durationMs,
    });

    if (retryCount >= MAX_RETRY_COUNT) {
      // Exhausted retries — route to DLQ and ack (remove from main queue)
      await routeToDlq(body, env, error);
      message.ack();

      queueLog('WARN', 'Task exhausted retries — sent to DLQ', {
        taskId, taskType, correlationId, retryCount,
      });

      return { taskId, taskType, success: false, error: `DLQ: ${error}`, durationMs };
    }

    // Still have retries remaining — compute Fibonacci backoff delay
    const backoffMs = fibonacciBackoff(retryCount, BACKOFF_BASE_MS, BACKOFF_MAX_MS);

    queueLog('WARN', 'Retrying task', {
      taskId,
      taskType,
      correlationId,
      retryCount,
      nextRetry:  retryCount + 1,
      backoffMs,
      fibIndex:   retryCount + 2,
    });

    // Cloudflare Queue retry: re-deliver after backoff
    // The retryCount is incremented in the message body on next delivery
    // by the runtime — we signal retry intent via message.retry().
    // Since Cloudflare Queues don't yet support delay hints on retry(),
    // we store the incremented body back via send() then ack().
    // This guarantees our retryCount tracking stays accurate.
    const updatedBody: HeadyTaskMessage = {
      ...body,
      retryCount: retryCount + 1,
    };

    // Send updated message (incremented retryCount) with delay
    await env.HEADY_TASKS.send(updatedBody, {
      delaySeconds: Math.ceil(backoffMs / 1000),
    });

    // Ack original so we don't get a duplicate delivery
    message.ack();

    return { taskId, taskType, success: false, error, durationMs };
  }
}

// ---------------------------------------------------------------------------
// Queue consumer export — the `queue` handler
// ---------------------------------------------------------------------------
export const queueHandler = {
  async queue(
    batch: MessageBatch<HeadyTaskMessage>,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    const startMs   = Date.now();
    const batchSize = batch.messages.length;

    queueLog('INFO', 'Queue batch received', {
      queue:     batch.queue,
      batchSize,
      maxBatch:  MAX_BATCH_SIZE,
      phi:       PHI,
      psi:       PSI,
    });

    if (batchSize === 0) return;

    // Coherence check: large batches degrade processing quality
    const batchRatio       = batchSize / MAX_BATCH_SIZE;
    const batchCoherence   = 1 - batchRatio * PSI; // φ-weighted degradation
    const processingMode   = batchCoherence >= BATCH_COHERENCE_THRESHOLD ? 'parallel' : 'sequential';

    queueLog('INFO', 'Batch coherence evaluated', {
      batchRatio,
      batchCoherence: Math.round(batchCoherence * 1000) / 1000,
      processingMode,
      threshold: BATCH_COHERENCE_THRESHOLD,
    });

    const results: TaskResult[] = [];
    let succeeded  = 0;
    let retried    = 0;
    let dlqRouted  = 0;
    let failed     = 0;

    if (processingMode === 'parallel') {
      // Process all messages concurrently (high coherence batch)
      const settled = await Promise.allSettled(
        batch.messages.map(msg => processMessage(msg as QueueMessage, env))
      );

      for (const outcome of settled) {
        if (outcome.status === 'fulfilled') {
          const r = outcome.value;
          results.push(r);
          if (r.success) {
            succeeded++;
          } else if (r.error?.startsWith('DLQ:')) {
            dlqRouted++;
          } else {
            retried++;
          }
        } else {
          failed++;
          queueLog('ERROR', 'processMessage threw unexpectedly', {
            error: String(outcome.reason),
          });
        }
      }
    } else {
      // Process sequentially with phi-backoff between messages (degraded coherence)
      for (const msg of batch.messages) {
        const r = await processMessage(msg as QueueMessage, env);
        results.push(r);

        if (r.success) {
          succeeded++;
        } else if (r.error?.startsWith('DLQ:')) {
          dlqRouted++;
        } else {
          retried++;
        }

        // φ-paced sequential processing: short pause between messages
        if (batch.messages.indexOf(msg) < batch.messages.length - 1) {
          const pauseMs = Math.round(PHI * 100); // ≈ 162 ms
          await new Promise(resolve => setTimeout(resolve, pauseMs));
        }
      }
    }

    const durationMs     = Date.now() - startMs;
    const successRate    = batchSize > 0 ? succeeded / batchSize : 0;
    const batchCoherenceFinal = CSL.MINIMUM + (CSL.CRITICAL - CSL.MINIMUM) * successRate;

    const summary: BatchResult = {
      processed:   batchSize,
      succeeded,
      retried,
      dlqRouted,
      failed,
      durationMs,
      coherenceScore: Math.round(batchCoherenceFinal * 1000) / 1000,
    };

    queueLog('INFO', 'Queue batch complete', {
      queue: batch.queue,
      ...summary,
      processingMode,
      phiConstant: PHI,
    });
  },
};
