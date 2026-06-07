// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: src/agents/agent-router.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
import { AgentManager } from './agent-manager.js';
const agentManager = new AgentManager();

function setupAgentRoutes(app) {
  app.get('/api/agents', (req, res) => {
    res.json(agentManager.listAll());
  });

  app.get('/api/agents/status', (req, res) => {
    res.json(agentManager.getStatusAll());
  });

  app.get('/api/agents/:id', (req, res) => {
    const agent = agentManager.getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json(agent);
  });

  app.post('/api/agents/:id/invoke', async (req, res, next) => {
    try {
      const result = await agentManager.invoke(req.params.id, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });
}

export { setupAgentRoutes };