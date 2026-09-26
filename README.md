# Astro Coach

Vedic Jyotish coaching app: **Next.js 16** (App Router) + a long-running **Python FastAPI** sidecar (kerykeion 5.12.9 / Swiss Ephemeris). Product docs live in [`astro-coach/README.md`](astro-coach/README.md).

## One host

**Recommendation:** run Next (`next start`) and uvicorn **on a single VM/container**. Pay **one** compute bill. Keep **Supabase** (auth/DB — not Vercel/Railway). Delete the other frontend/backend vendor.

**Do not** try Vercel-only. The ephemeris service is a native, long-running FastAPI process (`pyswisseph`). Vercel serverless cannot host it: no persistent sidecar, native wheels, or warm process. That is why the app already 503s with “Ephemeris service is not running” when Railway is asleep or unset.

**Paid path (pick one machine, not two vendors):**

1. **Fly.io** — `fly.toml` + root `Dockerfile` (this repo’s default paid example). One Machine, port 3000 public, uvicorn on `127.0.0.1:8000`.
2. **Same files on Render** — `render.yaml` Blueprint, one Docker web service.
3. **Any VPS** (Hetzner/DigitalOcean/etc.) — Docker Engine + `docker compose up`.
4. **Railway-only** — one Railway **service** using the **root** `Dockerfile` + `railway.json` (not `python-service/railway.json`, not Vercel). Then delete Vercel.

Local/free: `docker compose up` or `./start.sh`.

### Env (same list on that one host)

| Variable | Where | Notes |
| --- | --- | --- |
| `EPHEMERIS_SHARED_SECRET` | Next **and** Python | **Required** in Docker/production, including localhost compose. `openssl rand -base64 32` |
| `EPHEMERIS_SERVICE_URL` | Next only | Compose: `http://ephemeris:8000`. One container / `start.sh`: `http://127.0.0.1:8000` |
| `EPHEMERIS_REQUIRE_SECRET` | Python | Compose and the one-host image set this to `1` |
| `NEXTAUTH_URL` | Next | Public origin, no trailing slash (`https://your-app.fly.dev` or `https://<app>.up.railway.app`) |
| `NEXTAUTH_SECRET` | Next | Required for auth |
| `NEXT_PUBLIC_SUPABASE_URL` | Next (build + runtime) | Keep existing Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Next (build + runtime) | |
| `SUPABASE_SERVICE_ROLE_KEY` | Next server | Never `NEXT_PUBLIC_*` |
| `ANTHROPIC_API_KEY` | Next | Coaching |
| `ALLOWED_ORIGINS` | Python | Public Next origin |
| `CRON_SECRET` | Next | Host crontab or Railway curl cron, see `deploy/crontab.example` (replaces Vercel Cron) |
| `UPSTASH_*` / VAPID / `SARVAM_API_KEY` | Next | Optional, same as before |
| `NEXT_PUBLIC_UPI_ID` / `NEXT_PUBLIC_UPI_PAYEE_NAME` | Next (build + runtime) | Optional voluntary UPI support (`/support`). Hidden when unset. Merchant UPI IDs work more reliably than personal ones from web pay links. |

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

`deploy/start-one-host.sh` starts uvicorn on loopback then `next start` on `$PORT` (default `3000`). Railway injects `PORT`; do not hardcode 3000 in the dashboard unless you also want a stable healthcheck port.

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

**Railway (one bill, drop Vercel) — do this in order:**

