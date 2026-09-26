---
name: astro-coach-ops
description: Production facts for Jyotish Coach (this repo): the Railway service and Supabase project IDs, which env vars exist, how deploys and build-time variables really behave, migration state, and known tool quirks. Read this before touching Railway variables, deploys, the custom domain, Supabase schema/migrations, or push notifications — it saves re-discovering all of it.
---

# Jyotish Coach — production operations

Product name is **Jyotish Coach** (domain `jyotishcoach.com`). Repo/folders/storage keys keep the old
`astro-coach` / `astro_coach_*` names on purpose (renaming keys strands users' saved data).

## Where things live (don't re-list projects)

| What | ID / value |
| --- | --- |
| Railway project | `soothing-fulfillment` · `6457fa50-8247-4b98-8f7a-45be78751e67` |
| Railway env (production) | `2c6e29e6-8ab6-4454-8553-2223fe88a842` |
| Railway service (the app) | `astro-coach` · `d246a0b4-0b5d-4486-a2cf-5feb45b16579` · deploys `sakti1977/astro-coach@main` |
| Domains | `jyotishcoach.com` (custom, verified), `astro-coach-production.up.railway.app` |
| Supabase project | `qsnszpicjztibcwsehsj` (ap-northeast-1) |

Other Railway projects in the workspace (`saktibagchi-blog`, `amusing-delight`/CSAgent, empty
`adequate-possibility`) are unrelated — don't touch them. Vercel is gone; the old
`astro-coach-hjvh` Python-only service was deleted 2026-09-26.

## Env vars on the service (names; values are secrets — never print them)

`ALLOWED_ORIGINS`, `ANTHROPIC_API_KEY`, `CRON_SECRET`, `EPHEMERIS_REQUIRE_SECRET`,
`EPHEMERIS_SERVICE_URL`, `EPHEMERIS_SHARED_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
(= `https://jyotishcoach.com`), `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_UPI_ID` (= `9099941608@airtel`), `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `NODE_ENV`,
`SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`
(= `https://jyotishcoach.com`, deliberately not a personal email). The Railway connector returns
names only (`valuesRedacted`).

## Gotchas that cost time before

1. **`NEXT_PUBLIC_*` changes do NOT reach the site from a variable change.** Railway's
   variable-triggered redeploy (and `redeploy`) **reuses the previous image** — build log shows only
   `containerimage.*` / `image push`, no `npm run build`, done in ~12s. A real build needs a **new
   commit on `main`** (merge a PR). Verify with `get-logs types:["build"] filter:"npm run build"`.
   Server-only vars (no `NEXT_PUBLIC_`) do apply on the reused-image redeploy.
2. **This sandbox can't reach `jyotishcoach.com`** (egress policy). Check the live site via Railway:
   `get-logs` (deploy stream shows `[daily-cron] scheduled daily at 02:30 UTC` when `CRON_SECRET`
   is set; `types:["http"]` shows real requests + status), `domain-status`, `list-deployments`.
3. **`delete-service` times out** (60s) and may still complete later. Re-check with
   `describe-environment` before retrying; `railway-agent` can stage a removal, then
   `get-staged-changes` → `accept-deploy`. Destructive: only when the user asked.
4. `set-variables` with several vars in one call = one redeploy. Generate secrets locally
   (`node -e` with `crypto` / `web-push generateVAPIDKeys`) into a 0600 file, pass them, delete the file;
   never echo values in chat.
5. UPI IDs must contain `@` (`lib/support.ts` validates; an invalid one hides the support page).
   Money goes wherever it points — confirm the exact ID with the user, never guess.

## Supabase

- Migrations 001–006 in `astro-coach/supabase/migrations/` are all applied to production
  (004 behavioral default, 005 `coach_feedback`, 006 trigger-function hardening). `list_migrations`
  returns `[]` because earlier ones were run in the SQL editor — trust the table/function state, not that list.
- `CREATE OR REPLACE FUNCTION` **drops `SET search_path`** — re-apply
  `ALTER FUNCTION ... SET search_path = ''` (and the `REVOKE EXECUTE`) whenever `handle_new_user`
  is replaced.
- Prove a sign-up trigger without leaving data: a `DO $$ ... RAISE EXCEPTION 'CHECK %', value; $$`
  block that inserts into `auth.users` and reads `public.user_profiles` — the exception rolls it back.
- Run `get_advisors type:security` after DDL. Remaining known warning: *Leaked password protection*
  (dashboard-only Auth setting; the connector can't change Auth URL config either).

## Push notifications

Server side runs from `deploy/daily-cron.sh` inside the container. "Registration failed - push
service error" in a browser is the browser's push service (Brave setting, distro Chromium without
Google keys, blocked `fcm.googleapis.com`, incognito) — the VAPID key was verified valid.
