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
export const MAX_TOKENS_COACH     = 700;   // streaming coach replies
export const MAX_TOKENS_DASHA     = 700;   // dasha prediction JSON
export const MAX_TOKENS_VALIDATE  = 1024;  // chart validation questions
export const MAX_TOKENS_HABITS    = 1024;  // habit list JSON
export const MAX_TOKENS_EXTRACT   = 512;   // observation extraction
export const MAX_TOKENS_SUMMARISE = 250;   // observation summarisation

// ── Observation management ─────────────────────────────────────────────────────
/** Hard cap on stored coaching observations (oldest are pruned beyond this). */
export const OBS_CAP = 30;
/** Compress observations into a summary every N completed exchanges. */
export const OBS_SUMMARISE_EVERY = 20;

// ── Extraction heuristic (TOKEN-05) ───────────────────────────────────────────
/** Skip observation extraction if user message is shorter than this (chars). */
export const EXTRACT_MIN_USER_CHARS = 30;
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

// ── Profile archives (BUG-03) ─────────────────────────────────────────────────
/** Maximum number of localStorage profile archives to retain. */
export const MAX_ARCHIVES = 5;

// ── Health check cache (ARCH-01) ──────────────────────────────────────────────
/** Cache-Control max-age for the /api/health endpoint (seconds). */
export const HEALTH_CACHE_SECS = 60;
