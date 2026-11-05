import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Alert, ErrorState, Skeleton } from "../../components/ui/Feedback";
import { Card, SectionHeader } from "../../components/ui/Layout";
import { toast } from "../../components/ui/Toast";
import { messageForError, requestPasswordReset } from "../../features/auth/api/auth";
import { useAuth } from "../../features/auth/context";
import { AppearanceForm, LearningPreferencesForm } from "../../features/profile/components/PreferencesForms";
import { ProfileForm } from "../../features/profile/components/ProfileForm";
import { usePreferences, useProfile } from "../../features/profile/hooks/useProfile";
import { errorMessage } from "../../lib/errors";

export default function Settings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const profileQuery = useProfile(user);
  // Wait for the profile before creating/reading preferences: a recovered profile
  // must exist before the user_preferences FK can accept its row.
  const preferencesQuery = usePreferences(profileQuery.data ? (user?.id ?? null) : null);

  const [signingOut, setSigningOut] = useState(false);
  const [resetState, setResetState] = useState<"idle" | "sending" | "sent">("idle");
  const [resetError, setResetError] = useState<string | null>(null);

  if (!user) return null;

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (error) {
      toast(`Could not sign out. ${messageForError(error)}`);
    } finally {
      setSigningOut(false);
    }
  }

  async function handleSendResetEmail() {
    if (!user?.email) return;
    setResetError(null);
    setResetState("sending");
    try {
      await requestPasswordReset(user.email);
      setResetState("sent");
    } catch (error) {
      setResetState("idle");
      setResetError(errorMessage(error));
    }
  }

  const loadingCard = (
    <Card className="space-y-4">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
    </Card>
  );

  return (
    <div className="max-w-2xl space-y-8">
      <SectionHeader
        title="Settings"
        description="Your profile, learning preferences and account. Everything here is saved to Supabase."
      />

      {profileQuery.isLoading ? (
        loadingCard
      ) : profileQuery.isError ? (
        <ErrorState
          title="Could not load your profile"
          hint={errorMessage(profileQuery.error)}
          action={
            <Button variant="ghost" onClick={() => void profileQuery.refetch()}>
              Try again
            </Button>
          }
        />
      ) : profileQuery.data ? (
        <ProfileForm profile={profileQuery.data} user={user} />
      ) : null}

      {preferencesQuery.isLoading ? (
        loadingCard
      ) : preferencesQuery.isError ? (
        <ErrorState
          title="Could not load your preferences"
          hint={errorMessage(preferencesQuery.error)}
          action={
            <Button variant="ghost" onClick={() => void preferencesQuery.refetch()}>
              Try again
            </Button>
          }
        />
      ) : preferencesQuery.data ? (
        <>
          <LearningPreferencesForm preferences={preferencesQuery.data} userId={user.id} />
          <AppearanceForm preferences={preferencesQuery.data} userId={user.id} />
        </>
      ) : null}

      <Card className="space-y-5">
        <div>
          <h2 className="font-semibold">Account</h2>
          <p className="mt-1 text-sm text-ink/65">
            Signed in as <span className="font-medium text-ink">{user.email}</span>.
          </p>
        </div>

        {resetState === "sent" && (
          <Alert variant="success" title="Reset email sent">
            Check <span className="font-medium">{user.email}</span> for a link to choose a new
            password.
          </Alert>
        )}
        {resetError && (
          <Alert variant="error" title="Could not send reset email">
            {resetError}
          </Alert>
        )}

        <div className="flex flex-wrap gap-3">
          <Button
            variant="ghost"
            loading={resetState === "sending"}
            onClick={() => void handleSendResetEmail()}
          >
            Send password reset email
          </Button>
          <Link
            to="/reset-password"
            className="inline-flex items-center justify-center rounded-full border border-ink/25 px-5 py-2.5 font-medium transition hover:bg-ink/5"
          >
            Change password now
          </Link>
        </div>

        <div className="border-t border-ink/10 pt-5">
          <p className="text-sm text-ink/65">
            Signing out removes this browser&apos;s access immediately. Protected pages send you
            back to sign in.
          </p>
          <Button
            variant="primary"
            className="mt-3"
            loading={signingOut}
            onClick={() => void handleSignOut()}
          >
            Sign out
          </Button>
        </div>
      </Card>
    </div>
  );
}
