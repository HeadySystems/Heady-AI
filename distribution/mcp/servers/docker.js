// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: distribution/mcp/servers/docker.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * MCP Tool: Docker
 * List containers, view logs, start/stop containers.
 */
const name = 'docker';
const description = 'Docker operations: list containers, logs, start, stop, inspect';

const schema = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['list', 'logs', 'start', 'stop', 'inspect', 'images'] },
    container_id: { type: 'string' },
    tail: { type: 'number', default: 100 },
  },
  required: ['action'],
};

const { execSync, execFileSync } = require('child_process');

// Validate container IDs: only allow alphanumeric, hyphens, underscores, dots, and colons
function sanitizeContainerId(id) {
  const safe = String(id).replace(/[^a-zA-Z0-9_.\-:]/g, '');
  if (safe !== id) throw new Error('Invalid container ID: contains unsafe characters');
  return safe;
}

async function handler(params) {
  try {
    switch (params.action) {
      case 'list': return { containers: JSON.parse(execSync('docker ps --format json -a', { encoding: 'utf-8' }).split('\n').filter(Boolean).map(l => JSON.parse(l))) };
      case 'logs': {
        if (!params.container_id) return { error: 'container_id required' };
        const tail = String(parseInt(params.tail, 10) || 100);
        const cid = sanitizeContainerId(params.container_id);
        return { logs: execFileSync('docker', ['logs', '--tail', tail, cid], { encoding: 'utf-8' }) };
      }
      case 'start': {
        if (!params.container_id) return { error: 'container_id required' };
        const cid = sanitizeContainerId(params.container_id);
        execFileSync('docker', ['start', cid]);
        return { ok: true, message: `Started ${cid}` };
      }
      case 'stop': {
        if (!params.container_id) return { error: 'container_id required' };
        const cid = sanitizeContainerId(params.container_id);
        execFileSync('docker', ['stop', cid]);
        return { ok: true, message: `Stopped ${cid}` };
      }
      case 'inspect': {
        if (!params.container_id) return { error: 'container_id required' };
        const cid = sanitizeContainerId(params.container_id);
        return JSON.parse(execFileSync('docker', ['inspect', cid], { encoding: 'utf-8' }));
      }
      case 'images': return { images: execSync('docker images --format "{{.Repository}}:{{.Tag}} {{.Size}}"', { encoding: 'utf-8' }).trim().split('\n') };
      default: return { error: `Unknown action: ${params.action}` };
    }
  } catch (err) { return { error: err.message }; }
}

module.exports = { name, description, schema, handler };
