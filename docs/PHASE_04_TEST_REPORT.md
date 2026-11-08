# Phase 04 test report

Honest status. "Run" means executed in the build sandbox in this session.

| Area | Result | Notes |
|---|---|---|
| Go engine + service + HTTP (`internal/intelligence`) | **Run: 26 tests pass**, also with `-race` | Scenarios A to E, duplicates, validation, ownership, AI failure, invalid AI output, missing history, reset, insight correction |
| Go Postgres repository (`internal/intelligence/pgrepo`) | **Not run** | Type-checked only against a stubbed pgx API. The SQL has never been executed against a database |
| Go `aiclient` adapter | **Type-checked only** (stubbed uuid) | Not exercised against a live AI Engine |
| Go `httpapi` + `cmd/api` wiring | **Not compiled** | chi and jwt could not be downloaded. The patch is 4 small edits (see integration guide) |
| SQL migration + RLS | **Not run** | Never applied to a database. Review the migration and run it on a copy first. No RLS tests were written (`database/tests`) |
| Python AI Engine (`tests/test_learner.py`) | **Run: 7 tests pass** | Used local stubs for `pydantic_settings` and `httpx` imports only. FastAPI routes (`learner_routes.py`) not run |
| Web contract (`schemas.test.ts` logic) | **Run via esbuild/zod**, vitest not run | Parsed real Go output, including null slices |
| Web UI in Chromium | **Run: 33/33 checks** (+ earlier workspace suite 89/89) | esbuild bundle with stubs for router, Query, Radix, Supabase and icons. Fonts not loaded. API mocked with real Go engine output |
| Responsive | **Run** | No horizontal overflow, 6 tabs x 5 widths (360 to 1440), no console errors |
| `tsc`, `eslint`, `vite build`, vitest, `go build ./...`, pytest (full suite), real Gemini calls, real Supabase | **Not run** | Dependencies unavailable offline |

Not tested at all: concurrent writers on the same user, large event volumes, real LLM output quality, thresholds
against real learners, and Safari/Firefox.
