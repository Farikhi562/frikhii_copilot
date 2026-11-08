-- ============================================================================
-- FRIKHII Copilot — Phase 04
-- Intelligence & Personalization Engine
--
-- ADDITIVE. Does not alter any Phase 02/03 table. Apply after
-- 20251105091000_phase_03_course_architect.sql.
-- Rollback: database/rollbacks/20251108100000_phase_04_learner_intelligence_down.sql
--
-- Reuse decisions
-- * profiles / courses / course_versions are referenced, never duplicated.
-- * The Phase 03 table public.knowledge_gaps is diagnostic-attempt scoped (one row per
--   diagnostic finding). It is left untouched. Longitudinal gaps live in
--   public.learner_knowledge_gaps and may be seeded from diagnostic findings by the API.
-- * learning_objectives (course scoped) is not copied. Competencies are identified by the
--   competency NAME already used by courses.target_competencies and exercises.competency.
--
-- Security boundary (same model as Phase 03)
-- * Browser roles get SELECT on own rows only, through RLS. No INSERT/UPDATE/DELETE grants.
-- * The Go Core API is the only writer; it re-checks ownership in every query.
-- * Evidence is append-only: competency_evidence and learning_events have no UPDATE path.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- learner_preferences: user-editable teaching preferences (one row per user)
-- ---------------------------------------------------------------------------
create table if not exists public.learner_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  explanation_style text not null default 'balanced',
  example_style text not null default 'mixed',
  pace text not null default 'steady',
  preferred_language text not null default 'en-US',
  daily_study_minutes integer,
  short_term_target text not null default '',
  long_term_target text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learner_preferences_style_check
    check (explanation_style in ('simple', 'balanced', 'technical')),
  constraint learner_preferences_example_check
    check (example_style in ('practical', 'visual', 'analogy', 'mixed')),
  constraint learner_preferences_pace_check check (pace in ('slow', 'steady', 'fast')),
  constraint learner_preferences_language_check check (preferred_language in ('id-ID', 'en-US')),
  constraint learner_preferences_minutes_check
    check (daily_study_minutes is null or daily_study_minutes between 5 and 720),
  constraint learner_preferences_short_check check (char_length(short_term_target) <= 500),
  constraint learner_preferences_long_check check (char_length(long_term_target) <= 500)
);

drop trigger if exists learner_preferences_set_updated_at on public.learner_preferences;
create trigger learner_preferences_set_updated_at
  before update on public.learner_preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- learning_events: validated, idempotent learning evidence (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.learning_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  competency text not null,
  event_type text not null,
  score numeric(4, 3) not null,
  difficulty text not null default 'medium',
  mistake_tags jsonb not null default '[]'::jsonb,
  source_ref text not null default '',
  idempotency_key text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint learning_events_competency_check check (char_length(btrim(competency)) between 2 and 160),
  constraint learning_events_type_check check (event_type in (
    'lesson_completed', 'exercise_submitted', 'assessment_result',
    'retention_check', 'remediation_completed', 'explanation_feedback')),
  constraint learning_events_score_check check (score between 0 and 1),
  constraint learning_events_difficulty_check check (difficulty in ('easy', 'medium', 'hard')),
  constraint learning_events_mistakes_check check (jsonb_typeof(mistake_tags) = 'array'),
  constraint learning_events_key_check check (char_length(idempotency_key) between 8 and 120),
  constraint learning_events_source_check check (char_length(source_ref) <= 200),
  -- Duplicate submissions of the same event are rejected, never double-counted.
  constraint learning_events_idempotency_key unique (user_id, idempotency_key)
);

comment on table public.learning_events is
  'Append-only evidence emitted by existing assessment/exercise flows. Score is 0..1.';

create index if not exists learning_events_user_course_idx
  on public.learning_events (user_id, course_id, occurred_at desc);
create index if not exists learning_events_competency_idx
  on public.learning_events (user_id, course_id, competency, occurred_at desc);

-- ---------------------------------------------------------------------------
-- competency_records: current derived mastery state (rebuildable from events)
-- ---------------------------------------------------------------------------
create table if not exists public.competency_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  competency text not null,
  status text not null default 'not_started',
  mastery numeric(4, 3) not null default 0,
  peak_mastery numeric(4, 3) not null default 0,
  confidence numeric(4, 3) not null default 0,
  attempts integer not null default 0,
  correct_attempts integer not null default 0,
  common_mistakes jsonb not null default '[]'::jsonb,
  regression boolean not null default false,
  last_demonstrated_at timestamptz,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint competency_records_status_check
    check (status in ('not_started', 'learning', 'developing', 'proficient', 'mastered')),
  constraint competency_records_mastery_check check (mastery between 0 and 1 and peak_mastery between 0 and 1),
  constraint competency_records_confidence_check check (confidence between 0 and 1),
  constraint competency_records_attempts_check check (attempts >= 0 and correct_attempts between 0 and attempts),
  constraint competency_records_mistakes_check check (jsonb_typeof(common_mistakes) = 'array'),
  constraint competency_records_unique unique (user_id, course_id, competency)
);

