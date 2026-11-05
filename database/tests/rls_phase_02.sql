-- ============================================================================
-- RLS verification — Phase 02
--
-- Preconditions:
--   1. Migration 20251105090000_phase_02_profiles_and_preferences.sql applied.
--   2. Two auth users exist (create them through the app or the Supabase dashboard).
--   3. Replace USER_A and USER_B below with their real UUIDs. Find them with:
--        select id, email, created_at from auth.users order by created_at;
--
-- Run in the Supabase SQL Editor (role: postgres). The whole script is wrapped in
-- a transaction and rolled back, so it does not modify data.
--
-- The script is non-aborting. The only expected error (inserting another user's
-- profile) is caught inside a DO block and reported as a NOTICE/WARNING.
-- ============================================================================

begin;

-- Fail clearly if the placeholders were not replaced.
do $guard$
begin
  if 'USER_A' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or 'USER_B' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Replace USER_A and USER_B with real auth.users UUIDs before running.';
  end if;
end
$guard$;

-- 1. Grants: authenticated may read/insert/update its own rows, but not delete;
-- anon has no access.
select
  has_table_privilege('authenticated', 'public.profiles', 'SELECT') as authenticated_can_select_profiles,
  has_table_privilege('authenticated', 'public.profiles', 'INSERT') as authenticated_can_insert_profiles,
  has_table_privilege('authenticated', 'public.profiles', 'UPDATE') as authenticated_can_update_profiles,
  has_table_privilege('authenticated', 'public.profiles', 'DELETE') as authenticated_can_delete_profiles,
  has_table_privilege('anon', 'public.profiles', 'SELECT') as anon_can_select_profiles,
  has_table_privilege('anon', 'public.user_preferences', 'SELECT') as anon_can_select_preferences;

-- 2. Pretend to be USER_A for the rest of the transaction.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'USER_A', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

-- 3. A sees exactly one profile: their own.
select count(*) as profiles_visible
from public.profiles;
-- expected: 1

-- 4. A cannot see B's profile or preferences.
select count(*) as b_profile_visible
from public.profiles
where id = 'USER_B';
-- expected: 0

select count(*) as b_preferences_visible
from public.user_preferences
where user_id = 'USER_B';
-- expected: 0

-- 5. A cannot update B's profile. The statement succeeds but affects 0 rows.
with changed as (
  update public.profiles
  set full_name = 'Should not change'
  where id = 'USER_B'
  returning id
)
select count(*) as b_profile_rows_updated from changed;
-- expected: 0

-- 6. A can update their own profile and preferences.
with changed as (
  update public.profiles
  set full_name = 'RLS test (rolled back)'
  where id = 'USER_A'
  returning id
)
select count(*) as own_profile_rows_updated from changed;
-- expected: 1

with changed as (
  update public.user_preferences
  set learning_language = 'en-US'
  where user_id = 'USER_A'
  returning user_id
)
select count(*) as own_preferences_rows_updated from changed;
-- expected: 1

-- 7. A cannot insert a profile for B. RLS raises an error; catch it inside a
--    subtransaction so the rest of the script can continue.
do $insert_other_user$
declare
  inserted_id uuid;
begin
  begin
    insert into public.profiles (id, full_name)
    values ('USER_B', 'Should not exist')
    returning id into inserted_id;
    raise warning 'FAIL: insert for USER_B unexpectedly succeeded (id=%)', inserted_id;
  exception
    when insufficient_privilege then
      raise notice 'PASS: insert for USER_B was blocked by RLS.';
    when others then
      raise warning 'FAIL: unexpected error inserting for USER_B: % (SQLSTATE %)', sqlerrm, sqlstate;
  end;
end
$insert_other_user$;

reset role;

-- 8. Anon has no read access.
select
  has_table_privilege('anon', 'public.profiles', 'SELECT') as anon_can_select_profiles,
  has_table_privilege('anon', 'public.user_preferences', 'SELECT') as anon_can_select_preferences;
-- expected: false, false

rollback;
