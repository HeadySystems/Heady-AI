/**
 * Vector Memory Service — Entry Point — Heady™ v4.0.0
 * Port 3320 — 384D pgvector, 3D projection, similarity search
 * Author: Eric Haywood / HeadySystems Inc. — 51 Provisional Patents
 */
import express from 'express';
import { createLogger, generateCorrelationId } from '../../shared/logger.js';
import { healthRoutes } from '../../shared/health.js';
import { errorHandler, SecurityErrors } from '../../shared/errors.js';
import { storeVector, searchVectors, getStats, detectDrift, pool } from './service.js';
const logger = createLogger('vector-memory-service');
const PORT = parseInt(process.env.PORT || '3320', 10);
const app = express();
app.use(express.json({ limit: '5mb' }));
app.use((_req, _res, next) => { generateCorrelationId(); next(); });
// ═══ Health ═══
healthRoutes(app, {
    service: 'vector-memory-service',
    version: '4.0.0',
    checks: [{
            name: 'postgresql-pgvector',
            check: async () => {
                const result = await pool.query('SELECT 1 as ok');
                return result.rows[0].ok === 1;
            },
            critical: true,
        }],
});
// ═══ Store Vector ═══
app.post('/vectors', async (req, res, next) => {
    try {
        const { content, embedding, metadata, namespace } = req.body;
        if (!content || !embedding || !Array.isArray(embedding)) {
            throw SecurityErrors.inputValidationFailed('body', 'content and embedding[] required');
        }
        const entry = await storeVector({ content, embedding, metadata, namespace });
        res.status(201).json(entry);
    }
    catch (err) {
        next(err);
    }
});
// ═══ Search Vectors ═══
app.post('/vectors/search', async (req, res, next) => {
    try {
        const { vector, topK, threshold, filter, includeMetadata } = req.body;
        if (!vector || !Array.isArray(vector)) {
            throw SecurityErrors.inputValidationFailed('body', 'vector[] required');
        }
        const results = await searchVectors({ vector, topK, threshold, filter, includeMetadata });
        res.json({ results, count: results.length });
    }
    catch (err) {
        next(err);
    }
});
// ═══ Stats ═══
app.get('/stats', async (_req, res, next) => {
    try {
        const stats = await getStats();
        res.json(stats);
    }
    catch (err) {
        next(err);
    }
});
// ═══ Drift Detection ═══
app.get('/drift/:namespace?', async (req, res, next) => {
    try {
        const drift = await detectDrift(req.params.namespace);
        res.json(drift);
    }
    catch (err) {
        next(err);
    }
});
// ═══ Error Handler ═══
app.use(errorHandler);
// ═══ Graceful Shutdown ═══
async function shutdown(signal) {
    logger.info('Graceful shutdown', { signal });
    await pool.end();
    process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
app.listen(PORT, '0.0.0.0', () => {
    logger.info('Vector Memory Service started', { port: PORT, dimensions: 384 });
});
//# sourceMappingURL=index.js.map