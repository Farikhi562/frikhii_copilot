import { Navigate, Outlet, useLocation, useSearchParams } from "react-router-dom";
import { ConfigMissingPage, FullPageLoader } from "../components/system/RouteStates";
import { useAuth } from "../features/auth/context";
import { safeRedirectTarget } from "../lib/redirects";

/**
 * Blocks the app shell until the persisted session has been resolved, so a
 * signed-in user is never bounced to /login during initial loading.
 */
export function ProtectedRoute() {
  const { status, configurationError } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <FullPageLoader label="Checking your session…" />;
  }
  if (status === "unconfigured") {
    return <ConfigMissingPage message={configurationError} />;
  }
  if (status === "unauthenticated") {
    const target = `${location.pathname}${location.search}${location.hash}`;
    const redirect = encodeURIComponent(target);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  return <Outlet />;
}

/** Keeps signed-in users away from /login and /register. */
export function PublicOnlyRoute() {
  const { status } = useAuth();
  const [searchParams] = useSearchParams();

  if (status === "loading") {
    return <FullPageLoader label="Loading…" />;
  }
  if (status === "authenticated") {
    return <Navigate to={safeRedirectTarget(searchParams.get("redirect"))} replace />;
  }

  return <Outlet />;
}
