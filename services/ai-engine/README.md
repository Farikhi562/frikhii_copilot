# FRIKHII Copilot â€” AI Engine (Python + FastAPI)

Provider-independent generation service for Phase 03 diagnostics and curriculum
blueprints. It returns structured JSON only; it never writes courses or reads other users'
data.

## Responsibilities

- Generate a 5â€“8 question diagnostic with private answer keys.
- Evaluate learner answers into level, strengths, gaps, misconceptions and feedback.
- Generate a complete course blueprint (modules, classes, lessons, exercises, final
  project/assessment).
- Validate every AI response with Pydantic schemas **and** deterministic structural
  validators.
- Allow exactly one repair attempt for malformed output.
- Provide an OpenAI-compatible adapter with timeouts, safe retries, rate-limit errors and
  an optional explicitly configured fallback.
- Refuse to start with unsafe production settings (for example a mock provider/fallback in
  production).

## Run

```bash
cd services/ai-engine
cp .env.example .env
# fill INTERNAL_SERVICE_TOKEN and provider settings
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The engine exposes no public generation endpoint. Every `/internal/v1/*` route requires
`X-Internal-Token: <INTERNAL_SERVICE_TOKEN>`; the Go Core API is the only caller, and
there is no browser CORS configuration. The shared secret must be set outside tests.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/internal/v1/diagnostic/generate` | Diagnostic questions + answer keys |
| `POST` | `/internal/v1/diagnostic/evaluate` | Evaluate submitted answers |
| `POST` | `/internal/v1/course/generate` | Curriculum blueprint |
| `GET` | `/healthz` | Liveness |

Errors use the same `{"error":{"code","message","request_id","details?"}}` envelope as the
Core API.

## Providers

`LLM_PROVIDER` accepts:

- `openai-compatible` â€” the real adapter; works with OpenAI and compatible gateways
  (OpenRouter, Groq, Together, vLLM, Ollama, Google's compatible endpoint, etc.).
  Configure `LLM_MODEL`, `LLM_API_KEY`, `LLM_BASE_URL`.
- `mock` â€” deterministic fixture output. Allowed only when `APP_ENV` is not `production`;
  the response metadata and UI disclose it.

`LLM_STRUCTURED_OUTPUT` selects `json_object` (broad compatibility) or `json_schema`
(where the provider supports it). `LLM_MAX_RETRIES` retries transient timeouts/429/5xx
only; it never retries a validation failure without the repair prompt.

The optional fallback is used only when `LLM_FALLBACK_PROVIDER` and its credentials are
set. Metadata records `fallback_used` and a safe `fallback_reason`. A mock fallback is
rejected in production.

## Validation

- Schemas: `app/schemas/common.py`, `diagnostic.py`, `curriculum.py`.
- Validators: `app/validators/diagnostic.py`, `curriculum.py`.
- Checks include unique ids, contiguous sequences, valid references, prerequisite ordering,
  cycle prevention, duration/volume limits, required lesson/exercise fields, and URL or
  citation-like output rejection.
- Go repeats structural validation before persistence, so a compromised or misconfigured
  Python service cannot bypass the Core API boundary.

## Tests

```bash
cd services/ai-engine
$env:APP_ENV="test"; $env:INTERNAL_SERVICE_TOKEN="test-internal-token"
$env:LLM_PROVIDER="mock"; $env:RATE_LIMIT_PER_MINUTE="600"
python -m pytest
```

Coverage includes provider parsing/retry/timeout mapping, structured-output repair,
schema/structure validators, API auth/rate limiting, the mock diagnostic/course lifecycle,
duplicate-answer rejection, and production configuration guards.

## Not covered

- No real provider key was configured; live model quality, latency, quotas and provider
  errors are unverified.
- No live database is touched by this service by design.
