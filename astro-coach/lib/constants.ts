/**
 * Centralised magic numbers for the Astro Coach application.
 * Import from here instead of scattering literals throughout the codebase.
 */

// ── Conversation window ────────────────────────────────────────────────────────
/** Messages shown in ChatInterface on component mount (from profile history). */
export const CHAT_HISTORY_DISPLAY = 20;
/** Messages sent to /api/coach on each request (sliding window). */
export const CHAT_WINDOW_API = 12;
/** Maximum messages persisted in localStorage profile. */
export const CHAT_HISTORY_MAX = 100;

// ── Claude token budgets ───────────────────────────────────────────────────────
export const MAX_TOKENS_COACH     = 2048;  // streaming coach replies (doubled to prevent mid-thought cutoff)
export const MAX_TOKENS_DASHA     = 1200;  // dasha prediction JSON (5 arrays × 4 items needs headroom)
export const MAX_TOKENS_VALIDATE  = 1024;  // chart validation questions
export const MAX_TOKENS_HABITS    = 1024;  // habit list JSON
export const MAX_TOKENS_EXTRACT   = 512;   // observation extraction
export const MAX_TOKENS_SUMMARISE = 250;   // observation summarisation
export const MAX_TOKENS_FOUNDATION = 3072; // "Your Foundation" static profile — 5 sections of considered prose

// ── Observation management ─────────────────────────────────────────────────────
/** Hard cap on stored coaching observations (oldest are pruned beyond this). */
export const OBS_CAP = 30;
/** Compress observations into a summary every N completed exchanges. */
export const OBS_SUMMARISE_EVERY = 20;

// ── Extraction heuristic (TOKEN-05) ───────────────────────────────────────────
/** Skip observation extraction if user message is shorter than this (chars).
 * Kept low deliberately — short factual replies ("60-70k per month", "1.5 cr")
 * are exactly the high-signal disclosures that should count toward moving
 * into recommendations; a higher threshold was silently skipping them. */
export const EXTRACT_MIN_USER_CHARS = 10;
/** Skip observation extraction if assistant reply is shorter than this (chars). */
export const EXTRACT_MIN_ASST_CHARS = 50;

// ── Transit cache (PERF-03) ───────────────────────────────────────────────────
/** How long cached transit data is considered fresh (ms). */
export const TRANSIT_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

// ── Rate limiting (SCALE-01) ──────────────────────────────────────────────────
/** Maximum requests per rate-limit window. */
export const RATE_LIMIT_MAX = 20;
/** Rate-limit sliding window length (ms). */
export const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

// ── Anonymous chart-only guest mode ────────────────────────────────────────────
/** Stricter than RATE_LIMIT_MAX — anonymous requests are keyed by IP, not by
 * a user id, so the cap is deliberately tighter than the authenticated limit. */
export const ANON_CHART_RATE_LIMIT_MAX = 5;
export const ANON_CHART_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
/** Geocode search (place-of-birth autocomplete) is a required step before a
 * guest can even submit the chart form — also anonymous, but a looser limit
 * since a visitor may type/refine a city search several times per visit. */
export const ANON_GEOCODE_RATE_LIMIT_MAX = 20;
export const ANON_GEOCODE_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// ── Profile archives (BUG-03) ─────────────────────────────────────────────────
/** Maximum number of localStorage profile archives to retain. */
export const MAX_ARCHIVES = 5;

// ── Health check cache (ARCH-01) ──────────────────────────────────────────────
/** Cache-Control max-age for the /api/health endpoint (seconds). */
export const HEALTH_CACHE_SECS = 60;
