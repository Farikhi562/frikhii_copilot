-- ============================================================================
-- FRIKHII Copilot — Phase 03
-- AI Course Architect: learning goals, diagnostics, courses, versions, content
--
-- Apply after the Phase 02 migration. This migration is additive: it does not alter
-- profiles or user_preferences.
--
-- Rollback: database/rollbacks/20251105091000_phase_03_course_architect_down.sql
--
-- Security boundary
-- * Browser roles receive only SELECT on user-owned learning data, always through RLS.
-- * Diagnostic answer keys have RLS enabled and NO grants to anon/authenticated.
-- * The Go Core API connects with a privileged database role. It re-checks ownership in
--   every query and is the only writer. The service connection bypasses RLS by design;
--   RLS here protects direct PostgREST/browser access, not the Go service.
-- * The approved version is unique per course via a partial unique index, so repeated
--   approve requests cannot create two approved curricula.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- learning_goals
-- ---------------------------------------------------------------------------
create table if not exists public.learning_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  goal_statement text not null,
  intended_outcome text not null,
  motivation text not null,
  additional_context text not null default '',
  self_reported_level text not null default 'unsure',
  current_knowledge jsonb not null default '{}'::jsonb,
  weekly_study_minutes integer not null default 300,
  learning_language text not null default 'en-US',
  learning_preferences jsonb not null default '{}'::jsonb,
  target_date date,
  status text not null default 'intake',
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_goals_title_check check (char_length(btrim(title)) between 3 and 160),
  constraint learning_goals_goal_statement_check check (char_length(btrim(goal_statement)) between 8 and 2000),
  constraint learning_goals_intended_outcome_check check (char_length(btrim(intended_outcome)) between 8 and 2000),
  constraint learning_goals_motivation_check check (char_length(btrim(motivation)) between 3 and 1500),
  constraint learning_goals_additional_context_check check (char_length(additional_context) <= 4000),
  constraint learning_goals_level_check
    check (self_reported_level in ('beginner', 'basic', 'intermediate', 'advanced', 'unsure')),
  constraint learning_goals_weekly_minutes_check
    check (weekly_study_minutes between 30 and 10080),
  constraint learning_goals_language_check
    check (learning_language in ('id-ID', 'en-US')),
  constraint learning_goals_current_knowledge_check
    check (jsonb_typeof(current_knowledge) = 'object'),
  constraint learning_goals_preferences_check
    check (jsonb_typeof(learning_preferences) = 'object'),
  constraint learning_goals_status_check
    check (status in ('intake', 'diagnostic_ready', 'diagnostic_evaluated', 'generating', 'course_draft', 'approved', 'failed'))
);

comment on table public.learning_goals is
  'A learner-owned goal. The browser can read its own rows; only the Go Core API writes.';
comment on column public.learning_goals.status is
  'Lifecycle: intake -> diagnostic_ready -> diagnostic_evaluated -> generating -> course_draft -> approved. failed is retryable.';
comment on column public.learning_goals.self_reported_level is
  'Self-reported only. Never treated as verified knowledge.';

create index if not exists learning_goals_user_created_idx
  on public.learning_goals (user_id, created_at desc);
create index if not exists learning_goals_status_idx
  on public.learning_goals (user_id, status);

drop trigger if exists learning_goals_set_updated_at on public.learning_goals;
create trigger learning_goals_set_updated_at
  before update on public.learning_goals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- diagnostic_attempts
