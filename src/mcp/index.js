/**
 * src/mcp/index.js — Unified MCP Server Entrypoint
 * Unifies HeadyMCPServer (Logic) with McpSseTransport (HTTP/SSE)
 */
'use strict';

const express = require('express');
const { createMCPServer } = require('./heady-mcp-server');
const McpSseTransport = require('./mcp-sse-transport');
const { createLogger } = require('../utils/logger');

const logger = createLogger('mcp-unified');

function setupUnifiedMCP(app) {
    logger.info('Initializing Unified Heady™ MCP Server...');

    // 1. Create the logic server
    const server = createMCPServer();

    // 2. Create the SSE transport bridge
    const transport = new McpSseTransport({
        server: server, // Inject the logic server
        baseUrl: process.env.ORIGIN_BASE || 'https://api.headyio.com'
    });

    // 3. Mount on /mcp (as expected by Cloudflare Worker)
    // Note: heady-manager usually mounts routes on /api, but worker points to /mcp/sse
    app.use('/mcp', transport.router);

    logger.info('Unified MCP Server mounted on /mcp (SSE + Message)');
    
    return { server, transport };
}

module.exports = { setupUnifiedMCP };
