# Phase 03 Audit — AI Course Architect

**Date:** 2026-11-05
**Audited tree:** the working project supplied for Phase 03 (Phase 02 implementation present in
`D:\frikhii-copilot`). No Phase 02 ZIP was available in the workspace or Downloads; the
unpacked tree was inspected instead and its documented state was verified against the files.

> **Reading note:** sections 1–5 record the **pre-implementation audit** and the plan.
> Section 6 records what was actually built, what changed during hardening, and what remains
> unverified. For the current state, start with section 6.

## 1. What exists

### Frontend

- React 19, Vite 8, TypeScript 5, Tailwind CSS 4, Radix, Motion, React Router 7,
  TanStack Query 5, Zustand 5, React Hook Form, Zod 4, Lucide.
- Public landing page, auth pages (register/login/forgot/reset/callback), protected
  `/app` shell with dashboard, courses, settings.
- Supabase browser client with PKCE, `detectSessionInUrl: false`, publishable key only.
- `AuthProvider` owns the single session subscription; route guards are UX only.
- Profile and preferences use typed Supabase helpers + TanStack Query.
- Courses and dashboard are explicitly labelled sample data. No learning domain exists yet.
- 35 tests across 7 files (schemas, auth provider, guards, profile, redirects, auth pages,
  router), typecheck/lint/build passing as recorded in `TEST_REPORT.md`.

### Database

- `database/migrations/20251105090000_phase_02_profiles_and_preferences.sql`:
  `profiles`, `user_preferences`, signup trigger, `updated_at` trigger, RLS + explicit grants.
- Rollback and `database/tests/rls_phase_02.sql` exist.
- No learning-goal, diagnostic, course, or enrollment tables.

### Services

- `services/core-api/README.md` and `services/ai-engine/README.md` are placeholders.
- No Go module, no Python package, no service code.

### Configuration

- Root `.env.example` documents only `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`.
- `.env.local` is present locally (ignored by git). It contains a project URL and a
  publishable key. The project's JWKS endpoint is reachable and advertises **ES256**, so
  the Go API must verify asymmetric Supabase JWTs through JWKS. No database password,
  service-role key, or LLM key is present, and none was requested.

## 2. What is genuinely verified vs assumed

| Item | Status |
|---|---|
| Frontend Phase 02 code and tests | Verified by reading; the recorded commands can be re-run |
| Supabase project reachability / ES256 JWKS | Verified live during this audit |
| Live login/registration against Supabase | Not verified (no test account; email confirmation enabled) |
| Phase 02 migrations applied to the hosted DB | Not verified (no database credentials) |
| RLS behaviour | SQL reviewed; not executed |
| LLM provider access | Not verified (no provider key configured) |
| Go/Python toolchains | Verified: Go 1.27.3, Python 3.13.7, FastAPI/Pydantic/httpx/pytest installed |

## 3. Compatibility risks

1. **The frontend currently reads profiles via PostgREST.** Phase 03 course data will go
   through the Go API, but Phase 02 auth/profile code must remain untouched and functional.
2. **The Go API needs database access.** Supabase projects do not expose the database
   password in the browser key. The deployment must supply `DATABASE_URL` (or a pooler URL)
   as a server-side secret. Without it the API can start but course endpoints return 503.
3. **Supabase JWT signing changed.** Legacy projects use HS256; this project uses ES256.
   The verifier supports JWKS (ES256/RS256) and an optional HS256 secret fallback.
4. **RLS bypass by the service connection.** A direct Postgres connection as the table
   owner bypasses RLS. The Go API therefore enforces ownership in every SQL predicate and
   documents this boundary. Browser roles remain constrained by RLS/grants.
5. **No LLM key.** The real provider adapter can be implemented and unit-tested with a
   mocked HTTP transport, but live model quality/latency/rate limits cannot be verified
   here. The application must surface provider failures instead of fabricating content.
6. **Long-running generation.** A synchronous request can exceed browser/proxy patience.
   The implementation uses a generation lock in Postgres, detaches the model call from the
   browser request, and lets the generating page poll the goal state on refresh. It does
   not display fabricated percentages.
7. **Free-tier provider changes.** Provider availability, model names, and quotas change.
   The adapter is provider-independent (OpenAI-compatible), configured entirely by env,
   and documentation points owners to official pages instead of promising quotas.

## 4. Implementation decisions

- **Go Core API** (`services/core-api`): Chi, JWT/JWKS verification, ownership checks,
  structural validation of AI output, transactions for versioning/approval/enrollment,
  PostgreSQL via `pgx`. An in-memory store implements the same interface for tests.
- **Python AI Engine** (`services/ai-engine`): FastAPI + Pydantic schemas, deterministic
  validators, provider abstraction with OpenAI-compatible and deterministic mock adapters,
  one repair attempt on malformed output, internal shared-secret auth, timeouts, retry and
  optional configured fallback.
- **Database**: one incremental migration adds the learning domain without altering Phase 02
  tables. Course versions are immutable history; a partial unique index allows one approved
  version per course. Answer keys live in a separate table with no browser grants.
- **Frontend**: new `/app/courses/*` routes and API client. The frontend sends only the
  Supabase access token to the Go API; it never sees provider keys, expected answers, or
  internal service tokens.
- **Honesty**: generated course metadata records the provider/model. If the deterministic
  mock provider is used in development, the UI says so and the API refuses mock in
  production. No fake progress percentages or fabricated citations.
- **Deferred**: lesson execution, assessment attempts, progression unlocking, AI tutor,
  analytics. Phase 03 stores curriculum blueprints and an enrollment only.

