-- ============================================================================
-- FRIKHII Copilot — Phase 02
-- Foundational user tables: profiles + user_preferences
--
-- Apply against a real Supabase project (SQL Editor or `supabase db push`).
-- Rollback: database/rollbacks/20251105090000_phase_02_profiles_and_preferences_down.sql
--
-- Design notes:
-- * RLS is enabled on both tables. Table owners are NOT forced through RLS so the
--   SECURITY DEFINER signup trigger (owned by the migration role) can bootstrap a
--   profile. Browser roles (anon/authenticated) are always subject to RLS.
-- * All user-owned rows are addressed by auth.uid(); ids are never trusted from
--   request payloads.
-- * No DELETE policies/grants: account deletion happens through auth.users, which
--   cascades to these tables.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_check
    check (full_name is null or char_length(btrim(full_name)) between 1 and 120),
  constraint profiles_avatar_url_check
    check (avatar_url is null or char_length(avatar_url) <= 2048)
);

comment on table public.profiles is
  'Application profile for each Supabase Auth user. One row per auth.users row.';
comment on column public.profiles.full_name is
  'Display name. Seeded from raw_user_meta_data.full_name at signup.';
comment on column public.profiles.avatar_url is
  'Reserved for a future avatar URL. Nullable; uploads are not implemented.';

-- ---------------------------------------------------------------------------
-- user_preferences
-- ---------------------------------------------------------------------------
create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  learning_language text not null default 'id-ID',
  preferred_theme text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_learning_language_check
    check (learning_language in ('id-ID', 'en-US')),
  constraint user_preferences_preferred_theme_check
    check (preferred_theme in ('system', 'light'))
);

comment on table public.user_preferences is
  'Per-user application preferences. One row per profile, created by trigger.';
comment on column public.user_preferences.preferred_theme is
  'Stored preference. Only system/light are supported until a dark theme ships.';

-- ---------------------------------------------------------------------------
-- Updated-at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Sets updated_at on row updates. Intentionally has no dynamic SQL.';

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- New auth user bootstrap
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    left(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      120
    ),
    left(
      nullif(btrim(new.raw_user_meta_data ->> 'avatar_url'), ''),
      2048
    )
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Creates the profile and default preferences for a new auth.users row. Idempotent.';

-- Trigger functions are not callable through the API.
revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon, authenticated;
revoke all on function public.set_updated_at() from public;
revoke all on function public.set_updated_at() from anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;

-- Start from no table privileges for browser roles, then grant only what the app needs.
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.user_preferences from anon, authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update on table public.user_preferences to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- Allows the client to heal a missing profile row (e.g. pre-migration account).
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists user_preferences_select_own on public.user_preferences;
create policy user_preferences_select_own
  on public.user_preferences
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists user_preferences_insert_own on public.user_preferences;
create policy user_preferences_insert_own
  on public.user_preferences
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists user_preferences_update_own on public.user_preferences;
create policy user_preferences_update_own
  on public.user_preferences
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;
