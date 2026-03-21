/**
 * Heady™ Colab Runtime Bridge v6.0
 * WebSocket bridge between Docker mesh and 3 Colab Pro+ runtimes
 * Port 3392 — Bidirectional task routing, heartbeat, and result streaming
 * 
 * @author Eric Haywood — HeadySystems Inc.
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

const http = require('http');
const crypto = require('crypto');
const {
  createLogger
} = require('../../shared/logger');
const {
  HealthProbe
} = require('../../shared/health');
const {
  PHI,
  PSI,
  fib,
  phiBackoffWithJitter,
  CSL_THRESHOLDS,
  SERVICE_PORTS,
  COLAB_RUNTIMES,
  TIMING,
  POOL_SIZES,
  EMBEDDING_DIM
} = require('../../shared/phi-math');
const logger = createLogger('colab-bridge');
const PORT = SERVICE_PORTS.HEADY_COLAB_BRIDGE || 3392;

// ═══════════════════════════════════════════════════════════
// CONFIGURATION — Phi-Scaled
// ═══════════════════════════════════════════════════════════

const BRIDGE_CONFIG = {
  heartbeatIntervalMs: fib(8) * 1000,
  // 21s heartbeat
  heartbeatTimeoutMs: fib(10) * 1000,
  // 55s timeout
  maxConcurrentTasks: fib(9),
  // 34 concurrent tasks
  taskTimeoutMs: fib(13) * 1000,
  // 233s task timeout
  resultBufferSize: fib(12),
  // 144 buffered results
  reconnectMaxAttempts: fib(7),
  maxMessageSize: fib(20) * 1024,
  // ~6.9MB max message
  pingPongIntervalMs: fib(7) * 1000 // 13s ping interval
};

// ═══════════════════════════════════════════════════════════
// RUNTIME CONNECTION STATE
// ═══════════════════════════════════════════════════════════

class RuntimeConnection {
  constructor(runtimeId, runtimeConfig) {
    this.id = runtimeId;
    this.config = runtimeConfig;
    this.ws = null;
    this.connected = false;
    this.lastHeartbeat = 0;
    this.pendingTasks = new Map();
    this.completedTasks = 0;
    this.failedTasks = 0;
    this.reconnectAttempts = 0;
    this.gpuUtilization = 0;
    this.memoryUtilization = 0;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
  }
  updateMetrics(metrics) {
    this.gpuUtilization = metrics.gpuUtilization || 0;
    this.memoryUtilization = metrics.memoryUtilization || 0;
    this.lastHeartbeat = Date.now();
  }
  isHealthy() {
    if (!this.connected) return false;
    const timeSinceHeartbeat = Date.now() - this.lastHeartbeat;
    return timeSinceHeartbeat < BRIDGE_CONFIG.heartbeatTimeoutMs;
  }
  getLoad() {
    return this.pendingTasks.size / BRIDGE_CONFIG.maxConcurrentTasks;
  }
  getStatus() {
    return {
      id: this.id,
      connected: this.connected,
      healthy: this.isHealthy(),
      pendingTasks: this.pendingTasks.size,
      completedTasks: this.completedTasks,
      failedTasks: this.failedTasks,
      gpuUtilization: this.gpuUtilization,
      memoryUtilization: this.memoryUtilization,
      lastHeartbeat: this.lastHeartbeat,
      load: this.getLoad()
    };
  }
}

// ═══════════════════════════════════════════════════════════
// COLAB BRIDGE SERVER
// ═══════════════════════════════════════════════════════════

class ColabBridge {
  constructor() {
    this.runtimes = new Map();
    this.taskQueue = [];
    this.resultBuffer = new Map();
    this.server = null;
    this.wsConnections = new Map();
    this.taskCounter = 0;
    this.health = new HealthProbe('colab-bridge');

    // Initialize runtime connections
    for (const [id, config] of Object.entries(COLAB_RUNTIMES || {})) {
      this.runtimes.set(id, new RuntimeConnection(id, config));
    }

    // Fallback if COLAB_RUNTIMES not defined in phi-math
    if (this.runtimes.size === 0) {
      const defaultRuntimes = {
        alpha: {
          name: 'Runtime Alpha',
          role: 'inference',
          gpu: 'A100',
          tunnelPort: 8501
        },
        beta: {
          name: 'Runtime Beta',
          role: 'memory',
          gpu: 'A100',
          tunnelPort: 8502
        },
        gamma: {
          name: 'Runtime Gamma',
          role: 'training',
          gpu: 'A100',
          tunnelPort: 8503
        }
      };
      for (const [id, config] of Object.entries(defaultRuntimes)) {
        this.runtimes.set(id, new RuntimeConnection(id, config));
      }
    }
  }
  async start() {
    this.server = http.createServer((req, res) => this._handleHttp(req, res));

    // WebSocket upgrade handling
    this.server.on('upgrade', (req, socket, head) => {
      this._handleUpgrade(req, socket, head);
    });
    return new Promise(resolve => {
      this.server.listen(PORT, () => {
        logger.info({
          message: 'Colab Bridge started',
          port: PORT,
          runtimes: this.runtimes.size
        });
        this.health.markReady();
        resolve();
      });
    });
  }

  // ═══════════════════════════════════════════════════════════
  // HTTP API — Task submission and status
  // ═══════════════════════════════════════════════════════════

  _handleHttp(req, res) {
    const url = new URL(req.url, `http://0.0.0.0:${PORT}`);
    const routes = {
      'GET /health': () => this._respondJson(res, 200, this.getHealth()),
      'GET /status': () => this._respondJson(res, 200, this.getStatus()),
      'POST /task': () => this._handleTaskSubmission(req, res),
      'GET /task/:id': () => this._handleTaskStatus(req, res, url),
      'GET /results/:id': () => this._handleTaskResult(req, res, url),
      'POST /connect/:runtimeId': () => this._handleRuntimeConnect(req, res, url)
    };

    // Route matching
    const method = req.method;
    const path = url.pathname;
    if (method === 'GET' && path === '/health') return routes['GET /health']();
    if (method === 'GET' && path === '/status') return routes['GET /status']();
    if (method === 'POST' && path === '/task') return routes['POST /task']();
    if (method === 'GET' && path.startsWith('/task/')) return this._handleTaskStatus(req, res, url);
    if (method === 'GET' && path.startsWith('/results/')) return this._handleTaskResult(req, res, url);
    this._respondJson(res, 404, {
      error: 'Not found'
    });
  }
  async _handleTaskSubmission(req, res) {
    const body = await this._readBody(req);
    const task = JSON.parse(body);
    const taskId = `task-${Date.now()}-${crypto.randomBytes(fib(5)).toString('hex')}`;

    // CSL-scored runtime selection
    const runtime = this._selectRuntime(task);
    if (!runtime) {
      this._respondJson(res, 503, {
        error: 'No healthy runtime available',
        taskId
      });
      return;
    }
    const taskRecord = {
      id: taskId,
      type: task.type,
      payload: task.payload,
      runtime: runtime.id,
      status: 'queued',
      submittedAt: Date.now(),
      result: null
    };

    // Send to runtime via WebSocket
    if (runtime.connected && runtime.ws) {
      try {
        runtime.ws.send(JSON.stringify({
          type: 'task',
          taskId,
          taskType: task.type,
          payload: task.payload
        }));
        taskRecord.status = 'running';
        runtime.pendingTasks.set(taskId, taskRecord);

        // Task timeout
        setTimeout(() => {
          if (runtime.pendingTasks.has(taskId)) {
            runtime.pendingTasks.delete(taskId);
            runtime.failedTasks++;
            taskRecord.status = 'timeout';
            this.resultBuffer.set(taskId, taskRecord);
          }
        }, BRIDGE_CONFIG.taskTimeoutMs);
      } catch (error) {
        taskRecord.status = 'failed';
        taskRecord.error = error.message;
      }
    } else {
      // Queue for when runtime reconnects
      this.taskQueue.push(taskRecord);
      taskRecord.status = 'queued';
    }
    this.taskCounter++;
    this._respondJson(res, 202, {
      taskId,
      status: taskRecord.status,
      runtime: runtime.id
    });
  }
  _selectRuntime(task) {
    const taskRole = task.type || 'general';
    let bestRuntime = null;
    let bestScore = -1;
    for (const [, runtime] of this.runtimes) {
      if (!runtime.isHealthy()) continue;

      // CSL-scored selection
      let score = 1.0;

      // Role affinity
      if (runtime.config.role === taskRole) {
        score *= PHI; // Boost for role match
      }

      // Load penalty (lower load = higher score)
      score *= 1 - runtime.getLoad() * PSI;

      // GPU utilization penalty
      score *= 1 - runtime.gpuUtilization * PSI * PSI;
      if (score > bestScore) {
        bestScore = score;
        bestRuntime = runtime;
      }
    }
    return bestRuntime;
  }
  _handleTaskStatus(req, res, url) {
    const taskId = url.pathname.split('/').pop();

    // Check pending tasks across runtimes
    for (const [, runtime] of this.runtimes) {
      const task = runtime.pendingTasks.get(taskId);
      if (task) {
        this._respondJson(res, 200, {
          taskId,
          status: task.status,
          runtime: runtime.id
        });
        return;
      }
    }

    // Check result buffer
    const result = this.resultBuffer.get(taskId);
    if (result) {
      this._respondJson(res, 200, {
        taskId,
        status: result.status,
        hasResult: !!result.result
      });
      return;
    }
    this._respondJson(res, 404, {
      error: 'Task not found',
      taskId
    });
  }
  _handleTaskResult(req, res, url) {
    const taskId = url.pathname.split('/').pop();
    const result = this.resultBuffer.get(taskId);
    if (!result) {
      this._respondJson(res, 404, {
        error: 'Result not found',
        taskId
      });
      return;
    }
    this._respondJson(res, 200, result);
  }

  // ═══════════════════════════════════════════════════════════
  // WEBSOCKET — Colab runtime connections
  // ═══════════════════════════════════════════════════════════

  _handleUpgrade(req, socket, head) {
    const url = new URL(req.url, `http://0.0.0.0:${PORT}`);
    const runtimeId = url.searchParams.get('runtime');
    const authToken = url.searchParams.get('token');
    if (!runtimeId || !this.runtimes.has(runtimeId)) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    // WebSocket handshake
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }
    const acceptKey = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-5AB5DC587235').digest('base64');
    socket.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${acceptKey}`, '', ''].join('\r\n'));
    const runtime = this.runtimes.get(runtimeId);
    runtime.ws = socket;
    runtime.connected = true;
    runtime.lastHeartbeat = Date.now();
    runtime.reconnectAttempts = 0;
    logger.info({
      message: 'Colab runtime connected',
      runtimeId,
      role: runtime.config.role
    });

    // Start heartbeat
    runtime.heartbeatTimer = setInterval(() => {
      if (runtime.connected) {
        try {
          this._sendWsFrame(socket, JSON.stringify({
            type: 'ping',
            timestamp: Date.now()
          }));
        } catch {
          this._handleRuntimeDisconnect(runtimeId);
        }
      }
    }, BRIDGE_CONFIG.heartbeatIntervalMs);

    // Handle incoming messages
    let buffer = Buffer.alloc(0);
    socket.on('data', data => {
      buffer = Buffer.concat([buffer, data]);
      // Simple WebSocket frame parsing
      while (buffer.length >= 2) {
        const parsed = this._parseWsFrame(buffer);
        if (!parsed) break;
        buffer = parsed.remaining;
        this._handleRuntimeMessage(runtimeId, parsed.payload);
      }
    });
    socket.on('close', () => this._handleRuntimeDisconnect(runtimeId));
    socket.on('error', err => {
      logger.error({
        message: 'WebSocket error',
        runtimeId,
        error: err.message
      });
      this._handleRuntimeDisconnect(runtimeId);
    });

    // Drain queued tasks
    this._drainQueueToRuntime(runtimeId);
  }
  _handleRuntimeMessage(runtimeId, messageStr) {
    try {
      const msg = JSON.parse(messageStr);
      const runtime = this.runtimes.get(runtimeId);
      if (!runtime) return;
      switch (msg.type) {
        case 'pong':
          runtime.lastHeartbeat = Date.now();
          break;
        case 'heartbeat':
          runtime.updateMetrics(msg.metrics || {});
          break;
        case 'task_result':
          {
            const task = runtime.pendingTasks.get(msg.taskId);
            if (task) {
              task.status = 'completed';
              task.result = msg.result;
              task.completedAt = Date.now();
              runtime.pendingTasks.delete(msg.taskId);
              runtime.completedTasks++;

              // Buffer result for retrieval
              this.resultBuffer.set(msg.taskId, task);
              this._trimResultBuffer();
              logger.info({
                message: 'Task completed',
                taskId: msg.taskId,
                runtime: runtimeId,
                durationMs: task.completedAt - task.submittedAt
              });
            }
            break;
          }
        case 'task_error':
          {
            const failedTask = runtime.pendingTasks.get(msg.taskId);
            if (failedTask) {
              failedTask.status = 'failed';
              failedTask.error = msg.error;
              runtime.pendingTasks.delete(msg.taskId);
              runtime.failedTasks++;
              this.resultBuffer.set(msg.taskId, failedTask);
              logger.error({
                message: 'Task failed on runtime',
                taskId: msg.taskId,
                runtime: runtimeId,
                error: msg.error
              });
            }
            break;
          }
        case 'metrics':
          runtime.updateMetrics(msg);
          break;
        default:
          logger.debug({
            message: 'Unknown runtime message type',
            type: msg.type,
            runtime: runtimeId
          });
      }
    } catch (error) {
      logger.error({
        message: 'Failed to parse runtime message',
        runtime: runtimeId,
        error: error.message
      });
    }
  }
  _handleRuntimeDisconnect(runtimeId) {
    const runtime = this.runtimes.get(runtimeId);
    if (!runtime) return;
    runtime.connected = false;
    runtime.ws = null;
    if (runtime.heartbeatTimer) {
      clearInterval(runtime.heartbeatTimer);
      runtime.heartbeatTimer = null;
    }

    // Re-queue pending tasks
    for (const [taskId, task] of runtime.pendingTasks) {
      task.status = 'queued';
      task.runtime = null;
      this.taskQueue.push(task);
    }
    runtime.pendingTasks.clear();
    logger.warn({
      message: 'Colab runtime disconnected',
      runtimeId,
      requeuedTasks: this.taskQueue.length
    });
  }
  _drainQueueToRuntime(runtimeId) {
    const runtime = this.runtimes.get(runtimeId);
    if (!runtime || !runtime.connected) return;
    while (this.taskQueue.length > 0 && runtime.pendingTasks.size < BRIDGE_CONFIG.maxConcurrentTasks) {
      const task = this.taskQueue.shift();
      task.runtime = runtimeId;
      task.status = 'running';
      runtime.pendingTasks.set(task.id, task);
      try {
        runtime.ws.send(JSON.stringify({
          type: 'task',
          taskId: task.id,
          taskType: task.type,
          payload: task.payload
        }));
      } catch (error) {
        task.status = 'queued';
        this.taskQueue.unshift(task);
        break;
      }
    }
  }
  _trimResultBuffer() {
    while (this.resultBuffer.size > BRIDGE_CONFIG.resultBufferSize) {
      const firstKey = this.resultBuffer.keys().next().value;
      this.resultBuffer.delete(firstKey);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // WEBSOCKET FRAME HELPERS
  // ═══════════════════════════════════════════════════════════

  _sendWsFrame(socket, data) {
    const payload = Buffer.from(data);
    let header;
    if (payload.length < 126) {
      header = Buffer.alloc(2);
      header[0] = 0x81; // text frame, FIN
      header[1] = payload.length;
    } else if (payload.length < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 126;
      header.writeUInt16BE(payload.length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(payload.length), 2);
    }
    socket.write(Buffer.concat([header, payload]));
  }
  _parseWsFrame(buffer) {
    if (buffer.length < 2) return null;
    const secondByte = buffer[1];
    const masked = (secondByte & 0x80) !== 0;
    let payloadLength = secondByte & 0x7f;
    let offset = 2;
    if (payloadLength === 126) {
      if (buffer.length < 4) return null;
      payloadLength = buffer.readUInt16BE(2);
      offset = 4;
    } else if (payloadLength === 127) {
      if (buffer.length < 10) return null;
      payloadLength = Number(buffer.readBigUInt64BE(2));
      offset = 10;
    }
    let maskKey = null;
    if (masked) {
      if (buffer.length < offset + 4) return null;
      maskKey = buffer.slice(offset, offset + 4);
      offset += 4;
    }
    if (buffer.length < offset + payloadLength) return null;
    let payload = buffer.slice(offset, offset + payloadLength);
    if (masked && maskKey) {
      for (let i = 0; i < payload.length; i++) {
        payload[i] ^= maskKey[i % 4];
      }
    }
    return {
      payload: payload.toString('utf8'),
      remaining: buffer.slice(offset + payloadLength)
    };
  }

  // ═══════════════════════════════════════════════════════════
  // HEALTH & STATUS
  // ═══════════════════════════════════════════════════════════

  getHealth() {
    const runtimeStatuses = {};
    let healthyCount = 0;
    for (const [id, runtime] of this.runtimes) {
      runtimeStatuses[id] = runtime.getStatus();
      if (runtime.isHealthy()) healthyCount++;
    }
    return {
      status: healthyCount > 0 ? 'healthy' : 'degraded',
      runtimes: runtimeStatuses,
      healthyRuntimes: healthyCount,
      totalRuntimes: this.runtimes.size,
      queuedTasks: this.taskQueue.length,
      bufferedResults: this.resultBuffer.size,
      totalTasksProcessed: this.taskCounter
    };
  }
  getStatus() {
    return this.getHealth();
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  _respondJson(res, statusCode, data) {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json'
    });
    res.end(JSON.stringify(data));
  }
  _readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString()));
      req.on('error', reject);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // SHUTDOWN
  // ═══════════════════════════════════════════════════════════

  async shutdown() {
    logger.info({
      message: 'Colab Bridge shutting down'
    });
    for (const [, runtime] of this.runtimes) {
      if (runtime.heartbeatTimer) clearInterval(runtime.heartbeatTimer);
      if (runtime.ws) {
        try {
          runtime.ws.destroy();
        } catch {}
      }
    }
    if (this.server) {
      await new Promise(resolve => this.server.close(resolve));
    }
    logger.info({
      message: 'Colab Bridge shut down cleanly'
    });
  }
}

// ═══════════════════════════════════════════════════════════
// STANDALONE STARTUP
// ═══════════════════════════════════════════════════════════

if (require.main === module) {
  const bridge = new ColabBridge();
  bridge.start().catch(err => {
    logger.error({
      message: 'Bridge startup failed',
      error: err.message
    });
    process.exit(1);
  });
  process.on('SIGTERM', async () => {
    await bridge.shutdown();
    process.exit(0);
  });
  process.on('SIGINT', async () => {
    await bridge.shutdown();
    process.exit(0);
  });
}
module.exports = {
  ColabBridge
};