-- ---------------------------------------------------------------------------
create table if not exists public.diagnostic_attempts (
  id uuid primary key default gen_random_uuid(),
  learning_goal_id uuid not null references public.learning_goals (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  attempt_number integer not null default 1,
  status text not null default 'generating',
  estimated_level text,
  confidence text,
  evaluation_summary text,
  strengths jsonb not null default '[]'::jsonb,
  knowledge_gaps jsonb not null default '[]'::jsonb,
  misconceptions jsonb not null default '[]'::jsonb,
  recommended_start text,
  rationale text,
  question_scores jsonb not null default '[]'::jsonb,
  can_skip jsonb not null default '[]'::jsonb,
  submitted_at timestamptz,
  evaluated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diagnostic_attempts_number_check check (attempt_number > 0),
  constraint diagnostic_attempts_status_check
    check (status in ('generating', 'ready', 'submitted', 'evaluating', 'evaluated', 'failed')),
  constraint diagnostic_attempts_level_check
    check (estimated_level is null or estimated_level in ('foundation', 'beginner', 'intermediate', 'advanced')),
  constraint diagnostic_attempts_confidence_check
    check (confidence is null or confidence in ('low', 'medium', 'high')),
  constraint diagnostic_attempts_strengths_check check (jsonb_typeof(strengths) = 'array'),
  constraint diagnostic_attempts_gaps_check check (jsonb_typeof(knowledge_gaps) = 'array'),
  constraint diagnostic_attempts_misconceptions_check check (jsonb_typeof(misconceptions) = 'array'),
  constraint diagnostic_attempts_scores_check check (jsonb_typeof(question_scores) = 'array'),
  constraint diagnostic_attempts_can_skip_check check (jsonb_typeof(can_skip) = 'array'),
  constraint diagnostic_attempts_goal_number_key unique (learning_goal_id, attempt_number)
);

comment on table public.diagnostic_attempts is
  'One diagnostic run per attempt. Evaluation is an estimate, not a certification.';

create index if not exists diagnostic_attempts_user_idx
  on public.diagnostic_attempts (user_id, created_at desc);
create index if not exists diagnostic_attempts_goal_idx
  on public.diagnostic_attempts (learning_goal_id, attempt_number desc);

drop trigger if exists diagnostic_attempts_set_updated_at on public.diagnostic_attempts;
create trigger diagnostic_attempts_set_updated_at
  before update on public.diagnostic_attempts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- diagnostic_questions
-- ---------------------------------------------------------------------------
create table if not exists public.diagnostic_questions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.diagnostic_attempts (id) on delete cascade,
  source_id text not null,
  sequence_order integer not null,
  question_type text not null,
  prompt text not null,
  competency text not null,
  difficulty text not null,
  choices jsonb not null default '[]'::jsonb,
  explanation text not null,
  created_at timestamptz not null default now(),
  constraint diagnostic_questions_sequence_check check (sequence_order > 0),
  constraint diagnostic_questions_type_check
    check (question_type in ('multiple_choice', 'short_answer', 'scenario', 'reasoning')),
  constraint diagnostic_questions_difficulty_check
    check (difficulty in ('foundation', 'intermediate', 'advanced')),
  constraint diagnostic_questions_choices_check check (jsonb_typeof(choices) = 'array'),
  constraint diagnostic_questions_source_check check (char_length(btrim(source_id)) between 1 and 60),
  constraint diagnostic_questions_attempt_source_key unique (attempt_id, source_id),
  constraint diagnostic_questions_attempt_sequence_key unique (attempt_id, sequence_order)
);

create index if not exists diagnostic_questions_attempt_idx
  on public.diagnostic_questions (attempt_id, sequence_order);

-- ---------------------------------------------------------------------------
-- diagnostic_answer_keys — private, never granted to browser roles
-- ---------------------------------------------------------------------------
create table if not exists public.diagnostic_answer_keys (
  question_id uuid primary key references public.diagnostic_questions (id) on delete cascade,
  expected_answer text not null,
  rubric jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint diagnostic_answer_keys_expected_check check (char_length(btrim(expected_answer)) > 0),
  constraint diagnostic_answer_keys_rubric_check check (jsonb_typeof(rubric) = 'array')
);

comment on table public.diagnostic_answer_keys is
  'Private grading material. RLS is enabled, no grants are given to anon/authenticated, and all access is through the Go service.';

-- ---------------------------------------------------------------------------
-- diagnostic_answers
-- ---------------------------------------------------------------------------
create table if not exists public.diagnostic_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.diagnostic_attempts (id) on delete cascade,
  question_id uuid not null references public.diagnostic_questions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  response text not null,
  score integer,
  feedback text,
  created_at timestamptz not null default now(),
  constraint diagnostic_answers_response_check check (char_length(response) <= 5000),
  constraint diagnostic_answers_score_check check (score is null or score between 0 and 100),
  constraint diagnostic_answers_attempt_question_key unique (attempt_id, question_id)
);

create index if not exists diagnostic_answers_attempt_idx
  on public.diagnostic_answers (attempt_id);

