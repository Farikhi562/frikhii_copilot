---
title: FRIKHII Copilot API
emoji: 🧠
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: Go Core API + Python AI Engine for FRIKHII Copilot
---

# FRIKHII Copilot API

This Docker Space runs the FRIKHII Copilot backend:

- Go Core API on the public Space port `7860`
- Python AI Engine on `127.0.0.1:8000` (internal only)

The browser talks only to the Core API. The Core API verifies Supabase access
tokens, owns the database writes, and calls the AI Engine with a shared internal
token.

## Required secrets

Set these in **Settings → Secrets** for this Space:

| Secret | Purpose |
|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `SUPABASE_URL` | Supabase project URL, used to derive JWKS |
| `INTERNAL_SERVICE_TOKEN` | Shared secret between Core API and AI Engine |
| `CORS_ORIGINS` | Comma-separated frontend origins, e.g. `https://copilot.frikhii.my.id` |
| `AI_PROVIDER` | `mock` for the demo, or `gemini` / `openai-compatible` |
| `GEMINI_API_KEY` | Required when `AI_PROVIDER=gemini` |
| `GEMINI_MODEL` | Optional Gemini model override |

Optional tuning: `RATE_LIMIT_PER_MINUTE`, `AI_TIMEOUT_SECONDS`,
`AI_GENERATION_TIMEOUT_SECONDS`, `GENERATION_STALE_SECONDS`, `LOG_LEVEL`.

Do not put secrets in this README or in the repository. Use Space Secrets only.

## Health

- `GET /` — basic service check
- `GET /healthz` — Core API health
- `GET /api/v1/health` — Core API health

The AI Engine is intentionally not exposed publicly.
