#!/bin/bash
# Production process manager for a single container / VM:
# uvicorn (Swiss Ephemeris) on 127.0.0.1:8000 + Next.js on :3000.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ -z "${EPHEMERIS_SHARED_SECRET:-}" ]; then
  echo "EPHEMERIS_SHARED_SECRET is required on one-host production." >&2
  echo "Set the same value for Next.js and the Python service." >&2
  exit 1
fi

export EPHEMERIS_REQUIRE_SECRET=1
export EPHEMERIS_SERVICE_URL="${EPHEMERIS_SERVICE_URL:-http://127.0.0.1:8000}"
export NODE_ENV="${NODE_ENV:-production}"

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

cleanup() {
  kill "$PYTHON_PID" 2>/dev/null || true
}
trap cleanup INT TERM

echo "→ Starting Next.js on :3000"
cd "$ROOT/astro-coach"
exec npm run start -- -H 0.0.0.0 -p 3000
