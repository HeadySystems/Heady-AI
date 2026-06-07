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
// ║  FILE: packages/phi-pure-latent-os/vertex-ai/genai-client.ts                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * @module vertex-ai/genai-client
 * @description @google/genai Vertex AI backend client with circuit breaker,
 *   batch embeddings (chunks of FIB[8]=21), and structured output via
 *   responseMimeType. Replaces deprecated @google-cloud/vertexai (EOL Jun 2026).
 */

import { GoogleGenAI, type GenerateContentConfig } from '@google/genai';
import { z } from 'zod';
import {
  PHI,
  FIB,
  phiBackoff,
  phiFusionWeights,
} from '../shared/phi-math.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const BATCH_SIZE        = FIB[8]  as 21;  // 21 texts per embedding batch
const CB_FAILURE_LIMIT  = FIB[5]  as 5;   // open after 5 failures
const CB_WINDOW_MS      = FIB[8]  * 1_000; // 21 second failure window
const CB_HALF_OPEN_MS   = FIB[7]  * 1_000; // 13 second recovery wait
const DEFAULT_DIMENSIONS = 384;
const DEFAULT_EMBED_MODEL = 'text-embedding-004';
const DEFAULT_TEXT_MODEL  = 'gemini-2.0-flash';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GenaiClientConfig {
  project?:  string;
  location?: string;
  /** Override default embed model */
  embedModel?: string;
  /** Override default text model */
  textModel?: string;
}

export interface EmbeddingOptions {
  model?:      string;
  dimensions?: number;
}

export interface TextGenerationOptions {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
}

export interface BatchEmbeddingResult {
  embeddings: number[][];
  totalTexts: number;
  batchCount:  number;
  durationMs:  number;
}

// ─── Circuit Breaker ──────────────────────────────────────────────────────────

type CBState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerState {
  state:       CBState;
  failures:    number;
  lastFailure: number;
  openedAt:    number;
}

class CircuitBreakerOpenError extends Error {
  constructor(openedAt: number) {
    const waitS = Math.ceil((CB_HALF_OPEN_MS - (Date.now() - openedAt)) / 1000);
    super(`Circuit breaker OPEN — retry in ~${Math.max(0, waitS)}s`);
    this.name = 'CircuitBreakerOpenError';
  }
}

function createCircuitBreaker(): {
  state: CircuitBreakerState;
  guard: <T>(fn: () => Promise<T>) => Promise<T>;
} {
  const cb: CircuitBreakerState = {
    state:       'CLOSED',
    failures:    0,
    lastFailure: 0,
    openedAt:    0,
  };

  async function guard<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();

    if (cb.state === 'OPEN') {
      if (now - cb.openedAt >= CB_HALF_OPEN_MS) {
        cb.state = 'HALF_OPEN';
      } else {
        throw new CircuitBreakerOpenError(cb.openedAt);
      }
    }

    try {
      const result = await fn();
      // Success — reset
      cb.failures    = 0;
      cb.state       = 'CLOSED';
      return result;
    } catch (err) {
      cb.failures++;
      cb.lastFailure = Date.now();

      // Slide the window: only count failures within CB_WINDOW_MS
      const windowExpired = (now - cb.lastFailure) > CB_WINDOW_MS;
      if (windowExpired) {
        cb.failures = 1;
      }

      if (cb.failures >= CB_FAILURE_LIMIT || cb.state === 'HALF_OPEN') {
        cb.state    = 'OPEN';
        cb.openedAt = Date.now();
      }

      throw err;
    }
  }

  return { state: cb, guard };
}

// ─── Retry Helper ─────────────────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = FIB[5],  // 5 attempts
  shouldRetry: (err: unknown, attempt: number) => boolean = isRetryable,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!shouldRetry(err, attempt) || attempt === maxAttempts - 1) throw err;
      const delay = phiBackoff(attempt, 1_000, 60_000);
      await sleep(delay);
    }
  }
  throw lastErr;
}

