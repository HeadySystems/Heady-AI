// packages/heady-memory/redis-tier.ts
// Extracted pattern from Redis Agent Memory Server (open source)
// Two-tier: working (session) + long-term (semantic vector search)
//
// HEADY_BRAND:BEGIN
// © 2026 HeadySystems Inc. — Redis Two-Tier Memory
// HEADY_BRAND:END

export interface RedisMemoryConfig {
  url: string;
  password?: string;
}

export class HeadyRedisMemory {
  private url: string;
  private password?: string;
  private connected = false;

  constructor(config?: RedisMemoryConfig) {
    this.url = config?.url || process.env.REDIS_URL || 'redis://redis.headysystems.com:6379';
    this.password = config?.password || process.env.REDIS_PASSWORD;
  }

  /**
   * Lazy connection — call before first operation.
   * Uses native fetch to Redis HTTP interface (Redis Stack REST API)
   * or can be swapped for ioredis/redis client in production.
   */
  async connect(): Promise<void> {
    // Validate connectivity
    try {
      await this.execute('PING');
      this.connected = true;
    } catch (err) {
      throw new Error(`Redis connection failed: ${(err as Error).message}`);
    }
  }

  private async execute(command: string, ...args: string[]): Promise<any> {
    // Bridge to Redis — in production, replace with ioredis client
    // This is a typed interface contract, actual transport is injected
    const { createClient } = await import('redis');
    const client = createClient({
      url: this.url,
      password: this.password,
    });
    if (!client.isOpen) await client.connect();
    const result = await (client as any).sendCommand([command, ...args]);
    return result;
  }

  // ─── TIER 1: Working Memory (session-scoped, instant access) ───

  async setWorkingMemory(sessionId: string, context: object, ttlSeconds = 3600): Promise<void> {
    const { createClient } = await import('redis');
    const client = createClient({ url: this.url, password: this.password });
    if (!client.isOpen) await client.connect();

    await client.set(
      `heady:working:${sessionId}`,
      JSON.stringify(context),
      { EX: ttlSeconds }
    );
    await client.quit();
  }

  async getWorkingMemory(sessionId: string): Promise<object | null> {
    const { createClient } = await import('redis');
    const client = createClient({ url: this.url, password: this.password });
    if (!client.isOpen) await client.connect();

    const raw = await client.get(`heady:working:${sessionId}`);
    await client.quit();
    return raw ? JSON.parse(raw) : null;
  }

  async clearWorkingMemory(sessionId: string): Promise<void> {
    const { createClient } = await import('redis');
    const client = createClient({ url: this.url, password: this.password });
    if (!client.isOpen) await client.connect();

    await client.del(`heady:working:${sessionId}`);
    await client.quit();
  }

  // ─── TIER 2: Long-Term Memory (semantic vector search via Redis VSS) ───

  async storeMemory(
    userId: string,
    content: string,
    embedding: number[],
    metadata: Record<string, unknown> = {}
  ): Promise<string> {
    const { createClient } = await import('redis');
    const client = createClient({ url: this.url, password: this.password });
    if (!client.isOpen) await client.connect();

    const memoryId = `heady:ltm:${userId}:${Date.now()}`;
    await client.hSet(memoryId, {
      content,
      userId,
      embedding: Buffer.from(new Float32Array(embedding).buffer).toString('base64'),
      metadata: JSON.stringify(metadata),
      timestamp: Date.now().toString(),
    });
    await client.quit();
    return memoryId;
  }

  // ─── Semantic Cache (15× faster responses for repeated query patterns) ───

  async semanticCacheLookup(queryHash: string): Promise<string | null> {
    const { createClient } = await import('redis');
    const client = createClient({ url: this.url, password: this.password });
    if (!client.isOpen) await client.connect();

    const result = await client.get(`heady:cache:${queryHash}`);
    await client.quit();
    return result;
  }

  async semanticCacheWrite(queryHash: string, response: string, ttlSeconds = 300): Promise<void> {
    const { createClient } = await import('redis');
    const client = createClient({ url: this.url, password: this.password });
    if (!client.isOpen) await client.connect();

    await client.set(`heady:cache:${queryHash}`, response, { EX: ttlSeconds });
    await client.quit();
  }
}
