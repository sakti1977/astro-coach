/**
 * Sliding-window rate limiter with an optional Upstash Redis backend.
 *
 * If Upstash env vars are configured, requests are counted in Redis so limits hold
 * across serverless instances — including anonymous chart/geocode windows that use
 * a different limit than the default. Otherwise, this falls back to a local
 * in-memory limiter that is fine for development and single-process deployments.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from "@/lib/constants";

interface Counter {
  count: number;
  resetAt: number; // unix ms
}

const store = new Map<string, Counter>();

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis =
  upstashUrl && upstashToken ? new Redis({ url: upstashUrl, token: upstashToken }) : null;

const distributedLimiters = new Map<string, Ratelimit>();

function getDistributedLimiter(limit: number, windowMs: number): Ratelimit | null {
  if (!redis) return null;
  const key = `${limit}:${windowMs}`;
  const cached = distributedLimiters.get(key);
  if (cached) return cached;

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${Math.max(1, Math.ceil(windowMs / 1000))} s`),
    prefix: `astro-coach:rate-limit:${key}`,
    analytics: false,
  });
  distributedLimiters.set(key, limiter);
  return limiter;
}

function checkLocalRateLimit(
  key: string,
  limit = RATE_LIMIT_MAX,
  windowMs = RATE_LIMIT_WINDOW_MS
): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;

  entry.count++;
  return true;
}

/**
 * Returns true (request allowed) or false (rate limit exceeded).
 *
 * @param key       Unique key per caller — preferably a user id, with IP as fallback.
 * @param limit     Maximum requests per window (default RATE_LIMIT_MAX).
 * @param windowMs  Window length in milliseconds (default RATE_LIMIT_WINDOW_MS).
 */
export async function checkRateLimit(
  key: string,
  limit = RATE_LIMIT_MAX,
  windowMs = RATE_LIMIT_WINDOW_MS
): Promise<boolean> {
  const distributed = getDistributedLimiter(limit, windowMs);
  if (!distributed) {
    return checkLocalRateLimit(key, limit, windowMs);
  }

  try {
    const result = await distributed.limit(key);
    return result.success;
  } catch (error) {
    console.error("Upstash rate limit fallback:", error);
    return checkLocalRateLimit(key, limit, windowMs);
  }
}