-- ---------------------------------------------------------------------------
-- knowledge_gaps
-- ---------------------------------------------------------------------------
create table if not exists public.knowledge_gaps (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.diagnostic_attempts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  competency text not null,
  description text not null,
  severity text not null,
  recommendation text not null,
  created_at timestamptz not null default now(),
  constraint knowledge_gaps_severity_check check (severity in ('low', 'medium', 'high'))
);

create index if not exists knowledge_gaps_attempt_idx
  on public.knowledge_gaps (attempt_id);

-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  learning_goal_id uuid not null unique references public.learning_goals (id) on delete cascade,
  current_version_id uuid,
  approved_version_id uuid,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint courses_status_check check (status in ('draft', 'approved', 'archived'))
);

comment on table public.courses is
  'A learner-owned course. Exactly one course per learning goal; regenerations add versions.';

create index if not exists courses_user_created_idx
  on public.courses (user_id, created_at desc);
create index if not exists courses_user_status_idx
  on public.courses (user_id, status);

drop trigger if exists courses_set_updated_at on public.courses;
create trigger courses_set_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- course_versions
-- ---------------------------------------------------------------------------
create table if not exists public.course_versions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  version_number integer not null,
  status text not null default 'draft',
  title text not null,
  short_description text not null,
  description text not null,
  learning_goal text not null,
  target_learner_level text not null,
  objectives jsonb not null default '[]'::jsonb,
  target_competencies jsonb not null default '[]'::jsonb,
  prerequisites jsonb not null default '[]'::jsonb,
  estimated_duration_minutes integer not null,
  recommended_weekly_study_minutes integer not null,
  methodology text not null,
  expected_outcome text not null,
  final_project jsonb not null,
  final_assessment jsonb not null,
  assumptions jsonb not null default '[]'::jsonb,
  suggested_search_topics jsonb not null default '[]'::jsonb,
  generation_metadata jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  constraint course_versions_number_check check (version_number > 0),
  constraint course_versions_status_check check (status in ('draft', 'approved', 'superseded')),
  constraint course_versions_level_check
    check (target_learner_level in ('foundation', 'beginner', 'intermediate', 'advanced')),
  constraint course_versions_duration_check check (estimated_duration_minutes > 0),
  constraint course_versions_weekly_check check (recommended_weekly_study_minutes between 30 and 10080),
  constraint course_versions_objectives_check check (jsonb_typeof(objectives) = 'array'),
  constraint course_versions_competencies_check check (jsonb_typeof(target_competencies) = 'array'),
  constraint course_versions_prerequisites_check check (jsonb_typeof(prerequisites) = 'array'),
  constraint course_versions_assumptions_check check (jsonb_typeof(assumptions) = 'array'),
  constraint course_versions_search_topics_check check (jsonb_typeof(suggested_search_topics) = 'array'),
  constraint course_versions_metadata_check check (jsonb_typeof(generation_metadata) = 'object'),
  constraint course_versions_warnings_check check (jsonb_typeof(warnings) = 'array'),
  constraint course_versions_course_number_key unique (course_id, version_number)
);

-- A course can have at most one approved version. Repeated approve clicks cannot
-- produce two approved curricula.
create unique index if not exists course_versions_one_approved_idx
  on public.course_versions (course_id)
  where status = 'approved';

create index if not exists course_versions_course_idx
  on public.course_versions (course_id, version_number desc);
create index if not exists course_versions_status_idx
  on public.course_versions (course_id, status);

alter table public.courses
  drop constraint if exists courses_current_version_fk;
alter table public.courses
  add constraint courses_current_version_fk
  foreign key (current_version_id) references public.course_versions (id) on delete set null;

alter table public.courses
  drop constraint if exists courses_approved_version_fk;
alter table public.courses
  add constraint courses_approved_version_fk
  foreign key (approved_version_id) references public.course_versions (id) on delete set null;

