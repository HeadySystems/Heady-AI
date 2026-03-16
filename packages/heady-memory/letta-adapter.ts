// packages/heady-memory/letta-adapter.ts
// Extracted pattern from letta-ai/letta (Apache 2.0)
// Maps Letta's memory_blocks to Heady's CSL-gated memory tiers
//
// HEADY_BRAND:BEGIN
// © 2026 HeadySystems Inc. — Letta Memory Block Integration
// HEADY_BRAND:END

export interface HeadyMemoryBlocks {
  human: string;        // What Heady knows about the user
  persona: string;      // HeadyBuddy's current personality state
  organization: string; // Shared org context (all agents in workspace)
}

export interface LettaClientConfig {
  baseUrl: string;
}

export class HeadyLettaAdapter {
  private baseUrl: string;
  private agentCache = new Map<string, string>(); // userId → agentId

  constructor(config?: LettaClientConfig) {
    // Self-hosted Letta — runs on Ryzen 9 or Colab, exposed via Cloudflare tunnel
    this.baseUrl = config?.baseUrl
      || process.env.LETTA_URL
      || 'https://letta.headysystems.com';
  }

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });
    if (!res.ok) {
      throw new Error(`Letta API error: ${res.status} ${res.statusText} on ${path}`);
    }
    return res.json();
  }

  async getOrCreateAgent(userId: string, displayName: string): Promise<string> {
    if (this.agentCache.has(userId)) return this.agentCache.get(userId)!;

    // Check for existing agent
    const agents = await this.request('/v1/agents');
    const existing = agents.find((a: any) => a.name === `heady-user-${userId}`);
    if (existing) {
      this.agentCache.set(userId, existing.id);
      return existing.id;
    }

    // Create shared org block (one per workspace, shared across all agents)
    const orgBlock = await this.request('/v1/blocks', {
      method: 'POST',
      body: JSON.stringify({
        label: 'organization',
        description: 'Shared Heady workspace context — updated by all agents',
        value: 'Heady AI operating system. User workspace initialized.',
      }),
    });

    // Create user-specific agent with 3 memory blocks
    const agent = await this.request('/v1/agents', {
      method: 'POST',
      body: JSON.stringify({
        name: `heady-user-${userId}`,
        model: process.env.LETTA_MODEL || 'openai/gpt-4.1',
        embedding: process.env.LETTA_EMBEDDING || 'openai/text-embedding-3-small',
        memoryBlocks: [
          { label: 'human', value: `User: ${displayName}. Preferences: unknown. Learning...` },
          { label: 'persona', value: 'I am HeadyBuddy, your AI operating system companion. I remember everything.' },
        ],
        blockIds: [orgBlock.id],
        tools: ['web_search', 'run_code'],
      }),
    });

    this.agentCache.set(userId, agent.id);
    return agent.id;
  }

  async sendMessage(userId: string, content: string): Promise<string> {
    const agentId = await this.getOrCreateAgent(userId, 'User');
    const response = await this.request(`/v1/agents/${agentId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content }],
      }),
    });

    // Extract text response
    const textMsg = response.messages?.find((m: any) => m.messageType === 'assistant_message');
    return textMsg?.content || '';
  }

  async readMemoryBlocks(userId: string): Promise<HeadyMemoryBlocks> {
    const agentId = await this.getOrCreateAgent(userId, 'User');
    const agent = await this.request(`/v1/agents/${agentId}`);

    const blocks: Record<string, string> = {};
    for (const block of agent.memoryBlocks || []) {
      blocks[block.label] = block.value;
    }
    return blocks as HeadyMemoryBlocks;
  }

  async updateMemoryBlock(userId: string, label: string, value: string): Promise<void> {
    const agentId = await this.getOrCreateAgent(userId, 'User');
    const agent = await this.request(`/v1/agents/${agentId}`);
    const block = agent.memoryBlocks?.find((b: any) => b.label === label);
    if (!block) throw new Error(`Memory block "${label}" not found for user ${userId}`);

    await this.request(`/v1/blocks/${block.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ value }),
    });
  }
}