create index if not exists competency_records_user_idx
  on public.competency_records (user_id, course_id, status);

drop trigger if exists competency_records_set_updated_at on public.competency_records;
create trigger competency_records_set_updated_at
  before update on public.competency_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- competency_evidence: which events backed which record (auditable history)
-- ---------------------------------------------------------------------------
create table if not exists public.competency_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  record_id uuid not null references public.competency_records (id) on delete cascade,
  event_id uuid not null references public.learning_events (id) on delete cascade,
  mastery_before numeric(4, 3) not null,
  mastery_after numeric(4, 3) not null,
  status_after text not null,
  created_at timestamptz not null default now(),
  constraint competency_evidence_status_check
    check (status_after in ('not_started', 'learning', 'developing', 'proficient', 'mastered')),
  constraint competency_evidence_unique unique (record_id, event_id)
);

create index if not exists competency_evidence_record_idx
  on public.competency_evidence (record_id, created_at);

-- ---------------------------------------------------------------------------
-- competency_prerequisites: course-level dependency relations (not per user)
-- ---------------------------------------------------------------------------
create table if not exists public.competency_prerequisites (
  course_id uuid not null references public.courses (id) on delete cascade,
  competency text not null,
  prerequisite text not null,
  created_at timestamptz not null default now(),
  primary key (course_id, competency, prerequisite),
  constraint competency_prerequisites_distinct check (lower(competency) <> lower(prerequisite))
);

-- ---------------------------------------------------------------------------
-- learner_knowledge_gaps: longitudinal gaps with explicit resolution status
-- ---------------------------------------------------------------------------
create table if not exists public.learner_knowledge_gaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  competency text not null,
  related_objective text not null default '',
  severity text not null,
  confidence numeric(4, 3) not null,
  cause text not null default 'current_lesson',
  prerequisites jsonb not null default '[]'::jsonb,
  evidence_event_ids jsonb not null default '[]'::jsonb,
  evidence_summary text not null,
  recommendation text not null,
  status text not null default 'open',
  opened_at timestamptz not null default now(),
  last_evidence_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learner_gaps_severity_check check (severity in ('low', 'medium', 'high')),
  constraint learner_gaps_confidence_check check (confidence between 0 and 1),
  constraint learner_gaps_cause_check check (cause in ('current_lesson', 'prerequisite', 'retention')),
  constraint learner_gaps_status_check check (status in ('open', 'improving', 'resolved')),
  constraint learner_gaps_prereq_check check (jsonb_typeof(prerequisites) = 'array'),
  constraint learner_gaps_events_check check (jsonb_typeof(evidence_event_ids) = 'array'),
  constraint learner_gaps_resolved_check check ((status = 'resolved') = (resolved_at is not null))
);

-- At most one unresolved gap per competency; a resolved gap does not block a new one.
create unique index if not exists learner_gaps_one_open_idx
  on public.learner_knowledge_gaps (user_id, course_id, competency)
  where status <> 'resolved';
create index if not exists learner_gaps_user_idx
  on public.learner_knowledge_gaps (user_id, status, updated_at desc);

drop trigger if exists learner_gaps_set_updated_at on public.learner_knowledge_gaps;
create trigger learner_gaps_set_updated_at
  before update on public.learner_knowledge_gaps
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- learner_insights: strengths / patterns, rule-based or AI, always with evidence
-- ---------------------------------------------------------------------------
create table if not exists public.learner_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid references public.courses (id) on delete cascade,
  kind text not null,
  statement text not null,
  rationale text not null,
  evidence_event_ids jsonb not null default '[]'::jsonb,
  confidence text not null,
  source text not null,
  status text not null default 'active',
  user_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learner_insights_kind_check
    check (kind in ('strength', 'weakness', 'pattern', 'misconception', 'strategy')),
  constraint learner_insights_statement_check check (char_length(btrim(statement)) between 5 and 500),
  constraint learner_insights_rationale_check check (char_length(btrim(rationale)) between 5 and 800),
  constraint learner_insights_events_check
    check (jsonb_typeof(evidence_event_ids) = 'array' and jsonb_array_length(evidence_event_ids) >= 1),
  constraint learner_insights_confidence_check check (confidence in ('low', 'medium', 'high')),
  constraint learner_insights_source_check check (source in ('rules', 'ai')),
  constraint learner_insights_status_check check (status in ('active', 'corrected', 'dismissed')),
  constraint learner_insights_note_check check (char_length(user_note) <= 500)
);

