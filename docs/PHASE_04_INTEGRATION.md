# Phase 04 integration guide

Phase 04 was delivered as **new files only**. Nothing in your existing code was overwritten. Seven
small edits to shared files connect it. Apply them by hand, in this order, and check each against your
current file (these snippets were written against the Phase 03 layout).

## 0. Database

```
psql "$DATABASE_URL" -f database/migrations/20251108100000_phase_04_learner_intelligence.sql
```

Requires the Phase 03 migration first (`profiles`, `courses`, `course_versions`, `classes`, `exercises`,
`set_updated_at()`). The migration only creates new tables. Rollback:
`database/rollbacks/20251108100000_phase_04_learner_intelligence_down.sql`.

## 1. Core API: `services/core-api/internal/httpapi/server.go`

Add the import `".../internal/intelligence"`, one struct field, and one block inside `r.Route("/api/v1", ...)`:

```go
type Server struct {
	// ...existing fields...
	intel *intelligence.Handler
}

// inside r.Route("/api/v1", func(r chi.Router) { ... }), after the course routes:
if s.intel != nil {
	s.intel.Mount(r)
}
```

(`httpapi/intelligence.go` is new and already provides `WithIntelligence` and `UserID`.)

## 2. Core API: `services/core-api/cmd/api/main.go`

Before building the HTTP server, and then chain `.WithIntelligence(intel)` onto `httpapi.New(...)`:

```go
var intel *intelligence.Handler
if cfg.DatabaseURL != "" {
	repo, err := pgrepo.NewPostgres(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("intelligence repository unavailable", "error", err)
		os.Exit(1)
	}
	defer repo.Close()
	var analyzer intelligence.Analyzer
	if ai != nil {
		analyzer = aiclient.IntelligenceAnalyzer{Client: ai}
	}
	intel = &intelligence.Handler{Svc: intelligence.NewService(repo), Analyzer: analyzer, UserID: httpapi.UserID}
}
// ...
Handler: httpapi.New(cfg, data, ai, verifier).WithIntelligence(intel).Router(),
```

Imports: `internal/intelligence`, `internal/intelligence/pgrepo`. No new Go dependency (pgx is already used).
Routes added (all under `/api/v1`, authenticated): `POST /intelligence/events`, `GET /intelligence/overview`,
`POST /intelligence/preferences`, `PATCH /intelligence/insights`, `POST /intelligence/insights/generate`,
`GET /intelligence/tutor-guidance`, `POST /intelligence/reset`.

## 3. AI Engine: `services/ai-engine/app/main.py`

```python
from app.api.learner_routes import router as learner_router
app.include_router(learner_router)   # next to app.include_router(internal_router)
```

The mock provider does not know the `learner_insights` task, so with `LLM_PROVIDER=mock` the insights
endpoint fails and the Core API reports "AI insights are unavailable". Rule-based insights are unaffected.

## 4. Web: `apps/web/src/app/router.tsx`

```tsx
const Intelligence = lazy(() => import("../pages/app/Intelligence"));
// inside the /app routes:
<Route path="intelligence" element={<Intelligence />} />
```

## 5. Web: `apps/web/src/features/workspace/shell/nav.ts`

Import `Brain` from `lucide-react` and add, before "Learning Progress":

```ts
{ to: "/app/intelligence", label: "My Learning Intelligence", icon: Brain, match: (p) => p.startsWith("/app/intelligence") },
```

## 6. Web: `apps/web/src/features/workspace/shell/useBreadcrumbs.ts`

```ts
if (pathname.startsWith("/app/intelligence")) return [{ label: "My Learning Intelligence" }];
```

## 7. Emit learning events from your existing flows (required for any data to appear)

The engine learns only from events. Call this from wherever your quiz, exercise, remedial and lesson
flows already record a result (server-side, with the user's own token or from the Core API service layer):

```
POST /api/v1/intelligence/events
{
  "course_id": "<course uuid>",
  "competency": "<exact name from the course's target competencies>",
  "event_type": "assessment_result | exercise_submitted | remediation_completed | retention_check | lesson_completed | explanation_feedback",
  "score": 0.0-1.0,
  "difficulty": "easy | medium | hard",
  "mistake_tags": ["optional short labels"],
  "source_ref": "quiz attempt id",
  "idempotency_key": "<stable unique key for this result, 8-120 chars>"
}
```

Use a stable `idempotency_key` (for example `quiz-<attemptId>-<competency>`): retries and double submits are
then recorded once. Unknown competencies are rejected (422), and a course that is not the caller's returns 404.
In Go code you can call `intelligence.Service.RecordEvent(ctx, userID, input)` directly instead of HTTP.

## 8. Tutor personalisation (your existing tutor / chat service)

Before generating a tutor answer, fetch guidance for the topic and add the rendered block to the system prompt:

1. Core API: `GET /api/v1/intelligence/tutor-guidance?course_id=...&competency=...` (or `Service.TutorGuidance`).
2. AI Engine: `POST /internal/v1/learner/tutor-guidance` with that guidance returns `{"system_block": "..."}`;
   or call `app.prompts.learner.render_tutor_guidance(TutorGuidance(...))` in-process.

The block contains no numeric scores, states certainty, and tells the tutor not to shame or recite weaknesses.
With no history, guidance is `standard` with `certainty: low`.
