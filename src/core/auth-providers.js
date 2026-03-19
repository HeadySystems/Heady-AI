/**
 * Heady — Auth Providers
 * Pure data: OAuth and API key provider definitions.
 * Extracted from dynamic-site-server.js for single-responsibility.
 */

const AUTH_PROVIDERS = {
  oauth: [
    { id: 'google', name: 'Google', icon: '🔵', color: '#4285F4' },
    { id: 'github', name: 'GitHub', icon: '⚫', color: '#333333' },
    { id: 'microsoft', name: 'Microsoft', icon: '🟦', color: '#00A4EF' },
    { id: 'apple', name: 'Apple', icon: '🍎', color: '#000000' },
    { id: 'facebook', name: 'Facebook', icon: '🔵', color: '#1877F2' },
    { id: 'amazon', name: 'Amazon', icon: '📦', color: '#FF9900' },
    { id: 'discord', name: 'Discord', icon: '💬', color: '#5865F2' },
    { id: 'slack', name: 'Slack', icon: '💼', color: '#4A154B' },
    { id: 'linkedin', name: 'LinkedIn', icon: '💼', color: '#0A66C2' },
    { id: 'twitter', name: 'X (Twitter)', icon: '✖️', color: '#000000' },
    { id: 'spotify', name: 'Spotify', icon: '🟢', color: '#1DB954' },
    { id: 'huggingface', name: 'Hugging Face', icon: '🤗', color: '#FFD21E' },
  ],
  apikey: [
    { id: 'openai', name: 'OpenAI', icon: '🧠', color: '#10A37F', prefix: 'sk-' },
    { id: 'claude', name: 'Claude', icon: '🟠', color: '#D97706', prefix: 'sk-ant-' },
    { id: 'gemini', name: 'Gemini', icon: '💎', color: '#4285F4', prefix: 'AI' },
    { id: 'perplexity', name: 'Perplexity', icon: '🔍', color: '#20808D', prefix: 'pplx-' },
    { id: 'mistral', name: 'Mistral', icon: '🌊', color: '#FF7000', prefix: '' },
    { id: 'cohere', name: 'Cohere', icon: '🟣', color: '#39594D', prefix: '' },
    { id: 'groq', name: 'Groq', icon: '⚡', color: '#F55036', prefix: 'gsk_' },
    { id: 'replicate', name: 'Replicate', icon: '🔄', color: '#3D3D3D', prefix: 'r8_' },
    { id: 'together', name: 'Together AI', icon: '🤝', color: '#6366F1', prefix: '' },
    { id: 'fireworks', name: 'Fireworks', icon: '🎆', color: '#FF6B35', prefix: 'fw_' },
    { id: 'deepseek', name: 'DeepSeek', icon: '🔬', color: '#0066FF', prefix: 'sk-' },
    { id: 'xai', name: 'xAI (Grok)', icon: '❌', color: '#000000', prefix: 'xai-' },
    { id: 'anthropic', name: 'Anthropic', icon: '🟤', color: '#C96442', prefix: 'sk-ant-' },
  ],
};

// ── In-memory stores ────────────────────────────────────────
const users = new Map();
const sessions = new Map();

module.exports = { AUTH_PROVIDERS };
