# Astro Coach

Vedic Jyotish coaching app: **Next.js 16** (App Router) + a long-running **Python FastAPI** sidecar (kerykeion 5.12.9 / Swiss Ephemeris). Product docs live in [`astro-coach/README.md`](astro-coach/README.md).

## One host

**Recommendation:** run Next (`next start`) and uvicorn **on a single VM/container**. Pay **one** compute bill. Keep **Supabase** (auth/DB — not Vercel/Railway). Delete the other frontend/backend vendor.

**Do not** try Vercel-only. The ephemeris service is a native, long-running FastAPI process (`pyswisseph`). Vercel serverless cannot host it: no persistent sidecar, native wheels, or warm process. That is why the app already 503s with “Ephemeris service is not running” when Railway is asleep or unset.

**Paid path (pick one machine, not two vendors):**

1. **Fly.io** — `fly.toml` + root `Dockerfile` (this repo’s default paid example). One Machine, port 3000 public, uvicorn on `127.0.0.1:8000`.
2. **Same files on Render** — `render.yaml` Blueprint, one Docker web service.
3. **Any VPS** (Hetzner/DigitalOcean/etc.) — Docker Engine + `docker compose up`.
4. **Railway-only** — one Railway **service** using the root `Dockerfile` (not a second Railway service + Vercel). Then delete Vercel.

Local/free: `docker compose up` or `./start.sh`.

### Env (same list on that one host)

| Variable | Where | Notes |
| --- | --- | --- |
| `EPHEMERIS_SHARED_SECRET` | Next **and** Python | **Required** in Docker/production, including localhost compose. `openssl rand -base64 32` |
| `EPHEMERIS_SERVICE_URL` | Next only | Compose: `http://ephemeris:8000`. One container / `start.sh`: `http://127.0.0.1:8000` |
| `EPHEMERIS_REQUIRE_SECRET` | Python | Compose and the one-host image set this to `1` |
| `NEXTAUTH_URL` | Next | Public origin, no trailing slash (`https://your-app.fly.dev`) |
| `NEXTAUTH_SECRET` | Next | Required for auth |
| `NEXT_PUBLIC_SUPABASE_URL` | Next (build + runtime) | Keep existing Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Next (build + runtime) | |
| `SUPABASE_SERVICE_ROLE_KEY` | Next server | Never `NEXT_PUBLIC_*` |
| `ANTHROPIC_API_KEY` | Next | Coaching |
| `ALLOWED_ORIGINS` | Python | Public Next origin |
| `CRON_SECRET` | Next | Host crontab, see `deploy/crontab.example` (replaces Vercel Cron) |
| `UPSTASH_*` / VAPID / `SARVAM_API_KEY` | Next | Optional, same as before |

Copy [`.env.example`](.env.example) to `.env` for Compose. Do not commit `.env`.

### Docker Compose (two processes, one machine)

```bash
cp .env.example .env
# fill EPHEMERIS_SHARED_SECRET and NEXTAUTH_SECRET at minimum
docker compose up --build
```

- App: http://localhost:3000
- Ephemeris is **not** published on the public interface; only `127.0.0.1:8000` plus the `ephemeris` Docker network. Next calls `http://ephemeris:8000` with `X-Ephemeris-Secret`.

### One container (Fly / Render / Railway / VPS)

```bash
docker build -t astro-coach .
docker run --rm -p 3000:3000 \
  -e EPHEMERIS_SHARED_SECRET=... \
  -e NEXTAUTH_SECRET=... \
  -e NEXTAUTH_URL=http://localhost:3000 \
  astro-coach
```

`deploy/start-one-host.sh` starts uvicorn on loopback then `next start` on `:3000`.

**Fly:**

```bash
fly launch --copy-config --no-deploy   # edit app name in fly.toml
fly secrets set EPHEMERIS_SHARED_SECRET=... NEXTAUTH_SECRET=... \
  NEXTAUTH_URL=https://<app>.fly.dev \
  ANTHROPIC_API_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
  NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=...
fly deploy
```

Keep `min_machines_running = 1` and `auto_stop_machines = "off"`. Autostop is how the sidecar dies.

**Render:** New → Blueprint → this `render.yaml`. Set `NEXTAUTH_URL` to the Render URL. Copy the generated `EPHEMERIS_SHARED_SECRET` is already shared in-process.

**Railway (only, if you already pay it):** New service from this repo, Dockerfile at `/Dockerfile`, **one** service. Set the same env as Fly. Remove the old Python-only service and the Vercel project.

### Local without Docker

```bash
./start.sh
```

Cloud Agent: `.cursor/environment.json` `start` is `./start.sh`; a tmux terminal also boots uvicorn. `start.sh` will not bind `:8000` twice if `/health` is already up. Shared secret stays optional here.

### What to delete

| Stop paying / remove | Why |
| --- | --- |
| **Vercel project** | Next now runs on the VM (`next start`). `astro-coach/vercel.json` cron is replaced by `deploy/crontab.example`. |
| **Railway Python service** (if you moved off Railway) | uvicorn is in the same container/compose project. |
| Do **not** delete Supabase | Auth + Postgres stay. |

Leave `python-service/railway.json` and `astro-coach/vercel.json` in git as leftovers; they are unused once you cut over.

### Why two processes still

Swiss Ephemeris (`pyswisseph` via kerykeion==5.12.9) is a long-running native service with a shared-secret header. Next.js 16 stays the public app and rate limiter. Putting them on **one host** is the cost cut; merging them into Vercel serverless is not viable.