create index if not exists learner_insights_user_idx
  on public.learner_insights (user_id, status, created_at desc);

drop trigger if exists learner_insights_set_updated_at on public.learner_insights;
create trigger learner_insights_set_updated_at
  before update on public.learner_insights
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- learning_recommendations: regenerated snapshot, each with a reason
-- ---------------------------------------------------------------------------
create table if not exists public.learning_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  kind text not null,
  competency text not null,
  title text not null,
  reason text not null,
  priority integer not null,
  status text not null default 'active',
  generated_at timestamptz not null default now(),
  constraint learning_recs_kind_check check (kind in (
    'review_prerequisite', 'remediate', 'review_retention', 'practice', 'challenge', 'advance', 'verify_prerequisite')),
  constraint learning_recs_status_check check (status in ('active', 'dismissed')),
  constraint learning_recs_reason_check check (char_length(btrim(reason)) >= 10),
  constraint learning_recs_priority_check check (priority between 1 and 100)
);

create index if not exists learning_recs_user_idx
  on public.learning_recommendations (user_id, status, priority);

-- ---------------------------------------------------------------------------
-- review_schedules: spaced review (due dates derived by deterministic rules)
-- ---------------------------------------------------------------------------
create table if not exists public.review_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  competency text not null,
  due_at timestamptz not null,
  interval_days integer not null,
  repetitions integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_schedules_interval_check check (interval_days between 1 and 365),
  constraint review_schedules_reps_check check (repetitions >= 0),
  constraint review_schedules_unique unique (user_id, course_id, competency)
);

create index if not exists review_schedules_due_idx on public.review_schedules (user_id, due_at);

drop trigger if exists review_schedules_set_updated_at on public.review_schedules;
create trigger review_schedules_set_updated_at
  before update on public.review_schedules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: own rows, read only
-- ---------------------------------------------------------------------------
alter table public.learner_preferences enable row level security;
alter table public.learning_events enable row level security;
alter table public.competency_records enable row level security;
alter table public.competency_evidence enable row level security;
alter table public.competency_prerequisites enable row level security;
alter table public.learner_knowledge_gaps enable row level security;
alter table public.learner_insights enable row level security;
alter table public.learning_recommendations enable row level security;
alter table public.review_schedules enable row level security;

revoke all on table public.learner_preferences from anon, authenticated;
revoke all on table public.learning_events from anon, authenticated;
revoke all on table public.competency_records from anon, authenticated;
revoke all on table public.competency_evidence from anon, authenticated;
revoke all on table public.competency_prerequisites from anon, authenticated;
revoke all on table public.learner_knowledge_gaps from anon, authenticated;
revoke all on table public.learner_insights from anon, authenticated;
revoke all on table public.learning_recommendations from anon, authenticated;
revoke all on table public.review_schedules from anon, authenticated;

grant select on table public.learner_preferences to authenticated;
grant select on table public.learning_events to authenticated;
grant select on table public.competency_records to authenticated;
grant select on table public.competency_evidence to authenticated;
grant select on table public.competency_prerequisites to authenticated;
grant select on table public.learner_knowledge_gaps to authenticated;
grant select on table public.learner_insights to authenticated;
grant select on table public.learning_recommendations to authenticated;
grant select on table public.review_schedules to authenticated;

drop policy if exists learner_preferences_select_own on public.learner_preferences;
create policy learner_preferences_select_own on public.learner_preferences
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists learning_events_select_own on public.learning_events;
create policy learning_events_select_own on public.learning_events
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists competency_records_select_own on public.competency_records;
create policy competency_records_select_own on public.competency_records
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists competency_evidence_select_own on public.competency_evidence;
create policy competency_evidence_select_own on public.competency_evidence
  for select to authenticated using (user_id = (select auth.uid()));

-- Prerequisite relations are course structure: visible only for courses the user owns.
drop policy if exists competency_prerequisites_select_own on public.competency_prerequisites;
create policy competency_prerequisites_select_own on public.competency_prerequisites
  for select to authenticated
  using (exists (
    select 1 from public.courses c
    where c.id = course_id and c.user_id = (select auth.uid())
  ));

drop policy if exists learner_gaps_select_own on public.learner_knowledge_gaps;
create policy learner_gaps_select_own on public.learner_knowledge_gaps
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists learner_insights_select_own on public.learner_insights;
create policy learner_insights_select_own on public.learner_insights
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists learning_recs_select_own on public.learning_recommendations;
create policy learning_recs_select_own on public.learning_recommendations
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists review_schedules_select_own on public.review_schedules;
create policy review_schedules_select_own on public.review_schedules
  for select to authenticated using (user_id = (select auth.uid()));

commit;
