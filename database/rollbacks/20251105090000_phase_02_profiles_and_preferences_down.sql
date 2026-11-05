-- ============================================================================
-- Rollback for 20251105090000_phase_02_profiles_and_preferences.sql
--
-- Destructive: removes profiles, user_preferences and the signup trigger.
-- Run deliberately (manual review, backup first).
-- ============================================================================

begin;

drop trigger if exists on_auth_user_created on auth.users;

drop function if exists public.handle_new_user();

drop table if exists public.user_preferences;
drop table if exists public.profiles;

drop function if exists public.set_updated_at();

commit;
