/**
 * CSL Engine Service — Core Logic — Heady™ v4.0.0
 * Continuous Semantic Logic: geometric vector operations as logical gates
 * Author: Eric Haywood / HeadySystems Inc. — 51 Provisional Patents
 */

import {
  PHI, PSI, FIB, CSL_THRESHOLDS,
  cosineSimilarity, normalize, cslAND, cslOR, cslNOT, cslIMPLY, cslCONSENSUS, cslGate,
  adaptiveTemperature
} from '../../shared/phi-math.js';
import { createLogger } from '../../shared/logger.js';
import { CSLErrors } from '../../shared/errors.js';
import type { CSLRequest, CSLResponse, ClassificationRequest, ClassificationResult, RoutingDecision } from './types.js';

const logger = createLogger('csl-engine-service');

// ═══ Execute CSL Operation ═══
export function executeCSL(req: CSLRequest): CSLResponse {
  const start = Date.now();
  const { operation, vectors, weights, threshold, temperature } = req;

  if (vectors.length < 1) {
    throw CSLErrors.operationUndefined('Requires at least 1 vector');
  }

  let result: number | number[];
  let confidence: number;

  switch (operation) {
    case 'AND': {
      if (vectors.length !== 2) throw CSLErrors.operationUndefined('AND requires exactly 2 vectors');
      const score = cslAND(vectors[0], vectors[1]);
      result = score;
      confidence = Math.abs(score);
      break;
    }
    case 'OR': {
      if (vectors.length < 2) throw CSLErrors.operationUndefined('OR requires at least 2 vectors');
      let combined = vectors[0];
      for (let i = 1; i < vectors.length; i++) {
        combined = cslOR(combined, vectors[i]);
      }
      result = combined;
      confidence = 1.0; // OR always produces a valid superposition
      break;
    }
    case 'NOT': {
      if (vectors.length !== 2) throw CSLErrors.operationUndefined('NOT requires exactly 2 vectors');
      const notResult = cslNOT(vectors[0], vectors[1]);
      // Verify orthogonality (NOT result should be orthogonal to b)
      const orthCheck = cosineSimilarity(notResult, vectors[1]);
      result = notResult;
      confidence = 1 - Math.abs(orthCheck); // Higher when more orthogonal
      break;
    }
    case 'IMPLY': {
      if (vectors.length !== 2) throw CSLErrors.operationUndefined('IMPLY requires exactly 2 vectors');
      result = cslIMPLY(vectors[0], vectors[1]);
      confidence = cosineSimilarity(vectors[0], vectors[1]);
      break;
    }
    case 'XOR': {
      if (vectors.length !== 2) throw CSLErrors.operationUndefined('XOR requires exactly 2 vectors');
      const orResult = cslOR(vectors[0], vectors[1]);
      const mutual = cslIMPLY(vectors[0], vectors[1]);
      const xorResult = cslNOT(orResult, mutual);
      result = xorResult;
      confidence = 1 - Math.abs(cosineSimilarity(vectors[0], vectors[1]));
      break;
    }
    case 'CONSENSUS': {
      if (vectors.length < 2) throw CSLErrors.operationUndefined('CONSENSUS requires at least 2 vectors');
      result = cslCONSENSUS(vectors, weights);
      // Measure agreement: average pairwise similarity
      let totalSim = 0;
      let pairs = 0;
      for (let i = 0; i < vectors.length; i++) {
        for (let j = i + 1; j < vectors.length; j++) {
          totalSim += cosineSimilarity(vectors[i], vectors[j]);
          pairs++;
        }
      }
      confidence = pairs > 0 ? totalSim / pairs : 0;
      break;
    }
    case 'GATE': {
      if (vectors.length !== 2) throw CSLErrors.operationUndefined('GATE requires exactly 2 vectors (input, gate)');
      const cosScore = cosineSimilarity(vectors[0], vectors[1]);
      const tau = threshold || CSL_THRESHOLDS.MEDIUM;
      const temp = temperature || Math.pow(PSI, 3);
      const gated = cslGate(1.0, cosScore, tau, temp);
      result = gated;
      confidence = cosScore;
      break;
    }
    default:
      throw CSLErrors.operationUndefined(operation);
  }

  const latencyMs = Date.now() - start;
  logger.info('CSL operation executed', { operation, confidence: Number(confidence.toFixed(4)), latencyMs });

  return { operation, result, confidence, latencyMs };
}

// ═══ Intent Classification via CSL ═══
export function classify(req: ClassificationRequest): ClassificationResult[] {
  const { input, categories, topK } = req;
  const k = topK || FIB[3]; // 3

  const scores: ClassificationResult[] = categories.map(cat => ({
    category: cat.name,
    score: cosineSimilarity(input, cat.vector),
  }));

  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, k);
}

// ═══ Task Routing via CSL Cosine Similarity ═══
export function routeTask(
  taskEmbedding: number[],
  nodeCapabilities: { name: string; vector: number[] }[]
): RoutingDecision {
  const scores = nodeCapabilities.map(node => ({
    node: node.name,
    score: cosineSimilarity(taskEmbedding, node.vector),
  }));

  scores.sort((a, b) => b.score - a.score);

  const selected = scores[0];
  if (selected.score < CSL_THRESHOLDS.MINIMUM) {
    logger.warn('Low routing confidence', { selectedNode: selected.node, score: selected.score });
  }

  return {
    selectedNode: selected.node,
    confidence: selected.score,
    alternatives: scores.slice(1, FIB[4]), // top 5 alternatives
  };
}
