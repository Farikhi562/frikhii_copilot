import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Spinner } from "../../components/ui/Feedback";
import { messageForError } from "../../features/auth/api/auth";
import { completeAuthRedirect } from "../../features/auth/api/redirect";
import { AuthConfigNotice } from "../../features/auth/components/AuthFeedback";
import { AuthShell } from "../../features/auth/components/AuthShell";
import { useAuth } from "../../features/auth/context";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryString = searchParams.toString();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const { status, configurationError } = useAuth();

  useEffect(() => {
    if (status === "unconfigured" || started.current) return;
    started.current = true;

    const params = new URLSearchParams(queryString);
    completeAuthRedirect(params)
      .then(({ next }) => navigate(next, { replace: true }))
      .catch((caught: unknown) => setError(messageForError(caught)));
  }, [navigate, queryString, status]);

  if (status === "unconfigured") {
    return (
      <AuthShell
        title="Connect Supabase first."
        description="This link needs a configured Supabase project."
        footer={<Link to="/login">Back to sign in</Link>}
      >
        <AuthConfigNotice message={configurationError} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={error ? "We could not verify this link." : "Confirming your link…"}
      description={
        error
          ? "The link may have expired or already been used."
          : "This only takes a moment."
      }
      footer={
        <Link to="/login" className="font-medium text-ink underline underline-offset-4">
          Back to sign in
        </Link>
      }
    >
      {error ? (
        <div className="space-y-4">
          <Alert variant="error" title="Verification failed">
            {error}
          </Alert>
          <Link
            to="/forgot-password"
            className="block rounded-full bg-ink px-5 py-2.5 text-center font-medium text-paper"
          >
            Request a new link
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-ink/65">
          <Spinner />
          <p className="text-sm">Verifying your secure link…</p>
        </div>
      )}
    </AuthShell>
  );
}
