# Database Schema

**Implemented:** Phase 02 profiles/preferences and Phase 03 learning domain.
**Prepared but not live-tested:** both migrations were reviewed and the scripts are ready,
but no `DATABASE_URL`/SQL Editor access was available in this environment. Run the
verification steps in `docs/SUPABASE_SETUP.md` before trusting production data.

Canonical SQL:

- `database/migrations/20251105090000_phase_02_profiles_and_preferences.sql`
- `database/migrations/20251105091000_phase_03_course_architect.sql`

Rollbacks:

- `database/rollbacks/20251105090000_phase_02_profiles_and_preferences_down.sql`
- `database/rollbacks/20251105091000_phase_03_course_architect_down.sql`

Phase 03 is **additive**. It does not recreate or alter Phase 02 tables and assumes
`public.set_updated_at()` from Phase 02 exists.

## Phase 02 tables

### `public.profiles`

Application profile, one row per Supabase Auth user.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, FK → `auth.users(id)` ON DELETE CASCADE | Same id as the auth user. |
| `full_name` | `text` | nullable; trimmed length 1–120 | Seeded from `raw_user_meta_data.full_name`. |
| `avatar_url` | `text` | nullable; length ≤ 2048 | Reserved; uploads are not implemented. |
| `created_at` | `timestamptz` | not null, default `now()` | |
| `updated_at` | `timestamptz` | not null, default `now()` | Maintained by trigger. |

### `public.user_preferences`

One row per profile.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `user_id` | `uuid` | PK, FK → `profiles(id)` ON DELETE CASCADE | |
| `learning_language` | `text` | not null, default `'id-ID'`, check in (`id-ID`, `en-US`) | Drives lesson/tutor language. |
| `preferred_theme` | `text` | not null, default `'system'`, check in (`system`, `light`) | Dark theme is not implemented. |
| `created_at` | `timestamptz` | not null, default `now()` | |
| `updated_at` | `timestamptz` | not null, default `now()` | Maintained by trigger. |

Phase 02 also creates the `handle_new_user()` signup bootstrap trigger and RLS policies
that let a user select/insert/update only their own profile/preferences.

## Phase 03 lifecycle

```text
learning_goals.status
  intake
    -> diagnostic_ready
    -> diagnostic_evaluated
    -> generating
    -> course_draft
    -> approved
  failed (retryable; a failed regeneration restores draft/approved when a course exists)
```

`courses.approved_version_id` is the live curriculum. `courses.current_version_id` may
point to a newer draft while an older version remains approved.

## Phase 03 tables

### `public.learning_goals`

One row per learning goal; owner is `user_id`.

| Column | Type | Constraints / notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `user_id` | `uuid` | not null, FK → `profiles(id)` ON DELETE CASCADE |
| `title` | `text` | not null, trimmed length 3–160 |
| `goal_statement` | `text` | not null, trimmed length 8–2000 |
| `intended_outcome` | `text` | not null, trimmed length 8–2000 |
| `motivation` | `text` | not null, trimmed length 3–1500 |
| `additional_context` | `text` | not null default `''`, length ≤ 4000 |
| `self_reported_level` | `text` | `beginner`/`basic`/`intermediate`/`advanced`/`unsure` |
| `current_knowledge` | `jsonb` | object, default `{}` |
| `weekly_study_minutes` | `integer` | 30–10080 |
| `learning_language` | `text` | `id-ID`/`en-US` |
| `learning_preferences` | `jsonb` | object, default `{}` |
| `target_date` | `date` | nullable |
| `status` | `text` | lifecycle enum above |
| `last_error` | `text` | nullable safe retry message |
| `created_at` / `updated_at` | `timestamptz` | `updated_at` from trigger |

Indexes: `(user_id, created_at desc)`, `(user_id, status)`.

### `public.diagnostic_attempts`

One diagnostic run per attempt. Evaluation is an estimate, not a certification.

Key columns: `id`, `learning_goal_id` (FK), `user_id` (FK), `attempt_number`,
`status` (`generating`/`ready`/`submitted`/`evaluating`/`evaluated`/`failed`),
`estimated_level` (`foundation`/`beginner`/`intermediate`/`advanced`), `confidence`
(`low`/`medium`/`high`), `evaluation_summary`, `strengths`/`knowledge_gaps`/
`misconceptions`/`question_scores`/`can_skip` (JSONB arrays), `recommended_start`,
`rationale`, timestamps.

Unique `(learning_goal_id, attempt_number)`. Indexes by user/date and goal/attempt
number.

### `public.diagnostic_questions`

Generated questions for an attempt.

Key columns: `id`, `attempt_id` (FK), `source_id` (AI id), `sequence_order`,
`question_type` (`multiple_choice`/`short_answer`/`scenario`/`reasoning`), `prompt`,
`competency`, `difficulty` (`foundation`/`intermediate`/`advanced`), `choices` (JSONB
array), `explanation` (private), timestamps.

Unique `(attempt_id, source_id)` and `(attempt_id, sequence_order)`.

### `public.diagnostic_answer_keys` — private

