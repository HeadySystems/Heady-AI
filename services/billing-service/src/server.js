'use strict';

const crypto = require('node:crypto');

function verifyStripeSignature(payload, signature) {
  const secret = process.env.HEADY_STRIPE_WEBHOOK_SECRET || 'heady-stripe-webhook-secret';
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

module.exports = { verifyStripeSignature };
