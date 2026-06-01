const fs = require('fs');
const path = require('path');

const HEADY_ROOT = '/home/headyme/Heady';

const localServers = {
  'heady-mcp': {
    command: 'node',
    args: [`${HEADY_ROOT}/mcp-servers/heady-mcp-server.js`],
    description:
      'Core Heady MCP Server — 45 tools for status, config, security, deploy, latent space',
  },
  'heady-liquid-nodes': {
    command: 'node',
    args: [`${HEADY_ROOT}/mcp-servers/liquid-nodes-mcp-server.js`],
    description: 'Liquid Nodes — GitHub, Cloudflare, Vertex AI, Colab, Latent Space connectors',
  },
  'heady-orchestration': {
    command: 'node',
    args: [`${HEADY_ROOT}/mcp-servers/heady-orchestration-mcp-server.js`],
    description: 'Orchestration — Swarms, Bees, CSL routing, Pipelines, Task Graphs',
  },
  'heady-intelligence': {
    command: 'node',
    args: [`${HEADY_ROOT}/mcp-servers/heady-intelligence-mcp-server.js`],
    description: 'Intelligence — Battle Arena, Monte Carlo, Patterns, AutoContext, ORS',
  },
  'heady-memory': {
    command: 'node',
    args: [`${HEADY_ROOT}/mcp-servers/heady-memory-mcp-server.js`],
    description: 'Memory — 3-tier (T0/T1/T2), 384D vectors, φ-decay consolidation',
  },
  'heady-governance': {
    command: 'node',
    args: [`${HEADY_ROOT}/mcp-servers/heady-governance-mcp-server.js`],
    description: 'Governance — Policies, Cost Tracking, RBAC, Audit, Story Driver',
  },
  'heady-unified': {
    command: 'node',
    args: [`${HEADY_ROOT}/mcp-servers/heady-unified-mcp-server.js`],
    description: 'Unified — Message Bus, Service Mesh, Ecosystem, Evolution Engine',
  },
};

const remoteServers = {
  'heady-mcp-remote': {
    transport: 'streamable-http',
    url: 'https://headymcp.com/mcp',
    headers: {
      Authorization: 'Bearer ${HEADY_API_KEY}',
    },
    description: 'Remote Heady MCP Server Stream',
  },
};

const localConfigPaths = [
  '.mcp.json',
  'configs/claude-desktop-mcp-config.json',
  'distribution/ide/windsurf/mcp-config.json',
  'services/heady-mcp-server/cursor.json',
  'services/heady-mcp-server/heady-code.json',
  'services/heady-mcp-server/mcp-configs/cursor.json',
  'services/heady-mcp-server/mcp-configs/heady-code.json',
];

const remoteConfigPaths = [
  'services/heady-mcp-server/remote-http.json',
  'services/heady-mcp-server/mcp-configs/remote-http.json',
  'services/heady-mcp-server/heady-desktop.json',
  'services/heady-mcp-server/mcp-configs/heady-desktop.json',
];

function updateConfig(filePath, newServers) {
  const fullPath = path.join(HEADY_ROOT, filePath);
  if (fs.existsSync(fullPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      data.mcpServers = { ...newServers };
      fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
      console.log(`Updated ${filePath}`);
    } catch (e) {
      console.error(`Failed to parse/update ${filePath}: ${e.message}`);
    }
  } else {
    console.log(`File not found, skipping: ${filePath}`);
  }
}

// Update Local configs
localConfigPaths.forEach((p) => updateConfig(p, localServers));

// Update Remote configs
remoteConfigPaths.forEach((p) => {
  // We should preserve non-heady ones like filesystem if they exist
  const fullPath = path.join(HEADY_ROOT, p);
  if (fs.existsSync(fullPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

      // Preserve filesystem if it exists
      const newMcpServers = { ...remoteServers };
      if (data.mcpServers && data.mcpServers.filesystem) {
        newMcpServers.filesystem = data.mcpServers.filesystem;
      }

      data.mcpServers = newMcpServers;
      fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
      console.log(`Updated remote ${p}`);
    } catch (e) {
      console.error(`Failed to parse/update ${p}: ${e.message}`);
    }
  }
});
