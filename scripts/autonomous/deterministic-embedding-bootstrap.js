// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Deterministic Embedding Bootstrap v1.0.0              ║
// ║  Chunking and queue assignment for embedding pipelines         ║
// ║  Made with ❤️ by HeadySystems Inc.                             ║
// ╚══════════════════════════════════════════════════════════════════╝
'use strict';

/**
 * Build a chunk plan from text with overlap, capped at maxChunks.
 * @param {string} text — source text
 * @param {number} chunkSize — target characters per chunk
 * @param {number} overlap — characters of overlap between chunks
 * @param {number} maxChunks — maximum number of chunks to produce
 * @returns {string[]} — array of text chunks
 */
function buildChunkPlan(text, chunkSize = 1000, overlap = 100, maxChunks = Infinity) {
    const chunks = [];
    let offset = 0;
    while (offset < text.length && chunks.length < maxChunks) {
        chunks.push(text.slice(offset, offset + chunkSize));
        offset += chunkSize - overlap;
    }
    return chunks.slice(0, maxChunks);
}

/**
 * Build queue assignments selecting the best worker for each queue.
 * Workers are scored by: max_concurrency * queue_weight / (1 + pressure).
 * @param {{ scheduling: { queue_weights: Record<string, number> }, workers: Array<{ id: string, max_concurrency: number, queues: string[] }> }} plan
 * @param {Record<string, number>} queuePressure — current pressure per queue (0-1)
 * @returns {Array<{ queue: string, selectedWorker: string, score: number }>}
 */
function buildQueueAssignments(plan, queuePressure = {}) {
    const weights = plan.scheduling?.queue_weights || {};
    const workers = plan.workers || [];

    return Object.entries(weights).map(([queue, weight]) => {
        const eligible = workers.filter((w) => (w.queues || []).includes(queue));
        const pressure = queuePressure[queue] || 0;

        let best = null;
        let bestScore = -Infinity;
        for (const worker of eligible) {
            const score = (worker.max_concurrency || 1) * weight / (1 + pressure);
            if (score > bestScore) {
                bestScore = score;
                best = worker;
            }
        }

        return {
            queue,
            selectedWorker: best ? best.id : null,
            score: Number(bestScore.toFixed(6)),
        };
    });
}

module.exports = {
    buildChunkPlan,
    buildQueueAssignments,
};
