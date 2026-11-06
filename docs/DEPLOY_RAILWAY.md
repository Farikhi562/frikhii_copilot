# Deploy the backend to Railway

The frontend stays on GitHub Pages at `https://copilot.frikhii.my.id`. The Go
Core API and Python AI Engine run in one Railway container.

```text
Browser (GitHub Pages)
  -> Railway :8080                 (Go Core API)
       -> 127.0.0.1:8000           (Python AI Engine)
       -> Supabase PostgreSQL
```

Only the Core API is public. The AI Engine is internal to the container.

## Current deployment

| Item | Value |
|---|---|
| Railway project | `frikhii-copilot` |
| Railway service | `api` |
| Backend URL | `https://api-production-7064.up.railway.app` |
| Frontend URL | `https://copilot.frikhii.my.id` |
| AI provider | `mock` (demo-safe) |

The browser reads the backend URL from `apps/web/public/config.js` at runtime.

## Files

- `Dockerfile` — Railway build: Go binary + Python runtime in one image.
- `.dockerignore` — keeps frontend, node_modules and `.env` files out of the build context.
- `railway.json` — Dockerfile builder and `/healthz` healthcheck.
- `scripts/set_railway_vars.py` — pushes values from the local service `.env` files to Railway without printing them.
- `scripts/publish_pages.py` — rebuilds the frontend and pushes `dist` to `gh-pages`.

## Deploy again

```powershell
# 1. Make sure the Railway CLI is logged in
railway whoami

# 2. Push the current local settings (secrets are read from .env files)
C:\Users\ASUS\anaconda3\python.exe scripts\set_railway_vars.py --service api

# 3. Build and start the backend
railway up --ci --service api

# 4. Point GitHub Pages at the backend and publish
C:\Users\ASUS\anaconda3\python.exe scripts\publish_pages.py --api-url https://api-production-7064.up.railway.app
```

Railway injects `PORT` at runtime. The Dockerfile defaults to `8080` for local
runs. Do not hardcode a different public port.

## Environment variables

The script sets these from `services/core-api/.env` and
`services/ai-engine/.env`:

`DATABASE_URL`, `SUPABASE_URL`, `INTERNAL_SERVICE_TOKEN`, `CORS_ORIGINS`,
`APP_ENV=development`, `AI_PROVIDER=mock`, `AI_ENGINE_URL`,
`RATE_LIMIT_PER_MINUTE=120`, `LOG_LEVEL=info`, plus timeouts and the Gemini key
when present.

`APP_ENV=development` is intentional while the demo uses the mock provider. The
AI Engine rejects `AI_PROVIDER=mock` in production. To use a real provider, set
`AI_PROVIDER=gemini` and a working `GEMINI_API_KEY`; the current Gemini endpoint
has been unreliable, so mock is the safe demo default.

## Free-tier notes

Railway's Free Trial gives **$5 of credit for 30 days with no credit card**.
After that, the Free plan includes **$1/month** of usage; a very light idle
service may fit, but heavy use can exceed it. The app is small (Go + Python,
no database server in the container), so usage should stay low.

## Troubleshooting

| Symptom | Check |
|---|---|
| Build error | `railway logs --build --lines 100` |
| Container crashes | `railway logs --lines 100` |
| `/readyz` returns 503 | `DATABASE_URL` or `SUPABASE_URL` missing/unreachable |
| Browser CORS error | `CORS_ORIGINS` must include `https://copilot.frikhii.my.id` |
| Generation fails | `INTERNAL_SERVICE_TOKEN` must match in both services; it is one shared value |
| Frontend still calls the old URL | `apps/web/public/config.js` was not rebuilt/redeployed |
