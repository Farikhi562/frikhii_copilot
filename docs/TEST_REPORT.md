# Test Report

**Environment:** Windows, Node v24.13.0 / npm 11.6.2, Go 1.27.3, Python 3.13.7.
**Date:** 2026-11-05.
**Code state:** Phase 03 working tree. No live Supabase database, real LLM provider or
browser E2E was available.

## Commands run (actual results)

| Check | Command / scope | Result |
|---|---|---|
| Python unit/integration | `python -m pytest` in `services/ai-engine` | **PASS** — **24 tests**, mock provider, `APP_ENV=test`, rate limit raised for tests. |
| Go unit/integration | `go test ./...` in `services/core-api` | **PASS** — all packages; **15 top-level tests + 10 subtests**, 0 failures. |
| Go vet | `go vet ./...` | **PASS** — exit code 0. |
| Go ↔ Python contract | `go test ./internal/aiclient -run TestLiveAIContract -count=1 -v` with `AI_CONTRACT_URL=http://127.0.0.1:8001` | **PASS** — real HTTP call to the running Python mock; not a cached result. |
| Frontend unit/component | `npm test` (`vitest run`) | **PASS** — **10 files, 46 tests**. |
| TypeScript | `npm run typecheck` | **PASS** — 0 errors. |
| Lint | `npm run lint` | **PASS** — 0 errors/warnings. |
| Build | `npm run build` | **PASS** — 2233 modules; `index-*.js` 640.83 kB (190.86 kB gzip); CSS 35.27 kB (7.11 kB gzip); one chunk-size warning. |
| Dependency audit | `npm audit` | 7 **moderate** advisories, all dev-only through `typescript-eslint → minimatch`; no runtime advisory reported. `npm audit fix` does not resolve them without a breaking upgrade. |
| Bundle secret check | search `apps/web/dist` for the configured env values, `VITE_SUPABASE_ANON_KEY` and `sb_secret_` | Only the required Supabase URL and **publishable** key are embedded; the legacy env name and stale `apps/web/.env.local` text are absent. The only `sb_secret_` match is supabase-js's own key-prefix validation literal, not a key. |

### Python coverage (24 tests)

| File | Tests | Covers |
|---|---|---|
| `tests/test_api.py` | 6 | Health without secrets; internal-token required/wrong; diagnostic and curriculum over HTTP; invalid request rejection. |
| `tests/test_providers.py` | 7 | JSON extraction from fences/prose; oversize/invalid rejection; OpenAI-compatible success; 429 retry; timeout mapping; production mock fallback refusal; provider error body non-leakage. |
| `tests/test_repair.py` | 2 | One repair attempt recovers invalid JSON; repair failure is rejected. |
| `tests/test_services.py` | 3 | Diagnostic generation/evaluation; relational curriculum validity; duplicate diagnostic answers rejected. |
| `tests/test_validators.py` | 6 | Mock course valid; duplicate ids; later-class prerequisite; module cycle; URLs rejected; diagnostic duplicate ids/bad key. |

### Go coverage (15 top-level + 10 subtests)

| Package | Covers |
|---|---|
| `internal/auth` | ES256 JWKS acceptance; expired/wrong-audience/unknown-key rejection; HS256 fallback; non-UUID `sub` rejection. |
| `internal/httpapi` | Full HTTP lifecycle (goal → diagnostic → submit → generate → edit → regenerate → approve → enroll); validation/generation failures; failed regeneration preserving an existing draft; answer keys never serialized; health/readiness; CORS and request id; stale generation recovery. |
| `internal/store` | Memory lifecycle and version history; ownership isolation; generation lock; stale lock reclaim; failed regeneration status restore. |
| `internal/validate` | Valid curriculum; structural rejection (duplicate ids, bad references, cycles, sequences); trimmed non-empty diagnostic answers; intake normalization/defaults/dates. |
| `internal/aiclient` | Optional live Go↔Python contract test (diagnostic + curriculum + Go re-validation). |

### Frontend coverage (10 files, 46 tests)

| File | Tests | Covers |
|---|---|---|
| `src/features/auth/schemas/auth.test.ts` | 6 | Register/login/reset validation, password mismatch, weak passwords, invalid email. |
| `src/features/auth/AuthProvider.test.tsx` | 5 | Loading → persisted session, auth events, stale-read protection, listener cleanup, sign-out. |
| `src/app/guards.test.tsx` | 5 | Loading does not redirect; unauthenticated redirect preserves destination; authenticated access; public-only redirects. |
| `src/features/profile/api/profile.test.ts` | 7 | Missing profile, Supabase errors, recovery from metadata, default preferences, partial update, display-name fallbacks. |
| `src/lib/redirects.test.ts` | 3 | In-app paths, fallbacks, external/protocol-relative/`javascript:` rejection. |
| `src/pages/auth/auth-pages.test.tsx` | 5 | Auth pages with valid/missing Supabase config and accessible form states. |
| `src/app/router.test.tsx` | 4 | Public landing page, lazy auth pages, missing-config behavior. |
| `src/pages/app/NewCourse.test.tsx` | 3 | First step renders; empty continuation blocked; valid goal fields advance. |
| `src/features/course/schemas/course.test.ts` | 4 | Course/goal/diagnostic response parsing and rejection of malformed payloads. |
| `src/features/course/api/course.test.ts` | 4 | Core API envelope parsing, error mapping, missing session/configuration behavior. |

## What is verified

- Generator output is validated in Python and again in Go before persistence.
- Invalid AI output (duplicate ids, references, cycles, bad sequences, oversized content)
  is rejected; one repair attempt is exercised.
- Diagnostics contain 5–8 questions, exact answer-key coverage, unique ids/sequences, and
  never expose keys or explanations over HTTP.
