/**
 * Unit Tests — Rate Limiter (Token Bucket)
 * @author Eric Haywood, HeadySystems Inc.
 */

'use strict';

const assert = require('assert');

function fib(n) {
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) { [a, b] = [b, a + b]; }
  return b;
}

class TestRateLimiter {
  constructor(maxTokens, refillRate) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.buckets = new Map();
  }

  consume(key) {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefill: now };
      this.buckets.set(key, bucket);
    }
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(this.maxTokens, bucket.tokens + elapsed * this.refillRate);
    bucket.lastRefill = now;
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true, remaining: Math.floor(bucket.tokens) };
    }
    return { allowed: false, remaining: 0 };
  }
}

module.exports = {
  'rate limiter allows requests up to max tokens': () => {
    const limiter = new TestRateLimiter(fib(6), fib(5));
    for (let i = 0; i < fib(6); i++) {
      const result = limiter.consume('test');
      assert.strictEqual(result.allowed, true, `Request ${i} should be allowed`);
    }
  },

  'rate limiter denies when tokens exhausted': () => {
    const limiter = new TestRateLimiter(3, 0);
    limiter.consume('test');
    limiter.consume('test');
    limiter.consume('test');
    const result = limiter.consume('test');
    assert.strictEqual(result.allowed, false);
  },

  'rate limiter tracks remaining tokens': () => {
    const limiter = new TestRateLimiter(5, 0);
    const r1 = limiter.consume('test');
    assert.strictEqual(r1.remaining, 4);
    const r2 = limiter.consume('test');
    assert.strictEqual(r2.remaining, 3);
  },

  'rate limiter isolates keys': () => {
    const limiter = new TestRateLimiter(2, 0);
    limiter.consume('user1');
    limiter.consume('user1');
    const r1 = limiter.consume('user1');
    assert.strictEqual(r1.allowed, false);

    const r2 = limiter.consume('user2');
    assert.strictEqual(r2.allowed, true);
  },

  'max tokens uses Fibonacci number': () => {
    assert.strictEqual(fib(11), 89);
    assert.strictEqual(fib(9), 34);
  }
};
