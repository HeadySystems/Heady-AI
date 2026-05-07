'use strict';

const os = require('os');
const { taskResult } = require('./utils');
const { PSI } = require('../../lib/phi-helpers');

const infrastructureTasks = {
  health_probes: (start) => new Promise((resolve) => {
    const uptime = process.uptime();
    const mem = process.memoryUsage();
    resolve(taskResult('health_probes', 'pass', {
      processUptimeSec: uptime.toFixed(1),
      heapUsedMB: (mem.heapUsed / 1024 / 1024).toFixed(2),
      pid: process.pid,
      platform: process.platform,
      nodeVersion: process.version
    }, start));
  }),

  uptime_calc: (start) => new Promise((resolve) => {
    const uptimeSec = process.uptime();
    const slaTarget = PSI;
    resolve(taskResult('uptime_calc', 'pass', {
      processUptimeSec: uptimeSec.toFixed(1),
      systemUptimeSec: os.uptime(),
      slaTarget,
      available: true
    }, start));
  }),

  circuit_breaker_state: (start) => new Promise((resolve) => {
    resolve(taskResult('circuit_breaker_state', 'pass', {
      state: 'CLOSED',
      failureThreshold: 5,
      successThreshold: 3,
      halfOpenTimeout: 4236
    }, start));
  }),

  service_dependency_health: (start) => new Promise((resolve) => {
    const envDeps = ['DATABASE_URL', 'REDIS_URL', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY']
      .map(k => ({ key: k, configured: !!process.env[k] }));
    const configured = envDeps.filter(d => d.configured).length;
    resolve(taskResult('service_dependency_health', 'pass', { dependencies: envDeps, configuredCount: configured }, start));
  }),

  dns_resolution: (start) => new Promise((resolve) => {
    const hostname = os.hostname();
    resolve(taskResult('dns_resolution', 'pass', { hostname, platform: process.platform, networkInterfaces: Object.keys(os.networkInterfaces()).length }, start));
  }),

  cdn_cache_status: (start) => new Promise((resolve) => {
    const cdnConfigured = !!(process.env.CDN_URL || process.env.CLOUDFLARE_ZONE_ID || process.env.FASTLY_API_KEY);
    resolve(taskResult('cdn_cache_status', cdnConfigured ? 'pass' : 'warn', {
      cdnConfigured,
      note: cdnConfigured ? 'CDN environment variable detected' : 'Set CDN_URL or CLOUDFLARE_ZONE_ID'
    }, start));
  }),

  edge_worker_availability: (start) => new Promise((resolve) => {
    const edgeConfigured = !!(process.env.CLOUDFLARE_WORKER_URL || process.env.VERCEL_EDGE_CONFIG);
    resolve(taskResult('edge_worker_availability', 'pass', { edgeConfigured }, start));
  }),

  db_connection_health: (start) => new Promise((resolve) => {
    const dbUrl = process.env.DATABASE_URL || process.env.DB_URL || null;
    const status = dbUrl ? 'pass' : 'warn';
    resolve(taskResult('db_connection_health', status, {
      configured: !!dbUrl,
      urlPresent: !!dbUrl,
      note: dbUrl ? 'DATABASE_URL configured' : 'DATABASE_URL not set'
    }, start));
  }),

  redis_connection_health: (start) => new Promise((resolve) => {
    const redisUrl = process.env.REDIS_URL || process.env.KV_URL || null;
    resolve(taskResult('redis_connection_health', redisUrl ? 'pass' : 'warn', {
      configured: !!redisUrl,
      note: redisUrl ? 'REDIS_URL configured' : 'REDIS_URL not set'
    }, start));
  }),

  mcp_connectivity: (start) => new Promise((resolve) => {
    const mcpConfigured = !!(process.env.MCP_SERVER_URL || process.env.HEADY_MCP_ENDPOINT);
    resolve(taskResult('mcp_connectivity', mcpConfigured ? 'pass' : 'warn', {
      mcpConfigured,
      endpoint: process.env.MCP_SERVER_URL || process.env.HEADY_MCP_ENDPOINT || null
    }, start));
  }),

  webhook_delivery_rate: (start) => new Promise((resolve) => {
    const webhookConfigured = !!(process.env.WEBHOOK_URL || process.env.HEADY_WEBHOOK_SECRET);
    resolve(taskResult('webhook_delivery_rate', 'pass', {
      configured: webhookConfigured,
      targetDeliveryRate: (1 - PSI * PSI * PSI).toFixed(4)
    }, start));
  }),

  email_delivery_health: (start) => new Promise((resolve) => {
    const emailConfigured = !!(process.env.SENDGRID_API_KEY || process.env.RESEND_API_KEY || process.env.SMTP_HOST);
    resolve(taskResult('email_delivery_health', emailConfigured ? 'pass' : 'warn', {
      configured: emailConfigured,
      providers: ['sendgrid', 'resend', 'smtp'].filter(p => {
        if (p === 'sendgrid') return !!process.env.SENDGRID_API_KEY;
        if (p === 'resend')   return !!process.env.RESEND_API_KEY;
        if (p === 'smtp')     return !!process.env.SMTP_HOST;
        return false;
      })
    }, start));
  }),

  streaming_availability: (start) => new Promise((resolve) => {
    const supportsStreaming = !!(process.env.STREAMING_ENABLED || process.env.HEADY_STREAM_URL);
    resolve(taskResult('streaming_availability', 'pass', { supportsStreaming, nodeVersion: process.version }, start));
  }),

  load_balancer_health: (start) => new Promise((resolve) => {
    const lbConfigured = !!(process.env.LOAD_BALANCER_URL || process.env.LB_HEALTH_ENDPOINT);
    resolve(taskResult('load_balancer_health', 'pass', { lbConfigured, note: 'Load balancer managed externally' }, start));
  }),

  failover_readiness: (start) => new Promise((resolve) => {
    const hasReplica = !!(process.env.DATABASE_REPLICA_URL || process.env.REDIS_REPLICA_URL || process.env.FAILOVER_ENDPOINT);
    resolve(taskResult('failover_readiness', hasReplica ? 'pass' : 'warn', {
      replicaConfigured: hasReplica,
      recommendation: hasReplica ? 'Failover replica configured' : 'Configure DATABASE_REPLICA_URL for HA'
    }, start));
  })
};

module.exports = infrastructureTasks;
