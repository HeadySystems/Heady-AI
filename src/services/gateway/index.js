/**
 * Gateway Service — Edge Entrypoint for Heady Latent OS
 * @module services/gateway
 */
'use strict';
const express = require('express');
const { createLogger } = require('../../utils/logger');
const logger = createLogger('gateway');
const crypto = require('crypto');

class GatewayService {
  constructor() {
    this.name = 'gateway-service';
    this.status = 'dormant';
    this.app = express();
    this.server = null;
    this.port = process.env.GATEWAY_PORT || 3000;
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
    // Trace ID injection for Latent OS observability
    this.app.use((req, res, next) => {
      req.traceId = req.headers['x-trace-id'] || crypto.randomUUID();
      res.setHeader('x-trace-id', req.traceId);
      next();
    });
  }

  setupRoutes() {
    this.app.get('/health', (req, res) => {
      res.status(200).json(this.health());
    });
    
    // Dynamic Swarm routing interceptor
    this.app.use('/api/swarm/:swarmName', (req, res) => {
      res.status(202).json({
        message: `Request routed to ${req.params.swarmName}`,
        traceId: req.traceId
      });
    });
  }

  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          this.status = 'active';
          logger.info({ port: this.port }, 'Gateway Service Edge listening');
          resolve();
        });
      } catch (err) {
        logger.error({ err }, 'Failed to start Gateway Service');
        reject(err);
      }
    });
  }

  async stop() {
    if (this.server) {
      await new Promise(resolve => this.server.close(resolve));
    }
    this.status = 'dormant';
    logger.info({}, 'Gateway Service stopped');
  }

  health() {
    return { status: this.status, port: this.port };
  }
}

module.exports = { GatewayService, gateway: new GatewayService() };
