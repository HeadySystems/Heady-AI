// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Patterns Ingest v2.0.0                                   ║
// ║  NATS Event Ingestion and Pattern Classification                 ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                ║
// ╚══════════════════════════════════════════════════════════════════╝

import { connect } from 'nats';
import pino from 'pino';
import { z } from 'zod';
import { evaluatePattern } from './csl-pattern-engine.mjs';

const logger = pino();
const NATS_URL = process.env.NATS_URL || 'nats://nats.heady.svc.cluster.local:4222';

const EventSchema = z.object({
  tenantId: z.string().uuid(),
  eventType: z.string(),
  traceId: z.string().optional(),
  payload: z.record(z.any()),
  status: z.enum(['success', 'error', 'violation', 'reverted']).optional().default('success')
});

export async function startIngestion() {
  try {
    const nc = await connect({ servers: NATS_URL });
    logger.info({ msg: 'Connected to NATS for HeadyPatterns ingestion' });

    // Subscribe to all relevant events
    const sub = nc.subscribe('agent.coder.>');
    for await (const msg of sub) {
      try {
        const data = JSON.parse(msg.data.toString());
        const event = EventSchema.parse(data);
        
        // Classify positive vs negative
        const patternType = ['error', 'violation', 'reverted'].includes(event.status) 
          ? 'negative' 
          : 'positive';

        logger.info({ 
          msg: 'Processing event for HeadyPatterns',
          tenantId: event.tenantId,
          patternType,
          eventType: event.eventType,
          'X-Heady-Trace-Id': event.traceId || 'sys-pattern-gen'
        });

        // Trigger semantic processing pipeline
        await evaluatePattern(event, patternType, nc);

      } catch (err) {
        logger.error({ 
          msg: 'Failed to process ingestion event',
          error: err.message
        });
      }
    }
  } catch (err) {
    logger.error({ 
      msg: 'Fatal NATS connection error in patterns ingest',
      error: err.message
    });
  }
}
