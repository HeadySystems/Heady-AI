"use strict";

var __importDefault = this && this.__importDefault || function (mod) {
  return mod && mod.__esModule ? mod : {
    "default": mod
  };
};
Object.defineProperty(exports, "__esModule", {
  value: true
});
const express_1 = __importDefault(require("express"));
const pino_http_1 = __importDefault(require("pino-http"));
const pino_1 = __importDefault(require("pino"));
const pg_1 = require("pg");
const uuid_1 = require("uuid");
const dotenv_1 = __importDefault(require("dotenv"));
const engine_1 = require("./scheduler/engine");
const job_store_1 = require("./scheduler/job-store");
const executor_1 = require("./scheduler/executor");
dotenv_1.default.config();
const logger = (0, pino_1.default)({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  }
});
const httpLogger = (0, pino_http_1.default)({
  logger
});
const PHI = 1.618033988749895;
class SchedulerService {
  constructor() {
    this.isHealthy = false;
    this.totalJobsProcessed = 0;
    this.app = (0, express_1.default)();
    this.port = parseInt(process.env.PORT || '3370', 10);
    this.logger = logger;
    const dbConfig = {
      host: process.env.DB_HOST || "0.0.0.0",
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'heady',
      user: process.env.DB_USER || 'heady_user',
      password: process.env.DB_PASSWORD || 'heady_password',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    };
    this.pool = new pg_1.Pool(dbConfig);
    this.jobStore = new job_store_1.JobStore(this.pool, this.logger);
    this.jobExecutor = new executor_1.JobExecutor(this.logger);
    this.schedulerEngine = new engine_1.SchedulerEngine(this.jobStore, this.jobExecutor, PHI, this.logger);
    this.setupMiddleware();
    this.setupRoutes();
    this.initializeDatabase();
  }
  setupMiddleware() {
    this.app.use(httpLogger);
    this.app.use(express_1.default.json({
      limit: '10mb'
    }));
    this.app.use(this.errorHandler.bind(this));
  }
  setupRoutes() {
    this.app.post('/api/scheduler/jobs', this.handleCreateJob.bind(this));
    this.app.get('/api/scheduler/jobs', this.handleListJobs.bind(this));
    this.app.delete('/api/scheduler/jobs/:id', this.handleCancelJob.bind(this));
    this.app.post('/api/scheduler/jobs/:id/trigger', this.handleTriggerJob.bind(this));
    this.app.get('/health', this.handleHealth.bind(this));
  }
  async initializeDatabase() {
    try {
      const client = await this.pool.connect();
      await client.query(`
        CREATE TABLE IF NOT EXISTS scheduler_jobs (
          id UUID PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          type VARCHAR(255) NOT NULL,
          payload JSONB NOT NULL,
          status VARCHAR(50) NOT NULL,
          schedule JSONB NOT NULL,
          max_retries INTEGER DEFAULT 3,
          timeout_ms INTEGER DEFAULT 30000,
          retry_count INTEGER DEFAULT 0,
          last_run_at TIMESTAMP,
          next_run_at TIMESTAMP,
          last_error TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_scheduler_status ON scheduler_jobs (status);
        CREATE INDEX IF NOT EXISTS idx_scheduler_next_run ON scheduler_jobs (next_run_at);
        CREATE INDEX IF NOT EXISTS idx_scheduler_created ON scheduler_jobs (created_at DESC);
      `);
      client.release();
      this.isHealthy = true;
      this.logger.info({
        component: 'database'
      }, 'Database initialized successfully');
      await this.schedulerEngine.start();
      this.logger.info({
        component: 'scheduler'
      }, 'Scheduler engine started');
    } catch (error) {
      this.logger.error({
        component: 'database',
        error
      }, 'Failed to initialize database');
      this.isHealthy = false;
      setTimeout(() => this.initializeDatabase(), 5000);
    }
  }
  async handleCreateJob(req, res) {
    const requestId = (0, uuid_1.v4)();
    const startTime = Date.now();
    try {
      const {
        name,
        type,
        payload,
        schedule,
        maxRetries = 3,
        timeout = 30000
      } = req.body;
      if (!name || name.trim().length === 0) {
        res.status(400).json({
          error: 'Invalid request',
          message: 'Job name is required',
          requestId
        });
        return;
      }
      if (!type || type.trim().length === 0) {
        res.status(400).json({
          error: 'Invalid request',
          message: 'Job type is required',
          requestId
        });
        return;
      }
      if (!schedule || !schedule.type) {
        res.status(400).json({
          error: 'Invalid request',
          message: 'Schedule with type is required',
          requestId
        });
        return;
      }
      const validMaxRetries = Math.max(0, Math.min(maxRetries, 10));
      const validTimeout = Math.max(1000, Math.min(timeout, 600000));
      const jobId = (0, uuid_1.v4)();
      const job = await this.jobStore.createJob({
        id: jobId,
        name,
        type,
        payload,
        schedule,
        maxRetries: validMaxRetries,
        timeout: validTimeout
      });
      await this.schedulerEngine.scheduleJob(jobId, schedule);
      const duration = Date.now() - startTime;
      this.logger.info({
        component: 'scheduler',
        action: 'create_job',
        requestId,
        jobId,
        jobType: type,
        scheduleType: schedule.type,
        durationMs: duration
      }, 'Job created');
      const response = {
        id: job.id,
        name: job.name,
        type: job.type,
        status: job.status,
        createdAt: job.createdAt?.toISOString() || new Date().toISOString(),
        nextRunAt: job.nextRunAt?.toISOString(),
        schedule: job.schedule
      };
      res.status(201).json({
        success: true,
        requestId,
        job: response,
        durationMs: duration
      });
    } catch (error) {
      this.logger.error({
        component: 'scheduler',
        action: 'create_job',
        requestId,
        error,
        durationMs: Date.now() - startTime
      }, 'Failed to create job');
      throw error;
    }
  }
  async handleListJobs(req, res) {
    const requestId = (0, uuid_1.v4)();
    const startTime = Date.now();
    try {
      const status = req.query.status;
      const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
      const offset = Math.max(parseInt(req.query.offset) || 0, 0);
      const jobs = await this.jobStore.listJobs(status, limit, offset);
      const total = await this.jobStore.countJobs(status);
      const duration = Date.now() - startTime;
      const responses = jobs.map(job => ({
        id: job.id,
        name: job.name,
        type: job.type,
        status: job.status,
        createdAt: job.createdAt?.toISOString() || new Date().toISOString(),
        nextRunAt: job.nextRunAt?.toISOString(),
        schedule: job.schedule
      }));
      this.logger.info({
        component: 'scheduler',
        action: 'list_jobs',
        requestId,
        jobsCount: jobs.length,
        total,
        status,
        durationMs: duration
      }, 'Jobs listed');
      res.json({
        success: true,
        requestId,
        jobs: responses,
        count: jobs.length,
        total,
        limit,
        offset,
        durationMs: duration
      });
    } catch (error) {
      this.logger.error({
        component: 'scheduler',
        action: 'list_jobs',
        requestId,
        error
      }, 'Failed to list jobs');
      throw error;
    }
  }
  async handleCancelJob(req, res) {
    const requestId = (0, uuid_1.v4)();
    const startTime = Date.now();
    try {
      const {
        id
      } = req.params;
      if (!id || !this.isValidUuid(id)) {
        res.status(400).json({
          error: 'Invalid request',
          message: 'Valid job ID is required',
          requestId
        });
        return;
      }
      const job = await this.jobStore.getJob(id);
      if (!job) {
        res.status(404).json({
          error: 'Not found',
          message: 'Job not found',
          requestId
        });
        return;
      }
      await this.jobStore.updateJobStatus(id, 'cancelled');
      await this.schedulerEngine.cancelJob(id);
      const duration = Date.now() - startTime;
      this.logger.info({
        component: 'scheduler',
        action: 'cancel_job',
        requestId,
        jobId: id,
        durationMs: duration
      }, 'Job cancelled');
      res.json({
        success: true,
        requestId,
        message: 'Job cancelled',
        jobId: id,
        durationMs: duration
      });
    } catch (error) {
      this.logger.error({
        component: 'scheduler',
        action: 'cancel_job',
        requestId,
        error
      }, 'Failed to cancel job');
      throw error;
    }
  }
  async handleTriggerJob(req, res) {
    const requestId = (0, uuid_1.v4)();
    const startTime = Date.now();
    try {
      const {
        id
      } = req.params;
      if (!id || !this.isValidUuid(id)) {
        res.status(400).json({
          error: 'Invalid request',
          message: 'Valid job ID is required',
          requestId
        });
        return;
      }
      const job = await this.jobStore.getJob(id);
      if (!job) {
        res.status(404).json({
          error: 'Not found',
          message: 'Job not found',
          requestId
        });
        return;
      }
      const executionId = await this.schedulerEngine.triggerJobNow(id);
      const duration = Date.now() - startTime;
      this.totalJobsProcessed += 1;
      this.logger.info({
        component: 'scheduler',
        action: 'trigger_job',
        requestId,
        jobId: id,
        executionId,
        durationMs: duration
      }, 'Job triggered');
      res.json({
        success: true,
        requestId,
        message: 'Job triggered',
        jobId: id,
        executionId,
        durationMs: duration
      });
    } catch (error) {
      this.logger.error({
        component: 'scheduler',
        action: 'trigger_job',
        requestId,
        error
      }, 'Failed to trigger job');
      throw error;
    }
  }
  async handleHealth(_req, res) {
    const startTime = Date.now();
    try {
      const client = await this.pool.connect();
      const dbStartTime = Date.now();
      await client.query('SELECT 1');
      const dbLatency = Date.now() - dbStartTime;
      client.release();
      const activeJobs = await this.jobStore.countJobs('running');
      const health = {
        status: this.isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        database: {
          connected: true,
          latencyMs: dbLatency
        },
        scheduler: {
          activeJobs,
          totalJobsProcessed: this.totalJobsProcessed
        }
      };
      const statusCode = this.isHealthy ? 200 : 503;
      res.status(statusCode).json(health);
      this.logger.debug({
        component: 'health',
        statusCode,
        durationMs: Date.now() - startTime,
        dbLatencyMs: dbLatency,
        activeJobs
      }, 'Health check completed');
    } catch (error) {
      this.logger.error({
        component: 'health',
        error,
        durationMs: Date.now() - startTime
      }, 'Health check failed');
      const health = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        database: {
          connected: false,
          latencyMs: Date.now() - startTime
        },
        scheduler: {
          activeJobs: 0,
          totalJobsProcessed: this.totalJobsProcessed
        }
      };
      res.status(503).json(health);
    }
  }
  errorHandler(error, _req, res, _next) {
    this.logger.error({
      component: 'error_handler',
      error
    }, 'Unhandled error');
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  isValidUuid(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
  async start() {
    try {
      this.app.listen(this.port, () => {
        this.logger.info({
          component: 'server',
          port: this.port,
          environment: process.env.NODE_ENV
        }, 'Scheduler service started');
      });
    } catch (error) {
      this.logger.fatal({
        component: 'server',
        error
      }, 'Failed to start scheduler service');
      process.exit(1);
    }
  }
  async shutdown() {
    this.logger.info({
      component: 'server'
    }, 'Shutting down scheduler service');
    await this.schedulerEngine.stop();
    await this.pool.end();
  }
}
const service = new SchedulerService();
process.on('SIGTERM', async () => {
  service.logger.info({
    signal: 'SIGTERM'
  }, 'Received termination signal');
  await service.shutdown();
  process.exit(0);
});
process.on('SIGINT', async () => {
  service.logger.info({
    signal: 'SIGINT'
  }, 'Received interrupt signal');
  await service.shutdown();
  process.exit(0);
});
service.start().catch(error => {
  logger.fatal({
    error
  }, 'Fatal error during startup');
  process.exit(1);
});
//# sourceMappingURL=index.js.map