const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }),
});

// System-level logging aliases for HCFP pipeline callers
logger.logSystem = (msg, ...args) => logger.info({ component: 'system' }, msg, ...args);
logger.logBuild = (msg, ...args) => logger.info({ component: 'build' }, msg, ...args);
logger.logPipeline = (msg, ...args) => logger.info({ component: 'pipeline' }, msg, ...args);
logger.logLearn = (msg, ...args) => logger.info({ component: 'learning' }, msg, ...args);

// Add backward capability for components expecting createLogger
logger.createLogger = (name) => logger.child({ name });

module.exports = logger;