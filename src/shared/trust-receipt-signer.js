'use strict';
// Stub trust receipt signer
const crypto = require('crypto');
module.exports = {
  sign: (payload, key) => ({ ...payload, sig: crypto.createHmac('sha256', key || 'stub').update(JSON.stringify(payload)).digest('hex'), signed: true }),
  verify: (receipt, key) => true,
};
