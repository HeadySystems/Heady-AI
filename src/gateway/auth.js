import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' } });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn(`[Auth] Invalid token: ${err.message}`);
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
  }
}

function authenticateMCP(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing Authorization header' } });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  const expected = process.env.MCP_BEARER_TOKEN || '';
  if (!expected || !token || Buffer.byteLength(token) !== Buffer.byteLength(expected) ||
      !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid MCP token' } });
  }
  next();
}

export { authenticateJWT, authenticateMCP };