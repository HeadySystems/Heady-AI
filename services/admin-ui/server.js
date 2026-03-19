import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 8080;

// ─── API Keys from env ───
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_HEADY || '';
const GROQ_KEY = process.env.GROQ_API_KEY || '';

app.use(express.json());

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.use(express.static(join(__dirname, 'public')));

// ─── Health ───
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ─── Chat API — routes to best available AI provider ───
app.post('/api/chat', async (req, res) => {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    const systemPrompt = `You are HeadyBuddy, the AI assistant for the Heady™ ecosystem. You are helpful, concise, and knowledgeable about AI systems, Sacred Geometry, and sovereign AI architecture. Answer naturally and helpfully.`;

    // Try providers in order: Groq (fastest) → OpenAI → Anthropic → Gemini
    const providers = [
        { name: 'groq', key: GROQ_KEY, fn: callGroq },
        { name: 'openai', key: OPENAI_KEY, fn: callOpenAI },
        { name: 'anthropic', key: ANTHROPIC_KEY, fn: callAnthropic },
        { name: 'gemini', key: GEMINI_KEY, fn: callGemini },
    ];

    for (const p of providers) {
        if (!p.key) continue;
        try {
            const result = await p.fn(p.key, systemPrompt, message, history);
            return res.json({ response: result.text, provider: p.name, model: result.model });
        } catch (err) {
            console.error(`[${p.name}] failed:`, err.message);
        }
    }

    return res.json({
        response: "I'm HeadyBuddy — currently all AI providers are offline. Please check your API keys in environment variables.",
        provider: 'fallback', model: 'none'
    });
});

// ─── Provider implementations ───
async function callGroq(key, system, message, history) {
    const messages = [{ role: 'system', content: system }, ...history.slice(-10), { role: 'user', content: message }];
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, max_tokens: 2048, temperature: 0.7 })
    });
    if (!r.ok) throw new Error(`Groq ${r.status}`);
    const d = await r.json();
    return { text: d.choices[0].message.content, model: 'llama-3.3-70b' };
}

async function callOpenAI(key, system, message, history) {
    const messages = [{ role: 'system', content: system }, ...history.slice(-10), { role: 'user', content: message }];
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 2048, temperature: 0.7 })
    });
    if (!r.ok) throw new Error(`OpenAI ${r.status}`);
    const d = await r.json();
    return { text: d.choices[0].message.content, model: 'gpt-4o-mini' };
}

async function callAnthropic(key, system, message, history) {
    const msgs = [...history.slice(-10), { role: 'user', content: message }];
    const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', system, messages: msgs, max_tokens: 2048 })
    });
    if (!r.ok) throw new Error(`Anthropic ${r.status}`);
    const d = await r.json();
    return { text: d.content[0].text, model: 'claude-sonnet' };
}

async function callGemini(key, system, message, _history) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `${system}\n\nUser: ${message}` }] }], generationConfig: { maxOutputTokens: 2048, temperature: 0.7 } })
    });
    if (!r.ok) throw new Error(`Gemini ${r.status}`);
    const d = await r.json();
    return { text: d.candidates[0].content.parts[0].text, model: 'gemini-2.0-flash' };
}

// ─── System status ───
app.get('/api/status', (_req, res) => {
    const providers = [];
    if (GROQ_KEY) providers.push({ name: 'Groq', model: 'llama-3.3-70b', status: 'ready' });
    if (OPENAI_KEY) providers.push({ name: 'OpenAI', model: 'gpt-4o-mini', status: 'ready' });
    if (ANTHROPIC_KEY) providers.push({ name: 'Anthropic', model: 'claude-sonnet', status: 'ready' });
    if (GEMINI_KEY) providers.push({ name: 'Gemini', model: 'gemini-2.0-flash', status: 'ready' });
    res.json({
        status: 'operational',
        providers,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        ts: new Date().toISOString()
    });
});

// ─── Catch-all → SPA ───
app.get('*', (_req, res) => res.sendFile(join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`⚡ Heady Admin UI running on port ${PORT}`));
