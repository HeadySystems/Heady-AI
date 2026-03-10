/**
 * CSL Engine Service — Entry Point — Heady™ v4.0.0
 * Port 3322 — Continuous Semantic Logic gates, classification, routing
 * Author: Eric Haywood / HeadySystems Inc. — 51 Provisional Patents
 */

import express from 'express';
import { createLogger, generateCorrelationId } from '../../shared/logger.js';
import { healthRoutes } from '../../shared/health.js';
import { errorHandler, SecurityErrors } from '../../shared/errors.js';
import { executeCSL, classify, routeTask } from './service.js';

const logger = createLogger('csl-engine-service');
const PORT = parseInt(process.env.PORT || '3322', 10);
const app = express();

app.use(express.json({ limit: '2mb' }));
app.use((_req, _res, next) => { generateCorrelationId(); next(); });

healthRoutes(app as Parameters<typeof healthRoutes>[0], {
  service: 'csl-engine-service',
  version: '4.0.0',
});

// ═══ Execute CSL Operation ═══
app.post('/csl/execute', (req, res, next) => {
  try {
    const result = executeCSL(req.body);
    res.json(result);
  } catch (err) { next(err); }
});

// ═══ Classify Intent ═══
app.post('/csl/classify', (req, res, next) => {
  try {
    const { input, categories, topK } = req.body;
    if (!input || !categories) {
      throw SecurityErrors.inputValidationFailed('body', 'input and categories required');
    }
    const results = classify({ input, categories, topK });
    res.json({ results });
  } catch (err) { next(err); }
});

// ═══ Route Task ═══
app.post('/csl/route', (req, res, next) => {
  try {
    const { taskEmbedding, nodeCapabilities } = req.body;
    if (!taskEmbedding || !nodeCapabilities) {
      throw SecurityErrors.inputValidationFailed('body', 'taskEmbedding and nodeCapabilities required');
    }
    const decision = routeTask(taskEmbedding, nodeCapabilities);
    res.json(decision);
  } catch (err) { next(err); }
});

app.use(errorHandler as express.ErrorRequestHandler);

function shutdown(signal: string): void {
  logger.info('Graceful shutdown', { signal });
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

app.listen(PORT, '0.0.0.0', () => {
  logger.info('CSL Engine Service started', { port: PORT });
});
