# Astro Coach — Non-Negotiables

_Living checklist. Edit this file directly to add/remove/reword items — the `astro-coach-evaluator`
subagent (`.claude/agents/astro-coach-evaluator.md`) reads this file at evaluation time, so changes
here take effect on the next evaluation without touching the agent definition._

Each item states the rule, why it exists, and how to check it. Items are gates: a change that
fails one is not done, regardless of how good the rest of the change is.

---

### 1. Cloud sync integrity
**Rule:** All reads/writes of `user_profiles` and `coaching_observations` go through server-side,
session-verified API routes (`app/api/sync/route.ts`) using the service-role client
(`supabaseAdmin`), scoped to the verified NextAuth session's `user.id`. No client-side (`"use
client"`) code may write user data to Supabase directly with the anon key.
**Why:** This exact bug shipped once — RLS silently rejected every client-side write because
`auth.uid()` was never populated in the browser, so "cloud sync" quietly did nothing while the UI
showed a "Synced" badge. Fixed in commit `4c37856`.
**Check:** `grep` for `supabaseAdmin` / `SUPABASE_SERVICE_ROLE_KEY` usage (should be server-only,
inside `app/api/`). `grep` client components for `.from("user_profiles")` or
`.from("coaching_observations")` writes outside `/api/sync`.

### 2. Honest privacy/sync copy
**Rule:** UI text describing storage or sync must match what the code actually guarantees. No
"encrypted and stored securely" or equivalent claims unless true end-to-end for the current auth
state.
**Why:** The signin page once claimed secure cloud storage while sync was silently broken (see #1)
— a trust-critical inconsistency for a "personal coach" app handling sensitive life data.
**Check:** `grep -ri "encrypted\|stored securely\|synced across devices"` across `app/` and diff
new copy against actual sync behavior for signed-in vs. signed-out state.

### 3. Ephemeris service auth
**Rule:** `/calculate`, `/dasha`, `/transits`, and any new `python-service` endpoint that accepts
birth data must keep `dependencies=[Depends(_verify_secret)]` (shared-secret header check).
**Why:** Without it, anyone who learns the Railway URL can call the ephemeris service directly,
bypassing the Next.js rate limiter entirely.
**Check:** `grep -n "Depends(_verify_secret)" python-service/main.py` — every `@app.post` route
taking user input must have it, including new ones.

### 4. Health/advice disclaimer present
**Rule:** Every coaching-output surface (chat, chart readings, dasha/transit predictions) keeps a
visible disclaimer that guidance is not a substitute for professional medical, mental health,
legal, or financial advice.
**Why:** The coach gives specific guidance across health-adjacent and emotionally loaded domains
with real conviction; there is no other disclaimer anywhere in the product.
**Check:** `grep -ri "not a substitute" components/ app/` — confirm it still renders on every page
that shows LLM-generated guidance, including any newly added one.

### 5. No internal topology leaks
**Rule:** Error messages returned to the client must never include internal service URLs, stack
traces, or other infra details.
**Why:** `EPHEMERIS_SERVICE_URL` and similar internals were previously propagated straight to the
browser via API route catch blocks — an unnecessary information leak.
**Check:** Read the `catch` blocks of API routes touched by the change; confirm client-facing
messages are generic and any detail is server-side-only (logged, not returned).

### 6. Rate limiting on every API route
**Rule:** Every route under `app/api/*` that does real work calls `checkRateLimit` /
`getApiAccessContext` (or the shared wrapper, if one exists by the time this is read).
**Why:** Rate limiting is applied per-route by convention, not centrally enforced by middleware —
it's easy for a new route to ship without it.
**Check:** For each new/changed file under `app/api/`, confirm `checkRateLimit`/
`getApiAccessContext` is called before any real work happens.

### 7. Schema-validated external input
**Rule:** Backup import (`importProfile` in `app/page.tsx`) and any new code path accepting
external or user-supplied JSON must validate its shape before persisting or trusting it.
**Why:** A malformed or corrupted backup should produce a clear rejection, not a downstream crash
or silently-wrong state in components that assume a specific shape.
**Check:** Confirm required fields are checked (not just presence-checked loosely) before
`saveProfile`/persistence, for any new import/ingestion path.

### 8. Secrets hygiene
**Rule:** No service-role keys, `NEXTAUTH_SECRET`, `SARVAM_API_KEY`, `EPHEMERIS_SHARED_SECRET`, or
other real secret values are committed to the repo or shipped into the client bundle.
**Why:** Standard blast-radius control — a leaked service-role key bypasses RLS entirely.
**Check:** `git diff` for literal secret-shaped values; confirm any new server-only env var is not
read from a `"use client"` file or `NEXT_PUBLIC_*`-prefixed.

---

## Pending additions

- Product-identity guardrails (coaching must stay grounded in chart + client chat input, remedies
  must stay behavior/habit-oriented, no fatalistic/deterministic claims) are being formalized in
  `SPEC.md` §0. Once that's finalized, promote its G1–G4 guardrails into numbered items here.
