import { beforeEach, describe, expect, it } from "vitest";
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
import { TutorUnavailableError, tutorModes, tutorService } from "./tutor/tutor";
import { useShellStore } from "./shell/shellStore";

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
  it("offers six modes", () => expect(tutorModes).toHaveLength(6));
  it("never fabricates an answer while no backend exists", async () => {
    expect(tutorService.available).toBe(false);
    await expect(tutorService.send({ mode: "explain", message: "hi", context: {} })).rejects.toBeInstanceOf(
      TutorUnavailableError,
    );
  });
});

describe("shell store", () => {
  beforeEach(() => useShellStore.getState().setCollapsed(false));
  it("toggles the collapsed preference", () => {
    useShellStore.getState().toggle();
    expect(useShellStore.getState().collapsed).toBe(true);
  });
});
