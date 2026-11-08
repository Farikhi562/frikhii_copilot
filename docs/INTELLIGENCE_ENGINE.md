# Intelligence & Personalization Engine (Phase 04)

## Principle

FRIKHII models a learner from **recorded evidence only**. Authoritative state (mastery, status, gaps, review
dates, recommendations) is computed deterministically in the Go Core API. The LLM never writes grades, mastery,
gap status or unlocks. It may only add narrative insights, and each must cite real event ids or it is dropped.

## Data flow

```
existing quiz/exercise/lesson flow
   -> POST /intelligence/events (validated, idempotent)           [learning_events, append-only]
   -> Service.Recompute (deterministic)
        competency_records + competency_evidence (audit trail)
        learner_knowledge_gaps (open -> improving -> resolved)
        review_schedules, learning_recommendations, rule insights
   -> GET /intelligence/overview            -> web "My Learning Intelligence"
   -> GET /intelligence/tutor-guidance      -> AI Engine renders tutor context
   -> POST /intelligence/insights/generate  -> AI Engine (validated twice: Python, then Go)
```

## Deterministic rules (`internal/intelligence/engine.go`)

- **Mastery**: recency-weighted mean of event scores (each older event counts 75% of the next newer one),
  weighted by event type (assessment/retention 1.0, exercise/remediation 0.9, lesson completion 0.4,
  explanation feedback 0, stored but ignored) and difficulty (easy 0.8, medium 1.0, hard 1.2).
- **Status**: fewer than 3 scored events never exceeds `learning`. `developing` >= 50%, `proficient` >= 70%,
  `mastered` needs >= 85%, 5 events, confidence >= 0.6 and the last two results >= 80%.
- **Confidence**: grows with evidence count and shrinks with inconsistent results. Shown as low/medium/high.
- **Gap**: at least 3 scored events, and either 3 of the last 4 below 50%, estimated mastery below 45%, or a failed
  retention check after earlier solid results. One wrong answer never creates a gap.
- **Cause**: `prerequisite` when a prerequisite has evidence and is below 50% (>= 2 attempts); prerequisites with
  no evidence are listed as "not yet checked" and produce a *verify* recommendation, never an assumed weakness;
  `retention` for regression; otherwise `current_lesson`.
- **Resolution**: `improving` once mastery >= 50%; `resolved` only with mastery >= 70%, the last two results >= 70%,
  and at least two attempts after the gap opened. Resolved gaps stay in history, and a regression opens a new one.
- **Regression**: latest retention check < 50% after a peak >= 70%. Peak and full accuracy history are kept.
- **Review schedule**: 1, 3, 7, 14, 30, 60 days for proficient or better; resets to 1 day after a failed check.
- **Tutor approach**: `retrieval_review` > `prerequisite_first` > `worked_examples` (knowledge checks >= 25 points
  above practice) > `challenge` (mastered) > `standard`.
- **Prerequisites** come from the course itself: a class's exercise competency depends on the exercise
  competencies of the classes it lists as prerequisites, plus optional rows in `competency_prerequisites`.

## Privacy and trust

- Browser roles have `SELECT` on own rows only (RLS); the Core API is the sole writer and re-checks ownership.
- Another user's course returns 404; overview and tutor guidance never cross users.
- Users can edit preferences, mark an insight as wrong (hidden, with note, never re-activated by recompute),
  and reset everything with an explicit `{"confirm":"RESET"}`.
- AI insights are rejected when they cite unknown event ids, use a non-allowed kind, or make claims about the person
  (intelligence, personality, motivation, health labels). The UI labels them "AI-written".
- Tutor guidance contains no numeric scores, and instructs the tutor never to shame or recite weaknesses.

## Not covered / limitations

- Nothing emits events yet: wiring your existing flows to `POST /intelligence/events` is step 7 of
  `PHASE_04_INTEGRATION.md`. Until then every learner sees the honest "No learning evidence yet" state.
- Diagnostic findings (`knowledge_gaps`) are not auto-imported as events.
- Thresholds are reasoned defaults, not calibrated on real learner data.
- Preferences use POST (not PUT) because the Core API CORS policy allows only GET, POST and PATCH.
