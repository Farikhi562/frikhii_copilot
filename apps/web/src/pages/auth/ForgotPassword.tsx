import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Feedback";
import { Field } from "../../components/ui/Field";
import { messageForError, requestPasswordReset } from "../../features/auth/api/auth";
import {
  AuthConfigNotice,
  FormError,
} from "../../features/auth/components/AuthFeedback";
import { AuthShell } from "../../features/auth/components/AuthShell";
import { useAuth } from "../../features/auth/context";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "../../features/auth/schemas/auth";

export default function ForgotPassword() {
  const { status, configurationError } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await requestPasswordReset(values.email);
      setSentTo(values.email);
    } catch (error) {
      setServerError(messageForError(error));
    }
  });

  return (
    <AuthShell
      title="Reset your password."
      description="We will email you a secure link to choose a new password."
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
      {status === "unconfigured" ? (
        <AuthConfigNotice message={configurationError} />
      ) : sentTo ? (
        <div className="space-y-4">
          <Alert variant="success" title="Check your email">
            If an account exists for <span className="font-medium">{sentTo}</span>, a reset link is
            on its way. The link expires after a short time and works once.
          </Alert>
          <p className="text-sm text-ink/65">
            Open the link in this browser. If it does not arrive, check spam or request another
            link in a minute.
          </p>
          <Button variant="ghost" className="w-full" onClick={() => setSentTo(null)}>
            Use a different email
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <FormError message={serverError} />
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            {...register("email")}
          />
          <Button type="submit" loading={isSubmitting} className="w-full">
            {isSubmitting ? "Sending link…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
