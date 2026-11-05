import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "../features/auth/AuthProvider";
import { AppRoutes } from "./router";

function renderRoute(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

// These tests run with no VITE_SUPABASE_* variables set, which is also the
// "developer forgot to configure" path users see on a fresh checkout.
describe("router without Supabase configuration", () => {
  it("still renders the public landing page", async () => {
    renderRoute("/");
    expect(await screen.findByText("Learn with intent.")).toBeInTheDocument();
  });

  it("lazy-loads login and explains the missing configuration", async () => {
    renderRoute("/login");
    expect(
      await screen.findByRole("heading", { name: "Welcome back." }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Authentication is not connected yet")).toBeInTheDocument();
  });

  it("blocks the app shell with a configuration screen", async () => {
    renderRoute("/app");
    expect(await screen.findByText("Supabase needs to be connected.")).toBeInTheDocument();
  });

  it("renders the 404 placeholder", async () => {
    renderRoute("/nope");
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });
});
