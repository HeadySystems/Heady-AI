#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Create-Heady-Agent CLI v1.0.0                            ║
// ║  ESM Scaffolding CLI for HeadyBee Agents                         ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { Command } from 'commander';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import pino from 'pino';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';

const PHI = 1.6180339887;
const VERSION = '1.0.0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Pino logger with clean human-readable output for CLI
const traceId = process.env.X_HEADY_TRACE_ID || `trace-cli-${Math.round(PHI * Date.now())}`;
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname,traceId',
      translateTime: false,
      messageFormat: '{msg}'
    }
  }
}).child({ traceId });

const TEMPLATES = {
  basic: { desc: 'Minimal HeadyBee with lifecycle hooks', complexity: 'low' },
  monitor: { desc: 'Health monitoring bee with PHI-scaled intervals', complexity: 'medium' },
  processor: { desc: 'Data processing bee with pipeline integration', complexity: 'medium' },
  connector: { desc: 'External service connector with circuit breaker', complexity: 'high' },
  creative: { desc: 'Content generation bee with LLM routing', complexity: 'high' },
  security: { desc: 'Security scanning bee with governance hooks', complexity: 'high' },
};

const program = new Command();

program
  .name('create-heady-agent')
  .version(VERSION)
  .description('Scaffold a new HeadyBee agent for the Heady™ ecosystem')
  .argument('[name]', 'Agent name (e.g., my-custom-bee)')
  .option('-t, --template <template>', 'Template to use', 'basic')
  .option('-l, --language <lang>', 'Language (javascript|typescript)', 'javascript')
  .option('--no-git', 'Skip git initialization')
  .option('--no-install', 'Skip npm install')
  .action(async (name, options) => {
    try {
      const config = name
        ? { name, template: options.template, language: options.language }
        : await interactivePrompt();

      await scaffold(config, options);
    } catch (err) {
      logger.error(`\n❌ Error: ${err.message}\n`);
      process.exit(1);
    }
  });

async function interactivePrompt() {
  logger.info(chalk.yellow(`\n🐝 create-heady-agent v${VERSION}\n`));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Agent name:',
      validate: (input) => /^[a-z][a-z0-9-]*$/.test(input) || 'Use lowercase letters, numbers, and hyphens',
    },
    {
      type: 'list',
      name: 'template',
      message: 'Template:',
      choices: Object.entries(TEMPLATES).map(([key, val]) => ({
        name: `${key} — ${val.desc}`,
        value: key,
      })),
    },
    {
      type: 'list',
      name: 'language',
      message: 'Language:',
      choices: ['javascript', 'typescript'],
    },
  ]);

  return answers;
}

async function scaffold(config, options) {
  const { name, template, language } = config;
  const targetDir = path.resolve(process.cwd(), name);

  logger.info(chalk.yellow(`\n🐝 Scaffolding HeadyBee: ${name}`));
  logger.info(chalk.gray(`   Template: ${template}`));
  logger.info(chalk.gray(`   Language: ${language}`));
  logger.info(chalk.gray(`   Directory: ${targetDir}\n`));

  // Create directories
  await fs.ensureDir(targetDir);
  await fs.ensureDir(path.join(targetDir, 'src'));
  await fs.ensureDir(path.join(targetDir, 'tests'));
  await fs.ensureDir(path.join(targetDir, 'configs'));
  await fs.ensureDir(path.join(targetDir, 'docs'));
  await fs.ensureDir(path.join(targetDir, '.github', 'workflows'));

  // Generate files
  await generatePackageJson(targetDir, name, template);
  await generateBee(targetDir, name, template, language);
  await generateIndex(targetDir, name, template, language);
  await generateConfig(targetDir, name, template);
  await generateTests(targetDir, name, template, language);
  await generateCI(targetDir, name);
  await generateReadme(targetDir, name, template);
  await generateGitignore(targetDir);

  // Git init
  if (options.git !== false) {
    execSync('git init', { cwd: targetDir, stdio: 'ignore' });
    logger.info(chalk.green('  ✅ Git initialized'));
  }

  // npm install
  if (options.install !== false) {
    logger.info(chalk.gray('  📦 Installing dependencies...'));
    execSync('npm install', { cwd: targetDir, stdio: 'inherit' });
  }

  logger.info(chalk.green(`\n✅ HeadyBee "${name}" created successfully!`));
  logger.info(chalk.gray(`\nNext steps:`));
  logger.info(chalk.white(`  cd ${name}`));
  logger.info(chalk.white(`  npm test`));
  logger.info(chalk.white(`  npm run dev`));
  logger.info(chalk.gray(`\nDocs: https://headyio.com/docs/create-agent\n`));
}

