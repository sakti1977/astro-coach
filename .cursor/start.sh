#!/usr/bin/env bash
set -euo pipefail

# Per-boot readiness check: ensure the ephemeris venv exists after checkout.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -x "$ROOT/python-service/.venv/bin/uvicorn" ]]; then
  echo "Python venv missing — running install..."
  "$ROOT/.cursor/install.sh"
fi

if [[ ! -d "$ROOT/astro-coach/node_modules" ]]; then
  echo "Node modules missing — running install..."
  "$ROOT/.cursor/install.sh"
fi

echo "✓ Astro Coach environment ready"
