#!/bin/bash
# Astro Coach — start both services

set -euo pipefail

echo "✦ Starting Astro Coach..."

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/python-service"

if [ -x .venv/bin/uvicorn ]; then
  UVICORN=".venv/bin/uvicorn"
else
  echo "→ python-service/.venv not found; using system uvicorn"
  UVICORN="uvicorn"
fi

# Start Python ephemeris service
echo "→ Starting ephemeris service on :8000"
$UVICORN main:app --host 0.0.0.0 --port 8000 --reload &
PYTHON_PID=$!
cd "$ROOT"

# Wait until /health responds (Swiss Ephemeris import can take a few seconds)
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
  kill "$PYTHON_PID" 2>/dev/null || true
  exit 1
fi

# Start Next.js dev server
echo "→ Starting Next.js on :3000"
cd "$ROOT/astro-coach"
npm run dev &
NEXT_PID=$!
cd "$ROOT"

echo ""
echo "✦ Astro Coach is running:"
echo "  App:              http://localhost:3000"
echo "  Ephemeris API:    http://localhost:8000"
echo "  API docs:         http://localhost:8000/docs"
echo ""
echo "  Next.js calls EPHEMERIS_SERVICE_URL (default http://localhost:8000)."
echo "  Production: set EPHEMERIS_SERVICE_URL to the Railway/Render URL and the"
echo "  same EPHEMERIS_SHARED_SECRET on both Vercel and the Python service."
echo ""
echo "Press Ctrl+C to stop both services."

trap "kill $PYTHON_PID $NEXT_PID 2>/dev/null; echo 'Stopped.'" INT TERM
wait