## 5. Phase 03 scope boundary

Implemented in this phase:

- Goal intake (goal, current knowledge, constraints, review).
- Diagnostic generation, answering, evaluation, gaps, corrections.
- Curriculum generation, validation, draft editing, regeneration, approval, enrollment.
- Real dashboard/course data with honest empty states.
- Migrations, RLS policies and verification script.
- Layered tests and updated documentation.

Not implemented (later phases): lesson runtime, assessment engine, unlock enforcement,
AI tutor, analytics, payments, multi-user administration.

## 6. Final implementation verification

### Built

| Layer | Delivered | Verification |
|---|---|---|
| Python AI Engine | FastAPI provider abstraction, OpenAI-compatible adapter, deterministic mock, Pydantic schemas, structural validators, one repair attempt, internal token, rate limit, safe errors, production config guards | **24 passed** |
| Go Core API | Chi routes, JWKS/HS256 JWT verification, UUID `sub`, ownership re-checks, generation lock/stale reclaim, AI client, Go structural validation, pgx persistence, versioning/approval/enrollment, request ids and safe errors | **15 top-level tests + 10 subtests**, `go vet` clean |
| Go ↔ Python contract | Real HTTP calls for diagnostic and curriculum, then Go re-validation | **Pass** via opt-in `TestLiveAIContract` (`-count=1`) |
| Database | Incremental Phase 03 migration, rollback, Phase 02/03 RLS test scripts, one-approved-version index, private answer-key table | SQL reviewed; **not executed live** |
| Frontend | Multi-step intake, diagnostic, result, generation polling, review/edit/regenerate/approve, course detail, real dashboard/list, Zod client, TanStack Query hooks | **46 tests**, typecheck/lint/build pass |
| Docs | README, architecture, schema, security, roadmap, implementation guide, test report, this audit | Updated |

### Hardening changes made after the first implementation pass

- **Failed regeneration state:** `markGoalFailed` now checks persisted courses. A failed
  regeneration restores `course_draft` or `approved` instead of marking an existing course
  `failed`; covered by an HTTP test.
- **Diagnostic output validation:** Go now enforces 5–8 questions, unique ids and
  sequences, and exact answer-key coverage before persisting. Invalid AI output marks the
  goal failed instead of saving a broken attempt.
- **Diagnostic answers:** trimmed and required non-empty; duplicate/missing question ids
  and empty responses are rejected; covered by a Go test.
- **Generation locking:** a stale `generating` lock can be reclaimed; covered by a
  memory-store test. The UI refetches on `409 generation_in_progress` rather than showing a
  false error.
- **JWT subject:** a non-UUID `sub` is rejected before store access.
- **Python evaluation:** duplicate answer keys/answers are rejected.
- **Production provider safety:** `APP_ENV=production` rejects a mock primary or fallback
  provider.
- **Browser key cleanup:** the legacy `VITE_SUPABASE_ANON_KEY` fallback was removed from
  `lib/supabase.ts` and `vite-env.d.ts`. The stale local `.env.local` line was deleted; the
  frontend was rebuilt and checked. The bundle contains only the required Supabase URL and
  publishable key; the legacy env name is absent. The only `sb_secret_` string is
  supabase-js's internal key-prefix validation literal, not a configured key.
- **Frontend form performance:** intake reads `getValues()` instead of subscribing the
  whole form to `watch()`.

### Final command results (2026-11-05)

| Check | Result |
|---|---|
| `python -m pytest` (AI Engine, mock provider) | **24 passed** |
| `go test ./...` (Core API) | **Pass** — 15 top-level + 10 subtests |
| `go vet ./...` | **Pass** (exit 0) |
| `TestLiveAIContract -count=1` against local Python on `:8001` | **Pass** |
| `npm test` | **Pass** — 10 files, 46 tests |
| `npm run typecheck` | **Pass** — 0 errors |
| `npm run lint` | **Pass** — 0 errors/warnings |
| `npm run build` | **Pass** — 2233 modules; JS 640.83 kB (190.86 kB gzip); CSS 35.27 kB (7.11 kB gzip) |
| Supabase JWKS reachability | **Pass** — HTTP 200, ES256 key advertised |
| Bundle check | Only the required Supabase URL + publishable key; no legacy key name; `sb_secret_` only as a supabase-js literal |

### Still unverified / blocked

1. **Live Supabase migrations and RLS.** No `DATABASE_URL` or SQL Editor access was
   available. `database/tests/rls_phase_02.sql` and `rls_phase_03.sql` are prepared but
   unexecuted.
2. **Real LLM provider.** No provider key. The OpenAI-compatible adapter is unit-tested
   against a mocked transport; live quality/latency/quota/safety are unknown.
3. **Browser E2E.** The desktop browser was not connected to the coding session.
4. **Deployment.** TLS/CSP/security headers, real CORS origins and the production
   `VITE_CORE_API_URL` build remain deployment tasks.
5. **Key rotation.** The removed local key cannot be rotated without Supabase dashboard
   access. It must be rotated by the owner if it was ever exposed.
6. **Durable quotas/audit.** Only the per-goal generation lock exists; no per-user quota or
   approval/enrollment audit log yet.

### Conclusion

Phase 03 is implemented end to end in code and locally verified across all three layers.
The remaining gaps are environmental (live DB, real provider, browser, deployment) rather
than missing features. Do not describe the hosted behavior as tested until the checklist in
`docs/SECURITY.md` and `docs/TEST_REPORT.md` is completed.

