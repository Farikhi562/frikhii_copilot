# Database

Supabase PostgreSQL migrations and verification scripts.

```
database/
├── migrations/   applied in filename order
├── rollbacks/    deliberate down-migrations (destructive)
└── tests/        manual SQL verification (RLS)
```

## Migrations

| File | What it does |
|---|---|
| `20251105090000_phase_02_profiles_and_preferences.sql` | `profiles`, `user_preferences`, `updated_at` triggers, signup bootstrap trigger, RLS policies and grants. |
| `20251105091000_phase_03_course_architect.sql` | Learning goals, diagnostic attempts/questions/keys/answers, knowledge gaps, courses/versions/modules/classes/lessons/content/exercises/objectives, enrollments, RLS, version constraints and one-approved-version index. |

Phase 03 is additive; it does not recreate or alter the Phase 02 tables. It assumes
`public.set_updated_at()` from Phase 02 exists. Rollback:
`database/rollbacks/20251105091000_phase_03_course_architect_down.sql`.

The canonical copy lives in this folder. Supabase CLI users can copy each file into
`supabase/migrations/` before running `supabase db push`; the Supabase SQL Editor can
also run the file directly. See `docs/SUPABASE_SETUP.md`.

## Rules

- Every user-owned table has RLS enabled.
- Policies use `auth.uid()`; ids from the client are never trusted.
- Browser roles get only the minimum privileges. Phase 02: `select`/`insert`/`update` on
  profile/preferences. Phase 03: `select` only; the Go Core API is the only writer.
- `diagnostic_answer_keys` has RLS enabled and **no grants** to `anon`/`authenticated`.
- Only one approved course version per course is allowed by a partial unique index;
  repeated approval is idempotent.
- No service-role key or database password belongs in the frontend. Apply migrations
  from the dashboard/CLI, never from the browser.
