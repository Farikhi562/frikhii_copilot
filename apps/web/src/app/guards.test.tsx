import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useSearchParams } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ProtectedRoute, PublicOnlyRoute } from "./guards";

type Status = "loading" | "authenticated" | "unauthenticated" | "unconfigured";

const auth = vi.hoisted(() => ({ status: "unauthenticated" as Status }));

vi.mock("../features/auth/context", () => ({
  useAuth: () => ({
    status: auth.status,
    configurationError: null,
    session: null,
    user: null,
    signOut: vi.fn(),
  }),
}));

function LoginProbe() {
  const [params] = useSearchParams();
  return <p>login redirect={params.get("redirect")}</p>;
}

function renderProtected(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<p>app home</p>} />
          <Route path="/app/settings" element={<p>settings secret</p>} />
        </Route>
        <Route path="/login" element={<LoginProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderPublicOnly(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<p>login form</p>} />
        </Route>
        <Route path="/app/settings" element={<p>settings secret</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("route guards", () => {
  it("shows a loader instead of redirecting while the session is loading", () => {
    auth.status = "loading";
    renderProtected("/app/settings");

    expect(screen.getByText("Checking your session…")).toBeInTheDocument();
    expect(screen.queryByText("settings secret")).not.toBeInTheDocument();
    expect(screen.queryByText(/login redirect/)).not.toBeInTheDocument();
  });

  it("redirects unauthenticated users and preserves the destination", () => {
    auth.status = "unauthenticated";
    renderProtected("/app/settings?tab=profile");

    expect(screen.getByText("login redirect=/app/settings?tab=profile")).toBeInTheDocument();
    expect(screen.queryByText("settings secret")).not.toBeInTheDocument();
  });

  it("renders protected content for authenticated users", () => {
    auth.status = "authenticated";
    renderProtected("/app/settings");

    expect(screen.getByText("settings secret")).toBeInTheDocument();
  });

  it("sends authenticated users away from login to the intended page", () => {
    auth.status = "authenticated";
    renderPublicOnly("/login?redirect=%2Fapp%2Fsettings");

    expect(screen.getByText("settings secret")).toBeInTheDocument();
    expect(screen.queryByText("login form")).not.toBeInTheDocument();
  });

  it("allows unauthenticated users to see login", () => {
    auth.status = "unauthenticated";
    renderPublicOnly("/login");

    expect(screen.getByText("login form")).toBeInTheDocument();
  });
});
