/**
 * Heady Services Proto — gRPC-style service definitions
 * Type-safe service interfaces, request/response schemas, streaming
 * Author: Eric Haywood | All constants φ-derived | ESM only
 */
import { createHash } from 'crypto';
import { PHI, PSI, PSI2, phiThreshold, fibonacci } from '../shared/phi-math-v2.js';
import { cslGate } from '../shared/csl-engine-v2.js';

const MAX_SERVICES       = fibonacci(10);  // 55
const MAX_METHODS        = fibonacci(8);   // 21 per service
const MESSAGE_SIZE_LIMIT = fibonacci(16) * 1024; // 987KB

function sha256(input) { return createHash('sha256').update(String(input)).digest('hex'); }

const serviceDefinitions = new Map();
const messageTypes = new Map();
const metrics = { calls: 0, errors: 0, streams: 0 };

function defineMessage(name, fields) {
  const msg = {
    name, fields: fields.map((f, i) => ({
      name: f.name, type: f.type || 'string', number: f.number || i + 1,
      repeated: f.repeated || false, optional: f.optional || false,
      description: f.description || '',
    })),
    hash: sha256(name + JSON.stringify(fields)),
  };
  messageTypes.set(name, msg);
  return { defined: name, fields: msg.fields.length };
}

function defineService(name, methods) {
  if (serviceDefinitions.size >= MAX_SERVICES) return { error: 'max_services_reached' };
  if (methods.length > MAX_METHODS) return { error: 'too_many_methods', max: MAX_METHODS };

  const svc = {
    name,
    methods: methods.map(m => ({
      name: m.name,
      type: m.type || 'unary',
      inputType: m.inputType || 'Empty',
      outputType: m.outputType || 'Empty',
      description: m.description || '',
      timeout: m.timeout || fibonacci(13) * 1000,
      deprecated: m.deprecated || false,
    })),
    version: 1,
    hash: sha256(name + JSON.stringify(methods)),
    defined: Date.now(),
  };
  serviceDefinitions.set(name, svc);
  return { defined: name, methods: svc.methods.length };
}

function callMethod(serviceName, methodName, request) {
  const svc = serviceDefinitions.get(serviceName);
  if (!svc) return { error: 'service_not_found' };
  const method = svc.methods.find(m => m.name === methodName);
  if (!method) return { error: 'method_not_found' };

  const inputMsg = messageTypes.get(method.inputType);
  if (inputMsg) {
    const validation = validateMessage(inputMsg, request);
    if (!validation.valid) return { error: 'invalid_request', details: validation.errors };
  }

  const payloadSize = JSON.stringify(request).length;
  const sizeGate = cslGate(1.0, 1.0 - (payloadSize / MESSAGE_SIZE_LIMIT), phiThreshold(2), PSI * PSI * PSI);
  if (payloadSize > MESSAGE_SIZE_LIMIT && sizeGate < PSI2) {
    return { error: 'message_too_large', size: payloadSize, limit: MESSAGE_SIZE_LIMIT };
  }

  metrics.calls++;
  return {
    service: serviceName, method: methodName, type: method.type,
    request: sha256(JSON.stringify(request)),
    response: { status: 'OK', timestamp: Date.now() },
    hash: sha256(serviceName + methodName + Date.now()),
  };
}