One row per question: `question_id` PK/FK, `expected_answer`, `rubric` (JSONB array).
RLS is enabled, but there is **no policy and no grant** to `anon`/`authenticated`. Only
the privileged Go connection reads it. The API never serializes explanations or keys.

### `public.diagnostic_answers`

Learner responses: `attempt_id`, `question_id`, `user_id`, `response` (≤ 5000), optional
`score` (0–100) and `feedback`. Unique `(attempt_id, question_id)`.

### `public.knowledge_gaps`

Derived gap rows: `attempt_id`, `user_id`, `competency`, `description`, `severity`
(`low`/`medium`/`high`), `recommendation`.

### `public.courses`

One course per learning goal.

| Column | Notes |
|---|---|
| `id` | UUID PK |
| `user_id` | FK → `profiles`, owner |
| `learning_goal_id` | FK → `learning_goals`, **unique** (one course per goal) |
| `current_version_id` | nullable FK → `course_versions` |
| `approved_version_id` | nullable FK → `course_versions` |
| `status` | `draft`/`approved`/`archived` |
| timestamps | `updated_at` from trigger |

### `public.course_versions`

Immutable generated versions; editing a draft updates nested draft rows, regenerating
adds a new version.

Key columns: `id`, `course_id`, `version_number`, `status`
(`draft`/`approved`/`superseded`), `title`, `short_description`, `description`,
`learning_goal`, `target_learner_level`, `objectives`, `target_competencies`,
`prerequisites`, `estimated_duration_minutes`, `recommended_weekly_study_minutes`,
`methodology`, `expected_outcome`, `final_project` (JSONB), `final_assessment` (JSONB),
`assumptions`, `suggested_search_topics`, `generation_metadata`, `warnings`,
`created_at`, `approved_at`.

Constraints: unique `(course_id, version_number)`; positive duration; weekly minutes
30–10080; JSONB type checks. A **partial unique index** on `(course_id) WHERE status =
'approved'` guarantees at most one approved version per course. Approval is implemented
idempotently in the Go transaction.

### Content tables

| Table | Purpose | Key constraints |
|---|---|---|
| `course_modules` | Version modules | unique `(course_version_id, source_id)` and `(course_version_id, sequence_order)`; positive duration |
| `classes` | Classes inside a module | unique `(course_version_id, source_id)` and `(module_id, sequence_order)`; positive duration |
| `lessons` | Lessons inside a class | unique `(course_version_id, source_id)` and `(class_id, sequence_order)`; positive duration |
| `lesson_contents` | Phase 03 **blueprint**, not authored lesson content | `content_type = 'blueprint'`, JSONB object, unique `(lesson_id, content_type, sequence_order)` |
| `exercises` | One exercise blueprint per class | unique `(class_id)`; difficulty enum; JSONB instructions/criteria |
| `learning_objectives` | Derived searchable objectives | scope check: course, module, class or lesson; positive sequence |
| `course_enrollments` | Enrollment after approval | unique `(user_id, course_id)`; status `active`/`completed`/`paused`/`withdrawn` |

All nested content cascades from `course_versions`, so deleting a course removes all
versions and content. The Phase 03 rollback drops the Phase 03 tables only.

## RLS and grants

All Phase 03 tables have RLS enabled.

| Table group | `anon` | `authenticated` | Policy |
|---|---|---|---|
| `learning_goals`, `diagnostic_answers`, `knowledge_gaps`, `courses`, `course_enrollments` | none | `SELECT` only | `auth.uid() = user_id` (or ownership through the course) |
| `diagnostic_attempts` | none | `SELECT` only | own `user_id` **and** own parent goal |
| `diagnostic_questions` | none | `SELECT` only | own attempt and own goal |
| `diagnostic_answer_keys` | none | **none** | no policy, no grant |
| `course_versions`, `course_modules`, `classes`, `lessons`, `lesson_contents`, `exercises`, `learning_objectives` | none | `SELECT` only | exists via the course owner chain |

No browser role has `INSERT`, `UPDATE` or `DELETE` on Phase 03 tables. The Go Core API
uses a privileged connection and re-checks ownership in every predicate; RLS is the
boundary for direct browser/PostgREST access, not a substitute for backend checks.

## Verification

- `database/tests/rls_phase_02.sql` — Phase 02 ownership checks.
- `database/tests/rls_phase_03.sql` — Phase 03 read isolation, no answer-key access, no
  browser writes. It uses two real user ids and rolls back.

These scripts have **not** been executed against a live Supabase database in this
environment.

## Deliberate schema choices

- `user_preferences` references `profiles`, not `auth.users`, so one cascade chain owns
  both.
- A course is tied to exactly one learning goal; regenerations create `course_versions`,
  not new courses.
- `current_version_id` and `approved_version_id` are separate, so a newer draft can be
  reviewed while the approved curriculum stays live.
- Diagnostic answer keys are isolated in their own table with no browser grants instead
  of being embedded in question JSON.
- `lesson_contents` stores a blueprint only in Phase 03; the Lesson Engine will add
  authored content in a later migration without rewriting generated courses.
- No `updated_at` trigger is added to immutable nested content; only mutable parent rows
  (`learning_goals`, `diagnostic_attempts`, `courses`, `course_enrollments`) use it.
