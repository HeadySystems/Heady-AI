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

function setupUnifiedMCP(app, { obs, auth } = {}) {
    logger.info('Initializing Unified Heady™ MCP Server (Secure Mode)...');

    // 1. Create the logic server
    const server = createMCPServer();

    // 2. Create the SSE transport bridge
    const transport = new McpSseTransport({
        server: server, // Inject the logic server
        baseUrl: process.env.ORIGIN_BASE || 'https://api.headyio.com'
    });

    // 3. Define Auth Middleware (Internal/Admin only)
    const requireMcpAuth = (req, res, next) => {
        // Skip auth for OPTIONS or if disabled in dev
        if (req.method === 'OPTIONS') return next();
        if (process.env.NODE_ENV === 'development' && process.env.DISABLE_MCP_AUTH === 'true') return next();

        // Check for JWT in Authorization header or x-heady-key
        const token = req.headers['authorization']?.split(' ')[1] || req.headers['x-heady-key'];
        
        if (!token || !auth) {
            return res.status(401).json({ error: 'Authentication required for MCP gateway' });
        }

        try {
            const user = auth.verifyToken(token);
            if (!user) throw new Error('Invalid token');
            req.user = user;
            next();
        } catch (e) {
            return res.status(403).json({ error: 'Forbidden: Invalid MCP access token' });
        }
    };

    // 4. Mount on /mcp
    // We apply auth only to the actual transport routes
    app.use('/mcp', requireMcpAuth, transport.router);

    logger.info('Unified MCP Server mounted on /mcp (Secure + Traced)');
    
    return { server, transport };
}

module.exports = { setupUnifiedMCP };