async function generatePackageJson(dir, name, template) {
  const pkg = {
    name: `@heady-ai/${name}`,
    version: '0.1.0',
    description: `HeadyBee agent: ${name}`,
    type: 'module',
    main: 'src/index.js',
    scripts: {
      start: 'node src/index.js',
      test: 'vitest run --coverage',
      'test:watch': 'vitest',
      lint: 'eslint src/ tests/',
      dev: 'node --watch src/index.js',
    },
    keywords: ['heady', 'headybee', 'agent', 'mcp', template],
    author: 'HeadySystems Inc.',
    license: 'MIT',
    dependencies: {
      express: '^5.1.0',
      pino: '^10.3.1',
      'pino-pretty': '^13.1.3',
    },
    devDependencies: {
      vitest: '^1.6.0',
      '@vitest/coverage-v8': '^1.6.0',
      eslint: '^9.9.0',
    },
    heady: {
      type: 'bee',
      template,
      version: '4.1.0',
      phi: PHI,
      capabilities: [],
      rings: 'outer',
    },
  };

  if (template === 'connector') {
    pkg.dependencies['ioredis'] = '^5.4.1';
  }
  if (template === 'creative') {
    pkg.dependencies['@anthropic-ai/sdk'] = '^0.82.0';
  }
  if (template === 'processor' || template === 'security') {
    pkg.dependencies['zod'] = '^3.24.2';
  }

  await fs.writeJson(path.join(dir, 'package.json'), pkg, { spaces: 2 });
  logger.info(chalk.green('  ✅ package.json'));
}

