'use strict';
/**
 * Heady™ gRPC Client — inter-service RPC with health checking.
 * © 2026 HeadySystems Inc.
 */
const { getLogger } = require('./structured-logger');
const logger = getLogger('grpc-client');

class HeadyGrpcClient {
  constructor(opts = {}) {
    this.target = opts.target || 'localhost:50051';
    this.serviceName = opts.serviceName || 'HeadyService';
    this._client = null;
  }

  async connect() {
    try {
      const grpc = require('@grpc/grpc-js');
      const protoLoader = require('@grpc/proto-loader');
      const protoPath = opts.protoPath || require('path').join(__dirname, '..', '..', 'proto', 'heady.proto');
      const packageDef = protoLoader.loadSync(protoPath, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true });
      const proto = grpc.loadPackageDefinition(packageDef);
      this._client = new proto.heady[this.serviceName](this.target, grpc.credentials.createInsecure());
      logger.info('gRPC connected', { target: this.target, service: this.serviceName });
    } catch (err) {
      logger.warn('gRPC not available', { error: err.message });
    }
    return this;
  }

  async call(method, request) {
    if (!this._client || !this._client[method]) {
      throw new Error(`gRPC method ${method} not available`);
    }
    return new Promise((resolve, reject) => {
      this._client[method](request, (err, response) => {
        if (err) reject(err);
        else resolve(response);
      });
    });
  }
}

module.exports = { HeadyGrpcClient };
