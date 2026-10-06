import { z } from "zod";
import type { ParseResult } from "@/lib/profile-schema";

/**
 * Privacy-light launch funnel (visit → chart_created → coach_message → return).
 *
 * First-party only: a random id the browser makes for itself, three event
 * names, a UTC day and (on a first visit) the referring hostname. No cookie,
 * no IP, no user agent, no account id, no birth data, no message text. The id
 * is never joined to an account, so a row can't be traced back to a person.
 */
export const ANALYTICS_EVENTS = ["visit", "chart_created", "coach_message"] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

/** Rows older than this are deleted by the daily cron. Keep in step with /privacy. */
export const ANALYTICS_RETENTION_DAYS = 180;

/** Hostname-ish token only: lowercase letters, digits, dot, dash, underscore. */
const REF_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

const eventSchema = z.object({
  event: z.enum(ANALYTICS_EVENTS),
  visitorId: z.uuid(),
  ref: z.string().optional(),
});

export interface AnalyticsInput {
  event: AnalyticsEvent;
  visitorId: string;
  /** Only meaningful on a visitor's first visit; dropped if it isn't a clean token. */
  ref: string | null;
}

export function parseAnalyticsEvent(input: unknown): ParseResult<AnalyticsInput> {
  const result = eventSchema.safeParse(input);
  if (!result.success) return { ok: false, error: "Invalid event." };
  const ref = result.data.ref?.trim().toLowerCase() ?? "";
  return {
    ok: true,
    value: {
      event: result.data.event,
      visitorId: result.data.visitorId.toLowerCase(),
      ref: result.data.event === "visit" && REF_PATTERN.test(ref) ? ref : null,
    },
  };
}

/** Crawlers and headless browsers would swamp a funnel this small. */
export function isLikelyBot(userAgent: string | null): boolean {
  if (!userAgent) return true;
  return /bot|crawl|spider|slurp|headless|lighthouse|facebookexternalhit|preview|curl|wget|python-requests|httpclient/i.test(
    userAgent
  );
}

/** YYYY-MM-DD in UTC. The server decides the day, never the client. */
export function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** First day (UTC) that should still be kept; anything earlier is pruned. */
export function retentionCutoffDay(now: Date = new Date()): string {
  return utcDay(new Date(now.getTime() - ANALYTICS_RETENTION_DAYS * 24 * 60 * 60 * 1000));
}

/**
 * Hostname for the acquisition source: utm_source wins, else the referrer's
 * hostname. Own-site referrers (in-app navigation) and anything that isn't a
 * clean token return null, which the funnel reports as "direct".
 */
export function sourceFromLocation(opts: {
  search: string;
  referrer: string;
  ownHost: string;
}): string | null {
  const utm = new URLSearchParams(opts.search).get("utm_source")?.trim().toLowerCase();
  if (utm && REF_PATTERN.test(utm)) return utm;
  if (!opts.referrer) return null;
  try {
    const host = new URL(opts.referrer).hostname.toLowerCase().replace(/^www\./, "");
    if (host === opts.ownHost.toLowerCase().replace(/^www\./, "")) return null;
    return REF_PATTERN.test(host) ? host : null;
  } catch {
    return null;
  }
}
