const { createLogger } = require('../../../src/utils/logger');
const logger = createLogger('auto-fixed');
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Browser AI v1.0                                        ║
// ║  Zero-cost client-side inference via Transformers.js + WebGPU   ║
// ║  Embeddings, classification, sentiment — all at $0/inference    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * HeadyBrowserAI — Client-side ML inference module.
 *
 * Loads Transformers.js models into the browser via WebGPU (or WASM fallback).
 * Used for: embeddings, intent classification, sentiment, text similarity.
 * Server-side inference is only called when browser cannot handle the task.
 *
 * Usage (vanilla JS — Law 3 compliant):
 *
 *   <script type="module">
 *     import { HeadyBrowserAI } from '/assets/browser-ai.js';
 *     const ai = new HeadyBrowserAI();
 *     await ai.init();
 *
 *     const embedding = await ai.embed('What is sacred geometry?');
 *     const intent = await ai.classify('Deploy the new service', ['task', 'question', 'chat']);
 *     const similarity = await ai.similarity('golden ratio', 'fibonacci sequence');
 *   </script>
 */

const PHI = 1.618033988749895;
const PSI = 1 / PHI;
export class HeadyBrowserAI {
  constructor(opts = {}) {
    this.embedModel = opts.embedModel || 'Xenova/all-MiniLM-L6-v2';
    this.classifyModel = opts.classifyModel || 'Xenova/distilbert-base-uncased-mnli';
    this.device = opts.device || 'auto'; // 'webgpu', 'wasm', or 'auto'
    this.ready = false;
    this._pipeline = null;
    this._embedPipeline = null;
    this._classifyPipeline = null;
    this._transformers = null;
  }

  /**
   * Initialize: load Transformers.js and warm up models.
   * Call once on page load. Models are cached in IndexedDB after first download.
   */
  async init() {
    if (this.ready) return;
    try {
      // Dynamic import — Transformers.js from CDN
      this._transformers = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/dist/transformers.min.js');

      // Configure device preference
      if (this.device === 'auto') {
        // Detect WebGPU support
        if (typeof navigator !== 'undefined' && navigator.gpu) {
          this.device = 'webgpu';
        } else {
          this.device = 'wasm';
        }
      }
      logger.info(`[HeadyBrowserAI] Initializing with device: ${this.device}`);

      // Pre-load embedding pipeline (most used)
      this._embedPipeline = await this._transformers.pipeline('feature-extraction', this.embedModel, {
        device: this.device,
        dtype: 'fp32'
      });
      this.ready = true;
      logger.info('[HeadyBrowserAI] Ready — embeddings available at $0/inference');
    } catch (err) {
      logger.warn('[HeadyBrowserAI] Initialization failed — falling back to server:', err.message);
      this.ready = false;
    }
  }

  /**
   * Generate embeddings locally (384D, all-MiniLM-L6-v2).
   * If browser AI is not ready, falls back to server API.
   *
   * @param {string|string[]} texts
   * @returns {Promise<number[][]>} Array of 384D embedding vectors
   */
  async embed(texts) {
    const input = Array.isArray(texts) ? texts : [texts];
    if (this.ready && this._embedPipeline) {
      const results = await this._embedPipeline(input, {
        pooling: 'mean',
        normalize: true
      });

      // Convert to plain arrays
      return input.map((_, i) => Array.from(results[i].data));
    }

    // Fallback to server
    return this._serverEmbed(input);
  }

  /**
   * Zero-shot classification (local).
   * Classify text into candidate labels without training.
   *
   * @param {string} text
   * @param {string[]} labels - e.g., ['task', 'question', 'conversational', 'creative']
   * @returns {Promise<{label: string, score: number}[]>}
   */
  async classify(text, labels) {
    if (this.ready && this._transformers) {
      if (!this._classifyPipeline) {
        this._classifyPipeline = await this._transformers.pipeline('zero-shot-classification', this.classifyModel, {
          device: this.device
        });
      }
      const result = await this._classifyPipeline(text, labels);
      return result.labels.map((label, i) => ({
        label,
        score: result.scores[i]
      }));
    }

    // Fallback: simple keyword-based classification
    return this._keywordClassify(text, labels);
  }

  /**
   * Compute cosine similarity between two texts (local embeddings).
   *
   * @param {string} textA
   * @param {string} textB
   * @returns {Promise<number>} Similarity score [0, 1]
   */
  async similarity(textA, textB) {
    const [embA, embB] = await Promise.all([this.embed(textA), this.embed(textB)]);
    return this._cosineSim(embA[0], embB[0]);
  }

  /**
   * Batch similarity: compare a query against multiple candidates.
   * Returns candidates sorted by similarity, CSL-gated.
   */
  async batchSimilarity(query, candidates) {
    const queryEmb = (await this.embed(query))[0];
    const candEmbs = await this.embed(candidates);
    const scored = candidates.map((text, i) => ({
      text,
      score: this._cosineSim(queryEmb, candEmbs[i])
    }));
    scored.sort((a, b) => b.score - a.score);

    // CSL tier classification
    return scored.map(s => ({
      ...s,
      cslTier: s.score >= PSI + 0.1 ? 'CORE' : s.score >= PSI ? 'INCLUDE' : s.score >= PSI * PSI ? 'RECALL' : 'VOID'
    }));
  }

  /**
   * Check if task can be handled locally or needs server.
   * Lightweight complexity estimation for routing.
   */
  canHandleLocally(taskType) {
    const localCapabilities = new Set(['embed', 'classify', 'similarity', 'sentiment', 'tokenize', 'language-detect']);
    return this.ready && localCapabilities.has(taskType);
  }

  /**
   * Get model status and capabilities.
   */
  status() {
    return {
      ready: this.ready,
      device: this.device,
      webgpuAvailable: typeof navigator !== 'undefined' && !!navigator.gpu,
      embedModel: this.embedModel,
      classifyModel: this.classifyModel,
      capabilities: this.ready ? ['embed', 'classify', 'similarity', 'sentiment'] : ['fallback-to-server'],
      costPerInference: '$0.00'
    };
  }

  // ── Private Methods ─────────────────────────────────────────────

  _cosineSim(a, b) {
    let dot = 0,
      normA = 0,
      normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
  }
  async _serverEmbed(texts) {
    const resp = await fetch('/api/v1/embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        texts
      }),
      credentials: 'include'
    });
    const data = await resp.json();
    return data.embeddings;
  }
  _keywordClassify(text, labels) {
    // Ultra-simple fallback: score by keyword overlap
    const words = text.toLowerCase().split(/\s+/);
    return labels.map(label => ({
      label,
      score: words.filter(w => label.toLowerCase().includes(w) || w.includes(label.toLowerCase())).length / words.length
    })).sort((a, b) => b.score - a.score);
  }
}

// Auto-export for vanilla JS usage
if (typeof window !== 'undefined') {
  window.HeadyBrowserAI = HeadyBrowserAI;
}
export default HeadyBrowserAI;