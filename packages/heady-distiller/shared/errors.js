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
// ║  FILE: packages/heady-distiller/shared/errors.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * @module errors
 * @description CSL-classified error hierarchy for HeadyDistiller (Stage 22).
 *
 * All errors are:
 *   - Operational (isOperational: true) — expected failures the system can handle
 *   - CSL-classified via coherenceImpact — how much a given error degrades coherence
 *   - Structured via toJSON() — for pino serialization and log pipelines
 *
 * Hierarchy:
 *   HeadyError (base)
 *     ├── DistillationError       — general distillation stage failures
 *     ├── TraceCollectionError    — trace recording / retrieval failures
 *     ├── CompressionError        — knowledge compression failures
 *     ├── RecipeConflictError     — duplicate recipe detection
 *     └── CoherenceDriftError     — CSL score below configured threshold
 */

// ---------------------------------------------------------------------------
// Base Error
// ---------------------------------------------------------------------------

/**
 * Base HeadyDistiller error.
 *
 * @property {number}  statusCode      - HTTP status code equivalent (4xx / 5xx).
 * @property {string}  code            - Machine-readable error code (SCREAMING_SNAKE).
 * @property {object}  details         - Structured context payload for log pipelines.
 * @property {boolean} isOperational   - true for expected errors; false for programming errors.
 * @property {number}  coherenceImpact - Estimated CSL coherence degradation [0, 1].
 */
export class HeadyError extends Error {
  /**
   * @param {string} message
   * @param {object} [opts]
   * @param {number} [opts.statusCode=500]
   * @param {string} [opts.code='HEADY_ERROR']
   * @param {object} [opts.details={}]
   * @param {boolean} [opts.isOperational=true]
   * @param {number}  [opts.coherenceImpact=0]
   */
  constructor(message, {
    statusCode      = 500,
    code            = 'HEADY_ERROR',
    details         = {},
    isOperational   = true,
    coherenceImpact = 0,
  } = {}) {
    super(message);
    this.name            = this.constructor.name;
    this.statusCode      = statusCode;
    this.code            = code;
    this.details         = details;
    this.isOperational   = isOperational;
    this.coherenceImpact = coherenceImpact;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Serialize to a plain object suitable for pino / structured logging.
   * @returns {object}
   */
  toJSON() {
    return {
      type:            this.name,
      message:         this.message,
      code:            this.code,
      statusCode:      this.statusCode,
      isOperational:   this.isOperational,
      coherenceImpact: this.coherenceImpact,
      details:         this.details,
      stack:           this.stack,
    };
  }
}

// ---------------------------------------------------------------------------
// DistillationError
// ---------------------------------------------------------------------------

/**
 * General distillation stage (Stage 22) failure.
 *
 * Raised when the distillation orchestrator cannot proceed — e.g. no traces
 * available, embedding client unavailable, or vector store unreachable.
 *
 * coherenceImpact = 0.191 (≈ PSI² / 2 — moderate degradation)
 */
export class DistillationError extends HeadyError {
  /**
   * @param {string} message
   * @param {object} [details]
   */
  constructor(message, details = {}) {
    super(message, {
      statusCode:      503,
      code:            'DISTILLATION_ERROR',
      details,
      isOperational:   true,
      coherenceImpact: 0.191,
    });
  }
}

// ---------------------------------------------------------------------------
// TraceCollectionError
// ---------------------------------------------------------------------------

/**
 * Trace recording or retrieval failure.
 *
 * Raised when a pipeline run result cannot be persisted to Neon Postgres or
 * retrieved from it, or when Redis caching operations fail.
 *
 * coherenceImpact = 0.118 (≈ PSI³ / 2 — mild degradation, system can continue)
 */
export class TraceCollectionError extends HeadyError {
  /**
   * @param {string} message
   * @param {object} [details]
   * @param {string} [details.runId]     - Pipeline run ID affected.
   * @param {string} [details.operation] - 'insert' | 'select' | 'cache'
   */
  constructor(message, details = {}) {
    super(message, {
      statusCode:      502,
      code:            'TRACE_COLLECTION_ERROR',
      details,
      isOperational:   true,
      coherenceImpact: 0.118,
    });
  }
}

// ---------------------------------------------------------------------------
// CompressionError
// ---------------------------------------------------------------------------

/**
 * Knowledge compression failure.
 *
 * Raised when the KnowledgeCompressor cannot embed a fact, upsertion into the
 * vector store fails, or the tokenReduction computation encounters bad data.
 *
 * coherenceImpact = 0.236 (= CSL.SUPPRESS — visible degradation)
 */
export class CompressionError extends HeadyError {
  /**
   * @param {string} message
   * @param {object} [details]
   * @param {string} [details.traceId]  - Source trace ID.
   * @param {string} [details.factType] - 'stage_pattern' | 'key_fact' | 'tip'
   * @param {number} [details.factIndex]
   */
  constructor(message, details = {}) {
    super(message, {
      statusCode:      500,
      code:            'COMPRESSION_ERROR',
      details,
      isOperational:   true,
      coherenceImpact: 0.236,
    });
  }
}

// ---------------------------------------------------------------------------
// RecipeConflictError
// ---------------------------------------------------------------------------

/**
 * Duplicate / conflicting recipe detected.
 *
 * Raised when the trajectory filter or distillation engine detects that a
 * proposed recipe already exists with cosine similarity >= CSL.DEDUP (0.972).
 * The caller should discard the duplicate rather than storing it.
 *
 * coherenceImpact = 0 — dedup is expected behaviour, not a degradation.
 */
export class RecipeConflictError extends HeadyError {
  /**
   * @param {string} message
   * @param {object} [details]
   * @param {string} [details.existingId]  - ID of the already-stored recipe.
   * @param {number} [details.similarity]  - Cosine similarity that triggered dedup.
   * @param {string} [details.candidateId] - ID of the rejected candidate.
   */
  constructor(message, details = {}) {
    super(message, {
      statusCode:      409,
      code:            'RECIPE_CONFLICT',
      details,
      isOperational:   true,
      coherenceImpact: 0,
    });
  }
}

// ---------------------------------------------------------------------------
// CoherenceDriftError
// ---------------------------------------------------------------------------

/**
 * CSL coherence score has dropped below the configured threshold.
 *
 * Raised by any component that tracks its own 384D embedding and detects
 * that its current cosine similarity against its intended design embedding
 * has fallen below CSL.MEDIUM (0.809 by default). Triggers the self-healing
 * cycle in HeadySoul.
 *
 * coherenceImpact = threshold − currentScore (measured degradation).
 */
export class CoherenceDriftError extends HeadyError {
  /**
   * @param {string} component    - Name of the drifting component.
   * @param {number} currentScore - Measured cosine similarity.
   * @param {number} threshold    - Required minimum (e.g. CSL.MEDIUM = 0.809).
   */
  constructor(component, currentScore, threshold) {
    const impact = Math.max(0, threshold - currentScore);
    super(
      `Coherence drift: ${component} score ${currentScore.toFixed(4)} is below threshold ${threshold}`,
      {
        statusCode: 503,
        code:       'COHERENCE_DRIFT',
        details: {
          component,
          currentScore,
          threshold,
        },
        isOperational:   true,
        coherenceImpact: impact,
      }
    );
  }
}
