# Phase 03 Implementation — AI Course Architect

**Status:** implemented and locally verified. Live Supabase database/RLS, a real LLM
provider and browser E2E remain unverified; see `docs/TEST_REPORT.md`.

## Objective

Turn a learning goal into a personalized, reviewable curriculum while keeping the
security boundary simple:

- the React SPA never holds an LLM key and never calls a provider;
- the Python AI Engine generates and validates structured content but does not write the
  database;
- the Go Core API owns authentication, ownership, business rules, validation and all
  writes;
- Supabase Auth/PostgreSQL provide identity and persistence, with RLS for direct browser
  access and an explicit one-approved-version model.

## Delivered components

```text
apps/web/                       React/Vite/TypeScript SPA
services/core-api/              Go + Chi HTTP API
services/ai-engine/             Python + FastAPI generation service
database/migrations|rollbacks|tests
docs/
```

### Frontend

| Area | Files |
|---|---|
| Core API client | `src/features/course/api/course.ts`, `keys.ts` |
| Zod schemas | `src/features/course/schemas/course.ts`, `intake.ts` |
| Query hooks | `src/features/course/hooks/useCourse.ts` |
| Shared UI | `src/features/course/components/CourseBits.tsx` |
| Intake | `src/pages/app/NewCourse.tsx` |
| Diagnostic | `src/pages/app/Diagnostic.tsx`, `DiagnosticResult.tsx` |
| Generation | `src/pages/app/Generating.tsx` |
| Review/approve | `src/pages/app/CourseReview.tsx` |
| Course detail | `src/pages/app/CourseDetail.tsx` |
| Dashboard/list | `src/pages/app/Dashboard.tsx`, `Courses.tsx` |
| Routes | `src/app/router.tsx` |

The client sends the Supabase access token to the Go API, validates every response with
Zod, and shows safe error copy. Polling is real status polling (goal `generating`, 2.5 s)
rather than a fabricated progress bar.

### Core API (Go + Chi)

| Area | Files |
|---|---|
| Entry point / shutdown | `cmd/api/main.go` |
| Config | `internal/config/config.go` |
| JWT/JWKS verification | `internal/auth/verifier.go` |
| Domain types | `internal/domain/learning.go`, `course.go` |
| AI client | `internal/aiclient/client.go` |
| Validation | `internal/validate/input.go`, `curriculum.go` |
| HTTP routes/middleware | `internal/httpapi/server.go`, `handlers.go`, `errors.go` |
| Persistence | `internal/store/postgres.go`, `store.go` |
| Test store | `internal/store/memory.go` |

Key behaviors:

- JWT `sub` is required, must be a UUID, and is the only source of `user_id`.
- `BeginGeneration` locks the goal row; a stale lock can be reclaimed.
- AI output is validated again with `validate.Curriculum` before a transaction writes it.
- Approval supersedes the previous approved version, marks the new one approved, updates
  the course and upserts enrollment in one transaction.
- A failed first generation leaves the goal `failed` and retryable. A failed regeneration
  restores `course_draft`/`approved` when a course still exists.

### AI Engine (Python + FastAPI)

| Area | Files |
|---|---|
| Settings/safety | `app/core/config.py` |
| Errors/rate limit/security | `app/core/errors.py`, `ratelimit.py`, `security.py` |
| Routes | `app/api/routes.py` |
| Provider abstraction | `app/providers/*` |
| Prompt templates | `app/prompts/*` |
| Pydantic schemas | `app/schemas/*` |
| Structural validators | `app/validators/*` |
| Services | `app/services/*` |

Providers:

- `openai-compatible` — real adapter (OpenAI or compatible gateway), configurable model,
  base URL, structured-output mode, timeout, bounded retries.
- `mock` — deterministic fixtures for offline development/tests only; rejected in
  production, including as a fallback.