- Submitted diagnostic answers are trimmed, non-empty, complete and free of duplicate
  question ids.
- Goal/course ownership is enforced in the store; foreign ids are rejected.
- Generation locking, stale-lock reclaim, failed first generation and failed regeneration
  states are covered.
- Approval is idempotent and only one version is approved per course.
- The browser API client maps errors and does not call an LLM.
- The production bundle contains no browser key beyond the configured publishable key;
  the legacy anonymous-key name is absent.

## Not verified (and why)

| Area | Status | Reason |
|---|---|---|
| Live Supabase migrations | **Not tested** | No `DATABASE_URL`/SQL Editor credentials. Scripts are prepared. |
| RLS with two real users | **Not tested** | Same; unit tests use the in-memory store. |
| Real LLM provider | **Not tested** | No provider API key. Only the deterministic mock was exercised. |
| Provider quality, latency, quota, 429 behavior at scale | **Not tested** | Requires a real account and load. |
| Browser E2E | **Not tested** | Desktop browser was not connected to the session. |
| Deployment (TLS, CSP, CORS origins, `VITE_CORE_API_URL`) | **Not tested** | Requires hosting configuration. |
| `npm audit` clean | **Not achieved** | 7 moderate dev-only advisories remain; no runtime advisory. |

## Notes

- The Python tests run with `APP_ENV=test`, `INTERNAL_SERVICE_TOKEN=test-internal-token`,
  `LLM_PROVIDER=mock` and `RATE_LIMIT_PER_MINUTE=600`.
- The live contract test used a local Python mock on `127.0.0.1:8001` and a real HTTP
  request; it validates the JSON contract and re-runs the Go structural validator.
- Go test logs include expected `INFO request` lines.
- The main frontend JS chunk is 640.83 kB (190.86 kB gzip), above Vite's 500 kB warning.
  Route-level lazy loading is already in place; further splitting is a later optimization.

## Landing FAQ addendum

- `FaqSection.test.tsx` (10 tests) was added. **It was not executed**: the packaging
  environment had no network access, so `npm ci` could not install dependencies. Run
  `npm test` locally before relying on it.
- The compiled component was exercised in headless Chromium (Playwright, icon stubbed):
  8 items render, first item open by default, click opens one and closes the others,
  second click collapses, closed panels are `inert`, Arrow/Home/End/Enter move and toggle
  correctly, every `aria-controls` target exists, JSON-LD has 8 questions, no console
  errors. Tailwind styling and animation were **not** visually verified.
- `npm run typecheck`, `npm run lint`, `npm run build`, `go test ./...` and `pytest` were
  not run for the same reason (Go and Python modules could not be downloaded).

## Landing page v1 (Phase 01.8)

**Not run** (no network in the build environment, dependencies could not be installed):
`npm run typecheck`, `npm run lint`, `npm run build`, `npm test`, `go test`, `pytest`.
Run them locally before release. New vitest files `LandingPage.test.tsx` (9 tests) and
`FaqSection.test.tsx` (8 tests) are written but unexecuted.

**Run, in headless Chromium** against a bundle of the real `Landing` component with
Tailwind 4.3.3 compiled from the project's `index.css` and sources. `react-router-dom`,
`motion` and `lucide-react` were replaced by small stubs (they were not installed), and
Geist fonts were not loaded, so screenshots use a fallback sans-serif.

- Horizontal overflow at 360, 390, 768, 1024 and 1440 px: none.
- Browser console errors and warnings at all five widths: none.
- All in-page anchors (`#top #trailer #architect #how #faq`) resolve; link targets are
  `/login`, `/register`, `/privacy`, `/terms`, `/contact`. Route rendering of those pages was
  not exercised in this harness.
- FAQ: one item open at a time, collapse, ArrowDown/Enter, panel height animates.
- Tutor modes toggle `aria-pressed`; mobile menu opens, closes on Escape and on link click.
- One `h1`, no skipped heading levels; no `<img>` or `<video>` rendered without a source.
- Contrast ratios computed from the token hex values (WCAG formula). This is arithmetic
  on tokens, not an audit with assistive technology.

**Not verified:** real fonts, Vite production build output, Lighthouse/CLS metrics,
real-browser rendering of the Vite-built page, screen-reader behaviour, Safari/Firefox,
and the real login flow against Supabase (auth code is unchanged).

## Authenticated workspace

**Not run** (no network, dependencies not installable): `npm run typecheck`, `npm run lint`,
`npm run build`, `npm test`, `go test`, `pytest`. New vitest file
`features/workspace/workspace.test.ts` is written but unexecuted; `NewCourse.test.tsx` was
updated for the new heading and is also unexecuted.

**Run, in headless Chromium** against an esbuild bundle of the real workspace pages with
Tailwind 4.3.3 compiled from the project CSS. `react-router`, TanStack Query, zustand, Radix,
react-hook-form, Supabase and lucide were replaced by small stubs (icons render as dashes),
the API was mocked with `page.route`, and Geist fonts were not loaded. 89 of 89 browser checks passed:

- Dashboard, library, course overview, roadmap, class, lesson, tutor, progress, settings, help, search, account menu.
- Every sidebar and secondary nav link navigates and marks the active item; collapse persists across reload.
- Library search and filters; accordions and tabs; tutor mode selection, composer, send shows an honest error, scripted preview labelled.
- Empty account, API 500 with retry recovery, unknown class/lesson not-found states, demo banner.
- No horizontal overflow on 11 routes at 360, 390, 768, 1024 and 1440 px; no console errors.
- Defects found and fixed: tab list and tutor mode picker overflowed on narrow screens.

**Not verified:** real routing/Query/Radix behaviour, the Vite build, fonts and icons, real Supabase
login (auth code unchanged), screen readers, Safari/Firefox, and anything needing a live backend.
