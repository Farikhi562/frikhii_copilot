import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Feedback";
import { Field } from "../../components/ui/Field";
import {
  messageForError,
  resendConfirmation,
  signUpWithEmail,
} from "../../features/auth/api/auth";
import {
  AuthConfigNotice,
  FormError,
} from "../../features/auth/components/AuthFeedback";
import { AuthShell } from "../../features/auth/components/AuthShell";
import { useAuth } from "../../features/auth/context";
import { registerSchema, type RegisterInput } from "../../features/auth/schemas/auth";
import { safeRedirectTarget } from "../../lib/redirects";

export default function Register() {
  const { status, configurationError } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = safeRedirectTarget(searchParams.get("redirect"));

  const [serverError, setServerError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const result = await signUpWithEmail({
        fullName: values.fullName,
        email: values.email,
        password: values.password,
      });

      if (result.needsEmailConfirmation) {
        setPendingEmail(result.email);
      } else {
        navigate(redirectTo, { replace: true });
      }
    } catch (error) {
      setServerError(messageForError(error));
    }
  });

  async function handleResend() {
    if (!pendingEmail) return;
    setResendError(null);
    setResendNotice(null);
    setResending(true);
    try {
      await resendConfirmation(pendingEmail);
      setResendNotice("Confirmation email sent again. Check your inbox and spam folder.");
    } catch (error) {
      setResendError(messageForError(error));
    } finally {
      setResending(false);
    }
  }

  if (pendingEmail) {
    return (
      <AuthShell
        title="Check your email."
        description="Confirm your address to activate your account."
        footer={
          <Link to="/login" className="font-medium text-ink underline underline-offset-4">
            Back to sign in
          </Link>
        }
      >
        <div className="space-y-4">
          <Alert variant="success" title="Confirmation link sent">
            We sent a confirmation link to <span className="font-medium">{pendingEmail}</span>. Open
            it in this browser, then come back to sign in.
          </Alert>
          <p className="text-sm text-ink/65">
            No email yet? Wait a minute, check your spam folder, then resend.
          </p>
          <FormError message={resendError} />
          {resendNotice && (
            <Alert variant="info" title="Sent">
              {resendNotice}
            </Alert>
          )}
          <Button variant="ghost" loading={resending} onClick={handleResend} className="w-full">
            Resend confirmation email
          </Button>
          <Button variant="primary" onClick={() => navigate("/login")} className="w-full">
            Go to sign in
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account."
      description="One account for your goals, courses and progress."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>
            Already have an account?{" "}
            <Link
              to={`/login${redirectTo !== "/app" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
              className="font-medium text-ink underline underline-offset-4"
            >
              Sign in
            </Link>
          </span>
          <Link to="/" className="text-ink/55 hover:underline">
            Back to home
          </Link>
        </div>
      }
    >
      {status === "unconfigured" ? (
        <AuthConfigNotice message={configurationError} />
      ) : (
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <FormError message={serverError} />
          <Field
            label="Full name"
            autoComplete="name"
            placeholder="Your name"
            error={errors.fullName?.message}
            {...register("fullName")}
          />
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            {...register("email")}
          />
          <div className="space-y-1.5">
            <Field
              label="Password"
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
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />
          <Button type="submit" loading={isSubmitting} className="w-full">
            {isSubmitting ? "Creating account…" : "Create account"}
          </Button>
          <p className="text-xs text-ink/55">
            By creating an account you agree to the planned privacy policy and terms. This pilot
            stores only your name, email and learning preferences.
          </p>
        </form>
      )}
    </AuthShell>
  );
}
