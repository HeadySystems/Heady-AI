/**
 * © 2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Heady φ-Pure Latent OS — RateLimiter Durable Object
 *
 * Sliding-window rate limiter implemented as a Cloudflare Durable Object.
 * Uses φ-math Fibonacci-tiered limits and DO persistent storage.
 *
 * Tier limits (requests / window):
 *   Free:       FIB[5]  =  8  req / 60 s
 *   Pro:        FIB[7]  = 21  req / 60 s
 *   Enterprise: FIB[9]  = 55  req / 60 s
 *
 * Algorithm: sliding-window log
 *  - Stores an array of request timestamps in DO storage keyed by identifier.
 *  - On each /check, purges entries older than windowMs, appends current time,
 *    persists, and compares count against tier limit.
 *  - Alarm fires at window expiry to clean up fully-expired windows.
 *
 * @module cloudflare-edge/rate-limiter-do
 */

import { FIB, PHI, PSI, CSL } from '../../shared/phi-math';

// ---------------------------------------------------------------------------
// φ-Math Fibonacci tier limits
// ---------------------------------------------------------------------------
const RATE_LIMITS: Record<'free' | 'pro' | 'enterprise', number> = {
  free:       FIB[5],   // 8  requests / window
  pro:        FIB[7],   // 21 requests / window
  enterprise: FIB[9],   // 55 requests / window
} as const;

// Default sliding window: 60 000 ms (1 minute)
const DEFAULT_WINDOW_MS = 60_000;

// Alarm scheduling: set alarm FIB[9] seconds (55 s) after last activity
// so that DO storage is cleaned up promptly after window expiry.
const ALARM_BUFFER_MS = FIB[9] * 1000; // 55 000 ms

// ---------------------------------------------------------------------------
// Storage key helpers
// ---------------------------------------------------------------------------
function windowKey(identifier: string): string {
  return `window:${identifier}`;
}

function metaKey(identifier: string): string {
  return `meta:${identifier}`;
}

// ---------------------------------------------------------------------------
// Request / response shapes
// ---------------------------------------------------------------------------
interface CheckRequest {
  identifier: string;
  tier:       'free' | 'pro' | 'enterprise';
  windowMs?:  number;
}

interface CheckResponse {
  allowed:   boolean;
  remaining: number;
  resetAt:   number;
  tier:      'free' | 'pro' | 'enterprise';
  count:     number;
  limit:     number;
  windowMs:  number;
  coherenceScore: number;
}

interface WindowMeta {
  identifier: string;
  tier:       'free' | 'pro' | 'enterprise';
  windowMs:   number;
  lastSeen:   number;
}

// ---------------------------------------------------------------------------
// Durable Object implementation
// ---------------------------------------------------------------------------
export class RateLimiterDO implements DurableObject {
  private readonly state:   DurableObjectState;
  private readonly storage: DurableObjectStorage;

  constructor(state: DurableObjectState) {
    this.state   = state;
    this.storage = state.storage;

    // Ensure alarm is set on reconstruction after eviction
    this.state.blockConcurrencyWhile(async () => {
      const alarm = await this.storage.getAlarm();
      if (alarm === null) {
        // No outstanding alarm — will be set on first check
      }
    });
  }

  // --------------------------------------------------------------------------
  // fetch() — the only entry point for requests to this DO
  // --------------------------------------------------------------------------
  async fetch(request: Request): Promise<Response> {
    const url      = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === '/check' && request.method === 'POST') {
      return this.handleCheck(request);
    }

    if (pathname === '/reset' && request.method === 'POST') {
      return this.handleReset(request);
    }

    if (pathname === '/status' && request.method === 'GET') {
      return this.handleStatus(url);
    }

