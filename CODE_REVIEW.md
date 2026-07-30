# Code Review: astro-coach (full repo)

_Date: 2026-06-22_

## Summary
A Next.js 16 + Python/FastAPI ephemeris microservice for Vedic astrology coaching, backed by Supabase and Claude. Code quality is generally high — typed, commented with rationale, rate-limited, and timeout-guarded. But there's one critical architectural bug that breaks the core "cloud sync" promise, plus several trust gaps that matter a lot given the goal of feeling like a trustworthy coach rather than a toy.

## Critical Issues

| # | File | Issue | Severity |
|---|------|-------|----------|
| 1 | `lib/auth.ts` + `lib/storage-supabase.ts` + `lib/supabase.ts` | Supabase sign-in happens **server-side** inside NextAuth's `authorize()` callback, using the anon-key client. That Supabase auth session never reaches the browser. But `storage-supabase.ts` (marked `"use client"`) talks to Supabase from the browser using a *separate*, unauthenticated anon client. Since RLS policies require `auth.uid() = user_id`, every client-side `syncToServer`/`syncFromServer` call is running with `auth.uid() = NULL` and will be rejected by RLS — every time, for every user. Cloud sync is effectively non-functional as built. | Critical |
| 2 | `components/SyncStatus.tsx`, `app/page.tsx` (footer copy) | Because of #1, the "Synced" badge and the signin page's "Your data is encrypted and stored securely" claim are misleading — sync will silently fail (caught, logged to console, surfaced only as a generic "Sync error" badge) while data quietly stays local-only. Real user-trust risk for a "personal coach" app: people will believe their data is backed up across devices when it isn't. | Critical |

**Fix for #1:** either issue a Supabase session to the browser after NextAuth login (e.g. mint a Supabase JWT server-side and call `supabase.auth.setSession()` client-side), or move all Supabase writes server-side into API routes using the service-role key, with the client only calling your own authenticated `/api/*` endpoints.

## Suggestions

| # | File | Suggestion | Category |
|---|------|------------|----------|
| 1 | `lib/ephemeris.ts` | Internal error messages (full `EPHEMERIS_SERVICE_URL`, "Cannot reach ephemeris service at...") propagate straight to the client via `app/api/chart/route.ts`'s catch block. Low severity, but an unnecessary internal-topology leak. | Security |
| 2 | `python-service/main.py` | No auth on `/calculate`, `/dasha`, `/transits` — anyone who learns the Railway URL can call it directly, bypassing the Next.js rate limiter entirely. CORS restricts browser origins but not server-to-server or curl. Consider a shared-secret header checked by the Python service. | Security |
| 3 | `app/page.tsx` (`importProfile`) | Restoring a backup JSON only checks `chart` and `dashas` exist, then calls `saveProfile(parsed)` directly — no schema validation. A malformed/corrupted backup could crash downstream components expecting specific shapes. | Correctness |
| 4 | `lib/rate-limit.ts` | The in-memory fallback (`store` Map) is per-instance and never evicted except on the next request for the same key — on Vercel's serverless model this gives weak/no protection across cold starts and multiple instances unless Upstash is configured. Worth flagging Upstash as effectively required in production in `.env.example`, not just "recommended." | Performance |
| 5 | Whole repo | No test files anywhere (`*.test.*`, `*.spec.*`) despite `strict: true` TypeScript and fairly intricate logic (JSON extraction fallback regex in `dasha/route.ts`, observation summarisation/capping, RLS-dependent sync). A few unit tests on `claude-json.ts` and the rate limiter would catch regressions cheaply. | Maintainability |
| 6 | `lib/claude-json.ts` | `prepareJsonString` does string-level JSON repair (escaping bare newlines, stripping control chars) rather than parsing structurally. Works for current prompts but is brittle — if Claude ever returns a JSON string value containing a literal `}` near the end, `lastIndexOf("}")` will mis-truncate. | Correctness |
| 7 | `app/api/coach/route.ts` and siblings | Every route re-derives `getApiAccessContext` + `checkRateLimit` — fine as is, but consider a small wrapper/middleware to remove the 4-line boilerplate repeated across 7 routes. | Maintainability |

## Usability / trust review (as a "trusted astro coach")

- **No disclaimer anywhere.** The coach gives specific guidance across career, relationships, and health-adjacent domains (H6 "health challenges" theming, IFS-style psychological framing) with real conviction. There's no "this is not professional medical/financial/psychological advice" anywhere in the UI or system prompt. For a coach that leans into health and emotional language, this is a real gap, not just legal box-ticking.
- **Inconsistent privacy claims.** The home page footer says "Data stored locally · Nothing shared except chart calculation" (accurate-ish), but the signin page says "Your data is encrypted and stored securely" (implies cloud backup that, per the critical bug above, doesn't actually work). Pick one honest story and say it everywhere.
- **Good: transparency section.** The "How the chart is calculated" disclosure (Swiss Ephemeris, Lahiri ayanamsha, whole-sign houses, Vimshottari dasha) is a genuinely strong trust signal — it shows methodology instead of hand-waving.
- **Good: validation loop.** The yes/no chart-validation flow that calibrates an "accuracy score" against the user's real life is a smart trust-building mechanic — it's honest about astrology's interpretive uncertainty rather than asserting false precision.
- **Silent failure patterns hurt trust more than visible ones.** `extractAndSave`, `compressObservations`, and the transit fetch all swallow errors silently (`catch {}` with a comment like "non-fatal"). Reasonable for non-critical background calls, but combined with the sync bug, the user has very little reliable signal about what's actually being remembered about them versus what's being silently dropped.
- **Minor UX nit:** the "Ephemeris service is not running" error includes a "View start.sh instructions" button that just opens `https://github.com` — a dead-end for any real user (only matters for local dev, but sloppy for an otherwise polished app).

## What Looks Good
- Careful Claude API usage: prompt caching split into a static/dynamic block pattern with explicit comments on *why* (cache efficiency), sensible model choice per task (Haiku for chat/extraction, Sonnet for structured JSON), and token budgets centralized in `constants.ts`.
- RLS policies themselves (the SQL) are correctly scoped per-user with full CRUD coverage and `ON DELETE CASCADE` — the schema design is right, it's the auth wiring on top of it that's broken.
- Server-authoritative "now" (`todayIso` computed server-side) avoids client clock-skew bugs in dasha timing.
- Sliding-window rate limiting with graceful Upstash → in-memory fallback, plus per-route application, is solid engineering for a small app.
- The IFS-informed planet framing and the mandatory "chain analysis" method in the coach system prompt is a thoughtful design choice — it pushes the model toward grounded, specific reasoning instead of generic horoscope text.

## Verdict
**Request changes.** The Supabase sync bug (#1) should be fixed before this goes further — it's not a performance nit, it undermines the core promise of persistent, cross-device coaching. Once that's sorted, tightening the privacy copy and adding a lightweight disclaimer would close most of the remaining trust gap. Everything else here is solid, maintainable work.
