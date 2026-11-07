-- ============================================================================
-- FRIKHII Copilot — Phase 03 RLS verification
--
-- Preconditions:
--   1. Phase 02 and Phase 03 migrations applied.
--   2. Two real users exist: USER_A and USER_B (UUIDs from auth.users).
--   3. USER_A owns at least one learning goal and course; USER_B owns another.
--
-- Run in the Supabase SQL Editor as postgres. The transaction is rolled back.
-- Replace USER_A / USER_B before running. Expected results appear next to queries.
-- ============================================================================

begin;

-- Pretend to be USER_A.
select set_config(
  'request.jwt.claims',
  json_build_object('sub': 'USER_A', 'role': 'authenticated')::text,
  true
);
set local role authenticated;

-- 1. A sees only their own goals.
select count(*) as own_goals_visible from public.learning_goals;
-- expected: number of goals owned by USER_A

select count(*) as b_goals_visible from public.learning_goals where user_id = 'USER_B';
-- expected: 0

-- 2. A sees only their own diagnostic attempts.
select count(*) as b_attempts_visible
from public.diagnostic_attempts where user_id = 'USER_B';
-- expected: 0

-- 3. A cannot read answer keys at all (no table grant).
select count(*) from public.diagnostic_answer_keys;
-- expected: ERROR: permission denied for table diagnostic_answer_keys

-- 4. A sees only their own courses and nested content.
select count(*) as b_courses_visible from public.courses where user_id = 'USER_B';
-- expected: 0

select count(*) as b_versions_visible
from public.course_versions v
join public.courses c on c.id = v.course_id
where c.user_id = 'USER_B';
-- expected: 0

select count(*) as b_modules_visible
from public.course_modules m
join public.course_versions v on v.id = m.course_version_id
join public.courses c on c.id = v.course_id
where c.user_id = 'USER_B';
-- expected: 0

-- 5. A cannot mutate any learning row (no INSERT/UPDATE/DELETE grants).
update public.learning_goals set title = 'Should not change' where user_id = 'USER_B';
-- expected: ERROR: permission denied for table learning_goals

insert into public.courses (user_id, learning_goal_id)
values ('USER_A', (select id from public.learning_goals limit 1));
-- expected: ERROR: permission denied for table courses

-- 6. A can read their own approved course and enrollment.
select count(*) as own_approved_courses
from public.courses where user_id = 'USER_A' and status = 'approved';
-- expected: number owned by USER_A

select count(*) as own_enrollments
from public.course_enrollments where user_id = 'USER_A';
-- expected: number owned by USER_A

-- 7. Anon has no privileges.
reset role;
set local role anon;
select count(*) from public.courses;
-- expected: ERROR: permission denied for table courses

rollback;
