import { describe, expect, it } from "vitest";
import {
  ANALYTICS_RETENTION_DAYS,
  isLikelyBot,
  parseAnalyticsEvent,
  retentionCutoffDay,
  sourceFromLocation,
  utcDay,
} from "./analytics";

const vid = "3f2b8c1e-6a4d-4e7b-9d21-0c5a7e8f1b34";

describe("parseAnalyticsEvent", () => {
  it("accepts each funnel event and lowercases the id", () => {
    for (const event of ["visit", "chart_created", "coach_message"]) {
      const r = parseAnalyticsEvent({ event, visitorId: vid.toUpperCase() });
      expect(r.ok && r.value).toEqual({ event, visitorId: vid, ref: null });
    }
  });

  it("keeps a clean referrer token on a visit only", () => {
    const visit = parseAnalyticsEvent({ event: "visit", visitorId: vid, ref: " Google.com " });
    expect(visit.ok && visit.value.ref).toBe("google.com");
    const other = parseAnalyticsEvent({ event: "chart_created", visitorId: vid, ref: "google.com" });
    expect(other.ok && other.value.ref).toBeNull();
  });

  it.each(["https://evil.example/x", "a b", "<script>", "x".repeat(65), ""])("drops an unclean ref %j", (ref) => {
    const r = parseAnalyticsEvent({ event: "visit", visitorId: vid, ref });
    expect(r.ok && r.value.ref).toBeNull();
  });

  it.each([
    null,
    {},
    { event: "pageview", visitorId: vid },
    { event: "visit", visitorId: "not-a-uuid" },
    { event: "visit" },
  ])("rejects %j", (input) => {
    expect(parseAnalyticsEvent(input).ok).toBe(false);
  });
});

describe("isLikelyBot", () => {
  it("flags crawlers, headless browsers and a missing user agent", () => {
    expect(isLikelyBot(null)).toBe(true);
    expect(isLikelyBot("Mozilla/5.0 (compatible; SemrushBot/7~bl)")).toBe(true);
    expect(isLikelyBot("Mozilla/5.0 HeadlessChrome/151.0.7922.34 Safari/537.36")).toBe(true);
    expect(isLikelyBot("facebookexternalhit/1.1")).toBe(true);
  });

  it("lets ordinary browsers through", () => {
    expect(isLikelyBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1")).toBe(false);
    expect(isLikelyBot("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36")).toBe(false);
  });
});

describe("days and retention", () => {
  it("utcDay is the UTC calendar date, not the local one", () => {
    expect(utcDay(new Date("2026-10-06T23:59:59Z"))).toBe("2026-10-06");
    expect(utcDay(new Date("2026-10-07T00:00:00Z"))).toBe("2026-10-07");
  });

  it("retention cutoff is exactly the retention window back", () => {
    expect(ANALYTICS_RETENTION_DAYS).toBe(180);
    expect(retentionCutoffDay(new Date("2026-10-06T02:30:00Z"))).toBe("2026-04-09");
  });
});

describe("sourceFromLocation", () => {
  const ownHost = "jyotishcoach.com";

  it("prefers utm_source over the referrer", () => {
    expect(sourceFromLocation({ search: "?utm_source=Reddit", referrer: "https://t.co/x", ownHost })).toBe("reddit");
  });

  it("uses the referrer hostname without www", () => {
    expect(sourceFromLocation({ search: "", referrer: "https://www.google.com/search?q=jyotish", ownHost })).toBe("google.com");
  });

  it("treats own-site, empty and garbage referrers as direct", () => {
    expect(sourceFromLocation({ search: "", referrer: "https://jyotishcoach.com/chart", ownHost })).toBeNull();
    expect(sourceFromLocation({ search: "", referrer: "https://www.jyotishcoach.com/", ownHost })).toBeNull();
    expect(sourceFromLocation({ search: "", referrer: "", ownHost })).toBeNull();
    expect(sourceFromLocation({ search: "", referrer: "not a url", ownHost })).toBeNull();
  });
});
