/**
 * Conductor Service — Entry Point — Heady™ v4.0.0
 * Port 3324 — Multi-agent orchestration, HCFullPipeline execution
 * Author: Eric Haywood / HeadySystems Inc. — 51 Provisional Patents
 */

import express from 'express';
import { createLogger, generateCorrelationId } from '../../shared/logger.js';
import { healthRoutes } from '../../shared/health.js';
import { errorHandler, SecurityErrors, PipelineErrors } from '../../shared/errors.js';
import { executePipeline, getPipelineStatus, getMetrics } from './service.js';

const logger = createLogger('conductor-service');
const PORT = parseInt(process.env.PORT || '3324', 10);
const app = express();

app.use(express.json({ limit: '2mb' }));
app.use((_req, _res, next) => { generateCorrelationId(); next(); });

healthRoutes(app as Parameters<typeof healthRoutes>[0], {
  service: 'conductor-service',
  version: '4.0.0',
});

// ═══ Execute Pipeline ═══
app.post('/pipeline/execute', async (req, res, next) => {
  try {
    const { intent, domain, embedding, context, userId } = req.body;
    if (!intent) {
      throw SecurityErrors.inputValidationFailed('intent', 'Task intent is required');
    }
    const taskId = crypto.randomUUID();
    const result = await executePipeline({ id: taskId, intent, domain, embedding, context, userId });
    res.json(result);
  } catch (err) { next(err); }
});

// ═══ Pipeline Status ═══
app.get('/pipeline/:taskId', (req, res) => {
  const state = getPipelineStatus(req.params.taskId);
  if (!state) {
    res.status(404).json({ error: 'Pipeline not found', taskId: req.params.taskId });
    return;
  }
  res.json(state);
});

// ═══ Orchestrator Metrics ═══
app.get('/metrics', (_req, res) => {
  res.json(getMetrics());
});

app.use(errorHandler as express.ErrorRequestHandler);

function shutdown(signal: string): void {
  logger.info('Graceful shutdown', { signal });
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

app.listen(PORT, '0.0.0.0', () => {
  logger.info('Conductor Service started', { port: PORT });
});