function isRetryable(err: unknown, _attempt: number): boolean {
  if (err instanceof CircuitBreakerOpenError) return false;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes('429') || msg.includes('503') ||
           msg.includes('rate limit') || msg.includes('quota') ||
           msg.includes('unavailable');
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main Client ──────────────────────────────────────────────────────────────

export class HeadyGenAIClient {
  private readonly ai: GoogleGenAI;
  private readonly cb = createCircuitBreaker();
  private readonly config: Required<GenaiClientConfig>;

  constructor(clientConfig: GenaiClientConfig = {}) {
    const project  = clientConfig.project  ?? process.env['GCP_PROJECT_ID'];
    const location = clientConfig.location ?? process.env['GCP_LOCATION'] ?? 'us-central1';

    if (!project) {
      throw new Error(
        'GCP_PROJECT_ID is required. Set env var or pass project to HeadyGenAIClient.',
      );
    }

    this.config = {
      project,
      location,
      embedModel: clientConfig.embedModel ?? DEFAULT_EMBED_MODEL,
      textModel:  clientConfig.textModel  ?? DEFAULT_TEXT_MODEL,
    };

    this.ai = new GoogleGenAI({
      vertexai: true,
      project,
      location,
    });
  }

  // ── Embedding ──────────────────────────────────────────────────────────────

  /**
   * Generate a single 384D embedding vector for the given text.
   */
  async generateEmbedding(
    text: string,
    model: string       = this.config.embedModel,
    dimensions: number  = DEFAULT_DIMENSIONS,
  ): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('generateEmbedding: text must be a non-empty string.');
    }

    return this.cb.guard(() =>
      withRetry(async () => {
        const response = await this.ai.models.embedContent({
          model,
          contents: text,
          config: { outputDimensionality: dimensions },
        });

        const values = response.embeddings?.[0]?.values;
        if (!values || values.length === 0) {
          throw new Error('generateEmbedding: empty embedding returned from API.');
        }
        return values;
      }),
    );
  }

  /**
   * Generate embeddings for a batch of texts, chunked to FIB[8]=21 per request.
   * Returns embeddings in the same order as the input texts.
   */
  async generateEmbeddingBatch(
    texts: string[],
    model: string      = this.config.embedModel,
    dimensions: number = DEFAULT_DIMENSIONS,
  ): Promise<BatchEmbeddingResult> {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error('generateEmbeddingBatch: texts must be a non-empty array.');
    }

    const startMs    = Date.now();
    const embeddings: number[][] = [];
    const chunks     = chunkArray(texts, BATCH_SIZE);

    for (const chunk of chunks) {
      const chunkEmbeddings = await this.cb.guard(() =>
        withRetry(async () => {
          const response = await this.ai.models.embedContent({
            model,
            contents: chunk,
            config: { outputDimensionality: dimensions },
          });

          const values = response.embeddings;
          if (!values || values.length !== chunk.length) {
            throw new Error(
              `generateEmbeddingBatch: expected ${chunk.length} embeddings, got ${values?.length ?? 0}.`,
            );
          }
          return values.map(e => e.values ?? []);
        }),
      );
      embeddings.push(...chunkEmbeddings);
    }

    return {
      embeddings,
      totalTexts: texts.length,
      batchCount: chunks.length,
      durationMs: Date.now() - startMs,
    };
  }

  // ── Text Generation ────────────────────────────────────────────────────────

  /**
   * Generate plain-text response for the given prompt.
   */
  async generateText(
    prompt: string,
    model:  string                 = this.config.textModel,
    config: TextGenerationOptions  = {},
  ): Promise<string> {
    if (!prompt || prompt.trim().length === 0) {
      throw new Error('generateText: prompt must be a non-empty string.');
    }

    return this.cb.guard(() =>
      withRetry(async () => {
        const genConfig: GenerateContentConfig = {
          temperature:     config.temperature     ?? PHI - 1,   // 0.618 — phi-coherent sampling
          maxOutputTokens: config.maxOutputTokens ?? 8_192,
          topP:            config.topP            ?? 1 - (1 / (PHI * PHI)), // ≈ 0.618
        };

        const response = await this.ai.models.generateContent({
          model,
          contents: prompt,
          config:   genConfig,
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text === undefined || text === null) {
          throw new Error('generateText: no text in response.');
        }
        return text;
      }),
    );
  }

  // ── Structured Output ──────────────────────────────────────────────────────

  /**
   * Generate structured output validated against a Zod schema.
   * Uses responseMimeType: 'application/json' for deterministic JSON output.
   */
  async generateWithSchema<T>(
    prompt: string,
    model:  string,
    schema: z.ZodSchema<T>,
    config: TextGenerationOptions = {},
  ): Promise<T> {
    if (!prompt || prompt.trim().length === 0) {
      throw new Error('generateWithSchema: prompt must be a non-empty string.');
    }

    const rawText = await this.cb.guard(() =>
      withRetry(async () => {
        const genConfig: GenerateContentConfig = {
          temperature:       config.temperature     ?? 0.2,   // Lower temp for structured fidelity
          maxOutputTokens:   config.maxOutputTokens ?? 4_096,
          topP:              config.topP            ?? 0.95,
          responseMimeType:  'application/json',
        };

        const response = await this.ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `${prompt}\n\nRespond with valid JSON only. No explanation, no markdown fences.`,
                },
              ],
            },
          ],
          config: genConfig,
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          throw new Error('generateWithSchema: no text in response.');
        }
        return text;
      }),
    );

    // Strip any accidental markdown fences before parsing
    const cleaned = rawText.replace(/^```(?:json)?\n?|```$/gm, '').trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      throw new Error(
        `generateWithSchema: response is not valid JSON.\n` +
        `Raw: ${cleaned.slice(0, 500)}\nParse error: ${String(e)}`,
      );
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `generateWithSchema: response does not match schema.\n` +
        `Errors: ${JSON.stringify(result.error.flatten(), null, 2)}`,
      );
    }
    return result.data;
  }

  // ── Health ─────────────────────────────────────────────────────────────────

  /** Circuit breaker state snapshot for /health endpoints */
  getCircuitBreakerStatus(): {
    state:    string;
    failures: number;
    openedAt: number | null;
  } {
    const s = this.cb.state;
    return {
      state:    s.state,
      failures: s.failures,
      openedAt: s.state !== 'CLOSED' ? s.openedAt : null,
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ─── Singleton Factory ────────────────────────────────────────────────────────

let _defaultClient: HeadyGenAIClient | null = null;

export function getGenAIClient(config?: GenaiClientConfig): HeadyGenAIClient {
  if (!_defaultClient) {
    _defaultClient = new HeadyGenAIClient(config);
  }
  return _defaultClient;
}

/** Convenience exports for common operations */
export const generateEmbedding = (
  text:       string,
  model?:     string,
  dimensions?: number,
) => getGenAIClient().generateEmbedding(text, model, dimensions);

export const generateEmbeddingBatch = (
  texts:      string[],
  model?:     string,
  dimensions?: number,
) => getGenAIClient().generateEmbeddingBatch(texts, model, dimensions);

export const generateText = (
  prompt:  string,
  model?:  string,
  config?: TextGenerationOptions,
) => getGenAIClient().generateText(prompt, model, config);

export const generateWithSchema = <T>(
  prompt:  string,
  model:   string,
  schema:  z.ZodSchema<T>,
  config?: TextGenerationOptions,
) => getGenAIClient().generateWithSchema(prompt, model, schema, config);
