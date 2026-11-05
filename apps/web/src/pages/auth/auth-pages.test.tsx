import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Login from "./Login";
import Register from "./Register";
import ForgotPassword from "./ForgotPassword";
import ResetPassword from "./ResetPassword";

const auth = vi.hoisted(() => ({
  status: "unconfigured" as string,
  configurationError: "Supabase is not configured for this test." as string | null,
}));

vi.mock("../../features/auth/context", () => ({
  useAuth: () => ({
    status: auth.status,
    configurationError: auth.configurationError,
    session: null,
    user: null,
    signOut: vi.fn(),
  }),
}));

function renderPage(page: ReactNode) {
  return render(<MemoryRouter>{page}</MemoryRouter>);
}

describe("auth pages without Supabase configuration", () => {
  beforeEach(() => {
    auth.status = "unconfigured";
    auth.configurationError = "Supabase is not configured for this test.";
  });

  it("explains the missing configuration instead of rendering a broken form", () => {
    renderPage(<Login />);
    expect(screen.getByRole("heading", { name: "Welcome back." })).toBeInTheDocument();
    expect(screen.getByText("Authentication is not connected yet")).toBeInTheDocument();
  });

  it("shows the same setup notice on register", () => {
    renderPage(<Register />);
    expect(screen.getByRole("heading", { name: "Create your account." })).toBeInTheDocument();
    expect(screen.getByText("Authentication is not connected yet")).toBeInTheDocument();
  });

  it("shows the setup notice on forgot password", () => {
    renderPage(<ForgotPassword />);
    expect(screen.getByRole("heading", { name: "Reset your password." })).toBeInTheDocument();
    expect(screen.getByText("Authentication is not connected yet")).toBeInTheDocument();
  });

  it("shows the setup notice on the reset page", () => {
    renderPage(<ResetPassword />);
    expect(screen.getByText("Authentication is not connected yet")).toBeInTheDocument();
  });
});

describe("reset page without a recovery link", () => {
  beforeEach(() => {
    auth.status = "unauthenticated";
    auth.configurationError = null;
  });

  it("treats a visit without a session or token as an invalid link", async () => {
    renderPage(<ResetPassword />);

    expect(
      await screen.findByText(
        "This page needs a valid password reset link. Request a new link to continue.",
      ),
    ).toBeInTheDocument();
  });
});
