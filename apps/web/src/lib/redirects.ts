/**
 * Returns an in-app path from a `redirect` query value, or the fallback.
 * Prevents open redirects such as `//evil.example` or `https://evil.example`.
 */
export function safeRedirectTarget(value: string | null | undefined, fallback = "/app"): string {
  if (!value) return fallback;

  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    if (!url.pathname.startsWith("/")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
