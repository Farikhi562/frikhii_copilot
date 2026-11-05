-- FRIKHII Copilot — Phase 03 rollback
-- Drops only the learning domain introduced by
-- 20251105091000_phase_03_course_architect.sql. Phase 02 tables are untouched.

begin;

drop table if exists public.course_enrollments cascade;
drop table if exists public.learning_objectives cascade;
drop table if exists public.exercises cascade;
drop table if exists public.lesson_contents cascade;
drop table if exists public.lessons cascade;
drop table if exists public.classes cascade;
drop table if exists public.course_modules cascade;
drop table if exists public.course_versions cascade;
drop table if exists public.courses cascade;
drop table if exists public.knowledge_gaps cascade;
drop table if exists public.diagnostic_answers cascade;
drop table if exists public.diagnostic_answer_keys cascade;
drop table if exists public.diagnostic_questions cascade;
drop table if exists public.diagnostic_attempts cascade;
drop table if exists public.learning_goals cascade;

commit;