1. In [Railway](https://railway.app): **New project** → **GitHub repo** (`sakti1977/astro-coach`) → **one** service. Root directory = repo root. Builder = Dockerfile (`/Dockerfile`). Ignore `python-service/railway.json` (that is the old Python-only Nixpacks app).
2. **Do not** enable Serverless / app sleeping on this service. Uvicorn must stay warm; sleep is how you get “Ephemeris service is not running”. `railway.json` sets `restartPolicyType: ALWAYS`.
3. Variables (Variables tab). Set **before** the first successful deploy if you can — `NEXT_PUBLIC_*` are Docker **build args**:

   | Variable | Value |
   | --- | --- |
   | `NEXTAUTH_URL` | `https://<service>.up.railway.app` (no trailing slash). After the first deploy, copy the public URL from Settings → Networking. Custom domain later: change this and redeploy. |
   | `NEXTAUTH_SECRET` | Copy from Vercel, or `openssl rand -base64 32` |
   | `EPHEMERIS_SHARED_SECRET` | Same value Next and Python already share. Copy from Vercel **and** the old Railway Python service (must match). |
   | `EPHEMERIS_SERVICE_URL` | `http://127.0.0.1:8000` (loopback in this container — not the old Railway public URL) |
   | `EPHEMERIS_REQUIRE_SECRET` | `1` |
   | `ALLOWED_ORIGINS` | Same as `NEXTAUTH_URL` |
   | `NEXT_PUBLIC_SUPABASE_URL` | Copy from Vercel |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Copy from Vercel |
   | `SUPABASE_SERVICE_ROLE_KEY` | Copy from Vercel |
   | `ANTHROPIC_API_KEY` | Copy from Vercel |
   | `CRON_SECRET` | Copy from Vercel |
   | `SARVAM_API_KEY`, `UPSTASH_*`, `VAPID_*`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` | Copy from Vercel if set |
   | `NEXT_PUBLIC_UPI_ID`, `NEXT_PUBLIC_UPI_PAYEE_NAME` | Optional. Your UPI ID and display name for voluntary support; redeploy after setting (build arg) |

   Leave `PORT` unset unless healthchecks fail: Railway injects it; `start-one-host.sh` passes it to `next start`. Optional override: `PORT=3000`.
4. Settings → Networking: generate a public domain (`*.up.railway.app`). Healthcheck path is `/api/health` (200 only when Next **and** uvicorn are up). Timeout 300s (image start + ephemeris wait).
5. Deploy. Confirm `https://<app>.up.railway.app/api/health` returns `{"ok":true}`. Sign in once (NextAuth). Generate a guest chart to prove kerykeion.
6. **Supabase stays.** Dashboard → Authentication → URL configuration: add the Railway origin to **Site URL** / **Redirect URLs** (`https://<app>.up.railway.app/**`). Do not delete the Supabase project.
7. **Cron:** Vercel Cron is gone. Either a second Railway service (`curlimages/curl`, schedule `30 2 * * *`, start command in `deploy/crontab.example`) **or** skip until you need push notifications.
8. **Cutover:** Point the custom domain at Railway (CNAME to the Railway domain). Update `NEXTAUTH_URL` + `ALLOWED_ORIGINS` + Supabase redirect URLs. Redeploy. Then **delete the Vercel project** and the **old Railway Python-only** service (Nixpacks / `python-service`). Keep this one Docker service.

### Local without Docker

```bash
./start.sh
```

Cloud Agent: `.cursor/environment.json` `start` is `./start.sh`; a tmux terminal also boots uvicorn. `start.sh` will not bind `:8000` twice if `/health` is already up. Shared secret stays optional here.

### What to delete

| Stop paying / remove | Why |
| --- | --- |
| **Vercel project** | Next now runs on the one-host container (`next start`). `astro-coach/vercel.json` cron is replaced by `deploy/crontab.example` / a Railway curl cron. |
| **Old Railway Python-only service** | Root `Dockerfile` already runs uvicorn. Do not keep Nixpacks `python-service`. |
| Do **not** delete Supabase | Auth + Postgres stay. |

Leave `python-service/railway.json` and `astro-coach/vercel.json` in git as leftovers; they are unused once you cut over. Use root `railway.json` for the one-host service.

### Why two processes still

Swiss Ephemeris (`pyswisseph` via kerykeion==5.12.9) is a long-running native service with a shared-secret header. Next.js 16 stays the public app and rate limiter. Putting them on **one host** is the cost cut; merging them into Vercel serverless is not viable.
