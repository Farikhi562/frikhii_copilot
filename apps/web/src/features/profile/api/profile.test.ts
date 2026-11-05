import { describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import {
  displayName,
  ensurePreferences,
  ensureProfile,
  fetchProfile,
  updatePreferences,
} from "./profile";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("../../../lib/supabase", () => ({
  requireSupabase: () => ({ from: mocks.from }),
}));

type DbResult = { data: unknown; error: { message: string } | null };

function createBuilder(maybeResult: DbResult, singleResult?: DbResult) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => maybeResult,
    single: async () => singleResult ?? maybeResult,
    upsert: vi.fn(() => builder),
    update: vi.fn(() => builder),
  };
  return builder;
}

const user = {
  id: "user-1",
  email: "ada@example.com",
  user_metadata: { full_name: "  Ada Lovelace " },
} as unknown as User;

const profileRow = {
  id: "user-1",
  full_name: "Ada Lovelace",
  avatar_url: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const preferencesRow = {
  user_id: "user-1",
  learning_language: "id-ID",
  preferred_theme: "system",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("profile data access", () => {
  it("returns null when the profile row does not exist", async () => {
    mocks.from.mockReturnValue(createBuilder({ data: null, error: null }));
    await expect(fetchProfile("user-1")).resolves.toBeNull();
  });

  it("surfaces Supabase errors instead of pretending the profile exists", async () => {
    mocks.from.mockReturnValue(
      createBuilder({ data: null, error: { message: "permission denied" } }),
    );
    await expect(fetchProfile("user-1")).rejects.toThrow("permission denied");
  });

  it("uses an existing profile without writing a new one", async () => {
    const builder = createBuilder({ data: profileRow, error: null });
    mocks.from.mockReturnValue(builder);

    await expect(ensureProfile(user)).resolves.toEqual(profileRow);
    expect(builder.upsert).not.toHaveBeenCalled();
  });

  it("recovers a missing profile from auth metadata", async () => {
    const builder = createBuilder(
      { data: null, error: null },
      { data: { ...profileRow, full_name: "Ada Lovelace" }, error: null },
    );
    mocks.from.mockReturnValue(builder);

    await expect(ensureProfile(user)).resolves.toMatchObject({ full_name: "Ada Lovelace" });
    expect(builder.upsert).toHaveBeenCalledWith(
      { id: "user-1", full_name: "Ada Lovelace" },
      { onConflict: "id" },
    );
  });

  it("creates default preferences when the row is missing", async () => {
    const builder = createBuilder(
      { data: null, error: null },
      { data: preferencesRow, error: null },
    );
    mocks.from.mockReturnValue(builder);

    await expect(ensurePreferences("user-1")).resolves.toEqual(preferencesRow);
    expect(builder.upsert).toHaveBeenCalledWith(
      { user_id: "user-1" },
      { onConflict: "user_id" },
    );
  });

  it("sends only the edited preference fields", async () => {
    const builder = createBuilder(
      { data: null, error: null },
      { data: { ...preferencesRow, preferred_theme: "light" }, error: null },
    );
    mocks.from.mockReturnValue(builder);

    await updatePreferences("user-1", { preferred_theme: "light" });

    expect(builder.upsert).toHaveBeenCalledWith(
      { user_id: "user-1", preferred_theme: "light" },
      { onConflict: "user_id" },
    );
  });
});

describe("displayName", () => {
  it("prefers the profile name, then auth metadata, then the email local part", () => {
    expect(displayName(profileRow, user)).toBe("Ada Lovelace");
    expect(displayName(null, user)).toBe("Ada Lovelace");
    expect(
      displayName(null, {
        ...user,
        user_metadata: {},
      } as User),
    ).toBe("ada");
    expect(displayName(null, null)).toBe("Learner");
  });
});