-- ---------------------------------------------------------------------------
-- course_modules
-- ---------------------------------------------------------------------------
create table if not exists public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_version_id uuid not null references public.course_versions (id) on delete cascade,
  source_id text not null,
  title text not null,
  description text not null,
  sequence_order integer not null,
  objectives jsonb not null default '[]'::jsonb,
  skills jsonb not null default '[]'::jsonb,
  estimated_duration_minutes integer not null,
  required_previous_module_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint course_modules_sequence_check check (sequence_order > 0),
  constraint course_modules_duration_check check (estimated_duration_minutes > 0),
  constraint course_modules_source_check check (char_length(btrim(source_id)) between 1 and 60),
  constraint course_modules_version_source_key unique (course_version_id, source_id),
  constraint course_modules_version_sequence_key unique (course_version_id, sequence_order)
);

create index if not exists course_modules_version_idx
  on public.course_modules (course_version_id, sequence_order);

-- ---------------------------------------------------------------------------
-- classes
-- ---------------------------------------------------------------------------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  course_version_id uuid not null references public.course_versions (id) on delete cascade,
  module_id uuid not null references public.course_modules (id) on delete cascade,
  source_id text not null,
  title text not null,
  description text not null,
  sequence_order integer not null,
  objectives jsonb not null default '[]'::jsonb,
  prerequisite_class_ids jsonb not null default '[]'::jsonb,
  estimated_duration_minutes integer not null,
  key_concepts jsonb not null default '[]'::jsonb,
  knowledge_check jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint classes_sequence_check check (sequence_order > 0),
  constraint classes_duration_check check (estimated_duration_minutes > 0),
  constraint classes_source_check check (char_length(btrim(source_id)) between 1 and 60),
  constraint classes_knowledge_check_check check (jsonb_typeof(knowledge_check) = 'object'),
  constraint classes_version_source_key unique (course_version_id, source_id),
  constraint classes_module_sequence_key unique (module_id, sequence_order)
);

create index if not exists classes_module_idx on public.classes (module_id, sequence_order);
create index if not exists classes_version_idx on public.classes (course_version_id);

-- ---------------------------------------------------------------------------
-- lessons
-- ---------------------------------------------------------------------------
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_version_id uuid not null references public.course_versions (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  source_id text not null,
  title text not null,
  description text not null,
  sequence_order integer not null,
  estimated_duration_minutes integer not null,
  created_at timestamptz not null default now(),
  constraint lessons_sequence_check check (sequence_order > 0),
  constraint lessons_duration_check check (estimated_duration_minutes > 0),
  constraint lessons_source_check check (char_length(btrim(source_id)) between 1 and 60),
  constraint lessons_version_source_key unique (course_version_id, source_id),
  constraint lessons_class_sequence_key unique (class_id, sequence_order)
);

create index if not exists lessons_class_idx on public.lessons (class_id, sequence_order);
create index if not exists lessons_version_idx on public.lessons (course_version_id);

-- ---------------------------------------------------------------------------
-- lesson_contents — Phase 03 stores a blueprint, not an authored lesson
-- ---------------------------------------------------------------------------
create table if not exists public.lesson_contents (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  content_type text not null default 'blueprint',
  content jsonb not null,
  sequence_order integer not null default 1,
  created_at timestamptz not null default now(),
  constraint lesson_contents_type_check check (content_type in ('blueprint')),
  constraint lesson_contents_content_check check (jsonb_typeof(content) = 'object'),
  constraint lesson_contents_sequence_check check (sequence_order > 0),
  constraint lesson_contents_lesson_type_sequence_key unique (lesson_id, content_type, sequence_order)
);

create index if not exists lesson_contents_lesson_idx
  on public.lesson_contents (lesson_id, sequence_order);

-- ---------------------------------------------------------------------------
-- exercises
-- ---------------------------------------------------------------------------
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  course_version_id uuid not null references public.course_versions (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  title text not null,
  description text not null,
  difficulty text not null,
  competency text not null,
  instructions jsonb not null default '[]'::jsonb,
  expected_deliverable text not null,
  evaluation_criteria jsonb not null default '[]'::jsonb,
  sequence_order integer not null default 1,
  created_at timestamptz not null default now(),
  constraint exercises_difficulty_check
    check (difficulty in ('foundation', 'intermediate', 'advanced')),
  constraint exercises_sequence_check check (sequence_order > 0),
  constraint exercises_class_key unique (class_id)
);

create index if not exists exercises_version_idx
  on public.exercises (course_version_id);

