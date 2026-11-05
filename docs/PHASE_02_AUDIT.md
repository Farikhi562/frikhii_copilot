# Phase 02 Audit

**Date:** 2026-11-05
**Scope:** Supabase foundation, authentication, profiles/preferences, RLS, protected routes.
**Archive audited:** `frikhii-copilot-first-preview.zip` (Phase 01.7 state).

## 1. Current frontend status

| Area | State at audit |
|---|---|
| Stack | React 19, Vite 8, TypeScript (strict), Tailwind CSS 4, Motion, React Router 7, TanStack Query 5, Radix UI, Lucide, Zustand. |
| Public site | Working landing page (hero, trailer placeholder, gallery, problem/solution, product showcase, final CTA, footer). |
| UI kit | Button, Field, Textarea, Select, Checkbox, Radio, Switch, Avatar, Dialog, ConfirmDialog, Dropdown, Popover, Tooltip, Tabs, Breadcrumb, Sidebar, Topbar, Alert, Badge, EmptyState, ErrorState, Progress, Skeleton, Spinner, Toast. Dev gallery at `/dev/components`. |
| App shell | Sidebar + topbar + mobile menu dialog. Pages `/app`, `/app/courses`, `/app/settings` existed, all publicly reachable. |
| Data | None. TanStack Query provider existed but no query hooks. |
| Forms | Only the Courses demo used Zod manually; React Hook Form was declared but unused. |
| Build | Typecheck/lint/build passed on this machine before changes; no automated tests existed. |

## 2. Authentication-related code found

**None.** `/login` and `/register` were `Placeholder` screens saying authentication would arrive later. There was:

- no Supabase client or dependency,
- no session state, listener, or loading resolution,
- no route guard (anyone could open `/app`),
- no password recovery or callback route,
- no database tables, migrations, triggers, or RLS policies,
- a hardcoded "Guest / Demo profile" identity in `AppLayout`,
- settings fields that looked editable but saved nothing.

## 3. Required changes (all implemented in Phase 02)

1. Install `@supabase/supabase-js` and add a single validated browser client (`src/lib/supabase.ts`) with PKCE.
2. Add `.env.example` values for `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; keep anon-key fallback; load env from the repository root.
3. Replace placeholders with `/login`, `/register`, `/forgot-password`, `/reset-password`, `/auth/callback`.
4. Add an `AuthProvider` with one `onAuthStateChange` subscription, initial session resolution, loading state, and cleanup.
5. Add route guards that preserve the requested destination and never redirect during initial loading.
6. Add `profiles` and `user_preferences` migrations with a signup trigger, `updated_at` triggers, and RLS.
7. Add typed feature APIs and TanStack Query hooks for profile/preferences, with cache invalidation and cache clearing on user change.
8. Replace the fake "Guest" identity with the authenticated name/email, account menu, and sign-out.
9. Make Settings save real profile/preferences and provide account actions.
10. Keep courses clearly demo-only; show an honest empty state for Phase 03.
11. Add Vitest + Testing Library tests for validation, auth state, guards, and profile access.

## 4. Security concerns found

| Concern | Resolution |
|---|---|
| Protected routes were public. | `ProtectedRoute` + Supabase session. RLS remains the real data boundary. |
| Fake identity shown as if real. | Removed; only session/profile data is rendered, with fallbacks. |
| `VITE_SUPABASE_ANON_KEY` hint but no key validation. | Central config validates both values and shows a setup screen instead of crashing. |
| No RLS: no database existed yet. | RLS enabled on both tables; explicit policies and grants; no broad `authenticated` policies. |
| `.gitignore` did not cover `.env.*`. | Added `.env.*` with `!.env.example`. |
| Risk of service-role key in frontend. | Only the publishable/anon key is read; docs and code comments state the rule. |
| Open redirect risk after login. | Redirect values are parsed against the current origin. |
| Token handling. | supabase-js owns PKCE storage/refresh; the app never reads or stores tokens. |

## 5. Missing configuration

- Supabase project URL and publishable key.
- Auth Site URL and redirect allow-list (`/auth/callback`, `/reset-password`).
- Email confirmation choice and recovery email template.
- Applied migration and RLS verification.
- No `.env.local` existed; nothing was overwritten.

## 6. Migration strategy

- One forward migration, wrapped in a transaction, idempotent (`if not exists`, `create or replace`, `drop ... if exists` for policies/triggers).
- Order: tables → `updated_at` triggers → signup bootstrap function/trigger → grants → RLS policies.
- `handle_new_user()` is `SECURITY DEFINER`, owned by the migration role, with `set search_path = ''` and no API execute grant. RLS is **not** forced on the tables so this owner-run trigger can insert the first profile row; browser roles are still fully subject to RLS.
- No DELETE policy or grant: rows disappear through `auth.users` cascade.
- Rollback file: `database/rollbacks/20251105090000_phase_02_profiles_and_preferences_down.sql`.
- Verification: `database/tests/rls_phase_02.sql` (manual, transaction + impersonation).
- Apply through the Supabase SQL Editor or copy into `supabase/migrations/` for CLI users.

## 7. Environment at audit

- Windows, Node v24.13.0, npm 11.6.2.
- The working copy already contained the archive contents (no separate extraction needed).
- Only the Phase 01 `vite.config.ts` dev-server hardening from earlier work was present.
