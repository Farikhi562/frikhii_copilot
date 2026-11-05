# Security

**Status:** Phase 02 and Phase 03 controls are implemented and reviewed in code, with
unit/contract tests. **Live Supabase migrations/RLS, a real LLM provider and browser E2E
were not available in this environment.** Run the checks in `docs/SUPABASE_SETUP.md`,
`database/tests/rls_phase_02.sql` and `database/tests/rls_phase_03.sql` before trusting
production data.

## Trust boundaries

| Boundary | Trusted for | Not trusted for |
|---|---|---|
| Browser | Rendering, form UX, route guards | User ids, ownership, entitlements, LLM output, secrets |
| Supabase Auth | Identity, email verification, sessions | Course business rules |
| PostgREST + RLS | Direct browser reads of allowed rows | Writes to Phase 03 learning data |
| Go Core API | JWT verification, ownership, validation, writes | Generating content itself |
| Python AI Engine | Generation, schema/structure validation, provider calls | Database access, end-user authorization |
| LLM provider | Candidate content only | Truth, safety, schema compliance, authorization |
| PostgreSQL | Constraints, transactions, RLS | Deciding UX or authorization policy |

## Implemented controls

### Secrets and configuration

- The browser reads only `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and
  `VITE_CORE_API_URL`. No LLM key, database password or service-role key is a `VITE_*`
  variable.
- The web client no longer reads `VITE_SUPABASE_ANON_KEY`. A legacy anon key must be put
  under `VITE_SUPABASE_PUBLISHABLE_KEY`; a secret-prefixed value is not a valid browser
  key.
- `.env`, `.env.local`, `.env.*` are git-ignored except `.env.example`. Server templates
  are `services/core-api/.env.example` and `services/ai-engine/.env.example`; they contain
  placeholders only.
- Missing configuration fails closed: the app shows a setup screen, the Go API returns
  503 for authenticated/data endpoints, and the AI Engine refuses internal calls without
  `INTERNAL_SERVICE_TOKEN`.
- `APP_ENV=production` rejects `LLM_PROVIDER=mock` and a mock fallback provider. The Core
  API's `main.go` refuses `AUTH_DISABLED` in production.

**Local secret incident (Phase 03 hardening):** a legacy `sb_secret_`-prefixed value was
present in the local root `.env.local` and was not used by the current code. The line was
removed, the anonymous-key fallback was removed from the client, and the production build
was rebuilt and checked. The value is never reproduced in chat, docs or the delivery ZIP.
If that key was ever copied, shared or committed elsewhere, **rotate it in Supabase**;
rotation cannot be performed from this repository without dashboard access.

### Authentication and sessions

- Supabase Auth with PKCE. Email links are completed with `exchangeCodeForSession` or
  `verifyOtp`; no hand-rolled token store.
- `detectSessionInUrl: false` so a redirect is processed once by the dedicated route.
- supabase-js persists and refreshes sessions. Application code never logs access or
  refresh tokens.
- `AuthProvider` owns the single `onAuthStateChange` subscription, ignores stale initial
  reads and unsubscribes on unmount.
- Route guards are UX only. They are not an authorization boundary.
- Go verifies JWTs with `ES256`/`RS256` via Supabase JWKS (optional legacy `HS256`
  secret), requires `exp`, validates issuer/audience when configured, and rejects an
  empty or non-UUID `sub` before any store access.
- The Go service never accepts a user id from the request body or query. Ownership comes
  from the verified `sub`.

### Authorization and ownership

- Every Go store query and mutation includes `user_id = <JWT subject>`. Nested content is
  loaded through the course owner chain.
- The Go service uses a privileged PostgreSQL connection. This is deliberate for writes
  but means **backend ownership predicates are the application boundary**; RLS does not
  constrain that connection.
- Tests cover cross-user goal/course access, foreign version ids, foreign draft ids and
  answer-key non-exposure.
- The AI Engine receives only the current user's goal, diagnostic and course context. It
  has no database credentials and no end-user authorization role.

### Row Level Security and grants

- All Phase 02 and Phase 03 tables have RLS enabled.
- Phase 02: a user can select/insert/update only their own profile/preferences.
- Phase 03 browser roles receive **SELECT only** on own learning rows. No browser role can
  insert, update or delete Phase 03 data; only the Go API writes.
- `diagnostic_answer_keys` has RLS enabled and **no policy or grant** for
  `anon`/`authenticated`. The API never serializes keys or question explanations.
- One approved version per course is enforced by a partial unique index; approval is
  idempotent in a transaction.
- Additive migrations preserve Phase 02 data and version history. Rollbacks exist for both
  phases.

### AI boundary and prompt handling

- The browser never calls the LLM. The Go API calls Python with a shared internal token
  (`X-Internal-Token`, constant-time comparison); Python calls the configured provider.
- The AI Engine has no browser CORS and no public generation endpoint. Its OpenAPI/docs
  are disabled in production.
- User text is placed in delimited data blocks; the system prompt states that embedded
  instructions are data, not commands. Output is never executed.
- Provider responses are treated as untrusted. Pydantic forbids unexpected fields and
  bounds list/string sizes. Deterministic validators reject duplicate ids, bad references,
  circular prerequisites, invalid sequences, inconsistent durations/counts and URL or
  citation-like content.
- The Go API repeats structural validation before persistence. A compromised or
  misconfigured Python service cannot bypass the Core API.
- Exactly one repair attempt is allowed for schema/structure failures. A second failure is
  returned as a safe `invalid_generated_content` error and nothing is persisted.
- Provider errors are mapped to safe codes. Raw provider bodies, prompts and keys are not
  returned to the browser.
- Fallback is opt-in only. Metadata records the provider and fallback reason; production
  rejects a mock fallback.

### Availability and abuse limits

- `MAX_REQUEST_BYTES` bounds request bodies in both services.
- Python bounds output tokens/bytes and applies a per-client fixed-window rate limit; the
  Go API applies a per-goal generation lock, including stale-lock recovery.
- Provider timeouts and bounded retries cover transient timeouts, 429 and 5xx. Validation
  failures are not retried indefinitely.
- The frontend uses a 260 s generation timeout, above the Core API's 240 s limit, so the
  UI does not abandon a request before the server does.
- Request ids are propagated from browser → Go → Python → error responses and logs.

### Error handling and logging

- Errors use `{"error":{"code","message","request_id","details?"}}`. Raw exceptions,
  SQL, provider payloads and secrets are not exposed.
- Go logs method, path, status, size, duration, request id and the JWT UUID. It does not
  log Authorization headers, tokens or response bodies.
- Python logs error code/status/request id/safe message, not API keys or full prompts.

### Transport and dependencies

- Full production deployment still requires TLS, HSTS, CSP and other security headers at
  the edge; the SPA currently relies on the host (for example Vercel) for those.
- CORS in the Go API is an exact allow-list from `CORS_ORIGINS`, with only
  `Authorization`, `Content-Type` and `X-Request-ID` allowed.
- `npm audit` reports 7 moderate dev-only advisories through
  `typescript-eslint → minimatch`; no runtime dependency advisory was reported. The
  frontend JS bundle is large and the chunk-size warning is tracked in `TEST_REPORT.md`.

## Residual risks (prioritized)

1. **Live RLS/database verification is pending.** The migration and test scripts have not
   been run against a real Supabase project here. A syntax or policy mistake could survive
   unit tests.
2. **Privileged Go connection.** If an ownership predicate is missed in future code, the
   Go role can read/write across users. Every new query must include the user id and a
   cross-user test.
3. **Legacy key rotation.** The removed local key must be rotated if it was ever exposed.
   This cannot be done without Supabase dashboard access.
4. **Real LLM behavior is unverified.** No provider key was configured. Model quality,
   latency, quotas, safety behavior and structured-output support are not proven.
5. **Prompt injection.** Delimiters and validation reduce impact, but a model can still
   produce misleading content. The product must not present generated content as
   authoritative.
6. **Generation cost/abuse.** There is a per-goal lock but no global per-user quota. A
   user can create many goals and trigger repeated provider calls. Add a durable quota
   before public launch.
7. **Rate limiting is in-process.** The Python limiter and `X-Forwarded-For` handling are
   suitable for a single internal instance only. Use a trusted proxy and a shared limiter
   for multiple replicas; do not expose the AI Engine directly.
8. **No audit trail.** Approval/enrollment changes are not separately audited beyond
   timestamps. Add structured audit events for production.
9. **No full security headers/CSP.** Configure them in deployment and test the third-party
   origins actually needed.

## Verification checklist

- [ ] Apply both migrations to a non-production Supabase project.
- [ ] Run `rls_phase_02.sql` and `rls_phase_03.sql` with two real users; confirm A cannot
      read B's rows and neither can read `diagnostic_answer_keys` or write Phase 03 data.
- [ ] Confirm `/app` works with a real Supabase session and the Go API.
- [ ] Run the full lifecycle with a real provider; inspect provider metadata and errors.
- [ ] Confirm production rejects mock providers, `AUTH_DISABLED`, missing internal token
      and missing `VITE_CORE_API_URL`.
- [ ] Rotate any key that was ever exposed; confirm `.env*` files are absent from the
      delivery archive.
- [ ] Add TLS/HSTS/CSP and a durable per-user generation quota before public launch.
