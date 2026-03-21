/**
 * Vitest setup file — test environment bootstrap
 * - Jest compatibility shim (jest.fn → vi.fn)
 * - ioredis mock (prevents ECONNREFUSED when Redis not running)
 * - process.exit guard (prevents vitest crashes)
 */
import { vi } from 'vitest';

// ─── Jest Compatibility ─────────────────────────────────────────
globalThis.jest = vi;

// ─── Process.exit Guard ─────────────────────────────────────────
// Prevent services from killing the vitest process
const originalExit = process.exit;
process.exit = vi.fn((code) => {
    // In test context, throw instead of exiting
    if (code !== 0) {
        throw new Error(`process.exit unexpectedly called with "${code}"`);
    }
});

// ─── ioredis Mock ───────────────────────────────────────────────
// Auto-mock ioredis so tests don't need a running Redis instance
vi.mock('ioredis', () => {
    const store = new Map();

    class MockRedis {
        constructor() {
            this.status = 'ready';
            this._store = store;
        }
        async connect() { return this; }
        async ping() { return 'PONG'; }
        async get(key) { return this._store.get(key) || null; }
        async set(key, val) { this._store.set(key, val); return 'OK'; }
        async del(key) { this._store.delete(key); return 1; }
        async hset(key, field, val) {
            if (!this._store.has(key)) this._store.set(key, {});
            this._store.get(key)[field] = val;
            return 1;
        }
        async hget(key, field) {
            const obj = this._store.get(key);
            return obj ? obj[field] || null : null;
        }
        async hgetall(key) { return this._store.get(key) || {}; }
        async hmget(key, ...fields) {
            const obj = this._store.get(key) || {};
            return fields.flat().map(f => obj[f] || null);
        }
        async zadd() { return 1; }
        async zrange() { return []; }
        async zrangebyscore() { return []; }
        async lpush() { return 1; }
        async rpush() { return 1; }
        async lrange() { return []; }
        async publish() { return 0; }
        async subscribe() { return 0; }
        async unsubscribe() { return 0; }
        async keys(pattern) { 
            return [...this._store.keys()].filter(k => k.includes(pattern.replace('*', ''))); 
        }
        async exists(key) { return this._store.has(key) ? 1 : 0; }
        async expire() { return 1; }
        async ttl() { return -1; }
        async incr(key) {
            const val = parseInt(this._store.get(key) || '0', 10) + 1;
            this._store.set(key, String(val));
            return val;
        }
        async quit() { this.status = 'end'; }
        async disconnect() { this.status = 'end'; }
        on() { return this; }
        once() { return this; }
        removeListener() { return this; }
        pipeline() {
            const ops = [];
            const self = this;
            return {
                get: (...a) => { ops.push(['get', a]); return this; },
                set: (...a) => { ops.push(['set', a]); return this; },
                hset: (...a) => { ops.push(['hset', a]); return this; },
                hget: (...a) => { ops.push(['hget', a]); return this; },
                del: (...a) => { ops.push(['del', a]); return this; },
                zadd: (...a) => { ops.push(['zadd', a]); return this; },
                exec: async () => ops.map(() => [null, 'OK']),
            };
        }
        duplicate() { return new MockRedis(); }
    }

    MockRedis.Cluster = class MockCluster extends MockRedis {};

    return { default: MockRedis, Redis: MockRedis };
});

// ─── Suppress noisy console output in tests ─────────────────────
const originalWarn = console.warn;
const originalError = console.error;
console.warn = (...args) => {
    const msg = args[0]?.toString() || '';
    // Suppress ioredis and connection noise
    if (msg.includes('ioredis') || msg.includes('ECONNREFUSED') || msg.includes('Redis')) return;
    originalWarn.apply(console, args);
};
console.error = (...args) => {
    const msg = args[0]?.toString() || '';
    if (msg.includes('ioredis') || msg.includes('ECONNREFUSED') || msg.includes('Redis')) return;
    originalError.apply(console, args);
};
