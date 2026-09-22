#!/bin/bash
# Production process manager for a single container / VM:
# uvicorn (Swiss Ephemeris) on 127.0.0.1:8000 + Next.js on $PORT (default 3000).
# Railway injects PORT; Fly/Render/compose typically leave it at 3000.
#
# Both children stay under this script. Railway restarts the container when
# PID 1 exits, not when /api/health later returns 503 — so if uvicorn dies we
# must exit too. `exec next` would make Next.js PID 1 and hide that crash.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=supervise-children.sh
source "$ROOT/deploy/supervise-children.sh"

if [ -z "${EPHEMERIS_SHARED_SECRET:-}" ]; then
  echo "EPHEMERIS_SHARED_SECRET is required on one-host production." >&2
  echo "Set the same value for Next.js and the Python service." >&2
  exit 1
fi

export EPHEMERIS_REQUIRE_SECRET=1
export EPHEMERIS_SERVICE_URL="${EPHEMERIS_SERVICE_URL:-http://127.0.0.1:8000}"
export NODE_ENV="${NODE_ENV:-production}"
# Public HTTP port only. Do not reuse this for uvicorn (always 8000 on loopback).
APP_PORT="${PORT:-3000}"

if [ -x "$ROOT/python-service/.venv/bin/uvicorn" ]; then
  UVICORN="$ROOT/python-service/.venv/bin/uvicorn"
else
  UVICORN="uvicorn"
fi

echo "→ Starting ephemeris (uvicorn) on 127.0.0.1:8000"
cd "$ROOT/python-service"
# Loopback only: Next talks to it on the same machine. Do not publish 8000.
"$UVICORN" main:app --host 127.0.0.1 --port 8000 &
PYTHON_PID=$!
cd "$ROOT"

echo "→ Waiting for ephemeris /health"
ok=0
for _ in $(seq 1 60); do
  if curl -sf http://127.0.0.1:8000/health >/dev/null; then
    ok=1
    break
  fi
  if ! kill -0 "$PYTHON_PID" 2>/dev/null; then
    echo "✗ uvicorn exited before becoming healthy" >&2
    exit 1
  fi
  sleep 1
done
if [ "$ok" != "1" ]; then
  echo "✗ Ephemeris service did not become healthy on :8000" >&2
  kill "$PYTHON_PID" 2>/dev/null || true
  exit 1
fi

echo "→ Starting Next.js on :${APP_PORT}"
cd "$ROOT/astro-coach"
npm run start -- -H 0.0.0.0 -p "$APP_PORT" &
NEXT_PID=$!

supervise_children "$PYTHON_PID" "$NEXT_PID"
