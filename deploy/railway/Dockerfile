# syntax=docker/dockerfile:1
# Railway deployment — Go Core API + Python AI Engine in one container.
# Railway injects $PORT at runtime; the Go binary reads it from env.

# ── Stage 1: build Go Core API ────────────────────────────────────────────────
FROM golang:1.24-bookworm AS core-build
WORKDIR /src
COPY services/core-api/ ./services/core-api/
RUN cd services/core-api \
    && CGO_ENABLED=0 GOOS=linux \
       go build -trimpath -ldflags="-s -w" -o /out/core-api ./cmd/api

# ── Stage 2: Python runtime + Go binary ───────────────────────────────────────
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    # Railway overrides PORT at runtime; 8080 is the local default.
    PORT=8080 \
    HOST=0.0.0.0 \
    AI_ENGINE_URL=http://127.0.0.1:8000 \
    APP_ENV=production

RUN useradd -m -u 1000 user

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /home/user/app

COPY services/ai-engine/requirements.txt ./ai-engine/requirements.txt
RUN pip install --no-cache-dir -r ./ai-engine/requirements.txt

COPY --chown=user services/ai-engine/ ./ai-engine/
COPY --from=core-build /out/core-api ./core-api
COPY --chown=user deploy/railway/start.sh ./start.sh
RUN chmod +x ./core-api ./start.sh

USER user

# Railway dynamically assigns a port; don't hardcode EXPOSE.
EXPOSE 8080

CMD ["./start.sh"]
