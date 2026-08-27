// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Embedding — locked embedder adapter (ADR-0015)            ║
// ║  Made with ❤️ by HeadySystems Inc.                                ║
// ╚══════════════════════════════════════════════════════════════════╝
// Locked embedder adapter (ADR-0015). Canonical stack: Cloudflare Workers AI.
// Not runnable in the bare scaffold — requires the Workers AI binding — but this is the real shape.
import { LOCKED_MODEL, assertModelLock, type ModelLock } from "./core.mjs";

export interface Embedder {
  readonly model: ModelLock;
  /** Batch embed. Returns one 384-d vector per input, in order. */
  embed(texts: string[]): Promise<number[][]>;
}

/** Workers AI binding shape (subset). */
interface WorkersAI {
  run(model: string, input: { text: string[] }): Promise<{ data: number[][] }>;
}

/**
 * The one embedder. Asserts the model lock on construction and validates output dimensionality —
 * a wrong-dimension response fails closed rather than corrupting the index.
 */
export class WorkersAIEmbedder implements Embedder {
  readonly model = LOCKED_MODEL;
  constructor(private readonly ai: WorkersAI) {
    assertModelLock(this.model);
  }
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const { data } = await this.ai.run(this.model.id, { text: texts });
    for (const v of data) {
      if (v.length !== this.model.dim) {
        throw new Error(
          `embedder returned dim=${v.length}, expected ${this.model.dim} (ADR-0015 fail-closed)`,
        );
      }
    }
    return data;
  }
}
