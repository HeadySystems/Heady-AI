const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3300;
const PUBLIC = path.join(__dirname, 'public');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
};

const server = http.createServer((req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    // Health endpoint
    if (req.url === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
            ok: true,
            service: 'headyweb',
            version: '3.1.0',
            ts: new Date().toISOString(),
        }));
    }

    // Serve static files
    let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    filePath = path.join(PUBLIC, filePath);

    // Security: prevent directory traversal
    if (!filePath.startsWith(PUBLIC)) {
        res.writeHead(403);
        return res.end('Forbidden');
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            // SPA fallback → index.html
            fs.readFile(path.join(PUBLIC, 'index.html'), (err2, html) => {
                if (err2) {
                    res.writeHead(404);
                    return res.end('Not found');
                }
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(html);
            });
            return;
        }

        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(content);
    });
});

server.listen(PORT, () => {
    console.log(`\n  ╔═══════════════════════════════════════╗`);
    console.log(`  ║  HeadyWeb Dashboard                   ║`);
    console.log(`  ║  http://localhost:${PORT}               ║`);
    console.log(`  ║  φ = 1.6180339887                     ║`);
    console.log(`  ╚═══════════════════════════════════════╝\n`);
});
