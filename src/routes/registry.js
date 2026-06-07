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
// ║  FILE: src/routes/registry.js                                      ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const express = require('express');
const fs = require('fs');
const path = require('path');

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function createRegistryRouter() {
  const router = express.Router();

  const getRegistryPath = () => path.join(process.cwd(), 'heady-registry.json');

  /**
   * @swagger
   * /api/registry:
   *   get:
   *     summary: Get registry data
   *     responses:
   *       200:
   *         description: Registry data
   */
  router.get('/', (req, res) => {
    const registry = readJsonSafe(getRegistryPath());
    if (!registry) return res.status(404).json({ error: 'Registry not found' });
    res.json(registry);
  });

  /**
   * @swagger
   * /api/registry/component/{id}:
   *   get:
   *     summary: Get component data
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Component data
   */
  router.get('/component/:id', (req, res) => {
    const registry = readJsonSafe(getRegistryPath());
    if (!registry) return res.status(404).json({ error: 'Registry not found' });
    const comp = (registry.components || []).find((c) => c.id === req.params.id);
    if (!comp) return res.status(404).json({ error: `Component '${req.params.id}' not found` });
    res.json(comp);
  });

  /**
   * @swagger
   * /api/registry/environments:
   *   get:
   *     summary: Get environments data
   *     responses:
   *       200:
   *         description: Environments data
   */
  router.get('/environments', (req, res) => {
    const registry = readJsonSafe(getRegistryPath());
    if (!registry) return res.status(404).json({ error: 'Registry not found' });
    res.json({ environments: registry.environments || [], ts: new Date().toISOString() });
  });

  /**
   * @swagger
   * /api/registry/docs:
   *   get:
   *     summary: Get docs data
   *     responses:
   *       200:
   *         description: Docs data
   */
  router.get('/docs', (req, res) => {
    const registry = readJsonSafe(getRegistryPath());
    if (!registry) return res.status(404).json({ error: 'Registry not found' });
    res.json({ docs: registry.docs || [], ts: new Date().toISOString() });
  });

  /**
   * @swagger
   * /api/registry/notebooks:
   *   get:
   *     summary: Get notebooks data
   *     responses:
   *       200:
   *         description: Notebooks data
   */
  router.get('/notebooks', (req, res) => {
    const registry = readJsonSafe(getRegistryPath());
    if (!registry) return res.status(404).json({ error: 'Registry not found' });
    res.json({ notebooks: registry.notebooks || [], ts: new Date().toISOString() });
  });

  /**
   * @swagger
   * /api/registry/patterns:
   *   get:
   *     summary: Get patterns data
   *     responses:
   *       200:
   *         description: Patterns data
   */
  router.get('/patterns', (req, res) => {
    const registry = readJsonSafe(getRegistryPath());
    if (!registry) return res.status(404).json({ error: 'Registry not found' });
    res.json({ patterns: registry.patterns || [], ts: new Date().toISOString() });
  });

  /**
   * @swagger
   * /api/registry/workflows:
   *   get:
   *     summary: Get workflows data
   *     responses:
   *       200:
   *         description: Workflows data
   */
  router.get('/workflows', (req, res) => {
    const registry = readJsonSafe(getRegistryPath());
    if (!registry) return res.status(404).json({ error: 'Registry not found' });
    res.json({ workflows: registry.workflows || [], ts: new Date().toISOString() });
  });

  /**
   * @swagger
   * /api/registry/ai-nodes:
   *   get:
   *     summary: Get AI nodes data
   *     responses:
   *       200:
   *         description: AI nodes data
   */
  router.get('/ai-nodes', (req, res) => {
    const registry = readJsonSafe(getRegistryPath());
    if (!registry) return res.status(404).json({ error: 'Registry not found' });
    res.json({ aiNodes: registry.aiNodes || [], ts: new Date().toISOString() });
  });

  return router;
}

module.exports = {
  createRegistryRouter
};
