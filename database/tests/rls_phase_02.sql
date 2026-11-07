-- ============================================================================
-- RLS verification — Phase 02
--
-- Preconditions:
--   1. Migration 20251105090000_phase_02_profiles_and_preferences.sql applied.
--   2. Two auth users exist (create them through the app or the Supabase dashboard).
--   3. Replace USER_A and USER_B below with their real UUIDs.
--
-- Run in the Supabase SQL Editor (role: postgres). The whole script is wrapped in
-- a transaction and rolled back, so it does not modify data.
--
-- Expected results are written next to each query.
-- ============================================================================

begin;

-- Pretend to be USER_A for the rest of the transaction.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'USER_A', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

-- 1. A sees exactly one profile: their own.
select count(*) as profiles_visible
from public.profiles;
-- expected: 1

-- 2. A cannot see B's profile.
select count(*) as b_profile_visible
from public.profiles
where id = 'USER_B';
-- expected: 0

-- 3. A cannot see B's preferences.
select count(*) as b_preferences_visible
from public.user_preferences
where user_id = 'USER_B';
-- expected: 0

-- 4. A cannot update B's profile. The statement succeeds but affects 0 rows.
update public.profiles
set full_name = 'Should not change'
where id = 'USER_B';
-- expected: UPDATE 0

-- 5. A cannot insert a profile for B. RLS raises a violation.
insert into public.profiles (id, full_name)
values ('USER_B', 'Should not exist');
-- expected: ERROR: new row violates row-level security policy for table "profiles"

-- 6. A can update their own profile and preferences.
update public.profiles
set full_name = 'RLS test (rolled back)'
where id = 'USER_A';
-- expected: UPDATE 1

update public.user_preferences
set learning_language = 'en-US'
where user_id = 'USER_A';
-- expected: UPDATE 1

-- 7. Anon has no table privileges at all.
reset role;
set local role anon;
select count(*) from public.profiles;
-- expected: ERROR: permission denied for table profiles

rollback;