function validateMessage(msgDef, data) {
  const errors = [];
  for (const field of msgDef.fields) {
    if (!field.optional && (data[field.name] === undefined || data[field.name] === null)) {
      errors.push({ field: field.name, error: 'required' });
    }
    if (data[field.name] !== undefined) {
      if (field.repeated && !Array.isArray(data[field.name])) {
        errors.push({ field: field.name, error: 'expected_array' });
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

function getServiceDescriptor(name) {
  const svc = serviceDefinitions.get(name);
  if (!svc) return null;
  return {
    ...svc,
    methods: svc.methods.map(m => ({
      ...m,
      inputSchema: messageTypes.get(m.inputType) || null,
      outputSchema: messageTypes.get(m.outputType) || null,
    })),
  };
}

function listServices() {
  return [...serviceDefinitions.entries()].map(([name, svc]) => ({
    name, methods: svc.methods.length, version: svc.version,
  }));
}

function generateProtoText() {
  const lines = ['syntax = "proto3";', '', 'package heady.services;', ''];
  for (const [, msg] of messageTypes) {
    lines.push('message ' + msg.name + ' {');
    for (const f of msg.fields) {
      const prefix = f.repeated ? 'repeated ' : (f.optional ? 'optional ' : '');
      lines.push('  ' + prefix + f.type + ' ' + f.name + ' = ' + f.number + ';');
    }
    lines.push('}', '');
  }
  for (const [, svc] of serviceDefinitions) {
    lines.push('service ' + svc.name + ' {');
    for (const m of svc.methods) {
      const streamPrefix = m.type === 'server_streaming' ? 'stream ' : '';
      lines.push('  rpc ' + m.name + ' (' + m.inputType + ') returns (' + streamPrefix + m.outputType + ');');
    }
    lines.push('}', '');
  }
  return lines.join('\n');
}

// Register canonical Heady service definitions
defineMessage('HealthRequest', []);
defineMessage('HealthResponse', [
  { name: 'service', type: 'string' },
  { name: 'status', type: 'string' },
  { name: 'uptime', type: 'int64' },
]);
defineMessage('EmbedRequest', [
  { name: 'text', type: 'string' },
  { name: 'dimensions', type: 'int32', optional: true },
]);
defineMessage('EmbedResponse', [
  { name: 'vector', type: 'float', repeated: true },
  { name: 'hash', type: 'string' },
]);
defineMessage('RouteRequest', [
  { name: 'task', type: 'string' },
  { name: 'context', type: 'string', optional: true },
  { name: 'priority', type: 'string', optional: true },
]);
defineMessage('RouteResponse', [
  { name: 'node', type: 'string' },
  { name: 'pool', type: 'string' },
  { name: 'confidence', type: 'float' },
]);
defineMessage('SearchRequest', [
  { name: 'query', type: 'string' },
  { name: 'topK', type: 'int32', optional: true },
  { name: 'embedding', type: 'float', repeated: true, optional: true },
]);
defineMessage('SearchResponse', [
  { name: 'results', type: 'SearchResult', repeated: true },
  { name: 'total', type: 'int32' },
]);

defineService('HeadyHealth', [
  { name: 'Check', inputType: 'HealthRequest', outputType: 'HealthResponse', description: 'Health check' },
]);
defineService('HeadyMemory', [
  { name: 'Embed', inputType: 'EmbedRequest', outputType: 'EmbedResponse', description: 'Generate embedding' },
  { name: 'Search', inputType: 'SearchRequest', outputType: 'SearchResponse', description: 'Vector search' },
]);
defineService('HeadyConductor', [
  { name: 'Route', inputType: 'RouteRequest', outputType: 'RouteResponse', description: 'Route task to node' },
]);

function createServer(port = 3386) {
  return import('http').then(({ default: http }) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const respond = (s, b) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(b)); };
      const readBody = () => new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => { try { r(JSON.parse(Buffer.concat(c).toString())); } catch { r({}); } }); }});

      if (url.pathname === '/proto/message' && req.method === 'POST') { const b = await readBody(); respond(201, defineMessage(b.name, b.fields)); }
      else if (url.pathname === '/proto/service' && req.method === 'POST') { const b = await readBody(); respond(201, defineService(b.name, b.methods)); }
      else if (url.pathname === '/proto/call' && req.method === 'POST') { const b = await readBody(); respond(200, callMethod(b.service, b.method, b.request || {})); }
      else if (url.pathname === '/proto/descriptor' && req.method === 'GET') { const d = getServiceDescriptor(url.searchParams.get('service')); respond(d ? 200 : 404, d || { error: 'not_found' }); }
      else if (url.pathname === '/proto/list' && req.method === 'GET') respond(200, listServices());
      else if (url.pathname === '/proto/generate' && req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end(generateProtoText()); }
      else if (url.pathname === '/health') respond(200, { service: 'heady-services-proto', status: 'healthy', services: serviceDefinitions.size, messages: messageTypes.size, metrics }});
      else respond(404, { error: 'not_found' }});
    }});
    server.listen(port);
    return server;
  });
}

export default { createServer, defineMessage, defineService, callMethod, getServiceDescriptor, listServices, generateProtoText };
export { createServer, defineMessage, defineService, callMethod, getServiceDescriptor, listServices, generateProtoText };
