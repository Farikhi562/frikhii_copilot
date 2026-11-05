# Roadmap

Statuses: **Implemented** · **Partially implemented** · **Planned** · **Not tested**

| Phase | Scope | Status |
|---|---|---|
| 01 | Landing page, route shell, media config, Vercel SPA rewrite | Implemented |
| 01.5 | UI kit, dev gallery, legal placeholders, mobile navigation, lint | Implemented |
| 01.7 | App shell, dashboard/courses/settings previews | Implemented |
| 02 | Supabase Auth, protected routes, profiles, preferences, RLS | Implemented; live Supabase not tested |
| **03** | **AI Course Architect: goals, diagnostics, validated curriculum, review, approval, enrollment** | **Implemented; live database/provider/E2E not tested** |
| 04 | Lesson Engine and guided learning | Planned |
| 05 | AI Tutor (Explain, Deep Dive, Socratic, Practice, Review, Project) | Planned |
| 06 | Assessment engine, remedial flow, sequential unlock validation | Planned |
| 07 | Learning analytics and competency tracking | Planned |
| 08 | Document/RAG/multimodal learning | Planned |
| 09 | Pilot testing | Planned |
| Future | Authorized university (Gunadarma) integrations | Planned |

## Phase 03 details

**Implemented**

- Go + Chi Core API with JWT/JWKS verification, UUID subject requirement, ownership
  re-checks, CORS allow-list, request ids, request-size limits and safe errors.
- Python + FastAPI AI Engine with a provider-independent interface, an OpenAI-compatible
  adapter, a development-only deterministic mock, timeouts, bounded retries, optional
  fallback and production safety guards.
- Learning-goal intake with server-side normalization and validation.
- Diagnostic generation (5–8 questions), private answer keys, evaluation, strengths/gaps/
  misconceptions/feedback, and retry after evaluation failure.
- Curriculum generation with modules, classes, lessons, exercises, final project and final
  assessment. Pydantic + deterministic validation in Python, then structural validation
  in Go before persistence.
- One repair attempt for malformed generated output; duplicate ids, invalid references,
  circular prerequisites, bad sequences and oversized content are rejected.
- Postgres generation lock with stale-lock recovery; failure leaves a retryable state.
  Failed regeneration preserves an existing draft/approved course.
- Versioned courses. Editing changes a draft; regeneration creates a new version; approval
  supersedes the old approved version and upserts enrollment in one transaction.
- Migrations for goals, attempts, questions, private answer keys, answers, gaps, courses,
  versions, modules, classes, lessons, lesson blueprints, exercises, objectives and
  enrollments. RLS is read-only for browser roles; answer keys have no browser grants.
- Frontend multi-step intake, diagnostic, result, generation polling, course review/edit/
  regenerate/approve, course detail, real dashboard and course list.
- Zod-validated Core API client and TanStack Query hooks; no fake progress percentages.
- Layered tests: Python (24), Go (15 top-level + 10 subtests + optional live contract),
  frontend (46).
- Documentation: audit, implementation guide, architecture, schema, security, test report.

**Not tested**

- Migrations/RLS against a live Supabase database (no `DATABASE_URL`).
- A real LLM provider (no key). Only the deterministic mock provider was exercised.
- Browser E2E (desktop browser unavailable to the test session).
- Production deployment behavior (TLS, CSP, hosting, real CORS origins).

**Follow-ups before Phase 04**

1. Apply the migrations and run the RLS scripts with two real users.
2. Run the full lifecycle with a real provider and inspect latency, quota and failure
   modes.
3. Add a durable per-user generation quota and an audit trail for approval/enrollment.
4. Rotate any previously exposed Supabase key.
5. Configure deployment security headers and confirm `VITE_CORE_API_URL` in the build.

## Phase 04 entry criteria

Phase 04 (Lesson Engine) should start only after:

- Phase 03 migrations and RLS are verified on a live project;
- approval/enrollment is confirmed with real auth and a real provider;
- the course/version read model needed by lessons is stable;
- lesson content is designed as its own authoring artifact (Phase 03 deliberately stores
  a blueprint, not authored lessons);
- sequential unlock and assessment rules have an explicit data model before UI work.

## Later phases

- **05 AI Tutor:** grounded in approved course content; needs per-mode prompts, citation
  and safety rules, conversation persistence and quotas.
- **06 Assessment:** attempts, scoring, remedial routing, sequential unlock enforcement.
- **07 Analytics:** competency evidence and progress events; privacy review required.
- **08 RAG/multimodal:** document ingestion, embeddings, retrieval and access control.
- **09 Pilot:** real learners, measured outcomes, operational runbooks.
