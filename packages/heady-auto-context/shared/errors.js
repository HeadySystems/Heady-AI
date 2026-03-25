/**
 * ═══════════════════════════════════════════════════════════
 * HEADY™ TYPED ERROR CLASSES
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 * No raw strings or generic Error — always typed
 * ═══════════════════════════════════════════════════════════
 */

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class EmbeddingError extends AppError {
  constructor(message, details = {}) {
    super(message, 502, 'EMBEDDING_PROVIDER_ERROR', details);
    this.name = 'EmbeddingError';
  }
}

export class VectorSearchError extends AppError {
  constructor(message, details = {}) {
    super(message, 500, 'VECTOR_SEARCH_ERROR', details);
    this.name = 'VectorSearchError';
  }
}

export class ContextFusionError extends AppError {
  constructor(message, details = {}) {
    super(message, 500, 'CONTEXT_FUSION_ERROR', details);
    this.name = 'ContextFusionError';
  }
}

export class IndexingError extends AppError {
  constructor(message, details = {}) {
    super(message, 500, 'INDEXING_ERROR', details);
    this.name = 'IndexingError';
  }
}

export class ValidationError extends AppError {
  constructor(message, details = {}) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}
