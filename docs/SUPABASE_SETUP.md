# Supabase Setup (Phase 02 + 03)

This is the exact sequence to connect your own Supabase project. Phase 02 connects
authentication/profiles/preferences; Phase 03 adds the learning domain. Nothing in this
repository has been run against a live Supabase instance yet, so treat every step as
unverified until you complete it.

> **Never put a secret/service-role key in the frontend.** The browser only uses the
> publishable (or legacy anon) key. Server secrets belong in the Go Core API and Python AI
> Engine environments, never in a `VITE_*` variable.

---

## 1. Create a Supabase project

1. Sign in at <https://supabase.com/dashboard>.
2. **New project** → choose organization, name (e.g. `frikhii-copilot`), strong database
   password, region closest to you.
3. Wait for provisioning.

## 2. Get the project URL

**Project Settings → Data API** (older dashboards: Settings → API):

```text
https://<project-ref>.supabase.co
```

Copy it. This is `VITE_SUPABASE_URL`.

## 3. Get the publishable key

**Project Settings → API Keys**.

- Copy the **publishable key** (`sb_publishable_...`) → `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Do **not** copy the secret key (`sb_secret_...`) or the service-role JWT.
- Legacy projects may only show an **anon** key. Put that value under
  `VITE_SUPABASE_PUBLISHABLE_KEY`; the web client no longer reads a separate
  `VITE_SUPABASE_ANON_KEY` name. Never put a `sb_secret_` value there.

## 4. Configure environment variables

Create `.env.local` **at the repository root** (Vite is configured with
`envDir: "../../"`, so one env file serves the workspace):

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Rules:

- `.env.local` is git-ignored. Never commit it.
- Restart `npm run dev` after changing env values.
- Vite only exposes `VITE_*` variables; never name a secret `VITE_*`.

If either value is missing, the app shows a setup screen instead of crashing, and auth
pages show "Authentication is not connected yet."

## 5. Configure authentication URLs

**Authentication → URL Configuration**:

| Setting | Development | Production |
|---|---|---|
| Site URL | `http://localhost:5173` | your deployed origin, e.g. `https://frikhii.example.com` |
| Redirect URLs | `http://localhost:5173/auth/callback` and `http://localhost:5173/reset-password` | `https://<domain>/auth/callback` and `https://<domain>/reset-password` |

Supabase rejects redirects that are not allow-listed, so add every origin you use
(including `http://127.0.0.1:5173` if you open that instead of `localhost`).

The app sets these redirects in code:

- signup confirmation → `/auth/callback`
- password reset → `/reset-password`

## 6. Configure email confirmation

**Authentication → Sign In / Providers → Email**:

- **Confirm email ON (recommended):** registration returns no session; the app shows
  "Check your email" and offers a resend. The user confirms before signing in.
- **Confirm email OFF:** registration signs the user in immediately. Fine for a single
  personal tester, but leave it ON if real users will join.

## 7. Configure password recovery email links

The app supports both Supabase link styles:

1. **Default `{{ .ConfirmationURL }}`** — works with the PKCE `?code=` exchange when the
   link is opened in the same browser that requested it.
2. **Token-hash links (recommended)** — work across browsers and devices.

To use token-hash links, edit the templates under **Authentication → Emails**:

**Confirm signup**

```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email">
  Confirm your email
</a>
```

**Reset password**

```html
<a href="{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery">
  Reset your password
</a>
```

Keep the email subject lines. `{{ .SiteURL }}` is the Site URL from step 5, so set it
correctly before sending real email.

> Built-in Supabase email is rate-limited and intended for testing. Configure custom
> SMTP before inviting real users.

## 8. Apply the database migrations

**Option A — SQL Editor (simplest):**

1. Open `database/migrations/20251105090000_phase_02_profiles_and_preferences.sql`.
2. Supabase Dashboard → **SQL Editor** → New query → paste the whole file → **Run**.
3. Open `database/migrations/20251105091000_phase_03_course_architect.sql` and run it.
4. Both scripts are additive and wrapped in transactions; re-running is safe.

**Option B — Supabase CLI:**

```bash
npx supabase init                      # once, creates supabase/
mkdir -p supabase/migrations
cp database/migrations/*.sql supabase/migrations/
npx supabase link --project-ref <project-ref>
npx supabase db push
```

