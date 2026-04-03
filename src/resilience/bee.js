'use strict';
// Stub bee factory
const createBee = (type, opts = {}) => ({ type, opts, run: async (task) => ({ result: null }), status: 'ready' });
const spawnBee = createBee;
module.exports = { createBee, spawnBee };
