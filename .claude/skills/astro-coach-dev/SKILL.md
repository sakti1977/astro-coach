---
name: astro-coach-dev
description: Run and visually verify Jyotish Coach (this repo) locally — one command starts the Python ephemeris and a production Next build, plus scripts that seed a real chart and screenshot any page signed-in, in light/dark, desktop/phone. Use when asked to run the app, check a UI change, take screenshots, reproduce a layout bug, or verify dark mode.
---

# Run and verify Jyotish Coach locally

## Start / stop (≈1 min with a build)
```bash
.claude/skills/astro-coach-dev/scripts/run-local.sh            # build + start on :3123
.claude/skills/astro-coach-dev/scripts/run-local.sh --no-build # reuse .next
.claude/skills/astro-coach-dev/scripts/run-local.sh --stop
```
Uses a cached venv at `/tmp/astro-coach-venv`, `EPHEMERIS_SHARED_SECRET=devsecret` on both sides,
`NEXT_PUBLIC_UPI_ID=test@upi` (override via env). Logs: `/tmp/astro-{build,next,uvicorn}.log`.
Don't stop servers with `pkill -f <pattern>`: it also kills any shell whose command line contains
the pattern — including yours (exit 144), even with `[b]racket` tricks. The script stops by port
(`fuser -k 3123/tcp 8000/tcp`). Start long-running servers with `setsid -f cmd </dev/null >log 2>&1`; a plain `cmd &` (or
`nohup … &` inside a script) keeps the tool call open until it times out.

## Screenshots (signed-in, seeded, both themes)
Playwright is not a repo dependency; install it once in the scratchpad, not the repo:
```bash
S=<scratchpad>/shots && mkdir -p $S && cd $S && npm init -y >/dev/null && npm i playwright@1 >/dev/null
cp <repo>/.claude/skills/astro-coach-dev/scripts/{seed,shots}.mjs .
PAGES=/,/chart,/coach W=390 H=844 node shots.mjs      # phone; FRESH=1 for a first-time visitor
```
- Chromium is at `/opt/pw-browsers/chromium`; there is **no WebKit** — iOS-only issues (date/time
  pickers, input zoom) can't be reproduced; fix them from known behaviour and say so.
- `seed.mjs` computes a real chart via the running app's guest `/api/chart`.
- Session is mocked by routing `/api/auth/session`; `/api/sync` is stubbed to 503. To test the
  new-device pull, route `GET /api/sync` to return `{ profile: { birth_data, chart, dashas, … } }`.
- `innerText` returns CSS-uppercased text ("WELCOME BACK") — match case-insensitively.
- Read the PNGs with the Read tool; crop by screenshotting a locator (`locator(...).screenshot`),
  PIL isn't installed.

## Facts that save a search
- Next.js 16 app in `astro-coach/`; read `node_modules/next/dist/docs/` for API changes.
- Dark mode is class-based (`@custom-variant dark` in `app/globals.css`, boot script in
  `lib/theme.ts`). Every `bg-white` / `text-gray-900` / `border-gray-100` needs a `dark:` twin —
  `lib/dark-mode.harness.test.ts` fails otherwise. Chart SVG colours are remapped in CSS by hex.
- Pages that read the saved profile once must also listen for `PROFILE_SYNCED_EVENT`
  (`lib/profile.ts`), or a new device shows empty state until reload.
- Storage keys stay `astro_coach_*` forever (renaming loses users' data).
- Model IDs live in `lib/constants.ts` (`MODEL_PRIMARY`=Sonnet 5, `MODEL_LIGHT`=Haiku 4.5);
  `lib/claude-models.test.ts` forbids `temperature` and requires explicit `thinking` on Sonnet 5 calls.
- No `ANTHROPIC_API_KEY` in this sandbox: model replies can't be exercised; route tests mock `@/lib/claude`.
