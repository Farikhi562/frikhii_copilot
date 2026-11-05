import type { AuthError, EmailOtpType } from "@supabase/supabase-js";
import { requireSupabase } from "../../../lib/supabase";

export class AuthRequestError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "AuthRequestError";
    this.code = code;
  }
}

export function messageForError(error: unknown): string {
  if (error instanceof AuthRequestError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Try again.";
}

/** Maps Supabase auth errors to copy that is safe and useful in the UI. */
export function authErrorMessage(error: AuthError): string {
  const code = error.code ?? "";
  const message = error.message ?? "";

  if (code === "invalid_credentials" || /invalid login credentials/i.test(message)) {
    return "The email or password is incorrect.";
  }
  if (code === "email_not_confirmed" || /email not confirmed/i.test(message)) {
    return "Confirm your email address before signing in. Check your inbox for the confirmation link.";
  }
  if (code === "user_already_exists" || /already registered/i.test(message)) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (code === "weak_password") {
    return "Choose a stronger password with at least 8 characters, a letter and a number.";
  }
  if (code === "same_password") {
    return "Choose a password you have not used for this account.";
  }
  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    /rate limit|too many requests/i.test(message)
  ) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (code === "otp_expired" || /expired/i.test(message)) {
    return "This link has expired. Request a new one.";
  }
  if (/database error saving new user/i.test(message)) {
    return "Your account was created but the profile could not be set up. Try signing in; if this continues, contact support.";
  }
  return message || "Authentication failed. Try again.";
}

const appOrigin = () => window.location.origin;

export const authCallbackUrl = () => `${appOrigin()}/auth/callback`;
export const passwordResetUrl = () => `${appOrigin()}/reset-password`;

export type SignUpInput = {
  fullName: string;
  email: string;
  password: string;
};

export type SignUpResult = {
  needsEmailConfirmation: boolean;
  email: string;
};

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await requireSupabase().auth.signInWithPassword({ email, password });
  if (error) throw new AuthRequestError(authErrorMessage(error), error.code);
}

export async function signUpWithEmail(input: SignUpInput): Promise<SignUpResult> {
  const { data, error } = await requireSupabase().auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { full_name: input.fullName },
      emailRedirectTo: authCallbackUrl(),
    },
  });

  if (error) throw new AuthRequestError(authErrorMessage(error), error.code);

  // With email confirmation enabled Supabase returns a user with no identities
  // for an address that already exists, instead of an error. Treat it as a duplicate.
  if (data.user && data.user.identities?.length === 0) {
    throw new AuthRequestError(
      "An account with this email already exists. Try signing in instead.",
      "user_already_exists",
    );
  }

  return { needsEmailConfirmation: !data.session, email: input.email };
}

/**
 * Signs out globally. If the network/global call fails, the local session is
 * cleared anyway so the browser does not keep a usable session around.
 */
export async function signOutCurrentSession(): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  if (!error) return;

  const { error: localError } = await client.auth.signOut({ scope: "local" });
  if (localError) {
    throw new AuthRequestError(authErrorMessage(localError), localError.code);
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email, {
    redirectTo: passwordResetUrl(),
  });
  if (error) throw new AuthRequestError(authErrorMessage(error), error.code);
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await requireSupabase().auth.updateUser({ password });
  if (error) throw new AuthRequestError(authErrorMessage(error), error.code);
}

export async function resendConfirmation(email: string): Promise<void> {
  const { error } = await requireSupabase().auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: authCallbackUrl() },
  });
  if (error) throw new AuthRequestError(authErrorMessage(error), error.code);
}

const OTP_TYPES = ["signup", "recovery", "invite", "email_change", "email"] as const;

export function isEmailOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (OTP_TYPES as readonly string[]).includes(value);
}

export async function exchangeCodeForSession(code: string): Promise<void> {
  const { error } = await requireSupabase().auth.exchangeCodeForSession(code);
  if (error) throw new AuthRequestError(authErrorMessage(error), error.code);
}

export async function verifyOtpToken(tokenHash: string, type: EmailOtpType): Promise<void> {
  const { error } = await requireSupabase().auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });
  if (error) throw new AuthRequestError(authErrorMessage(error), error.code);
}
