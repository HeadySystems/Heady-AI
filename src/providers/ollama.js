import { Ollama } from 'ollama';

export class OllamaProvider {
  constructor() {
    this.client = new Ollama({ host: process.env.OLLAMA_HOST || 'http://ollama:11434' });
    this.name = 'ollama';
  }

  async chat(messages, options = {}) {
    // Provider-specific chat implementation
    throw new Error('Not yet implemented — replace stub');
  }

  async embed(text) {
    // Provider-specific embedding implementation
    throw new Error('Not yet implemented — replace stub');
  }

  health() {
    return { provider: this.name, status: 'configured' };
  }
}
