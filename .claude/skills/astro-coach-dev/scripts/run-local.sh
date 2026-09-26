#!/bin/bash
# Start the ephemeris (uvicorn :8000) and a production Next build (:3123) for
# screenshots and manual checks. Idempotent: stops any previous copies first.
#   run-local.sh            build + start
#   run-local.sh --no-build start the existing .next build
#   run-local.sh --stop     stop both
set -uo pipefail
ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
VENV="${VENV:-/tmp/astro-coach-venv}"
PORT="${PORT:-3123}"
SECRET=devsecret

# Stop by port, not by name: `pkill -f <pattern>` also kills any shell whose
# command line happens to contain the pattern (exit 144), including the caller.
fuser -k -TERM "$PORT/tcp" 8000/tcp >/dev/null 2>&1
[ "${1:-}" = "--stop" ] && { echo "stopped"; exit 0; }
sleep 1

if [ ! -x "$VENV/bin/uvicorn" ]; then
  echo "→ python venv ($VENV)"
  python3 -m venv "$VENV" && "$VENV/bin/pip" install -q -r "$ROOT/python-service/requirements-dev.txt" >/dev/null
fi
# `setsid -f` fully detaches (new session, parent = init): a plain `cmd &`
# keeps the caller's tool call open until it times out.
(cd "$ROOT/python-service" && setsid -f env EPHEMERIS_SHARED_SECRET=$SECRET "$VENV/bin/uvicorn" main:app \
  --host 127.0.0.1 --port 8000 </dev/null >/tmp/astro-uvicorn.log 2>&1)

cd "$ROOT/astro-coach"
[ -d node_modules ] || npm ci --no-audit --no-fund >/dev/null
if [ "${1:-}" != "--no-build" ]; then
  echo "→ next build (log: /tmp/astro-build.log)"
  NEXT_PUBLIC_UPI_ID="${NEXT_PUBLIC_UPI_ID:-test@upi}" NEXTAUTH_SECRET=x npx next build >/tmp/astro-build.log 2>&1 \
    || { tail -30 /tmp/astro-build.log; exit 1; }
fi
setsid -f env EPHEMERIS_SHARED_SECRET=$SECRET NEXTAUTH_SECRET=x NEXTAUTH_URL="http://localhost:$PORT" \
  EPHEMERIS_SERVICE_URL=http://127.0.0.1:8000 npx next start -p "$PORT" </dev/null >/tmp/astro-next.log 2>&1
for _ in $(seq 1 40); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' "localhost:$PORT/api/health")" = "200" ] && { echo "ready: http://localhost:$PORT"; exit 0; }
  sleep 1
done
echo "not healthy; see /tmp/astro-next.log /tmp/astro-uvicorn.log"; exit 1
