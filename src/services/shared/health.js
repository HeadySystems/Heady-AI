'use strict';
// Stub health module
const healthRoutes = (app, opts = {}) => {
  app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: Date.now() }));
};
module.exports = { healthRoutes };