The canonical migrations stay in `database/migrations/`; copy them for the CLI.

## 9. Verify RLS

1. **Table Editor** → confirm the Phase 02 tables (`public.profiles`,
   `public.user_preferences`) and the Phase 03 learning tables exist; all show RLS enabled.
2. Run `database/tests/rls_phase_02.sql` in the SQL Editor after replacing `USER_A` /
   `USER_B` with two real user ids and reading the expected results in the file.
3. Complete a goal and course for those users, then run `database/tests/rls_phase_03.sql`
   the same way.
4. The scripts roll themselves back; they do not change data.

Expected highlights:

- user A sees only their own profile/preferences and learning rows;
- updating/deleting user B's rows affects nothing or is rejected;
- `anon` has no table privileges;
- `authenticated` has no access at all to `diagnostic_answer_keys`;
- no browser role can insert, update or delete learning data; the Go Core API is the writer.

## 10. Run the frontend

```bash
npm install
npm run dev
```

Open <http://localhost:5173>.

## 11. Register a test account

1. Open `/register`.
2. Enter a name, email, and a password with 8+ characters including a letter and number.
3. If confirmation is ON, open the email link, then sign in.
4. If confirmation is OFF, you land on `/app` immediately.

## 12. Verify the profile was created

Supabase Dashboard → **Table Editor → profiles**:

- one row per auth user;
- `full_name` matches the registration name;
- `id` equals the `auth.users` id.

Also check **user_preferences**: one row with `learning_language = id-ID` and
`preferred_theme = system`.

If either row is missing, sign in once — the app heals a missing profile from auth
metadata through an RLS-protected insert. If that also fails, check the trigger and RLS
in step 9.

## 13. Verify logout and login

- Account menu → **Sign out** (or Settings → Account → Sign out).
- You should land on `/login`; opening `/app` redirects back to `/login` with
  `?redirect=/app`.
- Sign in again; you return to the page you originally requested.

## 14. Verify settings persistence

- `/app/settings` → edit your name → **Save changes** → refresh: the new name remains.
- Change learning language/theme → save → refresh: values remain.
- Change the name, sign out, sign in: the name persists.
- Open `/app/settings` while signed out: you are redirected to `/login`.

## 15. Local Supabase (optional)

Requires Docker:

```bash
npx supabase init
mkdir -p supabase/migrations
cp database/migrations/*.sql supabase/migrations/
npx supabase start
npx supabase db reset
```

`supabase start` prints an API URL (`http://127.0.0.1:54321`) and an anon key. Put those
in `.env.local`. In `supabase/config.toml`, set `site_url = "http://localhost:5173"` and
add the two redirect URLs under `[auth]`. Local email is captured by Inbucket/Mailpit
(the URL is printed by `supabase start`).

## 16. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "Authentication is not connected yet" | `.env.local` missing, wrong location, or dev server not restarted. |
| `Invalid login credentials` | Wrong password, or account not confirmed. Check the confirmation state in Dashboard → Authentication → Users. |
| Reset link opens an error page | Link expired/used; request a new one. If using default links, open in the same browser; switch to token-hash templates to avoid this. |
| Signup succeeds but no email | Rate limit or spam filter; wait, then use Resend. Configure custom SMTP for production. |
| Redirects to `localhost` in production | Update Site URL/Redirect URLs in Supabase and redeploy. |
| `431 Request Header Fields Too Large` in dev | Unrelated to Supabase: clear `localhost` cookies. The dev server also raises Node's header limit to 64 KB as a guard. |
| `new row violates row-level security policy` on signup | Trigger/RLS mismatch; re-apply the migration and check that RLS is enabled but not forced. |
| Profile row missing after signup | Inspect `auth.users` trigger `on_auth_user_created`; sign in again to trigger client-side recovery. |

## 17. What you must still do manually

- [ ] Create the Supabase project.
- [ ] Put the URL/publishable key in `.env.local`.
- [ ] Set Site URL and redirect URLs.
- [ ] Decide on email confirmation and template style.
- [ ] Run the migration.
- [ ] Run the RLS verification with two users.
- [ ] Register a test account and confirm the profile rows.
- [ ] Test sign-out/sign-in and settings persistence.
- [ ] (Production) configure custom SMTP and redeploy with production env vars.
