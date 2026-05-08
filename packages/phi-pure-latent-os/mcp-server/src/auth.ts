/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * OAuth 2.1 authentication for MCP server via mcp-auth.
 * @module mcp-server/src/auth
 */

import { MCPAuth, fetchServerConfig } from 'mcp-auth';
import type { Express } from 'express';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('mcp-auth');

export async function configureMcpAuth(app: Express) {
  const authIssuer = process.env.MCP_AUTH_ISSUER;
  if (!authIssuer) {
    logger.warn('MCP_AUTH_ISSUER not set — MCP auth disabled');
    return;
  }

  const resourceUrl = process.env.MCP_RESOURCE_URL || 'https://headymcp.com/mcp';

  const authServerConfig = await fetchServerConfig(authIssuer, { type: 'oidc' });

  const mcpAuth = new MCPAuth({
    protectedResources: {
      metadata: {
        resource: resourceUrl,
        authorizationServers: [authServerConfig],
        scopesSupported: ['read', 'write', 'admin'],
      },
    },
  });

  // Expose RFC 9728 protected resource metadata at /.well-known
  app.use(mcpAuth.protectedResourceMetadataRouter());

  // Protect /mcp endpoints with JWT bearer auth
  app.use('/mcp', mcpAuth.bearerAuth('jwt', {
    resource: resourceUrl,
    requiredScopes: ['read'],
  }));

  logger.info({ resourceUrl, issuer: authIssuer }, 'MCP OAuth 2.1 configured');
}
