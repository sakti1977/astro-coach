FROM python:3.12-slim-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      gcc g++ python3-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONUNBUFFERED=1
ENV EPHEMERIS_REQUIRE_SECRET=1

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=25s --retries=8 \
  CMD curl -sf http://127.0.0.1:8000/health || exit 1

# Bind all interfaces inside the compose network. Publish only loopback
# on the host (see docker-compose.yml) so this is not a public API.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