    return new Response(
      JSON.stringify({ error: { code: 'NOT_FOUND', message: `No route: ${pathname}` } }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // --------------------------------------------------------------------------
  // /check — sliding-window rate limit check
  // --------------------------------------------------------------------------
  private async handleCheck(request: Request): Promise<Response> {
    let body: CheckRequest;
    try {
      body = await request.json<CheckRequest>();
    } catch {
      return this.jsonError(400, 'INVALID_JSON', 'Request body must be valid JSON');
    }

    const { identifier, tier, windowMs = DEFAULT_WINDOW_MS } = body;

    if (!identifier || typeof identifier !== 'string') {
      return this.jsonError(400, 'MISSING_IDENTIFIER', 'identifier is required');
    }
    if (!['free', 'pro', 'enterprise'].includes(tier)) {
      return this.jsonError(400, 'INVALID_TIER', `tier must be free | pro | enterprise`);
    }

    const limit  = RATE_LIMITS[tier];
    const now    = Date.now();
    const cutoff = now - windowMs;
    const wKey   = windowKey(identifier);
    const mKey   = metaKey(identifier);

    // Read current window timestamps and purge expired entries
    const timestamps: number[] = (await this.storage.get<number[]>(wKey)) ?? [];
    const active = timestamps.filter(ts => ts > cutoff);

    // Determine if this request is within the limit
    const allowed   = active.length < limit;
    const remaining = Math.max(0, limit - active.length - (allowed ? 1 : 0));

    if (allowed) {
      active.push(now);
    }

    // Compute resetAt: earliest timestamp + windowMs (first entry will expire next)
    const resetAt = active.length > 0
      ? active[0] + windowMs
      : now + windowMs;

    // Persist updated window
    await this.storage.put(wKey, active);

    // Persist metadata for alarm-based cleanup
    const meta: WindowMeta = { identifier, tier, windowMs, lastSeen: now };
    await this.storage.put(mKey, meta);

    // Schedule alarm to clean up this window after it fully expires
    const alarmTime = now + windowMs + ALARM_BUFFER_MS;
    const currentAlarm = await this.storage.getAlarm();
    if (currentAlarm === null || currentAlarm > alarmTime) {
      await this.storage.setAlarm(alarmTime);
    }

    // Coherence score: ratio of remaining capacity, phi-weighted
    // Full capacity → CSL.CRITICAL (0.927), half → CSL.MEDIUM (0.809), zero → CSL.MINIMUM (0.500)
    const capacityRatio  = remaining / limit;
    const coherenceScore = CSL.MINIMUM + (CSL.CRITICAL - CSL.MINIMUM) * capacityRatio;

    const response: CheckResponse = {
      allowed,
      remaining,
      resetAt,
      tier,
      count:   active.length,
      limit,
      windowMs,
      coherenceScore: Math.round(coherenceScore * 1000) / 1000,
    };

    return new Response(JSON.stringify(response), {
      status:  200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // --------------------------------------------------------------------------
  // /reset — clears rate limit for an identifier (admin use)
  // --------------------------------------------------------------------------
  private async handleReset(request: Request): Promise<Response> {
    let body: { identifier: string };
    try {
      body = await request.json<{ identifier: string }>();
    } catch {
      return this.jsonError(400, 'INVALID_JSON', 'Request body must be valid JSON');
    }

    const { identifier } = body;
    if (!identifier || typeof identifier !== 'string') {
      return this.jsonError(400, 'MISSING_IDENTIFIER', 'identifier is required');
    }

    await this.storage.delete(windowKey(identifier));
    await this.storage.delete(metaKey(identifier));

    return new Response(
      JSON.stringify({ reset: true, identifier, timestamp: new Date().toISOString() }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // --------------------------------------------------------------------------
  // /status — inspect current window state for an identifier (debug/ops)
  // --------------------------------------------------------------------------
  private async handleStatus(url: URL): Promise<Response> {
    const identifier = url.searchParams.get('identifier');
    if (!identifier) {
      return this.jsonError(400, 'MISSING_IDENTIFIER', 'identifier query param required');
    }

    const now        = Date.now();
    const meta       = await this.storage.get<WindowMeta>(metaKey(identifier));
    const windowMs   = meta?.windowMs ?? DEFAULT_WINDOW_MS;
    const tier       = meta?.tier ?? 'free';
    const cutoff     = now - windowMs;
    const limit      = RATE_LIMITS[tier];
    const timestamps = (await this.storage.get<number[]>(windowKey(identifier))) ?? [];
    const active     = timestamps.filter(ts => ts > cutoff);
    const remaining  = Math.max(0, limit - active.length);
    const resetAt    = active.length > 0 ? active[0] + windowMs : now + windowMs;

    return new Response(
      JSON.stringify({
        identifier,
        tier,
        limit,
        count:     active.length,
        remaining,
        resetAt,
        windowMs,
        phiLimitFibIndex: tier === 'enterprise' ? 9 : tier === 'pro' ? 7 : 5,
        phi:       PHI,
        psi:       PSI,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // --------------------------------------------------------------------------
  // alarm() — called by the Workers runtime to clean up expired windows
  // --------------------------------------------------------------------------
  async alarm(): Promise<void> {
    const now = Date.now();

    // List all stored keys and purge entries whose entire window has expired
    const allKeys = await this.storage.list<unknown>();
    const purgeOps: Promise<boolean | void>[] = [];

    for (const [key, value] of allKeys) {
      if (key.startsWith('window:')) {
        const timestamps = value as number[];
        // Determine the window duration from corresponding metadata
        const identifier = key.slice('window:'.length);
        const meta       = await this.storage.get<WindowMeta>(metaKey(identifier));
        const windowMs   = meta?.windowMs ?? DEFAULT_WINDOW_MS;
        const cutoff     = now - windowMs;

        const still_active = timestamps.filter(ts => ts > cutoff);

        if (still_active.length === 0) {
          // Entire window has expired — delete both window and meta
          purgeOps.push(this.storage.delete(key));
          purgeOps.push(this.storage.delete(metaKey(identifier)));
        } else {
          // Update to trimmed list
          purgeOps.push(this.storage.put(key, still_active));
        }
      }
    }

    await Promise.all(purgeOps);

    // Reschedule alarm if any keys remain
    const remaining = await this.storage.list();
    if (remaining.size > 0) {
      await this.storage.setAlarm(now + DEFAULT_WINDOW_MS + ALARM_BUFFER_MS);
    }
  }

  // --------------------------------------------------------------------------
  // Helper — structured JSON error response
  // --------------------------------------------------------------------------
  private jsonError(status: number, code: string, message: string): Response {
    return new Response(
      JSON.stringify({ error: { code, message, timestamp: new Date().toISOString() } }),
      { status, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
