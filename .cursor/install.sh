#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ── Python ephemeris service ──────────────────────────────────────────────────
cd "$ROOT/python-service"
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements-dev.txt

# ── Next.js app ───────────────────────────────────────────────────────────────
cd "$ROOT/astro-coach"
npm ci

# Minimal local dev env (guest chart flow works without Supabase/Anthropic keys)
if [[ ! -f .env.local ]]; then
  cat > .env.local <<'EOF'
EPHEMERIS_SERVICE_URL=http://localhost:8000
NEXTAUTH_URL=http://localhost:3000
EOF
fi

echo "✓ Astro Coach dependencies installed"
