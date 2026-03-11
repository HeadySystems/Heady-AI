import express, { Router, Request, Response, NextFunction, Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import pino, { Logger } from 'pino';
import pinoHttp from 'pino-http';
import type { Server } from 'http';
import type { ServiceManifest, ServiceHealth } from '@heady-ai/contract-types';

const PHI = 1.618033988749895;
const DEFAULT_SHUTDOWN_TIMEOUT = Math.round(PHI * PHI * PHI * 1000);

export interface ServiceRoute {
  method: 'get' | 'post' | 'put' | 'delete' | 'patch';
  path: string;
  handler: (req: Request, res: Response, next: NextFunction) => void | Promise<void>;
}

export interface ServiceAppOptions {
  manifest: ServiceManifest;
  routes?: ServiceRoute[];
  router?: Router;
  corsOrigins?: string[];
  shutdownTimeoutMs?: number;
}

export interface ServiceAppResult {
  app: Express;
  server: Server;
  logger: Logger;
}

export function createServiceApp(opts: ServiceAppOptions): ServiceAppResult {
  const { manifest } = opts;
  const app = express();
  const startTime = Date.now();

  const logger = pino({
    name: manifest.name,
    level: process.env.LOG_LEVEL || 'info',
  });

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: opts.corsOrigins || true, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(pinoHttp({
    logger,
    autoLogging: {
      ignore: (req: any) => req.url === '/health/ready' || req.url === '/health/live',
    },
  }));

  app.get('/health/ready', (_req: Request, res: Response) => {
    const status: ServiceHealth = {
      ok: true,
      service: manifest.name,
      version: manifest.version,
      uptime: Math.round((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
    };
    res.json(status);
  });

  app.get('/health/live', (_req: Request, res: Response) => {
    res.json({ alive: true });
  });

  app.get('/manifest', (_req: Request, res: Response) => {
    res.json(manifest);
  });

  if (opts.router) {
    app.use(opts.router);
  }

  if (opts.routes) {
    for (const route of opts.routes) {
      app[route.method](route.path, route.handler);
    }
  }

  const port = manifest.port || parseInt(process.env.PORT || '3000', 10);
  const shutdownTimeout = opts.shutdownTimeoutMs || DEFAULT_SHUTDOWN_TIMEOUT;

  const server = app.listen(port, () => {
    logger.info({ port, service: manifest.name, version: manifest.version }, `${manifest.name} ready`);
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Graceful shutdown');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), shutdownTimeout);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return { app, server, logger };
}

export { Router, Request, Response, NextFunction } from 'express';
export type { ServiceManifest, ServiceHealth } from '@heady-ai/contract-types';
