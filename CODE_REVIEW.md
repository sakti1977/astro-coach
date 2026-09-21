# Code Review: astro-coach (historical)

_Originally written 2026-06-22. The critical sync bug in that review was fixed
by moving `user_profiles` / `coaching_observations` I/O onto session-verified
`/api/sync` with the service-role client._

Do **not** treat the tables below as the current bug list. Living gates are
`NON_NEGOTIABLES.md` plus the automated harness:

- `astro-coach/lib/non-negotiables.harness.test.ts`
- `python-service/test_non_negotiables.py`
- `.github/workflows/ci.yml`

The original June review is kept in git history if you need the narrative of
how the silent RLS-sync failure happened.
