// packages/heady-distiller/src/distill.js
// §8 — Stage 22 Knowledge Compression
import { chat } from '../../heady-llm/src/gateway.js';
import { getEmbedding } from '../../heady-llm/src/embed.js';
import { upsertMemory } from '../../heady-memory/src/t1-neon.js';
import { CSL } from '../../heady-core/src/phi.js';

/**
 * Compress a full pipeline session into compact knowledge units for future reuse.
 * Extracts key facts, patterns, and domain tags, then stores each fact as a memory vector.
 *
 * @param {{ sessionId: string, userId: string, stages: object, input: string, output: string }} params
 * @returns {Promise<{ stage: 22, name: string, patternsAdded: number, tokenReduction: number, passed: true }>}
 */
export async function distill(params) {
  try {
    const compressionRes = await chat({
      messages: [
        {
          role: 'system',
          content: `Compress this Q&A session into a compact knowledge unit for future reuse.
Extract: key facts, patterns, successful approaches, domain tags.
Return ONLY valid JSON: {
  "keyFacts": ["..."],
  "patterns": ["..."],
  "domain": "string",
  "confidence": 0.0,
  "tokens_saved_estimate": 0
}`
        },
        {
          role: 'user',
          content: `Input: ${params.input.substring(0, 500)}\nOutput: ${params.output.substring(0, 1000)}\nPatterns: ${JSON.stringify((params.stages[13]?.patterns || []).slice(0, 3))}`
        }
      ],
      temperature: 0.1
    });

    let compressed;
    try {
      compressed = JSON.parse(compressionRes.content);
    } catch {
      return { stage: 22, name: 'DISTILLATION', patternsAdded: 0, tokenReduction: 0, passed: true };
    }

    let patternsAdded = 0;
    if (compressed.confidence >= CSL.RECALL) {
      for (const fact of (compressed.keyFacts ?? []).slice(0, 5)) {
        const embedding = await getEmbedding(fact).catch(() => []);
        if (embedding.length) {
          await upsertMemory(params.userId, fact, embedding, compressed.confidence).catch(() => { });
          patternsAdded++;
        }
      }
    }

    return {
      stage: 22,
      name: 'DISTILLATION',
      patternsAdded,
      tokenReduction: compressed.tokens_saved_estimate ?? 0,
      passed: true
    };
  } catch {
    return { stage: 22, name: 'DISTILLATION', patternsAdded: 0, tokenReduction: 0, passed: true };
  }
}

