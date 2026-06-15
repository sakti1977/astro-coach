/**
 * Sliding-window rate limiter with an optional Upstash Redis backend.
 *
 * If Upstash env vars are configured, requests are counted in Redis so limits hold
 * across serverless instances. Otherwise, this falls back to a local in-memory
 * limiter that is fine for development and single-process deployments.
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

const distributedLimiter = upstashUrl && upstashToken
  ? new Ratelimit({
      redis: new Redis({ url: upstashUrl, token: upstashToken }),
      limiter: Ratelimit.slidingWindow(
        RATE_LIMIT_MAX,
        `${Math.max(1, Math.ceil(RATE_LIMIT_WINDOW_MS / 1000))} s`
      ),
      prefix: "astro-coach:rate-limit",
      analytics: false,
    })
  : null;

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
  if (!distributedLimiter || limit !== RATE_LIMIT_MAX || windowMs !== RATE_LIMIT_WINDOW_MS) {
    return checkLocalRateLimit(key, limit, windowMs);
  }

  try {
    const result = await distributedLimiter.limit(key);
    return result.success;
  } catch (error) {
    console.error("Upstash rate limit fallback:", error);
    return checkLocalRateLimit(key, limit, windowMs);
  }
}
