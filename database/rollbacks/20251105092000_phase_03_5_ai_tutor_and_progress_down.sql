-- ============================================================================
-- FRIKHII Copilot — Phase 03.5 Rollback
-- AI Tutor and Learning Progress: conversations, messages, lesson_completions
-- ============================================================================

begin;

drop table if exists public.lesson_completions cascade;
drop table if exists public.messages cascade;
drop table if exists public.conversations cascade;

commit;
