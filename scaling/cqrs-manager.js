/**
 * Heady CQRS Manager — Command Query Responsibility Segregation
 * Separate write (command) and read (query) paths with event sourcing
 * Author: Eric Haywood | All constants φ-derived | ESM only
 */
import { createHash } from 'crypto';
import { PHI, PSI, PSI2, phiThreshold, fibonacci } from '../shared/phi-math-v2.js';
import { cslGate } from '../shared/csl-engine-v2.js';

const EVENT_STORE_MAX   = fibonacci(17);  // 1597
const SNAPSHOT_INTERVAL = fibonacci(10);  // every 55 events
const PROJECTION_CACHE  = fibonacci(16);  // 987
const COMMAND_TIMEOUT   = fibonacci(13) * 1000; // 233s

function sha256(input) { return createHash('sha256').update(String(input)).digest('hex'); }

const eventStore = [];
const projections = new Map();
const snapshots = new Map();
const commandHandlers = new Map();
const queryHandlers = new Map();
const metrics = { commands: 0, queries: 0, events: 0, snapshots: 0 };

function registerCommandHandler(commandType, handler) {
  commandHandlers.set(commandType, handler);
  return { registered: commandType };
}

function registerQueryHandler(queryType, handler) {
  queryHandlers.set(queryType, handler);
  return { registered: queryType };
}

async function executeCommand(command) {
  const handler = commandHandlers.get(command.type);
  if (!handler) return { error: 'unknown_command', type: command.type };

  const validationScore = command.payload ? 1.0 : 0.0;
  const gate = cslGate(validationScore, validationScore, phiThreshold(1), PSI * PSI * PSI);
  if (gate < PSI2) return { error: 'invalid_payload' };

  const events = handler(command);
  const storedEvents = [];

  for (const event of (Array.isArray(events) ? events : [events])) {
    const stored = {
      id: sha256(JSON.stringify(event) + Date.now() + eventStore.length),
      type: event.type,
      aggregateId: event.aggregateId || command.aggregateId,
      payload: event.payload || {},
      metadata: { commandType: command.type, timestamp: Date.now(), version: eventStore.length + 1 },
      hash: sha256(JSON.stringify(event)),
    };
    if (eventStore.length >= EVENT_STORE_MAX) eventStore.shift();
    eventStore.push(stored);
    storedEvents.push(stored);
    metrics.events++;

    // Auto-snapshot
    if (eventStore.length % SNAPSHOT_INTERVAL === 0) {
      createSnapshot(stored.aggregateId);
    }
  }

  // Update projections
  for (const [name, proj] of projections) {
    for (const event of storedEvents) {
      if (proj.eventTypes.includes(event.type)) {
        proj.state = proj.reducer(proj.state, event);
        proj.lastUpdated = Date.now();
      }
    }
  }

  metrics.commands++;
  return { success: true, events: storedEvents.map(e => e.id) };
}

async function executeQuery(query) {
  const handler = queryHandlers.get(query.type);
  if (handler) {
    metrics.queries++;
    return handler(query, projections, eventStore);
  }

  const projection = projections.get(query.projection || query.type);
  if (projection) {
    metrics.queries++;
    return { data: projection.state, lastUpdated: projection.lastUpdated };
  }

  return { error: 'unknown_query', type: query.type };
}

function registerProjection(name, eventTypes, reducer, initialState) {
  if (projections.size >= PROJECTION_CACHE) {
    const oldest = [...projections.entries()].sort((a, b) => a[1].lastUpdated - b[1].lastUpdated)[0];
    if (oldest) projections.delete(oldest[0]);
  }
  projections.set(name, {
    name, eventTypes, reducer,
    state: initialState || {},
    lastUpdated: Date.now(),
  });
  return { registered: name, eventTypes };
}

function createSnapshot(aggregateId) {
  const events = eventStore.filter(e => e.aggregateId === aggregateId);
  const snapshot = {
    aggregateId,
    version: events.length,
    state: events.reduce((s, e) => ({ ...s, ...e.payload }), {}),
    created: Date.now(),
    hash: sha256(JSON.stringify(events.map(e => e.id))),
  };
  snapshots.set(aggregateId, snapshot);
  metrics.snapshots++;
  return snapshot;
}

function replayEvents(aggregateId, fromVersion) {
  const snapshot = snapshots.get(aggregateId);
  let state = snapshot && snapshot.version >= (fromVersion || 0) ? { ...snapshot.state } : {};
  const startVersion = snapshot ? snapshot.version : (fromVersion || 0);
  const events = eventStore.filter(e =>
    e.aggregateId === aggregateId && e.metadata.version > startVersion
  );
  for (const event of events) {
    state = { ...state, ...event.payload };
  }
  return { aggregateId, state, eventsReplayed: events.length, fromSnapshot: !!snapshot };
}

function getEventStream(aggregateId, limit) {
  const events = eventStore.filter(e => !aggregateId || e.aggregateId === aggregateId);
  return events.slice(-(limit || fibonacci(10)));
}

function createServer(port = 3380) {
  return import('http').then(({ default: http }) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const respond = (s, b) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(b)); };
      const readBody = () => new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => { try { r(JSON.parse(Buffer.concat(c).toString())); } catch (parseErr) { r({ _parseError: parseErr.message }); } }); });

      if (url.pathname === '/cqrs/command' && req.method === 'POST') respond(200, await executeCommand(await readBody()));
      else if (url.pathname === '/cqrs/query' && req.method === 'POST') respond(200, await executeQuery(await readBody()));
      else if (url.pathname === '/cqrs/events' && req.method === 'GET') respond(200, getEventStream(url.searchParams.get('aggregateId')));
      else if (url.pathname === '/cqrs/replay' && req.method === 'POST') respond(200, replayEvents((await readBody()).aggregateId));
      else if (url.pathname === '/health') respond(200, { service: 'cqrs-manager', status: 'healthy', events: eventStore.length, projections: projections.size, metrics });
      else respond(404, { error: 'not_found' });
    });
    server.listen(port);
    return server;
  });
}

export default { createServer, executeCommand, executeQuery, registerCommandHandler, registerQueryHandler, registerProjection, replayEvents, getEventStream };
export { createServer, executeCommand, executeQuery, registerCommandHandler, registerQueryHandler, registerProjection, replayEvents, getEventStream };
