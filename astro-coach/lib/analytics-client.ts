"use client";

import { sourceFromLocation, utcDay, type AnalyticsEvent } from "@/lib/analytics";

/**
 * Browser half of the launch funnel (see lib/analytics.ts for what is and is
 * not collected). Everything here fails silently: analytics must never break
 * the app, and it never runs when the visitor has said no.
 */
const STORAGE_KEY = "astro_coach_analytics";

interface AnalyticsState {
  /** Random per-browser id; nothing about it is derived from the person. */
  vid: string;
  /** Last UTC day each event was sent, so we send at most once a day per event. */
  sent: Partial<Record<AnalyticsEvent, string>>;
}

function readState(): AnalyticsState | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (parsed && typeof parsed.vid === "string" && parsed.sent && typeof parsed.sent === "object") {
      return parsed as AnalyticsState;
    }
  } catch {
    // Missing, corrupt or blocked storage: treated as a new visitor below.
  }
  return null;
}

function writeState(state: AnalyticsState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** Respect Do Not Track and Global Privacy Control, and skip local development. */
function optedOut(): boolean {
  if (typeof navigator === "undefined") return true;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (nav.doNotTrack === "1" || nav.globalPrivacyControl === true) return true;
  return process.env.NODE_ENV !== "production";
}

export function trackEvent(event: AnalyticsEvent): void {
  try {
    if (optedOut()) return;
    const today = utcDay();
    const existing = readState();
    const state: AnalyticsState = existing ?? { vid: crypto.randomUUID(), sent: {} };
    if (state.sent[event] === today) return;

    state.sent[event] = today;
    // If storage is blocked we can't remember the id, so every page load would
    // look like a new visitor and inflate the top of the funnel. Send nothing.
    if (!writeState(state)) return;

    const ref =
      event === "visit" && !existing
        ? sourceFromLocation({
            search: window.location.search,
            referrer: document.referrer,
            ownHost: window.location.hostname,
          })
        : null;

    void fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, visitorId: state.vid, ...(ref ? { ref } : {}) }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Never let analytics surface an error to the user.
  }
}
