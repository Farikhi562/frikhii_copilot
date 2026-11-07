# FRIKHII Copilot — Phase 03

Personal AI learning companion. Phase 03 adds the **AI Course Architect**: a learning
goal becomes a short diagnostic, an evaluated starting point, a validated curriculum
draft, a review/edit/regenerate step, an approved version, and an enrollment.

The React SPA keeps the Phase 02 authentication and profile features. Course business
logic lives in a Go Core API; LLM orchestration lives in a Python AI Engine. The browser
never receives an LLM key, the Python service never writes course data, and the Go
service never trusts a user id from the client.

**Status:** implemented and locally verified. Phase 03 tests pass for Python, Go and the
frontend, and the production build succeeds. **Live Supabase database/RLS testing, a real
LLM provider, and browser E2E testing are not verified** — see `docs/TEST_REPORT.md`.

## Landing page

The public page (`apps/web/src/features/landing/`, composed in `pages/Landing.tsx`) tells the
product story in 13 sections ending with a FAQ and final call to action. Demo content is
labelled, and each capability is tagged *Built, in testing*, *Partly built* or *Planned*;
update `faqContent.ts` and the section data when a roadmap phase ships. Trailer video and
poster URLs are set in `apps/web/src/lib/assets.ts` (empty shows "Trailer coming soon").
See `docs/LANDING_PAGE_AUDIT.md`.

## Architecture

```text
React/Vite SPA (apps/web)
  │  Supabase access token
  ▼
Go + Chi Core API (services/core-api) ──────► Supabase PostgreSQL
  │  internal token + structured JSON              (ownership checks,
  ▼                                                 versioning, RLS)
Python + FastAPI AI Engine (services/ai-engine)
  │
  ▼
OpenAI-compatible provider (configurable)
```

- **Go owns authorization and writes.** It verifies Supabase JWTs through JWKS, re-checks
  ownership in every query, validates generated structures again, and persists courses.
- **Python owns generation.** It defines Pydantic schemas, deterministic validators, one
  repair attempt, provider timeouts/retries, and an optional configured fallback.
- **Supabase owns identity and the database.** RLS protects direct browser/PostgREST
  access; the Go service uses a privileged connection that re-checks ownership itself.

## Run locally

Prerequisites: Node 24+, Go 1.22+, Python 3.11+, and a Supabase project.

1. **Install the web app**

   ```bash
   npm install
   cp .env.example .env.local
   # fill VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
   # set VITE_CORE_API_URL=http://localhost:8080
   ```

2. **Apply the database migrations** in filename order in the Supabase SQL Editor (or copy
   `database/migrations/*.sql` into `supabase/migrations/` and use the CLI):

   - `20251105090000_phase_02_profiles_and_preferences.sql`
   - `20251105091000_phase_03_course_architect.sql`

   Then run `database/tests/rls_phase_02.sql` and `database/tests/rls_phase_03.sql` with
   two real users. These scripts are prepared but were not executed here (no database
   credentials were available).

3. **Configure the AI Engine**

   ```bash
   cd services/ai-engine
   cp .env.example .env
   # set INTERNAL_SERVICE_TOKEN
   # set LLM_PROVIDER and provider credentials, or use LLM_PROVIDER=mock in development
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```

4. **Configure the Core API** (environment variables, no dotenv loader):

   ```bash
   cd services/core-api
   # PowerShell example:
   $env:DATABASE_URL="postgresql://..."
   $env:SUPABASE_URL="https://<project-ref>.supabase.co"
   $env:AI_ENGINE_URL="http://127.0.0.1:8000"
   $env:INTERNAL_SERVICE_TOKEN="<same value as the AI Engine>"
   $env:CORS_ORIGINS="http://localhost:5173"
   go run ./cmd/api
   ```

   See `services/core-api/README.md` for every setting. The API starts in degraded mode
   without `DATABASE_URL`; course endpoints return 503 rather than pretending to save.

5. **Start the web app**

   ```bash
   npm run dev
   ```

   Open <http://localhost:5173>.

### Tests

```bash
# Python
cd services/ai-engine
$env:APP_ENV="test"; $env:INTERNAL_SERVICE_TOKEN="test-internal-token"
$env:LLM_PROVIDER="mock"; $env:RATE_LIMIT_PER_MINUTE="600"
python -m pytest

# Go
cd services/core-api
go test ./...

# Frontend
npm test
npm run typecheck
npm run lint
npm run build
```

The Go/Python live contract test is opt-in:

```bash
$env:AI_CONTRACT_URL="http://127.0.0.1:8001"
$env:AI_CONTRACT_TOKEN="test-internal-token"
go test ./internal/aiclient -run TestLiveAIContract -count=1 -v
```

## Routes

