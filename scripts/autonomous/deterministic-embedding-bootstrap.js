'use strict';

/**
 * Deterministic Embedding Bootstrap
 * Builds chunk plans and queue assignments for embedding pipelines.
 */

function buildChunkPlan(text, chunkSize, overlap, maxChunks) {
    const chunks = [];
    let offset = 0;
    while (chunks.length < maxChunks && offset < text.length) {
        const end = Math.min(offset + chunkSize, text.length);
        chunks.push(text.slice(offset, end));
        offset += chunkSize - overlap;
        if (end >= text.length) break;
    }
    return chunks.slice(0, maxChunks);
}

function buildQueueAssignments(plan, currentLoad) {
    const { scheduling, workers } = plan;
    const queues = Object.keys(scheduling.queue_weights);

    return queues.map((queue) => {
        const eligible = workers.filter((w) => w.queues.includes(queue));
        if (eligible.length === 0) return { queue, selectedWorker: null };

        // Score each worker: higher concurrency and lower current load is better
        let best = null;
        let bestScore = -Infinity;
        for (const w of eligible) {
            const load = (currentLoad && currentLoad[queue]) || 0;
            const score = w.max_concurrency * scheduling.queue_weights[queue] - load;
            if (score > bestScore) {
                bestScore = score;
                best = w;
            }
        }
        return { queue, selectedWorker: best ? best.id : null };
    });
}

module.exports = { buildChunkPlan, buildQueueAssignments };
