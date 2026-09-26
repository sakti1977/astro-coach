# Jyotish Coach (repo: astro-coach)

Next.js 16 app in `astro-coach/` + FastAPI ephemeris in `python-service/`, deployed as one
Railway service at jyotishcoach.com, Supabase for auth/DB.

Before re-discovering anything, use the project skills in `.claude/skills/`:
- `astro-coach-ops` — Railway/Supabase IDs, env vars, deploy + migration facts and gotchas.
- `astro-coach-dev` — run locally (`scripts/run-local.sh`) and screenshot pages signed-in.
- `steward` — PR/CI/merge conventions (the owner merges by saying "merge").

Gates: `NON_NEGOTIABLES.md` (enforced by `lib/non-negotiables.harness.test.ts` and
`python-service/test_non_negotiables.py`). Keep storage keys `astro_coach_*` unchanged.
