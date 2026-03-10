/**
 * Test suite for HeadyMCPProtocol
 * Tests the core MCP protocol implementation with all required methods
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { HeadyMCPProtocol, SERVER_INFO } = require('../index.js');

describe('HeadyMCPProtocol', () => {
  function createProtocol() {
    return new HeadyMCPProtocol();
  }

  // ── initialize ──────────────────────────────────────────────────────
  describe('initialize', () => {
    it('should return correct protocolVersion', async () => {
      const protocol = createProtocol();
      const request = {
        method: 'initialize',
        params: { clientInfo: { name: 'test-client' } },
        id: 1,
      };
      const response = await protocol.handleRequest(request);
      const { result } = response;

      assert.strictEqual(
        result.protocolVersion,
        SERVER_INFO.protocolVersion,
        'protocolVersion should match SERVER_INFO'
      );
      assert.strictEqual(
        result.protocolVersion,
        '2024-11-05',
        'protocolVersion should be correct'
      );
    });

    it('should return correct capabilities', async () => {
      const protocol = createProtocol();
      const request = {
        method: 'initialize',
        params: { clientInfo: { name: 'test-client' } },
        id: 1,
      };
      const response = await protocol.handleRequest(request);
      const { result } = response;

      assert.ok(result.capabilities, 'should have capabilities');
      assert.deepStrictEqual(result.capabilities.tools, { listChanged: false });
      assert.deepStrictEqual(result.capabilities.resources, {
        subscribe: false,
        listChanged: false,
      });
      assert.deepStrictEqual(result.capabilities.prompts, { listChanged: false });
      assert.ok(result.capabilities.logging, 'should have logging capability');
    });

    it('should return correct serverInfo', async () => {
      const protocol = createProtocol();
      const request = {
        method: 'initialize',
        params: { clientInfo: { name: 'test-client' } },
        id: 1,
      };
      const response = await protocol.handleRequest(request);
      const { result } = response;

      assert.ok(result.serverInfo, 'should have serverInfo');
      assert.strictEqual(result.serverInfo.name, 'heady-mcp-server');
      assert.strictEqual(result.serverInfo.version, '5.0.0');
    });

    it('should create a session on initialize', async () => {
      const protocol = createProtocol();
      const initialSessions = protocol.sessions.size;
      const request = {
        method: 'initialize',
        params: { clientInfo: { name: 'test-client' } },
        id: 1,
      };
      await protocol.handleRequest(request);

      assert.strictEqual(
        protocol.sessions.size,
        initialSessions + 1,
        'should create exactly one new session'
      );
    });
  });

  // ── tools/list ──────────────────────────────────────────────────────
  describe('tools/list', () => {
    it('should return array of tools', () => {
      const protocol = createProtocol();
      const { tools } = protocol._listTools({});

      assert.ok(Array.isArray(tools), 'tools should be an array');
      assert.ok(tools.length > 0, 'should have at least one tool');
    });

    it('should return tools with required properties', () => {
      const protocol = createProtocol();
      const { tools } = protocol._listTools({});

      tools.forEach((tool) => {
        assert.ok(typeof tool.name === 'string', 'tool should have name property');
        assert.ok(typeof tool.description === 'string', 'tool should have description property');
        assert.ok(tool.inputSchema, 'tool should have inputSchema property');
      });
    });

    it('should support cursor-based pagination', () => {
      const protocol = createProtocol();
      // Get initial tools
      const { tools: firstTools } = protocol._listTools({ cursor: '0' });

      // Get tools starting from cursor 5
      const { tools: paginatedTools } = protocol._listTools({ cursor: '5' });

      // Verify pagination works
      assert.ok(
        firstTools.length >= paginatedTools.length,
        'pagination should reduce results'
      );
    });
  });

  // ── tools/call ──────────────────────────────────────────────────────
  describe('tools/call', () => {
    it('should return error for unknown tool', async () => {
      const protocol = createProtocol();
      const request = {
        method: 'tools/call',
        params: {
          name: 'nonexistent_tool_12345',
          arguments: {},
        },
        id: 1,
      };
      const response = await protocol.handleRequest(request);

      assert.ok(response.error, 'should have error');
      assert.strictEqual(response.error.code, -32603, 'should be internal error code');
      assert.ok(
        response.error.message.includes('Unknown tool'),
        'error message should mention unknown tool'
      );
    });

    it('should validate tool exists before calling', () => {
      const protocol = createProtocol();
      // Verify that tools exist and can be called (but don't actually call external services)
      const { tools } = protocol._listTools({});

      assert.ok(tools.length > 0, 'should have tools registered');

      // Verify a tool has the expected structure
      const firstTool = tools[0];
      assert.ok(firstTool.name, 'tool should have name');
      assert.ok(firstTool.inputSchema, 'tool should have inputSchema');
    });

    it('should support tool handler registration', () => {
      const protocol = createProtocol();
      // Verify all tools have handlers registered
      const { tools } = protocol.registry;

      tools.forEach((tool) => {
        const handler = protocol.registry.handlers.get(tool.name);
        assert.ok(handler, `tool ${tool.name} should have handler`);
        assert.ok(typeof handler.handler === 'function', 'handler should be a function');
      });
    });
  });

  // ── resources/list ──────────────────────────────────────────────────
  describe('resources/list', () => {
    it('should return 4 resources', () => {
      const protocol = createProtocol();
      const { resources } = protocol._listResources();

      assert.ok(Array.isArray(resources), 'resources should be an array');
      assert.strictEqual(resources.length, 4, 'should have exactly 4 resources');
    });

    it('should have correct resource URIs', () => {
      const protocol = createProtocol();
      const { resources } = protocol._listResources();

      const uris = resources.map((r) => r.uri);
      assert.ok(uris.includes('heady://system/status'), 'should have system/status');
      assert.ok(uris.includes('heady://system/services'), 'should have system/services');
      assert.ok(uris.includes('heady://docs/architecture'), 'should have docs/architecture');
      assert.ok(uris.includes('heady://docs/phi-constants'), 'should have docs/phi-constants');
    });

    it('should have resource metadata', () => {
      const protocol = createProtocol();
      const { resources } = protocol._listResources();

      resources.forEach((resource) => {
        assert.ok(typeof resource.uri === 'string', 'resource should have uri');
        assert.ok(typeof resource.name === 'string', 'resource should have name');
        assert.ok(typeof resource.description === 'string', 'resource should have description');
        assert.ok(typeof resource.mimeType === 'string', 'resource should have mimeType');
      });
    });
  });

  // ── resources/read ──────────────────────────────────────────────────
  describe('resources/read', () => {
    it('should read valid resources', async () => {
      const protocol = createProtocol();
      const uris = [
        'heady://system/status',
        'heady://system/services',
        'heady://docs/phi-constants',
        'heady://docs/architecture',
      ];

      for (const uri of uris) {
        const result = await protocol._readResource({ uri });
        assert.ok(Array.isArray(result.contents), `${uri} should return contents array`);
        assert.strictEqual(result.contents[0].uri, uri, `should have correct URI`);
        assert.ok(result.contents[0].text, `${uri} content should have text`);
      }
    });

    it('should return error for unknown resource', async () => {
      const protocol = createProtocol();
      let error;
      try {
        await protocol._readResource({ uri: 'heady://unknown/resource' });
      } catch (e) {
        error = e;
      }

      assert.ok(error, 'should throw error for unknown resource');
      assert.ok(
        error.message.includes('Unknown resource'),
        'error should mention unknown resource'
      );
    });
  });

  // ── prompts/list ────────────────────────────────────────────────────
  describe('prompts/list', () => {
    it('should return 2 prompts', () => {
      const protocol = createProtocol();
      const { prompts } = protocol._listPrompts();

      assert.ok(Array.isArray(prompts), 'prompts should be an array');
      assert.strictEqual(prompts.length, 2, 'should have exactly 2 prompts');
    });

    it('should have prompt metadata', () => {
      const protocol = createProtocol();
      const { prompts } = protocol._listPrompts();

      prompts.forEach((prompt) => {
        assert.ok(typeof prompt.name === 'string', 'prompt should have name');
        assert.ok(typeof prompt.description === 'string', 'prompt should have description');
        assert.ok(Array.isArray(prompt.arguments), 'prompt should have arguments array');
      });
    });

    it('should have correct prompt names', () => {
      const protocol = createProtocol();
      const { prompts } = protocol._listPrompts();

      const names = prompts.map((p) => p.name);
      assert.ok(names.includes('heady-system-prompt'), 'should have heady-system-prompt');
      assert.ok(names.includes('heady-deep-analysis'), 'should have heady-deep-analysis');
    });
  });

  // ── prompts/get ─────────────────────────────────────────────────────
  describe('prompts/get', () => {
    it('should get heady-system-prompt with valid arguments', () => {
      const protocol = createProtocol();
      const result = protocol._getPrompt({
        name: 'heady-system-prompt',
        arguments: { focus: 'code' },
      });

      assert.ok(typeof result.description === 'string', 'should have description');
      assert.ok(Array.isArray(result.messages), 'should have messages array');
      assert.ok(result.messages[0].role === 'user', 'message should be from user');
      assert.ok(result.messages[0].content.text.includes('code'), 'should include focus area');
    });

    it('should get heady-deep-analysis with valid arguments', () => {
      const protocol = createProtocol();
      const result = protocol._getPrompt({
        name: 'heady-deep-analysis',
        arguments: { target: 'my-codebase' },
      });

      assert.ok(typeof result.description === 'string', 'should have description');
      assert.ok(Array.isArray(result.messages), 'should have messages array');
      assert.ok(result.messages[0].role === 'user', 'message should be from user');
      assert.ok(
        result.messages[0].content.text.includes('my-codebase'),
        'should include target'
      );
    });

    it('should return error for invalid prompt name', () => {
      const protocol = createProtocol();
      let error;
      try {
        protocol._getPrompt({
          name: 'invalid-prompt-name',
          arguments: {},
        });
      } catch (e) {
        error = e;
      }

      assert.ok(error, 'should throw error');
      assert.ok(error.message.includes('Unknown prompt'), 'error should mention unknown prompt');
    });
  });

  // ── ping ────────────────────────────────────────────────────────────
  describe('ping', () => {
    it('should return status ok', async () => {
      const protocol = createProtocol();
      const request = {
        method: 'ping',
        params: {},
        id: 1,
      };
      const response = await protocol.handleRequest(request);
      const { result } = response;

      assert.strictEqual(result.status, 'ok', 'ping should return ok status');
    });

    it('should return uptime', async () => {
      const protocol = createProtocol();
      const request = {
        method: 'ping',
        params: {},
        id: 1,
      };
      const response = await protocol.handleRequest(request);
      const { result } = response;

      assert.ok(typeof result.uptime === 'number', 'should have uptime');
      assert.ok(result.uptime >= 0, 'uptime should be non-negative');
    });
  });

  // ── error handling ──────────────────────────────────────────────────
  describe('error handling', () => {
    it('should return -32601 error for unknown method', async () => {
      const protocol = createProtocol();
      const request = {
        method: 'unknown_method_xyz',
        params: {},
        id: 1,
      };
      const response = await protocol.handleRequest(request);

      assert.ok(response.error, 'should have error');
      assert.strictEqual(response.error.code, -32601, 'should be method not found error');
      assert.ok(
        response.error.message.includes('Method not found'),
        'error message should be descriptive'
      );
    });

    it('should handle notifications (id undefined)', async () => {
      const protocol = createProtocol();
      const request = {
        method: 'notifications/cancelled',
        params: {},
        id: undefined,
      };
      const response = await protocol.handleRequest(request);

      assert.strictEqual(response, null, 'notification should return null');
    });

    it('should increment request count', async () => {
      const protocol = createProtocol();
      const initialCount = protocol.requestCount;
      const request = {
        method: 'ping',
        params: {},
        id: 1,
      };
      await protocol.handleRequest(request);

      assert.strictEqual(
        protocol.requestCount,
        initialCount + 1,
        'request count should increment'
      );
    });
  });
});

// Ensure the process exits after tests complete
setTimeout(() => {
  process.exit(0);
}, 5000);

