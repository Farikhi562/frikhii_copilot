-- Rolls back Phase 04. Destroys all learner intelligence data. Phase 02/03 data is untouched.
begin;
drop table if exists public.review_schedules;
drop table if exists public.learning_recommendations;
drop table if exists public.learner_insights;
drop table if exists public.learner_knowledge_gaps;
drop table if exists public.competency_prerequisites;
drop table if exists public.competency_evidence;
drop table if exists public.competency_records;
drop table if exists public.learning_events;
drop table if exists public.learner_preferences;
commit;