| Route | Access | Purpose |
|---|---|---|
| `/`, `/privacy`, `/terms`, `/contact` | Public | Landing and legal placeholders |
| `/login`, `/register` | Public | Supabase Auth |
| `/forgot-password`, `/reset-password`, `/auth/callback` | Public | Recovery and email links |
| `/app` | Authenticated | Overview (real goals/courses; see `docs/APP_WORKSPACE.md`) |
| `/app/courses` | Authenticated | Real course list and drafts |
| `/app/courses/new` | Authenticated | Multi-step learning-goal intake |
| `/app/goals/:goalId/diagnostic` | Authenticated | Diagnostic questions and submission |
| `/app/goals/:goalId/result` | Authenticated | Evaluated level, gaps and feedback |
| `/app/goals/:goalId/generating` | Authenticated | Generation state with refresh polling |
| `/app/courses/:courseId/review` | Authenticated | Edit, regenerate, approve, enroll |
| `/app/courses/:courseId` | Authenticated | Enrolled curriculum or draft preview |
| `/app/courses/:courseId/roadmap`, `/classes/:classId`, `/lessons/:lessonId` | Authenticated | Roadmap, class page, lesson workspace |
| `/app/tutor` | Authenticated | AI Tutor UI (no backend; says so) |
| `/app/progress`, `/app/help` | Authenticated | Learning progress (real plan data only), Help |
| `/app/courses/demo` | Authenticated | Labelled built-in sample course |
| `/app/settings` | Authenticated | Phase 02 profile and preferences, workspace preference |
| `/dev/components` | Development only | UI gallery |

Route guards are UX only. Authorization is enforced by the Go API (JWT + ownership) and,
for direct PostgREST access, by RLS.

## API summary

All endpoints except health/readiness require `Authorization: Bearer <Supabase JWT>`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/healthz`, `/readyz` | Liveness and dependency/auth readiness |
| `POST` | `/api/v1/learning-goals` | Create a learning goal |
| `GET` | `/api/v1/learning-goals` | List the caller's goals |
| `GET` | `/api/v1/learning-goals/{goalID}` | Read one goal |
| `POST` | `/api/v1/learning-goals/{goalID}/diagnostic` | Generate the diagnostic |
| `GET` | `/api/v1/learning-goals/{goalID}/diagnostic` | Read the latest attempt |
| `POST` | `/api/v1/learning-goals/{goalID}/diagnostic/submit` | Submit/evaluate answers |
| `GET` | `/api/v1/learning-goals/{goalID}/diagnostic/result` | Read the evaluated result |
| `POST` | `/api/v1/learning-goals/{goalID}/generate` | Generate a draft course |
| `GET` | `/api/v1/courses` | List summaries |
| `GET` | `/api/v1/courses/{courseID}` | Read course + versions |
| `PATCH` | `/api/v1/courses/{courseID}/draft` | Edit a draft |
| `POST` | `/api/v1/courses/{courseID}/regenerate` | Create a new draft version |
| `POST` | `/api/v1/courses/{courseID}/approve` | Approve a version and enroll |

Errors use `{"error":{"code","message","request_id","details?"}}`.

## Security notes

- The browser bundle uses only the Supabase **publishable** key. `VITE_SUPABASE_ANON_KEY`
  is no longer read by the client; set a legacy anon key under
  `VITE_SUPABASE_PUBLISHABLE_KEY` if your project only provides that name.
- Never put a Supabase secret/service-role key, database password, or LLM key in a
  `VITE_*` variable. Server secrets belong in the service environments.
- A legacy `sb_secret_`-prefixed value was found in the local `.env.local` during Phase 03
  hardening. The line was removed and the code no longer references that variable. If that
  key was ever copied or shared, **rotate it in Supabase**. The value is not reproduced
  here or included in the delivery archive.
- `docs/SECURITY.md` lists implemented controls, RLS boundaries, and residual risks.

## Environment files

| File | Purpose | Committed? |
|---|---|---|
| `.env.local` (repo root) | Browser config read by Vite | No |
| `.env.example` | Browser config template | Yes |
| `services/core-api/.env.example` | Server-side Core API template (export variables yourself) | Yes |
| `services/ai-engine/.env.example` | AI Engine template (copy to `.env`) | Yes |

## Docs

- `docs/PHASE_03_AUDIT.md` — pre-implementation audit + final verification record
- `docs/PHASE_03_IMPLEMENTATION.md` — endpoints, generation flow, validation and tests
- `docs/APP_WORKSPACE.md` — authenticated workspace: routes, shell, real vs demo data
- `docs/ARCHITECTURE.md` — current services, data flow and boundaries
- `docs/DATABASE_SCHEMA.md` — Phase 02/03 tables, constraints, RLS
- `docs/SECURITY.md` — implemented controls and residual risks
- `docs/DEVELOPMENT_ROADMAP.md` — phase status and Phase 04 entry criteria
- `docs/TEST_REPORT.md` — exact commands/results and what is still unverified
- `docs/SUPABASE_SETUP.md` — dashboard, migrations, redirect URLs, verification

## Known limitations

- Live Supabase migrations/RLS, a real LLM provider, and browser E2E were not available in
  this environment. Unit/contract tests use the in-memory store and deterministic mock
  provider; they do not prove production behavior.
- Lesson playback, assessment attempts, unlock enforcement, AI tutor, analytics and
  payments are later phases.
- Course generation is synchronous from the browser's perspective. A Postgres generation
  lock and stale timeout prevent duplicate work; the page polls instead of showing fake
  progress percentages.
