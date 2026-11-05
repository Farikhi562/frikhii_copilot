-- ============================================================================
-- FRIKHII Copilot — Phase 03.5
-- AI Tutor and Learning Progress: conversations, messages, lesson_completions
--
-- Apply after Phase 02 and Phase 03 migrations.
-- Rollback: database/rollbacks/20251105092000_phase_03_5_ai_tutor_and_progress_down.sql
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'New conversation',
  tutor_mode text not null default 'explain',
  context_type text,
  context_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_title_check check (char_length(btrim(title)) between 1 and 200),
  constraint conversations_tutor_mode_check check (
    tutor_mode in ('explain', 'deep_dive', 'practice', 'socratic', 'review', 'project')
  ),
  constraint conversations_context_type_check check (
    context_type is null or context_type in ('course', 'lesson', 'general')
  )
);

comment on table public.conversations is
  'User conversations with the AI Tutor across tutor modes and course/lesson contexts.';

create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc);
create index if not exists conversations_user_context_idx
  on public.conversations (user_id, context_type, context_id);

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null,
  content text not null,
  model text not null default '',
  token_usage jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint messages_role_check check (role in ('user', 'assistant', 'system')),
  constraint messages_content_check check (char_length(content) > 0),
  constraint messages_metadata_check check (jsonb_typeof(metadata) = 'object'),
  constraint messages_token_usage_check check (token_usage is null or jsonb_typeof(token_usage) = 'object')
);

comment on table public.messages is
  'Individual turns inside an AI Tutor conversation.';

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at asc);
create index if not exists messages_user_created_idx
  on public.messages (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- lesson_completions
-- ---------------------------------------------------------------------------
create table if not exists public.lesson_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  notes text not null default '',
  completed_at timestamptz not null default now(),
  constraint lesson_completions_user_lesson_key unique (user_id, lesson_id)
);

comment on table public.lesson_completions is
  'Tracks user completion of individual lessons in enrolled courses.';

create index if not exists lesson_completions_user_course_idx
  on public.lesson_completions (user_id, course_id, completed_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security (RLS)
-- ---------------------------------------------------------------------------
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.lesson_completions enable row level security;

-- conversations policies
drop policy if exists conversations_select_policy on public.conversations;
create policy conversations_select_policy on public.conversations
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists conversations_insert_policy on public.conversations;
create policy conversations_insert_policy on public.conversations
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists conversations_update_policy on public.conversations;
create policy conversations_update_policy on public.conversations
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists conversations_delete_policy on public.conversations;
create policy conversations_delete_policy on public.conversations
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- messages policies
drop policy if exists messages_select_policy on public.messages;
create policy messages_select_policy on public.messages
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists messages_insert_policy on public.messages;
create policy messages_insert_policy on public.messages
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists messages_update_policy on public.messages;
create policy messages_update_policy on public.messages
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists messages_delete_policy on public.messages;
create policy messages_delete_policy on public.messages
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- lesson_completions policies
drop policy if exists lesson_completions_select_policy on public.lesson_completions;
create policy lesson_completions_select_policy on public.lesson_completions
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists lesson_completions_insert_policy on public.lesson_completions;
create policy lesson_completions_insert_policy on public.lesson_completions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists lesson_completions_delete_policy on public.lesson_completions;
create policy lesson_completions_delete_policy on public.lesson_completions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Grants
grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert, update, delete on public.messages to authenticated;
grant select, insert, update, delete on public.lesson_completions to authenticated;

commit;
