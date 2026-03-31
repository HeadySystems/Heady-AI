/**
 * backend/app.js — MCP Server entrypoint
 * Referenced by `npm run start:mcp` in package.json
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { HeadyMCPServer } = require('../src/mcp/heady-mcp-server.js');
const server = new HeadyMCPServer();
let buffer = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', async (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const request = JSON.parse(line);
      const response = await server.handleRequest(request);
      process.stdout.write(JSON.stringify(response) + '\n');
    } catch (e) {
      const errorResponse = server.jsonRpcError(null, -32700, 'Parse error');
      process.stdout.write(JSON.stringify(errorResponse) + '\n');
    }
  }
});

process.stderr.write(`Heady™ MCP Server v${server.manifest.version} started — ${server.manifest.total_services} tools available\n`);
