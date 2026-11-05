import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, createLearningGoal, getLatestDiagnostic } from "./course";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("../../../lib/supabase", () => ({
  requireSupabase: () => ({ auth: { getSession: mocks.getSession } }),
}));

const goal = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "Learn Go",
  goal_statement: "Build a production service.",
  intended_outcome: "Ship a tested API.",
  motivation: "Work.",
  additional_context: "",
  self_reported_level: "basic",
  current_knowledge: {},
  weekly_study_minutes: 300,
  learning_language: "en-US",
  learning_preferences: {},
  target_date: null,
  status: "intake",
  last_error: null,
  course_id: null,
  course_status: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const input = {
  title: "Learn Go",
  goal_statement: "Build a production service.",
  intended_outcome: "Ship a tested API.",
  motivation: "Work.",
  additional_context: "",
  self_reported_level: "basic" as const,
  current_knowledge: {},
  weekly_study_minutes: 300,
  learning_language: "en-US" as const,
  learning_preferences: {},
  target_date: null,
};

const fetchMock = vi.fn();

beforeEach(() => {
  mocks.getSession.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mocks.getSession.mockResolvedValue({
    data: { session: { access_token: "access-token" } },
    error: null,
  });
});

describe("Core API client", () => {
  it("sends the Supabase access token and parses the envelope", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ learning_goal: goal }), {
        status: 201,
        headers: { "Content-Type": "application/json", "X-Request-ID": "request-1" },
      }),
    );

    const created = await createLearningGoal(input);

    expect(created.id).toBe(goal.id);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/learning-goals");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer access-token");
    expect((init.headers as Record<string, string>)["X-Request-ID"]).toBeTruthy();
  });

  it("surfaces the server's error code and validation details", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "validation_error",
            message: "The request is invalid.",
            request_id: "request-2",
            details: { errors: ["title must be between 3 and 160 characters"] },
          },
        }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(createLearningGoal(input)).rejects.toMatchObject({
      name: "ApiError",
      status: 422,
      code: "validation_error",
      details: { errors: ["title must be between 3 and 160 characters"] },
    });
  });

  it("fails clearly when there is no Supabase session", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });

    await expect(createLearningGoal(input)).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null when the goal has no diagnostic yet", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "not_found", message: "Diagnostic not found.", request_id: "r3" },
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(getLatestDiagnostic(goal.id)).resolves.toBeNull();
  });
});