Validation rejects duplicate ids, unknown references, circular prerequisites, forward
prerequisites, invalid sequences, inconsistent durations/counts, missing required fields,
oversized output, URLs/citations and malformed JSON. One repair attempt is allowed; a
second failure is returned as a safe error.

## API contract

Authenticated routes use `Authorization: Bearer <Supabase access token>`.

| Method | Path | Success envelope |
|---|---|---|
| `POST` | `/api/v1/learning-goals` | `{"learning_goal": ...}` (201) |
| `GET` | `/api/v1/learning-goals` | `{"learning_goals": [...]}` |
| `GET` | `/api/v1/learning-goals/{goalID}` | `{"learning_goal": ...}` |
| `POST` | `/api/v1/learning-goals/{goalID}/diagnostic` | `{"diagnostic": ...}` (201) |
| `GET` | `/api/v1/learning-goals/{goalID}/diagnostic` | `{"diagnostic": ...}` |
| `POST` | `/api/v1/learning-goals/{goalID}/diagnostic/submit` | `{"diagnostic": ...}` |
| `GET` | `/api/v1/learning-goals/{goalID}/diagnostic/result` | `{"diagnostic": ...}` |
| `POST` | `/api/v1/learning-goals/{goalID}/generate` | `{"course": ...}` (201) |
| `GET` | `/api/v1/courses` | `{"courses": [...]}` |
| `GET` | `/api/v1/courses/{courseID}` | `{"course": ...}` |
| `PATCH` | `/api/v1/courses/{courseID}/draft` | `{"course": ...}` |
| `POST` | `/api/v1/courses/{courseID}/regenerate` | `{"course": ...}` (201) |
| `POST` | `/api/v1/courses/{courseID}/approve` | `{"course": ...}` |

Errors:

```json
{
  "error": {
    "code": "invalid_generated_content",
    "message": "The AI response did not pass validation. You can retry.",
    "request_id": "...",
    "details": ["optional safe details"]
  }
}
```

Notable codes: `unauthorized`, `not_found`, `validation_error`, `conflict`,
`invalid_state`, `generation_in_progress`, `ai_timeout`, `ai_rate_limited`,
`invalid_generated_content`, `storage_unavailable`, `auth_not_configured`.

## End-to-end flow

1. **Intake** — `POST /learning-goals`. Server trims/length-checks fields, validates
   enums/dates/JSON size, stores `status=intake`.
2. **Diagnostic generation** — Go asks Python for 5–8 questions and private answer keys.
   Go validates question count, unique ids/sequences, answer-key coverage and requested
   count; stores questions + keys; sets `diagnostic_ready`.
3. **Answer submission** — Go validates exactly 5–8 trimmed, non-empty, unique answers
   covering every question; stores them as `submitted`; sends answers + private keys to
   Python for evaluation; stores level/strengths/gaps/misconceptions/feedback and sets
   `diagnostic_evaluated`.
4. **Generation** — Go requires an evaluated diagnostic, takes the generation lock, calls
   Python with the goal + evaluation (not answer keys), validates the blueprint and writes
   course/version/content + `course_draft`.
5. **Review** — the browser can edit draft titles/descriptions (PATCH) or regenerate a new
   version (POST).
6. **Approve** — `POST /courses/{id}/approve` with `version_id`. Go verifies ownership,
   draft state and structure, supersedes the old approved version, approves the new one,
   updates `approved_version_id`, and upserts an active enrollment.
7. **Course detail** — shows the approved curriculum; if a newer draft exists, the review
   page is still reachable and the approved version remains live.

## Data and versioning

- `learning_goals` has a status lifecycle and a safe `last_error`.
- `diagnostic_answer_keys` is private: RLS enabled, no browser grants, never serialized.
- One `courses` row per learning goal. Regeneration adds `course_versions`.
- `courses.current_version_id` can point to a newer draft while
  `courses.approved_version_id` stays on the live version.
