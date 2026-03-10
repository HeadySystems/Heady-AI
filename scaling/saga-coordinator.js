/**
 * Heady Saga Coordinator — Distributed transaction orchestration
 * Compensating actions, timeout handling, φ-backoff retry
 * Author: Eric Haywood | All constants φ-derived | ESM only
 */
import { createHash, randomBytes } from 'crypto';
import { PHI, PSI, PSI2, phiThreshold, phiBackoff, fibonacci } from '../shared/phi-math-v2.js';
import { cslGate } from '../shared/csl-engine-v2.js';

const MAX_SAGA_STEPS     = fibonacci(8);   // 21
const SAGA_TIMEOUT_MS    = fibonacci(14) * 1000; // 377s
const MAX_COMPENSATIONS  = fibonacci(5);   // 5 retries per compensation
const SAGA_HISTORY_SIZE  = fibonacci(14);  // 377

function sha256(input) { return createHash('sha256').update(String(input)).digest('hex'); }

const activeSagas = new Map();
const sagaHistory = [];
const sagaDefinitions = new Map();
const metrics = { started: 0, completed: 0, compensated: 0, failed: 0 };

function defineSaga(name, steps) {
  if (steps.length > MAX_SAGA_STEPS) return { error: 'too_many_steps', max: MAX_SAGA_STEPS };
  const def = {
    name, steps: steps.map((s, i) => ({
      name: s.name, order: i,
      action: s.action, compensation: s.compensation,
      timeout: s.timeout || SAGA_TIMEOUT_MS,
      retries: s.retries || fibonacci(3),
    })),
    hash: sha256(name + JSON.stringify(steps)),
  };
  sagaDefinitions.set(name, def);
  return { defined: name, steps: steps.length };
}

async function startSaga(sagaName, context) {
  const def = sagaDefinitions.get(sagaName);
  if (!def) return { error: 'saga_not_defined' };

  const sagaId = sha256(randomBytes(16).toString('hex') + Date.now());
  const saga = {
    id: sagaId, name: sagaName,
    context: context || {},
    currentStep: 0,
    state: 'RUNNING',
    completedSteps: [],
    compensatedSteps: [],
    startedAt: Date.now(),
    completedAt: null,
    error: null,
  };
  activeSagas.set(sagaId, saga);
  metrics.started++;

  for (let i = 0; i < def.steps.length; i++) {
    const step = def.steps[i];
    saga.currentStep = i;

    let attempt = 0;
    let success = false;

    while (attempt < step.retries && !success) {
      try {
        const result = await Promise.race([
          executeStep(step, saga.context),
          new Promise((_, reject) => setTimeout(() => reject(new Error('step_timeout')), step.timeout)),
        ]);
        saga.completedSteps.push({ step: step.name, result, attempt, completedAt: Date.now() });
        saga.context = { ...saga.context, ['step_' + i + '_result']: result };
        success = true;
      } catch (err) {
        attempt++;
        if (attempt < step.retries) {
          const delay = phiBackoff(attempt, 1000, fibonacci(13) * 1000);
          await new Promise(r => setTimeout(r, Math.min(delay, 100)));
        }
      }
    }

    if (!success) {
      saga.state = 'COMPENSATING';
      saga.error = 'step_failed: ' + step.name;
      await compensateSaga(saga, def, i);
      return { sagaId, state: saga.state, error: saga.error, compensated: saga.compensatedSteps };
    }
  }

  saga.state = 'COMPLETED';
  saga.completedAt = Date.now();
  metrics.completed++;
  archiveSaga(saga);
  return { sagaId, state: 'COMPLETED', results: saga.completedSteps };
}

async function executeStep(step, context) {
  if (typeof step.action === 'function') return step.action(context);
  return { executed: step.name, context: sha256(JSON.stringify(context)), timestamp: Date.now() };
}

async function compensateSaga(saga, def, failedStep) {
  for (let i = failedStep - 1; i >= 0; i--) {
    const step = def.steps[i];
    let attempt = 0;
    let compensated = false;

    while (attempt < MAX_COMPENSATIONS && !compensated) {
      try {
        const result = typeof step.compensation === 'function'
          ? await step.compensation(saga.context)
          : { compensated: step.name, timestamp: Date.now() };
        saga.compensatedSteps.push({ step: step.name, result, attempt });
        compensated = true;
      } catch (err) {
        attempt++;
        if (attempt < MAX_COMPENSATIONS) {
          await new Promise(r => setTimeout(r, Math.min(phiBackoff(attempt, 500, 5000), 50)));
        }
      }
    }

    if (!compensated) {
      saga.state = 'COMPENSATION_FAILED';
      metrics.failed++;
      archiveSaga(saga);
      return;
    }
  }

  saga.state = 'COMPENSATED';
  saga.completedAt = Date.now();
  metrics.compensated++;
  archiveSaga(saga);
}

function archiveSaga(saga) {
  activeSagas.delete(saga.id);
  if (sagaHistory.length >= SAGA_HISTORY_SIZE) sagaHistory.shift();
  sagaHistory.push({ ...saga });
}

function getSagaStatus(sagaId) {
  return activeSagas.get(sagaId) || sagaHistory.find(s => s.id === sagaId) || null;
}

function createServer(port = 3381) {
  return import('http').then(({ default: http }) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const respond = (s, b) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(b)); };
      const readBody = () => new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => { try { r(JSON.parse(Buffer.concat(c).toString())); } catch (parseErr) { r({ _parseError: parseErr.message }); } }); });

      if (url.pathname === '/saga/define' && req.method === 'POST') respond(201, defineSaga((await readBody()).name, (await readBody()).steps || []));
      else if (url.pathname === '/saga/start' && req.method === 'POST') { const b = await readBody(); respond(200, await startSaga(b.sagaName, b.context)); }
      else if (url.pathname === '/saga/status' && req.method === 'GET') { const s = getSagaStatus(url.searchParams.get('id')); respond(s ? 200 : 404, s || { error: 'not_found' }); }
      else if (url.pathname === '/health') respond(200, { service: 'saga-coordinator', status: 'healthy', active: activeSagas.size, history: sagaHistory.length, definitions: sagaDefinitions.size, metrics });
      else respond(404, { error: 'not_found' });
    });
    server.listen(port);
    return server;
  });
}

export default { createServer, defineSaga, startSaga, getSagaStatus };
export { createServer, defineSaga, startSaga, getSagaStatus };
