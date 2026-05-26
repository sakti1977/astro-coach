/**
 * Simple in-memory sliding-window rate limiter.
 *
 * ⚠  This works correctly in a single-process runtime (local dev, self-hosted).
 *    On serverless platforms (Vercel) each cold-start gets its own counter store,
 *    so the effective limit is per-instance. For production replace with
 *    Upstash Redis + @upstash/ratelimit for true distributed rate limiting.
 */

interface Counter {
  count: number;
  resetAt: number; // unix ms
}

const store = new Map<string, Counter>();

/**
 * Returns true (request allowed) or false (rate limit exceeded).
 *
 * @param key       Unique key per client — typically the caller's IP address.
 * @param limit     Maximum requests per window (default 20).
 * @param windowMs  Window length in milliseconds (default 60 s).
 */
export function checkRateLimit(
  key: string,
  limit = 20,
  windowMs = 60_000
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
