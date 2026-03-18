/*
 * © 2026 Heady™ Systems Inc.
 * HeadyRecipe Marketplace — Shareable AI Workflow Configs
 */
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const STORE_PATH = path.join(__dirname, '../../.heady_cache/recipe-store.json');

const FEATURED_RECIPES = [
  { id: 'newsletter_writer', name: 'Newsletter Writer', author: 'Heady', category: 'content', guild: ['researcher', 'writer', 'critic'], pipeline: ['research', 'draft', 'review', 'format'], downloads: 0, rating: 4.8 },
  { id: 'data_analyst', name: 'Data Analysis Squad', author: 'Heady', category: 'analysis', guild: ['researcher', 'factchecker', 'strategist'], pipeline: ['ingest', 'analyze', 'visualize', 'report'], downloads: 0, rating: 4.9 },
  { id: 'code_reviewer', name: 'Code Review Team', author: 'Heady', category: 'dev', guild: ['critic', 'mentor', 'executor'], pipeline: ['lint', 'analyze', 'suggest', 'test'], downloads: 0, rating: 4.7 },
  { id: 'brainstorm', name: 'Creative Brainstorm', author: 'Heady', category: 'creative', guild: ['creative', 'strategist', 'mediator'], pipeline: ['ideate', 'diversify', 'evaluate', 'refine'], downloads: 0, rating: 4.6 },
  { id: 'study_buddy', name: 'Study Buddy Pack', author: 'Heady', category: 'learning', guild: ['researcher', 'mentor', 'factchecker'], pipeline: ['research', 'explain', 'quiz', 'review'], downloads: 0, rating: 4.9 }
];

function loadStore() {
  try { return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); }
  catch { return { recipes: [...FEATURED_RECIPES], version: 1 }; }
}
function saveStore(store) {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (parsed.pathname === '/health') return res.end(JSON.stringify({ status: 'ok', service: 'heady-recipe' }));
  if (parsed.pathname === '/featured') return res.end(JSON.stringify(FEATURED_RECIPES, null, 2));
  if (parsed.pathname === '/recipes') return res.end(JSON.stringify(loadStore()));
  if (parsed.pathname === '/publish' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const recipe = JSON.parse(body);
      recipe.id = `recipe_${Date.now()}`;
      recipe.published = new Date().toISOString();
      recipe.downloads = 0;
      recipe.rating = 0;
      const store = loadStore();
      store.recipes.push(recipe);
      store.version++;
      saveStore(store);
      res.end(JSON.stringify({ published: recipe }));
    });
    return;
  }
  res.end(JSON.stringify({ service: 'HeadyRecipe Marketplace', version: '1.0.0',
    endpoints: { '/featured': 'GET', '/recipes': 'GET', '/publish': 'POST' } }));
});
const PORT = process.env.PORT || 8113;
server.listen(PORT, () => console.log(`📦 HeadyRecipe Marketplace on :${PORT}`));
module.exports = { FEATURED_RECIPES };
