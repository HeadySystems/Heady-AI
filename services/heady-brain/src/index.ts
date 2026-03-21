import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { HeadyLogger, loadConfig, BaseServiceConfigSchema } from '@heady-ai/core';
import { z } from 'zod';
import { chatRouter } from './routes/chat';
import { analyzeRouter } from './routes/analyze';
import { healthRouter } from './routes/health';

const ConfigSchema = BaseServiceConfigSchema.extend({
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional()
});

const config = loadConfig(ConfigSchema);
const logger = new HeadyLogger('heady-brain');
const app = express();

// Middleware — strict CORS, no wildcard
const HEADY_ORIGINS = [
  'https://headyme.com', 'https://headysystems.com', 'https://headyconnection.org',
  'https://headybuddy.org', 'https://headymcp.com', 'https://headyio.com',
  'https://headybot.com', 'https://headyapi.com', 'https://headyai.com',
  'https://headylens.com', 'https://headyfinance.com',
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:3000', 'http://localhost:3300', 'http://localhost:3301'] : [])
];
app.use(helmet());
app.use(cors({ origin: HEADY_ORIGINS, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/health', healthRouter);
app.use('/chat', chatRouter);
app.use('/analyze', analyzeRouter);

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Request error', err);
  res.status(err.statusCode || 500).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message
    }
  });
});

const PORT = config.PORT || 3001;

app.listen(PORT, () => {
  logger.info(`HeadyBrain listening on port ${PORT}`);
  logger.info(`Environment: ${config.NODE_ENV}`);
});
