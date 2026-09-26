#!/bin/bash
# In-container daily job for the one-host image (Railway, Fly, Render, VPS).
# Replaces Vercel Cron: calls /api/cron/notifications once a day, so no second
# Railway service is needed. Started by start-one-host.sh when CRON_SECRET is set.
#
#   CRON_UTC_TIME      HH:MM in UTC, default 02:30 (= 08:00 IST)
#   CRON_CATCHUP_HOURS if the container starts up to this many hours after
#                      today's run time, run once right away (default 6). The
#                      endpoint is idempotent, so a repeat never double-sends.
#
# Usage: daily-cron.sh <app-port>          run forever
#        daily-cron.sh <app-port> --once   call the endpoint once and exit
# Not `set -e`: a failed call must never end the loop.
set -uo pipefail

CRON_UTC_TIME="${CRON_UTC_TIME:-02:30}"
CRON_CATCHUP_HOURS="${CRON_CATCHUP_HOURS:-6}"

log() { echo "[daily-cron] $(date -u +%FT%TZ) $*"; }

now_epoch() { echo "${NOW_EPOCH:-$(date -u +%s)}"; }

# Epoch of today's run time (UTC).
today_run_epoch() {
  local day
  day="$(date -u -d "@$(now_epoch)" +%F)"
  date -u -d "${day} ${CRON_UTC_TIME}" +%s
}

# Seconds until the next run (today's if still ahead, else tomorrow's).
seconds_until_next() {
  local now target
  now="$(now_epoch)"
  target="$(today_run_epoch)"
  if [ "$target" -le "$now" ]; then target=$((target + 86400)); fi
  echo $((target - now))
}

# True when we started inside the catch-up window after today's run time.
in_catchup_window() {
  local now target
  now="$(now_epoch)"
  target="$(today_run_epoch)"
  [ "$now" -ge "$target" ] && [ $((now - target)) -lt $((CRON_CATCHUP_HOURS * 3600)) ]
}

call_endpoint() {
  local url="http://127.0.0.1:${APP_PORT}/api/cron/notifications"
  local attempt out
  for attempt in 1 2 3; do
    if out="$(curl -fsS -m 300 -H "Authorization: Bearer ${CRON_SECRET}" "$url" 2>&1)"; then
      log "notifications ok: ${out}"
      return 0
    fi
    log "attempt ${attempt} failed: ${out}"
    [ "$attempt" -lt 3 ] && sleep "${CRON_RETRY_SLEEP:-60}"
  done
  log "giving up until the next scheduled run"
  return 1
}

main() {
  APP_PORT="${1:?usage: daily-cron.sh <app-port> [--once]}"
  if [ -z "${CRON_SECRET:-}" ]; then
    log "CRON_SECRET is not set; daily notifications are off"
    return 0
  fi
  if [ "${2:-}" = "--once" ]; then
    call_endpoint
    return
  fi

  log "scheduled daily at ${CRON_UTC_TIME} UTC"
  if in_catchup_window; then
    # Give Next.js a moment to finish booting before the catch-up run.
    sleep "${CRON_STARTUP_DELAY:-60}"
    log "started after today's run time; running catch-up"
    call_endpoint
  fi
  while true; do
    sleep "$(seconds_until_next)"
    call_endpoint
  done
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