- A partial unique index permits one approved version per course; approval is idempotent.
- Nested content (`course_modules`, `classes`, `lessons`, `lesson_contents`, `exercises`,
  `learning_objectives`) belongs to a version and cascades on delete.
- `lesson_contents` stores a **blueprint** in Phase 03; authoring is Phase 04.

See `docs/DATABASE_SCHEMA.md` for columns, constraints and the RLS matrix.

## Configuration

### Browser (root `.env.local`)

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_CORE_API_URL=http://localhost:8080
```

Production builds require `VITE_CORE_API_URL`; the client fails closed rather than
defaulting silently in production.

### Core API

See `services/core-api/.env.example`. It reads environment variables directly (no dotenv
loader). Required for full operation: `DATABASE_URL`, Supabase JWT settings,
`AI_ENGINE_URL`, `INTERNAL_SERVICE_TOKEN`.

### AI Engine

Copy `services/ai-engine/.env.example` to `.env`. Required: `INTERNAL_SERVICE_TOKEN`,
provider/model/key/base URL (or `LLM_PROVIDER=mock` outside production). Optional fallback
is used only when fully configured.

## Failure behavior

| Failure | Behavior |
|---|---|
| Provider timeout | Safe `ai_timeout`; goal/diagnostic retryable. |
| Provider 429 | Safe `ai_rate_limited`; bounded retries then error. |
| Invalid JSON/schema/structure | One repair attempt, then `invalid_generated_content`; nothing persisted. |
| Duplicate generation request | `409 generation_in_progress`; UI refetches and polls. |
| Crashed generation | Lock older than `GENERATION_STALE_SECONDS` can be reclaimed. |
| Failed regeneration | Existing draft/approved course remains usable; goal status restored. |
| Browser refresh during generation | Server-side work continues in a detached context; page polls. |
| Missing database/auth/AI config | Fail closed with 503/setup UI; no fake success. |

## Tests and verification

| Layer | Command | Result |
|---|---|---|
| Python | `python -m pytest` | 24 passed |
| Go | `go test ./...`; `go vet ./...` | Pass, 15 top-level + 10 subtests |
| Go↔Python contract | opt-in `TestLiveAIContract` | Pass against local Python mock |
| Frontend | `npm test` | 46 passed |
| Types/lint/build | `npm run typecheck`, `npm run lint`, `npm run build` | Pass |

Full details and unverified areas: `docs/TEST_REPORT.md`.

## Known limitations

- No live Supabase database/RLS run.
- No real LLM provider key; real quality/latency/quota unverified.
- No browser E2E.
- No durable per-user generation quota/audit log yet.
- Course generation is synchronous from the browser's perspective; it relies on a
  generation lock and polling, not a background queue.
- Lesson playback, assessment attempts, unlock enforcement, tutor and analytics are later
  phases.

## Landing page FAQ (addendum)

A FAQ section sits on the landing page after "Why FRIKHII" and before the final call to
action (`apps/web/src/features/landing/`).

- `faqContent.ts` holds the eight questions, answers and per-answer status notes. Each
  note is labelled **Built, in testing**, **Partly built** or **Planned** so no planned
  feature (guided lessons, assessment, AI tutor, progress tracking) is described as
  available. Update this file when a roadmap phase ships.
- `FaqSection.tsx` is a dependency-free accordion following the WAI-ARIA accordion
  pattern (h3 > button, `aria-expanded`, `aria-controls`, Arrow/Home/End navigation,
  `inert` closed panels, one open item at a time, collapsible). `@radix-ui/react-accordion`
  is not a project dependency and the lockfile could not be regenerated offline, so it was
  not added.
- A schema.org `FAQPage` JSON-LD block is generated from the same data.
- No pricing, plans or integrations are mentioned.
- Two stale disclaimers on the landing page ("The Course Architect is not built yet",
  "No AI is connected in this phase") were corrected because they contradicted this phase.
- Authentication code, routes and guards were not modified.
