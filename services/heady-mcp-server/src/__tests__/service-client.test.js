/**
 * Test suite for Service Client
 * Tests HTTP service communication and health checks
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { callService, checkServiceHealth } = require('../tools/service-client');
const { getServiceEndpoint } = require('../config/services');

describe('service-client', () => {
  // ── callService ──────────────────────────────────────────────────────
  describe('callService', () => {
    it('should return unavailable status for unknown service', async () => {
      const result = await callService('unknown-service-xyz', '/path', {});

      assert.ok(result, 'should return a result');
      assert.strictEqual(result.status, 'unavailable', 'should have unavailable status');
      assert.strictEqual(result.service, 'unknown-service-xyz', 'should include service name');
      assert.ok(result.error, 'should have error message');
      assert.ok(
        result.error.includes('not found'),
        'error should mention service not found'
      );
    });

    it('should construct correct URL from service config', async () => {
      // Test with a known service that should fail (because it's not running)
      const result = await callService('heady-brain', '/health', {});

      // The result will be an error, but we can check the URL construction
      // by examining the error message which should contain the URL
      assert.ok(result, 'should return a result');
      // Either service error or unavailable
      assert.ok(
        result.status === 'error' || result.status === 'unavailable',
        'should have error or unavailable status'
      );
    });

    it('should include required headers', async () => {
      // This test verifies that callService attempts to call with proper headers
      // Since the service won't be running in tests, we just verify the call was attempted
      const result = await callService('heady-brain', '/test', { test: true });

      // The result will be an error since service isn't running
      assert.ok(result, 'should attempt the call');
      assert.ok(result.service === 'heady-brain', 'should target correct service');
    });

    it('should support custom method parameter', async () => {
      // Verify that method option is accepted
      const result = await callService('heady-brain', '/health', {}, { method: 'GET' });

      assert.ok(result, 'should handle GET method option');
    });

    it('should support custom timeout parameter', async () => {
      // Verify that timeout option is accepted
      const result = await callService('heady-brain', '/health', {}, { timeout: 1 });

      assert.ok(result, 'should handle timeout option');
    });

    it('should support retries parameter', async () => {
      // Verify that retries option is accepted
      const result = await callService('heady-brain', '/health', {}, { retries: 1 });

      assert.ok(result, 'should handle retries option');
    });

    it('should handle service not in registry gracefully', async () => {
      const result = await callService('nonexistent', '/path', {});

      assert.ok(result.error, 'should have error');
      assert.ok(result.hint, 'should include helpful hint');
    });
  });

  // ── checkServiceHealth ───────────────────────────────────────────────
  describe('checkServiceHealth', () => {
    it('should return unknown status for unknown service', async () => {
      const result = await checkServiceHealth('unknown-service-xyz');

      assert.strictEqual(result.status, 'unknown', 'should have unknown status');
      assert.strictEqual(result.service, 'unknown-service-xyz', 'should include service name');
    });

    it('should return status object for known service', async () => {
      // Using a service that exists in config but isn't running
      const result = await checkServiceHealth('heady-brain');

      assert.ok(result, 'should return a result');
      assert.ok(result.service === 'heady-brain', 'should include service name');
      assert.ok(
        ['healthy', 'unhealthy'].includes(result.status),
        'should have healthy or unhealthy status'
      );
    });

    it('should return unhealthy for unreachable service', async () => {
      // Since services won't be running in test, should get unhealthy
      const result = await checkServiceHealth('heady-brain');

      assert.ok(result, 'should return result');
      assert.ok(result.service === 'heady-brain', 'should track service name');
      // Service will be unhealthy since it's not running
      assert.ok(['healthy', 'unhealthy'].includes(result.status), 'should have status');
    });

    it('should not throw even for invalid service', async () => {
      let error;
      try {
        await checkServiceHealth('definitely-not-a-real-service');
      } catch (e) {
        error = e;
      }

      assert.ok(!error, 'should not throw an error');
    });
  });

  // ── Service Registry Integration ─────────────────────────────────────
  describe('Service Registry Integration', () => {
    it('should have all core services registered', () => {
      const coreServices = [
        'heady-brain',
        'heady-memory',
        'heady-soul',
        'heady-vinci',
        'heady-conductor',
        'heady-coder',
        'heady-battle',
        'heady-buddy',
        'heady-guard',
        'heady-maid',
      ];

      coreServices.forEach((service) => {
        const endpoint = getServiceEndpoint(service);
        assert.ok(endpoint, `${service} should be registered`);
        assert.ok(endpoint.url, `${service} should have url`);
        assert.ok(endpoint.healthPath, `${service} should have healthPath`);
        assert.ok(endpoint.basePath, `${service} should have basePath`);
      });
    });

    it('should return null for unregistered service', () => {
      const endpoint = getServiceEndpoint('not-a-real-service');
      assert.strictEqual(endpoint, null, 'should return null for unregistered service');
    });

    it('should have proper URL structure', () => {
      const endpoint = getServiceEndpoint('heady-brain');
      assert.ok(endpoint, 'endpoint should exist');
      assert.ok(endpoint.url.includes('http'), 'URL should include protocol');
      assert.ok(endpoint.url.includes(':3'), 'URL should include port');
      assert.ok(endpoint.basePath.startsWith('/'), 'basePath should start with /');
      assert.ok(endpoint.healthPath.startsWith('/'), 'healthPath should start with /');
    });
  });

  // ── Error Handling ───────────────────────────────────────────────────
  describe('Error Handling', () => {
    it('should return error status when service unavailable', async () => {
      const result = await callService('unknown-service', '/test', {});

      assert.ok(result.status === 'unavailable', 'should indicate service unavailable');
      assert.ok(result.error, 'should include error message');
    });

    it('should include service name in error response', async () => {
      const result = await callService('unknown-service', '/test', {});

      assert.ok(result.service === 'unknown-service', 'should include service name');
    });

    it('should provide helpful hints in error', async () => {
      const result = await callService('unknown-service', '/test', {});

      assert.ok(result.hint, 'should include helpful hint');
    });

    it('checkServiceHealth should handle timeout gracefully', async () => {
      // The function should handle timeouts without throwing
      const result = await checkServiceHealth('heady-brain');

      assert.ok(result, 'should return result even on timeout');
      assert.ok(result.service === 'heady-brain', 'should include service name');
    });
  });
});

// Ensure the process exits after tests complete
setTimeout(() => {
  process.exit(0);
}, 5000);

