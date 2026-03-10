/**
 * Vector Memory Service Types — Heady™ v4.0.0
 */

export interface VectorEntry {
  readonly id: string;
  readonly content: string;
  readonly embedding: number[];     // 384D
  readonly projection3D: [number, number, number]; // 3D spatial
  readonly metadata: Record<string, string | number | boolean>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly coherenceScore: number;
}

export interface SearchQuery {
  readonly vector: number[];
  readonly topK?: number;          // default: fib(8) = 21
  readonly threshold?: number;     // default: CSL_THRESHOLDS.LOW ≈ 0.691
  readonly filter?: Record<string, string | number | boolean>;
  readonly includeMetadata?: boolean;
}

export interface SearchResult {
  readonly id: string;
  readonly score: number;
  readonly content: string;
  readonly projection3D: [number, number, number];
  readonly metadata?: Record<string, string | number | boolean>;
}

export interface MemoryStats {
  readonly totalVectors: number;
  readonly dimensions: number;
  readonly indexType: string;
  readonly avgCoherence: number;
  readonly storageBytes: number;
}

export interface StoreRequest {
  readonly content: string;
  readonly embedding: number[];
  readonly metadata?: Record<string, string | number | boolean>;
  readonly namespace?: string;
}

export interface ProjectionConfig {
  readonly method: 'pca' | 'umap' | 'phi-spiral';
  readonly targetDimensions: 3;
}