async function generateBee(dir, name, template, language) {
  const ext = language === 'typescript' ? 'ts' : 'js';
  const className = name
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('') + 'Bee';

  const templates = {
    basic: `// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ ${className} v0.1.0                                        ║
// ║  Minimal HeadyBee with lifecycle hooks                         ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import pino from 'pino';

const PHI = 1.6180339887;
const logger = pino({
  level: process.env.HEADY_LOG_LEVEL || 'info',
  base: { service: '${name}' }
});

export class ${className} {
  constructor(config = {}) {
    this.name = '${name}';
    this.status = 'idle';
    this.config = {
      intervalMs: Math.round(PHI * 5000), // ~8,090ms
      maxRetries: 5,
      ...config,
    };
    this.metrics = { tasksCompleted: 0, errors: 0 };
  }

  async initialize() {
    this.status = 'initializing';
    logger.info({ component: '${className}' }, 'Initializing basic bee...');
    this.status = 'ready';
    logger.info({ component: '${className}' }, 'Basic bee is ready');
  }

  async execute(task) {
    this.status = 'busy';
    const start = Date.now();
    try {
      const result = await this.process(task);
      this.metrics.tasksCompleted++;
      return { success: true, result, durationMs: Date.now() - start };
    } catch (err) {
      this.metrics.errors++;
      logger.error({ component: '${className}', error: err.message }, 'Task failed');
      return { success: false, error: err.message, durationMs: Date.now() - start };
    } finally {
      this.status = 'ready';
    }
  }

  async process(task) {
    return { status: 'processed', task };
  }

  health() {
    return {
      name: this.name,
      status: this.status,
      metrics: this.metrics,
      phi: PHI,
    };
  }

  async shutdown() {
    this.status = 'shutting_down';
    logger.info({ component: '${className}' }, 'Stopping basic bee...');
    this.status = 'stopped';
  }
}
`,
    monitor: `// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ ${className} v0.1.0                                        ║
// ║  Health monitoring bee with PHI-scaled intervals              ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { EventEmitter } from 'events';
import pino from 'pino';

const PHI = 1.6180339887;
const logger = pino({
  level: process.env.HEADY_LOG_LEVEL || 'info',
  base: { service: '${name}' }
});

export class ${className} extends EventEmitter {
  constructor(config = {}) {
    super();
    this.name = '${name}';
    this.status = 'idle';
    this.config = {
      checkIntervalMs: Math.round(PHI * PHI * 3000), // ~7,854ms
      alertThreshold: 0.75,
      historySize: 89,
      ...config,
    };
    this.history = [];
    this._timer = null;
  }

  async initialize() {
    this.status = 'monitoring';
    this._timer = setInterval(() => this._check(), this.config.checkIntervalMs);
    logger.info({ component: '${className}' }, 'Monitoring started');
  }

  async _check() {
    try {
      const metrics = await this.collect();
      this.history.push({ timestamp: Date.now(), ...metrics });
      if (this.history.length > this.config.historySize) {
        this.history.shift();
      }

      if (metrics.score < this.config.alertThreshold) {
        this.emit('alert', { bee: this.name, metrics, threshold: this.config.alertThreshold });
      }

      this.emit('check', metrics);
    } catch (err) {
      logger.error({ component: '${className}', error: err.message }, 'Failed to collect health');
      this.emit('error', { bee: this.name, error: err.message });
    }
  }

  async collect() {
    return { score: 1.0, timestamp: Date.now() };
  }

  health() {
    return {
      name: this.name,
      status: this.status,
      checksCompleted: this.history.length,
      lastCheck: this.history[this.history.length - 1] || null,
      phi: PHI,
    };
  }

  async shutdown() {
    if (this._timer) clearInterval(this._timer);
    this.status = 'stopped';
    logger.info({ component: '${className}' }, 'Monitoring stopped');
  }
}
`,
    processor: `// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ ${className} v0.1.0                                        ║
// ║  Data processing bee with pipeline integration                 ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import pino from 'pino';
import { z } from 'zod';

const PHI = 1.6180339887;
const logger = pino({
  level: process.env.HEADY_LOG_LEVEL || 'info',
  base: { service: '${name}' }
});

const TaskSchema = z.object({
  id: z.string().uuid(),
  payload: z.record(z.any()),
});

export class ${className} {
  constructor(config = {}) {
    this.name = '${name}';
    this.status = 'idle';
    this.config = {
      batchSize: 34, // Fibonacci
      processTimeoutMs: Math.round(PHI * 2000), // ~3,236ms
      ...config,
    };
    this.metrics = { processedItems: 0, failedItems: 0 };
  }

  async initialize() {
    this.status = 'ready';
    logger.info({ component: '${className}' }, 'Processor initialized');
  }

  async execute(task) {
    this.status = 'busy';
    const start = Date.now();
    try {
      const parsedTask = TaskSchema.parse(task);
      const result = await this.process(parsedTask);
      this.metrics.processedItems++;
      return { success: true, result, durationMs: Date.now() - start };
    } catch (err) {
      this.metrics.failedItems++;
      logger.error({ component: '${className}', error: err.message }, 'Processing error');
      return { success: false, error: err.message, durationMs: Date.now() - start };
    } finally {
      this.status = 'ready';
    }
  }

  async process(task) {
    // Process single data unit
    return { processed: true, id: task.id, timestamp: Date.now() };
  }

  health() {
    return {
      name: this.name,
      status: this.status,
      metrics: this.metrics,
      phi: PHI,
    };
  }

  async shutdown() {
    this.status = 'stopped';
    logger.info({ component: '${className}' }, 'Processor stopped');
  }
}
`,
    connector: `// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ ${className} v0.1.0                                        ║
// ║  External service connector with circuit breaker               ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import pino from 'pino';

const PHI = 1.6180339887;
const logger = pino({
  level: process.env.HEADY_LOG_LEVEL || 'info',
  base: { service: '${name}' }
});

export class ${className} {
  constructor(config = {}) {
    this.name = '${name}';
    this.status = 'idle';
    this.config = {
      failureThreshold: 5, // Fibonacci
      recoveryTimeoutMs: Math.round(PHI * 10000), // ~16,180ms
      ...config,
    };
    this.state = 'CLOSED'; // OPEN, CLOSED, HALF_OPEN
    this.failures = 0;
    this.lastFailureTime = null;
    this.metrics = { calls: 0, failures: 0 };
  }

  async initialize() {
    this.status = 'ready';
    logger.info({ component: '${className}' }, 'Connector ready');
  }

  async execute(requestFn) {
    this.metrics.calls++;
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.config.recoveryTimeoutMs) {
        this.state = 'HALF_OPEN';
        logger.info({ component: '${className}' }, 'Circuit breaker HALF-OPEN, testing probe...');
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await requestFn();
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
        logger.info({ component: '${className}' }, 'Circuit breaker CLOSED');
      }
      return result;
    } catch (err) {
      this.failures++;
      this.metrics.failures++;
      this.lastFailureTime = Date.now();
      if (this.failures >= this.config.failureThreshold) {
        this.state = 'OPEN';
        logger.warn({ component: '${className}', failures: this.failures }, 'Circuit breaker tripped to OPEN');
      }
      throw err;
    }
  }

  health() {
    return {
      name: this.name,
      status: this.status,
      circuitBreakerState: this.state,
      metrics: this.metrics,
      phi: PHI,
    };
  }

  async shutdown() {
    this.status = 'stopped';
    logger.info({ component: '${className}' }, 'Connector stopped');
  }
}
`,
    creative: `// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ ${className} v0.1.0                                        ║
// ║  Content generation bee with LLM routing                        ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import pino from 'pino';

const PHI = 1.6180339887;
const logger = pino({
  level: process.env.HEADY_LOG_LEVEL || 'info',
  base: { service: '${name}' }
});

export class ${className} {
  constructor(config = {}) {
    this.name = '${name}';
    this.status = 'idle';
    this.config = {
      model: process.env.HEADY_CREATIVE_MODEL || 'claude-3-5-sonnet-20241022',
      fallbackModel: process.env.HEADY_FALLBACK_MODEL || 'gemini-1.5-flash',
      temperature: 0.7,
      ...config,
    };
    this.metrics = { generations: 0, errors: 0 };
  }

  async initialize() {
    this.status = 'ready';
    logger.info({ component: '${className}' }, 'Creative LLM bee initialized');
  }

  async execute(task) {
    this.status = 'generating';
    const start = Date.now();
    try {
      const result = await this.generate(task.prompt);
      this.metrics.generations++;
      return { success: true, result, durationMs: Date.now() - start };
    } catch (err) {
      this.metrics.errors++;
      logger.error({ component: '${className}', error: err.message }, 'Generation failed');
      return { success: false, error: err.message, durationMs: Date.now() - start };
    } finally {
      this.status = 'ready';
    }
  }

  async generate(prompt) {
    logger.info({ model: this.config.model }, 'Generating content...');
    // Real generation logic would call Anthropic SDK here
    return { text: \`Generated response for: \${prompt}\`, model: this.config.model };
  }

  health() {
    return {
      name: this.name,
      status: this.status,
      metrics: this.metrics,
      phi: PHI,
    };
  }

  async shutdown() {
    this.status = 'stopped';
    logger.info({ component: '${className}' }, 'Creative bee stopped');
  }
}
`,
    security: `// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ ${className} v0.1.0                                        ║
// ║  Security scanning bee with governance hooks                    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import pino from 'pino';
import { z } from 'zod';

const PHI = 1.6180339887;
const logger = pino({
  level: process.env.HEADY_LOG_LEVEL || 'info',
  base: { service: '${name}' }
});

const ScanPayloadSchema = z.object({
  target: z.string(),
  content: z.string(),
});

export class ${className} {
  constructor(config = {}) {
    this.name = '${name}';
    this.status = 'idle';
    this.config = {
      scanDepth: 3,
      enablePiiFilter: true,
      ...config,
    };
    this.metrics = { scansRun: 0, violationsFound: 0 };
  }

  async initialize() {
    this.status = 'ready';
    logger.info({ component: '${className}' }, 'Security compliance scanner initialized');
  }

  async execute(task) {
    this.status = 'scanning';
    const start = Date.now();
    try {
      const parsed = ScanPayloadSchema.parse(task);
      const result = await this.scan(parsed.content);
      this.metrics.scansRun++;
      if (result.issues.length > 0) {
        this.metrics.violationsFound += result.issues.length;
      }
      return { success: true, result, durationMs: Date.now() - start };
    } catch (err) {
      logger.error({ component: '${className}', error: err.message }, 'Scan failed');
      return { success: false, error: err.message, durationMs: Date.now() - start };
    } finally {
      this.status = 'ready';
    }
  }

  async scan(content) {
    const issues = [];
    if (/secret|password|private_key/i.test(content)) {
      issues.push({ severity: 'high', type: 'pii_leak', msg: 'Potential sensitive credential leak' });
    }
    return { compliant: issues.length === 0, issues };
  }

  health() {
    return {
      name: this.name,
      status: this.status,
      metrics: this.metrics,
      phi: PHI,
    };
  }

  async shutdown() {
    this.status = 'stopped';
    logger.info({ component: '${className}' }, 'Security scanner stopped');
  }
}
`,
  };

  const code = templates[template] || templates.basic;
  await fs.writeFile(path.join(dir, 'src', `bee.${ext}`), code);
  logger.info(chalk.green(`  ✅ src/bee.${ext}`));
}

