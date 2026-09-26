# Single-container image: Next.js (:3000, public) + uvicorn (127.0.0.1:8000).
# Use this on Fly, Render, Railway (one service), or any Docker VPS.
# For local two-container development, prefer docker-compose.yml.

FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip python3-venv python3-dev gcc g++ curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY python-service/requirements.txt /app/python-service/requirements.txt
RUN python3 -m venv /app/python-service/.venv \
    && /app/python-service/.venv/bin/pip install --no-cache-dir -U pip \
    && /app/python-service/.venv/bin/pip install --no-cache-dir -r /app/python-service/requirements.txt

COPY astro-coach/package.json astro-coach/package-lock.json /app/astro-coach/
WORKDIR /app/astro-coach
RUN npm ci

COPY python-service /app/python-service
COPY astro-coach /app/astro-coach
COPY deploy/start-one-host.sh deploy/supervise-children.sh deploy/daily-cron.sh /app/deploy/
RUN chmod +x /app/deploy/start-one-host.sh /app/deploy/supervise-children.sh /app/deploy/daily-cron.sh

ARG NEXT_PUBLIC_SUPABASE_URL=
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
# Optional voluntary UPI contributions (lib/support.ts); hidden when unset.
ARG NEXT_PUBLIC_UPI_ID=
ARG NEXT_PUBLIC_UPI_PAYEE_NAME=
ENV NEXT_PUBLIC_UPI_ID=$NEXT_PUBLIC_UPI_ID
ENV NEXT_PUBLIC_UPI_PAYEE_NAME=$NEXT_PUBLIC_UPI_PAYEE_NAME
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=1

WORKDIR /app/astro-coach
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production
ENV EPHEMERIS_SERVICE_URL=http://127.0.0.1:8000
ENV EPHEMERIS_REQUIRE_SECRET=1
# Default for Fly/Render/compose. Railway overwrites PORT at runtime; start-one-host.sh honors it.
ENV PORT=3000

EXPOSE 3000
WORKDIR /app
CMD ["/app/deploy/start-one-host.sh"]