-- ---------------------------------------------------------------------------
-- learning_objectives — derived, searchable index of generated objectives
-- ---------------------------------------------------------------------------
create table if not exists public.learning_objectives (
  id uuid primary key default gen_random_uuid(),
  course_version_id uuid not null references public.course_versions (id) on delete cascade,
  module_id uuid references public.course_modules (id) on delete cascade,
  class_id uuid references public.classes (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete cascade,
  description text not null,
  competency text not null default '',
  sequence_order integer not null,
  created_at timestamptz not null default now(),
  constraint learning_objectives_scope_check check (
    (module_id is null and class_id is null and lesson_id is null)
    or (module_id is not null and class_id is null and lesson_id is null)
    or (module_id is not null and class_id is not null and lesson_id is null)
    or (module_id is not null and class_id is not null and lesson_id is not null)
  ),
  constraint learning_objectives_sequence_check check (sequence_order > 0)
);

create index if not exists learning_objectives_version_idx
  on public.learning_objectives (course_version_id, sequence_order);
create index if not exists learning_objectives_module_idx
  on public.learning_objectives (module_id);
create index if not exists learning_objectives_class_idx
  on public.learning_objectives (class_id);

-- ---------------------------------------------------------------------------
-- course_enrollments
-- ---------------------------------------------------------------------------
create table if not exists public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  course_version_id uuid not null references public.course_versions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active',
  enrolled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_enrollments_status_check
    check (status in ('active', 'completed', 'paused', 'withdrawn')),
  constraint course_enrollments_user_course_key unique (user_id, course_id)
);

create index if not exists course_enrollments_user_idx
  on public.course_enrollments (user_id, status);

drop trigger if exists course_enrollments_set_updated_at on public.course_enrollments;
create trigger course_enrollments_set_updated_at
  before update on public.course_enrollments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.learning_goals enable row level security;
alter table public.diagnostic_attempts enable row level security;
alter table public.diagnostic_questions enable row level security;
alter table public.diagnostic_answer_keys enable row level security;
alter table public.diagnostic_answers enable row level security;
alter table public.knowledge_gaps enable row level security;
alter table public.courses enable row level security;
alter table public.course_versions enable row level security;
alter table public.course_modules enable row level security;
alter table public.classes enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_contents enable row level security;
alter table public.exercises enable row level security;
alter table public.learning_objectives enable row level security;
alter table public.course_enrollments enable row level security;

-- Browser roles: read-only, own rows only. No INSERT/UPDATE/DELETE grants.
revoke all on table public.learning_goals from anon, authenticated;
revoke all on table public.diagnostic_attempts from anon, authenticated;
revoke all on table public.diagnostic_questions from anon, authenticated;
revoke all on table public.diagnostic_answer_keys from anon, authenticated;
revoke all on table public.diagnostic_answers from anon, authenticated;
revoke all on table public.knowledge_gaps from anon, authenticated;
revoke all on table public.courses from anon, authenticated;
revoke all on table public.course_versions from anon, authenticated;
revoke all on table public.course_modules from anon, authenticated;
revoke all on table public.classes from anon, authenticated;
revoke all on table public.lessons from anon, authenticated;
revoke all on table public.lesson_contents from anon, authenticated;
revoke all on table public.exercises from anon, authenticated;
revoke all on table public.learning_objectives from anon, authenticated;
revoke all on table public.course_enrollments from anon, authenticated;

grant select on table public.learning_goals to authenticated;
grant select on table public.diagnostic_attempts to authenticated;
grant select on table public.diagnostic_questions to authenticated;
grant select on table public.diagnostic_answers to authenticated;
grant select on table public.knowledge_gaps to authenticated;
grant select on table public.courses to authenticated;
grant select on table public.course_versions to authenticated;
grant select on table public.course_modules to authenticated;
grant select on table public.classes to authenticated;
grant select on table public.lessons to authenticated;
grant select on table public.lesson_contents to authenticated;
grant select on table public.exercises to authenticated;
grant select on table public.learning_objectives to authenticated;
grant select on table public.course_enrollments to authenticated;

-- learning_goals
drop policy if exists learning_goals_select_own on public.learning_goals;
create policy learning_goals_select_own on public.learning_goals
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- diagnostic_attempts
drop policy if exists diagnostic_attempts_select_own on public.diagnostic_attempts;
create policy diagnostic_attempts_select_own on public.diagnostic_attempts
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.learning_goals g
      where g.id = learning_goal_id and g.user_id = (select auth.uid())
    )
  );

