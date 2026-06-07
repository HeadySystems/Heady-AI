// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: src/providers/router.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * AI Provider Router
 * Selects the best model per task based on speed, cost, and quality.
 * Automatic fallback on failure via circuit breaker.
 */
import { AnthropicProvider } from './anthropic.js';
import { OpenaiProvider }    from './openai.js';
import { GeminiProvider }    from './gemini.js';
import { GroqProvider }      from './groq.js';
import { OllamaProvider }    from './ollama.js';

const TASK_ROUTING = {
  'reasoning':   ['anthropic', 'openai', 'gemini'],
  'coding':      ['anthropic', 'openai', 'groq'],
  'creative':    ['openai', 'anthropic', 'gemini'],
  'fast-chat':   ['groq', 'ollama', 'gemini'],
  'embedding':   ['openai', 'gemini', 'ollama'],
  'red-team':    ['groq', 'anthropic'],
  'local':       ['ollama'],
};

export class ProviderRouter {
  #providers = {};
  #circuitBreaker;

  constructor({ circuitBreaker }) {
    this.#circuitBreaker = circuitBreaker;
    this.#providers = {
      anthropic: new AnthropicProvider(),
      openai:    new OpenaiProvider(),
      gemini:    new GeminiProvider(),
      groq:      new GroqProvider(),
      ollama:    new OllamaProvider(),
    };
  }

  async route(task, messages, options = {}) {
    const chain = TASK_ROUTING[task] || TASK_ROUTING['reasoning'];
    for (const name of chain) {
      if (this.#circuitBreaker.isOpen(name)) continue;
      try {
        const result = await this.#providers[name].chat(messages, options);
        this.#circuitBreaker.recordSuccess(name);
        return { provider: name, result };
      } catch (err) {
        this.#circuitBreaker.recordFailure(name);
      }
    }
    throw new Error(`All providers failed for task: ${task}`);
  }

  status() {
    return Object.fromEntries(
      Object.entries(this.#providers).map(([k, v]) => [k, v.health()])
    );
  }
}
