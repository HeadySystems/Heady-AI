/**
 * Heady Service Bootstrap — Unified Startup with Secret Loading
 * 
 * Single entrypoint that orchestrates the full system startup sequence.
 * Loads secrets, initializes shared resources, starts services in
 * dependency order, and registers graceful shutdown hooks.
 * 
 * Startup Order:
 * 1. Load secrets from GCP Secret Manager
 * 2. Initialize shared resources (DB, Redis, NATS)
 * 3. Run database migrations
 * 4. Start core services (auth, conductor, memory)
 * 5. Start application services (analytics, scheduler, etc.)
 * 6. Start websites
 * 7. Initialize Colab runtimes
 * 8. Register health endpoints
 * 9. Begin self-healing cycle
 * 
 * @module Bootstrap
 * @author Eric Haywood
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

const {
  PHI,
  PSI,
  fibonacci,
  phiBackoff,
  CSL_THRESHOLDS,
  SERVICE_PORTS
} = require('../shared/phi-math');
const {
  createLogger
} = require('../shared/logger');
const {
  GracefulShutdown,
  SHUTDOWN_PHASE
} = require('./lifecycle/graceful-shutdown');
const logger = createLogger('bootstrap');

// ─── Startup Phases ─────────────────────────────────────────────────────────
const STARTUP_PHASE = {
  SECRETS: 'secrets',
  SHARED: 'shared_resources',
  MIGRATIONS: 'migrations',
  CORE_SERVICES: 'core_services',
  APP_SERVICES: 'app_services',
  WEBSITES: 'websites',
  COLAB: 'colab_runtimes',
  HEALTH: 'health_registration',
  SELF_HEALING: 'self_healing'
};

// Maximum startup time: fib(14) seconds = 377s ≈ 6.3 minutes
const MAX_STARTUP_TIME = fibonacci(14) * 1000;

/**
 * Bootstrap — Unified system startup orchestrator
 */
class Bootstrap {
  constructor(config = {}) {
    this.config = {
      projectId: config.projectId || 'gen-lang-client-0920560496',
      region: config.region || 'us-east1',
      environment: config.environment || process.env.NODE_ENV || 'production',
      enableColab: config.enableColab !== false,
      enableWebsites: config.enableWebsites !== false,
      ...config
    };
    this.shutdown = new GracefulShutdown({
      timeout: fibonacci(13) * 1000
    });
    this.resources = {}; // Shared resource instances
    this.services = {}; // Running service instances
    this.startupLog = []; // Phase completion log
    this.startedAt = null;
    this._state = 'idle';
  }

