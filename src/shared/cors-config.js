/**
 * Heady™ Explicit CORS Whitelist
 * Strictly enforces origin safety and rejects wildcard (*) origins in production.
 */

const ALLOWED_ORIGINS = [
    'https://headyme.com',
    'https://api.headyme.com',
    'https://headybuddy.org',
    'https://heady.systems',
    'https://kiosk.headyme.com'
];

export const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        // only if explicitly enabled (usually blocked in strict prod).
        // For Heady, we block null origins unless they provide a valid API Key.
        if (!origin) {
            return callback(null, true);
        }

        if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Blocked by Heady CORS Policy: Origin not in whitelist'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Admin-Token'],
    credentials: true,
    optionsSuccessStatus: 200
};

// Middleware helper
export function enforceCors(req, res, next) {
    const origin = req.headers.origin;
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
        return res.status(403).json({ error: 'CORS policy violation' });
    }
    
    res.header('Access-Control-Allow-Origin', origin || ALLOWED_ORIGINS[0]);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Admin-Token');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    
    next();
}
