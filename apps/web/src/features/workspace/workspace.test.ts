import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { courseDetailSchema } from "../course/schemas/course";
import { demoCourse, DEMO_COURSE_ID } from "./demo/demoCourse";
import { demoRichLesson } from "./demo/demoLesson";
import {
  classPath,
  classStatus,
  flattenClasses,
  flattenLessons,
  formatMinutes,
  greeting,
  lessonPath,
  roadmapPath,
  tutorPath,
} from "./courseView";
import { blueprintToBlocks, wordCount } from "./lessonBlocks";
import { deriveTargetedCompetencies } from "./progress/derive";
import { tutorModes, tutorService } from "./tutor/tutor";
import { useShellStore } from "./shell/shellStore";

// The tutor talks to the Core API with a Supabase bearer token; tests run without
// Supabase configuration, so provide a stub session for the wiring test below.
vi.mock("../../lib/supabase", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/supabase")>();
  return {
    ...actual,
    requireSupabase: () =>
      ({
        auth: {
          getSession: async () => ({ data: { session: { access_token: "test-token" } }, error: null }),
        },
      }) as unknown as ReturnType<typeof actual.requireSupabase>,
  };
});

const version = demoCourse.version as NonNullable<typeof demoCourse.version>;

describe("demo course", () => {
  it("matches the real CourseDetail schema and is clearly marked as a demo", () => {
    expect(courseDetailSchema.safeParse(demoCourse).success).toBe(true);
    expect(demoCourse.id).toBe(DEMO_COURSE_ID);
    expect(version.title.toLowerCase()).toContain("sample");
  });
  it("has a rich lesson with several block types", () => {
    expect(new Set(demoRichLesson.map((b) => b.type)).size).toBeGreaterThan(4);
  });
});

describe("course view helpers", () => {
  it("flattens classes and lessons in order", () => {
    const classes = flattenClasses(version);
    expect(classes).toHaveLength(6);
    expect(flattenLessons(version)).toHaveLength(12);
  });
  it("only the first class is available; completion is never inferred", () => {
    expect(classStatus(0)).toBe("available");
    expect(classStatus(1)).toBe("upcoming");
  });
  it("builds paths and formats minutes", () => {
    expect(roadmapPath("c1")).toBe("/app/courses/c1/roadmap");
    expect(classPath("c1", "k")).toBe("/app/courses/c1/classes/k");
    expect(lessonPath("c1", "l")).toBe("/app/courses/c1/lessons/l");
    expect(tutorPath()).toBe("/app/tutor");
    expect(tutorPath("c1", "l")).toContain("course=c1");
    expect(formatMinutes(90)).toBe("1.5 h");
  });
  it("greets by time of day", () => {
    expect(greeting(new Date("2026-01-01T08:00:00"))).toBe("Good morning");
    expect(greeting(new Date("2026-01-01T20:00:00"))).toBe("Good evening");
  });
});

describe("lesson blocks", () => {
  it("renders a blueprint lesson as blocks without inventing prose", () => {
    const lesson = flattenLessons(version)[0].lesson;
    const blocks = blueprintToBlocks(lesson);
    expect(blocks.length).toBeGreaterThan(0);
    expect(wordCount(blocks)).toBeGreaterThan(0);
  });
});

describe("progress derivation", () => {
  it("lists competencies actually targeted by the course", () => {
    const list = deriveTargetedCompetencies([demoCourse]);
    expect(list.length).toBe(version.target_competencies.length);
  });
});

describe("AI tutor", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("offers six modes", () => expect(tutorModes).toHaveLength(6));

  it("creates a conversation and shows the reply produced by the engine", async () => {
    const calls: Array<{ method: string; url: string; body: Record<string, unknown> | undefined }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        let payload: unknown;
        let status = 200;
        if (method === "GET" && url.endsWith("/api/v1/conversations")) {
          payload = { conversations: [] };
        } else if (method === "POST" && url.endsWith("/api/v1/conversations")) {
          status = 201;
          payload = { conversation: { id: "conv-1", title: "Explain tutor", tutor_mode: "explain" } };
        } else if (method === "POST" && url.includes("/conversations/conv-1/messages")) {
          payload = {
            user_message: { id: "m-1" },
            assistant_message: { id: "m-2", content: "A reply produced by the engine." },
          };
        } else {
          throw new Error(`unexpected request: ${method} ${url}`);
        }
        calls.push({ method, url, body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined });
        return new Response(JSON.stringify(payload), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    const result = await tutorService.send({
      mode: "explain",
      message: "What is a goroutine?",
      context: { courseTitle: "Go Foundations" },
    });

    // The reply text comes verbatim from the API response, never from the client.
    expect(result.text).toBe("A reply produced by the engine.");
    expect(calls.map((c) => `${c.method} ${new URL(c.url).pathname}`)).toEqual([
      "GET /api/v1/conversations",
      "POST /api/v1/conversations",
      "POST /api/v1/conversations/conv-1/messages",
    ]);
    expect(calls[1].body).toMatchObject({ tutor_mode: "explain" });
    expect(calls[1].body?.title).toEqual(expect.stringContaining("Explain"));
    expect(calls[2].body).toEqual({
      content: "What is a goroutine?",
      context: { course_title: "Go Foundations" },
    });
  });
});

describe("shell store", () => {
  beforeEach(() => useShellStore.getState().setCollapsed(false));
  it("toggles the collapsed preference", () => {
    useShellStore.getState().toggle();
    expect(useShellStore.getState().collapsed).toBe(true);
  });
});
