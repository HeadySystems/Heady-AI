'use strict';

const { AgentManager } = require('./agent-manager');
const { authenticateJWT } = require('../gateway/auth');
const { enforceAgentGovernance } = require('../middleware/governance-enforcer');

const agentManager = new AgentManager();

function setupAgentRoutes(app) {
  app.get('/api/agents', authenticateJWT, (req, res) => {
    res.json(agentManager.listAll());
  });

  app.get('/api/agents/status', authenticateJWT, (req, res) => {
    res.json(agentManager.getStatusAll());
  });

  app.get('/api/agents/:id', authenticateJWT, (req, res) => {
    const agent = agentManager.getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json(agent);
  });

  app.post('/api/agents/:id/invoke', authenticateJWT, enforceAgentGovernance, async (req, res, next) => {
    try {
      const result = await agentManager.invoke(req.params.id, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });
}

module.exports = { setupAgentRoutes };
