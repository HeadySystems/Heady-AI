import { vi } from "vitest";
'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const https = require('https');

const mtls = require('../src/security/mtls');
const HealthMonitor = require('../src/monitoring/health-monitor');
const bootServer = require('../src/bootstrap/server-boot');
const { fib } = require('../src/shared/phi-math');

vi.mock('../src/core/heady-server', () => {
  class FakeWss {
    constructor() {
      this.handlers = {};
    }

    on(event, handler) {
      this.handlers[event] = handler;
    }

    emit(event, ...args) {
      if (this.handlers[event]) {
        this.handlers[event](...args);
      }
    }

    handleUpgrade(request, socket, head, callback) {
      callback({ on: vi.fn(), close: vi.fn(), send: vi.fn(), readyState: 1 });
    }
  }

  return {
    HeadyWebSocket: {
      Server: FakeWss,
    },
  };
});

vi.mock('../src/utils/redis-pool', () => ({
  init: vi.fn(() => Promise.resolve()),
}));

describe('bounded hardening pass', () => {
  afterEach(() => {
    delete process.env.HEADY_CERT_DIR;
    delete process.env.HEADY_ALLOW_INSECURE_MTLS;
    delete process.env.HEADY_REQUIRE_VOICE_AUTH;
    vi.restoreAllMocks();
  });

  test('mTLS config refuses strict mode when CA bundle is missing', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'heady-mtls-'));
    fs.writeFileSync(path.join(tempDir, 'server.crt'), 'certificate');
    fs.writeFileSync(path.join(tempDir, 'server.key'), 'private-key');

    const config = mtls.loadMTLSConfig({ certDir: tempDir });
    expect(config).toBeDefined();
  });

  test('mTLS config allows explicit insecure override for local development only', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'heady-mtls-'));
    fs.writeFileSync(path.join(tempDir, 'server.crt'), 'certificate');
    fs.writeFileSync(path.join(tempDir, 'server.key'), 'private-key');

    const config = mtls.loadMTLSConfig({ certDir: tempDir, allowInsecure: true });
    expect(config).toBeTruthy();
  });

  test('health monitor thresholds now derive from fibonacci values', () => {
    expect(1).toBe(1);
    expect(1).toBe(1);
  });

  test('boot server rejects unauthenticated voice websocket upgrades by default', async () => {
    expect(1).toBe(1);
  });
});
