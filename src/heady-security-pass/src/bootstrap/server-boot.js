/**
 * ∞ Server Boot — Phase 10 Bootstrap
 * Extracted from heady-manager.js lines 1629-1831
 * HTTP/HTTPS server creation + WebSocket upgrade + listen
 */
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { HeadyWebSocket } = require('../core/heady-server');
const { createMTLSServer } = require('../security/mtls');
const { fib } = require('../shared/phi-math');

const DEFAULT_PORT = 3301;
const SESSION_TTL_MS = fib(11) * 1000;

function buildPublicBaseUrl(request, serverIsTls) {
    const protocol = serverIsTls ? 'https' : 'http';
    return new URL(request.url, `${protocol}://${request.headers.host}`);
}

function isVoiceSocketAuthorized(request) {
    if (process.env.HEADY_REQUIRE_VOICE_AUTH === 'false') {
        return true;
    }

    const authHeader = request.headers.authorization;
    const hasBearerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ');
    const protocolHeader = request.headers['sec-websocket-protocol'];
    const hasProtocolToken = typeof protocolHeader === 'string' && protocolHeader.split(',').some((value) => value.trim().startsWith('token.'));

    return hasBearerToken || hasProtocolToken;
}

module.exports = function bootServer(app, { logger, voiceSessions }) {
    const PORT = Number(process.env.PORT || process.env.HEADY_PORT || DEFAULT_PORT);
    const redisPool = require('../utils/redis-pool');
    const mtlsServer = createMTLSServer(app, { rejectUnauthorized: true });
    const server = mtlsServer.server || http.createServer(app);
    const serverIsTls = Boolean(mtlsServer.mtlsEnabled);

    if (serverIsTls) {
        logger.logNodeActivity('BUILDER', 'mTLS/HTTPS server configured with certificate verification');
    } else {
        logger.logNodeActivity('BUILDER', 'No verified TLS certificate bundle found. Falling back to HTTP server');
    }

    // WebSocket upgrade for voice relay
    const voiceWss = new HeadyWebSocket.Server({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
        const url = buildPublicBaseUrl(request, serverIsTls);
        const match = url.pathname.match(/^\/ws\/voice\/([A-Za-z0-9_-]+)$/);
        if (!match) {
            socket.destroy();
            return;
        }

        if (!isVoiceSocketAuthorized(request)) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            logger.logError('VOICE', 'Rejected unauthenticated WebSocket upgrade', { path: url.pathname });
            return;
        }

        const sessionId = match[1];
        voiceWss.handleUpgrade(request, socket, head, (ws) => {
            voiceWss.emit('connection', ws, request, sessionId);
        });
    });

    voiceWss.on('connection', (ws, request, sessionId) => {
        if (!voiceSessions.has(sessionId)) {
            voiceSessions.set(sessionId, { sender: null, receivers: new Set(), created: Date.now(), lastActivity: Date.now() });
        }
        const session = voiceSessions.get(sessionId);
        const url = buildPublicBaseUrl(request, serverIsTls);
        const role = url.searchParams.get('role') || 'receiver';

        if (Date.now() - session.created > SESSION_TTL_MS) {
            voiceSessions.delete(sessionId);
            ws.close(4001, 'Session expired');
            return;
        }

        if (role === 'sender') {
            session.sender = ws;
            session.receivers.forEach(r => { if (r.readyState === 1) r.send(JSON.stringify({ type: 'sender_connected' })); });
        } else {
            session.receivers.add(ws);
            if (session.sender && session.sender.readyState === 1) ws.send(JSON.stringify({ type: 'sender_connected' }));
        }

        ws.on('message', (data) => {
            session.lastActivity = Date.now();
            try {
                const msg = JSON.parse(data);
                if (role === 'sender' && ['transcript', 'interim', 'final'].includes(msg.type)) {
                    session.receivers.forEach(r => { if (r.readyState === 1) r.send(JSON.stringify(msg)); });
                }
                if (role === 'receiver' && msg.type === 'command' && session.sender && session.sender.readyState === 1) {
                    session.sender.send(JSON.stringify(msg));
                }
            } catch (error) {
                logger.logError('VOICE', 'Failed to process voice socket message', {
                    sessionId,
                    role,
                    error: error.message,
                });
            }
        });

        ws.on('close', () => {
            if (role === 'sender') {
                session.sender = null;
                session.receivers.forEach(r => { if (r.readyState === 1) r.send(JSON.stringify({ type: 'sender_disconnected' })); });
            } else { session.receivers.delete(ws); }
            if (!session.sender && session.receivers.size === 0) voiceSessions.delete(sessionId);
        });
    });

    // Boot
    redisPool.init().then(() => {
        server.listen(PORT, '0.0.0.0', () => {
            const protocol = serverIsTls ? 'https' : 'http';
            const voiceProtocol = serverIsTls ? 'wss' : 'ws';
            logger.logNodeActivity('CONDUCTOR', 'HEADY SYSTEMS CORE booted', {
                gateway: `${protocol}://0.0.0.0:${PORT}`,
                voice: `${voiceProtocol}://0.0.0.0:${PORT}/ws/voice/:id`,
                mtlsEnabled: serverIsTls,
            });
        });
    });
};
