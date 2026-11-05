# Deploy the backend to Hugging Face Spaces

This is the free, no-credit-card path for running the Go Core API and Python AI
Engine without keeping the laptop on. The frontend stays on GitHub Pages at
`https://copilot.frikhii.my.id`.

## What runs where

```text
Browser (GitHub Pages)
  -> Hugging Face Docker Space :7860  (Go Core API)
       -> 127.0.0.1:8000             (Python AI Engine)
       -> Supabase PostgreSQL
```

The Space contains both backend services in one container. Only the Core API is
public. The AI Engine is internal to the container.

## One-time Hugging Face setup

1. Create an account at <https://huggingface.co/join>. Signing in with GitHub is
   the quickest option.
2. Open <https://huggingface.co/settings/tokens>.
3. Create a token named `frikhii-deploy` with **Write** access.
4. Save the token to a local file, not in chat or git:

   ```text
   C:\Users\ASUS\AppData\Local\Temp\opencode\hf_token.txt
   ```

   The file must contain only the token.

## Deploy

From the repository root:

```powershell
C:\Users\ASUS\anaconda3\python.exe scripts\deploy_hf_space.py
```

The script:

1. Reads the existing local service `.env` files.
2. Builds a clean upload folder and refuses to continue if any `.env` leaks.
3. Creates the Space `frikhii-copilot-api` if it does not exist.
4. Sets database, Supabase, CORS, AI provider, and shared-token secrets.
5. Uploads and builds the Docker image.
6. Waits for `https://<username>-frikhii-copilot-api.hf.space` to become healthy.
7. Updates `apps/web/public/config.js`, rebuilds the frontend, and pushes the
   new bundle to the `gh-pages` branch.

Useful flags:

```powershell
# Backend only; do not touch GitHub Pages
C:\Users\ASUS\anaconda3\python.exe scripts\deploy_hf_space.py --skip-frontend

# Use a real Gemini key from services/ai-engine/.env
C:\Users\ASUS\anaconda3\python.exe scripts\deploy_hf_space.py --provider gemini
```

The default provider is `mock`, so the demo works without an LLM key. The UI
discloses that generation is mocked.

## After deploy

- The custom domain remains `https://copilot.frikhii.my.id`.
- The laptop can be turned off.
- Free Spaces sleep after 48 hours without traffic. The first request after
  sleep is a cold start and can take a while.
- To update the backend later, run the script again. It reuses the same Space.
- To change secrets, use the Space **Settings → Secrets** page or rerun the
  script after updating the local `.env` files.

## Troubleshooting

| Symptom | Check |
|---|---|
| Space shows build error | Space **Logs** tab; usually a missing secret or Docker build issue |
| Space runs but API returns 503 | `DATABASE_URL` / `SUPABASE_URL` secret missing or database unreachable |
| Generation endpoints fail | `INTERNAL_SERVICE_TOKEN` must match in both services; it is one shared Space secret |
| Browser CORS error | `CORS_ORIGINS` must contain `https://copilot.frikhii.my.id` |
| `401` on data endpoints | Sign in again; the Supabase JWT is missing or expired |

Do not upload `.env` files to the Space. The deployment script excludes them and
the Space is public by default.
