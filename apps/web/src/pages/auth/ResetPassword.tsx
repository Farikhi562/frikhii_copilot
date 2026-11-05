import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Alert, Spinner } from "../../components/ui/Feedback";
import { Field } from "../../components/ui/Field";
import {
  messageForError,
  updatePassword,
} from "../../features/auth/api/auth";
import { completeAuthRedirect } from "../../features/auth/api/redirect";
import { AuthConfigNotice, FormError } from "../../features/auth/components/AuthFeedback";
import { AuthShell } from "../../features/auth/components/AuthShell";
import { useAuth } from "../../features/auth/context";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "../../features/auth/schemas/auth";

type Phase = "working" | "form" | "invalid" | "success";

export default function ResetPassword() {
  const { status, user, configurationError } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryString = searchParams.toString();
  const started = useRef(false);

  const [phase, setPhase] = useState<Phase>("working");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unconfigured" || started.current) return;

    const params = new URLSearchParams(queryString);
    const hasToken = ["code", "token_hash", "error", "error_description"].some((key) =>
      params.has(key),
    );

    if (!hasToken) {
      if (status === "loading") return;
      started.current = true;
      if (status === "authenticated") {
        setPhase("form");
      } else {
        setLinkError(
          "This page needs a valid password reset link. Request a new link to continue.",
        );
        setPhase("invalid");
      }
      return;
    }

    started.current = true;
    setPhase("working");
    completeAuthRedirect(params)
      .then(() => setPhase("form"))
      .catch((error: unknown) => {
        setLinkError(messageForError(error));
        setPhase("invalid");
      });
  }, [queryString, status]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await updatePassword(values.password);
      setPhase("success");
    } catch (error) {
      setServerError(messageForError(error));
    }
  });

  if (status === "unconfigured") {
    return (
      <AuthShell
        title="Connect Supabase first."
        description="Password recovery needs a configured Supabase project."
        footer={
          <Link to="/login" className="font-medium text-ink underline underline-offset-4">
            Back to sign in
          </Link>
        }
      >
        <AuthConfigNotice message={configurationError} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password."
      description="Use a password you have not used before."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/login" className="font-medium text-ink underline underline-offset-4">
            Back to sign in
          </Link>
          <Link to="/" className="text-ink/55 hover:underline">
            Back to home
          </Link>
        </div>
      }
    >
      {phase === "working" && (
        <div className="flex items-center gap-3 text-ink/65">
          <Spinner />
          <p className="text-sm">Verifying your reset link…</p>
        </div>
      )}

      {phase === "invalid" && (
        <div className="space-y-4">
          <Alert variant="error" title="Link invalid or expired">
            {linkError ?? "This reset link can no longer be used."}
          </Alert>
          <Button className="w-full" onClick={() => navigate("/forgot-password")}>
            Request a new reset link
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => navigate("/login")}>
            Back to sign in
          </Button>
        </div>
      )}

      {phase === "success" && (
        <div className="space-y-4">
          <Alert variant="success" title="Password updated">
            Your password has been changed. You can keep using this session or sign in again on
            your other devices.
          </Alert>
          <Button className="w-full" onClick={() => navigate("/app", { replace: true })}>
            Continue to the app
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => navigate("/login")}>
            Sign in with the new password
          </Button>
        </div>
      )}

      {phase === "form" && (
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          {user?.email && (
            <p className="text-sm text-ink/60">
              Updating the password for <span className="font-medium text-ink">{user.email}</span>.
            </p>
          )}
          <FormError message={serverError} />
          <div className="space-y-1.5">
            <Field
              label="New password"
              type="password"
              autoComplete="new-password"
              error={errors.password?.message}
              {...register("password")}
            />
            <p className="text-xs text-ink/55">
              At least 8 characters, including a letter and a number.
            </p>
          </div>
          <Field
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />
          <Button type="submit" loading={isSubmitting} className="w-full">
            {isSubmitting ? "Updating password…" : "Update password"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
