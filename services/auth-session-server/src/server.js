'use strict';

const http = require('node:http');
const { SessionStore } = require('./session-store');

const store = new SessionStore();

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/session/create') {
      const body = JSON.parse(await readBody(req));
      const session = store.create({
        subject: body.subject,
        provider: body.provider,
        roles: body.roles,
        origin: req.headers.origin || body.origin,
        userAgent: req.headers['user-agent']
      });

      const cookieValue = `__Host-heady_session=${session.id}; Path=/; Secure; HttpOnly; SameSite=Lax`;
      res.writeHead(200, {
        'content-type': 'application/json',
        'set-cookie': cookieValue
      });
      res.end(JSON.stringify({ ok: true, sessionId: session.id }));
      return;
    }

    if (req.method === 'POST' && req.url === '/session/verify') {
      const cookieHeader = req.headers.cookie || '';
      const match = cookieHeader.match(/__Host-heady_session=([^;]+)/);
      if (!match) {
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'no session cookie' }));
        return;
      }

      const session = store.get(match[1]);
      if (!session) {
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'session not found' }));
        return;
      }

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, session }));
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  } catch (err) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

module.exports = { server };
