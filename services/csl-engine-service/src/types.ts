/**
 * CSL Engine Types — Heady™ v4.0.0
 */

export type CSLOperation = 'AND' | 'OR' | 'NOT' | 'IMPLY' | 'XOR' | 'CONSENSUS' | 'GATE';

export interface CSLRequest {
  readonly operation: CSLOperation;
  readonly vectors: number[][];
  readonly weights?: number[];
  readonly threshold?: number;
  readonly temperature?: number;
}

export interface CSLResponse {
  readonly operation: CSLOperation;
  readonly result: number | number[];
  readonly confidence: number;
  readonly latencyMs: number;
}

export interface ClassificationRequest {
  readonly input: number[];
  readonly categories: { name: string; vector: number[] }[];
  readonly topK?: number;
}

export interface ClassificationResult {
  readonly category: string;
  readonly score: number;
}

export interface RoutingDecision {
  readonly selectedNode: string;
  readonly confidence: number;
  readonly alternatives: { node: string; score: number }[];
}
