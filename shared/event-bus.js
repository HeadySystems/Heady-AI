/**
 * NATS JetStream Event Bus — Heady Systems
 * Eric Haywood — Sacred Geometry v4.0
 *
 * Central async message broker for all service-to-service communication.
 * Subjects per domain: heady.memory.*, heady.inference.*, heady.agents.*
 * Dead letter queue after phi^3 (4) retries.
 */
'use strict';

const PHI  = 1.618033988749895;
const PSI  = 1 / PHI;
const FIB  = [1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987];

const MAX_RETRIES  = Math.round(PHI * PHI * PHI); // 4 (phi^3)
const ACK_WAIT_MS  = Math.round(PHI * PHI * 1000); // 2618ms
const MAX_DELIVER  = FIB[5]; // 8
const BATCH_SIZE   = FIB[8]; // 21

// Domain subjects
const SUBJECTS = {
  memory:        'heady.memory',
  inference:     'heady.inference',
  agents:        'heady.agents',
  orchestration: 'heady.orchestration',
  security:      'heady.security',
  monitoring:    'heady.monitoring',
  web:           'heady.web',
  integration:   'heady.integration',
  specialized:   'heady.specialized',
  deadletter:    'heady.dlq',
};

class HeadyEventBus {
  constructor(natsConnection) {
    this.nc = natsConnection;
    this.js = null;
    this.subscriptions = new Map();
  }

  async initialize() {
    if (!this.nc) {
      throw new Error('NATS connection required for HeadyEventBus');
    }
    this.js = this.nc.jetstream();

    // Ensure streams exist for each domain
    const jsm = await this.nc.jetstreamManager();
    for (const [domain, subject] of Object.entries(SUBJECTS)) {
      try {
        await jsm.streams.add({
          name: `heady-${domain}`,
          subjects: [`${subject}.>`],
          retention: 'limits',
          max_msgs: FIB[16] * FIB[10], // 987 * 55 = 54,285
          max_age: FIB[11] * 24 * 60 * 60 * 1e9, // 89 days in nanos
          storage: 'file',
          discard: 'old',
          max_msg_size: FIB[14] * 1024, // 377KB
          duplicate_window: FIB[8] * 1e9, // 21s dedup window
        });
      } catch (err) {
        if (!err.message.includes('already in use')) {
          throw err;
        }
      }
    }
  }

  async publish(subject, data, headers = {}) {
    if (!this.js) {
      throw new Error('EventBus not initialized — call initialize() first');
    }
    const payload = JSON.stringify({
      data,
      metadata: {
        timestamp: Date.now(),
        subject,
        phi: PHI,
        ...headers,
      },
    });
    const ack = await this.js.publish(subject, Buffer.from(payload));
    return { seq: ack.seq, stream: ack.stream };
  }

  async subscribe(subject, handler, options = {}) {
    if (!this.js) {
      throw new Error('EventBus not initialized — call initialize() first');
    }
    const consumerName = options.consumer || subject.replace(/\./g, '-');
    const sub = await this.js.subscribe(subject, {
      durable: consumerName,
      ackWait: ACK_WAIT_MS * 1e6, // convert to nanos
      maxDeliver: MAX_DELIVER,
      deliverPolicy: options.deliverPolicy || 'new',
      filterSubject: subject,
    });

    this.subscriptions.set(consumerName, sub);

    (async () => {
      for await (const msg of sub) {
        try {
          const parsed = JSON.parse(msg.data.toString());
          await handler(parsed.data, parsed.metadata, msg);
          msg.ack();
        } catch (err) {
          if (msg.info.redeliveryCount >= MAX_RETRIES) {
            // Move to dead letter queue
            await this.publish(`${SUBJECTS.deadletter}.${subject}`, {
              originalSubject: subject,
              payload: msg.data.toString(),
              error: err.message,
              attempts: msg.info.redeliveryCount,
            });
            msg.term();
          } else {
            // Phi-backoff before redelivery
            const delay = Math.round(Math.pow(PHI, msg.info.redeliveryCount) * 1000);
            msg.nak(delay * 1e6); // nanos
          }
        }
      }
    })();

    return sub;
  }

  async close() {
    for (const [name, sub] of this.subscriptions) {
      sub.unsubscribe();
    }
    this.subscriptions.clear();
  }
}

module.exports = {
  HeadyEventBus,
  SUBJECTS,
  PHI, PSI, FIB,
  MAX_RETRIES, ACK_WAIT_MS, MAX_DELIVER, BATCH_SIZE,
};