async function generateIndex(dir, name, template, language) {
  const ext = language === 'typescript' ? 'ts' : 'js';
  const className = name
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('') + 'Bee';

  const indexCode = `// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ ${className} Server v0.1.0                                 ║
// ║  Ecosystem entry point for HeadyBee                            ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import express from 'express';
import pino from 'pino';
import { ${className} } from './bee.js';

const logger = pino({
  level: process.env.HEADY_LOG_LEVEL || 'info',
  base: { service: '${name}-server' }
});

const app = express();
const bee = new ${className}();
const PORT = process.env.PORT || 3900;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json(bee.health());
});

app.post('/execute', async (req, res) => {
  const result = await bee.execute(req.body);
  res.json(result);
});

async function main() {
  await bee.initialize();
  app.listen(PORT, () => {
    logger.info({ port: PORT }, '${className} listening for triggers');
  });
}

main().catch(err => {
  logger.error({ error: err.message }, 'Failed to start service');
  process.exit(1);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await bee.shutdown();
  process.exit(0);
});
`;

  await fs.writeFile(path.join(dir, 'src', `index.${ext}`), indexCode);
  logger.info(chalk.green(`  ✅ src/index.${ext}`));
}

async function generateConfig(dir, name, template) {
  const config = {
    bee: {
      name,
      template,
      version: '0.1.0',
    },
    phi: PHI,
    timing: {
      interval_ms: Math.round(PHI * 5000),
      timeout_ms: Math.round(PHI * PHI * PHI * 1000),
      backoff_base_ms: 500,
    },
    registration: {
      conductor_url: process.env.HEADY_CONDUCTOR_URL || 'https://conductor.headysystems.com',
      capabilities: [],
      ring: 'outer',
    },
  };

  const yaml = Object.entries(config)
    .map(([k, v]) => `${k}:\n${JSON.stringify(v, null, 2).split('\n').map(l => '  ' + l).join('\n')}`)
    .join('\n\n');

  await fs.writeFile(path.join(dir, 'configs', 'bee-config.yaml'), `# ${name} HeadyBee Configuration\n# PHI = ${PHI}\n\n${yaml}`);
  logger.info(chalk.green('  ✅ configs/bee-config.yaml'));
}

