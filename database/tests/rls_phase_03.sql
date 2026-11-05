-- ============================================================================
-- FRIKHII Copilot — Phase 03 RLS verification
--
-- Preconditions:
--   1. Phase 02 and Phase 03 migrations applied.
--   2. Two real users exist: USER_A and USER_B (UUIDs from auth.users).
--   3. USER_A owns at least one learning goal and course; USER_B owns another.
--
-- Run in the Supabase SQL Editor as postgres. The transaction is rolled back.
-- Replace USER_A / USER_B with real UUIDs before running. Find them with:
--   select id, email, created_at from auth.users order by created_at;
--
-- This script is deliberately non-aborting:
--   * reads run as the `authenticated` role with a forged JWT subject;
--   * write/answer-key protection is checked with has_table_privilege();
--   * expected results appear as comments next to each query.
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

-- 1. Privilege checks (run as postgres, before impersonation).
-- Expected: every write value is false, and authenticated_can_read_answer_keys is false.
select
  has_table_privilege('authenticated', 'public.learning_goals', 'INSERT') as authenticated_can_insert_goals,
  has_table_privilege('authenticated', 'public.learning_goals', 'UPDATE') as authenticated_can_update_goals,
  has_table_privilege('authenticated', 'public.learning_goals', 'DELETE') as authenticated_can_delete_goals,
  has_table_privilege('authenticated', 'public.courses', 'INSERT') as authenticated_can_insert_courses,
  has_table_privilege('authenticated', 'public.course_versions', 'UPDATE') as authenticated_can_update_versions,
  has_table_privilege('authenticated', 'public.diagnostic_answer_keys', 'SELECT') as authenticated_can_read_answer_keys,
  has_table_privilege('anon', 'public.learning_goals', 'SELECT') as anon_can_select_goals;

-- 2. Pretend to be USER_A.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'USER_A', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

-- 3. A sees only their own goals.
select count(*) as own_goals_visible from public.learning_goals;
-- expected: number of goals owned by USER_A

select count(*) as b_goals_visible from public.learning_goals where user_id = 'USER_B';
-- expected: 0

-- 4. A sees only their own diagnostic attempts, questions and answers.
select count(*) as b_attempts_visible
from public.diagnostic_attempts where user_id = 'USER_B';
-- expected: 0

select count(*) as b_questions_visible
from public.diagnostic_questions q
join public.diagnostic_attempts a on a.id = q.attempt_id
where a.user_id = 'USER_B';
-- expected: 0

select count(*) as b_answers_visible
from public.diagnostic_answers where user_id = 'USER_B';
-- expected: 0

-- 5. A sees only their own courses and nested content.
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

select count(*) as b_lessons_visible
from public.lessons l
join public.classes cl on cl.id = l.class_id
join public.course_modules m on m.id = cl.module_id
join public.course_versions v on v.id = m.course_version_id
join public.courses c on c.id = v.course_id
where c.user_id = 'USER_B';
-- expected: 0

-- 6. A can read their own approved course and enrollment.
select count(*) as own_approved_courses
from public.courses where user_id = 'USER_A' and status = 'approved';
-- expected: number owned by USER_A

select count(*) as own_enrollments
from public.course_enrollments where user_id = 'USER_A';
-- expected: number owned by USER_A

reset role;

-- 7. Anon has no table privileges (rechecked with the anon role explicitly).
select has_table_privilege('anon', 'public.courses', 'SELECT') as anon_can_select_courses;
-- expected: false

rollback;