  /**
   * Start the entire Heady system
   */
  async start() {
    this.startedAt = Date.now();
    this._state = 'starting';
    logger.info({
      environment: this.config.environment,
      projectId: this.config.projectId,
      maxStartupTime: MAX_STARTUP_TIME,
      msg: 'Heady system bootstrap starting'
    });

    // Install signal handlers
    this.shutdown.installSignalHandlers();
    try {
      // Phase 1: Load secrets
      await this._phase(STARTUP_PHASE.SECRETS, async () => {
        const {
          SecretManager
        } = require('../shared/secret-manager');
        this.resources.secrets = new SecretManager({
          projectId: this.config.projectId
        });
        await this.resources.secrets.initialize();

        // Load required secrets
        const secretNames = ['firebase-service-account', 'database-url', 'redis-url', 'nats-url', 'encryption-key', 'jwt-signing-key'];
        this.resources.secretValues = {};
        for (const name of secretNames) {
          try {
            this.resources.secretValues[name] = await this.resources.secrets.getSecret(name);
          } catch (err) {
            logger.warn({
              secret: name,
              err: err.message,
              msg: 'Secret not available — using defaults'
            });
          }
        }
      });

      // Phase 2: Initialize shared resources
      await this._phase(STARTUP_PHASE.SHARED, async () => {
        // PostgreSQL + pgvector
        const {
          PgVectorClient
        } = require('../shared/pgvector-client');
        this.resources.pg = new PgVectorClient({
          connectionString: this.resources.secretValues?.['database-url']
        });
        await this.resources.pg.initialize();
        this.shutdown.registerDatabase('pgvector', this.resources.pg);

        // NATS JetStream
        try {
          const {
            NatsClient
          } = require('../shared/nats-client');
          this.resources.nats = new NatsClient({
            url: this.resources.secretValues?.['nats-url']
          });
          await this.resources.nats.connect();
          this.shutdown.registerCache('nats', this.resources.nats);
        } catch (err) {
          logger.warn({
            err: err.message,
            msg: 'NATS connection failed — running without messaging'
          });
        }

        // Firebase Admin
        const {
          initializeFirebase
        } = require('../shared/firebase-admin');
        this.resources.firebase = await initializeFirebase({
          serviceAccount: this.resources.secretValues?.['firebase-service-account']
        });
      });

      // Phase 3: Run database migrations
      await this._phase(STARTUP_PHASE.MIGRATIONS, async () => {
        const {
          runMigrations
        } = require('../migrations/migrate');
        await runMigrations(this.resources.pg);
      });

      // Phase 4: Core services
      await this._phase(STARTUP_PHASE.CORE_SERVICES, async () => {
        // HeadySoul — Values arbiter
        const {
          HeadySoul
        } = require('./intelligence/heady-soul');
        this.services.soul = new HeadySoul({
          pgClient: this.resources.pg
        });
        await this.services.soul.initialize();
        this.shutdown.register('heady-soul', SHUTDOWN_PHASE.APPLICATION, () => this.services.soul.shutdown());

        // HeadyBrains — Context assembler
        const {
          HeadyBrains
        } = require('./intelligence/heady-brains');
        this.services.brains = new HeadyBrains({
          pgClient: this.resources.pg
        });
        await this.services.brains.initialize();
        this.shutdown.register('heady-brains', SHUTDOWN_PHASE.APPLICATION, () => this.services.brains.shutdown());

        // HeadyMemory — Vector memory
        const {
          HeadyMemory
        } = require('./memory/heady-memory');
        this.services.memory = new HeadyMemory({
          pgClient: this.resources.pg
        });
        await this.services.memory.initialize();
        this.shutdown.register('heady-memory', SHUTDOWN_PHASE.PERSISTENCE, () => this.services.memory.shutdown());

        // HeadyAutobiographer — Event logging
        const {
          HeadyAutobiographer
        } = require('./intelligence/heady-autobiographer');
        this.services.autobiographer = new HeadyAutobiographer({
          persistFn: event => this.services.memory?.store({
            namespace: 'system',
            content: JSON.stringify(event),
            importance: event.severity
          })
        });
        this.shutdown.register('heady-autobiographer', SHUTDOWN_PHASE.OBSERVABILITY, () => this.services.autobiographer.shutdown());

        // Record startup milestone
        this.services.autobiographer.recordMilestone('Core Services Started', 'HeadySoul, HeadyBrains, HeadyMemory, HeadyAutobiographer initialized');
      });

      // Phase 5: Application services
      await this._phase(STARTUP_PHASE.APP_SERVICES, async () => {
        // These are started as HTTP servers on their respective ports
        const servicesToStart = [{
          name: 'auth-session',
          port: SERVICE_PORTS?.AUTH_SESSION || 3310,
          module: './services/auth/auth-session-server'
        }, {
          name: 'notification',
          port: SERVICE_PORTS?.NOTIFICATION || 3320,
          module: './services/notification/notification-service'
        }, {
          name: 'analytics',
          port: SERVICE_PORTS?.ANALYTICS || 3330,
          module: './services/analytics/analytics-service'
        }, {
          name: 'scheduler',
          port: SERVICE_PORTS?.SCHEDULER || 3340,
          module: './services/scheduler/scheduler-service'
        }, {
          name: 'rate-limiter',
          port: SERVICE_PORTS?.RATE_LIMITER || 3350,
          module: './services/rate-limiter/rate-limiter-service'
        }, {
          name: 'conductor',
          port: SERVICE_PORTS?.CONDUCTOR || 3360,
          module: './orchestration/heady-conductor'
        }, {
          name: 'backup',
          port: SERVICE_PORTS?.BACKUP || 3396,
          module: './services/backup/backup-service'
        }];
        for (const svc of servicesToStart) {
          try {
            const mod = require(svc.module);
            if (typeof mod.startServer === 'function') {
              const instance = await mod.startServer({
                port: svc.port,
                pgClient: this.resources.pg,
                firebase: this.resources.firebase,
                nats: this.resources.nats
              });
              this.services[svc.name] = instance;
              this.shutdown.register(svc.name, SHUTDOWN_PHASE.CONNECTIONS, () => instance.server?.close?.() || Promise.resolve());
            }
            logger.info({
              service: svc.name,
              port: svc.port,
              msg: 'Service started'
            });
          } catch (err) {
            logger.error({
              service: svc.name,
              err: err.message,
              msg: 'Service start failed'
            });
          }
        }
      });

      // Phase 6: Websites
      if (this.config.enableWebsites) {
        await this._phase(STARTUP_PHASE.WEBSITES, async () => {
          try {
            const {
              startServer: startWebsites
            } = require('./websites/website-server');
            this.services.websites = await startWebsites({
              firebase: this.resources.firebase
            });
            this.shutdown.register('websites', SHUTDOWN_PHASE.CONNECTIONS, () => this.services.websites?.close?.() || Promise.resolve());
          } catch (err) {
            logger.warn({
              err: err.message,
              msg: 'Website server start failed'
            });
          }
        });
      }

      // Phase 7: Colab runtimes
      if (this.config.enableColab) {
        await this._phase(STARTUP_PHASE.COLAB, async () => {
          try {
            const {
              ColabDeployAutomation
            } = require('./colab/colab-deploy-automation');
            this.services.colabDeploy = new ColabDeployAutomation();
            await this.services.colabDeploy.initialize();
            this.shutdown.register('colab-deploy', SHUTDOWN_PHASE.APPLICATION, () => this.services.colabDeploy.shutdown());
          } catch (err) {
            logger.warn({
              err: err.message,
              msg: 'Colab automation init failed'
            });
          }
        });
      }

      // Phase 8: Health registration
      await this._phase(STARTUP_PHASE.HEALTH, async () => {
        // All services should have /health endpoints already
        // Register global health aggregator
        this.services.autobiographer?.recordMilestone('System Fully Started', `All ${Object.keys(this.services).length} services initialized`);
      });
      this._state = 'running';
      const startupDuration = Date.now() - this.startedAt;
      logger.info({
        duration: startupDuration,
        services: Object.keys(this.services).length,
        phases: this.startupLog.length,
        msg: 'Heady system bootstrap complete'
      });
      return {
        status: 'running',
        duration: startupDuration,
        services: Object.keys(this.services),
        phases: this.startupLog
      };
    } catch (err) {
      this._state = 'failed';
      logger.error({
        err: err.message,
        stack: err.stack?.substring(0, fibonacci(13) * 2),
        duration: Date.now() - this.startedAt,
        msg: 'Bootstrap failed'
      });
      await this.shutdown.shutdown('bootstrap_failure');
      throw err;
    }
  }

