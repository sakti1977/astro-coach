#!/bin/bash
# Astro Coach — start both services on one machine (local / Cloud Agent).
# Production one-host: deploy/start-one-host.sh (secret required) or docker compose.

set -euo pipefail

echo "✦ Starting Astro Coach..."

ROOT="$(cd "$(dirname "$0")" && pwd)"
export EPHEMERIS_SERVICE_URL="${EPHEMERIS_SERVICE_URL:-http://127.0.0.1:8000}"

PYTHON_PID=""
NEXT_PID=""

cleanup() {
  if [ -n "${PYTHON_PID}" ]; then kill "$PYTHON_PID" 2>/dev/null || true; fi
  if [ -n "${NEXT_PID}" ]; then kill "$NEXT_PID" 2>/dev/null || true; fi
  echo "Stopped."
}
trap cleanup INT TERM

if curl -sf http://127.0.0.1:8000/health >/dev/null; then
  echo "→ Ephemeris already healthy on :8000"
else
  cd "$ROOT/python-service"
  if [ -x .venv/bin/uvicorn ]; then
    UVICORN=".venv/bin/uvicorn"
  else
    echo "→ python-service/.venv not found; using system uvicorn"
    UVICORN="uvicorn"
  fi
  echo "→ Starting ephemeris service on :8000"
  $UVICORN main:app --host 0.0.0.0 --port 8000 --reload &
  PYTHON_PID=$!
  cd "$ROOT"

  echo "→ Waiting for ephemeris /health"
  ok=0
  for _ in $(seq 1 30); do
    if curl -sf http://127.0.0.1:8000/health >/dev/null; then
      ok=1
      break
    fi
    sleep 1
  done
  if [ "$ok" != "1" ]; then
    echo "✗ Ephemeris service did not become healthy on :8000"
    cleanup
    exit 1
  fi
fi

if curl -sf http://127.0.0.1:3000 >/dev/null; then
  echo "→ Next.js already responding on :3000"
else
  echo "→ Starting Next.js on :3000"
  cd "$ROOT/astro-coach"
  npm run dev &
  NEXT_PID=$!
  cd "$ROOT"
fi

echo ""
echo "✦ Astro Coach is running on this machine:"
echo "  App:              http://localhost:3000"
echo "  Ephemeris API:    http://127.0.0.1:8000  (Next uses EPHEMERIS_SERVICE_URL)"
echo "  API docs:         http://localhost:8000/docs"
echo ""
echo "  One paid host (not Vercel+Railway): docker compose up --build"
echo "  Shared secret is optional in this local script; required in Docker/production."
echo ""
echo "Press Ctrl+C to stop services started by this script."

wait