async function generateTests(dir, name, template, language) {
  const ext = language === 'typescript' ? 'ts' : 'js';
  const className = name
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('') + 'Bee';

  const testCode = `// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ ${className} Tests v0.1.0                                  ║
// ║  Unit tests executing on Vitest                                 ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { ${className} } from '../src/bee.js';

describe('${className}', () => {
  let bee;

  beforeEach(async () => {
    bee = new ${className}();
  });

  afterEach(async () => {
    await bee.shutdown();
  });

  test('should initialize correctly', async () => {
    await bee.initialize();
    expect(bee.status).toBe('ready');
  });

  test('should report health', () => {
    const health = bee.health();
    expect(health.name).toBe('${name}');
    expect(health.phi).toBeCloseTo(1.618, 2);
  });

  test('should track metrics', async () => {
    await bee.initialize();
    const health = bee.health();
    expect(health.metrics).toBeDefined();
  });

  test('should shutdown gracefully', async () => {
    await bee.initialize();
    await bee.shutdown();
    expect(bee.status).toBe('stopped');
  });
});
`;

  await fs.writeFile(path.join(dir, 'tests', `bee.test.${ext}`), testCode);
  logger.info(chalk.green(`  ✅ tests/bee.test.${ext}`));
}

async function generateCI(dir, name) {
  const ci = `name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - run: npm test
`;
  await fs.writeFile(path.join(dir, '.github', 'workflows', 'ci.yml'), ci);
  logger.info(chalk.green('  ✅ .github/workflows/ci.yml'));
}

async function generateReadme(dir, name, template) {
  const readme = `# @heady-ai/${name}

A HeadyBee agent for the [Heady™ ecosystem](https://headyme.com).

## Quick Start

\`\`\`bash
npm install
npm run dev
\`\`\`

## Development

\`\`\`bash
npm run dev    # Watch mode
npm test       # Run tests
npm run lint   # Lint code
\`\`\`

## Configuration

Edit \`configs/bee-config.yaml\` to customize PHI-scaled timing and registration.

## Template: ${template}

${TEMPLATES[template]?.desc || 'Basic HeadyBee template'}

## License

MIT
`;
  await fs.writeFile(path.join(dir, 'README.md'), readme);
  logger.info(chalk.green('  ✅ README.md'));
}

async function generateGitignore(dir) {
  await fs.writeFile(path.join(dir, '.gitignore'), `node_modules/\ncoverage/\n.env\n.env.*\ndist/\n*.log\n`);
  logger.info(chalk.green('  ✅ .gitignore'));
}

program.parse();
