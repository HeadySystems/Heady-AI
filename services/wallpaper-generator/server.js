/*
 * © 2026 Heady™ Systems Inc.
 * Sacred Geometry Wallpaper Generator
 * Transforms user interaction data into personalized generative art.
 * Each geometric element represents an aspect of user's interaction history.
 */

const http = require('http');
const url = require('url');
const PHI = 1.618033988749895;
const TAU = Math.PI * 2;

function generateMandala(userData = {}) {
  const size = 800;
  const cx = size / 2, cy = size / 2;
  const layers = userData.interactionCount ? Math.min(7, Math.floor(Math.log(userData.interactionCount) / Math.log(PHI))) : 3;
  const hue = (userData.dominantEmotion || 0) * 30 + 240; // Map emotion to color

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="100%" height="100%" fill="#0a0a1a"/>
  <defs>
    <radialGradient id="glow"><stop offset="0%" stop-color="hsl(${hue},70%,60%)" stop-opacity="0.3"/><stop offset="100%" stop-color="transparent"/></radialGradient>
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${size * 0.45}" fill="url(#glow)"/>`;

  // Generate mandala layers
  for (let layer = 1; layer <= layers; layer++) {
    const r = layer * (size * 0.4 / layers);
    const petals = Math.round(layer * PHI * 3);
    const layerHue = (hue + layer * 30) % 360;

    for (let p = 0; p < petals; p++) {
      const angle = (p / petals) * TAU;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      const petalR = r * 0.15;
      svg += `\n  <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${petalR.toFixed(1)}" stroke="hsl(${layerHue},70%,60%)" stroke-width="0.5" fill="none" opacity="${0.3 + layer * 0.1}"/>`;
    }

    // Connecting ring
    svg += `\n  <circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" stroke="hsl(${layerHue},60%,50%)" stroke-width="0.3" fill="none" opacity="0.2"/>`;
  }

  // Central bindu
  svg += `\n  <circle cx="${cx}" cy="${cy}" r="5" fill="hsl(${hue},80%,70%)" opacity="0.9"/>`;
  svg += '\n</svg>';
  return svg;
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (parsed.pathname === '/health') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ status: 'ok', service: 'wallpaper-generator' })); }

  if (parsed.pathname === '/generate') {
    const userData = { interactionCount: parseInt(parsed.query.interactions || '50'), dominantEmotion: parseInt(parsed.query.emotion || '5') };
    res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    return res.end(generateMandala(userData));
  }

  if (parsed.pathname === '/generate' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      res.end(generateMandala(JSON.parse(body)));
    });
    return;
  }

  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ service: 'Sacred Geometry Wallpaper Generator', version: '1.0.0',
    endpoints: { '/generate?interactions=N&emotion=N': 'GET (SVG)', '/generate': 'POST (SVG)' } }));
});

const PORT = process.env.PORT || 8108;
server.listen(PORT, () => console.log(`🎨 Wallpaper Generator on :${PORT}`));
module.exports = { generateMandala };