-- diagnostic_questions
drop policy if exists diagnostic_questions_select_own on public.diagnostic_questions;
create policy diagnostic_questions_select_own on public.diagnostic_questions
  for select to authenticated
  using (
    exists (
      select 1
      from public.diagnostic_attempts a
      join public.learning_goals g on g.id = a.learning_goal_id
      where a.id = attempt_id and a.user_id = (select auth.uid()) and g.user_id = (select auth.uid())
    )
  );

-- diagnostic_answer_keys: RLS enabled, no policy, no grant. Only the service role can read.

-- diagnostic_answers
drop policy if exists diagnostic_answers_select_own on public.diagnostic_answers;
create policy diagnostic_answers_select_own on public.diagnostic_answers
  for select to authenticated
  using (user_id = (select auth.uid()));

-- knowledge_gaps
drop policy if exists knowledge_gaps_select_own on public.knowledge_gaps;
create policy knowledge_gaps_select_own on public.knowledge_gaps
  for select to authenticated
  using (user_id = (select auth.uid()));

-- courses
drop policy if exists courses_select_own on public.courses;
create policy courses_select_own on public.courses
  for select to authenticated
  using (user_id = (select auth.uid()));

-- course_versions
drop policy if exists course_versions_select_own on public.course_versions;
create policy course_versions_select_own on public.course_versions
  for select to authenticated
  using (
    exists (
      select 1 from public.courses c
      where c.id = course_id and c.user_id = (select auth.uid())
    )
  );

-- course_modules
drop policy if exists course_modules_select_own on public.course_modules;
create policy course_modules_select_own on public.course_modules
  for select to authenticated
  using (
    exists (
      select 1 from public.course_versions v
      join public.courses c on c.id = v.course_id
      where v.id = course_version_id and c.user_id = (select auth.uid())
    )
  );

-- classes
drop policy if exists classes_select_own on public.classes;
create policy classes_select_own on public.classes
  for select to authenticated
  using (
    exists (
      select 1
      from public.course_modules m
      join public.course_versions v on v.id = m.course_version_id
      join public.courses c on c.id = v.course_id
      where m.id = module_id and c.user_id = (select auth.uid())
    )
  );

-- lessons
drop policy if exists lessons_select_own on public.lessons;
create policy lessons_select_own on public.lessons
  for select to authenticated
  using (
    exists (
      select 1
      from public.classes cl
      join public.course_modules m on m.id = cl.module_id
      join public.course_versions v on v.id = m.course_version_id
      join public.courses c on c.id = v.course_id
      where cl.id = class_id and c.user_id = (select auth.uid())
    )
  );

-- lesson_contents
drop policy if exists lesson_contents_select_own on public.lesson_contents;
create policy lesson_contents_select_own on public.lesson_contents
  for select to authenticated
  using (
    exists (
      select 1
      from public.lessons l
      join public.classes cl on cl.id = l.class_id
      join public.course_modules m on m.id = cl.module_id
      join public.course_versions v on v.id = m.course_version_id
      join public.courses c on c.id = v.course_id
      where l.id = lesson_id and c.user_id = (select auth.uid())
    )
  );

-- exercises
drop policy if exists exercises_select_own on public.exercises;
create policy exercises_select_own on public.exercises
  for select to authenticated
  using (
    exists (
      select 1 from public.course_versions v
      join public.courses c on c.id = v.course_id
      where v.id = course_version_id and c.user_id = (select auth.uid())
    )
  );

-- learning_objectives
drop policy if exists learning_objectives_select_own on public.learning_objectives;
create policy learning_objectives_select_own on public.learning_objectives
  for select to authenticated
  using (
    exists (
      select 1 from public.course_versions v
      join public.courses c on c.id = v.course_id
      where v.id = course_version_id and c.user_id = (select auth.uid())
    )
  );

-- course_enrollments
drop policy if exists course_enrollments_select_own on public.course_enrollments;
create policy course_enrollments_select_own on public.course_enrollments
  for select to authenticated
  using (user_id = (select auth.uid()));

commit;