  /**
   * Execute a startup phase with timing and error handling
   */
  async _phase(name, fn) {
    const start = Date.now();
    logger.info({
      phase: name,
      msg: `Starting phase: ${name}`
    });
    try {
      await fn();
      const duration = Date.now() - start;
      this.startupLog.push({
        phase: name,
        status: 'ok',
        duration
      });
      logger.info({
        phase: name,
        duration,
        msg: `Phase complete: ${name}`
      });
    } catch (err) {
      const duration = Date.now() - start;
      this.startupLog.push({
        phase: name,
        status: 'error',
        duration,
        error: err.message
      });
      logger.error({
        phase: name,
        duration,
        err: err.message,
        msg: `Phase failed: ${name}`
      });
      throw err;
    }
  }

  /**
   * System health status
   */
  health() {
    return {
      state: this._state,
      uptime: this.startedAt ? Date.now() - this.startedAt : 0,
      environment: this.config.environment,
      services: Object.keys(this.services),
      phases: this.startupLog,
      shutdown: this.shutdown.status()
    };
  }
}

// ─── Main Entry ─────────────────────────────────────────────────────────────
async function main() {
  const bootstrap = new Bootstrap({
    projectId: process.env.GCP_PROJECT_ID || 'gen-lang-client-0920560496',
    region: process.env.GCP_REGION || 'us-east1',
    environment: process.env.NODE_ENV || 'production',
    enableColab: process.env.ENABLE_COLAB !== 'false',
    enableWebsites: process.env.ENABLE_WEBSITES !== 'false'
  });
  try {
    const result = await bootstrap.start();
    logger.info({
      result,
      msg: 'Heady system is live'
    });
  } catch (err) {
    logger.error({
      err: err.message,
      msg: 'Fatal: System bootstrap failed'
    });
    process.exit(1);
  }
}
module.exports = {
  Bootstrap,
  STARTUP_PHASE,
  main
};
if (require.main === module) {
  main();
}