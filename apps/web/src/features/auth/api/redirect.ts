import {
  exchangeCodeForSession,
  isEmailOtpType,
  verifyOtpToken,
  AuthRequestError,
} from "./auth";

export type CompletedRedirect = {
  /** Where the user should land after the link is verified. */
  next: string;
};

/**
 * Completes an auth redirect produced by Supabase.
 *
 * Supports both link styles:
 * - `?code=...` (PKCE code exchange, same browser that started the flow)
 * - `?token_hash=...&type=...` (email templates using `.TokenHash`, works across browsers)
 *
 * Tokens are verified by supabase-js; this app never stores or forwards them.
 */
export async function completeAuthRedirect(params: URLSearchParams): Promise<CompletedRedirect> {
  const errorDescription = params.get("error_description") ?? params.get("error");
  if (errorDescription) {
    throw new AuthRequestError(errorDescription.replace(/\+/g, " "));
  }

  const code = params.get("code");
  if (code) {
    await exchangeCodeForSession(code);
    return { next: "/app" };
  }

  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  if (tokenHash && isEmailOtpType(type)) {
    await verifyOtpToken(tokenHash, type);
    return { next: type === "recovery" ? "/reset-password" : "/app" };
  }

  throw new AuthRequestError(
    "This link is missing its authentication token. Request a new link and try again.",
  );
}
