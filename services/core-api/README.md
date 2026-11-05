# FRIKHII Copilot — Core API (Go + Chi)

HTTP and business layer for Phase 03. It verifies Supabase access tokens, enforces
ownership, validates generated curricula, and is the only writer of course data.

## Responsibilities

- Verify Supabase JWTs (ES256/RS256 via JWKS; optional HS256 secret for legacy projects).
- Reject malformed/expired tokens and require a UUID `sub`.
- Enforce ownership in every SQL predicate; never trust a user id from the client.
- Normalize and validate learning-goal and draft-edit input.
- Call the Python AI Engine with the internal shared token.
- Validate AI output again with Go structural rules before persistence.
- Persist goals, diagnostic attempts/questions/keys/answers, courses, versions, nested
  content, approvals and enrollments in transactions.
- Keep one approved version per course and make repeated approval idempotent.
- Return safe error envelopes with a request id.

## Run

```bash
cd services/core-api
# set the variables from .env.example in your shell / service manager
go run ./cmd/api
```

Without `DATABASE_URL`, the process starts in degraded mode and course endpoints return
503. Without `SUPABASE_URL`/`SUPABASE_JWT_SECRET`, authenticated endpoints return 503.
Without `AI_ENGINE_URL`/`INTERNAL_SERVICE_TOKEN`, generation endpoints are unavailable.

## Configuration

See `.env.example`. Important defaults:

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `8080` | HTTP port |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated exact origins |
| `AI_TIMEOUT_SECONDS` | `120` | Diagnostic generation/evaluation timeout |
| `AI_GENERATION_TIMEOUT_SECONDS` | `240` | Course generation timeout |
| `GENERATION_STALE_SECONDS` | `600` | Reclaim a generation lock after a crash |
| `MAX_REQUEST_BYTES` | `262144` | Request body limit |
| `AUTH_DISABLED` | `false` | Local tests only; refused in production |

`SUPABASE_JWKS_URL` and `SUPABASE_JWT_ISSUER` are derived from `SUPABASE_URL` when empty.
`SUPABASE_JWT_SECRET` is a fallback for legacy HS256 projects; do not set it for ES256.

## Endpoints

Public:

- `GET /healthz`
- `GET /readyz`

Authenticated with `Authorization: Bearer <Supabase access token>`:

- `POST/GET /api/v1/learning-goals`
- `GET /api/v1/learning-goals/{goalID}`
- `POST/GET /api/v1/learning-goals/{goalID}/diagnostic`
- `POST /api/v1/learning-goals/{goalID}/diagnostic/submit`
- `GET /api/v1/learning-goals/{goalID}/diagnostic/result`
- `POST /api/v1/learning-goals/{goalID}/generate`
- `GET /api/v1/courses`
- `GET /api/v1/courses/{courseID}`
- `PATCH /api/v1/courses/{courseID}/draft`
- `POST /api/v1/courses/{courseID}/regenerate`
- `POST /api/v1/courses/{courseID}/approve`

## Generation and failure behavior

1. The handler loads the goal and requires an evaluated diagnostic.
2. `BeginGeneration` takes a row lock. A live lock returns `409 generation_in_progress`;
   a lock older than `GENERATION_STALE_SECONDS` can be reclaimed.
3. The AI call runs in a context detached from the browser connection, so a refresh does
   not abort work the database already considers running.
4. AI output is validated by `internal/validate.Curriculum`; malformed output is never
   persisted. A failed first generation leaves the goal `failed` and retryable.
5. A failed **regeneration** restores the goal to `course_draft` or `approved` if a course
   still exists, so the review page remains usable.
6. Approval uses one transaction: supersede the old approved version, mark the new version
   approved, update the course, and upsert enrollment. Repeated approval is idempotent.

The browser must never receive `diagnostic_answer_keys`; the API does not serialize answer
keys or question explanations.

## Store implementations

- `internal/store/postgres.go` — `pgx` implementation used in production.
- `internal/store/memory.go` — ownership/lifecycle mirror used by HTTP tests and local
  handler development. It is not a database substitute.

## Tests

```bash
go test ./...
go vet ./...
```

The optional live contract test requires a running AI Engine:

```bash
# PowerShell
$env:AI_CONTRACT_URL="http://127.0.0.1:8001"
$env:AI_CONTRACT_TOKEN="test-internal-token"
go test ./internal/aiclient -run TestLiveAIContract -count=1 -v
```

Tests cover JWT/JWKS verification, input validation, curriculum structure, ownership,
generation locking/stale reclaim, the full HTTP lifecycle, invalid AI output, regeneration
failure recovery, answer-key non-exposure, CORS and request ids.

## Not covered

- No live Supabase database/RLS run was possible here (no `DATABASE_URL`).
- No real LLM provider was configured; live quality/latency/rate limits are unverified.
- No browser/E2E run in this environment.
