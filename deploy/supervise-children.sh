#!/bin/bash
# Exit when either child dies so the container's PID 1 dies with it.
# Railway restarts on process exit, not on a later HTTP 503.
# $1 is the ephemeris pid, $2 is the Next.js pid. Both must be children
# of this shell. Ephemeris death exits 1. Next.js death exits with its status.
supervise_children() {
  local python_pid="$1"
  local next_pid="$2"

  trap 'kill "$python_pid" "$next_pid" 2>/dev/null || true; wait "$python_pid" "$next_pid" 2>/dev/null || true; exit 0' INT TERM

  set +e
  wait -n "$python_pid" "$next_pid"
  local status=$?
  set -e

  if kill -0 "$python_pid" 2>/dev/null; then
    echo "✗ Next.js exited (${status}); stopping ephemeris" >&2
    kill "$python_pid" 2>/dev/null || true
    wait "$python_pid" 2>/dev/null || true
    exit "$status"
  fi

  echo "✗ Ephemeris process exited; stopping Next.js so the platform restarts the container" >&2
  kill "$next_pid" 2>/dev/null || true
  wait "$next_pid" 2>/dev/null || true
  exit 1
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  set -euo pipefail
  supervise_children "$1" "$2"
fi
