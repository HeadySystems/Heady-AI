const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const winston = require('winston');

// ─── Logger ──────────────────────────────────────────────────────────────────
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

// ─── Firebase Admin (conditional — graceful if credentials absent) ───────────
let firebaseAdmin = null;
try {
  const admin = require('firebase-admin');
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const credential = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      ? admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))
      : admin.credential.applicationDefault();
    admin.initializeApp({ credential });
    firebaseAdmin = admin;
    logger.info('Firebase Admin initialized successfully');
  } else {
    logger.warn('Firebase credentials not found — session verification will run in mock mode');
  }
} catch (err) {
  logger.warn('Firebase Admin SDK not available — running in mock mode', { error: err.message });
}

// ─── CORS Whitelist (matches tests/auth/auth-session.test.js) ────────────────
const ALLOWED_ORIGINS = [
  'https://headyme.com',
  'https://headysystems.com',
  'https://heady-ai.com',
  'https://headyos.com',
  'https://headyconnection.org',
  'https://headyconnection.com',
  'https://headyex.com',
  'https://headyfinance.com',
  'https://admin.headysystems.com',
  'https://auth.headysystems.com',
];

const app = express();

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    logger.warn('CORS blocked', { origin });
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// ─── φ-scaled session TTL: 144 hours (fib(12)) in ms ────────────────────────
const SESSION_TTL_MS = 144 * 60 * 60 * 1000; // fib(12) = 144 hours

// ─── Health Endpoint (Cloud Run + Docker healthcheck) ────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'auth-session-server',
    firebase: firebaseAdmin ? 'connected' : 'mock',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ─── Session Login ───────────────────────────────────────────────────────────
app.post('/api/auth/sessionLogin', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) {
    return res.status(401).json({ error: 'UNAUTHORIZED — idToken required' });
  }

  try {
    let sessionCookie;

    if (firebaseAdmin) {
      // Real Firebase Admin: verify idToken and create session cookie
      const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
      sessionCookie = await firebaseAdmin.auth().createSessionCookie(idToken, {
        expiresIn: SESSION_TTL_MS
      });
      logger.info('Session created via Firebase Admin', { uid: decodedToken.uid });
    } else {
      // Mock mode for development/testing
      sessionCookie = `heady_dev_session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      logger.info('Session created in mock mode');
    }

    const options = {
      maxAge: SESSION_TTL_MS,
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/'
    };
    res.cookie('__heady_session', sessionCookie, options);
    res.json({ status: 'success' });
  } catch (err) {
    logger.error('Session login failed', { error: err.message });
    res.status(401).json({ error: 'Session creation failed' });
  }
});

// ─── Session Logout ──────────────────────────────────────────────────────────
app.post('/api/auth/sessionLogout', (_req, res) => {
  res.clearCookie('__heady_session', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/'
  });
  logger.info('Session cleared');
  res.json({ status: 'logged_out' });
});

// ─── Session Verify (check if logged in) ─────────────────────────────────────
app.get('/api/auth/sessionVerify', async (req, res) => {
  const sessionCookie = req.cookies.__heady_session;
  if (!sessionCookie) {
    return res.status(401).json({ authenticated: false });
  }

  try {
    if (firebaseAdmin) {
      const decoded = await firebaseAdmin.auth().verifySessionCookie(sessionCookie, true);
      res.json({ authenticated: true, uid: decoded.uid, email: decoded.email });
    } else {
      // Mock mode: accept any cookie as valid
      res.json({ authenticated: true, uid: 'dev-user', email: 'dev@heady.local' });
    }
  } catch (err) {
    logger.warn('Session verification failed', { error: err.message });
    res.status(401).json({ authenticated: false });
  }
});

// ─── Start Server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3310;
app.listen(PORT, () => {
  logger.info(`Auth Session Server started on port ${PORT}`, {
    mode: firebaseAdmin ? 'production' : 'mock',
    corsOrigins: ALLOWED_ORIGINS.length
  });
});
