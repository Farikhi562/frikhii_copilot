import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./AuthProvider";
import { useAuth } from "./context";

type Listener = (event: string, session: unknown) => void;

const mocks = vi.hoisted(() => ({
  listeners: [] as Listener[],
  unsubscribe: vi.fn(),
  getSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("../../lib/supabase", () => {
  const client = {
    auth: {
      onAuthStateChange: (listener: Listener) => {
        mocks.listeners.push(listener);
        return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
      },
      getSession: mocks.getSession,
      signOut: mocks.signOut,
    },
  };

  return {
    supabase: client,
    requireSupabase: () => client,
    supabaseConfigError: null,
  };
});

const session = (id: string) => ({ user: { id }, access_token: "not-used-in-ui" });

function Probe() {
  const { status, user } = useAuth();
  return (
    <p data-testid="state">
      {status}:{user?.id ?? "none"}
    </p>
  );
}

function SignOutProbe() {
  const { signOut } = useAuth();
  return (
    <button type="button" onClick={() => void signOut()}>
      Sign out
    </button>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    mocks.listeners.length = 0;
  });

  it("starts in loading and resolves the persisted session", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: session("user-1") }, error: null });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByTestId("state")).toHaveTextContent("loading:none");
    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("authenticated:user-1"),
    );
  });

  it("reacts to auth state events", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("unauthenticated"));

    act(() => {
      mocks.listeners[0]?.("SIGNED_IN", session("user-2"));
    });

    expect(screen.getByTestId("state")).toHaveTextContent("authenticated:user-2");
  });

  it("does not let a slow getSession result override a newer auth event", async () => {
    let resolveSession: ((value: unknown) => void) | undefined;
    mocks.getSession.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      }),
    );

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    act(() => {
      mocks.listeners[0]?.("SIGNED_OUT", null);
    });
    expect(screen.getByTestId("state")).toHaveTextContent("unauthenticated");

    await act(async () => {
      resolveSession?.({ data: { session: session("stale-user") }, error: null });
    });

    expect(screen.getByTestId("state")).toHaveTextContent("unauthenticated");
  });

  it("removes its auth subscription on unmount", () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });

    const { unmount } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    unmount();

    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("clears the session through Supabase on sign out", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: session("user-3") }, error: null });
    mocks.signOut.mockResolvedValue({ error: null });

    render(
      <AuthProvider>
        <Probe />
        <SignOutProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("authenticated:user-3"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(mocks.signOut).toHaveBeenCalled());
  });
});
