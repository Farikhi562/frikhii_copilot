import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { messageForError, signInWithEmail } from "../../features/auth/api/auth";
import {
  AuthConfigNotice,
  FormError,
  FormNotice,
} from "../../features/auth/components/AuthFeedback";
import { AuthShell } from "../../features/auth/components/AuthShell";
import { useAuth } from "../../features/auth/context";
import { loginSchema, type LoginInput } from "../../features/auth/schemas/auth";
import { safeRedirectTarget } from "../../lib/redirects";

export default function Login() {
  const { status, configurationError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const redirectTo = safeRedirectTarget(searchParams.get("redirect"));

  const stateNotice =
    (location.state as { message?: string } | null)?.message ?? null;
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await signInWithEmail(values.email, values.password);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setServerError(messageForError(error));
    }
  });

  return (
    <AuthShell
      title="Welcome back."
      description="Sign in to continue your learning journey."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>
            New to FRIKHII?{" "}
            <Link
              to={`/register${redirectTo !== "/app" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
              className="font-medium text-ink underline underline-offset-4"
            >
              Create an account
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
          {stateNotice && <FormNotice message={stateNotice} />}
          <FormError message={serverError} />
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
              autoComplete="current-password"
              error={errors.password?.message}
              {...register("password")}
            />
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-ink/65 hover:underline">
                Forgot password?
              </Link>
            </div>
          </div>
          <Button type="submit" loading={isSubmitting} className="w-full">
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
