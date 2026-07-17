// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Antigravity Bridge v1.1.0                                ║
// ║  Node.js ESM Bridge to the Python Antigravity SDK Worker         ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { connect, StringCodec } from 'nats';
import pino from 'pino';

const logger = pino({ name: 'heady-antigravity-bridge' });
const sc = StringCodec();

let nc = null;
let routedRequests = 0;

export const start = async () => {
  try {
    // In compliance with rule: Zero `localhost`. All URLs from env vars.
    const natsUrl = process.env.NATS_URL;
    if (!natsUrl) {
      logger.warn('NATS_URL is not set, Antigravity bridge requires explicit network routing.');
    }
    
    nc = await connect({ servers: natsUrl || 'nats://nats.heady.internal:4222' });
    logger.info(`Bridge connected to NATS at ${natsUrl || 'nats://nats.heady.internal:4222'}`);
  } catch (err) {
    logger.error('Failed to connect to NATS', err);
    throw err;
  }
};

export const stop = async () => {
  if (nc) {
    await nc.drain();
    await nc.close();
    logger.info('Bridge NATS connection closed.');
  }
};

export const health = () => {
  return nc && !nc.isClosed() ? 'UP' : 'DOWN';
};

export const metrics = () => {
  return { routed_requests: routedRequests };
};

/**
 * Generic request dispatcher to the Antigravity worker
 */
const dispatch = async (subject, payloadObj, timeoutMs = 30000) => {
  if (!nc || nc.isClosed()) {
    throw new Error('NATS connection is down.');
  }

  try {
    const payload = JSON.stringify(payloadObj);
    logger.info(`Dispatching intent to ${subject}`);
    
    const response = await nc.request(subject, sc.encode(payload), { timeout: timeoutMs });
    routedRequests++;
    
    const result = JSON.parse(sc.decode(response.data));
    if (result.status === 'error') {
      throw new Error(`Worker Error: ${result.message}`);
    }
    
    return result;
  } catch (err) {
    logger.error(`Antigravity invocation failed on ${subject}`, err);
    throw err;
  }
};

export const invokeAntigravityAgent = async (prompt, timeoutMs = 30000) => {
  const res = await dispatch('agent.antigravity.request', { prompt }, timeoutMs);
  return res.response;
};

// --- Fallback Routing Interfaces ---

export const generateEmbedding = async (text) => {
  const res = await dispatch('agent.antigravity.embed', { text });
  return res.embedding;
};

export const invokeDrupalCMSMock = async () => {
  const res = await dispatch('agent.antigravity.drupal', {});
  return res.data;
};

export const reviewCodeDiff = async (diff) => {
  const res = await dispatch('agent.antigravity.review', { diff });
  return res.review;
};

export const startTunnel = async () => {
  const res = await dispatch('agent.antigravity.tunnel', {});
  return res.url;
};

export const invokeArbiter = async () => {
  const res = await dispatch('agent.antigravity.arbiter', {});
  return res.message;
};
